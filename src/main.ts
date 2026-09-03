import { app, BrowserWindow, Menu, Notification, Tray, WebContentsView, dialog, ipcMain, nativeImage, nativeTheme, net, protocol, session, shell, type Input, type MenuItemConstructorOptions, type WebContents } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile as writeTextFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { DESKTOP_APP_NAME, DESKTOP_APP_USER_MODEL_ID, DESKTOP_TOAST_ACTIVATOR_CLSID, resolveDesktopRuntimeDir, resolveDesktopUserDataDir } from './app-identity.js'
import { OFFICIAL_DSH_VERSION } from './bundled-plugins.js'
import { resolveAppIconPath, resolveCompactIconCrop, resolveNotificationIconPath, resolveRasterIconPath, resolveTaskBadgeIconPath, TRAY_ICON_SIZE } from './app-icon.js'
import { WINDOW_ICON_PIXEL_SIZES, isLoopbackFaviconRequest } from './window-icon.js'
import { quitDesktopApp, shouldHideInsteadOfClose } from './app-lifecycle.js'
import type { DshServer, StartDshOptions } from './dsh-process.js'
import { isExternalOpenUrl, isSameOrigin } from './navigation.js'
import { applyPendingProfileUpdates, resolvePnpmStoreDir, seedBundledPlugins, resolveWebProfileDir } from './plugin-seed.js'
import { parseUnresolvedBundleError, removeProfileBundle, startWithProfileSelfRepair } from './profile-repair.js'
import { enterRecoveryMode, getRecoveryStatus, isRecoveryModeActive, leaveRecoveryMode, restoreRecoveryPlugin, uninstallRecoveryPlugin } from './recovery-mode.js'
import { extractPluginFromStartupFailure, trimStartupLogForRecovery } from './recovery-diagnostics.js'
import { advanceStartupDiagnostic, beginStartupDiagnostic, completeStartupDiagnostic, failStartupDiagnostic, parseRendererBootReport, readStartupDiagnostic, suspectedPluginFromRendererReport, type StartupDiagnosticStage } from './startup-diagnostics.js'
import { captureProfileHealthCheckpoint, readProfileHealthCheckpoint, restoreProfileHealthCheckpoint } from './profile-health-checkpoint.js'
import { resolveBundledPluginStore, resolvePluginBinDir } from './plugin-toolchain.js'
import { resolveDshBootstrap, resolveDshRuntime, resolveNodeExecutable } from './runtime.js'
import { extractPackagedRuntimesInChild, packagedRuntimesNeedExtraction, type RuntimeExtractionProgress } from './extract-runtime.js'
import { resolvePrebuiltOfficialRuntime } from './runtime-prebuilt.js'
import { applyInitialWindowState } from './window-state.js'
import { WindowNavigationCoordinator } from './window-navigation.js'
import { escapeRoute } from './escape-routing.js'
import { installDesktopBridge, resolveDesktopBridgeDir } from './desktop-host.js'
import { isChineseLocale, localizedShellActions, localizedShellMenus, normalizeShellLocale, shellActionForShortcut, SHELL_ACTIONS, type ShellActionId, type ShellMenuId } from './shell-actions.js'
import { SHELL_BAR_HEIGHT, SHELL_IPC, type DshNavigationState, type DshShellActionId, type ShellBootstrap, type ShellMenuPopupRequest, type ShellState } from './shell-contract.js'
import { mayAccessDesktopUpdates, mayAccessNotificationPreferences, mayCloseDesktopSettings, mayGetShellBootstrap, mayInvokeShellAction, mayPopupShellMenu, mayReportDshBoot, mayReportDshLocale, mayReportDshNotification, mayReportDshState, mayReportDshTheme, mayReportDshSettingsVisibility, type ShellRendererKind } from './shell-ipc-policy.js'
import { DESKTOP_THEME_PALETTES, normalizeDesktopThemeSnapshot, type DesktopColorScheme, type DesktopThemePreference } from './desktop-theme.js'
import { DSH_MARKET_STATUS_PATH, waitForDshMarketBatchToSettle } from './dshmarket-batch.js'
import { DEFAULT_NOTIFICATION_PREFERENCES, buildWindowsReplyToastXml, loadNotificationPreferences, parseDesktopNotificationBridgeEvent, parseWindowsNotificationReplyActivation, saveNotificationPreferences, shouldShowDesktopNotification, windowsNotificationReplyArguments, type DesktopNotificationEvent, type DesktopNotificationPreferences } from './desktop-notifications.js'
import { watchProfileActivation } from './profile-watch.js'
import updater from 'electron-updater'
import { DEFAULT_UPDATE_PREFERENCES, STARTUP_UPDATE_CHECK_DELAY_MS, buildDesktopTrayItems, desktopUpdateChannel, desktopUpdatePrompt, formatDesktopReleaseNotes, loadUpdatePreferences, publicDesktopUpdateError, saveUpdatePreferences, shouldCheckForUpdatesOnStartup, shouldDownloadUpdateAutomatically, type DesktopUpdateAction, type DesktopUpdatePreferences, type DesktopUpdateSnapshot, type DesktopUpdateStatus } from './desktop-updater.js'

interface DshProcessModule {
  isApplyPluginUpdatesIpc: (message: unknown) => boolean
  startDsh: (options: StartDshOptions) => Promise<DshServer>
}

const dshProcessModule = await import(app.isPackaged
  ? pathToFileURL(join(process.resourcesPath, 'desktop-bridge', 'dsh-process.js')).href
  : './dsh-process.js') as DshProcessModule
const { isApplyPluginUpdatesIpc, startDsh } = dshProcessModule

let mainWindow: BrowserWindow | undefined
let dshView: WebContentsView | undefined
let recoveryView: WebContentsView | undefined
let shortcutsWindow: BrowserWindow | undefined
let aboutWindow: BrowserWindow | undefined
let settingsWindow: BrowserWindow | undefined
let server: DshServer | undefined
let tray: Tray | undefined
let isQuitting = false
let isRecycling = false
let runtimeExtractionAbortController: AbortController | undefined
let runtimeExtractionTask: Promise<void> | undefined
let lastStartOptions: Omit<StartDshOptions, 'onUnexpectedExit' | 'onIpcMessage'> | undefined
let lastSeedOptions: Parameters<typeof applyPendingProfileUpdates>[0] | undefined
let profileWatcher: { stop: () => void; sync: () => void } | undefined
let profileActivationRecyclePending = false
let profileActivationRecycleTask: Promise<void> | undefined
let profileActivationRecycleGeneration = 0
let updateStatus: DesktopUpdateStatus = { kind: 'idle' }
let updatePreferences: DesktopUpdatePreferences = DEFAULT_UPDATE_PREFERENCES
let lastUpdateCheckAt: string | undefined
let startupUpdateTimer: NodeJS.Timeout | undefined
const { autoUpdater } = updater
let isReportingUnexpectedError = false
const windowNavigation = new WindowNavigationCoordinator()
let dshNavigationState: DshNavigationState = { canBack: false, canForward: false, canNextChat: false, canPreviousChat: false }
let notificationPreferences: DesktopNotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
const activeNotifications = new Map<string, Notification>()
let unreadCompletionCount = 0
let activeDshLocale: 'zh' | 'en' | undefined
let activeDshColorScheme: DesktopColorScheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
let activeDshThemePreference: DesktopThemePreference = 'system'
let dshSettingsDialogVisible = false
let recoveryProfileDir: string | undefined
let recoveryFailureMessage: string | undefined
let recoveryFailurePlugin: string | undefined
let startupDiagnosticStage: Exclude<StartupDiagnosticStage, 'healthy'> = 'server-starting'
let rendererHealthTimer: NodeJS.Timeout | undefined
let handlingRendererBootFailure = false
const shellActionIds = new Set<string>(SHELL_ACTIONS.map(action => action.id))

function startupErrorLogPath(profileDir?: string): string {
  return profileDir === undefined
    ? join(app.getPath('userData'), 'startup-error.log')
    : join(profileDir, '.dsh-desktop-startup-error.log')
}

function desktopLocale(): string {
  return activeDshLocale ?? app.getLocale()
}

function desktopText(zh: string, en: string): string {
  return isChineseLocale(desktopLocale()) ? zh : en
}

process.on('uncaughtException', handleUnexpectedMainError)
process.on('unhandledRejection', handleUnexpectedMainError)

app.setName(DESKTOP_APP_NAME)
app.setAppUserModelId(DESKTOP_APP_USER_MODEL_ID)
if (process.platform === 'win32') app.setToastActivatorCLSID(DESKTOP_TOAST_ACTIVATOR_CLSID)
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
      if (startupUpdateTimer !== undefined) clearTimeout(startupUpdateTimer)
      startupUpdateTimer = undefined
      tray?.destroy()
      tray = undefined
      profileWatcher?.stop()
      profileWatcher = undefined
    },
    stopServer: async () => {
      const extraction = runtimeExtractionTask
      runtimeExtractionAbortController?.abort()
      await extraction?.catch(() => undefined)
      const current = server
      server = undefined
      await current?.stop()
    },
    exit,
  })
}

