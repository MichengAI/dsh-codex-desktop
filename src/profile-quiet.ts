import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
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
    return typeof pid === 'number' && Number.isSafeInteger(pid) && pid > 0 ? pid : undefined
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

/**
 * profile 上是否有插件安装/更新/卸载仍在进行。
 * core 记录存在即忙碌：pnpm pid 退出后仍可能在校准，只有 core 能删除记录。
 * 桌面标记按宿主 pid 判断；读取方保持只读，避免误删写入方刚替换的记录。
 */
export function isPluginOperationActive(profileDir: string): boolean {
  // core 记录的是 pnpm pid，但删除记录之前仍会校准 bundle；pid 退出不代表操作结束。
  if (existsSync(pluginRunRecordPath(profileDir))) return true
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
  /** 需要连续多少次全部静默才算真正结束，默认 2：安装后处理常紧随 pnpm 退出。 */
  readonly quietWindows?: number
}

/**
 * 等所有插件操作真正结束再允许重启。市场忙碌、profile 上的安装记录、
 * 以及安装后处理都必须静默，并连续跨过 `quietWindows` 个安静窗口。
 * 等待有上限：信号卡住时只告警，不把重启永久挂住。
 * @returns 是否在等待上限内达到静默。
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
