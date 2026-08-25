import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'

import { adhocSignMacApplication, resolveMacApplicationPath, shouldAdhocSignMacApplication } from '../scripts/adhoc-sign.mjs'

const context = {
  appOutDir: '/tmp/release/mac-arm64',
  packager: { appInfo: { productFilename: 'DSH Codex Desktop' } },
}

test('只在 macOS 显式 ad-hoc 模式下签名', () => {
  assert.equal(shouldAdhocSignMacApplication('darwin', 'true'), true)
  assert.equal(shouldAdhocSignMacApplication('darwin', undefined), false)
  assert.equal(shouldAdhocSignMacApplication('win32', 'true'), false)
})

test('afterPack 对完整应用执行用户验证过的 ad-hoc 签名命令', async () => {
  const calls: Array<{ file: string; arguments_: string[] }> = []
  await adhocSignMacApplication(context, async (file, arguments_) => {
    calls.push({ file, arguments_ })
  }, 'darwin', 'true')
  const applicationPath = resolveMacApplicationPath(context)
  assert.equal(applicationPath, join(context.appOutDir, 'DSH Codex Desktop.app'))
  assert.deepEqual(calls, [{
    file: '/usr/bin/codesign',
    arguments_: ['--force', '--deep', '--sign', '-', applicationPath],
  }])
})
