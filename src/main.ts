import { app, BrowserWindow, Menu, Tray, dialog, nativeImage, net, protocol, session, shell } from 'electron'
import { existsSync } from 'node:fs'
import { writeFile as writeTextFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { DESKTOP_APP_NAME, DESKTOP_APP_USER_MODEL_ID, resolveDesktopRuntimeDir, resolveDesktopUserDataDir } from './app-identity.js'
import { resolveAppIconPath, resolveCompactIconCrop, resolveRasterIconPath, TRAY_ICON_SIZE } from './app-icon.js'
import { WINDOW_ICON_PIXEL_SIZES, isLoopbackFaviconRequest } from './window-icon.js'
import { quitDesktopApp, shouldHideInsteadOfClose } from './app-lifecycle.js'
import type { DshServer, StartDshOptions } from './dsh-process.js'
import { isExternalOpenUrl, isSameOrigin } from './navigation.js'
import { applyPendingProfileUpdates, resolvePnpmStoreDir, seedBundledPlugins, resolveWebProfileDir } from './plugin-seed.js'
import { parseUnresolvedBundleError, removeProfileBundle, startWithProfileSelfRepair } from './profile-repair.js'
import { resolveBundledPluginStore, resolvePluginBinDir } from './plugin-toolchain.js'
import { resolveDshBootstrap, resolveDshRuntime, resolveNodeExecutable } from './runtime.js'
import { extractPackagedRuntimes } from './extract-runtime.js'
import { resolvePrebuiltOfficialRuntime } from './runtime-prebuilt.js'
import { applyInitialWindowState } from './window-state.js'
import { installDesktopBridge, resolveDesktopBridgeDir } from './desktop-host.js'
import { watchProfileActivation } from './profile-watch.js'
import updater from 'electron-updater'
import { buildDesktopTrayItems, desktopUpdateChannel, desktopUpdatePrompt, formatDesktopReleaseNotes, publicDesktopUpdateError, type DesktopUpdateStatus } from './desktop-updater.js'

interface DshProcessModule {
  isApplyPluginUpdatesIpc: (message: unknown) => boolean
  startDsh: (options: StartDshOptions) => Promise<DshServer>
}

const dshProcessModule = await import(app.isPackaged
  ? pathToFileURL(join(process.resourcesPath, 'desktop-bridge', 'dsh-process.js')).href
  : './dsh-process.js') as DshProcessModule
const { isApplyPluginUpdatesIpc, startDsh } = dshProcessModule

let mainWindow: BrowserWindow | undefined
let server: DshServer | undefined
let tray: Tray | undefined
let isQuitting = false
let isRecycling = false
let lastStartOptions: Omit<StartDshOptions, 'onUnexpectedExit' | 'onIpcMessage'> | undefined
let lastSeedOptions: Parameters<typeof applyPendingProfileUpdates>[0] | undefined
let profileWatcher: { stop: () => void; sync: () => void } | undefined
let updateStatus: DesktopUpdateStatus = { kind: 'idle' }
const { autoUpdater } = updater
let isReportingUnexpectedError = false

process.on('uncaughtException', handleUnexpectedMainError)
process.on('unhandledRejection', handleUnexpectedMainError)

app.setName(DESKTOP_APP_NAME)
app.setAppUserModelId(DESKTOP_APP_USER_MODEL_ID)
if (!process.argv.some(argument => argument.startsWith('--user-data-dir='))) {
  app.setPath('userData', resolveDesktopUserDataDir(app.getPath('appData')))
}
protocol.registerSchemesAsPrivileged([
  { scheme: 'dsh-icon', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())
  app.on('activate', () => showMainWindow())
  app.on('before-quit', event => {
    if (isQuitting) return
    event.preventDefault()
    runMainTask(requestQuit())
  })

  runMainTask(startApplication())
}

async function requestQuit(): Promise<void> {
  await shutdownDesktop(() => app.exit())
}

async function shutdownDesktop(exit: () => void): Promise<void> {
  await quitDesktopApp({
    isQuitting,
    markQuitting: () => { isQuitting = true },
    destroyTray: () => {
      tray?.destroy()
      tray = undefined
      profileWatcher?.stop()
      profileWatcher = undefined
    },
    stopServer: async () => {
      const current = server
      server = undefined
      await current?.stop()
    },
    exit,
  })
}

async function startApplication(): Promise<void> {
  await app.whenReady()
  installDesktopFaviconReplacement()
  Menu.setApplicationMenu(null)
  configureDesktopUpdater()
  createTray()
  await showStartupWindow('加载中')

  try {
    const runtimeOptions = {
      appPath: app.getAppPath(),
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
    }
    const pathPrefix = resolvePluginBinDir(runtimeOptions)
    const pnpmEntry = pathPrefix === undefined ? process.env.npm_execpath : join(pathPrefix, 'pnpm-package', 'bin', 'pnpm.cjs')
    const profileDir = resolveWebProfileDir()
    const desktopRuntimeDir = resolveDesktopRuntimeDir(app.getPath('userData'), {
      isPackaged: app.isPackaged,
      execPath: process.execPath,
    })
    const extractedStoreDir = app.isPackaged ? join(dirname(desktopRuntimeDir), 'plugins', 'store') : undefined
    if (app.isPackaged) {
      extractPackagedRuntimes(process.resourcesPath, desktopRuntimeDir, extractedStoreDir!)
    }
    const pluginStoreDir = resolveBundledPluginStore({
      ...runtimeOptions,
      ...(extractedStoreDir === undefined ? {} : { extractedStoreDir }),
    })
    const profileStoreDir = resolvePnpmStoreDir(profileDir, pluginStoreDir)
    const prebuiltRuntimeDir = resolvePrebuiltOfficialRuntime(runtimeOptions)
    const nodeExecutable = resolveNodeExecutable(runtimeOptions)
    const seedOptions = {
      nodeExecutable,
      profileDir,
      desktopRuntimeDir,
      pluginStoreDir: pluginStoreDir ?? '',
      ...(prebuiltRuntimeDir === undefined ? {} : { prebuiltRuntimeDir }),
      ...(pathPrefix === undefined ? {} : { pathPrefix }),
    }
    try {
      const seeded = await seedBundledPlugins(seedOptions)
      if (seeded.seeded.length > 0) console.log(`已补种官方运行时和社区插件：${seeded.seeded.join('、')}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '内置插件补种失败。'
      await writeTextFile(join(app.getPath('userData'), 'plugin-seed.log'), `${message}\n`, 'utf8').catch(() => undefined)
    }
    try {
      const updated = await applyPendingProfileUpdates(seedOptions)
      if (updated.length > 0) console.log('已在启动前应用插件更新：' + updated.join('、'))
    } catch (error) {
      const message = error instanceof Error ? error.message : '启动前应用插件更新失败。'
      await writeTextFile(join(app.getPath('userData'), 'plugin-update.log'), ` ${message}\n`, 'utf8').catch(() => undefined)

    }
    installDesktopBridge(profileDir, resolveDesktopBridgeDir(runtimeOptions))
    lastSeedOptions = seedOptions
    const runtime = resolveDshRuntime({ ...runtimeOptions, profileDir, desktopRuntimeDir })
    const startOptions = {
      bootstrapPath: resolveDshBootstrap(runtimeOptions),
      ...(pathPrefix === undefined ? {} : { pathPrefix }),
      runtime,
      nodeExecutable,
      environment: {
        DSH_HOME: resolve(profileDir, '..', '..'),
        DSH_PROFILE_DIR: profileDir,
        DSH_PROFILE_NAME: 'web',
        DSH_RUNTIME_DIR: desktopRuntimeDir,
        ...(pnpmEntry === undefined ? {} : { DSH_PNPM_ENTRY: pnpmEntry }),
        ...(profileStoreDir === undefined ? {} : { DSH_PNPM_STORE_DIR: profileStoreDir }),
      },
    }
    lastStartOptions = startOptions
    const started = await startWithProfileSelfRepair({
      profileDir,
      extraDirs: [desktopRuntimeDir],
      start: () => startDsh({
        ...startOptions,
        onUnexpectedExit: handleUnexpectedDshExit,
        onIpcMessage: handleDshIpc,
      }),
    })
    server = started.result
    if (started.repaired.length > 0) console.log('已自我修复损坏的插件清单：' + started.repaired.join('、'))
    profileWatcher?.stop()
    profileWatcher = watchProfileActivation(profileDir, () => {
      if (isQuitting || isRecycling) return
      runMainTask(recycleDshForPluginUpdate())
    }, { onError: handleUnexpectedMainError })
    createMainWindow(server.url)
  } catch (error) {
    await reportStartupFailure(error)
  }
}

function resolveStartupHtml(): string | undefined {
  const packaged = join(process.resourcesPath, 'startup.html')
  const dev = join(app.getAppPath(), 'assets', 'startup.html')
  if (existsSync(packaged)) return packaged
  if (existsSync(dev)) return dev
  return undefined
}

let cachedWindowIcon: Electron.NativeImage | undefined

function resolveWindowIconFilePath(): string | undefined {
  return resolveRasterIconPath({
    appPath: app.getAppPath(),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  }) ?? resolveWindowIconPath()
}

function resolveWindowIconImage(): Electron.NativeImage | undefined {
  if (cachedWindowIcon !== undefined && !cachedWindowIcon.isEmpty()) return cachedWindowIcon
  const iconPath = resolveWindowIconFilePath()
  if (iconPath === undefined) return undefined
  const source = nativeImage.createFromPath(iconPath)
  if (source.isEmpty()) return undefined
  const compactSource = source.crop(resolveCompactIconCrop(source.getSize()))
  const icon = nativeImage.createEmpty()
  for (const size of WINDOW_ICON_PIXEL_SIZES) {
    const resized = compactSource.resize({ width: size, height: size, quality: 'best' })
    icon.addRepresentation({
      width: size,
      height: size,
      buffer: resized.toPNG(),
      scaleFactor: 1,
    })
  }
  cachedWindowIcon = icon.isEmpty() ? source : icon
  return cachedWindowIcon
}

function installDesktopFaviconReplacement(): void {
  const iconPath = resolveWindowIconFilePath()
  if (iconPath === undefined) return
  const iconUrl = pathToFileURL(iconPath).href
  protocol.handle('dsh-icon', () => net.fetch(iconUrl))
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    if (!isLoopbackFaviconRequest(details.url)) {
      callback({})
      return
    }
    callback({ redirectURL: 'dsh-icon://app/favicon.ico' })
  })
}

async function showStartupWindow(message: string): Promise<void> {
  const window = mainWindow ??= createWindow()
  const html = resolveStartupHtml()
  window.webContents.stop()
  if (html !== undefined) {
    await window.loadFile(html)
    await window.webContents.executeJavaScript('document.getElementById("msg").textContent = ' + JSON.stringify(message))
    return
  }
  const escaped = message.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
  await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<main style="font-family:sans-serif;padding:48px"><h1>DSH Codex Desktop</h1><p>' + escaped + '</p></main>'))
}

let allowedOrigin = ''

function createMainWindow(serverUrl: string): void {
  allowedOrigin = new URL(serverUrl).origin
  mainWindow ??= createWindow()
  runMainTask(mainWindow.loadURL(serverUrl))
}

async function reportStartupFailure(error: unknown): Promise<void> {
  const logPath = join(app.getPath('userData'), 'startup-error.log')
  const message = error instanceof Error ? error.message : '未知启动错误。'
  await writeTextFile(logPath, message + '\n', 'utf8').catch(() => undefined)
  const short = message.split(/\r?\n/)[0]?.slice(0, 240) ?? '未知启动错误。'
  await showStartupWindow('启动失败：' + short + '\n日志：' + logPath)
}

function handleUnexpectedMainError(error: unknown): void {
  console.error('主进程发生未处理异常。', error)
  if (!app.isReady() || isQuitting || isReportingUnexpectedError) return
  isReportingUnexpectedError = true
  void reportStartupFailure(error)
    .catch(reportError => { console.error('主进程异常报告失败。', reportError) })
    .finally(() => { isReportingUnexpectedError = false })
}

function runMainTask(task: Promise<unknown>): void {
  void task.catch(handleUnexpectedMainError)
}


function handleDshIpc(message: unknown): void {
  if (!isApplyPluginUpdatesIpc(message)) return
  runMainTask(recycleDshForPluginUpdate())
}

async function recycleDshForPluginUpdate(): Promise<void> {
  if (isQuitting || isRecycling || lastStartOptions === undefined || lastSeedOptions === undefined) return
  const startOptions = lastStartOptions
  const seedOptions = lastSeedOptions
  isRecycling = true
  await showStartupWindow('加载中')
  try {
    const current = server
    server = undefined
    await current?.stop()
    const updated = await applyPendingProfileUpdates(seedOptions)
    if (updated.length > 0) console.log('已热更新插件：' + updated.join('、'))
    const started = await startWithProfileSelfRepair({
      profileDir: seedOptions.profileDir,
      extraDirs: seedOptions.desktopRuntimeDir === undefined ? [] : [seedOptions.desktopRuntimeDir],
      start: () => startDsh({
        ...startOptions,
        onUnexpectedExit: handleUnexpectedDshExit,
        onIpcMessage: handleDshIpc,
      }),
    })
    server = started.result
    createMainWindow(server.url)
  } catch (error) {
    await reportStartupFailure(error)
  } finally {
    profileWatcher?.sync()
    isRecycling = false
  }
}

function handleUnexpectedDshExit(message: string): void {
  if (isQuitting || isRecycling) return
  server = undefined
  const missing = parseUnresolvedBundleError(message)
  if (missing !== undefined && lastSeedOptions !== undefined) {
    runMainTask(removeProfileBundle(lastSeedOptions.profileDir, missing).then((removed) => {
      if (removed) runMainTask(recycleDshForPluginUpdate())
    }))
    return
  }
  void writeTextFile(join(app.getPath('userData'), 'startup-error.log'), `${message}\n`, 'utf8').catch(() => undefined)
  runMainTask(showStartupWindow('DSH 已停止运行。请重新启动应用。'))
}

function resolveWindowIconPath(): string | undefined {
  return resolveAppIconPath({
    appPath: app.getAppPath(),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  })
}

function createWindow(): BrowserWindow {
  const windowIcon = resolveWindowIconImage()
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: true,
    ...(windowIcon === undefined ? {} : { icon: windowIcon }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalOpenUrl(url, allowedOrigin)) runMainTask(shell.openExternal(url))
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (isSameOrigin(url, allowedOrigin)) return
    event.preventDefault()
    if (isExternalOpenUrl(url, allowedOrigin)) runMainTask(shell.openExternal(url))
  })
  window.webContents.on('will-redirect', (event, url) => {
    if (isSameOrigin(url, allowedOrigin)) return
    event.preventDefault()
    if (isExternalOpenUrl(url, allowedOrigin)) runMainTask(shell.openExternal(url))
  })
  applyInitialWindowState(window)
  window.on('close', event => {
    if (!shouldHideInsteadOfClose(isQuitting)) return
    event.preventDefault()
    window.hide()
  })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
  })
  return window
}

function configureDesktopUpdater(): void {
  autoUpdater.logger = console
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  const channel = desktopUpdateChannel()
  if (channel !== undefined) {
    autoUpdater.channel = channel
    autoUpdater.allowDowngrade = false
  }
  autoUpdater.on('download-progress', progress => {
    updateStatus = { kind: 'downloading', percent: progress.percent }
    refreshTrayMenu()
  })
  autoUpdater.on('update-downloaded', info => {
    updateStatus = { kind: 'ready', version: info.version }
    refreshTrayMenu()
  })
  autoUpdater.on('error', error => {
    updateStatus = { kind: 'error', message: publicDesktopUpdateError(error) }
    refreshTrayMenu()
  })
}

function createTray(): void {
  if (tray !== undefined) {
    refreshTrayMenu()
    return
  }
  const rasterPath = resolveRasterIconPath({
    appPath: app.getAppPath(),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  })
  const source = rasterPath === undefined ? nativeImage.createEmpty() : nativeImage.createFromPath(rasterPath)
  const icon = source.isEmpty()
    ? nativeImage.createEmpty()
    : source
        .crop(resolveCompactIconCrop(source.getSize()))
        .resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE, quality: 'best' })
  try {
    tray = new Tray(icon)
  } catch {
    return
  }
  tray.setToolTip(DESKTOP_APP_NAME)
  tray.on('click', () => showMainWindow())
  refreshTrayMenu()
}

function refreshTrayMenu(): void {
  if (tray === undefined) return
  const items = buildDesktopTrayItems({
    status: updateStatus,
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
  })
  tray.setContextMenu(Menu.buildFromTemplate(items.map(item => {
    if (item.type === 'separator') return { type: 'separator' }
    return {
      label: item.label,
      enabled: item.enabled,
      click: () => { runMainTask(handleTrayUpdateAction(item.id)) },
    }
  })))
}

async function handleTrayUpdateAction(id: string): Promise<void> {
  if (id === 'show') {
    showMainWindow()
    return
  }
  if (id === 'reload') {
    await recycleDshForPluginUpdate()
    return
  }
  if (id === 'quit') {
    await requestQuit()
    return
  }
  if (id === 'check') {
    await checkDesktopUpdate()
    return
  }
  if (id === 'download') {
    await downloadDesktopUpdate()
    return
  }
  if (id === 'install') {
    await installDesktopUpdate()
  }
}

async function checkDesktopUpdate(): Promise<void> {
  if (!app.isPackaged) {
    await dialog.showMessageBox({
      type: 'info',
      title: DESKTOP_APP_NAME,
      message: '开发态不能检查安装包更新，请使用发布的安装包。',
    })
    return
  }
  updateStatus = { kind: 'checking' }
  refreshTrayMenu()
  try {
    const result = await autoUpdater.checkForUpdates()
    const version = result?.updateInfo.version
    if (version === undefined || version === app.getVersion()) {
      updateStatus = { kind: 'none' }
      refreshTrayMenu()
      await dialog.showMessageBox({
        type: 'info',
        title: DESKTOP_APP_NAME,
        message: '当前已是最新桌面端版本。',
      })
      return
    }
    updateStatus = { kind: 'available', version, releaseNotes: formatDesktopReleaseNotes(result?.updateInfo.releaseNotes) }
    refreshTrayMenu()
    const prompt = await dialog.showMessageBox({
      type: 'question',
      title: DESKTOP_APP_NAME,
      message: desktopUpdatePrompt(updateStatus),
      buttons: ['下载并安装', '取消'],
      defaultId: 0,
      cancelId: 1,
    })
    if (prompt.response === 0) await downloadDesktopUpdate()
  } catch (error) {
    const message = publicDesktopUpdateError(error)
    updateStatus = { kind: 'error', message }
    refreshTrayMenu()
    await dialog.showMessageBox({
      type: 'error',
      title: DESKTOP_APP_NAME,
      message,
    })
  }
}

async function downloadDesktopUpdate(): Promise<void> {
  if (updateStatus.kind !== 'available') return
  const version = updateStatus.version
  updateStatus = { kind: 'downloading', percent: 0 }
  refreshTrayMenu()
  try {
    await autoUpdater.downloadUpdate()
    const ready = { kind: 'ready' as const, version }
    updateStatus = ready
    refreshTrayMenu()
    const prompt = await dialog.showMessageBox({
      type: 'question',
      title: DESKTOP_APP_NAME,
      message: desktopUpdatePrompt(ready),
      buttons: ['现在安装', '稍后'],
      defaultId: 0,
      cancelId: 1,
    })
    if (prompt.response === 0) await installDesktopUpdate()
  } catch (error) {
    const message = publicDesktopUpdateError(error)
    updateStatus = { kind: 'error', message }
    refreshTrayMenu()
    await dialog.showMessageBox({
      type: 'error',
      title: DESKTOP_APP_NAME,
      message,
    })
  }
}

async function installDesktopUpdate(): Promise<void> {
  await shutdownDesktop(() => { autoUpdater.quitAndInstall(false, true) })
}

function showMainWindow(): void {
  if (mainWindow === undefined) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}
