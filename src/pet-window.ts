/** Desktop 持有原生窗口与渲染，主动消费宠物插件的公开接口。 */
import { app, BrowserWindow, ipcMain, screen, type WebContents, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { constrainPetBounds, parsePetWindowState, validPetCommand, type PetWindowState } from './pet-window-policy.js'
import { randomUUID } from 'node:crypto'
import { petWindowHtml } from './pet-window-html.js'
import { installPetSourceAdapter } from './pet-source-adapter.js'
const CHANNEL = 'dsh-pet:'
export function installPetWindow(options: { source(): WebContents | undefined; reveal(): void; show?: boolean }): () => void {
  let window: BrowserWindow | undefined, state: PetWindowState | null = null, origin: string | undefined
  let sourceOwner: WebContents | undefined
  const pendingCommands = new Map<string, { resolve(): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>()
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const locationFile = join(app.getPath('userData'), 'pet-position.json')
  const isSource = (event: IpcMainEvent | IpcMainInvokeEvent) => event.sender === options.source() && event.senderFrame === event.sender.mainFrame
  const isPet = (event: IpcMainEvent) => event.sender === window?.webContents && event.senderFrame === event.sender.mainFrame
  const send = () => { if (state && window && origin && !window.isDestroyed()) window.webContents.send(CHANNEL + 'state', { ...state, sprite: undefined, pet: { ...state.pet, url: state.sprite } }) }
  const close = () => { for (const pending of pendingCommands.values()) { clearTimeout(pending.timer); pending.reject(new Error('宠物窗口已关闭')) }; pendingCommands.clear(); const old = window; window = undefined; origin = undefined; old?.destroy() }
  const release = () => { const source = options.source(); if (source && !source.isDestroyed()) source.send(CHANNEL + 'action', 'release') }
  const areaPosition = () => {
    const area = screen.getPrimaryDisplay().workArea
    let desired = { x: area.x + area.width - 336, y: area.y + area.height - 576 }
    try { const stored = JSON.parse(readFileSync(locationFile, 'utf8')) as { x: number; y: number }; if (Number.isFinite(stored.x) && Number.isFinite(stored.y)) desired = stored } catch { /* 首次启动或旧位置文件损坏时使用屏幕右下角。 */ }
    const nearest = screen.getDisplayNearestPoint(desired).workArea
    return constrainPetBounds(desired, nearest)
  }
  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!window || window.isDestroyed()) return
      const { x, y } = window.getBounds()
      try { writeFileSync(locationFile + '.tmp', JSON.stringify({ x, y }), 'utf8'); renameSync(locationFile + '.tmp', locationFile) } catch (error) { console.warn('[dsh-pet] 保存桌面位置失败', error) }
    }, 250)
  }
  ipcMain.handle(CHANNEL + 'sync', async (event, value: unknown) => {
    if (!isSource(event)) throw new Error('宠物窗口拒绝未知来源')
    if (value === null) { state = null; close(); return }
    const next = parsePetWindowState(value); if (!next) throw new Error('宠物窗口状态无效')
    if (next.config.visible && !next.sprite) throw new Error('宠物图集未就绪')
    const sourceUrl = new URL(event.sender.getURL())
    if (sourceUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(sourceUrl.hostname)) throw new Error('宠物窗口只加载本机 DSH')
    state = next
    sourceOwner = event.sender
    if (!state.config.visible) { close(); return }
    if (origin && origin !== sourceUrl.origin) close()
    if (window) {
      send()
    } else {
      origin = sourceUrl.origin
      window = new BrowserWindow({ ...areaPosition(), width: 320, height: 560, transparent: true, backgroundColor: '#00000000', frame: false, alwaysOnTop: true, skipTaskbar: true, resizable: false, hasShadow: false, show: false,
        webPreferences: { preload: join(app.getAppPath(), 'dist', 'src', 'pet-window-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } })
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      window.setIgnoreMouseEvents(true, { forward: true })
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      const created = window
      const permitted = 'data:text/html;charset=utf-8,' + encodeURIComponent(petWindowHtml(origin))
      window.webContents.on('will-navigate', navigation => navigation.preventDefault())
      window.webContents.on('will-redirect', navigation => navigation.preventDefault())
      window.on('closed', () => { if (window === created) { window = undefined; close(); release() } })
      window.webContents.on('render-process-gone', () => { if (window === created) { close(); release() } })
      window.on('moved', persist)
      try { await created.loadURL(permitted); if (window !== created) throw new Error('宠物窗口加载已取消'); if (options.show !== false) created.showInactive(); created.setAlwaysOnTop(true, 'floating'); send() } catch (error) { if (window === created) close(); throw error }
    }
  })
  ipcMain.handle(CHANNEL + 'command', async (event, command: unknown) => {
    if (event.sender !== window?.webContents || event.senderFrame !== event.sender.mainFrame || !validPetCommand(command, state)) throw new Error('通知已变化或操作无效')
    const source = options.source(); if (!source || source.isDestroyed()) throw new Error('DSH 会话窗口不可用')
    if ((command as { type: string }).type === 'open') options.reveal()
    const id = randomUUID()
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { pendingCommands.delete(id); reject(new Error('操作未确认，请查看会话后重试')) }, 15000)
      pendingCommands.set(id, { resolve, reject, timer })
      source.send(CHANNEL + 'command', id, command)
    })
  })
  const finishCommand = (event: IpcMainEvent, id: unknown, error: unknown) => {
    if (!isSource(event) || typeof id !== 'string') return
    const pending = pendingCommands.get(id); if (!pending) return
    pendingCommands.delete(id); clearTimeout(pending.timer)
    if (typeof error === 'string') pending.reject(new Error(error.slice(0, 1000))); else pending.resolve()
  }
  ipcMain.on(CHANNEL + 'command-result', finishCommand)
  const listeners: Array<[string, (event: IpcMainEvent, ...args: any[]) => void]> = [
    ['ready', event => { if (isPet(event)) send() }],
    ['pointer', (event, interactive: unknown) => { if (isPet(event) && typeof interactive === 'boolean') window?.setIgnoreMouseEvents(!interactive, { forward: true }) }],
    ['move', (event, dx: unknown, dy: unknown) => {
      if (!isPet(event) || !window || typeof dx !== 'number' || typeof dy !== 'number' || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 512 || Math.abs(dy) > 512) return
      const old = window.getBounds(), target = { x: old.x + dx, y: old.y + dy }
      const area = screen.getDisplayNearestPoint({ x: target.x + 160, y: target.y + 280 }).workArea
      const next = constrainPetBounds(target, area); window.setPosition(next.x, next.y)
    }],
    ['action', (event, action: unknown) => {
      if (!isPet(event) || !['hide', 'open', 'settings'].includes(String(action))) return
      if (action !== 'hide') options.reveal()
      options.source()?.send(CHANNEL + 'action', action)
      if (action === 'hide') {
        state = null
        close()
        release()
      }
    }],
  ]
  for (const [suffix, listener] of listeners) ipcMain.on(CHANNEL + suffix, listener)
  const clamp = () => { if (!window) return; const old = window.getBounds(); const area = screen.getDisplayNearestPoint(old).workArea; const next = constrainPetBounds(old, area); window.setPosition(next.x, next.y) }
  screen.on('display-removed', clamp); screen.on('display-metrics-changed', clamp)
  let disposed = false
  const watchers = new Map<WebContents, () => void>()
  const watch = (contents: WebContents) => {
    if (watchers.has(contents) || contents.isDestroyed()) return
    const inject = () => {
      if (disposed || contents !== options.source() || contents.isDestroyed()) return
      const url = new URL(contents.getURL() || 'about:blank')
      if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return
      void contents.executeJavaScript(`(${installPetSourceAdapter.toString()})()`).catch(error => { if (!disposed && contents === options.source()) { close(); release(); console.warn('[dsh-pet] 注入适配器失败', error) } })
    }
    const reset = () => { if (contents === sourceOwner || contents === options.source()) { sourceOwner = undefined; state = null; close() } }
    // 页内路由与子框架加载不会卸载插件，保留原生窗口及展示接管。
    const navigation = (event: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>) => { if (event.isMainFrame && !event.isSameDocument) reset() }
    const cleanup = () => { contents.removeListener('did-finish-load', inject); contents.removeListener('did-start-navigation', navigation); contents.removeListener('render-process-gone', reset); contents.removeListener('destroyed', destroyed); watchers.delete(contents) }
    const destroyed = () => { reset(); cleanup() }
    contents.on('did-finish-load', inject); contents.on('did-start-navigation', navigation); contents.on('render-process-gone', reset); contents.on('destroyed', destroyed)
    watchers.set(contents, cleanup)
    if (!contents.isLoading()) inject()
  }
  const createdContents = (_event: Electron.Event, contents: WebContents) => watch(contents)
  app.on('web-contents-created', createdContents)
  const initial = options.source(); if (initial) watch(initial)
  const dispose = () => { if (disposed) return; disposed = true; release(); close(); for (const cleanup of watchers.values()) cleanup(); app.removeListener('web-contents-created', createdContents); const source = options.source(); if (source && !source.isDestroyed()) void source.executeJavaScript('window.__disposePetAdapter?.()').catch(() => {}); if (saveTimer) clearTimeout(saveTimer); ipcMain.removeHandler(CHANNEL + 'sync'); ipcMain.removeHandler(CHANNEL + 'command'); ipcMain.removeListener(CHANNEL + 'command-result', finishCommand); for (const [suffix, listener] of listeners) ipcMain.removeListener(CHANNEL + suffix, listener); screen.removeListener('display-removed', clamp); screen.removeListener('display-metrics-changed', clamp); app.removeListener('before-quit', dispose) }
  app.on('before-quit', dispose)
  return dispose
}
