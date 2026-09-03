import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

import {
  enterRecoveryMode,
  getRecoveryStatus,
  isRecoveryModeActive,
  leaveRecoveryMode,
  restoreRecoveryPlugin,
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

test('恢复模式只保留锁定版本的内置 bundle，并保留原清单备份', async () => {
  const { root, profile } = await createProfile()
  try {
    const status = await enterRecoveryMode(profile)
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

test('内置插件即使出现在诊断中，也不能作为可卸载的疑似第三方插件保存', async () => {
  const { root, profile } = await createProfile()
  try {
    const status = await enterRecoveryMode(profile, { suspectedPlugin: '@michengai/dsh-codex-ui' })
    assert.equal(status.suspectedPlugin, undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('恢复模式有效时，启动补种不能把隔离的第三方 bundle 写回清单', async () => {
  const { root, profile } = await createProfile()
  try {
    await enterRecoveryMode(profile)
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
    await enterRecoveryMode(profile)
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
    await enterRecoveryMode(profile)
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
    await enterRecoveryMode(profile)
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
