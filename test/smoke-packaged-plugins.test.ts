import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { verifyBundledPluginsInstalled } from '../scripts/smoke-packaged-plugins.mjs'
import { BUNDLED_PLUGINS } from '../src/bundled-plugins.js'

async function writePlugin(dshHome: string, packageName: string, version: string): Promise<void> {
  const packageDir = join(dshHome, 'profiles', 'web', 'node_modules', ...packageName.split('/'))
  await mkdir(packageDir, { recursive: true })
  await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: packageName, version }), 'utf8')
}

test('Unix 打包冒烟核对全部随包插件及固定版本', async () => {
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-smoke-plugins-'))
  try {
    for (const plugin of BUNDLED_PLUGINS) await writePlugin(dshHome, plugin.packageName, plugin.version)
    await verifyBundledPluginsInstalled(dshHome)

    const missing = BUNDLED_PLUGINS[0]!
    await rm(join(dshHome, 'profiles', 'web', 'node_modules', ...missing.packageName.split('/')), { recursive: true })
    await assert.rejects(verifyBundledPluginsInstalled(dshHome), new RegExp(`缺少插件：${missing.packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  } finally {
    await rm(dshHome, { recursive: true, force: true })
  }
})

test('Unix 打包冒烟拒绝错误插件版本', async () => {
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-smoke-plugins-'))
  try {
    for (const plugin of BUNDLED_PLUGINS) await writePlugin(dshHome, plugin.packageName, plugin.version)
    const mismatched = BUNDLED_PLUGINS.at(-1)!
    await writePlugin(dshHome, mismatched.packageName, '0.0.0-test')
    await assert.rejects(verifyBundledPluginsInstalled(dshHome), new RegExp(`版本错误：${mismatched.packageName}=0.0.0-test`))
  } finally {
    await rm(dshHome, { recursive: true, force: true })
  }
})
