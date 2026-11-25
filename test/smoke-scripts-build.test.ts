import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { isDshAuthChallenge } from '../scripts/smoke-startup-errors.mjs'

test('构建产物包含所有平台冒烟脚本', () => {
  for (const script of ['smoke-macos-package.mjs', 'smoke-linux-package.mjs']) {
    const scriptPath = join('dist', 'scripts', script)
    assert.equal(existsSync(scriptPath), true, `缺少构建产物：${script}`)
    const source = readFileSync(scriptPath, 'utf8')
    assert.match(source, /await waitForProcessExit\(bootstrapProcessId, 10_000\)/)
    assert.match(source, /--user-data-dir=/)
    assert.match(source, /DSH_DESKTOP_SMOKE_READY_FILE/)
    assert.match(source, /pnpm_config_offline: 'true'/)
    assert.match(source, /verifyBundledPluginsInstalled\(dshHome\)/)
    assert.match(source, /startup-ready/)
    assert.match(source, /isDshAuthChallenge/)
    assert.match(source, /page\.status === 401/)
    assert.match(source, /stdout\.matchAll\(\/127\\\.0\\\.0\\\.1:/)
    assert.match(source, /response\.status === 200 \|\| \(response\.status === 401/)
  }
  assert.equal(existsSync(join('dist', 'scripts', 'smoke-packaged-plugins.mjs')), true)
})

test('冒烟鉴权页识别同时兼容旧版纯文本与新版 HTML 登录页', () => {
  assert.equal(isDshAuthChallenge('dsh web authentication required'), true)
  assert.equal(
    isDshAuthChallenge('<!doctype html><html><head><title>Connect to this Host</title></head><body><form id="token-form"></form></body></html>'),
    true,
  )
  assert.equal(isDshAuthChallenge('unauthorized'), false)
  assert.equal(isDshAuthChallenge('<html><title>Connect to this Host</title></html>'), false)
})
