import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeProfileUpdates, officialRuntimeUpdateVersion, parsePendingUpdates, partitionPackageUpdates } from '../src/profile-updates.js'

test('待更新清单会保留官方包，但社区合并时忽略它们', () => {
  const updates = parsePendingUpdates(JSON.stringify({
    packages: [
      { packageName: '@michengai/dsh-codex-ui', version: '0.2.60' },
      { packageName: '@deepseek-ai/dsh', version: '0.1.0-rc.8' },
      { packageName: 'oops' },
    ],
  }))
  assert.deepEqual(updates, [
    { packageName: '@michengai/dsh-codex-ui', version: '0.2.60' },
    { packageName: '@deepseek-ai/dsh', version: '0.1.0-rc.8' },
  ])
  assert.deepEqual(partitionPackageUpdates(updates).official, [{ packageName: '@deepseek-ai/dsh', version: '0.1.0-rc.8' }])
  assert.equal(officialRuntimeUpdateVersion(updates), '0.1.0-rc.8')
  assert.deepEqual(partitionPackageUpdates([{ packageName: '@deepseek-ai/cordis-plugin-group', version: '1.0.2' }]).official.length, 1)
  assert.equal(officialRuntimeUpdateVersion([{ packageName: '@deepseek-ai/cordis-plugin-group', version: '1.0.2' }]), undefined)
})

test('已落地的版本不会重复安装', () => {
  const updates = mergeProfileUpdates({
    pending: [{ packageName: 'dshmarket', version: '1.14.1' }],
    declared: [
      { packageName: '@michengai/dsh-codex-ui', version: '0.2.60' },
      { packageName: 'dshmarket', version: '1.14.1' },
    ],
    installed: [
      { packageName: '@michengai/dsh-codex-ui', version: '0.2.58' },
      { packageName: 'dshmarket', version: '1.14.1' },
    ],
  })
  assert.deepEqual(updates, [{ packageName: '@michengai/dsh-codex-ui', version: '0.2.60' }])
})

test('待更新清单拒绝非法包名和非精确版本', () => {
  const updates = parsePendingUpdates(JSON.stringify({
    packages: [
      { packageName: 'safe-plugin', version: '1.2.3' },
      { packageName: '@scope/safe-plugin', version: '1.2.3-rc.1' },
      { packageName: 'bad plugin', version: '1.0.0' },
      { packageName: 'safe-plugin', version: 'latest' },
      { packageName: 'safe-plugin', version: 'file:..\\payload' },
    ],
  }))
  assert.deepEqual(updates, [
    { packageName: 'safe-plugin', version: '1.2.3' },
    { packageName: '@scope/safe-plugin', version: '1.2.3-rc.1' },
  ])
})
