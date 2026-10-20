/** 自动重载等待的调度依赖；与 Electron 无关，便于直接验证行为。 */
export interface PluginReloadWaitOptions {
  /** 一轮有界静默检查，超时返回 false，不代表操作已结束。 */
  readonly waitUntilQuiet: () => Promise<boolean>
  /** 退出应用或其他重载已接管时停止等待。 */
  readonly shouldStop: () => boolean
  /** 一轮检查超时后的诊断，不得在此强制重启或清理包。 */
  readonly onTimeout: () => void
}

/**
 * 等待完整操作静默。单轮超时只告警并重试，取消则不放行重载。
 * 陈旧记录的识别归状态检查器；调度器不通过强制重启或删除记录猜测安装结果。
 * @returns 仅在静默且未取消时返回 true。
 */
export async function waitForPluginReloadReady(options: PluginReloadWaitOptions): Promise<boolean> {
  while (!options.shouldStop()) {
    const ready = await options.waitUntilQuiet()
    if (options.shouldStop()) return false
    if (ready) return true
    options.onTimeout()
  }
  return false
}
