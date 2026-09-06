import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { parse } from 'yaml'

import { migrateDesktopBridgeProfile, removeDesktopBridgePatch } from '../src/desktop-bridge-migration.js'

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
