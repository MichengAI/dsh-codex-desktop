import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { writeTextFileAtomicSync } from './atomic-file.js'

/** core 插件管理器在 pnpm 运行期间写这条记录，bundle 校准结束后才删除。 */
export function pluginRunRecordPath(profileDir: string): string {
  return join(profileDir, '.plugin-manager', 'run.json')
}

/** 桌面桥接在 pnpm 及其后的 bundle 校准期间写这条标记。 */
export function desktopPluginOperationMarkerPath(profileDir: string): string {
  return join(profileDir, '.desktop-plugin-operation.json')
}

/** 记录文件里的 pid；任何无法解析的内容都当作没有信号，绝不阻塞重启。 */
export function parsePluginOperationPid(source: string): number | undefined {
  try {
    const value = JSON.parse(source) as { pid?: unknown }
    const pid = value.pid
    return typeof pid === 'number' && Number.isSafeInteger(pid) && pid > 0 && pid <= 2147483647 ? pid : undefined
  } catch {
    return undefined
  }
}

/** pid 仍存活（EPERM 表示进程存在但不属于当前用户）。 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function activePidIn(path: string): number | undefined {
  try {
    const pid = parsePluginOperationPid(readFileSync(path, 'utf8'))
    return pid !== undefined && isProcessAlive(pid) ? pid : undefined
  } catch {
    return undefined
  }
}

export interface PluginOperationProbeOptions {
  readonly platform?: NodeJS.Platform
  readonly kill?: (pid: number, signal: 0) => unknown
  readonly now?: () => number
  /** 被忽略的 core 记录；调用方可按 reason + path 去重记录告警。不会删除文件。 */
  readonly onDiagnostic?: (diagnostic: { reason: 'orphan-run' | 'malformed-lock', path: string }) => void
}

// 只给无法辨认 owner 的锁短暂稳定宽限；绝不用文件年龄判断活 owner 已死。
const malformedLocks = new Map<string, { fingerprint: string, since: number }>()
const MALFORMED_LOCK_GRACE_MS = 2_000

/** core 的 writer lock 覆盖 pnpm 退出后的校准；run 还保护失去 owner 的子进程。 */
function corePluginOperationActive(profileDir: string, options: PluginOperationProbeOptions): boolean {
  const alive = (pid: number): boolean => {
    try {
      ;(options.kill ?? process.kill)(pid, 0)
      return true
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== 'ESRCH'
    }
  }
  const lockPath = join(profileDir, 'package.json.lock')
  try {
    const record = readFileSync(lockPath, 'utf8')
    const pid = /^\d+\n$/.test(record) ? Number(record.trim()) : 0
    if (Number.isSafeInteger(pid) && pid > 0 && pid <= 2147483647) {
      malformedLocks.delete(lockPath)
      if (alive(pid)) return true
    } else {
      const stat = statSync(lockPath)
      const fingerprint = JSON.stringify([record, stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs])
      const now = (options.now ?? Date.now)()
      const previous = malformedLocks.get(lockPath)
      if (previous?.fingerprint !== fingerprint) {
        // 有界缓存只影响宽限起点，淘汰会更保守而非提前放行。
        if (malformedLocks.size >= 256) malformedLocks.delete(malformedLocks.keys().next().value!)
        malformedLocks.set(lockPath, { fingerprint, since: now })
        return true
      }
      if (now - previous.since < MALFORMED_LOCK_GRACE_MS) return true
      options.onDiagnostic?.({ reason: 'malformed-lock', path: lockPath })
    }
  } catch (error) {
    malformedLocks.delete(lockPath)
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return true
  }
  try {
    const record = readFileSync(pluginRunRecordPath(profileDir), 'utf8')
    const pid = parsePluginOperationPid(record)
    if (pid !== undefined) {
      const grouped = (JSON.parse(record) as { grouped?: unknown }).grouped === true
      if (alive((options.platform ?? process.platform) !== 'win32' && grouped ? -pid : pid)) return true
    }
    options.onDiagnostic?.({ reason: 'orphan-run', path: pluginRunRecordPath(profileDir) })
    return false
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ENOENT'
  }
}

