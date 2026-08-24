const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

const IPC = {
  dshAction: 'dsh-shell:dsh-action',
  dshState: 'dsh-shell:dsh-state',
} as const

let clientBridgeReady = false
let selectionHistory: HTMLElement[] = []
let selectionIndex = -1
let selectionSyncScheduled = false

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
  return [...document.querySelectorAll<HTMLElement>('[role="treeitem"][aria-selected]')]
    .filter(element => element.offsetParent !== null && normalizedLabel(element) !== '')
}

function currentSessionRow(): HTMLElement | undefined {
  return sessionRows().find(element => element.getAttribute('aria-selected') === 'true'
    || /selected|active/i.test(element.className))
}

function trackSelection(): void {
  const current = currentSessionRow()
  if (current === undefined || selectionHistory[selectionIndex] === current) return
  selectionHistory = selectionHistory.slice(0, selectionIndex + 1)
  selectionHistory.push(current)
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
  if (clientBridgeReady) return
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
  setTimeout(() => { if (!clientBridgeReady) runDomAction(id) }, 60)
})

window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', scheduleTrackSelection, true)
  new MutationObserver(scheduleTrackSelection).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'class'] })
  reportFallbackState()
})

contextBridge.exposeInMainWorld('dshDesktopShell', {
  onAction: (listener: (id: string) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, id: string) => listener(id)
    ipcRenderer.on(IPC.dshAction, wrapped)
    return () => ipcRenderer.removeListener(IPC.dshAction, wrapped)
  },
  reportState: (state: unknown) => {
    clientBridgeReady = true
    ipcRenderer.send(IPC.dshState, state)
  },
})
