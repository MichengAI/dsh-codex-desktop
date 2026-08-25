const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

const IPC = {
  dshAction: 'dsh-shell:dsh-action',
  dshLocale: 'dsh-shell:dsh-locale',
  dshOpenSession: 'dsh-shell:dsh-open-session',
  dshNotificationReply: 'dsh-shell:dsh-notification-reply',
  dshState: 'dsh-shell:dsh-state',
  dshNotification: 'dsh-shell:dsh-notification',
} as const

let clientBridgeRegistrations = 0
let selectionHistory: HTMLElement[] = []
let selectionIndex = -1
let selectionSyncScheduled = false
const MAX_FALLBACK_HISTORY = 100

function normalizedLabel(element: Element): string {
  return `${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''}`.trim()
}

function clickMatching(patterns: RegExp[]): boolean {
  const candidates = [...document.querySelectorAll<HTMLElement>('button,[role="button"],[role="menuitem"]')]
    .filter(element => element.offsetParent !== null)
  const target = candidates.find(element => patterns.some(pattern => pattern.test(normalizedLabel(element))))
  target?.click()
  return target !== undefined
}

function sessionRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.dcu-wb-session[role="treeitem"][aria-selected]')]
    .filter(element => element.offsetParent !== null && normalizedLabel(element) !== '')
}

function currentSessionRow(): HTMLElement | undefined {
  return sessionRows().find(element => element.getAttribute('aria-selected') === 'true'
    || /selected|active/i.test(element.className))
}

function trackSelection(): void {
  if (clientBridgeRegistrations > 0) return
  const active = selectionHistory[selectionIndex]
  selectionHistory = selectionHistory.filter(element => element.isConnected)
  selectionIndex = active === undefined ? selectionHistory.length - 1 : selectionHistory.indexOf(active)
  if (selectionIndex < 0) selectionIndex = selectionHistory.length - 1
  const current = currentSessionRow()
  if (current === undefined || selectionHistory[selectionIndex] === current) return
  selectionHistory = selectionHistory.slice(0, selectionIndex + 1)
  selectionHistory.push(current)
  if (selectionHistory.length > MAX_FALLBACK_HISTORY) selectionHistory = selectionHistory.slice(-MAX_FALLBACK_HISTORY)
  selectionIndex = selectionHistory.length - 1
  reportFallbackState()
}

function scheduleTrackSelection(): void {
  if (selectionSyncScheduled) return
  selectionSyncScheduled = true
  setTimeout(() => {
    selectionSyncScheduled = false
    trackSelection()
  }, 60)
}

function reportFallbackState(): void {
  if (clientBridgeRegistrations > 0) return
  const rows = sessionRows()
  const current = currentSessionRow()
  const rowIndex = current === undefined ? -1 : rows.indexOf(current)
  ipcRenderer.send(IPC.dshState, {
    canBack: selectionIndex > 0,
    canForward: selectionIndex >= 0 && selectionIndex < selectionHistory.length - 1,
    canPreviousChat: rowIndex > 0,
    canNextChat: rowIndex >= 0 && rowIndex < rows.length - 1,
  })
}

function reportDocumentLocale(): void {
  const locale = document.documentElement.lang.trim()
  if (locale !== '') ipcRenderer.send(IPC.dshLocale, locale)
}

function runDomAction(id: string): void {
  if (id === 'new-chat') clickMatching([/^新建任务$|^new task$/i, /^新聊天$|^new chat$/i])
  else if (id === 'open-folder') clickMatching([/添加工作区|打开文件夹|add workspace|open folder/i])
  else if (id === 'settings') clickMatching([/^设置$|^settings$|preferences/i])
  else if (id === 'toggle-sidebar') clickMatching([/收起侧边栏|展开侧边栏|collapse sidebar|expand sidebar/i])
  else if (id === 'find') {
    const input = document.querySelector<HTMLInputElement>('input[placeholder*="搜索会话"],input[placeholder*="Search sessions"]')
    if (input !== null) { input.focus(); input.select() }
    else if (clickMatching([/搜索会话|search sessions/i])) setTimeout(() => {
      const expanded = document.querySelector<HTMLInputElement>('input[placeholder*="搜索会话"],input[placeholder*="Search sessions"]')
      expanded?.focus()
      expanded?.select()
    }, 120)
  } else if (id === 'previous-chat' || id === 'next-chat') {
    const rows = sessionRows()
    const current = currentSessionRow()
    const index = current === undefined ? -1 : rows.indexOf(current)
    rows[index + (id === 'previous-chat' ? -1 : 1)]?.click()
  } else if (id === 'back' || id === 'forward') {
    const next = selectionIndex + (id === 'back' ? -1 : 1)
    const row = selectionHistory[next]
    if (row !== undefined && row.isConnected) { selectionIndex = next; row.click(); reportFallbackState() }
  }
}

ipcRenderer.on(IPC.dshAction, (_event, id: string) => {
  setTimeout(() => { if (clientBridgeRegistrations === 0) runDomAction(id) }, 60)
})

window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', scheduleTrackSelection, true)
  new MutationObserver(scheduleTrackSelection).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'class'] })
  reportFallbackState()
  reportDocumentLocale()
  new MutationObserver(reportDocumentLocale).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
})

contextBridge.exposeInMainWorld('dshDesktopShell', {
  onAction: (listener: (id: string) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, id: string) => listener(id)
    clientBridgeRegistrations += 1
    selectionHistory = []
    selectionIndex = -1
    ipcRenderer.on(IPC.dshAction, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC.dshAction, wrapped)
      clientBridgeRegistrations = Math.max(0, clientBridgeRegistrations - 1)
      if (clientBridgeRegistrations === 0) scheduleTrackSelection()
    }
  },
  onOpenSession: (listener: (id: string) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, id: string) => listener(id)
    ipcRenderer.on(IPC.dshOpenSession, wrapped)
    return () => ipcRenderer.removeListener(IPC.dshOpenSession, wrapped)
  },
  onNotificationReply: (listener: (value: { sessionId: string; text: string }) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, value: { sessionId: string; text: string }) => listener(value)
    ipcRenderer.on(IPC.dshNotificationReply, wrapped)
    return () => ipcRenderer.removeListener(IPC.dshNotificationReply, wrapped)
  },
  reportState: (state: unknown) => {
    ipcRenderer.send(IPC.dshState, state)
  },
  reportNotification: (event: unknown) => {
    ipcRenderer.send(IPC.dshNotification, event)
  },
  reportLocale: (locale: unknown) => {
    ipcRenderer.send(IPC.dshLocale, locale)
  },
})
