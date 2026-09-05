import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { type TestContext } from 'node:test'
import vm from 'node:vm'

import { startAfterPluginUpdates, startWithProfileSelfRepair } from '../src/profile-repair.js'
import { findRecoveryCandidates } from '../src/recovery-diagnostics.js'
import { captureProfileHealthCheckpoint, readProfileHealthCheckpoint } from '../src/profile-health-checkpoint.js'
import * as recovery from '../src/recovery-mode.js'
import * as diagnostics from '../src/startup-diagnostics.js'

// 执行当前构建产物中的真实函数，仅替换 Electron、安装器与 DSH 进程边界。
const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
const functionNames = new Set([
  'startRendererHealthTimer', 'stopRendererHealthTimer', 'handleRendererBootReport',
  'startupDiagnosticPath', 'beginDshStartupDiagnostic', 'advanceDshStartupDiagnostic',
  'clearRecoverySessionHints', 'maybeLeaveRecoveryMode', 'openWorkbenchOrRecovery',
  'startupRecoveryCandidates', 'presentDshLoadFailure', 'reportStartupFailure',
  'recycleDshForPluginUpdate', 'restartDshInRecoveryMode', 'recoveryPageStatus',
])
const executable = [...functionNames].map(name => {
  // tsc 顶层函数的结束括号独占顶格一行，提取后由 VM 再次进行语法校验。
  const declaration = new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^\\}`, 'm').exec(mainSource)?.[0]
  assert.ok(declaration, `构建产物缺少函数：${name}`)
  return declaration
}).join('\n')

async function harness(t: TestContext, options: { installError?: Error; loadError?: Error } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-main-recovery-scenarios-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const profile = join(root, 'web')
  const logs = join(root, 'logs')
  await mkdir(logs)
  for (const name of ['healthy-plugin', 'broken-plugin', 'adapter']) {
    const dir = join(profile, 'node_modules', name)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      name, version: '1.0.0', dsh: { bundle: { patch: 'patch.yml' } },
      dependencies: name === 'broken-plugin' ? { adapter: '1.0.0' } : name === 'adapter' ? { 'node-pty': '1.1.0' } : {},
    }), 'utf8')
    await writeFile(join(dir, 'patch.yml'), '[]', 'utf8')
  }
  await writeFile(join(profile, 'package.json'), JSON.stringify({
    dependencies: { 'healthy-plugin': '1.0.0', 'broken-plugin': '1.0.0' },
    dsh: { profile: { bundles: ['healthy-plugin', 'broken-plugin'] } },
  }), 'utf8')
  await captureProfileHealthCheckpoint(profile)
  const events: string[] = []
  const errors: unknown[][] = []
  const timers: Array<{ callback(): void; delay: number }> = []
  const server = { url: 'http://127.0.0.1:43210', stop: async () => { events.push('stop') } }
  const scope = vm.createContext({
    ...recovery, ...diagnostics, captureProfileHealthCheckpoint, readProfileHealthCheckpoint,
    startAfterPluginUpdates, startWithProfileSelfRepair, findRecoveryCandidates,
    Error, URL, join, readFile, writeTextFile: writeFile,
    console: { error: (...args: unknown[]) => errors.push(args), log: () => {}, warn: () => {} },
    app: { getPath: () => logs }, desktopText: (zh: string) => zh,
    startupErrorLogPath: () => join(profile, '.dsh-desktop-startup-error.log'),
    profileDir: profile, server, startupDiagnosticStage: 'renderer-loading',
    lastStartOptions: {}, lastSeedOptions: { profileDir: profile },
    isQuitting: false, isRecycling: false, handlingRendererBootFailure: false,
    rendererHealthTimer: undefined, recoveryFailureMessage: undefined,
    recoveryFailurePlugin: undefined, recoveryFailurePlugins: [],
    presentation: 'workbench', allowedOrigin: undefined,
    profileWatcher: { sync: () => events.push('sync') }, broadcastShellState: () => {},
    handleUnexpectedDshExit: () => {}, handleDshIpc: () => {},
    applyPendingProfileUpdates: async () => { events.push('install'); if (options.installError) throw options.installError; return [] },
    startDsh: async () => { events.push('start'); if (options.loadError) throw options.loadError; return server },
    createMainWindow: async () => { scope.presentation = 'workbench'; events.push('workbench') },
    returnToWorkbenchFromRecovery: async () => { scope.presentation = 'workbench' },
    showStartupWindow: async () => { scope.presentation = 'startup'; events.push('startup') },
    showRecoveryWindow: async (_profile: string, failure?: { failureMessage: string; failurePlugins: string[] }) => {
      scope.presentation = 'recovery'; events.push('recovery')
      if (failure !== undefined) {
        scope.recoveryFailureMessage = failure.failureMessage
        scope.recoveryFailurePlugins = failure.failurePlugins
        scope.recoveryFailurePlugin = failure.failurePlugins[0]
      }
    },
    setTimeout: (callback: () => void, delay: number) => { timers.push({ callback, delay }); return { unref() {} } },
    clearTimeout: () => {},
  })
  vm.runInContext(executable, scope)
  return {
    profile, logs, scope, events, errors, timers,
    run: (expression: string): Promise<unknown> => Promise.resolve(vm.runInContext(expression, scope)),
    async changePlugin() {
      const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
      manifest.dependencies['broken-plugin'] = '2.0.0'
      await writeFile(join(profile, 'package.json'), JSON.stringify(manifest), 'utf8')
    },
    async fireRendererTimeout() {
      vm.runInContext('startRendererHealthTimer(profileDir)', scope)
      assert.equal(timers.at(-1)?.delay, 30_000)
      timers.at(-1)!.callback()
      // 虚拟推进 30 秒定时器，只等待真实文件 I/O 完成。
      const deadline = Date.now() + 5_000
      while (scope.handlingRendererBootFailure && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5))
      assert.equal(scope.handlingRendererBootFailure, false)
    },
  }
}

test('场景01：安装成功且 DSH 加载成功，进入工作台', async t => {
  const h = await harness(t)
  await h.run('recycleDshForPluginUpdate()')
  assert.equal(h.scope.presentation, 'workbench')
  assert.equal(recovery.isRecoveryModeActive(h.profile), false)
  assert.deepEqual(h.events, ['startup', 'stop', 'install', 'start', 'workbench', 'sync'])
})

for (const [id, message] of [['02', 'ERR_PNPM_IGNORED_BUILDS node-pty'], ['03', 'ECONNRESET registry.npmjs.org'], ['04', 'EPERM rename package.json']]) {
  test(`场景${id}：${message} 安装失败，但 DSH 可加载，不进入恢复`, async t => {
    const h = await harness(t, { installError: new Error(message) })
    await h.run('recycleDshForPluginUpdate()')
    assert.equal(h.scope.presentation, 'workbench')
    assert.equal(recovery.isRecoveryModeActive(h.profile), false)
    assert.equal((await readFile(join(h.logs, 'plugin-update.log'), 'utf8')).trim(), message)
    await h.run('handleRendererBootReport({ status: "healthy" }, profileDir)')
    assert.equal((await diagnostics.readStartupDiagnostic(join(h.profile, '.dsh-desktop-startup-diagnostics.json')))?.stage, 'healthy')
  })
}

for (const [id, installError] of [['05', new Error('installation failed')], ['06', undefined]] as const) {
  test(`场景${id}：安装${installError ? '失败' : '成功'}但插件导致 DSH 加载失败，仅显示相关候选`, async t => {
    const h = await harness(t, { installError, loadError: new Error('failed to parse overlay /profile/node_modules/broken-plugin/patch.yml') })
    await h.run('recycleDshForPluginUpdate()')
    assert.equal(h.scope.presentation, 'recovery')
    assert.deepEqual(Array.from(h.scope.recoveryFailurePlugins), ['broken-plugin'])
    assert.equal(recovery.isRecoveryModeActive(h.profile), false, '显示页面不能自动修改隔离状态')
    const manifest = JSON.parse(await readFile(join(h.profile, 'package.json'), 'utf8'))
    assert.equal(manifest.dsh.profile.bundles.includes('healthy-plugin'), true)
  })
}

test('场景07：原生传递依赖损坏，仅定位所属插件', async t => {
  const h = await harness(t, { loadError: new Error('Cannot find package \'node-pty\' imported from /profile/node_modules/adapter/index.js') })
  await h.run('recycleDshForPluginUpdate()')
  assert.equal(h.scope.presentation, 'recovery')
  assert.deepEqual(Array.from(h.scope.recoveryFailurePlugins), ['broken-plugin'])
})

for (const [id, message] of [['08', 'EADDRINUSE'], ['09', '官方运行时缺少内置 bundle']]) {
  test(`场景${id}：${message} 即使发生在插件更新后，也不隔离插件`, async t => {
    const h = await harness(t, { loadError: new Error(message) })
    await h.changePlugin()
    await h.run('recycleDshForPluginUpdate()')
    assert.equal(h.scope.presentation, 'startup')
    assert.equal(recovery.isRecoveryModeActive(h.profile), false)
    assert.deepEqual(Array.from(h.scope.recoveryFailurePlugins), [])
  })
}

test('场景10：启动失败但没有插件线索，展示普通错误', async t => {
  const h = await harness(t, { loadError: new Error('DSH 提前退出') })
  await h.run('recycleDshForPluginUpdate()')
  assert.equal(h.scope.presentation, 'startup')
  assert.equal(recovery.isRecoveryModeActive(h.profile), false)
})

test('场景11：安装残留缺包被现有自修复移除后，DSH 可继续启动', async t => {
  const h = await harness(t, { installError: new Error('installation interrupted') })
  await rm(join(h.profile, 'node_modules', 'broken-plugin'), { recursive: true, force: true })
  await h.run('recycleDshForPluginUpdate()')
  assert.equal(h.scope.presentation, 'workbench')
  assert.equal(recovery.isRecoveryModeActive(h.profile), false)
})

test('场景12：前端实际无法加载且报告故障插件，显示该插件', async t => {
  const h = await harness(t)
  h.scope.presentation = 'blank'
  await h.run('handleRendererBootReport({ status: "failed", plugins: ["broken-plugin"], error: "插件加载导致页面初始化中止" }, profileDir)')
  assert.equal(h.scope.presentation, 'recovery')
  assert.deepEqual(Array.from(h.scope.recoveryFailurePlugins), ['broken-plugin'])
})

test('场景13：已有未处理的隔离项，应用重开后保留恢复会话', async t => {
  const h = await harness(t)
  await recovery.enterRecoveryMode(h.profile, { suspectedPlugins: ['broken-plugin'] })
  await h.run('openWorkbenchOrRecovery(profileDir, server.url)')
  assert.equal(h.scope.presentation, 'recovery')
  assert.deepEqual((await recovery.getRecoveryStatus(h.profile)).isolated.map(p => p.packageName), ['broken-plugin'])
})

test('场景14：单项恢复后客户端完全健康，退出恢复并保存检查点', async t => {
  const h = await harness(t)
  await recovery.enterRecoveryMode(h.profile, { suspectedPlugins: ['broken-plugin'] })
  await recovery.restoreRecoveryPlugin(h.profile, 'broken-plugin')
  assert.equal(await recovery.tryAutoLeaveRecoveryMode(h.profile), false)
  await h.run('handleRendererBootReport({ status: "healthy" }, profileDir)')
  assert.equal(recovery.isRecoveryModeActive(h.profile), false)
  assert.equal((await diagnostics.readStartupDiagnostic(join(h.profile, '.dsh-desktop-startup-diagnostics.json')))?.stage, 'healthy')
})

test('场景15：试恢复后再次前端加载失败，只重新隔离故障项', async t => {
  const h = await harness(t)
  await recovery.enterRecoveryMode(h.profile, { suspectedPlugins: ['healthy-plugin', 'broken-plugin'] })
  await recovery.restoreRecoveryPlugin(h.profile, 'healthy-plugin')
  await recovery.restoreRecoveryPlugin(h.profile, 'broken-plugin')
  h.scope.presentation = 'blank'
  await h.run('handleRendererBootReport({ status: "failed", plugins: ["broken-plugin"] }, profileDir)')
  assert.equal(h.scope.presentation, 'recovery')
  const status = await recovery.getRecoveryStatus(h.profile)
  assert.deepEqual(status.isolated.map(p => p.packageName), ['broken-plugin'])
  assert.deepEqual(status.pendingRestore, ['healthy-plugin'])
})

test('场景16：30 秒超时但没有插件变更或错误线索，不进入插件恢复', async t => {
  const h = await harness(t)
  await h.fireRendererTimeout()
  assert.equal(h.scope.presentation, 'startup')
  assert.equal(recovery.isRecoveryModeActive(h.profile), false)
})

test('场景17：工作台仍可用时，非关键插件失败不应强制切换到恢复页', async t => {
  const h = await harness(t)
  const checkpoint = await readProfileHealthCheckpoint(h.profile)
  await h.changePlugin()
  assert.equal(h.scope.presentation, 'workbench')
  await h.run('handleRendererBootReport({ status: "failed", plugins: ["broken-plugin"], workbenchReady: true }, profileDir)')
  assert.equal(h.scope.presentation, 'workbench')
  assert.equal(recovery.isRecoveryModeActive(h.profile), false)
  assert.deepEqual(await readProfileHealthCheckpoint(h.profile), checkpoint)
  assert.match(await readFile(join(h.profile, '.dsh-desktop-startup-error.log'), 'utf8'), /broken-plugin/)
})

test('场景18：30 秒加载超时且近期有插件变更，进入恢复并列出变更项', async t => {
  const h = await harness(t)
  await h.changePlugin()
  await h.fireRendererTimeout()
  assert.equal(h.scope.presentation, 'recovery')
  assert.deepEqual(Array.from(h.scope.recoveryFailurePlugins), ['broken-plugin'])
})

test('场景19：试恢复插件仍有异常但工作台可用，保留工作台和恢复备份', async t => {
  const h = await harness(t)
  await recovery.enterRecoveryMode(h.profile, { suspectedPlugins: ['broken-plugin'] })
  await recovery.restoreRecoveryPlugin(h.profile, 'broken-plugin')
  await h.run('handleRendererBootReport({ status: "failed", plugins: ["broken-plugin"], workbenchReady: true }, profileDir)')
  assert.equal(h.scope.presentation, 'workbench')
  const status = await recovery.getRecoveryStatus(h.profile)
  assert.deepEqual(status.pendingRestore, ['broken-plugin'])
  assert.deepEqual(status.isolated, [])
  assert.equal(recovery.isRecoveryModeActive(h.profile), true)
})
