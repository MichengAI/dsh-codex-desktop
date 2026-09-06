import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { BUNDLED_PLUGINS } from '../src/bundled-plugins.js'
import { buildSeedPluginArgs, ensureProfileScaffold } from '../src/plugin-seed.js'
import { prependPath } from '../src/plugin-toolchain.js'
import { extractTarGz, packDirectoryToTarGz, verifyFileSha256, writeFileSha256 } from '../src/runtime-archive.js'

// 从归档解出独立 store，再以完全离线方式验证发布清单和包入口。
const rootArg = process.argv[2]
if (!rootArg) throw new Error('缺少已装配的插件资源目录。')
const root = resolve(rootArg)
const archive = join(root, 'store.tgz')
const extracted = join(root, 'extracted-store')
const profile = join(root, 'offline-profile')
const userHome = join(root, 'isolated-home')
assert.equal(existsSync(extracted), false, '解压目录必须是全新目录')
assert.equal(existsSync(profile), false, '验证 profile 必须是全新目录')
packDirectoryToTarGz(join(root, 'store'), archive)
writeFileSha256(archive)
verifyFileSha256(archive)
extractTarGz(archive, extracted)
await ensureProfileScaffold(profile)
await mkdir(userHome, { recursive: true })
const nodeRoot = resolve('runtime-node')
const result = spawnSync(join(nodeRoot, process.platform === 'win32' ? 'node.exe' : 'node'), [
  join(nodeRoot, 'pnpm-package', 'bin', 'pnpm.cjs'),
  ...buildSeedPluginArgs(BUNDLED_PLUGINS, profile, { storeDir: extracted, offline: true }),
], {
  env: {
    ...process.env, CI: 'true', PATH: prependPath(process.env.PATH, nodeRoot), npm_config_offline: 'true',
    HOME: userHome, USERPROFILE: userHome,
    APPDATA: join(userHome, 'AppData', 'Roaming'), LOCALAPPDATA: join(userHome, 'AppData', 'Local'),
    XDG_CONFIG_HOME: join(userHome, '.config'), XDG_CACHE_HOME: join(userHome, '.cache'), XDG_DATA_HOME: join(userHome, '.local', 'share'),
  },
  encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
})
if (result.status !== 0) throw new Error(result.error?.message ?? `${result.stdout}\n${result.stderr}`)
const installed = []
for (const plugin of BUNDLED_PLUGINS) {
  const directory = join(profile, 'node_modules', ...plugin.packageName.split('/'))
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  assert.equal(manifest.name, plugin.packageName)
  assert.equal(manifest.version, plugin.version)
  assert.equal(typeof manifest.dsh?.bundle?.patch, 'string')
  assert.equal(existsSync(join(directory, manifest.dsh.bundle.patch)), true)
  assert.equal(typeof manifest.main, 'string')
  assert.equal(existsSync(join(directory, manifest.main)), true)
  installed.push({ name: manifest.name, version: manifest.version })
}
console.log(JSON.stringify({ offline: true, archiveIntegrity: 'passed', installed }, null, 2))