async function startApplication(): Promise<void> {
  await app.whenReady()
  ensureWindowsNotificationIdentity()
  installWindowsNotificationActivationHandler()
  notificationPreferences = await loadNotificationPreferences(notificationPreferencesPath())
  updatePreferences = await loadUpdatePreferences(updatePreferencesPath())
  installShellIpc()
  installRecoveryIpc()
  installDesktopFaviconReplacement()
  Menu.setApplicationMenu(null)
  configureDesktopUpdater()
  createTray()
  await showStartupWindow(desktopText('正在启动', 'Starting'))

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
    const nodeExecutable = resolveNodeExecutable(runtimeOptions)
    if (app.isPackaged) {
      const firstInitialization = packagedRuntimesNeedExtraction(process.resourcesPath, desktopRuntimeDir, extractedStoreDir!)
      if (firstInitialization) {
        await updateStartupMessage(firstInitializationMessage())
        const controller = new AbortController()
        runtimeExtractionAbortController = controller
        const extraction = extractPackagedRuntimesInChild({
          nodeExecutable,
          scriptPath: join(process.resourcesPath, 'extract-runtime.mjs'),
          installDir: dirname(desktopRuntimeDir),
          resourcesDir: process.resourcesPath,
          signal: controller.signal,
          onProgress: progress => { void updateStartupMessage(runtimeExtractionMessage(progress)) },
        })
        runtimeExtractionTask = extraction
        try {
          await extraction
        } finally {
          if (runtimeExtractionTask === extraction) runtimeExtractionTask = undefined
          if (runtimeExtractionAbortController === controller) runtimeExtractionAbortController = undefined
        }
        await updateStartupMessage(desktopText(
          '正在初始化插件和工作区…\n首次启动可能需要 1–3 分钟，请勿关闭应用。',
          'Initializing plugins and workspace…\nThe first launch may take 1–3 minutes. Please keep the app open.',
        ))
      }
    }
    const pluginStoreDir = resolveBundledPluginStore({
      ...runtimeOptions,
      ...(extractedStoreDir === undefined ? {} : { extractedStoreDir }),
    })
    const profileStoreDir = resolvePnpmStoreDir(profileDir, pluginStoreDir)
    const prebuiltRuntimeDir = resolvePrebuiltOfficialRuntime(runtimeOptions)
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
    let started: { result: DshServer; repaired: string[] }
    try {
      await beginDshStartupDiagnostic(profileDir)
      started = await startWithProfileSelfRepair({
        profileDir,
        extraDirs: [desktopRuntimeDir],
        start: () => startDsh({
          ...startOptions,
          onUnexpectedExit: handleUnexpectedDshExit,
          onIpcMessage: handleDshIpc,
        }),
      })
    } catch (error) {
      if (!isQuitting) await reportStartupFailure(error, profileDir)
      return
    }
    server = started.result
    await advanceDshStartupDiagnostic(profileDir, 'server-ready')
    if (started.repaired.length > 0) console.log('已自我修复损坏的插件清单：' + started.repaired.join('、'))
    profileWatcher?.stop()
    profileWatcher = watchProfileActivation(profileDir, scheduleProfileActivationRecycle, { onError: handleUnexpectedMainError })
    if (isRecoveryModeActive(profileDir)) await showRecoveryWindow(profileDir)
    else await createMainWindow(server.url)
    const smokeReadyFile = process.env.DSH_DESKTOP_SMOKE_READY_FILE
    if (smokeReadyFile !== undefined && smokeReadyFile !== '') {
      await writeTextFile(smokeReadyFile, 'ready\n', 'utf8')
    }
    scheduleStartupUpdateCheck()
  } catch (error) {
    if (!isQuitting) await reportStartupFailure(error)
  }
}

function resolveStartupHtml(): string | undefined {
  const packaged = join(process.resourcesPath, 'startup.html')
  const dev = join(app.getAppPath(), 'assets', 'startup.html')
  if (existsSync(packaged)) return packaged
  if (existsSync(dev)) return dev
  return undefined
}

function resolveRecoveryHtml(): string | undefined {
  const packaged = join(process.resourcesPath, 'recovery.html')
  const development = join(app.getAppPath(), 'assets', 'recovery.html')
  if (existsSync(packaged)) return packaged
  if (existsSync(development)) return development
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
  const view = requireDshView()
  showDshContentView()
  const html = resolveStartupHtml()
  if (html !== undefined) {
    await windowNavigation.navigate(
      view,
      () => view.webContents.loadFile(html, { query: { theme: activeDshColorScheme } }),
      () => view.webContents.executeJavaScript('document.getElementById("msg").textContent = ' + JSON.stringify(message)),
    )
    return
  }
  const escaped = message.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
  await windowNavigation.navigate(
    view,
    () => view.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<main style="font-family:sans-serif;padding:48px"><h1>DSH Codex Desktop</h1><p>' + escaped + '</p></main>')),
  )
}

async function updateStartupMessage(message: string): Promise<void> {
  const view = requireDshView()
  if (view.webContents.isDestroyed()) return
  await view.webContents.executeJavaScript(`document.getElementById('msg')?.replaceChildren(document.createTextNode(${JSON.stringify(message)}))`)
    .catch(() => undefined)
}

function firstInitializationMessage(): string {
  return desktopText(
    '首次启动，正在准备运行环境…\n可能需要 1–3 分钟，请勿关闭应用。',
    'Preparing the runtime for the first launch…\nThis may take 1–3 minutes. Please keep the app open.',
  )
}

function runtimeExtractionMessage(progress: RuntimeExtractionProgress): string {
  const hint = desktopText('\n首次启动可能需要 1–3 分钟，请勿关闭应用。', '\nThe first launch may take 1–3 minutes. Please keep the app open.')
  if (progress.phase === 'runtime') {
    return desktopText('正在校验并解压 DSH 运行环境…', 'Verifying and extracting the DSH runtime…') + hint
  }
  return desktopText('正在准备内置插件仓库…', 'Preparing the bundled plugin store…') + hint
}

let allowedOrigin = ''

async function createMainWindow(serverUrl: string): Promise<void> {
  allowedOrigin = new URL(serverUrl).origin
  mainWindow ??= createWindow()
  const view = requireDshView()
  const profileDir = lastSeedOptions?.profileDir
  if (profileDir !== undefined) {
    await advanceDshStartupDiagnostic(profileDir, 'renderer-loading')
    startRendererHealthTimer(profileDir)
  }
  showDshContentView()
  await windowNavigation.navigate(view, () => view.webContents.loadURL(serverUrl))
}

function startupDiagnosticPath(profileDir: string): string {
  return join(profileDir, '.dsh-desktop-startup-diagnostics.json')
}

async function beginDshStartupDiagnostic(profileDir: string): Promise<void> {
  startupDiagnosticStage = 'server-starting'
  await beginStartupDiagnostic(startupDiagnosticPath(profileDir), startupDiagnosticStage).catch(error => {
    console.error('无法记录 DSH 启动诊断。', error)
  })
}

async function advanceDshStartupDiagnostic(profileDir: string, stage: Exclude<StartupDiagnosticStage, 'healthy'>): Promise<void> {
  startupDiagnosticStage = stage
  await advanceStartupDiagnostic(startupDiagnosticPath(profileDir), stage).catch(error => {
    console.error('无法更新 DSH 启动诊断。', error)
  })
}

function stopRendererHealthTimer(): void {
  if (rendererHealthTimer !== undefined) clearTimeout(rendererHealthTimer)
  rendererHealthTimer = undefined
}

function startRendererHealthTimer(profileDir: string): void {
  stopRendererHealthTimer()
  rendererHealthTimer = setTimeout(() => {
    rendererHealthTimer = undefined
    void handleRendererBootReport({ status: 'failed', plugins: [], error: 'DSH 页面未能在 30 秒内完成插件加载。' }, profileDir, 'renderer-timeout')
  }, 30_000)
  rendererHealthTimer.unref()
}

async function handleRendererBootReport(value: unknown, profileDir = lastSeedOptions?.profileDir, source: 'renderer' | 'renderer-timeout' = 'renderer'): Promise<void> {
  const report = parseRendererBootReport(value)
  if (report === undefined || profileDir === undefined) return
  stopRendererHealthTimer()
  if (report.status === 'healthy') {
    await completeStartupDiagnostic(startupDiagnosticPath(profileDir)).catch(error => {
      console.error('无法保存 DSH 健康启动证据。', error)
    })
    await captureProfileHealthCheckpoint(profileDir).catch(error => {
      console.error('无法保存 DSH 健康配置检查点。', error)
    })
    return
  }
  if (handlingRendererBootFailure || isQuitting || isRecycling) return
  handlingRendererBootFailure = true
  const plugins = report.plugins ?? []
  const suspectedPlugin = suspectedPluginFromRendererReport(report)
  const message = report.error ?? (plugins.length === 0
    ? 'DSH 客户端未能完成插件加载。'
    : `以下插件未能加载：${plugins.join('、')}。`)
  try {
    await failStartupDiagnostic(startupDiagnosticPath(profileDir), {
      stage: 'renderer-loading',
      source,
      message,
      plugins,
    })
    await writeTextFile(startupErrorLogPath(profileDir), `${message}\n`, 'utf8')
    await showRecoveryWindow(profileDir, { failureMessage: message.slice(0, 240), failurePlugin: suspectedPlugin })
  } catch (error) {
    console.error('无法处理 DSH 客户端启动失败。', error)
  } finally {
    handlingRendererBootFailure = false
  }
}

