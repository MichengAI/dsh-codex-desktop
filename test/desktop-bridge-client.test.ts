import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'

import { desktopBridgeClientBundle } from '../src/desktop-bridge-client-source.js'

type ActionListener = (id: string) => void
type ClientPlugin = { apply(ctx: Record<string, unknown>): void; inject: string[] }

function loadClient(options: { elements?: unknown[]; errors?: string[]; focused?: boolean; editor?: { width: number; height: number; visibility?: string } } = {}): {
  apply(ctx: Record<string, unknown>): void
  focusWindow(): void
  inject: string[]
  locales: string[]
  listener(): ActionListener
  notifications: Array<Record<string, unknown>>
  bootReports: Array<Record<string, unknown>>
  themes: Array<Record<string, unknown>>
  openSession(id: string): void
  reply(value: { sessionId: string; text: string }): void
} {
  let registration: { factory(): ClientPlugin } | undefined
  let actionListener: ActionListener | undefined
  let openSessionListener: ActionListener | undefined
  let notificationReplyListener: ((value: { sessionId: string; text: string }) => void) | undefined
  let focused = options.focused ?? true
  const focusListeners = new Set<() => void>()
  const notifications: Array<Record<string, unknown>> = []
  const bootReports: Array<Record<string, unknown>> = []
  const locales: string[] = []
  const themes: Array<Record<string, unknown>> = []
  const context = {
    console: { error: (...args: unknown[]) => { options.errors?.push(args.map(String).join(' ')) } },
    document: {
      body: {}, hasFocus: () => focused, querySelectorAll: () => options.elements ?? [],
      querySelector: (selector: string) => {
        assert.equal(selector, '[data-shell-overlay]')
        return options.editor === undefined ? null : { parentElement: {
          querySelector: (selector: string) => {
            assert.equal(selector, '[role="textbox"]')
            return { getBoundingClientRect: () => options.editor }
          },
        } }
      },
    },
    getComputedStyle: () => ({ visibility: options.editor?.visibility ?? 'visible' }),
    requestAnimationFrame: (callback: () => void) => queueMicrotask(callback),
    MutationObserver: class { observe(): void {} disconnect(): void {} },
    queueMicrotask,
    setTimeout,
    window: {
      __ModuleLoader__: { load(value: { factory(): ClientPlugin }): void { registration = value } },
      dshDesktopShell: {
        onAction(listener: ActionListener): () => void { actionListener = listener; return () => { actionListener = undefined } },
        onOpenSession(listener: ActionListener): () => void { openSessionListener = listener; return () => { openSessionListener = undefined } },
        onNotificationReply(listener: (value: { sessionId: string; text: string }) => void): () => void { notificationReplyListener = listener; return () => { notificationReplyListener = undefined } },
        reportNotification(event: Record<string, unknown>): void { notifications.push(event) },
        reportBoot(report: Record<string, unknown>): void { bootReports.push(report) },
        reportLocale(locale: string): void { locales.push(locale) },
        reportTheme(value: Record<string, unknown>): void { themes.push(value) },
        reportState(): void {},
      },
      addEventListener(type: string, listener: () => void): void { if (type === 'focus') focusListeners.add(listener) },
      removeEventListener(type: string, listener: () => void): void { if (type === 'focus') focusListeners.delete(listener) },
    },
  }
  vm.runInNewContext(desktopBridgeClientBundle(), context)
  assert.ok(registration)
  const plugin = registration.factory()
  return {
    apply: plugin.apply,
    focusWindow: () => { focused = true; for (const listener of focusListeners) listener() },
    inject: plugin.inject,
    locales,
    listener: () => { assert.ok(actionListener); return actionListener },
    notifications,
    bootReports,
    themes,
    openSession: id => { assert.ok(openSessionListener); openSessionListener(id) },
    reply: value => { assert.ok(notificationReplyListener); notificationReplyListener(value) },
  }
}

test('通知回复不把会话级 conversation 声明为根上下文注入', () => {
  const client = loadClient()
  assert.equal(client.inject.includes('conversation'), false)
  assert.equal(client.inject.includes('locale'), true)
})

function clientContext(workspaces: Record<string, unknown>): Record<string, unknown> {
  return {
    effect(callback: () => void): void { callback() },
    loader: { await: async () => undefined, entries: () => [] },
    layout: { toggleSidebar(): void {} },
    locale: { getSnapshot: () => ({ active: 'zh' }), subscribe: () => () => {} },
    sessions: {
      binding: () => undefined,
      list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => {} },
      open(): void {},
      scope: () => ({ get: (name: string) => name === 'conversation' ? { send: async () => {} } : undefined }),
    },
    workspaces,
  }
}

