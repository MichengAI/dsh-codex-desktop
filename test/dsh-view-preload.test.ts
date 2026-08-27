import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

test('client bridge 卸载后重新启用 DOM fallback', async () => {
  const source = await readFile(new URL('../src/dsh-view-preload.cjs', import.meta.url), 'utf8')
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  let exposed: { onAction(listener: (id: string) => void): () => void; onOpenSession(listener: (id: string) => void): () => void; onNotificationReply(listener: (value: { sessionId: string; text: string }) => void): () => void; reportState(state: unknown): void; reportNotification(event: unknown): void; reportLocale(locale: unknown): void; reportTheme(colorScheme: unknown): void } | undefined
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
  exposed.reportTheme({ colorScheme: 'light', preference: 'light' })
  unregister()
  unregisterOpen()
  unregisterReply()
  for (const listener of listeners.get('dsh-shell:dsh-action') ?? []) listener({}, 'new-chat')
  assert.equal(clicks, 1)
})

test('DSH 设置对话框可由 Escape 关闭', async () => {
  const source = await readFile(new URL('../src/dsh-view-preload.cjs', import.meta.url), 'utf8')
  const listeners = new Map<string, Array<(...args: any[]) => void>>()
  let clicks = 0
  const close = {
    getAttribute: () => null,
    textContent: '关闭',
    click: () => { clicks += 1 },
  }
  const dialog = {
    getAttribute: (name: string) => name === 'aria-labelledby' ? 'settings-title' : null,
    offsetParent: {},
    querySelectorAll: () => [close],
    querySelector: () => close,
  }
  const document = {
    body: {},
    documentElement: { lang: 'zh-CN', style: { colorScheme: 'light' } },
    activeElement: null,
    addEventListener(type: string, listener: (...args: any[]) => void): void {
      listeners.set(type, [...listeners.get(type) ?? [], listener])
    },
    getElementById: (id: string) => id === 'settings-title' ? { getAttribute: () => null, textContent: '设置' } : null,
    querySelectorAll: (selector: string) => selector.includes('[role="dialog"]') ? [dialog] : [],
    querySelector: () => null,
  }
  const ipcRenderer = { on(): void {}, removeListener(): void {}, send(): void {} }
  vm.runInNewContext(source, {
    exports: {},
    module: { exports: {} },
    require: () => ({ contextBridge: { exposeInMainWorld(): void {} }, ipcRenderer }),
    window: { addEventListener: (type: string, listener: () => void) => { if (type === 'DOMContentLoaded') listener() } },
    document,
    MutationObserver: class { observe(): void {} },
    setTimeout: (callback: () => void) => { callback(); return 0 },
  })
  let prevented = false
  let stopped = false
  for (const listener of listeners.get('keydown') ?? []) listener({ key: 'Escape', preventDefault: () => { prevented = true }, stopImmediatePropagation: () => { stopped = true } })
  assert.equal(clicks, 1)
  assert.equal(prevented, true)
  assert.equal(stopped, true)
})

test('Escape 不会拦截非设置对话框，也不会误点关闭会话', async () => {
  const source = await readFile(new URL('../src/dsh-view-preload.cjs', import.meta.url), 'utf8')
  const listeners = new Map<string, Array<(...args: any[]) => void>>()
  let clicks = 0
  const closeSession = { getAttribute: () => null, textContent: '关闭会话', click: () => { clicks += 1 } }
  const dialog = {
    getAttribute: (name: string) => name === 'aria-labelledby' ? 'confirm-title' : name === 'aria-modal' ? 'true' : null,
    offsetParent: {},
    querySelectorAll: () => [closeSession],
  }
  const document = {
    body: {}, documentElement: { lang: 'zh-CN', style: { colorScheme: 'light' } }, activeElement: null,
    addEventListener(type: string, listener: (...args: any[]) => void): void { listeners.set(type, [...listeners.get(type) ?? [], listener]) },
    getElementById: (id: string) => id === 'confirm-title' ? { getAttribute: () => null, textContent: '确认删除' } : null,
    querySelectorAll: (selector: string) => selector.includes('[role="dialog"]') ? [dialog] : [],
    querySelector: () => null,
  }
  const ipcRenderer = { on(): void {}, removeListener(): void {}, send(): void {} }
  vm.runInNewContext(source, { exports: {}, module: { exports: {} }, require: () => ({ contextBridge: { exposeInMainWorld(): void {} }, ipcRenderer }), window: { addEventListener: (type: string, listener: () => void) => { if (type === 'DOMContentLoaded') listener() } }, document, MutationObserver: class { observe(): void {} }, setTimeout: (callback: () => void) => { callback(); return 0 } })
  let prevented = false
  for (const listener of listeners.get('keydown') ?? []) listener({ key: 'Escape', preventDefault: () => { prevented = true }, stopImmediatePropagation(): void {} })
  assert.equal(clicks, 0)
  assert.equal(prevented, false)
})
