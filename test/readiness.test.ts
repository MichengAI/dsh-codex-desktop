import assert from 'node:assert/strict'
import test from 'node:test'

import { parseReadyUrl } from '../src/readiness.js'
import { resolveNodeExecutable } from '../src/runtime.js'

test('解析 DSH 输出的本机就绪地址', () => {
  assert.equal(parseReadyUrl('dsh web: http://127.0.0.1:10406\n'), 'http://127.0.0.1:10406/')
  assert.equal(
    parseReadyUrl('dsh web: http://127.0.0.1:10406/?token=desktop-secret\n'),
    'http://127.0.0.1:10406/?token=desktop-secret',
  )
  assert.equal(parseReadyUrl('dsh web: http://127.0.0.1:10406/'), undefined)
})

test('拒绝非本机或不安全的就绪地址', () => {
  assert.equal(parseReadyUrl('dsh web: https://127.0.0.1:10406\n'), undefined)
  assert.equal(parseReadyUrl('dsh web: http://localhost:10406\n'), undefined)
  assert.equal(parseReadyUrl('dsh web: http://127.0.0.1:0\n'), undefined)
  assert.equal(parseReadyUrl('dsh web: javascript:alert(1)\n'), undefined)
  assert.equal(parseReadyUrl('dsh web: data:text/html,unsafe\n'), undefined)
})

test('开发态使用 PATH 中的 Node', () => {
  const original = process.env.DSH_NODE_EXECUTABLE
  delete process.env.DSH_NODE_EXECUTABLE
  try {
    assert.equal(resolveNodeExecutable({ isPackaged: false, resourcesPath: 'C:\\unused' }), process.platform === 'win32' ? 'node.exe' : 'node')
  } finally {
    if (original === undefined) delete process.env.DSH_NODE_EXECUTABLE
    else process.env.DSH_NODE_EXECUTABLE = original
  }
})

test('打包态缺少随包 Node 时失败', () => {
  assert.throws(
    () => resolveNodeExecutable({ isPackaged: true, resourcesPath: 'C:\\missing-runtime' }),
    /未找到随包 Node/,
  )
})