test('桌面外壳跟随 DSH locale 快照和后续切换', () => {
  let active = 'zh'
  let localeListener: (() => void) | undefined
  const client = loadClient()
  client.apply({
    ...clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }),
    locale: {
      getSnapshot: () => ({ active }),
      subscribe: (listener: () => void) => { localeListener = listener; return () => {} },
    },
  })
  assert.deepEqual(client.locales, ['zh'])
  active = 'en'
  assert.ok(localeListener)
  localeListener()
  assert.deepEqual(client.locales, ['zh', 'en'])
})

test('桌面桥不注入 theme；外壳主题由 DSH preload 的 document 样式上报', () => {
  const client = loadClient()
  client.apply(clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }))
  assert.equal(client.inject.includes('theme'), false)
  assert.deepEqual(client.locales, ['zh'])
  assert.deepEqual(client.themes, [])
})

test('客户端 Loader 未激活的插件会以结构化启动报告上报', async () => {
  const client = loadClient()
  client.apply({
    ...clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }),
    loader: {
      await: async () => { throw new Error('plugin activation failed') },
      entries: () => [
        { options: { name: '@scope/broken-plugin' }, fiber: { state: 1 } },
        { options: { name: 'healthy-plugin' }, fiber: { state: 2 } },
      ],
    },
  })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(JSON.parse(JSON.stringify(client.bootReports)), [{
    status: 'failed',
    plugins: ['@scope/broken-plugin'],
    error: 'plugin activation failed',
    workbenchReady: false,
  }])
})

for (const [name, editor, ready] of [
  ['已渲染输入框', { width: 600, height: 80 }, true],
  ['隐藏输入框', { width: 0, height: 0 }, false],
  ['不可见输入框', { width: 600, height: 80, visibility: 'hidden' }, false],
] as const) {
  test(`非关键插件失败时依据${name}报告工作台可用性`, async () => {
    const client = loadClient({ editor })
    client.apply({
      ...clientContext({ startSession(): void {} }),
      loader: {
        await: async () => undefined,
        entries: () => [{ options: { name: 'optional-plugin' }, fiber: { state: 1 } }],
      },
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(client.bootReports[0]?.status, 'failed')
    assert.equal(client.bootReports[0]?.workbenchReady, ready)
  })
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

test('会话 running 边沿触发一次完成通知且通知点击可打开会话', () => {
  let snapshot = {
    ids: ['session-1'], current: undefined,
    byId: { 'session-1': { displayTitle: '修复登录', running: true } },
  }
  let listListener: (() => void) | undefined
  let opened = ''
  const client = loadClient()
  client.apply({
    ...clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }),
    sessions: {
      binding: () => ({ session: { getSnapshot: () => ({
        nodes: [
          { kind: 'user', blocks: [{ kind: 'text', text: '修复登录' }] },
          { kind: 'assistant', blocks: [{ kind: 'text', text: '登录状态同步已经修复，并补充了回归测试。' }] },
        ],
      }) } }),
      list: { getSnapshot: () => snapshot, subscribe: (listener: () => void) => { listListener = listener; return () => {} } },
      open(id: string): void { opened = id },
    },
  })
  snapshot = { ...snapshot, byId: { 'session-1': { displayTitle: '修复登录', running: false } } }
  assert.ok(listListener)
  listListener()
  listListener()
  assert.deepEqual(JSON.parse(JSON.stringify(client.notifications.filter(event => event.type === 'notify'))), [
    {
      type: 'notify', kind: 'turn-complete', sessionId: 'session-1', title: '修复登录',
      body: '登录状态同步已经修复，并补充了回归测试。',
    },
  ])
  client.openSession('session-1')
  assert.equal(opened, 'session-1')
})

test('通知内联回复会发送到对应会话并关闭该会话通知', async () => {
  const sent: Array<{ sessionId: string; text: string }> = []
  const requestedServices: string[] = []
  const client = loadClient()
  client.apply({
    ...clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }),
    sessions: {
      binding: () => undefined,
      list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => {} },
      open(): void {},
      scope: (sessionId: string) => ({
        get: (name: string) => {
          requestedServices.push(name)
          return name === 'conversation' ? { send: async (text: string) => { sent.push({ sessionId, text }) } } : undefined
        },
      }),
    },
  })
  client.reply({ sessionId: 'session-reply', text: '  继续补充测试  ' })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(sent, [{ sessionId: 'session-reply', text: '继续补充测试' }])
  assert.deepEqual(requestedServices, ['conversation'])
  assert.equal(client.notifications.some(event => event.type === 'dismiss' && event.sessionId === 'session-reply'), true)
})

