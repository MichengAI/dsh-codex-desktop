import assert from 'node:assert/strict'
import test from 'node:test'

import { waitForPluginReloadReady } from '../src/profile-reload.js'

test('单轮超时后继续等待，确认静默后才允许重载', async () => {
  const results = [false, false, true]
  let warnings = 0
  let checks = 0
  const ready = await waitForPluginReloadReady({
    waitUntilQuiet: async () => { checks += 1; return results.shift() ?? false },
    shouldStop: () => false,
    onTimeout: () => { warnings += 1 },
  })
  assert.equal(ready, true)
  assert.equal(checks, 3)
  assert.equal(warnings, 2)
})

test('退出或被其他重载接管时取消等待，不放行重载', async () => {
  let stop = false
  let checks = 0
  const ready = await waitForPluginReloadReady({
    waitUntilQuiet: async () => { checks += 1; stop = true; return false },
    shouldStop: () => stop,
    onTimeout: () => assert.fail('已取消的等待不应继续告警'),
  })
  assert.equal(ready, false)
  assert.equal(checks, 1)
})

test('静默检查期间收到退出请求时不执行后续重载', async () => {
  let stop = false
  let reloads = 0
  const ready = await waitForPluginReloadReady({
    waitUntilQuiet: async () => { stop = true; return true },
    shouldStop: () => stop,
    onTimeout: () => assert.fail('静默结果不应告警'),
  })
  if (ready) reloads += 1
  assert.equal(reloads, 0)
})

test('检查失败保留原始错误，不伪装为安装完成', async () => {
  const error = new Error('状态读取失败')
  await assert.rejects(waitForPluginReloadReady({
    waitUntilQuiet: async () => { throw error },
    shouldStop: () => false,
    onTimeout: () => undefined,
  }), error)
})
