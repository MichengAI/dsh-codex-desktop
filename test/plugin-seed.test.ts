import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

import { OFFICIAL_DSH_VERSION, OFFICIAL_LAUNCH_PEERS, OFFICIAL_RUNTIME, SUITE_PACKAGE, officialDshVersionOverrides } from '../src/bundled-plugins.js'
import { prepareBundledPluginStore, buildSeedRemoveArgs, applyPendingProfileUpdates, buildSeedPluginArgs, ensureAutoInstallPeersEnabled, isOfficialRuntimeLaunchable, missingOfficialLaunchPeers, officialRuntimeInstallArgs, planBundledPluginSeed, finalizeProfileBundlesAfterInstall, pruneMissingProfileBundles, resolvePnpmStoreDir, seedBundledPlugins, shouldUsePackagedStore, stripOfficialProfileDependencies, writeOfficialRuntimeManifest } from '../src/plugin-seed.js'

async function createBundledStore(store: string): Promise<void> {
  await mkdir(join(store, 'v11', 'files'), { recursive: true })
  await mkdir(join(store, 'cache'), { recursive: true })
  const db = new DatabaseSync(join(store, 'v11', 'index.db'))
  db.exec('CREATE TABLE package_index (key TEXT PRIMARY KEY, data BLOB NOT NULL) WITHOUT ROWID')
  db.prepare('INSERT INTO package_index VALUES (?, ?)').run('bundled', Buffer.from('bundled'))
  db.close()
}

const catalog = [
  { packageName: '@michengai/dsh-codex-ui', version: '0.2.58' },
  { packageName: '@michengai/dsh-im-connect', version: '0.1.10' },
] as const

test('已安装套件时拆成单独插件，便于各自更新', () => {
  const plan = planBundledPluginSeed({
    catalog,
    declaredPackages: [SUITE_PACKAGE],
    installedPackages: [SUITE_PACKAGE],
  })
  assert.deepEqual(plan, { action: 'replace-suite', packages: [...catalog] })
})

test('官方运行时不会写进 Web profile 补种计划', () => {
  const plan = planBundledPluginSeed({
    catalog: [OFFICIAL_RUNTIME, ...catalog],
    declaredPackages: [],
    installedPackages: [],
  })
  assert.deepEqual(plan, { action: 'add', packages: [...catalog] })
})

test('目录插件都已在 profile 中时跳过补种', () => {
  const plan = planBundledPluginSeed({
    catalog,
    declaredPackages: catalog.map(item => item.packageName),
    installedPackages: catalog.map(item => item.packageName),
  })
  assert.deepEqual(plan, { action: 'skip', reason: 'already-installed' })
})

test('安装计划不依赖离线仓库，允许在线安装配套依赖', () => {
  const plan = planBundledPluginSeed({
    catalog,
    declaredPackages: [],
    installedPackages: [],
  })
  assert.deepEqual(plan, { action: 'add', packages: [...catalog] })
})

test('只补种缺失插件，并走 profile 内的 pnpm add', () => {
  const plan = planBundledPluginSeed({
    catalog,
    declaredPackages: ['@michengai/dsh-codex-ui'],
    installedPackages: ['@michengai/dsh-codex-ui'],
  })
  assert.deepEqual(plan, {
    action: 'add',
    packages: [{ packageName: '@michengai/dsh-im-connect', version: '0.1.10' }],
  })
  const args = buildSeedPluginArgs(plan.packages, 'D:\\profile\\web', { storeDir: 'D:\\plugins\\store', offline: true })
  assert.deepEqual(args, [
    'add',
    '@michengai/dsh-im-connect@0.1.10',
    '--dir=D:\\profile\\web',
    '--store-dir=D:\\plugins\\store',
    `--cache-dir=${join('D:\\plugins\\store', 'cache')}`,
    '--offline',
    '--config.node-linker=hoisted',
    '--config.auto-install-peers=false',
    '--config.minimumReleaseAge=0',
    '--registry=https://registry.npmjs.org/',
  ])
})

test('node_modules 已有插件但未写入 dependencies 时仍要补进 dependencies', () => {
  const plan = planBundledPluginSeed({
    catalog,
    declaredPackages: [],
    installedPackages: ['@michengai/dsh-codex-ui', '@michengai/dsh-im-connect'],
  })
  assert.deepEqual(plan, { action: 'add', packages: [...catalog] })
})

