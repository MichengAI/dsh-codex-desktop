/**
 * 插件操作闸门端到端探针：用真实 pnpm 装一个带 dsh.bundle 的 registry 插件，
 * 打印三个时间点（pnpm 退出 / apply-plugin-updates IPC / profile 监听触发），
 * 并记录监听触发那一刻闸门信号的值。
 *
 * 用法（先 pnpm run build）：
 *   node dist/scripts/probe-plugin-operation-gate.mjs [包名]
 * 默认包名 dsh-better-sidebar，必须来自 registry 且带 dsh.bundle——
 * 用 `pnpm add <本地目录>` 时 packageNames 会把路径当包名，finalize 与 IPC 都不会发生。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { createDesktopHostServices, runBundledPnpm } from '../src/desktop-host.js'
import { desktopPluginOperationsDir, isPluginOperationActive } from '../src/profile-quiet.js'
import { watchProfileActivation } from '../src/profile-watch.js'

const packageName = process.argv[2] ?? 'dsh-better-sidebar'
const pnpmEntry = process.env.DSH_PNPM_ENTRY ?? resolve('runtime-node/pnpm-package/bin/pnpm.cjs')
if (!existsSync(pnpmEntry)) throw new Error(`未找到 pnpm 入口：${pnpmEntry}`)
process.env.DSH_PNPM_ENTRY = pnpmEntry

const profileDir = mkdtempSync(join(tmpdir(), 'dsh-gate-probe-'))
writeFileSync(join(profileDir, 'package.json'), `${JSON.stringify({
  name: 'gate-probe-profile',
  private: true,
  version: '1.0.0',
  dependencies: {},
  dsh: { profile: { bundles: [] } },
}, undefined, 2)}\n`)

const events: string[] = []
const startedAt = Date.now()
const at = (): number => Date.now() - startedAt
let markerSeenDuringInstall = false
let markerActiveWhenWatcherFired: boolean | undefined
let watcherFired = false

const watcher = watchProfileActivation(profileDir, () => {
  watcherFired = true
  markerActiveWhenWatcherFired = isPluginOperationActive(profileDir)
  events.push(`watcher 触发 +${at()}ms，此刻 pluginOperationActive=${String(markerActiveWhenWatcherFired)}`)
}, { debounceMs: 800 })

const host = createDesktopHostServices({
  profileName: 'web',
  profileDir,
  send: message => { events.push(`IPC ${String(message)} +${at()}ms`) },
  runner: runBundledPnpm,
})

const poll = setInterval(() => {
  if (isPluginOperationActive(profileDir)) markerSeenDuringInstall = true
}, 10)

const handle = host.desktopPnpm.runPlugin(['add', packageName], profileDir)
const outcome = await handle.done
events.push(`pnpm 退出 code=${String(outcome.exitCode)} +${at()}ms`)
clearInterval(poll)
// 等 IPC（默认 400ms 延迟）与 watcher（800ms 防抖）都跑完。
await new Promise(resolveDelay => setTimeout(resolveDelay, 2_500))
watcher.stop()

const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(join(profileDir, 'package.json'), 'utf8')) as {
  dsh?: { profile?: { bundles?: string[] } }
}
const bundles = manifest.dsh?.profile?.bundles ?? []
const markerDirectory = desktopPluginOperationsDir(profileDir)
const markersLeft = existsSync(markerDirectory) ? readdirSync(markerDirectory).filter(file => file.endsWith('.json')) : []
const markerLeft = markersLeft.length > 0

console.log(JSON.stringify({
  packageName,
  exitCode: outcome.exitCode,
  bundles,
  markerSeenDuringInstall,
  watcherFired,
  markerActiveWhenWatcherFired,
  markerLeftAfterInstall: markerLeft,
  events,
  profileDir,
}, undefined, 2))

assert.equal(outcome.exitCode, 0, 'pnpm 安装应当成功')
assert.equal(markerSeenDuringInstall, true, 'pnpm 运行期间必须有操作标记')
assert.equal(bundles.includes(packageName), true, '安装后 bundle 校准应把插件写进清单')
assert.equal(markerLeft, false, '安装后处理结束后必须清除标记')
