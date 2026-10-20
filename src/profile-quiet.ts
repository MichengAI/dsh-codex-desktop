import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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
 * 两个信号都按「记录里的进程是否还活着」判断：安装器崩溃留下的陈旧记录只忽略，
 * core 的记录不归桌面端清理，桌面端自己的标记则顺手删掉。
 */
export function isPluginOperationActive(profileDir: string): boolean {
  if (activePidIn(pluginRunRecordPath(profileDir)) !== undefined) return true
  const markerPath = desktopPluginOperationMarkerPath(profileDir)
  if (!existsSync(markerPath)) return false
  if (activePidIn(markerPath) !== undefined) return true
  try {
    rmSync(markerPath, { force: true })
  } catch {
    // 清理失败不影响判断：下一轮还会重新读取。
  }
  return false
}

/** 桌面桥接开始一次 profile 变更时写标记；写不进去就退回原有行为，不影响安装本身。 */
export function markPluginOperation(profileDir: string): void {
  try {
    writeFileSync(desktopPluginOperationMarkerPath(profileDir), `${JSON.stringify({ pid: process.pid })}\n`, 'utf8')
  } catch {
    // 标记只用于推迟热重载，失败时不能挡住安装。
  }
}

/** 安装后处理（bundle 校准）结束时清除标记。 */
export function clearPluginOperationMarker(profileDir: string): void {
  try {
    rmSync(desktopPluginOperationMarkerPath(profileDir), { force: true })
  } catch {
    // 清除失败时，陈旧标记会因进程已退出而被忽略。
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
