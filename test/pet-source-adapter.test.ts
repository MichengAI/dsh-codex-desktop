import test from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { installPetSourceAdapter } from '../src/pet-source-adapter.js'
import { petWindowHtml } from '../src/pet-window-html.js'
import { createHash } from 'node:crypto'

test('桌面接管等待同步成功；失败、卸载与释放不会隐藏页内宠物', async () => {
  let leases = 0, fail = false, listener = () => {}, action = (_: string) => {}
  const events = new Map<string, () => void>(), states: unknown[] = []
  const page: Record<string, any> = {
    addEventListener: (key: string, fn: () => void) => events.set(key, fn),
    removeEventListener: (key: string) => events.delete(key),
    dshPetHost: { sync: async (state: unknown) => { if (fail && state) throw Error('加载失败'); states.push(state) }, onAction: (fn: typeof action) => { action = fn; return () => {} }, onCommand: () => () => {} },
    dshPet: { version: 1, getSnapshot: () => ({ pet: { id: 'test', url: '/dsh-codex-pet/asset/test' }, config: { visible: true }, notifications: { activity: {}, items: [] } }), subscribe: (fn: () => void) => { listener = fn; return () => {} }, acquireDisplay: () => { leases++; return () => { leases-- } } },
  }
  const flush = () => new Promise(resolve => setImmediate(resolve))
  runInNewContext(`(${installPetSourceAdapter.toString()})()`, { window: page, console: { warn() {} }, AbortSignal, fetch: async () => ({ ok: true, blob: async () => ({ type: 'image/png', size: 1 }) }), FileReader: class { result = 'data:image/png;base64,AA=='; onload = () => {}; readAsDataURL() { this.onload() } } })
  assert.equal(leases, 0); await flush(); assert.equal(leases, 1)
  action('release'); assert.equal(leases, 0)
  fail = true; listener(); await flush(); assert.equal(leases, 0); assert.equal(states.at(-1), null)
  fail = false; listener(); await flush(); assert.equal(leases, 1)
  delete page.dshPet; events.get('dsh-pet-disposed')!(); await flush(); assert.equal(leases, 0); assert.equal(states.at(-1), null)
  page.__disposePetAdapter(); await flush(); assert.equal(events.size, 0)
})

test('原生 HTML 仅允许内嵌图片与指定脚本哈希，不加载插件桌面页面', () => {
  const html = petWindowHtml('http://127.0.0.1:1234')
  const script = html.match(/<script>([\s\S]+)<\/script>/)![1]
  assert.ok(html.includes(`'sha256-${createHash('sha256').update(script).digest('base64')}'`))
  assert.ok(html.includes("default-src 'none'"))
  assert.ok(html.includes('img-src data:'))
  assert.ok(!html.includes('desktop.html'))
  for (const url of ['https://remote.test', 'file:///tmp', 'http://localhost:1234/path', 'http://localhost:1234"']) assert.throws(() => petWindowHtml(url))
})