test('桌面升级将已安装的旧内置插件提升到发布基线，保留更高版本', () => {
  const plan = planBundledPluginSeed({
    catalog,
    declaredPackages: catalog.map(item => item.packageName),
    installedPackages: catalog.map(item => item.packageName),
    installedVersions: [
      { packageName: catalog[0].packageName, version: '0.2.57' },
      { packageName: catalog[1].packageName, version: '0.1.11' },
    ],
  })
  assert.deepEqual(plan, { action: 'add', packages: [catalog[0]] })
})

test('安装声明存在但插件文件缺失时仍按发布基线修复', () => {
  const plan = planBundledPluginSeed({
    catalog,
    declaredPackages: catalog.map(item => item.packageName),
    installedPackages: [],
    installedVersions: [],
  })
  assert.deepEqual(plan, { action: 'add', packages: [...catalog] })
})

test('旧 profile 仅在 bundles 登记的内置插件不能被跳过后清理掉', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bundle-only-seed-'))
  try {
    const profile = join(root, 'profile')
    const store = join(root, 'store')
    await createBundledStore(store)
    await mkdir(profile)
    const manifest = { dependencies: {}, dsh: { profile: { bundles: catalog.map(plugin => plugin.packageName) } } }
    await writeFile(join(profile, 'package.json'), JSON.stringify(manifest), 'utf8')
    for (const plugin of catalog) {
      const dir = join(profile, 'node_modules', plugin.packageName)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name: plugin.packageName, version: plugin.version, dsh: { bundle: { patch: './cordis.patch.yml' } } }), 'utf8')
      await writeFile(join(dir, 'cordis.patch.yml'), '[]\n', 'utf8')
    }
    let installations = 0
    await seedBundledPlugins({
      nodeExecutable: 'node', profileDir: profile, pluginStoreDir: store, catalog,
      runner: async () => {
        installations++
        manifest.dependencies = Object.fromEntries(catalog.map(plugin => [plugin.packageName, plugin.version]))
        await writeFile(join(profile, 'package.json'), JSON.stringify(manifest), 'utf8')
      },
    })
    assert.equal(installations, 1, 'bundles 不能代替 dependencies 的安装声明')
    const result = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
    assert.deepEqual(result.dependencies, Object.fromEntries(catalog.map(plugin => [plugin.packageName, plugin.version])))
    assert.deepEqual(result.dsh.profile.bundles, catalog.map(plugin => plugin.packageName))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('seedBundledPlugins 只调用一次 pnpm add，且写入用户 profile', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-seed-'))
  try {
    const store = join(root, 'store')
    const profile = join(root, 'profile')
    await createBundledStore(store)
    await mkdir(profile)
    const calls: string[][] = []
    const result = await seedBundledPlugins({
      nodeExecutable: 'node',
      profileDir: profile,
      pluginStoreDir: store,
      catalog,
      runner: async args => { calls.push([...args]) },
    })
    assert.deepEqual(result.seeded, ['@michengai/dsh-codex-ui', '@michengai/dsh-im-connect'])
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.[0], 'add')
    assert.equal(calls[0]?.includes(`--dir=${profile}`), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('已有 node_modules 时不得改用安装包 store', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-store-check-'))
  try {
    assert.equal(shouldUsePackagedStore(root), true)
    await mkdir(join(root, 'node_modules'))
    assert.equal(shouldUsePackagedStore(root), false)
    const args = buildSeedPluginArgs(catalog, root, {})
    assert.equal(args.some(item => item.startsWith('--store-dir=')), false)
    assert.equal(args.includes('--offline'), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('后续 pnpm 操作沿用 node_modules 记录的 store 目录', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-store-state-'))
  try {
    await mkdir(join(root, 'node_modules'))
    await writeFile(join(root, 'node_modules', '.modules.yaml'), 'storeDir: D:\\persistent-store\n', 'utf8')
    assert.equal(resolvePnpmStoreDir(root, 'D:\\fallback-store'), 'D:\\persistent-store')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('替换旧套件时先安装子插件，安装失败不会先卸载套件', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-suite-rollback-'))
  try {
    const store = join(root, 'store')
    const profile = join(root, 'profile')
    await createBundledStore(store)
    await mkdir(profile)
    await writeFile(join(profile, 'package.json'), JSON.stringify({ dependencies: { [SUITE_PACKAGE]: '1.0.0' } }), 'utf8')
    const calls: string[][] = []
    await assert.rejects(seedBundledPlugins({
      nodeExecutable: 'node',
      profileDir: profile,
      pluginStoreDir: store,
      catalog,
      runner: async args => {
        calls.push([...args])
        if (args[0] === 'add') throw new Error('模拟安装失败')
      },
    }), /模拟安装失败/)
    assert.equal(calls[0]?.[0], 'add')
    assert.equal(calls.some(args => args[0] === 'remove'), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('官方运行时缺启动 peer 时判定为不可启动', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-peer-'))
  try {
    await mkdir(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    await writeFile(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), '', 'utf8')
    assert.equal(isOfficialRuntimeLaunchable(root), false)
    assert.equal(missingOfficialLaunchPeers(root)[0]?.packageName, '@deepseek-ai/cordis-plugin-group')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('官方运行时已装但缺少启动 peer 时会补齐', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-repair-'))
  try {
    const store = join(root, 'store')
    const profile = join(root, 'profile')
    const runtime = join(root, 'runtime')
    await createBundledStore(store)
    await mkdir(profile)
    await mkdir(join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    await writeFile(join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), '', 'utf8')
    await writeFile(join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), '{}', 'utf8')
    const calls: string[][] = []
    await seedBundledPlugins({
      nodeExecutable: 'node',
      profileDir: profile,
      desktopRuntimeDir: runtime,
      pluginStoreDir: store,
      catalog: [],
      runner: async args => {
        calls.push([...args])
        for (const arg of args) {
          const matched = /^(@[^@]+\/[^@]+)@/.exec(arg)
          if (matched === null) continue
          const packageDir = join(runtime, 'node_modules', ...matched[1].split('/'))
          await mkdir(packageDir, { recursive: true })
          await writeFile(join(packageDir, 'package.json'), '{}', 'utf8')
        }
      },
    })
    assert.equal(calls.some(item => item.some(arg => arg.includes('@deepseek-ai/cordis-plugin-group@1.0.2'))), true)
    assert.equal(isOfficialRuntimeLaunchable(runtime), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
test('会把已有 workspace 的 autoInstallPeers 打开', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-peers-yaml-'))
  try {
    await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:`n  - .`nautoInstallPeers: false`n", 'utf8')
    ensureAutoInstallPeersEnabled(root)
    assert.match(await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8'), /autoInstallPeers:\s*true/)
    await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n  - .\nautoInstallPeers: 'false'\n", 'utf8')
    ensureAutoInstallPeersEnabled(root)
    assert.doesNotMatch(await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8'), /['"]false['"]/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('会从 Web profile 依赖里清掉官方包', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-strip-'))
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: {
        '@deepseek-ai/dsh': '0.1.0-rc.7',
        '@michengai/dsh-codex-ui': '0.2.58',
      },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@michengai/dsh-codex-suite'] } },
    }), 'utf8')
    const removed = await stripOfficialProfileDependencies(root)
    assert.deepEqual(removed, ['@deepseek-ai/dsh'])
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { profile?: { bundles?: string[] } }
    }
    assert.equal(manifest.dependencies?.['@michengai/dsh-codex-ui'], '0.2.58')
    assert.equal(manifest.dependencies?.['@deepseek-ai/dsh'], undefined)
    assert.deepEqual(manifest.dsh?.profile?.bundles, ['@deepseek-ai/dsh-base'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('会清掉 Web profile 里的官方 node_modules，避免盖掉运行时', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-strip-modules-'))
  try {
    const official = join(root, 'node_modules', '@deepseek-ai', 'dsh-client-ui-primitives')
    await mkdir(official, { recursive: true })
    await writeFile(join(official, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh-client-ui-primitives' }), 'utf8')
    await writeFile(join(root, 'node_modules', '@deepseek-ai', '.keep'), 'keep', 'utf8')
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { '@michengai/dsh-codex-ui': '0.2.61' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
    }), 'utf8')
    const removed = await stripOfficialProfileDependencies(root)
    assert.equal(removed.includes('@deepseek-ai'), true)
    assert.equal(existsSync(official), false)
    assert.equal(existsSync(join(root, 'node_modules', '@deepseek-ai', '.keep')), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('启动前会按 pending 清单升级社区插件，不碰官方包', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pending-'))
  try {
    const profile = join(root, 'profile')
    await mkdir(profile)
    await writeFile(join(profile, 'package.json'), JSON.stringify({
      dependencies: { '@michengai/dsh-codex-ui': '0.2.60' },
    }), 'utf8')
    await writeFile(join(profile, '.dsh-pending-updates.json'), JSON.stringify({
      packages: [
        { packageName: '@michengai/dsh-codex-ui', version: '0.2.60' },
        { packageName: '@deepseek-ai/dsh', version: '0.1.0-rc.8' },
      ],
    }), 'utf8')
    const calls: string[][] = []
    const updated = await applyPendingProfileUpdates({
      nodeExecutable: 'node',
      profileDir: profile,
      pluginStoreDir: join(root, 'store'),
      catalog,
      runner: async args => { calls.push([...args]) },
    })
    assert.deepEqual(updated, ['@michengai/dsh-codex-ui'])
    assert.equal(calls[0]?.includes('@michengai/dsh-codex-ui@0.2.60'), true)
    assert.equal(calls[0]?.some(item => item.includes('@deepseek-ai/dsh')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('复制预装官方运行时成功后不再现场 pnpm add', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-prebuilt-seed-'))
  try {
    const store = join(root, 'store')
    const profile = join(root, 'profile')
    const runtime = join(root, 'runtime')
    const prebuilt = join(root, 'prebuilt')
    await createBundledStore(store)
    await mkdir(profile)
    await mkdir(join(prebuilt, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    await writeFile(join(prebuilt, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), '', 'utf8')
    await writeFile(join(prebuilt, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), JSON.stringify({ version: OFFICIAL_DSH_VERSION }), 'utf8')
    for (const plugin of OFFICIAL_LAUNCH_PEERS) {
      const packageDir = join(prebuilt, 'node_modules', ...plugin.packageName.split('/'))
      await mkdir(packageDir, { recursive: true })
      await writeFile(join(packageDir, 'package.json'), JSON.stringify({ version: plugin.version }), 'utf8')
    }
    for (const name of ['dsh-attachment-local', 'dsh-host-apiproxy']) {
      const packageDir = join(prebuilt, 'node_modules', '@deepseek-ai', name)
      await mkdir(packageDir, { recursive: true })
      await writeFile(join(packageDir, 'package.json'), JSON.stringify({ version: OFFICIAL_DSH_VERSION }), 'utf8')
    }
    writeOfficialRuntimeManifest(prebuilt, OFFICIAL_DSH_VERSION)
    const calls: string[][] = []
    const result = await seedBundledPlugins({
      nodeExecutable: 'node',
      profileDir: profile,
      desktopRuntimeDir: runtime,
      prebuiltRuntimeDir: prebuilt,
      pluginStoreDir: store,
      catalog: [],
      runner: async args => { calls.push([...args]) },
    })
    assert.deepEqual(result.seeded, [OFFICIAL_RUNTIME.packageName])
    assert.equal(calls.length, 0)
    assert.equal(existsSync(join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})


test('启动前会摘掉磁盘上已经不存在的社区 bundle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-prune-bundle-'))
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-file-upload'] } },
    }), 'utf8')
    const removed = await pruneMissingProfileBundles(root)
    assert.deepEqual(removed, ['dsh-file-upload'])
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { dsh?: { profile?: { bundles?: string[] } } }
    assert.deepEqual(manifest.dsh?.profile?.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('旧用户升级按配套版本安装，重复启动不重装且旧 pending 不降级', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-upgrade-baseline-'))
  try {
    const plugin = { packageName: '@michengai/dsh-automation', version: '0.1.38' }
    const profile = join(root, 'profile')
    const packageDir = join(profile, 'node_modules', plugin.packageName)
    await mkdir(packageDir, { recursive: true })
    const manifest = {
      dependencies: { [plugin.packageName]: '0.1.35' },
      dsh: { profile: { bundles: [plugin.packageName] } },
    }
    await writeFile(join(profile, 'package.json'), JSON.stringify(manifest), 'utf8')
    const patch = '# 用户自定义配置\n[]\n'
    await writeFile(join(profile, 'cordis.patch.yml'), patch, 'utf8')
    const installed = { name: plugin.packageName, version: '0.1.35', dsh: { bundle: { patch: './cordis.patch.yml' } } }
    await writeFile(join(packageDir, 'package.json'), JSON.stringify(installed), 'utf8')
    await writeFile(join(packageDir, 'cordis.patch.yml'), '[]\n', 'utf8')
    await writeFile(join(profile, '.dsh-pending-updates.json'), JSON.stringify({ packages: [{ ...plugin, version: '0.1.36' }] }), 'utf8')
    const calls: string[][] = []
    const options = {
      nodeExecutable: 'node', profileDir: profile, pluginStoreDir: join(root, 'store'), catalog: [plugin],
      runner: async (args: readonly string[]) => {
        calls.push([...args])
        assert.ok(args.includes(`${plugin.packageName}@0.1.38`))
        assert.ok(args.includes('--offline'), '已有用户升级必须使用随包资源离线安装')
        manifest.dependencies[plugin.packageName] = plugin.version
        installed.version = plugin.version
        await writeFile(join(profile, 'package.json'), JSON.stringify(manifest), 'utf8')
        await writeFile(join(packageDir, 'package.json'), JSON.stringify(installed), 'utf8')
      },
    }
    await createBundledStore(options.pluginStoreDir)
    await writeFile(join(profile, 'node_modules', '.modules.yaml'), JSON.stringify({ storeDir: join(options.pluginStoreDir, 'v11') }))
    assert.deepEqual((await seedBundledPlugins(options)).seeded, [plugin.packageName])
    assert.deepEqual(await applyPendingProfileUpdates(options), [])
    assert.deepEqual((await seedBundledPlugins(options)).seeded, [])
    assert.equal(calls.length, 1)
    assert.equal(await readFile(join(profile, 'cordis.patch.yml'), 'utf8'), patch)
    assert.deepEqual(JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')).dsh, manifest.dsh)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('pnpm 11 的 JSON 格式 modules 状态仍沿用原有 store', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-store-json-'))
  try {
    await mkdir(join(root, 'node_modules'))
    const storeDir = 'C:\\Users\\example\\AppData\\Local\\pnpm\\store\\v11'
    await writeFile(join(root, 'node_modules', '.modules.yaml'), JSON.stringify({ storeDir, packageManager: 'pnpm@11.24.0' }), 'utf8')
    assert.equal(resolvePnpmStoreDir(root, 'D:\\bundled-store'), storeDir)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('旧 profile 优先使用随包资源，失败时联网兜底仍沿用原 store', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-seed-store-retry-'))
  try {
    const profile = join(root, 'profile')
    const originalStore = join(root, 'original-store', 'v11')
    const bundledStore = join(root, 'bundled-store')
    await mkdir(join(profile, 'node_modules'), { recursive: true })
    await createBundledStore(bundledStore)
    await writeFile(join(bundledStore, 'v11', 'files', 'packaged-content'), '随包依赖', 'utf8')
    await mkdir(originalStore, { recursive: true })
    await writeFile(join(originalStore, 'user-content'), '用户已有依赖', 'utf8')
    const db = new DatabaseSync(join(originalStore, 'index.db'))
    db.exec('CREATE TABLE package_index (key TEXT PRIMARY KEY, data BLOB NOT NULL) WITHOUT ROWID')
    db.prepare('INSERT INTO package_index VALUES (?, ?)').run('user', Buffer.from('user'))
    db.close()
    await writeFile(join(profile, 'node_modules', '.modules.yaml'), JSON.stringify({ storeDir: originalStore }), 'utf8')
    let attempts = 0
    await seedBundledPlugins({
      nodeExecutable: 'node', profileDir: profile, pluginStoreDir: bundledStore, catalog,
      runner: async args => {
        attempts++
        assert.ok(args.includes(`--store-dir=${originalStore}`))
        assert.equal(await readFile(join(originalStore, 'files', 'packaged-content'), 'utf8'), '随包依赖')
        assert.equal(await readFile(join(originalStore, 'user-content'), 'utf8'), '用户已有依赖')
        if (attempts === 1) {
          assert.ok(args.includes('--offline'))
          assert.ok(args.includes(`--cache-dir=${join(bundledStore, 'cache')}`))
          throw new Error('ERR_PNPM_NO_OFFLINE_META')
        }
        assert.ok(!args.includes('--offline'))
      },
    })
    assert.equal(attempts, 2)
    const merged = new DatabaseSync(join(originalStore, 'index.db'), { readOnly: true })
    assert.deepEqual(merged.prepare('SELECT key FROM package_index ORDER BY key').all().map(row => row.key), ['bundled', 'user'])
    merged.close()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('随包仓库缺失或缺少版本元数据时退回默认仓库在线安装', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-incomplete-store-'))
  try {
    let calls = 0
    const options = {
      nodeExecutable: 'node', profileDir: join(root, 'profile'), pluginStoreDir: join(root, 'store'), catalog,
      runner: async (args: readonly string[]) => { calls++; assert.ok(!args.includes('--offline')); assert.ok(!args.some(arg => arg.startsWith('--store-dir='))) },
    }
    await seedBundledPlugins(options)
    await mkdir(join(options.pluginStoreDir, 'v11'), { recursive: true })
    await seedBundledPlugins(options)
    assert.equal(calls, 2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('启动前会隔离包名与目录不一致的第三方 bundle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-invalid-package-name-'))
  try {
    const packageDir = join(root, 'node_modules', 'broken-plugin')
    await mkdir(packageDir, { recursive: true })
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({
      name: 'other-plugin',
      dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }), 'utf8')
    await writeFile(join(packageDir, 'cordis.patch.yml'), '[]\n', 'utf8')
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { 'broken-plugin': '1.0.0' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'broken-plugin'] } },
    }), 'utf8')
    assert.deepEqual(await pruneMissingProfileBundles(root), ['broken-plugin'])
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; dsh?: { profile?: { bundles?: string[] } } }
    assert.equal(manifest.dependencies?.['broken-plugin'], undefined)
    assert.deepEqual(manifest.dsh?.profile?.bundles, ['@deepseek-ai/dsh-base'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('启动前会隔离缺少 patch 文件的第三方 bundle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-missing-bundle-patch-'))
  try {
    const packageDir = join(root, 'node_modules', 'broken-plugin')
    await mkdir(packageDir, { recursive: true })
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({
      name: 'broken-plugin',
      dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }), 'utf8')
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { 'broken-plugin': '1.0.0' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'broken-plugin'] } },
    }), 'utf8')
    assert.deepEqual(await pruneMissingProfileBundles(root), ['broken-plugin'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('桌面内部 bridge bundle 不依赖 profile dependencies 仍会保留', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-keep-desktop-bridge-'))
  try {
    await mkdir(join(root, 'node_modules', 'dsh-desktop-bridge'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'dsh-desktop-bridge', 'package.json'), JSON.stringify({
      name: 'dsh-desktop-bridge',
      dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }), 'utf8')
    await writeFile(join(root, 'node_modules', 'dsh-desktop-bridge', 'cordis.patch.yml'), '[]\n', 'utf8')
    await writeFile(join(root, 'package.json'), JSON.stringify({ dsh: { profile: { bundles: ['dsh-desktop-bridge'] } } }), 'utf8')
    assert.deepEqual(await pruneMissingProfileBundles(root), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})


test('先认磁盘上的包，再更新 bundle 列表', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-finalize-bundle-'))
  try {
    await mkdir(join(root, 'node_modules', 'ready-plugin'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'ready-plugin', 'package.json'), JSON.stringify({
      name: 'ready-plugin',
      dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }), 'utf8')
    await writeFile(join(root, 'node_modules', 'ready-plugin', 'cordis.patch.yml'), '[]\n', 'utf8')
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { 'ready-plugin': '1.0.0' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'dsh-file-upload'] } },
    }), 'utf8')
    const result = await finalizeProfileBundlesAfterInstall(root)
    assert.deepEqual(result.removed, ['dsh-file-upload'])
    assert.equal(result.bundles.includes('ready-plugin'), true)
    assert.equal(result.bundles.includes('dsh-file-upload'), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('插件市场禁用 bundle 插件后，启动补种不得把它重新加入清单', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-disabled-bundle-'))
  try {
    await mkdir(join(root, 'node_modules', 'ready-plugin'), { recursive: true })
    await mkdir(join(root, '.dsh-market'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'ready-plugin', 'package.json'), JSON.stringify({
      name: 'ready-plugin',
      dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }), 'utf8')
    await writeFile(join(root, 'node_modules', 'ready-plugin', 'cordis.patch.yml'), '[]\n', 'utf8')
    await writeFile(join(root, '.dsh-market', 'state.json'), JSON.stringify({
      disabled: ['ready-plugin'], groups: {}, groupOrder: [],
    }), 'utf8')
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { 'ready-plugin': '1.0.0' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
    }), 'utf8')
    const result = await finalizeProfileBundlesAfterInstall(root)
    assert.equal(result.bundles.includes('ready-plugin'), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('启动补种 pnpm 超时后会终止并返回明确错误', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-seed-timeout-'))
  try {
    const store = join(root, 'store')
    const profile = join(root, 'profile')
    const pnpmEntry = join(root, 'hanging-pnpm.cjs')
    await createBundledStore(store)
    await mkdir(profile)
    await writeFile(pnpmEntry, 'setInterval(() => undefined, 1000)\n', 'utf8')
    await assert.rejects(seedBundledPlugins({
      nodeExecutable: process.execPath,
      profileDir: profile,
      pluginStoreDir: store,
      catalog: [catalog[0]],
      pnpmEntry,
      timeoutMs: 30,
    }), /pnpm.*超时/i)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})


test('官方 pending 会改运行时目录，不写进 Web profile', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-official-pending-'))
  try {
    const profile = join(root, 'profile')
    const runtime = join(root, 'runtime')
    await mkdir(profile)
    await mkdir(join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    await writeFile(join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), '', 'utf8')
    await writeFile(join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), JSON.stringify({ version: '0.1.0-rc.7' }), 'utf8')
    for (const plugin of OFFICIAL_LAUNCH_PEERS) {
      const packageDir = join(runtime, 'node_modules', ...plugin.packageName.split('/'))
      await mkdir(packageDir, { recursive: true })
      await writeFile(join(packageDir, 'package.json'), JSON.stringify({ version: plugin.version }), 'utf8')
    }
    await writeFile(join(profile, 'package.json'), JSON.stringify({ dependencies: {} }), 'utf8')
    await writeFile(join(profile, '.dsh-pending-updates.json'), JSON.stringify({
      packages: [{ packageName: '@deepseek-ai/dsh', version: OFFICIAL_DSH_VERSION }],
    }), 'utf8')
    const calls: string[][] = []
    const updated = await applyPendingProfileUpdates({
      nodeExecutable: 'node',
      profileDir: profile,
      desktopRuntimeDir: runtime,
      pluginStoreDir: join(root, 'store'),
      runner: async args => { calls.push([...args]) },
    })
    assert.deepEqual(updated, [OFFICIAL_DSH_VERSION])
    assert.equal(calls[0]?.[0], 'install')
    assert.equal(calls[0]?.includes('--dir=' + runtime), true)
    const manifest = JSON.parse(await readFile(join(runtime, 'package.json'), 'utf8')) as { pnpm?: { overrides?: Record<string, string> } }
    assert.deepEqual(manifest.pnpm?.overrides, officialDshVersionOverrides())
    const profileManifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> }
    assert.equal(profileManifest.dependencies?.['@deepseek-ai/dsh'], undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('官方运行时更新会同步锁文件，避免 CI 冻结锁文件阻断启动', () => {
  const args = officialRuntimeInstallArgs('D:\\runtime')
  assert.equal(args.includes('--no-frozen-lockfile'), true)
})

test('旧 Profile 缺少或无法解析仓库位置时在线兜底不指定 store', async () => {
  for (const state of [undefined, '{}', 'invalid: [']) {
    const root = await mkdtemp(join(tmpdir(), 'dsh-unknown-store-'))
    try {
      const profile = join(root, 'profile')
      const store = join(root, 'store')
      await createBundledStore(store)
      await mkdir(join(profile, 'node_modules'), { recursive: true })
      if (state !== undefined) await writeFile(join(profile, 'node_modules', '.modules.yaml'), state, 'utf8')
      const calls: string[][] = []
      await seedBundledPlugins({nodeExecutable:'node',profileDir:profile,pluginStoreDir:store,catalog,
        runner:async args=>{calls.push([...args])}})
      assert.equal(calls.length,1)
      assert.ok(!calls[0]!.includes('--offline'))
      assert.ok(!calls[0]!.some(arg=>arg.startsWith('--store-dir=')||arg.startsWith('--cache-dir=')))
    } finally { await rm(root,{recursive:true,force:true}) }
  }
})

test('在线拆分套件不使用随包缓存', () => {
  assert.ok(!buildSeedRemoveArgs(['fixture'],'profile',{storeDir:'store',cacheDir:'cache',offline:false}).some(arg=>arg.startsWith('--cache-dir=')))
})

test('重复导入不覆盖已有文件，未知数据库结构在复制前拒绝', async () => {
  const root=await mkdtemp(join(tmpdir(),'dsh-safe-store-'))
  try {
    const profile=join(root,'profile'), source=join(root,'source'), target=join(root,'target','v11')
    await createBundledStore(source)
    await mkdir(join(profile,'node_modules'),{recursive:true})
    await mkdir(join(target,'files'),{recursive:true})
    await writeFile(join(profile,'node_modules','.modules.yaml'),JSON.stringify({storeDir:target}))
    await writeFile(join(source,'v11','files','existing'),'replacement')
    await writeFile(join(target,'files','existing'),'keep')
    await prepareBundledPluginStore(profile,source)
    assert.equal(await readFile(join(target,'files','existing'),'utf8'),'keep')
    const db=new DatabaseSync(join(target,'index.db'))
    db.exec('ALTER TABLE package_index ADD COLUMN unknown TEXT')
    db.close()
    await writeFile(join(source,'v11','files','new'),'new')
    await assert.rejects(prepareBundledPluginStore(profile,source),/结构/)
    assert.equal(existsSync(join(target,'files','new')),false)
  } finally { await rm(root,{recursive:true,force:true}) }
})

test('索引被锁时复制前失败，原数据库和文件保留', async () => {
  const root=await mkdtemp(join(tmpdir(),'dsh-locked-index-'))
  let lock: DatabaseSync | undefined
  try {
    const profile=join(root,'profile'), source=join(root,'source'), target=join(root,'target')
    await createBundledStore(source)
    await createBundledStore(target)
    await mkdir(join(profile,'node_modules'),{recursive:true})
    await writeFile(join(profile,'node_modules','.modules.yaml'),JSON.stringify({storeDir:join(target,'v11')}))
    await writeFile(join(source,'v11','files','new'),'new')
    lock=new DatabaseSync(join(target,'v11','index.db'))
    lock.exec('BEGIN IMMEDIATE')
    await assert.rejects(prepareBundledPluginStore(profile,source),/locked/)
    assert.equal(existsSync(join(target,'v11','files','new')),false)
    lock.exec('ROLLBACK')
    assert.equal(lock.prepare('SELECT count(*) as total FROM package_index').get()?.total,1)
  } finally { lock?.close(); await rm(root,{recursive:true,force:true}) }
})

test('复制失败不提交新索引，也不改写已有依赖文件', async () => {
  const root=await mkdtemp(join(tmpdir(),'dsh-copy-failure-'))
  try {
    const profile=join(root,'profile'), source=join(root,'source'), target=join(root,'target')
    await createBundledStore(source)
    await createBundledStore(target)
    await mkdir(join(profile,'node_modules'),{recursive:true})
    await writeFile(join(profile,'node_modules','.modules.yaml'),JSON.stringify({storeDir:join(target,'v11')}))
    const db=new DatabaseSync(join(source,'v11','index.db'))
    db.prepare('INSERT INTO package_index VALUES (?,?)').run('new',Buffer.from('new'))
    db.close()
    await writeFile(join(source,'v11','files','blocked'),'new')
    await mkdir(join(target,'v11','files','blocked'))
    await assert.rejects(prepareBundledPluginStore(profile,source),/不是普通文件/)
    const check=new DatabaseSync(join(target,'v11','index.db'),{readOnly:true})
    assert.equal(check.prepare('SELECT count(*) as total FROM package_index WHERE key=?').get('new')?.total,0)
    check.close()
  } finally { await rm(root,{recursive:true,force:true}) }
})

test('首次安装的随包仓库失败后在线重试不复用随包 store', async () => {
  const root=await mkdtemp(join(tmpdir(),'dsh-readonly-bundle-'))
  try {
    const store=join(root,'store')
    await createBundledStore(store)
    let calls=0
    await seedBundledPlugins({nodeExecutable:'node',profileDir:join(root,'profile'),pluginStoreDir:store,catalog,
      runner:async args=>{
        calls++
        if(calls===1){assert.ok(args.includes('--offline'));throw new Error('EACCES')}
        assert.ok(!args.some(arg=>arg==='--offline'||arg.startsWith('--store-dir=')||arg.startsWith('--cache-dir=')))
      }})
    assert.equal(calls,2)
  } finally {await rm(root,{recursive:true,force:true})}
})
