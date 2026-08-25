import { mkdtempSync, rmSync } from 'node:fs'
import { dirname, join, win32 } from 'node:path'

export const DESKTOP_APP_NAME = 'DSH Codex Desktop'
export const DESKTOP_USER_DATA_DIR = DESKTOP_APP_NAME
export const DESKTOP_APP_USER_MODEL_ID = 'ai.micheng.deepseekHarnessDesktop'
export const DESKTOP_TOAST_ACTIVATOR_CLSID = '{9D7BD1F0-EB17-48E8-AC4A-5347F81E719A}'

/** Electron 默认用 package.json 的 name，这里强制改到和应用名一致的目录。 */
export function resolveDesktopUserDataDir(appDataDir: string): string {
  return join(appDataDir, DESKTOP_USER_DATA_DIR)
}
/** 打包后优先把官方运行时放安装目录，避免几百 MB 再写进 C 盘 AppData。 */
export function resolveDesktopRuntimeDir(userDataDir: string, options: {
  isPackaged: boolean
  execPath: string
  platform?: NodeJS.Platform
  canWrite?: (dir: string) => boolean
}): string {
  const platform = options.platform ?? process.platform
  if (options.isPackaged && platform !== 'darwin') {
    const path = platform === 'win32' ? win32 : { dirname, join }
    const installDir = path.dirname(options.execPath)
    const canWrite = options.canWrite ?? canWriteDirectory
    if (canWrite(installDir)) return path.join(installDir, 'dsh-runtime')
  }
  return join(userDataDir, 'dsh-runtime')
}

function canWriteDirectory(dir: string): boolean {
  let probe: string | undefined
  try {
    probe = mkdtempSync(join(dir, '.dsh-write-test-'))
    return true
  } catch {
    return false
  } finally {
    if (probe !== undefined) {
      try {
        rmSync(probe, { recursive: true, force: true })
      } catch {
        // 探测目录清理失败时不改变已经得到的可写结论。
      }
    }
  }
}