/**
 * profile 上是否有插件安装/更新/卸载仍在进行。
 * core 同时检查完整生命周期锁和 pnpm；孤儿记录只忽略，绝不删除。
 * 桌面标记按宿主 pid 判断；读取方保持只读，避免误删写入方刚替换的记录。
 */
export function isPluginOperationActive(profileDir: string, options: PluginOperationProbeOptions = {}): boolean {
  if (corePluginOperationActive(profileDir, options)) return true
  try {
    const directory = desktopPluginOperationsDir(profileDir)
    if (readdirSync(directory).some(file => file.endsWith('.json') && activePidIn(join(directory, file)) !== undefined)) return true
  } catch {
    // 目录尚不存在或不可读时继续检查旧版标记。
  }
  // 旧版共享标记仅兼容读取，不删除：检查后写入方可能已经替换了文件。
  return activePidIn(desktopPluginOperationMarkerPath(profileDir)) !== undefined
}

/** 每次操作拥有独立文件，清理令牌只能删除自己。 */
export function desktopPluginOperationsDir(profileDir: string): string {
  return join(profileDir, '.desktop-plugin-operations')
}

/** 写入失败不挡住安装；返回幂等清理函数，调用方必须覆盖全部退出路径。 */
export function markPluginOperation(profileDir: string): () => void {
  const directory = desktopPluginOperationsDir(profileDir)
  const path = join(directory, `${randomUUID()}.json`)
  try {
    mkdirSync(directory, { recursive: true })
    writeTextFileAtomicSync(path, `${JSON.stringify({ pid: process.pid })}\n`)
  } catch {
    // 标记只用于推迟热重载，失败时不能挡住安装。
  }
  return () => {
    try {
      rmSync(path, { force: true })
    } catch {
      // 清除失败不掩盖原始安装结果。
    }
  }
}

export interface ProfileQuietSignals {
  /** 插件市场自己报告的忙碌状态。 */
  readonly marketBusy: () => Promise<boolean>
  /** profile 上记录的安装操作是否仍在进行。 */
  readonly pluginOperationActive: () => boolean
}

export interface ProfileQuietOptions {
  readonly maxWaitMs: number
  readonly pollIntervalMs: number
  /** 需要连续多少次全部静默采样才算真正结束，默认 2；两次采样间隔一次轮询。 */
  readonly quietWindows?: number
}

/**
 * 等所有插件操作真正结束再允许重启。市场忙碌、profile 上的安装记录、
 * 以及安装后处理都必须静默，并连续取得 `quietWindows` 次安静采样。
 * maxWaitMs 仅限制本轮检查；超时返回 false，不证明操作已结束。
 * 调用方应保留待重载请求并继续下一轮等待，不得因本轮超时强制重启。
 * @returns 是否在本轮等待上限内达到静默。
 */
export async function waitForProfileQuiet(
  signals: ProfileQuietSignals,
  pause: () => Promise<void>,
  options: ProfileQuietOptions,
): Promise<boolean> {
  const quietWindows = Math.max(1, options.quietWindows ?? 2)
  let waitedMs = 0
  let quiet = 0
  /** 暂停一轮；越过等待上限时返回 false，让调用方按超时处理。 */
  const pauseWithinDeadline = async (): Promise<boolean> => {
    if (waitedMs >= options.maxWaitMs) return false
    await pause()
    waitedMs += options.pollIntervalMs
    return true
  }
  for (;;) {
    const busy = await signals.marketBusy().catch(() => false) || signals.pluginOperationActive()
    if (busy) {
      quiet = 0
      if (!await pauseWithinDeadline()) return false
      continue
    }
    quiet += 1
    if (quiet >= quietWindows) return true
    if (!await pauseWithinDeadline()) return false
  }
}
