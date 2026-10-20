import assert from 'node:assert/strict'
import test from 'node:test'

import { isDshMarketOperationBusy } from '../src/dshmarket-batch.js'

test('只将 dshmarket 明确报告的忙碌状态视为批量更新进行中', () => {
  assert.equal(isDshMarketOperationBusy({ busy: true }), true)
  assert.equal(isDshMarketOperationBusy({ busy: false }), false)
  assert.equal(isDshMarketOperationBusy({ active: true }), false)
  assert.equal(isDshMarketOperationBusy(null), false)
})
