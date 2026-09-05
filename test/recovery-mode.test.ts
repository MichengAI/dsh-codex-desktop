import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

import {
  canAutoLeaveRecoveryMode,
  confirmRecoveryStartup,
  enterRecoveryMode,
  getRecoveryStatus,
  isRecoveryModeActive,
  leaveRecoveryMode,
  restoreRecoveryPlugin,
  tryAutoLeaveRecoveryMode,
  uninstallRecoveryPlugin,
} from '../src/recovery-mode.js'
import { finalizeProfileBundlesAfterInstall } from '../src/plugin-seed.js'

async function createProfile(): Promise<{ root: string; profile: string }> {
  const root = join(process.cwd(), 'artifacts', `recovery-mode-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const profile = join(root, 'profile')
  await mkdir(profile, { recursive: true })
  await writeFile(join(profile, 'package.json'), JSON.stringify({
    dependencies: {
      '@michengai/dsh-codex-ui': '0.2.102',
      'third-party-plugin': '1.2.3',
    },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@michengai/dsh-codex-ui', 'third-party-plugin', 'dsh-desktop-bridge'] } },
  }, undefined, 2), 'utf8')
  for (const [packageName, version] of [['@michengai/dsh-codex-ui', '0.2.102'], ['third-party-plugin', '1.2.3']]) {
    const packageDir = join(profile, 'node_modules', ...packageName.split('/'))
    await mkdir(packageDir, { recursive: true })
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: packageName, version }), 'utf8')
  }
  return { root, profile }
}

test('恢复模式只隔离被诊断指向的插件，并保留原清单备份', async () => {
  const { root, profile } = await createProfile()
  try {
    const status = await enterRecoveryMode(profile, { suspectedPlugin: 'third-party-plugin' })
    assert.equal(status.active, true)
    assert.deepEqual(status.isolated.map(plugin => plugin.packageName), ['third-party-plugin'])
    const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')) as { dsh: { profile: { bundles: string[] } } }
    assert.deepEqual(manifest.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@michengai/dsh-codex-ui', 'dsh-desktop-bridge'])
    assert.equal(isRecoveryModeActive(profile), true)
    assert.equal(existsSync(join(profile, '.dsh-desktop-recovery.package.json')), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('恢复状态持久化疑似出错插件，便于重启后提示卸载', async () => {
  const { root, profile } = await createProfile()
  try {
    const status = await enterRecoveryMode(profile, {
      suspectedPlugin: 'third-party-plugin',
      failureMessage: '插件 third-party-plugin 的 patch 文件无法解析。',
    })
    assert.equal(status.suspectedPlugin, 'third-party-plugin')
    assert.equal((await getRecoveryStatus(profile)).suspectedPlugin, 'third-party-plugin')
    assert.equal((await getRecoveryStatus(profile)).failureMessage, '插件 third-party-plugin 的 patch 文件无法解析。')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('随包社区插件确实加载失败时也可单独隔离，无关第三方插件继续加载', async () => {
  const { root, profile } = await createProfile()
  try {
    const status = await enterRecoveryMode(profile, { suspectedPlugin: '@michengai/dsh-codex-ui' })
    assert.equal(status.suspectedPlugin, '@michengai/dsh-codex-ui')
    assert.deepEqual(status.isolated.map(plugin => plugin.packageName), ['@michengai/dsh-codex-ui'])
    const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
    assert.equal(manifest.dsh.profile.bundles.includes('third-party-plugin'), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('恢复模式有效时，启动补种不能把隔离的第三方 bundle 写回清单', async () => {
  const { root, profile } = await createProfile()
  try {
    await enterRecoveryMode(profile, { suspectedPlugin: 'third-party-plugin' })
    await finalizeProfileBundlesAfterInstall(profile)
    const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')) as { dsh: { profile: { bundles: string[] } } }
    assert.equal(manifest.dsh.profile.bundles.includes('third-party-plugin'), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('恢复单个插件会按原始顺序恢复 bundle 和依赖声明', async () => {
  const { root, profile } = await createProfile()
  try {
    await enterRecoveryMode(profile, { suspectedPlugin: 'third-party-plugin' })
    const status = await restoreRecoveryPlugin(profile, 'third-party-plugin')
    assert.deepEqual(status.isolated, [])
    const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; dsh: { profile: { bundles: string[] } } }
    assert.equal(manifest.dependencies['third-party-plugin'], '1.2.3')
    assert.deepEqual(manifest.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@michengai/dsh-codex-ui', 'third-party-plugin', 'dsh-desktop-bridge'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('卸载仅允许隔离的第三方插件，并同时移除清单和磁盘目录', async () => {
  const { root, profile } = await createProfile()
  try {
    await enterRecoveryMode(profile, { suspectedPlugin: 'third-party-plugin' })
    await assert.rejects(() => uninstallRecoveryPlugin(profile, '@michengai/dsh-codex-ui'))
    const status = await uninstallRecoveryPlugin(profile, 'third-party-plugin')
    assert.deepEqual(status.isolated, [])
    const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; dsh: { profile: { bundles: string[] } } }
    assert.equal(manifest.dependencies['third-party-plugin'], undefined)
    assert.equal(manifest.dsh.profile.bundles.includes('third-party-plugin'), false)
    assert.equal(existsSync(join(profile, 'node_modules', 'third-party-plugin')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('卸载先提交清单和恢复状态，再移动插件目录，并为正常异常保留回滚', async () => {
  const source = await readFile(new URL('../../src/recovery-mode.ts', import.meta.url), 'utf8')
  const uninstall = source.match(/export async function uninstallRecoveryPlugin[\s\S]*?\n\}/)?.[0]
  assert.ok(uninstall)
  const writeManifestIndex = uninstall.indexOf('await writeManifest(profileDir, nextManifest)')
  const writeStateIndex = uninstall.indexOf('await writeState(profileDir, nextState)')
  const renameIndex = uninstall.indexOf('await rename(source, trash)')
  assert.ok(writeManifestIndex >= 0)
  assert.ok(writeStateIndex > writeManifestIndex)
  assert.ok(renameIndex > writeStateIndex)
  assert.match(uninstall, /await writeManifest\(profileDir, manifest\)/)
  assert.match(uninstall, /await writeState\(profileDir, state\)/)
})

test('无恢复状态时返回非活动状态', async () => {
  const { root, profile } = await createProfile()
  try {
    assert.deepEqual(await getRecoveryStatus(profile), { active: false, isolated: [] })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('退出恢复模式只清理恢复状态，不删除已安装插件', async () => {
  const { root, profile } = await createProfile()
  try {
    await enterRecoveryMode(profile, { suspectedPlugin: 'third-party-plugin' })
    await leaveRecoveryMode(profile)
    assert.equal(isRecoveryModeActive(profile), false)
    assert.deepEqual(await getRecoveryStatus(profile), { active: false, isolated: [] })
    assert.equal(existsSync(join(profile, '.dsh-desktop-recovery.json')), false)
    assert.equal(existsSync(join(profile, '.dsh-desktop-recovery.package.json')), false)
    assert.equal(existsSync(join(profile, 'node_modules', 'third-party-plugin')), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('没有隔离插件时可以自动退出恢复模式', async () => {
  const { root, profile } = await createProfile()
  try {
    await enterRecoveryMode(profile, { suspectedPlugin: 'third-party-plugin' })
    await uninstallRecoveryPlugin(profile, 'third-party-plugin')
    const status = await getRecoveryStatus(profile)
    assert.equal(canAutoLeaveRecoveryMode(status), true)
    assert.equal(await tryAutoLeaveRecoveryMode(profile), true)
    assert.equal(isRecoveryModeActive(profile), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('仍有隔离插件时不能自动退出恢复模式', async () => {
  const { root, profile } = await createProfile()
  try {
    const status = await enterRecoveryMode(profile, { suspectedPlugin: 'third-party-plugin' })
    assert.equal(canAutoLeaveRecoveryMode(status), false)
    assert.equal(await tryAutoLeaveRecoveryMode(profile), false)
    assert.equal(isRecoveryModeActive(profile), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('恢复模式拒绝可能逃逸 profile 目录的插件标识', async () => {
  const { root, profile } = await createProfile()
  try {
    await writeFile(join(profile, 'package.json'), JSON.stringify({
      dependencies: { '..': '1.0.0' },
      dsh: { profile: { bundles: ['..'] } },
    }, undefined, 2), 'utf8')
    await assert.rejects(() => enterRecoveryMode(profile), /插件名称不合法/)
    assert.equal(existsSync(join(profile, '.dsh-desktop-recovery.json')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('没有可疑插件时不隔离整个 profile，也不创建恢复会话', async () => {
  const { root, profile } = await createProfile()
  try {
    const original = await readFile(join(profile, 'package.json'), 'utf8')
    assert.deepEqual(await enterRecoveryMode(profile), { active: false, isolated: [] })
    assert.equal(await readFile(join(profile, 'package.json'), 'utf8'), original)
    assert.equal(isRecoveryModeActive(profile), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('隔离守卫保留新安装的无关插件，恢复失败只重新隔离当前嫌疑插件', async () => {
  const { root, profile } = await createProfile()
  try {
    await enterRecoveryMode(profile, { suspectedPlugin: 'third-party-plugin' })
    const packageDir = join(profile, 'node_modules', 'healthy-new-plugin')
    await mkdir(packageDir, { recursive: true })
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: 'healthy-new-plugin', dsh: { bundle: { patch: 'patch.yml' } } }), 'utf8')
    await writeFile(join(packageDir, 'patch.yml'), '[]', 'utf8')
    const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
    manifest.dependencies['healthy-new-plugin'] = '1.0.0'
    await writeFile(join(profile, 'package.json'), JSON.stringify(manifest), 'utf8')
    await finalizeProfileBundlesAfterInstall(profile)
    await restoreRecoveryPlugin(profile, 'third-party-plugin')
    const status = await enterRecoveryMode(profile, { force: true, suspectedPlugin: 'third-party-plugin' })
    assert.deepEqual(status.isolated.map(plugin => plugin.packageName), ['third-party-plugin'])
    const after = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
    assert.equal(after.dsh.profile.bundles.includes('healthy-new-plugin'), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('恢复最后一个插件后必须等待完整健康检查才能清理备份', async () => {
  const { root, profile } = await createProfile()
  try {
    await enterRecoveryMode(profile, { suspectedPlugin: 'third-party-plugin' })
    await restoreRecoveryPlugin(profile, 'third-party-plugin')
    assert.equal(await tryAutoLeaveRecoveryMode(profile), false)
    assert.equal(existsSync(join(profile, '.dsh-desktop-recovery.package.json')), true)
    await confirmRecoveryStartup(profile)
    assert.equal(await tryAutoLeaveRecoveryMode(profile), true)
    assert.equal(isRecoveryModeActive(profile), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('多个插件试恢复后只有一个加载失败时，不重新隔离其他试恢复插件', async () => {
  const { root, profile } = await createProfile()
  try {
    await enterRecoveryMode(profile, { suspectedPlugins: ['third-party-plugin', '@michengai/dsh-codex-ui'] })
    await restoreRecoveryPlugin(profile, 'third-party-plugin')
    await restoreRecoveryPlugin(profile, '@michengai/dsh-codex-ui')
    const status = await enterRecoveryMode(profile, { force: true, suspectedPlugins: ['third-party-plugin'] })
    assert.deepEqual(status.isolated.map(plugin => plugin.packageName), ['third-party-plugin'])
    assert.deepEqual(status.pendingRestore, ['@michengai/dsh-codex-ui'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
