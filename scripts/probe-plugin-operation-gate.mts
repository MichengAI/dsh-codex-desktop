/**
 * 插件操作闸门集成探针（不是 Electron 重载 E2E）：用真实 pnpm 装一个带 dsh.bundle 的 registry 插件，
 * 打印三个时间点（pnpm 退出 / apply-plugin-updates IPC / profile 监听触发），
 * 并记录监听触发那一刻闸门信号的值。
 *
 * 用法（先 pnpm run build）：
 *   node dist/scripts/probe-plugin-operation-gate.mjs [包名]
 * 默认包名 dsh-better-sidebar，必须来自 registry 且带 dsh.bundle——
 * 用 `pnpm add <本地目录>` 时 packageNames 会把路径当包名，finalize 与 IPC 都不会发生。
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { APPLY_PLUGIN_UPDATES_IPC } from '../src/bundled-plugins.js'
import { createDesktopHostServices, runBundledPnpm } from '../src/desktop-host.js'
import { terminateProcessTree } from '../src/process-control.js'
import { desktopPluginOperationsDir, isPluginOperationActive } from '../src/profile-quiet.js'
import { watchProfileActivation } from '../src/profile-watch.js'

const packageName = process.argv[2] ?? 'dsh-better-sidebar'
const pnpmEntry = process.env.DSH_PNPM_ENTRY ?? resolve('runtime-node/pnpm-package/bin/pnpm.cjs')
if (!existsSync(pnpmEntry)) throw new Error(`未找到 pnpm 入口：${pnpmEntry}`)
process.env.DSH_PNPM_ENTRY = pnpmEntry

async function waitFor(predicate: () => boolean, timeoutMs: number, message: string): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    assert.ok(Date.now() < deadline, message)
    await new Promise(resolveDelay => setTimeout(resolveDelay, 20))
  }
}

async function runProbe(profileDir: string): Promise<void> {
  let watcher: ReturnType<typeof watchProfileActivation> | undefined
  let poll: ReturnType<typeof setInterval> | undefined
  let handle: ReturnType<typeof runBundledPnpm> | undefined
  let runnerDone = false
  try {
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
    let ipcSent = false

    watcher = watchProfileActivation(profileDir, () => {
      watcherFired = true
      markerActiveWhenWatcherFired = isPluginOperationActive(profileDir)
      events.push(`watcher 触发 +${at()}ms，此刻 pluginOperationActive=${String(markerActiveWhenWatcherFired)}`)
    }, { debounceMs: 800 })

    const host = createDesktopHostServices({
      profileName: 'web',
      profileDir,
      send: message => {
        if (message === APPLY_PLUGIN_UPDATES_IPC) ipcSent = true
        events.push(`IPC ${String(message)} +${at()}ms`)
      },
      runner: runBundledPnpm,
    })

    poll = setInterval(() => {
      if (isPluginOperationActive(profileDir)) markerSeenDuringInstall = true
    }, 10)

    handle = host.desktopPnpm.runPlugin(['add', packageName], profileDir)
    const outcome = await handle.done
    runnerDone = true
    events.push(`pnpm 退出 code=${String(outcome.exitCode)} +${at()}ms`)
    clearInterval(poll)
    assert.equal(outcome.exitCode, 0, 'pnpm 安装应当成功')
    // 等待实际 IPC 与后处理结束，而不是猜测固定休眠时长。
    await waitFor(() => ipcSent && watcherFired && !isPluginOperationActive(profileDir), 10_000,
      '等待 apply-plugin-updates IPC / watcher / 操作标记清理超时')

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
      ipcSent,
      watcherFired,
      markerActiveWhenWatcherFired,
      markerLeftAfterInstall: markerLeft,
      events,
      profileDir,
    }, undefined, 2))

    assert.equal(ipcSent, true, '必须真实发送 apply-plugin-updates IPC')
    assert.equal(watcherFired, true, 'profile watcher 必须真实触发')
    assert.equal(markerSeenDuringInstall, true, 'pnpm 运行期间必须有操作标记')
    assert.equal(bundles.includes(packageName), true, '安装后 bundle 校准应把插件写进清单')
    assert.equal(markerLeft, false, '安装后处理结束后必须清除标记')
  } finally {
    clearInterval(poll)
    watcher?.stop()
    if (handle !== undefined) {
      if (!runnerDone) handle.cancel()
      await handle.done
      // done 不包含 finalize；等待它的 finally 释放标记，超时则退出 worker 隔离残余写入。
      await waitFor(() => !isPluginOperationActive(profileDir), 10_000, '安装后处理未释放操作标记')
    }
  }
}

if (process.argv[3] === '--gate-probe-worker') {
  // 显式退出保证未结束的异步校准不会在父进程删除 profile 后继续写入。
  await runProbe(process.argv[4]!).then(() => process.exit(0), error => {
    console.error(error)
    process.exit(1)
  })
} else {
  const profileDir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'dsh-gate-probe-'))
  console.log(JSON.stringify({ profileDir }))
  let deadline: ReturnType<typeof setTimeout> | undefined
  try {
    const worker = spawn(process.execPath, [fileURLToPath(import.meta.url), packageName, '--gate-probe-worker', profileDir], {
      stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32',
    })
    deadline = setTimeout(() => {
      console.error('probe 超过 320 秒，终止本次探针进程树。')
      terminateProcessTree(worker, { processGroup: true })
    }, 320_000)
    const code = await new Promise<number | null>((resolveExit, reject) => {
      worker.once('error', reject)
      worker.once('close', resolveExit)
    })
    process.exitCode = code ?? 1
  } finally {
    clearTimeout(deadline)
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}
