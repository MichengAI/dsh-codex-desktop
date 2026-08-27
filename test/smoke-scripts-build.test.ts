import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

test('构建产物包含所有平台冒烟脚本', () => {
  for (const script of ['smoke-macos-package.mjs', 'smoke-linux-package.mjs']) {
    const scriptPath = join('dist', 'scripts', script)
    assert.equal(existsSync(scriptPath), true, `缺少构建产物：${script}`)
    assert.match(readFileSync(scriptPath, 'utf8'), /await waitForProcessExit\(bootstrapProcessId, 10_000\)/)
  }
})
