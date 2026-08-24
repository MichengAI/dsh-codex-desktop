import assert from 'node:assert/strict'
import test from 'node:test'

import { WindowNavigationCoordinator } from '../src/window-navigation.js'

function deferred(): {
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
} {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

test('后续导航会吞掉已被取代导航的 ERR_ABORTED', async () => {
  const coordinator = new WindowNavigationCoordinator()
  let stops = 0
  const target = { webContents: { stop: () => { stops += 1 } } }
  const firstLoad = deferred()
  const secondLoad = deferred()

  const first = coordinator.navigate(target, () => firstLoad.promise)
  assert.equal(coordinator.isNavigating(), true)
  const second = coordinator.navigate(target, () => secondLoad.promise)
  firstLoad.reject(new Error("ERR_ABORTED (-3) loading 'file:///startup.html'"))
  secondLoad.resolve()

  assert.equal(await first, false)
  assert.equal(await second, true)
  assert.equal(coordinator.isNavigating(), false)
  assert.equal(stops, 2)
})

test('已被取代导航不会继续执行页面初始化', async () => {
  const coordinator = new WindowNavigationCoordinator()
  const target = { webContents: { stop: () => undefined } }
  const firstLoad = deferred()
  let initialized = false

  const first = coordinator.navigate(target, () => firstLoad.promise, async () => { initialized = true })
  const second = coordinator.navigate(target, async () => undefined)
  firstLoad.resolve()

  assert.equal(await first, false)
  assert.equal(await second, true)
  assert.equal(initialized, false)
})

test('当前导航失败仍会向上抛出', async () => {
  const coordinator = new WindowNavigationCoordinator()
  const target = { webContents: { stop: () => undefined } }
  const failure = new Error('net::ERR_CONNECTION_REFUSED')

  await assert.rejects(coordinator.navigate(target, async () => { throw failure }), failure)
})
