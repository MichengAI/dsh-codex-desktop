import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { startAfterPluginUpdates } from '../src/profile-repair.js'
import { findRecoveryCandidates } from '../src/recovery-diagnostics.js'
import { captureProfileHealthCheckpoint } from '../src/profile-health-checkpoint.js'
import { enterRecoveryMode } from '../src/recovery-mode.js'

test('pnpm 安装失败仍尝试 DSH，加载成功时正常返回', async () => {
  const events: string[] = []
  const failure = new Error('ERR_PNPM_IGNORED_BUILDS node-pty')
  const result = await startAfterPluginUpdates({
    applyUpdates: async () => { events.push('install'); throw failure },
    onUpdateError: async error => { assert.equal(error, failure); events.push('installation-error') },
    start: async () => { events.push('load-dsh'); return 'healthy' },
  })
  assert.equal(result, 'healthy')
  assert.deepEqual(events, ['install', 'installation-error', 'load-dsh'])
})

test('安装失败且 DSH 无法加载时，只传播实际加载错误供恢复诊断', async () => {
  const loadError = new Error('Cannot find package missing imported from /profile/node_modules/broken/index.js')
  await assert.rejects(startAfterPluginUpdates({
    applyUpdates: async () => { throw new Error('installation failed') },
    onUpdateError: async () => {},
    start: async () => { throw loadError },
  }), error => error === loadError)
})

async function fixture(run: (profile: string) => Promise<void>): Promise<void> {
  const profile = await mkdtemp(join(tmpdir(), 'dsh-recovery-candidates-'))
  try {
    for (const [name, dependencies] of [['healthy', {}], ['sidebar', { adapter: '1.0.0' }], ['adapter', { 'node-pty': '1.1.0' }]] as const) {
      const dir = join(profile, 'node_modules', name)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name, dependencies }), 'utf8')
    }
    await writeFile(join(profile, 'package.json'), JSON.stringify({
      dependencies: { healthy: '1.0.0', sidebar: '1.0.0' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'healthy', 'sidebar', 'dsh-desktop-bridge'] } },
    }), 'utf8')
    await run(profile)
  } finally {
    await rm(profile, { recursive: true, force: true })
  }
}

test('原生传递依赖加载错误只列出所属插件，不列出全部第三方插件', () => fixture(async profile => {
  assert.deepEqual(await findRecoveryCandidates(profile, 'Error: /profile/node_modules/node-pty/build/Release/pty.node invalid'), ['sidebar'])
  const suspects = await findRecoveryCandidates(profile, 'Cannot find package \'node-pty\'')
  const status = await enterRecoveryMode(profile, { suspectedPlugins: suspects })
  assert.deepEqual(status.isolated.map(plugin => plugin.packageName), ['sidebar'])
  assert.equal(JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')).dsh.profile.bundles.includes('healthy'), true)
}))

test('前端多个失败插件都能定位，未知模块和核心包不能伪装成插件', () => fixture(async profile => {
  assert.deepEqual(await findRecoveryCandidates(profile, 'client failed', ['healthy', 'sidebar', 'unknown', '@deepseek-ai/dsh-base']), ['healthy', 'sidebar'])
  assert.deepEqual(await findRecoveryCandidates(profile, 'Error /runtime/node_modules/@deepseek-ai/dsh/lib/index.js'), [])
  assert.deepEqual(await findRecoveryCandidates(profile, 'cannot resolve profile bundle "sidebar"'), ['sidebar'])
}))

test('缺少具体报错时仅以最近健康配置后的变更为线索，系统错误不归责插件', () => fixture(async profile => {
  assert.deepEqual(await findRecoveryCandidates(profile, 'DSH 提前退出'), [])
  await captureProfileHealthCheckpoint(profile)
  const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
  manifest.dependencies.sidebar = '2.0.0'
  await writeFile(join(profile, 'package.json'), JSON.stringify(manifest), 'utf8')
  assert.deepEqual(await findRecoveryCandidates(profile, 'DSH 提前退出'), ['sidebar'])
  assert.deepEqual(await findRecoveryCandidates(profile, 'EADDRINUSE'), [])
  assert.deepEqual(await findRecoveryCandidates(profile, 'failed overlay /profile/node_modules/healthy/index.js'), ['healthy'])
}))
