import assert from 'node:assert/strict'
import fs, { existsSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { parse } from 'yaml'

import { migrateDesktopBridgeProfile, removeDesktopBridgePatch } from '../src/desktop-bridge-migration.js'

test('升级清理旧 bridge 的依赖声明、加载配置和文件，保留其他插件', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bridge-upgrade-'))
  const bridge = join(root, 'node_modules', 'dsh-desktop-bridge')
  const manifest = {
    name: 'web',
    dependencies: { demo: '1.0.0', 'dsh-desktop-bridge': 'file:./old-bridge' },
    devDependencies: { 'dsh-desktop-bridge': '0.0.0-desktop' },
    optionalDependencies: { 'dsh-desktop-bridge': '0.0.0-desktop' },
    dsh: { profile: { bundles: ['demo', 'dsh-desktop-bridge'] } },
  }
  try {
    await mkdir(bridge, { recursive: true })
    await mkdir(join(root, 'node_modules', 'demo'))
    await writeFile(join(bridge, 'package.json'), '{"name":"dsh-desktop-bridge"}', 'utf8')
    await writeFile(join(root, 'node_modules', 'demo', 'keep.txt'), '保留', 'utf8')
    await writeFile(join(root, 'package.json'), JSON.stringify(manifest), 'utf8')
    await writeFile(join(root, 'cordis.patch.yml'), '- id: dsh-desktop-bridge\n  name: dsh-desktop-bridge\n', 'utf8')
    migrateDesktopBridgeProfile(root)
    assert.deepEqual(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')), {
      name: 'web', dependencies: { demo: '1.0.0' }, devDependencies: {}, optionalDependencies: {},
      dsh: { profile: { bundles: ['demo'] } },
    })
    assert.equal(existsSync(bridge), false)
    assert.equal(await readFile(join(root, 'node_modules', 'demo', 'keep.txt'), 'utf8'), '保留')
    assert.deepEqual(parse(await readFile(join(root, 'cordis.patch.yml'), 'utf8')), [])
    assert.deepEqual(JSON.parse(await readFile(join(root, '.desktop-bridge-backup', 'package.json'), 'utf8')), manifest)
    migrateDesktopBridgeProfile(root)
    assert.equal(existsSync(bridge), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('已迁移过加载配置的 profile 仍清理孤立 bridge 文件', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bridge-orphan-'))
  const bridge = join(root, 'node_modules', 'dsh-desktop-bridge')
  const manifest = '{"dependencies":{"demo":"1.0.0"}}'
  try {
    await mkdir(bridge, { recursive: true })
    await writeFile(join(bridge, 'index.js'), '旧桥接', 'utf8')
    await writeFile(join(root, 'package.json'), manifest, 'utf8')
    migrateDesktopBridgeProfile(root)
    assert.equal(existsSync(bridge), false)
    assert.equal(await readFile(join(root, 'package.json'), 'utf8'), manifest)
    assert.equal(existsSync(join(root, '.desktop-bridge-backup')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('旧 bridge 是目录链接时只删除链接，保留链接目标和私有 bridge', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bridge-link-'))
  const profile = join(root, 'web')
  const target = join(root, 'private-bridge')
  const bridge = join(profile, 'node_modules', 'dsh-desktop-bridge')
  try {
    await mkdir(join(profile, 'node_modules'), { recursive: true })
    await mkdir(target)
    await writeFile(join(target, 'index.js'), '私有桥接', 'utf8')
    await symlink(target, bridge, process.platform === 'win32' ? 'junction' : 'dir')
    migrateDesktopBridgeProfile(profile)
    assert.equal(existsSync(bridge), false)
    assert.equal(await readFile(join(target, 'index.js'), 'utf8'), '私有桥接')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('旧文件被占用时已解除加载且不阻断启动，下次迁移重新清理', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bridge-busy-'))
  const bridge = join(root, 'node_modules', 'dsh-desktop-bridge')
  const warnings: string[] = []
  try {
    await mkdir(bridge, { recursive: true })
    await writeFile(join(root, 'package.json'), '{"dependencies":{"dsh-desktop-bridge":"0.0.0-desktop"},"dsh":{"profile":{"bundles":["dsh-desktop-bridge"]}}}', 'utf8')
    const remove = fs.rmSync
    const stub = t.mock.method(fs, 'rmSync', (path: fs.PathLike, options?: fs.RmOptions) => {
      if (path === bridge) throw Object.assign(new Error('文件被占用'), { code: 'EBUSY' })
      return remove(path, options)
    })
    syncBuiltinESMExports()
    try {
      assert.doesNotThrow(() => migrateDesktopBridgeProfile(root, message => warnings.push(message)))
    } finally {
      stub.mock.restore()
      syncBuiltinESMExports()
    }
    assert.equal(existsSync(bridge), true)
    assert.deepEqual(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')), { dependencies: {}, dsh: { profile: { bundles: [] } } })
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /下次启动重试.*文件被占用/)
    migrateDesktopBridgeProfile(root)
    assert.equal(existsSync(bridge), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('整个 node_modules 链接到外部目录时不删除外部文件', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bridge-external-'))
  const profile = join(root, 'web')
  const external = join(root, 'external-modules')
  const warnings: string[] = []
  try {
    await mkdir(profile)
    await mkdir(join(external, 'dsh-desktop-bridge'), { recursive: true })
    await writeFile(join(external, 'dsh-desktop-bridge', 'keep.txt'), '保留', 'utf8')
    await symlink(external, join(profile, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    migrateDesktopBridgeProfile(profile, message => warnings.push(message))
    assert.equal(await readFile(join(external, 'dsh-desktop-bridge', 'keep.txt'), 'utf8'), '保留')
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /目录链接/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('迁移共享 profile 只移除 bridge，备份原文且重复执行不改写', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bridge-migration-'))
  const manifest = JSON.stringify({ name: 'web', dependencies: { demo: '1.0.0' }, dsh: { profile: { bundles: ['demo', 'dsh-desktop-bridge'] } } })
  const patch = '# 用户配置\n- insert:\n  - id: dsh-desktop-bridge\n    name: dsh-desktop-bridge\n  - id: demo\n    name: demo\n    config: { value: "保留" }\n- id: demo\n  config: { enabled: true }\n'
  try {
    await writeFile(join(root, 'package.json'), manifest, 'utf8')
    await writeFile(join(root, 'cordis.patch.yml'), patch, 'utf8')
    migrateDesktopBridgeProfile(root)
    const nextManifest = await readFile(join(root, 'package.json'), 'utf8')
    const nextPatch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
    assert.deepEqual(JSON.parse(nextManifest), { name: 'web', dependencies: { demo: '1.0.0' }, dsh: { profile: { bundles: ['demo'] } } })
    assert.deepEqual(parse(nextPatch), [{ insert: [{ id: 'demo', name: 'demo', config: { value: '保留' } }] }, { id: 'demo', config: { enabled: true } }])
    assert.match(nextPatch, /# 用户配置/)
    assert.equal(await readFile(join(root, '.desktop-bridge-backup', 'package.json'), 'utf8'), manifest)
    assert.equal(await readFile(join(root, '.desktop-bridge-backup', 'cordis.patch.yml'), 'utf8'), patch)
    migrateDesktopBridgeProfile(root)
    assert.equal(await readFile(join(root, 'package.json'), 'utf8'), nextManifest)
    assert.equal(await readFile(join(root, 'cordis.patch.yml'), 'utf8'), nextPatch)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('首次启动的干净 profile 不生成配置或备份', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-clean-profile-'))
  try {
    migrateDesktopBridgeProfile(root)
    assert.equal(existsSync(join(root, 'package.json')), false)
    assert.equal(existsSync(join(root, 'cordis.patch.yml')), false)
    assert.equal(existsSync(join(root, '.desktop-bridge-backup')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('移除带引号和禁用配置的桥接项，保留其他插件', () => {
  const patch = '- insert: [{ id: "dsh-desktop-bridge", name: "dsh-desktop-bridge" }]\n- id: dsh-desktop-bridge\n  disabled: true\n- id: demo\n  config: { text: dsh-desktop-bridge }\n'
  assert.deepEqual(parse(removeDesktopBridgePatch(patch)), [{ id: 'demo', config: { text: 'dsh-desktop-bridge' } }])
})

test('未知损坏 YAML 不会留下半迁移的清单', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-invalid-patch-'))
  const manifest = '{"dsh":{"profile":{"bundles":["dsh-desktop-bridge"]}}}'
  const patch = '- insert: [ dsh-desktop-bridge\n'
  try {
    await writeFile(join(root, 'package.json'), manifest, 'utf8')
    await writeFile(join(root, 'cordis.patch.yml'), patch, 'utf8')
    assert.throws(() => migrateDesktopBridgeProfile(root), /无法迁移桌面桥接配置/)
    assert.equal(await readFile(join(root, 'package.json'), 'utf8'), manifest)
    assert.equal(await readFile(join(root, 'cordis.patch.yml'), 'utf8'), patch)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
