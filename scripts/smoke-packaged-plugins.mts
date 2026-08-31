import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BUNDLED_PLUGINS } from '../src/bundled-plugins.js'

interface PackageManifest {
  version?: unknown
}

/** 验证隔离 Profile 完全依靠随包 store 安装了全部固定版本插件。 */
export async function verifyBundledPluginsInstalled(dshHome: string): Promise<void> {
  const profileDir = join(dshHome, 'profiles', 'web')
  for (const plugin of BUNDLED_PLUGINS) {
    const manifestPath = join(profileDir, 'node_modules', ...plugin.packageName.split('/'), 'package.json')
    let manifest: PackageManifest
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PackageManifest
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`强制离线首启缺少插件：${plugin.packageName}（${detail}）`)
    }
    if (manifest.version !== plugin.version) {
      throw new Error(`强制离线首启插件版本错误：${plugin.packageName}=${String(manifest.version)}`)
    }
  }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const dshHome = process.argv[2]
  if (dshHome === undefined || dshHome === '') throw new Error('缺少待校验的 DSH_HOME。')
  await verifyBundledPluginsInstalled(dshHome)
}
