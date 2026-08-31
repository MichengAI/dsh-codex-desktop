import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

test('构建产物包含所有平台冒烟脚本', () => {
  for (const script of ['smoke-macos-package.mjs', 'smoke-linux-package.mjs']) {
    const scriptPath = join('dist', 'scripts', script)
    assert.equal(existsSync(scriptPath), true, `缺少构建产物：${script}`)
    const source = readFileSync(scriptPath, 'utf8')
    assert.match(source, /await waitForProcessExit\(bootstrapProcessId, 10_000\)/)
    assert.match(source, /--user-data-dir=/)
    assert.match(source, /DSH_DESKTOP_SMOKE_READY_FILE/)
    assert.match(source, /startup-ready/)
    assert.match(source, /dsh web authentication required/)
    assert.match(source, /page\.status === 401/)
    assert.match(source, /stdout\.matchAll\(\/127\\\.0\\\.0\\\.1:/)
    assert.match(source, /response\.status === 200 \|\| \(response\.status === 401/)
  }
})
