import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'

import { desktopBridgeClientBundle } from '../src/desktop-bridge-client-source.js'

type ActionListener = (id: string) => void
type ClientPlugin = { apply(ctx: Record<string, unknown>): void }

function loadClient(options: { elements?: unknown[]; errors?: string[] } = {}): {
  apply(ctx: Record<string, unknown>): void
  listener(): ActionListener
} {
  let registration: { factory(): ClientPlugin } | undefined
  let actionListener: ActionListener | undefined
  const context = {
    console: { error: (...args: unknown[]) => { options.errors?.push(args.map(String).join(' ')) } },
    document: { body: {}, querySelectorAll: () => options.elements ?? [] },
    MutationObserver: class { observe(): void {} disconnect(): void {} },
    queueMicrotask,
    setTimeout,
    window: {
      __ModuleLoader__: { load(value: { factory(): ClientPlugin }): void { registration = value } },
      dshDesktopShell: {
        onAction(listener: ActionListener): () => void { actionListener = listener; return () => { actionListener = undefined } },
        reportState(): void {},
      },
    },
  }
  vm.runInNewContext(desktopBridgeClientBundle(), context)
  assert.ok(registration)
  return {
    apply: registration.factory().apply,
    listener: () => { assert.ok(actionListener); return actionListener },
  }
}

function clientContext(workspaces: Record<string, unknown>): Record<string, unknown> {
  return {
    effect(callback: () => void): void { callback() },
    layout: { toggleSidebar(): void {} },
    sessions: {
      list: { getSnapshot: () => ({ ids: [] }), subscribe: () => () => {} },
      open(): void {},
    },
    workspaces,
  }
}

test('打开文件夹缺少 workspaceId 时不得继承当前工作区', async () => {
  let starts = 0
  const errors: string[] = []
  const client = loadClient({ errors })
  client.apply(clientContext({
    pickDirectory: async () => 'D:\\new-project',
    create: async () => ({}),
    startSession: () => { starts += 1 },
  }))
  client.listener()('open-folder')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(starts, 0)
  assert.equal(errors.some(error => error.includes('workspaceId')), true)
})

test('创建工作区异常返回空值时也不得启动会话', async () => {
  let starts = 0
  const errors: string[] = []
  const client = loadClient({ errors })
  client.apply(clientContext({
    pickDirectory: async () => 'D:\\new-project',
    create: async () => null,
    startSession: () => { starts += 1 },
  }))
  client.listener()('open-folder')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(starts, 0)
  assert.equal(errors.some(error => error.includes('workspaceId')), true)
})

test('英文 Find 只点击精确命名的会话查找按钮', () => {
  let broadClicks = 0
  let exactClicks = 0
  const element = (label: string, click: () => void) => ({
    offsetParent: {},
    getAttribute: (name: string) => name === 'aria-label' ? label : null,
    textContent: '',
    click,
  })
  const client = loadClient({
    elements: [
      element('Find models', () => { broadClicks += 1 }),
      element('Find', () => { exactClicks += 1 }),
    ],
  })
  client.apply(clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }))
  client.listener()('find')
  assert.equal(broadClicks, 0)
  assert.equal(exactClicks, 1)
})
