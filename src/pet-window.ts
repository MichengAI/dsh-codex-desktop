/** Desktop 原生宠物容器；渲染与业务仍来自已安装的 DSH 宠物插件。 */
import { app, BrowserWindow, ipcMain, screen, type WebContents, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { constrainPetBounds, parsePetWindowState, type PetWindowState } from './pet-window-policy.js'
const CHANNEL = 'dsh-pet:'
export function installPetWindow(options: { source(): WebContents | undefined; reveal(): void; show?: boolean }): () => void {
  let window: BrowserWindow | undefined, state: PetWindowState | null = null, origin: string | undefined
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const locationFile = join(app.getPath('userData'), 'pet-position.json')
  const isSource = (event: IpcMainEvent | IpcMainInvokeEvent) => event.sender === options.source() && event.senderFrame === event.sender.mainFrame
  const isPet = (event: IpcMainEvent) => event.sender === window?.webContents && event.senderFrame === event.sender.mainFrame
  const send = () => { if (state && window && !window.isDestroyed()) window.webContents.send(CHANNEL + 'state', state) }
  const close = () => { window?.destroy(); window = undefined; origin = undefined }
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
    const sourceUrl = new URL(event.sender.getURL())
    if (sourceUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(sourceUrl.hostname)) throw new Error('宠物窗口只加载本机 DSH')
    state = next
    if (!state.config.visible) { close(); return }
    if (origin && origin !== sourceUrl.origin) close()
    if (!window) {
      origin = sourceUrl.origin
      window = new BrowserWindow({ ...areaPosition(), width: 320, height: 560, transparent: true, backgroundColor: '#00000000', frame: false, alwaysOnTop: true, skipTaskbar: true, resizable: false, hasShadow: false, show: false,
        webPreferences: { preload: join(app.getAppPath(), 'dist', 'src', 'pet-window-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } })
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      window.setIgnoreMouseEvents(true, { forward: true })
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      const permitted = origin + '/dsh-codex-pet/desktop.html'
      window.webContents.on('will-navigate', (navigation, url) => { if (url !== permitted) navigation.preventDefault() })
      window.webContents.on('will-redirect', navigation => navigation.preventDefault())
      window.on('closed', () => { window = undefined })
      window.on('moved', persist)
      try { await window.loadURL(permitted); if (options.show !== false) window?.showInactive(); send() } catch (error) { close(); throw error }
    } else send()
  })
  const listeners: Array<[string, (event: IpcMainEvent, ...args: any[]) => void]> = [
    ['ready', event => { if (isPet(event)) send() }],
    ['pointer', (event, interactive: unknown) => { if (isPet(event) && typeof interactive === 'boolean') window?.setIgnoreMouseEvents(!interactive, { forward: true }) }],
    ['move', (event, dx: unknown, dy: unknown) => {
      if (!isPet(event) || !window || typeof dx !== 'number' || typeof dy !== 'number' || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 512 || Math.abs(dy) > 512) return
      const old = window.getBounds(), target = { x: old.x + dx, y: old.y + dy }
      const area = screen.getDisplayNearestPoint({ x: target.x + 160, y: target.y + 280 }).workArea
      const next = constrainPetBounds(target, area); window.setPosition(next.x, next.y)
    }],
    ['action', (event, action: unknown) => { if (!isPet(event) || !['hide', 'open', 'settings'].includes(String(action))) return; if (action !== 'hide') options.reveal(); options.source()?.send(CHANNEL + 'action', action); if (action === 'hide') { state = null; close() } }],
  ]
  for (const [suffix, listener] of listeners) ipcMain.on(CHANNEL + suffix, listener)
  const clamp = () => { if (!window) return; const old = window.getBounds(); const area = screen.getDisplayNearestPoint(old).workArea; const next = constrainPetBounds(old, area); window.setPosition(next.x, next.y) }
  screen.on('display-removed', clamp); screen.on('display-metrics-changed', clamp)
  const dispose = () => { close(); if (saveTimer) clearTimeout(saveTimer); ipcMain.removeHandler(CHANNEL + 'sync'); for (const [suffix, listener] of listeners) ipcMain.removeListener(CHANNEL + suffix, listener); screen.removeListener('display-removed', clamp); screen.removeListener('display-metrics-changed', clamp); app.removeListener('before-quit', dispose) }
  app.on('before-quit', dispose)
  return dispose
}
