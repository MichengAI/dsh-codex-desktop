import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

interface AfterPackContext {
  appOutDir: string
  packager: {
    appInfo: {
      productFilename: string
    }
  }
}

type CommandRunner = (file: string, arguments_: string[]) => Promise<unknown>

export function shouldAdhocSignMacApplication(
  platform = process.platform,
  enabled = process.env.DSH_MACOS_ADHOC_SIGN,
): boolean {
  return platform === 'darwin' && enabled === 'true'
}

export function resolveMacApplicationPath(context: AfterPackContext): string {
  return join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
}

export async function adhocSignMacApplication(
  context: AfterPackContext,
  runCommand: CommandRunner = execFileAsync,
  platform = process.platform,
  enabled = process.env.DSH_MACOS_ADHOC_SIGN,
): Promise<void> {
  if (!shouldAdhocSignMacApplication(platform, enabled)) return
  const applicationPath = resolveMacApplicationPath(context)
  console.log(`对完整 macOS 应用执行 ad-hoc 签名：${applicationPath}`)
  await runCommand('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', applicationPath])
}

export default adhocSignMacApplication