/**
 * 恢复页与工作台使用不同的内容视图。先在后台完成工作台导航，
 * 再切换可见视图，避免用户看到按钮点击后页面停留在原处。
 */
async function returnToWorkbenchFromRecovery(): Promise<void> {
  const running = server
  if (running === undefined) throw new Error('DSH 尚未成功启动，无法进入工作台。')
  const view = requireDshView()
  const profileDir = recoveryProfileDir
  if (profileDir !== undefined) {
    await advanceDshStartupDiagnostic(profileDir, 'renderer-loading')
    startRendererHealthTimer(profileDir)
  }
  allowedOrigin = new URL(running.url).origin
  await windowNavigation.navigate(view, () => view.webContents.loadURL(running.url))
  showDshContentView()
  mainWindow?.maximize()
  mainWindow?.show()
  mainWindow?.focus()
}

async function showRecoveryWindow(profileDir: string, failure?: { failureMessage?: string, failurePlugin?: string }): Promise<void> {
  stopRendererHealthTimer()
  mainWindow ??= createWindow()
  const window = mainWindow
  window.setMinimumSize(720, 520)
  if (window.isMaximized()) window.unmaximize()
  window.setSize(920, 680)
  window.center()
  const view = requireRecoveryView()
  recoveryProfileDir = profileDir
  if (failure?.failureMessage !== undefined) recoveryFailureMessage = failure.failureMessage
  if (failure?.failurePlugin !== undefined) recoveryFailurePlugin = failure.failurePlugin
  showRecoveryContentView()
  const html = resolveRecoveryHtml()
  if (html === undefined) throw new Error('恢复页面资源缺失。')
  await windowNavigation.navigate(view, () => view.webContents.loadFile(html))
}

async function reportStartupFailure(error: unknown, profileDir?: string): Promise<void> {
  const logPath = startupErrorLogPath(profileDir)
  const message = error instanceof Error ? error.message : '未知启动错误。'
  if (profileDir !== undefined) {
    await failStartupDiagnostic(startupDiagnosticPath(profileDir), {
      stage: startupDiagnosticStage,
      source: 'process',
      message,
      plugins: [],
    }).catch(diagnosticError => { console.error('无法记录 DSH 启动失败。', diagnosticError) })
  }
  await writeTextFile(logPath, message + '\n', 'utf8').catch(() => undefined)
  const short = message.split(/\r?\n/)[0]?.slice(0, 240) ?? '未知启动错误。'
  try {
    if (profileDir !== undefined) await showRecoveryWindow(profileDir, { failureMessage: short, failurePlugin: extractPluginFromStartupFailure(message) })
    else await showStartupWindow(desktopText('启动失败：', 'Startup failed: ') + short + desktopText('\n日志：', '\nLog: ') + logPath)
  } catch (displayError) {
    console.error('显示启动错误页面失败。', displayError)
  }
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
  // dsh-codex-ui uses this IPC after its own update-all flow. It has the
  // same contract as a profile mutation, so letting it bypass the market
  // queue would still interrupt a batch after its first item.
  scheduleProfileActivationRecycle()
}

const DSH_MARKET_BATCH_POLL_MS = 750
const DSH_MARKET_BATCH_MAX_WAIT_MS = 10 * 60 * 1_000

function scheduleProfileActivationRecycle(): void {
  if (isQuitting || isRecycling) return
  profileActivationRecyclePending = true
  profileActivationRecycleGeneration += 1
  if (profileActivationRecycleTask !== undefined) return
  const task = recycleAfterDshMarketBatch()
  profileActivationRecycleTask = task
  runMainTask(task.finally(() => { profileActivationRecycleTask = undefined }))
}

async function dshMarketOperationStatus(): Promise<unknown> {
  const url = server?.url
  if (url === undefined) return undefined
  try {
    const response = await fetch(new URL(DSH_MARKET_STATUS_PATH, url), { signal: AbortSignal.timeout(1_000) })
    if (!response.ok) return undefined
    return await response.json()
  } catch {
    // dshmarket is optional. A missing, stopped, or old market should retain
    // the normal profile-change restart behavior.
    return undefined
  }
}

async function recycleAfterDshMarketBatch(): Promise<void> {
  while (profileActivationRecyclePending && !isQuitting && !isRecycling) {
    profileActivationRecyclePending = false
    const generation = profileActivationRecycleGeneration
    const settled = await waitForDshMarketBatchToSettle(
      dshMarketOperationStatus,
      () => new Promise(resolve => setTimeout(resolve, DSH_MARKET_BATCH_POLL_MS)),
      { maxWaitMs: DSH_MARKET_BATCH_MAX_WAIT_MS, pollIntervalMs: DSH_MARKET_BATCH_POLL_MS },
    )
    if (!settled) console.warn(`dshmarket 批量更新等待超时（${DSH_MARKET_BATCH_MAX_WAIT_MS}ms），继续重载插件。`)
    if (isQuitting || isRecycling) return
    // Another profile change or update-all IPC arrived during the quiet
    // check. Start the check over rather than restarting a just-continued
    // batch from its first completion boundary.
    if (profileActivationRecycleGeneration !== generation) continue
    await recycleDshForPluginUpdate()
  }
}

async function recycleDshForPluginUpdate(): Promise<void> {
  if (isQuitting || isRecycling || lastStartOptions === undefined || lastSeedOptions === undefined) return
  const startOptions = lastStartOptions
  const seedOptions = lastSeedOptions
  isRecycling = true
  broadcastShellState()
  try {
    await showStartupWindow(desktopText('加载中', 'Loading'))
    const current = server
    server = undefined
    await current?.stop()
    const updated = await applyPendingProfileUpdates(seedOptions)
    if (updated.length > 0) console.log('已热更新插件：' + updated.join('、'))
    await beginDshStartupDiagnostic(seedOptions.profileDir)
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
    await advanceDshStartupDiagnostic(seedOptions.profileDir, 'server-ready')
    if (isRecoveryModeActive(seedOptions.profileDir)) await showRecoveryWindow(seedOptions.profileDir)
    else await createMainWindow(server.url)
  } catch (error) {
    await reportStartupFailure(error, seedOptions.profileDir)
  } finally {
    profileWatcher?.sync()
    isRecycling = false
    broadcastShellState()
  }
}

function handleUnexpectedDshExit(message: string): void {
  if (isQuitting || isRecycling) return
  server = undefined
  stopRendererHealthTimer()
  if (lastSeedOptions !== undefined) {
    void failStartupDiagnostic(startupDiagnosticPath(lastSeedOptions.profileDir), {
      stage: startupDiagnosticStage,
      source: 'process',
      message,
      plugins: [],
    }).catch(error => { console.error('无法记录 DSH 异常退出。', error) })
  }
  const missing = parseUnresolvedBundleError(message)
  if (missing !== undefined && lastSeedOptions !== undefined) {
    runMainTask(removeProfileBundle(lastSeedOptions.profileDir, missing).then((removed) => {
      if (removed) runMainTask(recycleDshForPluginUpdate())
    }))
    return
  }
  void writeTextFile(startupErrorLogPath(lastSeedOptions?.profileDir), `${message}\n`, 'utf8').catch(() => undefined)
  runMainTask(showStartupWindow(desktopText('DSH 已停止运行。请重新启动应用。', 'DSH has stopped. Restart the app.')))
}

function resolveWindowIconPath(): string | undefined {
  return resolveAppIconPath({
    appPath: app.getAppPath(),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  })
}

function resolveShellAsset(name: 'shell.html' | 'shortcuts.html' | 'about.html' | 'settings.html'): string {
  const packaged = join(process.resourcesPath, name)
  return existsSync(packaged) ? packaged : join(app.getAppPath(), 'assets', name)
}

function resolvePreload(name: 'shell-preload.cjs' | 'dsh-view-preload.cjs' | 'recovery-preload.cjs'): string {
  return join(app.getAppPath(), 'dist', 'src', name)
}

function requireDshView(): WebContentsView {
  if (dshView === undefined) throw new Error('DSH 内容视图尚未创建。')
  return dshView
}

function requireRecoveryView(): WebContentsView {
  if (recoveryView === undefined) throw new Error('恢复内容视图尚未创建。')
  return recoveryView
}

function showDshContentView(): void {
  if (mainWindow !== undefined && !mainWindow.isDestroyed()) mainWindow.setMinimumSize(960, 640)
  recoveryView?.setVisible(false)
  dshView?.setVisible(true)
}

function showRecoveryContentView(): void {
  dshView?.setVisible(false)
  recoveryView?.setVisible(true)
}