test('通知内联回复发送失败时上报可见错误而不是静默失败', async () => {
  const errors: string[] = []
  const client = loadClient({ errors })
  client.apply({
    ...clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }),
    sessions: {
      binding: () => undefined,
      list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => {} },
      open(): void {},
      scope: () => ({ get: (name: string) => name === 'conversation' ? { send: async () => { throw new Error('missing session') } } : undefined }),
    },
  })
  client.reply({ sessionId: 'missing-session', text: '继续' })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(errors.some(error => error.includes('通知回复发送失败')), true)
  assert.equal(client.notifications.some(event => event.type === 'reply-error' && event.sessionId === 'missing-session'), true)
})

test('审批、计划审核和问题产生对应通知，阻塞边沿不误报完成', () => {
  let snapshot: any = {
    ids: ['session-1'], current: undefined,
    byId: { 'session-1': { displayTitle: '发布任务', running: true } },
  }
  let listListener: (() => void) | undefined
  const client = loadClient()
  client.apply({
    ...clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }),
    sessions: {
      binding: () => undefined,
      list: { getSnapshot: () => snapshot, subscribe: (listener: () => void) => { listListener = listener; return () => {} } },
      open(): void {},
    },
  })
  assert.ok(listListener)
  snapshot = { ...snapshot, byId: { 'session-1': { displayTitle: '发布任务', running: false, pendingInteraction: 'plan-review' } } }
  listListener()
  snapshot = { ...snapshot, byId: { 'session-1': { displayTitle: '发布任务', running: false, pendingInteraction: 'question' } } }
  listListener()
  assert.deepEqual(client.notifications.filter(event => event.type === 'notify').map(event => event.kind), ['approval', 'question'])
})

test('清空选择后重新打开同一会话仍会关闭该会话通知', () => {
  let snapshot: any = {
    ids: ['session-1'], current: 'session-1',
    byId: { 'session-1': { displayTitle: '任务', running: false } },
  }
  let listListener: (() => void) | undefined
  const client = loadClient()
  client.apply({
    ...clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }),
    sessions: {
      binding: () => undefined,
      list: { getSnapshot: () => snapshot, subscribe: (listener: () => void) => { listListener = listener; return () => {} } },
      open(): void {},
    },
  })
  assert.ok(listListener)
  snapshot = { ...snapshot, current: undefined }
  listListener()
  snapshot = { ...snapshot, current: 'session-1' }
  listListener()
  assert.equal(client.notifications.filter(event => event.type === 'dismiss').length, 2)
})

test('未聚焦会话完成时上报未读标记，窗口重新聚焦后清除', () => {
  let snapshot: any = {
    ids: ['session-1'], current: 'session-1',
    byId: { 'session-1': { displayTitle: '任务', running: true } },
  }
  let listListener: (() => void) | undefined
  const client = loadClient({ focused: false })
  client.apply({
    ...clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }),
    sessions: {
      binding: () => undefined,
      list: { getSnapshot: () => snapshot, subscribe: (listener: () => void) => { listListener = listener; return () => {} } },
      open(): void {},
    },
  })
  snapshot = { ...snapshot, byId: { 'session-1': { displayTitle: '任务', running: false } } }
  assert.ok(listListener)
  listListener()
  assert.deepEqual(client.notifications.filter(event => event.type === 'badge').map(event => event.count), [0, 1])
  client.focusWindow()
  assert.deepEqual(client.notifications.filter(event => event.type === 'badge').map(event => event.count), [0, 1, 0])
})

test('已读完成任务在列表刷新后不会重新计入角标', () => {
  let snapshot: any = {
    ids: ['session-1', 'session-2'], current: 'session-1',
    byId: {
      'session-1': { completed: true, displayTitle: '任务一', running: false },
      'session-2': { completed: true, displayTitle: '任务二', running: false },
    },
  }
  let listListener: (() => void) | undefined
  const client = loadClient()
  client.apply({
    ...clientContext({ pickDirectory: async () => null, create: async () => ({}), startSession(): void {} }),
    sessions: {
      binding: () => undefined,
      list: { getSnapshot: () => snapshot, subscribe: (listener: () => void) => { listListener = listener; return () => {} } },
      open(): void {},
    },
  })
  assert.deepEqual(client.notifications.filter(event => event.type === 'badge').map(event => event.count), [1])

  snapshot = { ...snapshot, current: 'session-2' }
  assert.ok(listListener)
  listListener()
  listListener()

  assert.deepEqual(client.notifications.filter(event => event.type === 'badge').map(event => event.count), [1, 0])
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
