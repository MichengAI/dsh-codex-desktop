/** 在隔离目录依次启动旧版和新版桌面，验证真实历史 Profile 的离线升级。 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { BUNDLED_PLUGINS } from '../src/bundled-plugins.js'
import { terminateProcessTree } from '../src/process-control.js'
import { extractTarGz } from '../src/runtime-archive.js'

const [oldArgument, newArgument] = process.argv.slice(2)
if (!oldArgument || !newArgument) throw new Error('请传入旧版和新版桌面应用的绝对路径。')
const oldApplication = resolve(oldArgument), newApplication = resolve(newArgument)
const root = await mkdtemp(join(tmpdir(), 'dsh-real-profile-upgrade-'))
const home = join(root, 'home'), profile = join(home, 'profiles', 'web')
const legacyStore = join(root, 'legacy-store')

async function boot(application: string, stage: string, store?: string): Promise<void> {
  const userData = join(root, stage), ready = join(userData, 'ready')
  await mkdir(userData, { recursive: true })
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !['USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME'].includes(name.toUpperCase())))
  const env: NodeJS.ProcessEnv = {
    ...inherited, USERPROFILE: home, HOME: home, DSH_HOME: home,
    APPDATA: join(home, 'AppData', 'Roaming'), LOCALAPPDATA: join(home, 'AppData', 'Local'),
    XDG_CONFIG_HOME: join(home, '.config'), XDG_CACHE_HOME: join(home, '.cache'), XDG_DATA_HOME: join(home, '.local', 'share'),
    DSH_DESKTOP_SMOKE_READY_FILE: ready, pnpm_config_offline: 'true', npm_config_offline: 'true',
  }
  delete env.ELECTRON_RUN_AS_NODE
  await mkdir(env.APPDATA!, { recursive: true })
  await mkdir(env.LOCALAPPDATA!, { recursive: true })
  for (const name of ['XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME']) await mkdir(env[name]!, { recursive: true })
  if (store) env.DSH_BUNDLED_PLUGIN_STORE = store
  else delete env.DSH_BUNDLED_PLUGIN_STORE
  const child = spawn(application, [`--user-data-dir=${userData}`], { env, windowsHide: true, stdio: 'ignore' })
  let launchError: Error | undefined
  child.on('error', error => { launchError = error })
  try {
    const deadline = Date.now() + 180_000
    while (!existsSync(ready)) {
      if (launchError) throw launchError
      if (child.exitCode !== null) throw new Error(`${stage} 提前退出：${child.exitCode}`)
      for (const name of ['startup-error.log', 'plugin-seed.log', 'plugin-update.log']) {
        if (existsSync(join(userData, name))) throw new Error(await readFile(join(userData, name), 'utf8'))
      }
      if (Date.now() > deadline) throw new Error(`${stage} 启动超时。`)
      await delay(250)
    }
    assert.equal(existsSync(join(profile, '.dsh-desktop-recovery.json')), false, `${stage} 不应进入恢复模式`)
  } finally {
    terminateProcessTree(child)
    const deadline = Date.now() + 10_000
    while (child.exitCode === null && child.signalCode === null && !launchError && Date.now() < deadline) await delay(100)
  }
}

try {
  await mkdir(home, { recursive: true })
  extractTarGz(join(dirname(oldApplication), 'resources', 'plugins-store.tgz'), legacyStore)
  await boot(oldApplication, 'old', legacyStore)
  const archiveManifest = join(profile, 'node_modules', '@michengai', 'dsh-archive-manager', 'package.json')
  const oldArchive = JSON.parse(await readFile(archiveManifest, 'utf8')).version
  assert.equal(oldArchive, '0.1.34', '旧版归档插件应为待验证的 0.1.34')
  const modulesPath = join(profile, 'node_modules', '.modules.yaml')
  const oldStore = JSON.parse(await readFile(modulesPath, 'utf8')).storeDir
  assert.equal(oldStore, join(legacyStore, 'v11'), '必须使用隔离旧仓库')
  const patchPath = join(profile, 'cordis.patch.yml')
  const patch = await readFile(patchPath, 'utf8') + '\n# 升级冒烟：保留用户配置\n'
  await writeFile(patchPath, patch, 'utf8')
  await writeFile(join(profile, 'user-preserved.txt'), 'preserved', 'utf8')
  await boot(newApplication, 'new')
  for (const plugin of BUNDLED_PLUGINS) {
    const installed = JSON.parse(await readFile(join(profile, 'node_modules', plugin.packageName, 'package.json'), 'utf8'))
    assert.equal(installed.version, plugin.version, plugin.packageName)
  }
  assert.equal(JSON.parse(await readFile(modulesPath, 'utf8')).storeDir, oldStore)
  assert.equal(await readFile(patchPath, 'utf8'), patch)
  assert.equal(await readFile(join(profile, 'user-preserved.txt'), 'utf8'), 'preserved')
  console.log(`PASS: 真实旧版 Profile（归档 ${oldArchive}）离线升级，全部 ${BUNDLED_PLUGINS.length} 个配套插件版本正确，配置和原仓库保留，未进入恢复模式。`)
} finally {
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}
