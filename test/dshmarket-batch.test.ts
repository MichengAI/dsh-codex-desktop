import assert from 'node:assert/strict'
import test from 'node:test'

import { isDshMarketOperationBusy, waitForDshMarketBatchToSettle } from '../src/dshmarket-batch.js'

test('只将 dshmarket 明确报告的忙碌状态视为批量更新进行中', () => {
  assert.equal(isDshMarketOperationBusy({ busy: true }), true)
  assert.equal(isDshMarketOperationBusy({ busy: false }), false)
  assert.equal(isDshMarketOperationBusy({ active: true }), false)
  assert.equal(isDshMarketOperationBusy(null), false)
})

test('批量更新结束且跨过一个安静窗口后才允许桌面端继续重启', async () => {
  const statuses = [{ busy: true }, { busy: true }, { busy: false }, { busy: false }]
  let pauses = 0
  await waitForDshMarketBatchToSettle(
    async () => statuses.shift(),
    async () => { pauses += 1 },
    { maxWaitMs: 3_000, pollIntervalMs: 1_000 },
  )
  assert.equal(pauses, 3)
})

test('批量项之间短暂释放忙碌状态不会触发提前重启', async () => {
  const statuses = [{ busy: true }, { busy: false }, { busy: true }, { busy: true }, { busy: false }, { busy: false }]
  let pauses = 0
  await waitForDshMarketBatchToSettle(
    async () => statuses.shift(),
    async () => { pauses += 1 },
    { maxWaitMs: 4_000, pollIntervalMs: 1_000 },
  )
  assert.equal(pauses, 4)
})

test('市场持续忙碌时在等待上限后返回超时而非无限轮询', async () => {
  let pauses = 0
  const settled = await waitForDshMarketBatchToSettle(
    async () => ({ busy: true }),
    async () => { pauses += 1 },
    { maxWaitMs: 2_000, pollIntervalMs: 1_000 },
  )
  assert.equal(settled, false)
  assert.equal(pauses, 2)
})
