import assert from 'node:assert/strict'
import test from 'node:test'

import { BUNDLED_PLUGINS, OFFICIAL_DSH_VERSION, OFFICIAL_LAUNCH_PEERS, OFFICIAL_RUNTIME, compareReleaseVersions, isDeepSeekOfficialPackage, isOfficialDshPackage, officialDshVersionOverrides, officialRuntimeDependencies, officialRuntimePnpmConfig, planOfficialRuntimeTarget, pnpmAllowBuildsManifest, pnpmWorkspaceYaml, SUITE_PACKAGE, bundledPluginNames, seededPackageNames } from '../src/bundled-plugins.js'

test('内置目录包含十个社区插件和市场组件', () => {
  assert.deepEqual(bundledPluginNames(), [
    '@michengai/dsh-codex-ui',
    '@michengai/dsh-im-connect',
    '@michengai/dsh-automation',
    '@michengai/dsh-skills-manager',
    '@michengai/dsh-archive-manager',
    '@michengai/dsh-agency-agents',
    'dsh-context',
    'dsh-better-sidebar',
    'dsh-mcp-connector',
    'dshmarket',
  ])
  assert.equal(BUNDLED_PLUGINS.length, 10)
  assert.equal(SUITE_PACKAGE, '@michengai/dsh-codex-suite')
})

test('所有 DeepSeek 官方作用域包使用同一套隔离判定', () => {
  assert.equal(isOfficialDshPackage('@deepseek-ai/dsh'), true)
  assert.equal(isOfficialDshPackage('@deepseek-ai/cordis-plugin-group'), false)
  assert.equal(isDeepSeekOfficialPackage('@deepseek-ai/cordis-plugin-group'), true)
  assert.equal(isDeepSeekOfficialPackage('@michengai/dsh-codex-ui'), false)
})

test('每个内置插件都钉死精确版本', () => {
  for (const plugin of BUNDLED_PLUGINS) {
    assert.match(plugin.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
    assert.equal(
      plugin.packageName.startsWith('@michengai/')
        || ['dsh-context', 'dsh-better-sidebar', 'dsh-mcp-connector', 'dshmarket'].includes(plugin.packageName),
      true,
    )
  }
  assert.equal(BUNDLED_PLUGINS.find(plugin => plugin.packageName === 'dshmarket')?.version, '1.38.1')
  assert.deepEqual(Object.fromEntries(BUNDLED_PLUGINS.map(plugin => [plugin.packageName, plugin.version])), {
    '@michengai/dsh-codex-ui': '0.2.94',
    '@michengai/dsh-im-connect': '0.1.27',
    '@michengai/dsh-automation': '0.1.22',
    '@michengai/dsh-skills-manager': '0.1.32',
    '@michengai/dsh-archive-manager': '0.1.21',
    '@michengai/dsh-agency-agents': '0.1.23',
    'dsh-context': '0.38.5',
    'dsh-better-sidebar': '0.18.0-alpha.0',
    'dsh-mcp-connector': '0.2.31',
    dshmarket: '1.38.1',
  })
})

test('官方 DSH 家族锁在同一个精确版本', () => {
  assert.equal(OFFICIAL_RUNTIME.packageName, '@deepseek-ai/dsh')
  assert.equal(OFFICIAL_RUNTIME.version, OFFICIAL_DSH_VERSION)
  assert.equal(OFFICIAL_DSH_VERSION, '0.1.2-alpha.2')
  assert.equal(seededPackageNames()[0], '@deepseek-ai/dsh')
  assert.equal(OFFICIAL_LAUNCH_PEERS[0]?.packageName, '@deepseek-ai/cordis-plugin-group')
  assert.equal(OFFICIAL_LAUNCH_PEERS[0]?.version, '1.0.2')
  assert.equal(officialRuntimeDependencies()['@deepseek-ai/dsh-invariants'], OFFICIAL_DSH_VERSION)
  assert.deepEqual(officialDshVersionOverrides(), {
    '@deepseek-ai/dsh': OFFICIAL_DSH_VERSION,
    '@deepseek-ai/dsh-*': OFFICIAL_DSH_VERSION,
  })
  assert.equal(officialRuntimePnpmConfig().overrides['@deepseek-ai/dsh-*'], OFFICIAL_DSH_VERSION)
})

test('官方版本比较和升级目标不会把已对齐的新版本降回去', () => {
  assert.equal(compareReleaseVersions('0.1.0-rc.8', '0.1.0-rc.7') > 0, true)
  assert.equal(compareReleaseVersions('1.0.0-beta.1', '1.0.0-alpha.9') > 0, true)
  assert.equal(compareReleaseVersions('1.0.0', '1.0.0-beta.9') > 0, true)
  assert.equal(planOfficialRuntimeTarget({
    installed: '0.1.0-rc.7',
    aligned: false,
    baked: '0.1.0-rc.8',
  }), '0.1.0-rc.8')
  assert.equal(planOfficialRuntimeTarget({
    installed: '0.1.0-rc.8',
    aligned: true,
    baked: '0.1.0-rc.8',
    published: '0.1.0-rc.9',
  }), '0.1.0-rc.9')
  assert.equal(planOfficialRuntimeTarget({
    installed: '0.1.0-rc.9',
    aligned: true,
    baked: '0.1.0-rc.8',
  }), undefined)
})

test('装配与补种会放行 DSH 所需的原生构建脚本', () => {
  const allow = pnpmAllowBuildsManifest()
  assert.equal(allow.allowBuilds['node-pty'], true)
  assert.equal(allow.allowBuilds['@deepseek-ai/dsh-subprocess-local'], true)
  assert.match(pnpmWorkspaceYaml(), /allowBuilds:/)
  assert.match(pnpmWorkspaceYaml(), /autoInstallPeers:\s*true/)
  assert.match(pnpmWorkspaceYaml(false), /autoInstallPeers:\s*false/)
})
