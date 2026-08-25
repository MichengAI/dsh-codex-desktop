import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

test('client bridge 卸载后重新启用 DOM fallback', async () => {
  const source = await readFile(new URL('../src/dsh-view-preload.cjs', import.meta.url), 'utf8')
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  let exposed: { onAction(listener: (id: string) => void): () => void; onOpenSession(listener: (id: string) => void): () => void; onNotificationReply(listener: (value: { sessionId: string; text: string }) => void): () => void; reportState(state: unknown): void; reportNotification(event: unknown): void; reportLocale(locale: unknown): void } | undefined
  let clicks = 0
  const button = {
    offsetParent: {},
    getAttribute: () => null,
    textContent: '新建任务',
    click: () => { clicks += 1 },
  }
  const ipcRenderer = {
    on(channel: string, listener: (...args: unknown[]) => void): void {
      listeners.set(channel, [...listeners.get(channel) ?? [], listener])
    },
    removeListener(channel: string, listener: (...args: unknown[]) => void): void {
      listeners.set(channel, (listeners.get(channel) ?? []).filter(item => item !== listener))
    },
    send(): void {},
  }
  vm.runInNewContext(source, {
    exports: {},
    module: { exports: {} },
    require: () => ({
      contextBridge: { exposeInMainWorld: (_name: string, api: typeof exposed) => { exposed = api } },
      ipcRenderer,
    }),
    window: { addEventListener(): void {} },
    document: { body: {}, documentElement: { lang: 'zh-CN' }, addEventListener(): void {}, querySelectorAll: () => [button], querySelector: () => null },
    MutationObserver: class { observe(): void {} },
    setTimeout: (callback: () => void) => { callback(); return 0 },
  })
  assert.ok(exposed)
  const unregister = exposed.onAction(() => {})
  const unregisterOpen = exposed.onOpenSession(() => {})
  const unregisterReply = exposed.onNotificationReply(() => {})
  exposed.reportState({})
  exposed.reportNotification({ type: 'dismiss', sessionId: 'a' })
  exposed.reportLocale('en')
  unregister()
  unregisterOpen()
  unregisterReply()
  for (const listener of listeners.get('dsh-shell:dsh-action') ?? []) listener({}, 'new-chat')
  assert.equal(clicks, 1)
})