function layoutDshView(window: BrowserWindow): void {
  const bounds = window.getContentBounds()
  dshView?.setBounds({ x: 0, y: SHELL_BAR_HEIGHT, width: bounds.width, height: Math.max(0, bounds.height - SHELL_BAR_HEIGHT) })
}

function layoutRecoveryView(window: BrowserWindow): void {
  const bounds = window.getContentBounds()
  recoveryView?.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
}

function createWindow(): BrowserWindow {
  const windowIcon = resolveWindowIconImage()
  const palette = DESKTOP_THEME_PALETTES[activeDshColorScheme]
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: true,
    title: DESKTOP_APP_NAME,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    // The small Windows non-client edge is painted from this color. Keep it
    // aligned with the title-bar wash instead of leaving a white seam above
    // the CSS gradient.
    backgroundColor: palette.titleBarBackground,
    ...(process.platform === 'darwin' ? {} : { titleBarOverlay: { color: palette.titleBarBackground, symbolColor: palette.titleBarSymbol, height: SHELL_BAR_HEIGHT } }),
    ...(windowIcon === undefined ? {} : { icon: windowIcon }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: resolvePreload('shell-preload.cjs'),
      sandbox: true,
    },
  })
  const view = new WebContentsView({ webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    preload: resolvePreload('dsh-view-preload.cjs'),
    sandbox: true,
  } })
  const recovery = new WebContentsView({ webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    preload: resolvePreload('recovery-preload.cjs'),
    sandbox: true,
  } })
  dshView = view
  recoveryView = recovery
  window.contentView.addChildView(view)
  window.contentView.addChildView(recovery)
  recovery.setVisible(false)
  layoutDshView(window)
  layoutRecoveryView(window)
  window.on('resize', () => { layoutDshView(window); layoutRecoveryView(window) })
  window.on('maximize', () => { layoutDshView(window); layoutRecoveryView(window) })
  window.on('unmaximize', () => { layoutDshView(window); layoutRecoveryView(window) })
  runMainTask(window.loadFile(resolveShellAsset('shell.html'), { query: { theme: activeDshColorScheme } }))

  view.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalOpenUrl(url, allowedOrigin)) runMainTask(shell.openExternal(url))
    return { action: 'deny' }
  })
  view.webContents.on('did-start-navigation', () => { dshSettingsDialogVisible = false })
  view.webContents.on('will-navigate', (event, url) => {
    if (windowNavigation.isNavigating()) {
      event.preventDefault()
      return
    }
    if (isSameOrigin(url, allowedOrigin)) return
    event.preventDefault()
    if (isExternalOpenUrl(url, allowedOrigin)) runMainTask(shell.openExternal(url))
  })
  view.webContents.on('will-redirect', (event, url) => {
    if (isSameOrigin(url, allowedOrigin)) return
    event.preventDefault()
    if (isExternalOpenUrl(url, allowedOrigin)) runMainTask(shell.openExternal(url))
  })
  recovery.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  installShortcutHandler(window.webContents)
  installShortcutHandler(view.webContents)
  applyInitialWindowState(window)
  window.on('enter-full-screen', broadcastShellState)
  window.on('leave-full-screen', broadcastShellState)
  window.on('close', event => {
    if (!shouldHideInsteadOfClose(isQuitting)) return
    event.preventDefault()
    window.hide()
  })
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = undefined
      dshView = undefined
      recoveryView = undefined
      recoveryProfileDir = undefined
      recoveryFailureMessage = undefined
      dshSettingsDialogVisible = false
    }
  })
  return window
}

function currentShellState(): ShellState {
  const window = mainWindow
  const zoomFactor = dshView?.webContents.getZoomFactor() ?? 1
  return {
    ...dshNavigationState,
    fullscreen: window?.isFullScreen() ?? false,
    reloading: isRecycling,
    zoomPercent: Math.round(zoomFactor * 100),
  }
}

function shellBootstrap(): ShellBootstrap {
  const locale = desktopLocale()
  return {
    actions: localizedShellActions(locale, process.platform),
    colorScheme: activeDshColorScheme,
    locale,
    menus: localizedShellMenus(locale),
    platform: process.platform,
    runtimeVersion: OFFICIAL_DSH_VERSION,
    state: currentShellState(),
    version: app.getVersion(),
  }
}

function broadcastShellBootstrap(): void {
  const bootstrap = shellBootstrap()
  for (const window of [mainWindow, shortcutsWindow, aboutWindow, settingsWindow]) {
    if (window !== undefined && !window.isDestroyed()) window.webContents.send(SHELL_IPC.bootstrap, bootstrap)
  }
}

function setWindowBackground(window: BrowserWindow | undefined, color: string): void {
  if (window !== undefined && !window.isDestroyed()) window.setBackgroundColor(color)
}

function applyDesktopTheme(colorScheme: DesktopColorScheme, preference?: DesktopThemePreference): void {
  activeDshColorScheme = colorScheme
  if (preference !== undefined) {
    activeDshThemePreference = preference
    nativeTheme.themeSource = preference
  }
  const palette = DESKTOP_THEME_PALETTES[colorScheme]
  setWindowBackground(mainWindow, palette.titleBarBackground)
  setWindowBackground(settingsWindow, palette.settingsBackground)
  setWindowBackground(shortcutsWindow, palette.shortcutsBackground)
  setWindowBackground(aboutWindow, palette.aboutBackground)
  if (process.platform !== 'darwin' && mainWindow !== undefined && !mainWindow.isDestroyed()) {
    mainWindow.setTitleBarOverlay({ color: palette.titleBarBackground, symbolColor: palette.titleBarSymbol, height: SHELL_BAR_HEIGHT })
  }
}

function broadcastShellState(): void {
  const state = currentShellState()
  for (const window of [mainWindow, shortcutsWindow, aboutWindow, settingsWindow]) {
    if (window !== undefined && !window.isDestroyed()) window.webContents.send(SHELL_IPC.state, state)
  }
}

function desktopUpdateSnapshot(): DesktopUpdateSnapshot {
  return {
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
    status: updateStatus,
    ...(lastUpdateCheckAt === undefined ? {} : { lastCheckedAt: lastUpdateCheckAt }),
  }
}

function broadcastDesktopUpdateState(): void {
  if (settingsWindow !== undefined && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send(SHELL_IPC.desktopUpdateState, desktopUpdateSnapshot())
  }
}

function setDesktopUpdateStatus(status: DesktopUpdateStatus, checked = false): void {
  updateStatus = status
  if (checked) lastUpdateCheckAt = new Date().toISOString()
  refreshTrayMenu()
  broadcastDesktopUpdateState()
}

const RECOVERY_IPC = {
  activate: 'dsh-recovery:activate',
  getStartupLog: 'dsh-recovery:get-startup-log',
  getStatus: 'dsh-recovery:get-status',
  keepIsolated: 'dsh-recovery:keep-isolated',
  restore: 'dsh-recovery:restore',
  restoreHealthyConfig: 'dsh-recovery:restore-healthy-config',
  returnToWorkbench: 'dsh-recovery:return-to-workbench',
  uninstall: 'dsh-recovery:uninstall',
} as const

function requireRecoveryProfile(sender: WebContents): string {
  if (sender !== recoveryView?.webContents) throw new Error('恢复操作仅允许由恢复页面发起。')
  if (recoveryProfileDir === undefined) throw new Error('恢复页面尚未准备完成。')
  return recoveryProfileDir
}

async function recoveryPageStatus(profileDir: string): Promise<object> {
  const status = await getRecoveryStatus(profileDir)
  const diagnostic = await readStartupDiagnostic(startupDiagnosticPath(profileDir))
  const checkpoint = await readProfileHealthCheckpoint(profileDir)
  const suspectedPlugin = status.suspectedPlugin ?? recoveryFailurePlugin
  const failureMessage = recoveryFailureMessage ?? status.failureMessage
  return {
    ...status,
    running: server !== undefined,
    ...(failureMessage === undefined ? {} : { failureMessage }),
    ...(suspectedPlugin === undefined ? {} : { suspectedPlugin }),
    ...(diagnostic === undefined ? {} : { diagnostic }),
    ...(checkpoint === undefined ? {} : { checkpoint }),
  }
}

