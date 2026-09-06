import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { createDesktopHostServices } from './desktop-host.js'

export const name = 'dsh-desktop-bridge'

interface CordisLike {
  provide?(name: string, value?: unknown): void
  set?(name: string, value: unknown): void
  [key: string]: unknown
}

/** 向 DSH 提供官方桌面契约，让插件市场走随包 pnpm，并由桌面端负责热更新。 */
export function apply(ctx: CordisLike): void {
  // 共享 profile 或继承环境变量不代表存在 Desktop 宿主与可用的安装工具。
  if (process.env.DSH_DESKTOP_HOST !== '1' || !process.connected || typeof process.send !== 'function') return
  const pnpmEntry = process.env.DSH_PNPM_ENTRY
  if (!pnpmEntry || !existsSync(pnpmEntry)) return
  const profileDir = process.env.DSH_PROFILE_DIR ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'profiles', 'web')
  const host = createDesktopHostServices({
    profileName: process.env.DSH_PROFILE_NAME ?? 'web',
    profileDir,
    ...(process.env.DSH_RUNTIME_DIR === undefined ? {} : { desktopRuntimeDir: process.env.DSH_RUNTIME_DIR }),
    send: typeof process.send === 'function' ? process.send.bind(process) : undefined,
  })
  ctx.provide?.('desktopProfiles', host.desktopProfiles)
  ctx.provide?.('desktopPnpm', host.desktopPnpm)
  try {
    ctx.set?.('desktopProfiles', host.desktopProfiles)
    ctx.set?.('desktopPnpm', host.desktopPnpm)
  } catch {
    // 部分宿主只允许 provide 写入，set 会因未预声明而抛错。
  }
  ctx.desktopProfiles = host.desktopProfiles
  ctx.desktopPnpm = host.desktopPnpm
}
