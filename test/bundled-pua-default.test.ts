import assert from 'node:assert/strict'
import test from 'node:test'
import { initializePuaDefault } from '../src/desktop-bridge.mjs'

test('首次配置 PUA 时通过设置服务关闭全局开关并携带修订号', async () => {
  const writes: unknown[][] = []
  await initializePuaDefault({
    describe: () => [{ ns: 'michengai-pua', revision: 3, user: { flavor: 'auto' } }],
    update: async (...args) => { writes.push(args) },
  })
  assert.deepEqual(writes, [['michengai-pua', { alwaysOn: false }, 3]])
})

test('保留用户已保存的 PUA 开关，不修改未加载的 PUA', async () => {
  for (const user of [{ alwaysOn: true }, { alwaysOn: false }]) {
    await initializePuaDefault({
      describe: () => [{ ns: 'michengai-pua', revision: 1, user }],
      update: async () => { assert.fail('不应覆盖用户选择') },
    })
  }
  await initializePuaDefault({ describe: () => [], update: async () => { assert.fail('未加载时不写入') } })
})

test('设置冲突或持久化失败向上传递，不绕过设置服务改写用户文件', async () => {
  await assert.rejects(initializePuaDefault({
    describe: () => [{ ns: 'michengai-pua', revision: 2 }],
    update: async () => { throw new Error('conflict') },
  }), /conflict/)
})