async function restartDshInRecoveryMode(profileDir: string, destination: 'recovery' | 'workbench' = 'recovery'): Promise<void> {
  if (lastStartOptions === undefined || lastSeedOptions === undefined) throw new Error('恢复环境尚未准备完成。')
  const startOptions = lastStartOptions
  isRecycling = true
  broadcastShellState()
  try {
    const current = server
    server = undefined
    await current?.stop()
    await beginDshStartupDiagnostic(profileDir)
    const started = await startWithProfileSelfRepair({
      profileDir,
      extraDirs: lastSeedOptions.desktopRuntimeDir === undefined ? [] : [lastSeedOptions.desktopRuntimeDir],
      start: () => startDsh({
        ...startOptions,
        onUnexpectedExit: handleUnexpectedDshExit,
        onIpcMessage: handleDshIpc,
      }),
    })
    server = started.result
    allowedOrigin = new URL(server.url).origin
    await advanceDshStartupDiagnostic(profileDir, 'server-ready')
    recoveryFailureMessage = undefined
    if (destination === 'workbench') {
      await returnToWorkbenchFromRecovery()
    } else {
      await showRecoveryWindow(profileDir)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await enterRecoveryMode(profileDir, {
      force: true,
      suspectedPlugin: extractPluginFromStartupFailure(message),
      failureMessage: message,
    })
    await reportStartupFailure(error, profileDir)
    throw error
  } finally {
    profileWatcher?.sync()
    isRecycling = false
    broadcastShellState()
  }
}

function installRecoveryIpc(): void {
  for (const channel of Object.values(RECOVERY_IPC)) ipcMain.removeHandler(channel)
  ipcMain.handle(RECOVERY_IPC.getStatus, async event => recoveryPageStatus(requireRecoveryProfile(event.sender)))
  ipcMain.handle(RECOVERY_IPC.activate, async event => {
    const profileDir = requireRecoveryProfile(event.sender)
    const current = await getRecoveryStatus(profileDir)
    if (!current.active) await enterRecoveryMode(profileDir, {
      suspectedPlugin: recoveryFailurePlugin,
      failureMessage: recoveryFailureMessage,
    })
    await restartDshInRecoveryMode(profileDir)
    return recoveryPageStatus(profileDir)
  })
  ipcMain.handle(RECOVERY_IPC.keepIsolated, async (event, packageName: unknown) => {
    const profileDir = requireRecoveryProfile(event.sender)
    const status = await getRecoveryStatus(profileDir)
    if (typeof packageName !== 'string' || !status.isolated.some(plugin => plugin.packageName === packageName)) {
      throw new Error('只能操作当前隔离的第三方插件。')
    }
    return status
  })
  ipcMain.handle(RECOVERY_IPC.restore, async (event, packageName: unknown) => {
    const profileDir = requireRecoveryProfile(event.sender)
    if (typeof packageName !== 'string') throw new Error('插件名称不合法。')
    await restoreRecoveryPlugin(profileDir, packageName)
    await restartDshInRecoveryMode(profileDir)
    return recoveryPageStatus(profileDir)
  })
  ipcMain.handle(RECOVERY_IPC.uninstall, async (event, packageName: unknown) => {
    const profileDir = requireRecoveryProfile(event.sender)
    if (typeof packageName !== 'string') throw new Error('插件名称不合法。')
    const status = await uninstallRecoveryPlugin(profileDir, packageName)
    if (recoveryFailurePlugin === packageName) recoveryFailurePlugin = undefined
    return status
  })
  ipcMain.handle(RECOVERY_IPC.restoreHealthyConfig, async event => {
    const profileDir = requireRecoveryProfile(event.sender)
    await restoreProfileHealthCheckpoint(profileDir)
    await leaveRecoveryMode(profileDir)
    recoveryFailureMessage = undefined
    recoveryFailurePlugin = undefined
    await restartDshInRecoveryMode(profileDir, 'workbench')
    return recoveryPageStatus(profileDir)
  })
  ipcMain.handle(RECOVERY_IPC.getStartupLog, async event => {
    const profileDir = requireRecoveryProfile(event.sender)
    const content = await readFile(startupErrorLogPath(profileDir), 'utf8').catch(() => '')
    return trimStartupLogForRecovery(content)
  })
  ipcMain.handle(RECOVERY_IPC.returnToWorkbench, async event => {
    requireRecoveryProfile(event.sender)
    await returnToWorkbenchFromRecovery()
  })
}

function installShellIpc(): void {
  ipcMain.removeHandler(SHELL_IPC.getBootstrap)
  ipcMain.removeHandler(SHELL_IPC.action)
  ipcMain.removeHandler(SHELL_IPC.popupMenu)
  ipcMain.removeHandler(SHELL_IPC.getNotificationPreferences)
  ipcMain.removeHandler(SHELL_IPC.updateNotificationPreferences)
  ipcMain.removeHandler(SHELL_IPC.getUpdatePreferences)
  ipcMain.removeHandler(SHELL_IPC.updateUpdatePreferences)
  ipcMain.removeHandler(SHELL_IPC.getDesktopUpdateState)
  ipcMain.removeHandler(SHELL_IPC.desktopUpdateAction)
  ipcMain.removeHandler(SHELL_IPC.closeDesktopSettings)
  ipcMain.handle(SHELL_IPC.getBootstrap, event => {
    if (!mayGetShellBootstrap(shellRendererKind(event.sender))) return
    return shellBootstrap()
  })
  ipcMain.handle(SHELL_IPC.action, (event, id: unknown) => {
    if (typeof id !== 'string' || !shellActionIds.has(id)) return
    const actionId = id as ShellActionId
    if (!mayInvokeShellAction(shellRendererKind(event.sender), actionId)) return
    return executeShellAction(actionId)
  })
  ipcMain.handle(SHELL_IPC.popupMenu, (event, request: ShellMenuPopupRequest) => {
    if (!mayPopupShellMenu(shellRendererKind(event.sender))) return
    return popupShellMenu(request)
  })
  ipcMain.handle(SHELL_IPC.getNotificationPreferences, event => {
    if (!mayAccessNotificationPreferences(shellRendererKind(event.sender))) return
    return notificationPreferences
  })
  ipcMain.handle(SHELL_IPC.updateNotificationPreferences, async (event, value: unknown) => {
    if (!mayAccessNotificationPreferences(shellRendererKind(event.sender))) return
    notificationPreferences = await saveNotificationPreferences(notificationPreferencesPath(), value)
    return notificationPreferences
  })
  ipcMain.handle(SHELL_IPC.getUpdatePreferences, event => {
    if (!mayAccessDesktopUpdates(shellRendererKind(event.sender))) return
    return updatePreferences
  })
  ipcMain.handle(SHELL_IPC.updateUpdatePreferences, async (event, value: unknown) => {
    if (!mayAccessDesktopUpdates(shellRendererKind(event.sender))) return
    updatePreferences = await saveUpdatePreferences(updatePreferencesPath(), value)
    if (shouldDownloadUpdateAutomatically(updatePreferences) && updateStatus.kind === 'available') {
      runMainTask(downloadDesktopUpdate('settings'))
    }
    return updatePreferences
  })
  ipcMain.handle(SHELL_IPC.getDesktopUpdateState, event => {
    if (!mayAccessDesktopUpdates(shellRendererKind(event.sender))) return
    return desktopUpdateSnapshot()
  })
  ipcMain.handle(SHELL_IPC.desktopUpdateAction, async (event, value: unknown) => {
    if (!mayAccessDesktopUpdates(shellRendererKind(event.sender))) return
    if (value !== 'check' && value !== 'download' && value !== 'install') return
    await handleDesktopUpdateSettingsAction(value)
    return desktopUpdateSnapshot()
  })
  ipcMain.handle(SHELL_IPC.closeDesktopSettings, event => {
    if (!mayCloseDesktopSettings(shellRendererKind(event.sender))) return
    settingsWindow?.close()
  })
  ipcMain.removeAllListeners(SHELL_IPC.dshState)
  ipcMain.on(SHELL_IPC.dshState, (event, state: Partial<DshNavigationState>) => {
    if (!mayReportDshState(shellRendererKind(event.sender))) return
    if (typeof state !== 'object' || state === null) return
    dshNavigationState = {
      canBack: state.canBack === true,
      canForward: state.canForward === true,
      canNextChat: state.canNextChat === true,
      canPreviousChat: state.canPreviousChat === true,
    }
    broadcastShellState()
  })
  ipcMain.removeAllListeners(SHELL_IPC.dshBoot)
  ipcMain.on(SHELL_IPC.dshBoot, (event, value: unknown) => {
    if (!mayReportDshBoot(shellRendererKind(event.sender))) return
    runMainTask(handleRendererBootReport(value))
  })
  ipcMain.removeAllListeners(SHELL_IPC.dshLocale)
  ipcMain.on(SHELL_IPC.dshLocale, (event, value: unknown) => {
    if (!mayReportDshLocale(shellRendererKind(event.sender))) return
    const locale = normalizeShellLocale(value)
    if (locale === undefined || locale === activeDshLocale) return
    activeDshLocale = locale
    broadcastShellBootstrap()
    updateUnreadCompletionBadge(unreadCompletionCount)
  })
  ipcMain.removeAllListeners(SHELL_IPC.dshTheme)
  ipcMain.on(SHELL_IPC.dshTheme, (event, value: unknown) => {
    if (!mayReportDshTheme(shellRendererKind(event.sender))) return
    const snapshot = normalizeDesktopThemeSnapshot(value)
    if (snapshot === undefined) return
    const colorSchemeChanged = snapshot.colorScheme !== activeDshColorScheme
    const preferenceChanged = snapshot.preference !== undefined && snapshot.preference !== activeDshThemePreference
    if (!colorSchemeChanged && !preferenceChanged) return
    applyDesktopTheme(snapshot.colorScheme, snapshot.preference)
    if (colorSchemeChanged) broadcastShellBootstrap()
  })
  ipcMain.removeAllListeners(SHELL_IPC.dshSettingsVisibility)
  ipcMain.on(SHELL_IPC.dshSettingsVisibility, (event, value: unknown) => {
    if (!mayReportDshSettingsVisibility(shellRendererKind(event.sender))) return
    dshSettingsDialogVisible = value === true
  })
  ipcMain.removeAllListeners(SHELL_IPC.dshNotification)
  ipcMain.on(SHELL_IPC.dshNotification, (event, value: unknown) => {
    if (!mayReportDshNotification(shellRendererKind(event.sender))) return
    const notificationEvent = parseDesktopNotificationBridgeEvent(value)
    if (notificationEvent === undefined) return
    if (notificationEvent.type === 'badge') {
      updateUnreadCompletionBadge(notificationEvent.count)
      return
    }
    if (notificationEvent.type === 'dismiss') {
      dismissNotificationsForSession(notificationEvent.sessionId)
      return
    }
    if (notificationEvent.type === 'reply-error') {
      showNotificationReplyError(notificationEvent.sessionId)
      return
    }
    showDesktopNotification(notificationEvent)
  })
}

function shellRendererKind(sender: WebContents): ShellRendererKind {
  if (sender === mainWindow?.webContents) return 'main'
  if (sender === shortcutsWindow?.webContents) return 'shortcuts'
  if (sender === aboutWindow?.webContents) return 'about'
  if (sender === settingsWindow?.webContents) return 'settings'
  if (sender === dshView?.webContents) return 'dsh'
  return 'unknown'
}

function isActionEnabled(id: ShellActionId): boolean {
  if (id === 'reload') return !isRecycling && lastStartOptions !== undefined && lastSeedOptions !== undefined
  if (id === 'back') return dshNavigationState.canBack
  if (id === 'forward') return dshNavigationState.canForward
  if (id === 'previous-chat') return dshNavigationState.canPreviousChat
  if (id === 'next-chat') return dshNavigationState.canNextChat
  return true
}

function popupShellMenu(request: ShellMenuPopupRequest): Promise<void> {
  return new Promise(resolve => {
    if (request === null || typeof request !== 'object') { resolve(); return }
    if (!Number.isFinite(request.x) || !Number.isFinite(request.y)) { resolve(); return }
    const window = mainWindow
    if (window === undefined || window.isDestroyed()) { resolve(); return }
    const menuId = request.menu as ShellMenuId
    const actions = localizedShellActions(desktopLocale(), process.platform).filter(action => action.menu === menuId)
    if (actions.length === 0) { resolve(); return }
    const template: MenuItemConstructorOptions[] = []
    let group = actions[0]?.group
    for (const action of actions) {
      if (group !== undefined && action.group !== group) template.push({ type: 'separator' })
      group = action.group
      template.push({
        label: action.label,
        enabled: isActionEnabled(action.id),
        ...(action.acceleratorLabel === undefined ? {} : { accelerator: action.acceleratorLabel }),
        click: () => { runMainTask(Promise.resolve(executeShellAction(action.id))) },
      })
    }
    const menu = Menu.buildFromTemplate(template)
    // `popup`'s callback is not delivered consistently when a native Windows
    // menu is dismissed by clicking its owner window. `menu-will-close` is
    // the close lifecycle event, so resolve from either signal exactly once.
    let settled = false
    const close = (): void => {
      if (settled) return
      settled = true
      resolve()
    }
    menu.once('menu-will-close', close)
    menu.popup({
      window,
      x: Math.round(request.x),
      y: Math.round(request.y),
      callback: close,
    })
  })
}

const DISMISS_DSH_SETTINGS_DIALOG_SCRIPT = `(() => {
  const label = (element) => ((element.getAttribute('aria-label') || '') + ' ' + (element.textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase()
  const dialog = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
    .find((element) => {
      if (element.offsetParent === null) return false
      const titleId = element.getAttribute('aria-labelledby')
      const title = titleId === null ? null : document.getElementById(titleId)
      return title !== null && /^(设置|settings)$/i.test(label(title))
    })
  if (!dialog) return false
  const close = [...dialog.querySelectorAll('button')]
    .find((element) => /^(关闭|close)$/i.test(label(element)))
  if (!close) return false
  close.click()
  return true
})()`

function dismissDshSettingsDialog(): void {
  const contents = dshView?.webContents
  if (contents === undefined || contents.isDestroyed()) return
  void contents.executeJavaScript(DISMISS_DSH_SETTINGS_DIALOG_SCRIPT).catch(() => undefined)
}

function installShortcutHandler(contents: Electron.WebContents): void {
  contents.on('before-input-event', (event, input: Input) => {
    if (input.type !== 'keyDown') return
    const auxiliaryWindow = [shortcutsWindow, aboutWindow, settingsWindow].find(window => window?.webContents === contents)
    const route = escapeRoute({
      key: input.key,
      isAuxiliaryWindow: auxiliaryWindow !== undefined,
      isDesktopSettingsWindow: auxiliaryWindow === settingsWindow,
      isMainShell: contents === mainWindow?.webContents,
      isDshSettingsDialogVisible: dshSettingsDialogVisible,
    })
    if (route === 'close-auxiliary') {
      event.preventDefault()
      auxiliaryWindow?.close()
      return
    }
    if (route === 'dismiss-dsh-settings') {
      event.preventDefault()
      dismissDshSettingsDialog()
      return
    }
    const id = shellActionForShortcut(input, process.platform)
    if (id === undefined || !isActionEnabled(id)) return
    event.preventDefault()
    if (id === 'close-window' && auxiliaryWindow !== undefined) {
      auxiliaryWindow.close()
      return
    }
    runMainTask(Promise.resolve(executeShellAction(id)))
  })
}

function sendDshAction(id: DshShellActionId): void {
  if (dshView !== undefined && !dshView.webContents.isDestroyed()) dshView.webContents.send(SHELL_IPC.dshAction, id)
}

async function executeShellAction(id: ShellActionId): Promise<void> {
  if (!isActionEnabled(id)) return
  const contents = dshView?.webContents
  if (id === 'new-chat' || id === 'open-folder' || id === 'settings' || id === 'toggle-sidebar' || id === 'find' || id === 'previous-chat' || id === 'next-chat' || id === 'back' || id === 'forward') {
    sendDshAction(id)
    return
  }
  if (id === 'close-window') { mainWindow?.hide(); return }
  if (id === 'desktop-settings') { showDesktopSettingsWindow(); return }
  if (id === 'quit') { await requestQuit(); return }
  if (contents === undefined) return
  if (id === 'undo') contents.undo()
  else if (id === 'redo') contents.redo()
  else if (id === 'cut') contents.cut()
  else if (id === 'copy') contents.copy()
  else if (id === 'paste') contents.paste()
  else if (id === 'delete') contents.delete()
  else if (id === 'select-all') contents.selectAll()
  else if (id === 'zoom-in') contents.setZoomFactor(Math.min(2, contents.getZoomFactor() + 0.1))
  else if (id === 'zoom-out') contents.setZoomFactor(Math.max(0.5, contents.getZoomFactor() - 0.1))
  else if (id === 'zoom-reset') contents.setZoomFactor(1)
  else if (id === 'toggle-fullscreen') mainWindow?.setFullScreen(!(mainWindow?.isFullScreen() ?? false))
  else if (id === 'show-shortcuts') showShortcutsWindow()
  else if (id === 'reload') await recycleDshForPluginUpdate()
  else if (id === 'check-updates') await checkDesktopUpdate()
  else if (id === 'whats-new') await shell.openExternal('https://github.com/MichengAI/dsh-codex-desktop/releases')
  else if (id === 'feedback') await shell.openExternal('https://github.com/MichengAI/dsh-codex-desktop/issues/new')
  else if (id === 'about') showAboutWindow()
  broadcastShellState()
}

function notificationPreferencesPath(): string {
  return join(app.getPath('userData'), 'desktop-settings.json')
}

function updatePreferencesPath(): string {
  return join(app.getPath('userData'), 'desktop-update-settings.json')
}

/**
 * Windows resolves a toast's small source icon from a Start Menu shortcut that
 * matches both the running executable and AppUserModelID. Packaged installs get
 * this from electron-builder; isolated test runs need the same registration or
 * Windows falls back to the generic Electron identity shown in the toast header.
 */
function ensureWindowsNotificationIdentity(): void {
  if (process.platform !== 'win32') return
  const notificationIcon = resolveNotificationIconPath({ appPath: app.getAppPath(), isPackaged: app.isPackaged, resourcesPath: process.resourcesPath })
  const shortcutDirectories = [
    join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    process.env.ProgramData === undefined ? undefined : join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ].filter((value): value is string => value !== undefined)
  for (const directory of shortcutDirectories) {
    for (const name of [`${DESKTOP_APP_NAME}.lnk`, `${DESKTOP_APP_NAME} Test.lnk`]) {
      const shortcut = join(directory, name)
      if (!existsSync(shortcut)) continue
      try {
        const details = shell.readShortcutLink(shortcut)
        if (resolve(details.target).toLocaleLowerCase() !== resolve(process.execPath).toLocaleLowerCase()) continue
        shell.writeShortcutLink(shortcut, 'update', {
          target: details.target,
          appUserModelId: DESKTOP_APP_USER_MODEL_ID,
          toastActivatorClsid: DESKTOP_TOAST_ACTIVATOR_CLSID,
          ...(notificationIcon === undefined ? {} : { icon: notificationIcon, iconIndex: 0 }),
        })
      } catch {
        // A stale or protected shortcut must not prevent the desktop app from starting.
      }
    }
  }
  if (app.isPackaged || !process.argv.some(argument => argument.startsWith('--user-data-dir='))) return
  const icon = notificationIcon
  if (icon === undefined) return
  const shortcut = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${DESKTOP_APP_NAME} Test.lnk`)
  const args = process.argv.slice(1)
    .map(argument => /\s|"/.test(argument) ? `"${argument.replaceAll('"', '\\"')}"` : argument)
    .join(' ')
  shell.writeShortcutLink(shortcut, existsSync(shortcut) ? 'replace' : 'create', {
    target: process.execPath,
    args,
    cwd: app.getAppPath(),
    description: `${DESKTOP_APP_NAME} test build`,
    icon,
    iconIndex: 0,
    appUserModelId: DESKTOP_APP_USER_MODEL_ID,
    toastActivatorClsid: DESKTOP_TOAST_ACTIVATOR_CLSID,
  })
}

function sendNotificationReplyToDsh(sessionId: string, text: string): void {
  if (dshView === undefined || dshView.webContents.isDestroyed()) {
    showNotificationReplyError(sessionId)
    return
  }
  dshView.webContents.send(SHELL_IPC.dshNotificationReply, { sessionId, text })
}

function installWindowsNotificationActivationHandler(): void {
  if (process.platform !== 'win32') return
  Notification.handleActivation(details => {
    const reply = parseWindowsNotificationReplyActivation(details)
    if (reply === undefined) return
    sendNotificationReplyToDsh(reply.sessionId, reply.text)
  })
}

function notificationCopy(event: DesktopNotificationEvent): { title: string; body: string } {
  const zh = isChineseLocale(desktopLocale())
  const status = event.kind === 'approval'
    ? (zh ? '需要审批' : 'Approval required')
    : event.kind === 'question'
      ? (zh ? '需要你的输入' : 'Your input is needed')
      : (zh ? '任务已完成' : 'Task completed')
  const title = event.title === undefined ? status : `${status} · ${event.title}`
  if (event.body !== undefined) {
    return { title, body: event.body }
  }
  const task = event.title === undefined
    ? (zh ? 'DeepSeek Harness 任务' : 'DeepSeek Harness task')
    : `“${event.title}”`
  if (event.kind === 'approval') return { title, body: zh ? `${task}正在等待审批` : `${task} is waiting for approval` }
  if (event.kind === 'question') return { title, body: zh ? `${task}正在等待你的回答` : `${task} is waiting for your answer` }
  return { title, body: zh ? `${task}已完成` : `${task} is complete` }
}

function updateUnreadCompletionBadge(count: number): void {
  unreadCompletionCount = count
  if (process.platform === 'win32' && mainWindow !== undefined && !mainWindow.isDestroyed()) {
    if (count === 0) {
      mainWindow.setOverlayIcon(null, '')
    } else {
      const iconPath = resolveTaskBadgeIconPath({ appPath: app.getAppPath(), isPackaged: app.isPackaged, resourcesPath: process.resourcesPath }, count)
      const overlay = nativeImage.createFromPath(iconPath)
      if (!overlay.isEmpty()) {
        const description = isChineseLocale(desktopLocale()) ? `${count} 个已完成任务` : `${count} completed tasks`
        mainWindow.setOverlayIcon(overlay, description)
      }
    }
  } else if (process.platform === 'darwin' || process.platform === 'linux') {
    app.setBadgeCount(count)
  }
  refreshTrayMenu()
}

function dismissNotificationsForSession(sessionId: string): void {
  for (const [id, notification] of activeNotifications) {
    if (!id.endsWith(`:${sessionId}`)) continue
    notification.close()
    activeNotifications.delete(id)
  }
}

function focusMainWindowForNotification(): void {
  showMainWindow()
  if (process.platform !== 'win32' || mainWindow === undefined) return
  mainWindow.setAlwaysOnTop(true)
  mainWindow.focus()
  mainWindow.setAlwaysOnTop(false)
}

function openNotificationSession(sessionId: string): void {
  focusMainWindowForNotification()
  if (dshView !== undefined && !dshView.webContents.isDestroyed()) {
    dshView.webContents.send(SHELL_IPC.dshOpenSession, sessionId)
  }
}

function showNotificationReplyError(sessionId: string): void {
  if (!Notification.isSupported()) return
  const zh = isChineseLocale(desktopLocale())
  const id = `reply-error:${sessionId}`
  activeNotifications.get(id)?.close()
  const notification = new Notification({
    title: zh ? '回复发送失败' : 'Reply not sent',
    body: zh ? '未能将回复发送到这个任务。请打开任务后重试。' : 'The reply could not be sent to this task. Open it and try again.',
    timeoutType: 'never',
  })
  activeNotifications.set(id, notification)
  notification.on('click', () => {
    openNotificationSession(sessionId)
    dismissNotificationsForSession(sessionId)
  })
  notification.on('close', () => {
    if (activeNotifications.get(id) === notification) activeNotifications.delete(id)
  })
  notification.show()
}

function showDesktopNotification(event: DesktopNotificationEvent): void {
  if (!Notification.isSupported()) return
  if (!shouldShowDesktopNotification(event, notificationPreferences, mainWindow?.isFocused() ?? false)) return
  const id = `${event.kind}:${event.sessionId}`
  activeNotifications.get(id)?.close()
  const copy = notificationCopy(event)
  const supportsReply = event.kind !== 'approval' && (process.platform === 'win32' || process.platform === 'darwin')
  const zh = isChineseLocale(desktopLocale())
  const replyPlaceholder = zh ? `回复 ${DESKTOP_APP_NAME}` : `Reply to ${DESKTOP_APP_NAME}`
  const toastId = `dsh-${createHash('sha256').update(id).digest('hex').slice(0, 40)}`
  const notification = new Notification({
    ...copy,
    ...(supportsReply ? {
      hasReply: true,
      replyPlaceholder,
    } : {}),
    ...(supportsReply && process.platform === 'win32' ? {
      id: toastId,
      toastXml: buildWindowsReplyToastXml({
        ...copy,
        id: toastId,
        persistent: event.kind !== 'turn-complete',
        placeholder: replyPlaceholder,
        replyLabel: zh ? '回复' : 'Reply',
        replyArguments: windowsNotificationReplyArguments(event.sessionId),
        closeLabel: zh ? '关闭' : 'Close',
      }),
    } : {}),
    ...(event.kind === 'turn-complete' ? {} : { timeoutType: 'never' }),
  })
  activeNotifications.set(id, notification)
  notification.on('click', () => {
    openNotificationSession(event.sessionId)
    dismissNotificationsForSession(event.sessionId)
  })
  if (supportsReply && process.platform !== 'win32') {
    notification.on('reply', (details, legacyReply) => {
      const text = (details.reply ?? legacyReply).trim().slice(0, 4_000)
      if (text === '') return
      sendNotificationReplyToDsh(event.sessionId, text)
    })
  }
  notification.on('close', () => {
    if (activeNotifications.get(id) === notification) activeNotifications.delete(id)
  })
  notification.show()
}

type DesktopSettingsSection = 'notifications' | 'updates'

function removeNativeWindowMenu(window: BrowserWindow): void {
  if (process.platform === 'darwin') return
  window.setMenu(null)
  window.setMenuBarVisibility(false)
}

function showDesktopSettingsWindow(section: DesktopSettingsSection = 'notifications'): void {
  if (settingsWindow !== undefined && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    settingsWindow.webContents.send(SHELL_IPC.settingsSection, section)
    return
  }
  const window = new BrowserWindow({
    parent: mainWindow,
    width: 760,
    height: 620,
    minWidth: 680,
    minHeight: 540,
    title: desktopText('桌面端设置', 'Desktop Settings'),
    autoHideMenuBar: true,
    backgroundColor: DESKTOP_THEME_PALETTES[activeDshColorScheme].settingsBackground,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: resolvePreload('shell-preload.cjs'), sandbox: true },
  })
  removeNativeWindowMenu(window)
  settingsWindow = window
  window.on('closed', () => { if (settingsWindow === window) settingsWindow = undefined })
  installShortcutHandler(window.webContents)
  window.webContents.once('did-finish-load', () => {
    window.webContents.send(SHELL_IPC.settingsSection, section)
    window.webContents.send(SHELL_IPC.desktopUpdateState, desktopUpdateSnapshot())
  })
  runMainTask(window.loadFile(resolveShellAsset('settings.html'), { query: { theme: activeDshColorScheme } }))
}

function showShortcutsWindow(): void {
  if (shortcutsWindow !== undefined && !shortcutsWindow.isDestroyed()) {
    shortcutsWindow.show(); shortcutsWindow.focus(); return
  }
  const window = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 620,
    height: 650,
    minWidth: 520,
    minHeight: 480,
    title: desktopText('键盘快捷键', 'Keyboard Shortcuts'),
    autoHideMenuBar: true,
    backgroundColor: DESKTOP_THEME_PALETTES[activeDshColorScheme].shortcutsBackground,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: resolvePreload('shell-preload.cjs'), sandbox: true },
  })
  removeNativeWindowMenu(window)
  shortcutsWindow = window
  window.on('closed', () => { if (shortcutsWindow === window) shortcutsWindow = undefined })
  installShortcutHandler(window.webContents)
  runMainTask(window.loadFile(resolveShellAsset('shortcuts.html'), { query: { theme: activeDshColorScheme } }))
}

function showAboutWindow(): void {
  if (aboutWindow !== undefined && !aboutWindow.isDestroyed()) {
    aboutWindow.show()
    aboutWindow.focus()
    return
  }
  const icon = resolveWindowIconImage()
  const window = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 560,
    height: 680,
    minWidth: 560,
    minHeight: 680,
    maxWidth: 560,
    maxHeight: 680,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: desktopText(`关于 ${DESKTOP_APP_NAME}`, `About ${DESKTOP_APP_NAME}`),
    autoHideMenuBar: true,
    backgroundColor: DESKTOP_THEME_PALETTES[activeDshColorScheme].aboutBackground,
    ...(icon === undefined ? {} : { icon }),
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: resolvePreload('shell-preload.cjs'), sandbox: true },
  })
  removeNativeWindowMenu(window)
  aboutWindow = window
  window.on('closed', () => { if (aboutWindow === window) aboutWindow = undefined })
  installShortcutHandler(window.webContents)
  runMainTask(window.loadFile(resolveShellAsset('about.html'), { query: { theme: activeDshColorScheme } }))
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
    setDesktopUpdateStatus({ kind: 'downloading', percent: progress.percent })
  })
  autoUpdater.on('update-downloaded', info => {
    setDesktopUpdateStatus({ kind: 'ready', version: info.version })
  })
  autoUpdater.on('error', error => {
    setDesktopUpdateStatus({ kind: 'error', message: publicDesktopUpdateError(error, desktopLocale()) })
  })
}

function scheduleStartupUpdateCheck(): void {
  if (startupUpdateTimer !== undefined || !shouldCheckForUpdatesOnStartup(updatePreferences, app.isPackaged)) return
  startupUpdateTimer = setTimeout(() => {
    startupUpdateTimer = undefined
    if (!isQuitting && shouldCheckForUpdatesOnStartup(updatePreferences, app.isPackaged)) {
      runMainTask(checkDesktopUpdate('background'))
    }
  }, STARTUP_UPDATE_CHECK_DELAY_MS)
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
  tray.on('click', () => showMainWindow())
  refreshTrayMenu()
}

function refreshTrayMenu(): void {
  if (tray === undefined) return
  const badgeSuffix = unreadCompletionCount > 0
    ? (isChineseLocale(desktopLocale()) ? ` · ${unreadCompletionCount} 个已完成任务` : ` · ${unreadCompletionCount} completed tasks`)
    : ''
  tray.setToolTip(DESKTOP_APP_NAME + badgeSuffix)
  const items = buildDesktopTrayItems({
    status: updateStatus,
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
    locale: desktopLocale(),
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

type DesktopUpdateInteraction = 'interactive' | 'background' | 'settings'

async function checkDesktopUpdate(interaction: DesktopUpdateInteraction = 'interactive'): Promise<void> {
  if (updateStatus.kind === 'checking' || updateStatus.kind === 'downloading') return
  if (!app.isPackaged) {
    if (interaction === 'interactive') {
      await dialog.showMessageBox({
        type: 'info',
        title: DESKTOP_APP_NAME,
        message: desktopText('开发态不能检查安装包更新，请使用发布的安装包。', 'Update checks are unavailable in development builds. Use a released installer.'),
      })
    }
    return
  }
  setDesktopUpdateStatus({ kind: 'checking' })
  try {
    const result = await autoUpdater.checkForUpdates()
    const version = result?.updateInfo.version
    if (version === undefined || version === app.getVersion()) {
      setDesktopUpdateStatus({ kind: 'none' }, true)
      dismissDesktopUpdateNotification()
      if (interaction === 'interactive') {
        await dialog.showMessageBox({
          type: 'info',
          title: DESKTOP_APP_NAME,
          message: desktopText('当前已是最新桌面端版本。', 'You already have the latest desktop version.'),
        })
      }
      return
    }
    const available: Extract<DesktopUpdateStatus, { kind: 'available' }> = { kind: 'available', version, releaseNotes: formatDesktopReleaseNotes(result?.updateInfo.releaseNotes) }
    setDesktopUpdateStatus(available, true)
    if (interaction === 'background') {
      if (shouldDownloadUpdateAutomatically(updatePreferences)) await downloadDesktopUpdate('background')
      else showDesktopUpdateNotification('available', version)
      return
    }
    if (interaction === 'settings') return
    const prompt = await dialog.showMessageBox({
      type: 'question',
      title: DESKTOP_APP_NAME,
      message: desktopUpdatePrompt(available, desktopLocale()),
      buttons: [desktopText('下载并安装', 'Download and Install'), desktopText('取消', 'Cancel')],
      defaultId: 0,
      cancelId: 1,
    })
    if (prompt.response === 0) await downloadDesktopUpdate('interactive')
  } catch (error) {
    const message = publicDesktopUpdateError(error, desktopLocale())
    setDesktopUpdateStatus({ kind: 'error', message }, true)
    if (interaction === 'interactive') {
      await dialog.showMessageBox({
        type: 'error',
        title: DESKTOP_APP_NAME,
        message,
      })
    }
  }
}

async function downloadDesktopUpdate(interaction: DesktopUpdateInteraction = 'interactive'): Promise<void> {
  if (updateStatus.kind !== 'available') return
  const version = updateStatus.version
  setDesktopUpdateStatus({ kind: 'downloading', percent: 0 })
  try {
    await autoUpdater.downloadUpdate()
    const ready = { kind: 'ready' as const, version }
    setDesktopUpdateStatus(ready)
    if (interaction === 'background') {
      showDesktopUpdateNotification('ready', version)
      return
    }
    if (interaction === 'settings') return
    const prompt = await dialog.showMessageBox({
      type: 'question',
      title: DESKTOP_APP_NAME,
      message: desktopUpdatePrompt(ready, desktopLocale()),
      buttons: [desktopText('现在安装', 'Install Now'), desktopText('稍后', 'Later')],
      defaultId: 0,
      cancelId: 1,
    })
    if (prompt.response === 0) await installDesktopUpdate()
  } catch (error) {
    const message = publicDesktopUpdateError(error, desktopLocale())
    setDesktopUpdateStatus({ kind: 'error', message })
    if (interaction === 'interactive') {
      await dialog.showMessageBox({
        type: 'error',
        title: DESKTOP_APP_NAME,
        message,
      })
    }
  }
}

async function handleDesktopUpdateSettingsAction(action: DesktopUpdateAction): Promise<void> {
  if (action === 'check') await checkDesktopUpdate('settings')
  else if (action === 'download') await downloadDesktopUpdate('settings')
  else await installDesktopUpdate()
}

const DESKTOP_UPDATE_NOTIFICATION_ID = 'desktop-update'

function dismissDesktopUpdateNotification(): void {
  activeNotifications.get(DESKTOP_UPDATE_NOTIFICATION_ID)?.close()
  activeNotifications.delete(DESKTOP_UPDATE_NOTIFICATION_ID)
}

function showDesktopUpdateNotification(kind: 'available' | 'ready', version: string): void {
  if (!Notification.isSupported()) return
  dismissDesktopUpdateNotification()
  const icon = resolveNotificationIconPath({ appPath: app.getAppPath(), isPackaged: app.isPackaged, resourcesPath: process.resourcesPath })
  const notification = new Notification({
    title: DESKTOP_APP_NAME,
    body: kind === 'ready'
      ? desktopText(`桌面端 ${version} 已下载，点击选择安装时间。`, `Desktop ${version} is ready. Click to choose when to install.`)
      : desktopText(`发现桌面端 ${version}，点击查看更新。`, `Desktop ${version} is available. Click to review the update.`),
    ...(icon === undefined ? {} : { icon }),
  })
  activeNotifications.set(DESKTOP_UPDATE_NOTIFICATION_ID, notification)
  notification.on('click', () => {
    showDesktopSettingsWindow('updates')
    dismissDesktopUpdateNotification()
  })
  notification.on('close', () => {
    if (activeNotifications.get(DESKTOP_UPDATE_NOTIFICATION_ID) === notification) activeNotifications.delete(DESKTOP_UPDATE_NOTIFICATION_ID)
  })
  notification.show()
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
