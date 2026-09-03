import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { parseUnresolvedBundleError, removeProfileBundle, repairBrokenProfile, startWithProfileSelfRepair } from '../src/profile-repair.js'

test('能从 DSH 缺 bundle 报错里取出包名', () => {
  const message = 'dsh: cannot resolve profile bundle "dsh-file-upload" from the dsh installation or C:\\Users\\demo\\.dsh\\profiles\\web'
  assert.equal(parseUnresolvedBundleError(message), 'dsh-file-upload')
})

test('自我修复会摘掉清单有、磁盘没有的社区插件', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-repair-'))
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { 'dsh-file-upload': '1.0.0' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'dsh-file-upload'] } },
    }), 'utf8')
    const removed = await repairBrokenProfile(root)
    assert.deepEqual(removed, ['dsh-file-upload'])
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { dsh?: { profile?: { bundles?: string[] } } }
    assert.deepEqual(manifest.dsh?.profile?.bundles, ['@deepseek-ai/dsh-base'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('自我修复会摘掉未登记依赖的残留 bundle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-repair-orphan-'))
  try {
    await mkdir(join(root, 'node_modules', 'dsh-file-upload'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'dsh-file-upload', 'package.json'), JSON.stringify({
      name: 'dsh-file-upload',
      dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }), 'utf8')
    await writeFile(join(root, 'node_modules', 'dsh-file-upload', 'cordis.patch.yml'), '[]\n', 'utf8')
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'dsh-file-upload'] } },
      dependencies: {},
    }), 'utf8')
    const removed = await repairBrokenProfile(root)
    assert.deepEqual(removed, ['dsh-file-upload'])
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { dsh?: { profile?: { bundles?: string[] } } }
    assert.deepEqual(manifest.dsh?.profile?.bundles, ['@deepseek-ai/dsh-base'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('安装中断留下损坏 package.json 时，自我修复会摘掉该第三方 bundle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-repair-corrupt-package-'))
  try {
    await mkdir(join(root, 'node_modules', 'dsh-file-upload'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'dsh-file-upload', 'package.json'), '{"name":', 'utf8')
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { 'dsh-file-upload': '1.0.0' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'dsh-file-upload'] } },
    }), 'utf8')
    const removed = await repairBrokenProfile(root)
    assert.deepEqual(removed, ['dsh-file-upload'])
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; dsh?: { profile?: { bundles?: string[] } } }
    assert.equal(manifest.dependencies?.['dsh-file-upload'], undefined)
    assert.deepEqual(manifest.dsh?.profile?.bundles, ['@deepseek-ai/dsh-base'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('启动因缺 bundle 失败时会摘掉坏项并重试', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-repair-retry-'))
  try {
    await mkdir(join(root, 'node_modules', 'dsh-file-upload'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'dsh-file-upload', 'package.json'), JSON.stringify({
      name: 'dsh-file-upload',
      dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }), 'utf8')
    await writeFile(join(root, 'node_modules', 'dsh-file-upload', 'cordis.patch.yml'), '[]\n', 'utf8')
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'dsh-file-upload'] } },
      dependencies: { 'dsh-file-upload': '1.0.0' },
    }), 'utf8')
    let attempts = 0
    const started = await startWithProfileSelfRepair({
      profileDir: root,
      start: async () => {
        attempts += 1
        const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { dsh?: { profile?: { bundles?: string[] } } }
        if ((manifest.dsh?.profile?.bundles ?? []).includes('dsh-file-upload')) {
          throw new Error('dsh: cannot resolve profile bundle "dsh-file-upload" from the dsh installation or ' + root)
        }
        return 'ok'
      },
    })
    assert.equal(started.result, 'ok')
    assert.equal(attempts, 2)
    assert.equal(started.repaired.includes('dsh-file-upload'), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('官方 Web bundle 缺失时在启动前报告安装损坏，不等待启动超时', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-repair-official-bundle-'))
  const profile = join(root, 'profile')
  const runtime = join(root, 'runtime')
  try {
    await mkdir(profile, { recursive: true })
    await writeFile(join(profile, 'package.json'), JSON.stringify({
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } },
    }), 'utf8')
    const dshPackage = join(runtime, 'node_modules', '@deepseek-ai', 'dsh')
    const basePackage = join(dshPackage, 'node_modules', '@deepseek-ai', 'dsh-base')
    await mkdir(basePackage, { recursive: true })
    await writeFile(join(dshPackage, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh' }), 'utf8')
    await writeFile(join(basePackage, 'package.json'), JSON.stringify({
      name: '@deepseek-ai/dsh-base',
      dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }), 'utf8')
    await writeFile(join(basePackage, 'cordis.patch.yml'), '[]\n', 'utf8')
    let attempts = 0
    await assert.rejects(startWithProfileSelfRepair({
      profileDir: profile,
      extraDirs: [runtime],
      start: async () => { attempts += 1; return 'unexpected' },
    }), /官方运行时安装不完整：缺少内置 bundle @deepseek-ai\/dsh-web-app/)
    assert.equal(attempts, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
