import { app, BrowserWindow, Menu, Notification, Tray, WebContentsView, dialog, ipcMain, nativeImage, nativeTheme, net, protocol, session, shell, type Input, type MenuItemConstructorOptions, type WebContents } from 'electron'
import { installPetWindow } from './pet-window.js'
import { existsSync } from 'node:fs'
import { release as osRelease } from 'node:os'
import { readFile, writeFile as writeTextFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { DESKTOP_APP_NAME, DESKTOP_APP_USER_MODEL_ID, DESKTOP_TOAST_ACTIVATOR_CLSID, resolveDesktopRuntimeDir, resolveDesktopUserDataDir } from './app-identity.js'
import { OFFICIAL_DSH_VERSION } from './bundled-plugins.js'
import { resolveAppIconPath, resolveCompactIconCrop, resolveNotificationIconPath, resolveRasterIconPath, resolveTaskBadgeIconPath, TRAY_ICON_SIZE } from './app-icon.js'
import { WINDOW_ICON_PIXEL_SIZES, isLoopbackFaviconRequest } from './window-icon.js'
import { clearPreviousDshAuthCookies } from './desktop-auth-cookies.js'
import { quitDesktopApp, shouldHideInsteadOfClose } from './app-lifecycle.js'
import { DSH_RENDERER_LOAD_TIMEOUT_MS, DSH_RENDERER_TIMEOUT_GRACE_MS, type DshServer, type StartDshOptions } from './dsh-process.js'
import { installAccountLoginOpener } from './account-login.js'
import { isExternalOpenUrl, isSameOrigin } from './navigation.js'
import { applyPendingProfileUpdates, resolvePnpmStoreDir, seedBundledPlugins, resolveWebProfileDir } from './plugin-seed.js'
import { parseUnresolvedBundleError, removeProfileBundle, startAfterPluginUpdates, startWithProfileSelfRepair } from './profile-repair.js'
import { confirmRecoveryStartup, enterRecoveryMode, getRecoveryStatus, isRecoveryModeActive, leaveRecoveryMode, restoreRecoveryPlugin, tryAutoLeaveRecoveryMode, uninstallRecoveryPlugin } from './recovery-mode.js'
import { findRecoveryCandidates, trimStartupLogForRecovery } from './recovery-diagnostics.js'
import { advanceStartupDiagnostic, beginStartupDiagnostic, completeStartupDiagnostic, failStartupDiagnostic, noteStartupDiagnostic, parseRendererBootReport, readStartupDiagnostic, type StartupDiagnosticStage } from './startup-diagnostics.js'
import { captureProfileHealthCheckpoint, readProfileHealthCheckpoint, restoreProfileHealthCheckpoint } from './profile-health-checkpoint.js'
import { resolveBundledPluginStore, resolvePluginBinDir } from './plugin-toolchain.js'
import { resolveDshBootstrap, resolveDshRuntime, resolveNodeExecutable } from './runtime.js'
import { extractPackagedRuntimesInChild, packagedRuntimesNeedExtraction, type RuntimeExtractionProgress } from './extract-runtime.js'
import { formatStartupProgress, type StartupProgress } from './startup-progress.js'
import { resolvePrebuiltOfficialRuntime } from './runtime-prebuilt.js'
import { applyInitialWindowState } from './window-state.js'
import { WindowNavigationCoordinator } from './window-navigation.js'
import { escapeRoute } from './escape-routing.js'
import { prepareDesktopBridge, resolveDesktopBridgeDir } from './desktop-host.js'
import { migrateDesktopBridgeProfile } from './desktop-bridge-migration.js'
import { isChineseLocale, localizedShellActions, localizedShellMenus, normalizeShellLocale, shellActionForShortcut, SHELL_ACTIONS, type ShellActionId, type ShellMenuId, type SupportedShellLocale } from './shell-actions.js'
import { SHELL_BAR_HEIGHT, SHELL_IPC, type DshNavigationState, type DshShellActionId, type ShellBootstrap, type ShellMenuPopupRequest, type ShellState } from './shell-contract.js'
import { mayAccessDesktopUpdates, mayAccessNotificationPreferences, mayCloseDesktopSettings, mayGetShellBootstrap, mayInvokeShellAction, mayPopupShellMenu, mayReportDshBoot, mayReportDshLocale, mayReportDshNotification, mayReportDshState, mayReportDshTheme, mayReportDshSettingsVisibility, type ShellRendererKind } from './shell-ipc-policy.js'
import { DESKTOP_THEME_PALETTES, normalizeDesktopThemeSnapshot, supportsNativeBackdrop, type DesktopColorScheme, type DesktopThemePreference } from './desktop-theme.js'
import { DSH_MARKET_STATUS_PATH, isDshMarketOperationBusy } from './dshmarket-batch.js'
import { isPluginOperationActive, waitForProfileQuiet } from './profile-quiet.js'
import { waitForPluginReloadReady } from './profile-reload.js'
import { DEFAULT_NOTIFICATION_PREFERENCES, buildWindowsReplyToastXml, loadNotificationPreferences, parseDesktopNotificationBridgeEvent, parseWindowsNotificationReplyActivation, saveNotificationPreferences, shouldShowDesktopNotification, windowsNotificationReplyArguments, type DesktopNotificationEvent, type DesktopNotificationPreferences } from './desktop-notifications.js'
import { watchProfileActivation } from './profile-watch.js'
import updater from 'electron-updater'
import { DEFAULT_UPDATE_PREFERENCES, STARTUP_UPDATE_CHECK_DELAY_MS, buildDesktopTrayItems, canInstallDesktopUpdateInPlace, desktopArchiveDownloadUrl, desktopArchiveUpdatePrompt, desktopUpdateChannel, desktopUpdatePrompt, formatDesktopReleaseNotes, loadUpdatePreferences, publicDesktopUpdateError, saveUpdatePreferences, shouldCheckForUpdatesOnStartup, shouldDownloadUpdateAutomatically, type DesktopUpdateAction, type DesktopUpdatePreferences, type DesktopUpdateSnapshot, type DesktopUpdateStatus } from './desktop-updater.js'

interface DshProcessModule {
  isApplyPluginUpdatesIpc: (message: unknown) => boolean
  startDsh: (options: StartDshOptions) => Promise<DshServer>
}

const dshProcessModule = await import(app.isPackaged
  ? pathToFileURL(join(process.resourcesPath, 'desktop-bridge', 'dsh-process.js')).href
  : './dsh-process.js') as DshProcessModule
const { isApplyPluginUpdatesIpc, startDsh } = dshProcessModule

const nativeBackdropEnabled = supportsNativeBackdrop(process.platform, osRelease())
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
let activeDshLocale: SupportedShellLocale | undefined
let activeDshColorScheme: DesktopColorScheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
let activeDshThemePreference: DesktopThemePreference = 'system'
let dshSettingsDialogVisible = false
let recoveryProfileDir: string | undefined
let recoveryFailureMessage: string | undefined
let recoveryFailurePlugin: string | undefined
let recoveryFailurePlugins: string[] = []
let startupDiagnosticStage: Exclude<StartupDiagnosticStage, 'healthy'> = 'server-starting'
let rendererHealthTimer: NodeJS.Timeout | undefined
let rendererTimeoutGraceTimer: NodeJS.Timeout | undefined
let handlingRendererBootFailure = false
let startupFailurePresented = false
const shellActionIds = new Set<string>(SHELL_ACTIONS.map(action => action.id))

function startupErrorLogPath(profileDir?: string): string {
  return profileDir === undefined
    ? join(app.getPath('userData'), 'startup-error.log')
    : join(profileDir, '.dsh-desktop-startup-error.log')
}

function desktopLocale(): string {
  return activeDshLocale ?? app.getLocale()
}

function activeShellLocale(): SupportedShellLocale {
  return normalizeShellLocale(desktopLocale()) ?? (isChineseLocale(desktopLocale()) ? 'zh' : 'en')
}

const DESKTOP_COMMON_TEXT: Record<string, Partial<Record<SupportedShellLocale, string>>> = {
  '桌面端设置': { ja: 'デスクトップ設定', es: 'Configuración de escritorio', fr: 'Paramètres du bureau', de: 'Desktop-Einstellungen', ru: 'Настройки приложения', pt: 'Configurações do aplicativo' },
  '键盘快捷键': { ja: 'キーボードショートカット', es: 'Atajos de teclado', fr: 'Raccourcis clavier', de: 'Tastaturkurzbefehle', ru: 'Сочетания клавиш', pt: 'Atalhos de teclado' },
  '正在启动': { ja: '起動中', es: 'Iniciando', fr: 'Démarrage en cours', de: 'Wird gestartet', ru: 'Запуск', pt: 'Iniciando' },
  '加载中': { ja: '読み込み中', es: 'Cargando', fr: 'Chargement en cours', de: 'Wird geladen', ru: 'Загрузка', pt: 'Carregando' },
  '取消': { ja: 'キャンセル', es: 'Cancelar', fr: 'Annuler', de: 'Abbrechen', ru: 'Отмена', pt: 'Cancelar' },
  '现在安装': { ja: '今すぐインストール', es: 'Instalar ahora', fr: 'Installer maintenant', de: 'Jetzt installieren', ru: 'Установить сейчас', pt: 'Instalar agora' },
  '稍后': { ja: '後で', es: 'Más tarde', fr: 'Plus tard', de: 'Später', ru: 'Позже', pt: 'Mais tarde' },
  '下载压缩包': { ja: 'Zip をダウンロード', es: 'Descargar zip', fr: 'Télécharger le zip', de: 'Zip herunterladen', ru: 'Скачать zip', pt: 'Baixar zip' },
  '下载并安装': { ja: 'ダウンロードしてインストール', es: 'Descargar e instalar', fr: 'Télécharger et installer', de: 'Herunterladen und installieren', ru: 'Скачать и установить', pt: 'Baixar e instalar' },
  '继续启动': { ja: '起動を続行', es: 'Continuar inicio', fr: 'Poursuivre le démarrage', de: 'Start fortsetzen', ru: 'Продолжить запуск', pt: 'Continuar inicialização' },
  'DSH 加载失败：': { ja: 'DSH の読み込みに失敗しました：', es: 'Error al cargar DSH: ', fr: 'Échec du chargement de DSH : ', de: 'DSH konnte nicht geladen werden: ', ru: 'Не удалось загрузить DSH: ', pt: 'Falha ao carregar DSH: ' },
  '启动失败：': { ja: '起動に失敗しました：', es: 'Error de inicio: ', fr: 'Échec du démarrage : ', de: 'Start fehlgeschlagen: ', ru: 'Сбой запуска: ', pt: 'Falha na inicialização: ' },
  '\n日志：': { ja: '\nログ：', es: '\nRegistro: ', fr: '\nJournal : ', de: '\nProtokoll: ', ru: '\nЖурнал: ', pt: '\nLog: ' },
  '当前已是最新桌面端版本。': { ja: '現在最新のデスクトップ版を使用しています。', es: 'Ya tienes la versión más reciente.', fr: 'Vous disposez déjà de la version la plus récente.', de: 'Sie verwenden bereits die neueste Version.', ru: 'У вас установлена последняя версия.', pt: 'Você já possui a versão mais recente.' },
  '开发态不能检查安装包更新，请使用发布的安装包。': {
    ja: '開発環境ではインストーラー更新の確認は利用できません。リリース版をご利用ください。',
    es: 'La búsqueda de actualizaciones no está disponible en versiones de desarrollo. Usa un instalador publicado.',
    fr: 'Les vérifications de mise à jour ne sont pas disponibles en développement. Utilisez un programme d\'installation publié.',
    de: 'Update-Prüfungen sind in Entwicklungsversionen nicht verfügbar. Bitte ein veröffentlichtes Installationsprogramm verwenden.',
    ru: 'Проверка обновлений недоступна в сборках для разработки. Используйте официальный установщик.',
    pt: 'A verificação de atualizações não está disponível em versões de desenvolvimento. Use um instalador lançado.',
  },
  '正在校验并解压 DSH 运行环境…': {
    ja: 'DSH 実行環境を検証および展開中…',
    es: 'Verificando y extrayendo el entorno de ejecución de DSH…',
    fr: 'Vérification et extraction de l\'environnement d\'exécution DSH…',
    de: 'DSH-Laufzeitumgebung wird überprüft und entpackt…',
    ru: 'Проверка и распаковка среды выполнения DSH…',
    pt: 'Verificando e extraindo o ambiente de execução do DSH…',
  },
  '正在准备内置插件仓库…': {
    ja: '内蔵プラグインストアを準備中…',
    es: 'Preparando el almacén de complementos integrado…',
    fr: 'Préparation du magasin d\'extensions intégré…',
    de: 'Integriertes Plugin-Repository wird vorbereitet…',
    ru: 'Подготовка встроенного хранилища плагинов…',
    pt: 'Preparando o repositório de extensões integrado…',
  },
  '\n首次启动可能需要 1–3 分钟，请勿关闭应用。': {
    ja: '\n初回起動には 1〜3 分かかる場合があります。アプリを閉じないでください。',
    es: '\nEl primer inicio puede tardar entre 1 y 3 minutos. No cierres la aplicación.',
    fr: '\nLe premier lancement peut prendre 1 à 3 minutes. Veuillez ne pas fermer l\'application.',
    de: '\nDer erste Start kann 1–3 Minuten dauern. Bitte schließen Sie die Anwendung nicht.',
    ru: '\nПервый запуск может занять 1–3 минуты. Пожалуйста, не закрывайте приложение.',
    pt: '\nA primeira inicialização pode levar de 1 a 3 minutos. Por favor, não feche o aplicativo.',
  },
  '正在检查配套插件': { ja: '付属プラグインを確認中', es: 'Comprobando complementos incluidos', fr: 'Vérification des extensions incluses', de: 'Enthaltene Plugins werden geprüft', ru: 'Проверка встроенных плагинов', pt: 'Verificando extensões incluídas' },
  '正在检查待应用的插件更新': { ja: '保留中のプラグイン更新を確認中', es: 'Comprobando actualizaciones pendientes', fr: 'Vérification des mises à jour en attente', de: 'Ausstehende Plugin-Updates werden geprüft', ru: 'Проверка ожидающих обновлений', pt: 'Verificando atualizações pendentes' },
  'DSH 已停止运行。请重新启动应用。': { ja: 'DSH が停止しました。アプリを再起動してください。', es: 'DSH se ha detenido. Reinicia la aplicación.', fr: "DSH s'est arrêté. Veuillez redémarrer l'application.", de: 'DSH wurde angehalten. Bitte die App neu starten.', ru: 'DSH остановлен. Перезапустите приложение.', pt: 'O DSH parou de funcionar. Reinicie o aplicativo.' },
  '内置插件更新未完成': { ja: '内蔵プラグインの更新が未完了です', es: 'Actualización de complementos incompletos', fr: 'Mise à jour des extensions intégrées incomplète', de: 'Aktualisierung der integrierten Plugins unvollständig', ru: 'Обновление встроенных плагинов не завершено', pt: 'Atualização de extensões integradas incompleta' },
  '插件更新未完成': { ja: 'プラグインの更新が未完了です', es: 'Actualización de complementos incompleta', fr: 'Mise à jour des extensions incomplète', de: 'Plugin-Aktualisierung unvollständig', ru: 'Обновление плагинов не завершено', pt: 'Atualização de extensões incompleta' },
  '未能安装此桌面版本配套的插件。': { ja: 'このデスクトップ版に付属するプラグインをインストールできませんでした。', es: 'No se pudieron instalar los complementos incluidos con esta versión.', fr: 'Impossible d\'installer les extensions fournies avec cette version.', de: 'Die mit dieser Version gebündelten Plugins konnten nicht installiert werden.', ru: 'Не удалось установить плагины из комплекта этой версии.', pt: 'Não foi possível instalar as extensões incluídas nesta versão.' },
  '未能应用等待安装的插件更新。': { ja: '保留中のプラグイン更新を適用できませんでした。', es: 'No se pudieron aplicar las actualizaciones de complementos pendientes.', fr: 'Impossible d\'appliquer les mises à jour d\'extensions en attente.', de: 'Ausstehende Plugin-Updates konnten nicht angewendet werden.', ru: 'Не удалось применить ожидающие обновления плагинов.', pt: 'Não foi possível aplicar as atualizações de extensões pendentes.' },
  '将尝试使用现有插件启动。请检查网络后重新启动；若仍失败，可在恢复页面处理相关插件或重新安装完整安装包。': {
    ja: '既存のプラグインで起動を試みます。ネットワークを確認して再起動してください。解決しない場合は、復元ページでプラグインを管理するか、完全版を再インストールしてください。',
    es: 'Se intentará iniciar con los complementos actuales. Revisa tu red y reinicia; si persiste el error, gestiona los complementos en la página de recuperación o reinstala la app completa.',
    fr: 'Le démarrage va se poursuivre avec les extensions existantes. Vérifiez votre réseau et redémarrez; si le problème persiste, gérez les extensions sur la page de récupération ou réinstallez.',
    de: 'Der Start wird mit den vorhandenen Plugins fortgesetzt. Bitte Netzwerk prüfen und neu starten. Falls das Problem weiterhin besteht, Plugins auf der Wiederherstellungsseite verwalten.',
    ru: 'Запуск будет продолжен с текущими плагинами. Проверьте сеть и перезапустите; если проблема сохраняется, управляйте плагинами на странице восстановления.',
    pt: 'A inicialização continuará com as extensões existentes. Verifique sua rede e reinicie; se persistir, gerencie as extensões na página de recuperação ou reinstale o pacote completo.',
  },
}

function desktopText(zh: string, en: string, others?: Partial<Record<SupportedShellLocale, string>>): string {
  const norm = activeShellLocale()
  if (norm === 'zh') return zh
  if (norm === 'en') return en
  if (others?.[norm] !== undefined) return others[norm]!
  if (DESKTOP_COMMON_TEXT[zh]?.[norm] !== undefined) return DESKTOP_COMMON_TEXT[zh]![norm]!
  if (zh.startsWith('关于 ')) {
    const name = zh.slice(3)
    const aboutMap: Record<SupportedShellLocale, string> = {
      zh, en, ja: `${name} について`, es: `Acerca de ${name}`, fr: `À propos de ${name}`, de: `Über ${name}`, ru: `О программе ${name}`, pt: `Sobre o ${name}`
    }
    return aboutMap[norm] ?? en
  }
  return en
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

registerDshProtocol()
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())
  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (url === 'dsh://open' || url === 'dsh://open/') showMainWindow()
  })
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
          onProgress: progress => {
            if (progress.progress) reportStartupProgress(progress.progress)
            else void updateStartupMessage(runtimeExtractionMessage(progress))
          },
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
          {
            ja: 'プラグインとワークスペースを初期化中…\n初回起動には 1〜3 分かかる場合があります。アプリを閉じないでください。',
            es: 'Inicializando complementos y espacio de trabajo…\nEl primer inicio puede tardar entre 1 y 3 minutos. No cierres la aplicación.',
            fr: "Initialisation des extensions et de l'espace de travail…\nLe premier lancement peut prendre 1 à 3 minutes. Veuillez ne pas fermer l'application.",
            de: 'Plugins und Arbeitsbereich werden initialisiert…\nDer erste Start kann 1–3 Minuten dauern. Bitte schließen Sie die Anwendung nicht.',
            ru: 'Инициализация плагинов и рабочей области…\nПервый запуск может занять 1–3 минуты. Пожалуйста, не закрывайте приложение.',
            pt: 'Inicializando plugins e área de trabalho…\nA primeira inicialização pode levar de 1 a 3 minutos. Por favor, não feche o aplicativo.',
          },
        ))
      }
    }
    const desktopBridgePatch = prepareDesktopBridge(join(app.getPath('userData'), 'desktop-bridge'), resolveDesktopBridgeDir(runtimeOptions))
    migrateDesktopBridgeProfile(profileDir)
    const pluginStoreDir = resolveBundledPluginStore({
      ...runtimeOptions,
      ...(extractedStoreDir === undefined ? {} : { extractedStoreDir }),
    })
    const profileStoreDir = resolvePnpmStoreDir(profileDir, pluginStoreDir)
    const prebuiltRuntimeDir = resolvePrebuiltOfficialRuntime(runtimeOptions)
    const seedOptions = {
      onProgress: reportStartupProgress,
      nodeExecutable,
      ...(pnpmEntry === undefined ? {} : { pnpmEntry }),
      profileDir,
      desktopRuntimeDir,
      pluginStoreDir: pluginStoreDir ?? '',
      ...(prebuiltRuntimeDir === undefined ? {} : { prebuiltRuntimeDir }),
      ...(pathPrefix === undefined ? {} : { pathPrefix }),
    }
    lastSeedOptions = seedOptions
    let skipBundleReconcile = true
    try {
      await updateStartupMessage(desktopText('正在检查配套插件', 'Checking bundled plugins'))
      const seeded = await seedBundledPlugins(seedOptions)
      if (seeded.seeded.length > 0) console.log(`已补种官方运行时和社区插件：${seeded.seeded.join('、')}`)
    } catch (error) {
      skipBundleReconcile = false
      const message = error instanceof Error ? error.message : '内置插件补种失败。'
      await writeTextFile(join(app.getPath('userData'), 'plugin-seed.log'), `${message}\n`, 'utf8').catch(() => undefined)
      await showStartupPluginWarning('seed', message)
    }
    try {
      await updateStartupMessage(desktopText('正在检查待应用的插件更新', 'Checking pending plugin updates'))
      const updated = await applyPendingProfileUpdates(seedOptions)
      if (updated.length > 0) {
        skipBundleReconcile = false
        console.log('已在启动前应用插件更新：' + updated.join('、'))
      }
    } catch (error) {
      skipBundleReconcile = false
      const message = error instanceof Error ? error.message : '启动前应用插件更新失败。'
      await writeTextFile(join(app.getPath('userData'), 'plugin-update.log'), `${message}\n`, 'utf8').catch(() => undefined)
      await showStartupPluginWarning('pending', message)
    }
    const runtime = resolveDshRuntime({ ...runtimeOptions, profileDir, desktopRuntimeDir })
    const startOptions = {
      bootstrapPath: resolveDshBootstrap(runtimeOptions),
      desktopBridgePatch,
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
      reportStartupProgress({ phase: 'server' })
      await beginDshStartupDiagnostic(profileDir)
      started = await startWithProfileSelfRepair({
        profileDir,
        extraDirs: [desktopRuntimeDir],
        skipBundleReconcile,
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
    reportStartupProgress({ phase: 'renderer' })
    await openWorkbenchOrRecovery(profileDir, server.url)
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

async function showStartupWindow(message: string, failed = false): Promise<void> {
  const window = mainWindow ??= createWindow()
  const view = requireDshView()
  showDshContentView()
  const html = resolveStartupHtml()
  if (html !== undefined) {
    await windowNavigation.navigate(
      view,
      () => view.webContents.loadFile(html, { query: { theme: activeDshColorScheme, lang: activeShellLocale() } }),
      () => view.webContents.executeJavaScript('window.updateStartupProgress?.(' + JSON.stringify({ message, failed }) + ')'),
    )
    return
  }
  const escaped = message.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
  await windowNavigation.navigate(
    view,
    () => view.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<main style="font-family:sans-serif;padding:48px"><h1>DSH Codex Desktop</h1><p>' + escaped + '</p></main>')),
  )
}

async function updateStartupMessage(message: string, progress: { detail?: string; completed?: number; total?: number } = {}): Promise<void> {
  const view = requireDshView()
  if (view.webContents.isDestroyed()) return
  await view.webContents.executeJavaScript(`window.updateStartupProgress?.(${JSON.stringify({ message, ...progress })})`)
    .catch(() => undefined)
}

function reportStartupProgress(progress: StartupProgress): void {
  const state = formatStartupProgress(progress, activeShellLocale())
  void updateStartupMessage(state.message, state)
}

function firstInitializationMessage(): string {
  return desktopText(
    '首次启动，正在准备运行环境…\n可能需要 1–3 分钟，请勿关闭应用。',
    'Preparing the runtime for the first launch…\nThis may take 1–3 minutes. Please keep the app open.',
    {
      ja: '初回起動、実行環境を準備中…\n1〜3 分かかる場合があります。アプリを閉じないでください。',
      es: 'Primer inicio, preparando el entorno de ejecución…\nPuede tardar de 1 a 3 minutos. No cierres la aplicación.',
      fr: "Premier lancement, préparation de l'environnement d'exécution…\nCela peut prendre 1 à 3 minutes. Veuillez ne pas fermer l'application.",
      de: 'Erster Start, Laufzeitumgebung wird vorbereitet…\nKann 1–3 Minuten dauern. Bitte schließen Sie die Anwendung nicht.',
      ru: 'Первый запуск, подготовка среды выполнения…\nМожет занять 1–3 минуты. Пожалуйста, не закрывайте приложение.',
      pt: 'Primeira inicialização, preparando o ambiente de execução…\nPode levar de 1 a 3 minutos. Por favor, não feche o aplicativo.',
    },
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
  await clearPreviousDshAuthCookies(view.webContents.session.cookies, serverUrl)
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
  await beginStartupDiagnostic(startupDiagnosticPath(profileDir), startupDiagnosticStage, {
    mode: isRecoveryModeActive(profileDir) ? 'recovery' : 'normal',
  }).catch(error => {
    console.error('无法记录 DSH 启动诊断。', error)
  })
}

async function advanceDshStartupDiagnostic(profileDir: string, stage: Exclude<StartupDiagnosticStage, 'healthy'>): Promise<void> {
  startupDiagnosticStage = stage
  await advanceStartupDiagnostic(startupDiagnosticPath(profileDir), stage).catch(error => {
    console.error('无法更新 DSH 启动诊断。', error)
  })
}

function rendererLoadTimeoutMessage(): string {
  return `DSH 页面未能在 ${DSH_RENDERER_LOAD_TIMEOUT_MS / 1000} 秒内完成插件加载。`
}

function stopRendererTimeoutGraceTimer(): void {
  if (rendererTimeoutGraceTimer !== undefined) clearTimeout(rendererTimeoutGraceTimer)
  rendererTimeoutGraceTimer = undefined
}

function stopRendererHealthTimer(): void {
  if (rendererHealthTimer !== undefined) clearTimeout(rendererHealthTimer)
  rendererHealthTimer = undefined
  stopRendererTimeoutGraceTimer()
}

function startRendererTimeoutGraceTimer(profileDir: string, message: string): void {
  stopRendererTimeoutGraceTimer()
  rendererTimeoutGraceTimer = setTimeout(() => {
    rendererTimeoutGraceTimer = undefined
    if (isQuitting || isRecycling || startupFailurePresented) return
    void presentDshLoadFailure(profileDir, message, []).catch(error => {
      console.error('无法显示 DSH 页面加载失败提示。', error)
    })
  }, DSH_RENDERER_TIMEOUT_GRACE_MS)
  rendererTimeoutGraceTimer.unref()
}

function startRendererHealthTimer(profileDir: string): void {
  stopRendererHealthTimer()
  rendererHealthTimer = setTimeout(() => {
    rendererHealthTimer = undefined
    void handleRendererBootReport({ status: 'failed', plugins: [], error: rendererLoadTimeoutMessage() }, profileDir, 'renderer-timeout')
  }, DSH_RENDERER_LOAD_TIMEOUT_MS)
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
    await confirmRecoveryStartup(profileDir)
    if (await maybeLeaveRecoveryMode(profileDir)) {
      // 恢复会话已结束，允许写入新的健康检查点。
    }
    if (!isRecoveryModeActive(profileDir)) {
      await captureProfileHealthCheckpoint(profileDir).catch(error => {
        console.error('无法保存 DSH 健康配置检查点。', error)
      })
    }
    if (startupFailurePresented && server !== undefined) {
      startupFailurePresented = false
      await returnToWorkbenchFromRecovery({ restartHealthTimer: false }).catch(error => {
        console.error('无法在插件加载完成后回到工作台。', error)
      })
    }
    return
  }
  if (handlingRendererBootFailure || isQuitting || isRecycling) return
  handlingRendererBootFailure = true
  const plugins = report.plugins ?? []
  const message = report.error ?? (plugins.length === 0
    ? 'DSH 客户端未能完成插件加载。'
    : `以下插件未能加载：${plugins.join('、')}。`)
  try {
    const candidates = await startupRecoveryCandidates(profileDir, message, plugins)
    await failStartupDiagnostic(startupDiagnosticPath(profileDir), {
      stage: 'renderer-loading',
      source,
      message,
      plugins: candidates,
    })
    await writeTextFile(startupErrorLogPath(profileDir), `${message}\n`, 'utf8')
    // 非关键插件异常只保留诊断；不能把有异常的配置确认为完全健康。
    if (source === 'renderer' && report.workbenchReady === true) return
    if (source === 'renderer-timeout' && candidates.length === 0) {
      startRendererTimeoutGraceTimer(profileDir, message)
      return
    }
    await presentDshLoadFailure(profileDir, message, candidates)
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
async function returnToWorkbenchFromRecovery(options: { restartHealthTimer?: boolean } = {}): Promise<void> {
  const running = server
  if (running === undefined) throw new Error('DSH 尚未成功启动，无法进入工作台。')
  startupFailurePresented = false
  const view = requireDshView()
  const profileDir = recoveryProfileDir
  if (profileDir !== undefined && options.restartHealthTimer !== false) {
    await advanceDshStartupDiagnostic(profileDir, 'renderer-loading')
    startRendererHealthTimer(profileDir)
  }
  allowedOrigin = new URL(running.url).origin
  await windowNavigation.navigate(view, () => view.webContents.loadURL(running.url))
  showDshContentView()
  mainWindow?.maximize()
  mainWindow?.show()
  mainWindow?.focus()
  if (profileDir !== undefined) await maybeLeaveRecoveryMode(profileDir)
}

function clearRecoverySessionHints(): void {
  recoveryFailureMessage = undefined
  recoveryFailurePlugin = undefined
  recoveryFailurePlugins = []
}

async function maybeLeaveRecoveryMode(profileDir: string): Promise<boolean> {
  if (!await tryAutoLeaveRecoveryMode(profileDir)) return false
  clearRecoverySessionHints()
  return true
}

async function openWorkbenchOrRecovery(profileDir: string, serverUrl: string): Promise<void> {
  if (isRecoveryModeActive(profileDir)) {
    if (await maybeLeaveRecoveryMode(profileDir)) {
      await createMainWindow(serverUrl)
      return
    }
    await showRecoveryWindow(profileDir)
    return
  }
  await createMainWindow(serverUrl)
}

async function showRecoveryWindow(profileDir: string, failure?: { failureMessage: string, failurePlugins: string[] }): Promise<void> {
  stopRendererHealthTimer()
  mainWindow ??= createWindow()
  const window = mainWindow
  window.setMinimumSize(720, 520)
  if (window.isMaximized()) window.unmaximize()
  window.setSize(920, 680)
  window.center()
  const view = requireRecoveryView()
  recoveryProfileDir = profileDir
  if (failure !== undefined) {
    recoveryFailureMessage = failure.failureMessage
    recoveryFailurePlugins = failure.failurePlugins
    recoveryFailurePlugin = failure.failurePlugins[0]
  }
  showRecoveryContentView()
  const html = resolveRecoveryHtml()
  if (html === undefined) throw new Error('恢复页面资源缺失。')
  await windowNavigation.navigate(view, () => view.webContents.loadFile(html, { query: { theme: activeDshColorScheme, lang: activeShellLocale() } }))
}

async function startupRecoveryCandidates(profileDir: string, message: string, plugins: readonly string[] = []): Promise<string[]> {
  try {
    return await findRecoveryCandidates(profileDir, message, plugins)
  } catch (error) {
    console.error('无法定位导致 DSH 加载失败的插件。', error)
    return []
  }
}

async function presentDshLoadFailure(profileDir: string, message: string, candidates: string[]): Promise<void> {
  startupFailurePresented = true
  if (isRecoveryModeActive(profileDir)) {
    await enterRecoveryMode(profileDir, { force: true, suspectedPlugins: candidates, failureMessage: message })
  }
  if (candidates.length > 0 || isRecoveryModeActive(profileDir)) {
    await showRecoveryWindow(profileDir, { failureMessage: message, failurePlugins: candidates })
  } else {
    clearRecoverySessionHints()
    await showStartupWindow(desktopText('DSH 加载失败：', 'DSH failed to load: ') + message.slice(0, 240)
      + desktopText('\n日志：', '\nLog: ') + startupErrorLogPath(profileDir), true)
  }
}

async function reportStartupFailure(error: unknown, profileDir?: string): Promise<void> {
  const logPath = startupErrorLogPath(profileDir)
  const message = error instanceof Error ? error.message : '未知启动错误。'
  console.error(message)
  const userDataLog = join(app.getPath('userData'), 'startup-error.log')
  const candidates = profileDir === undefined ? [] : await startupRecoveryCandidates(profileDir, message)
  if (profileDir !== undefined) {
    await failStartupDiagnostic(startupDiagnosticPath(profileDir), {
      stage: startupDiagnosticStage,
      source: 'process',
      message,
      plugins: candidates,
    }).catch(diagnosticError => { console.error('无法记录 DSH 启动失败。', diagnosticError) })
  }
  await writeTextFile(userDataLog, message + '\n', 'utf8').catch(() => undefined)
  await writeTextFile(logPath, message + '\n', 'utf8').catch(() => undefined)
  const short = message.split(/\r?\n/)[0]?.slice(0, 240) ?? '未知启动错误。'
  try {
    if (profileDir !== undefined) await presentDshLoadFailure(profileDir, message, candidates)
    else await showStartupWindow(desktopText('启动失败：', 'Startup failed: ') + short + desktopText('\n日志：', '\nLog: ') + logPath, true)
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

const PROFILE_QUIET_POLL_MS = 750
const PROFILE_QUIET_MAX_WAIT_MS = 10 * 60 * 1_000
/** 两次静默采样之间保留一个轮询间隔，覆盖紧随 pnpm 退出的后处理。 */
const PROFILE_QUIET_SAMPLES = 2

function scheduleProfileActivationRecycle(): void {
  if (isQuitting || isRecycling) return
  profileActivationRecyclePending = true
  profileActivationRecycleGeneration += 1
  if (profileActivationRecycleTask !== undefined) return
  const task = recycleAfterPluginOperationsSettle()
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

async function recycleAfterPluginOperationsSettle(): Promise<void> {
  const reportedRecords = new Set<string>()
  while (profileActivationRecyclePending && !isQuitting && !isRecycling) {
    profileActivationRecyclePending = false
    const generation = profileActivationRecycleGeneration
    const settled = await waitForPluginReloadReady({
      waitUntilQuiet: () => waitForProfileQuiet(
        {
          marketBusy: async () => isDshMarketOperationBusy(await dshMarketOperationStatus()),
          pluginOperationActive: () => lastSeedOptions !== undefined && isPluginOperationActive(lastSeedOptions.profileDir, {
            onDiagnostic: ({ reason, path }) => {
              const key = `${reason}:${path}`
              if (reportedRecords.has(key)) return
              reportedRecords.add(key)
              console.warn(reason === 'orphan-run'
                ? '已忽略没有活动所属进程或子进程的插件操作记录，文件未删除：'
                : '插件写锁内容持续损坏，已忽略此锁记录，仍检查子进程且不删除文件：', path)
            },
          }),
        },
        () => new Promise(resolve => setTimeout(resolve, PROFILE_QUIET_POLL_MS)),
        {
          maxWaitMs: PROFILE_QUIET_MAX_WAIT_MS,
          pollIntervalMs: PROFILE_QUIET_POLL_MS,
          quietWindows: PROFILE_QUIET_SAMPLES,
        },
      ),
      shouldStop: () => isQuitting || isRecycling,
      onTimeout: () => {
        console.warn(`插件操作静默等待超时（${PROFILE_QUIET_MAX_WAIT_MS}ms），保留待重载请求，等待安装与后处理结束。`)
      },
    })
    if (!settled) return
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
    const started = await startAfterPluginUpdates({
      applyUpdates: async () => {
        const updated = await applyPendingProfileUpdates(seedOptions)
        if (updated.length > 0) console.log('已热更新插件：' + updated.join('、'))
      },
      onUpdateError: async error => {
        const message = error instanceof Error ? error.message : String(error)
        console.error('插件更新失败，继续尝试加载 DSH。', message)
        await writeTextFile(join(app.getPath('userData'), 'plugin-update.log'), `${message}\n`, 'utf8')
      },
      start: async () => {
        reportStartupProgress({ phase: 'server' })
        await beginDshStartupDiagnostic(seedOptions.profileDir)
        return startWithProfileSelfRepair({
          profileDir: seedOptions.profileDir,
          extraDirs: seedOptions.desktopRuntimeDir === undefined ? [] : [seedOptions.desktopRuntimeDir],
          start: () => startDsh({
            ...startOptions,
            onUnexpectedExit: handleUnexpectedDshExit,
            onIpcMessage: handleDshIpc,
          }),
        })
      },
    })
    server = started.result
    await advanceDshStartupDiagnostic(seedOptions.profileDir, 'server-ready')
    await openWorkbenchOrRecovery(seedOptions.profileDir, server.url)
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
  runMainTask(showStartupWindow(desktopText('DSH 已停止运行。请重新启动应用。', 'DSH has stopped. Restart the app.'), true))
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

/** 冒烟由错误日志判定失败，不能等待人工关闭提示框。 */
async function showStartupPluginWarning(kind: 'seed' | 'pending', message: string): Promise<void> {
  if (process.env.DSH_DESKTOP_SMOKE_READY_FILE?.trim()) return
  await dialog.showMessageBox({
    type: 'warning',
    title: kind === 'seed'
      ? desktopText('内置插件更新未完成', 'Bundled plugin update incomplete')
      : desktopText('插件更新未完成', 'Plugin update incomplete'),
    message: kind === 'seed'
      ? desktopText('未能安装此桌面版本配套的插件。', 'Could not install the plugins bundled with this desktop version.')
      : desktopText('未能应用等待安装的插件更新。', 'Could not apply pending plugin updates.'),
    detail: desktopText('将尝试使用现有插件启动。请检查网络后重新启动；若仍失败，可在恢复页面处理相关插件或重新安装完整安装包。', 'Startup will continue with the existing plugins. Check your network and restart; if the problem persists, manage the affected plugins on the recovery page or reinstall the full desktop package.') + '\n\n' + message,
    buttons: [desktopText('继续启动', 'Continue startup')],
  })
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
    backgroundColor: nativeBackdropEnabled ? '#00000000' : palette.titleBarBackground,
    ...(nativeBackdropEnabled ? { backgroundMaterial: 'mica' as const } : {}),
    ...(process.platform === 'darwin' ? {} : { titleBarOverlay: { color: nativeBackdropEnabled ? '#00000000' : palette.titleBarBackground, symbolColor: palette.titleBarSymbol, height: SHELL_BAR_HEIGHT } }),
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
    additionalArguments: nativeBackdropEnabled ? ['--dsh-native-backdrop'] : [],
    sandbox: true,
  } })
  if (nativeBackdropEnabled) view.setBackgroundColor('#00000000')
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
  runMainTask(window.loadFile(resolveShellAsset('shell.html'), { query: { theme: activeDshColorScheme, backdrop: nativeBackdropEnabled ? 'mica' : 'none' } }))

  installAccountLoginOpener(view.webContents, url => shell.openExternal(url), () => activeDshColorScheme === 'dark', message => {
    console.warn(message)
    const profileDir = lastSeedOptions?.profileDir
    if (profileDir !== undefined) void noteStartupDiagnostic(startupDiagnosticPath(profileDir), message).catch(() => {})
  })
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
  installShortcutHandler(recovery.webContents)
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
  setWindowBackground(mainWindow, nativeBackdropEnabled ? '#00000000' : palette.titleBarBackground)
  setWindowBackground(settingsWindow, palette.settingsBackground)
  setWindowBackground(shortcutsWindow, palette.shortcutsBackground)
  setWindowBackground(aboutWindow, palette.aboutBackground)
  if (process.platform !== 'darwin' && mainWindow !== undefined && !mainWindow.isDestroyed()) {
    mainWindow.setTitleBarOverlay({ color: nativeBackdropEnabled ? '#00000000' : palette.titleBarBackground, symbolColor: palette.titleBarSymbol, height: SHELL_BAR_HEIGHT })
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
    installable: runningDesktopUpdateInstallable(),
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
    candidates: recoveryFailurePlugins.map(packageName => ({ packageName })),
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
      suspectedPlugins: recoveryFailurePlugins,
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
    clearRecoverySessionHints()
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

let disposePetWindow: (() => void) | undefined
function installShellIpc(): void {
  disposePetWindow?.()
  disposePetWindow = installPetWindow({ source: () => dshView?.webContents, reveal: () => { mainWindow?.show(); mainWindow?.focus() } })
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
    if (shouldDownloadUpdateAutomatically(updatePreferences, runningDesktopUpdateInstallable()) && updateStatus.kind === 'available') {
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
    if (value !== 'check' && value !== 'download' && value !== 'install' && value !== 'open-archive') return
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

/** 调试当前显示的内容页面；不把菜单所在的桌面外壳误当作工作台。 */
function resolveDevToolsContents(): WebContents | undefined {
  const contents = (recoveryView?.getVisible() ? recoveryView : dshView)?.webContents
  return contents === undefined || contents.isDestroyed() ? undefined : contents
}

function resolveRecoveryProfileDir(): string | undefined {
  return recoveryProfileDir ?? lastSeedOptions?.profileDir
}

function isActionEnabled(id: ShellActionId): boolean {
  if (id === 'toggle-devtools') return resolveDevToolsContents() !== undefined
  if (id === 'reload') return !isRecycling && lastStartOptions !== undefined && lastSeedOptions !== undefined
  if (id === 'open-recovery') return resolveRecoveryProfileDir() !== undefined
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
        ...(action.id === 'toggle-devtools' ? { type: 'checkbox' as const, checked: resolveDevToolsContents()?.isDevToolsOpened() ?? false } : {}),
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
    // 恢复页只新增调试快捷键，不接管它原有的按键行为。
    if (contents === recoveryView?.webContents && shellActionForShortcut(input, process.platform) !== 'toggle-devtools') return
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
  if (id === 'toggle-devtools') {
    const target = resolveDevToolsContents()
    if (target?.isDevToolsOpened()) target.closeDevTools()
    else target?.openDevTools({ mode: 'detach' })
    return
  }
  const contents = dshView?.webContents
  if (id === 'new-chat' || id === 'open-folder' || id === 'settings' || id === 'toggle-sidebar' || id === 'find' || id === 'previous-chat' || id === 'next-chat' || id === 'back' || id === 'forward') {
    sendDshAction(id)
    return
  }
  if (id === 'close-window') { mainWindow?.hide(); return }
  if (id === 'desktop-settings') { showDesktopSettingsWindow(); return }
  if (id === 'quit') { await requestQuit(); return }
  if (id === 'open-recovery') {
    const profileDir = resolveRecoveryProfileDir()
    if (profileDir !== undefined) await showRecoveryWindow(profileDir)
    return
  }
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
  const norm = normalizeShellLocale(desktopLocale()) ?? (isChineseLocale(desktopLocale()) ? 'zh' : 'en')
  const statusMap: Record<SupportedShellLocale, { approval: string; question: string; complete: string; taskDefault: string; approvalSuffix: string; questionSuffix: string; completeSuffix: string }> = {
    zh: { approval: '需要审批', question: '需要你的输入', complete: '任务已完成', taskDefault: 'DeepSeek Harness 任务', approvalSuffix: '正在等待审批', questionSuffix: '正在等待你的回答', completeSuffix: '已完成' },
    en: { approval: 'Approval required', question: 'Your input is needed', complete: 'Task completed', taskDefault: 'DeepSeek Harness task', approvalSuffix: 'is waiting for approval', questionSuffix: 'is waiting for your answer', completeSuffix: 'is complete' },
    ja: { approval: '承認が必要です', question: '入力が必要です', complete: 'タスク完了', taskDefault: 'DeepSeek Harness タスク', approvalSuffix: '承認待ちです', questionSuffix: '回答を待っています', completeSuffix: '完了しました' },
    es: { approval: 'Aprobación requerida', question: 'Se necesita tu respuesta', complete: 'Tarea completada', taskDefault: 'Tarea de DeepSeek Harness', approvalSuffix: 'está esperando aprobación', questionSuffix: 'está esperando tu respuesta', completeSuffix: 'ha finalizado' },
    fr: { approval: 'Approbation requise', question: 'Votre saisie est requise', complete: 'Tâche terminée', taskDefault: 'Tâche DeepSeek Harness', approvalSuffix: "est en attente d'approbation", questionSuffix: 'attend votre réponse', completeSuffix: 'est terminée' },
    de: { approval: 'Genehmigung erforderlich', question: 'Ihre Eingabe wird benötigt', complete: 'Aufgabe abgeschlossen', taskDefault: 'DeepSeek Harness Aufgabe', approvalSuffix: 'wartet auf Genehmigung', questionSuffix: 'wartet auf Ihre Antwort', completeSuffix: 'ist abgeschlossen' },
    ru: { approval: 'Требуется одобрение', question: 'Требуется ваш ввод', complete: 'Задача выполнена', taskDefault: 'Задача DeepSeek Harness', approvalSuffix: 'ожидает одобрения', questionSuffix: 'ожидает вашего ответа', completeSuffix: 'выполнена' },
    pt: { approval: 'Aprovação necessária', question: 'Sua entrada é necessária', complete: 'Tarefa concluída', taskDefault: 'Tarefa do DeepSeek Harness', approvalSuffix: 'está aguardando aprovação', questionSuffix: 'está aguardando sua resposta', completeSuffix: 'foi concluída' },
  }
  const t = statusMap[norm] ?? statusMap.en
  const status = event.kind === 'approval'
    ? t.approval
    : event.kind === 'question'
      ? t.question
      : t.complete
  const title = event.title === undefined ? status : `${status} · ${event.title}`
  if (event.body !== undefined) {
    return { title, body: event.body }
  }
  const joiner = (norm === 'zh' || norm === 'ja') ? '' : ' '
  const task = event.title === undefined
    ? t.taskDefault
    : (norm === 'zh' ? `“${event.title}”` : norm === 'ja' ? `「${event.title}」` : `"${event.title}"`)
  if (event.kind === 'approval') return { title, body: `${task}${joiner}${t.approvalSuffix}` }
  if (event.kind === 'question') return { title, body: `${task}${joiner}${t.questionSuffix}` }
  return { title, body: `${task}${joiner}${t.completeSuffix}` }
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
        const norm = normalizeShellLocale(desktopLocale()) ?? (isChineseLocale(desktopLocale()) ? 'zh' : 'en')
        const descMap: Record<SupportedShellLocale, string> = {
          zh: `${count} 个已完成任务`,
          en: `${count} completed tasks`,
          ja: `完了したタスク: ${count}件`,
          es: `${count} tareas completadas`,
          fr: `${count} tâches terminées`,
          de: `${count} abgeschlossene Aufgaben`,
          ru: `Выполненных задач: ${count}`,
          pt: `${count} tarefas concluídas`,
        }
        const description = descMap[norm] ?? descMap.en
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
  const norm = normalizeShellLocale(desktopLocale()) ?? (isChineseLocale(desktopLocale()) ? 'zh' : 'en')
  const titleMap: Record<SupportedShellLocale, string> = {
    zh: '回复发送失败',
    en: 'Reply not sent',
    ja: '返信の送信に失敗しました',
    es: 'Error al enviar respuesta',
    fr: "Échec de l'envoi de la réponse",
    de: 'Antwort nicht gesendet',
    ru: 'Ответ не отправлен',
    pt: 'Resposta não enviada',
  }
  const bodyMap: Record<SupportedShellLocale, string> = {
    zh: '未能将回复发送到这个任务。请打开任务后重试。',
    en: 'The reply could not be sent to this task. Open it and try again.',
    ja: 'このタスクに返信を送信できませんでした。タスクを開いてやり直してください。',
    es: 'No se pudo enviar la respuesta a esta tarea. Ábrela e inténtalo de nuevo.',
    fr: "Impossible d'envoyer la réponse à cette tâche. Ouvrez-la et réessayez.",
    de: 'Die Antwort konnte nicht an diese Aufgabe gesendet werden. Öffnen Sie sie und versuchen Sie es erneut.',
    ru: 'Не удалось отправить ответ на эту задачу. Откройте её и повторите попытку.',
    pt: 'Não foi possível enviar a resposta para esta tarefa. Abra-a e tente novamente.',
  }
  const id = `reply-error:${sessionId}`
  activeNotifications.get(id)?.close()
  const notification = new Notification({
    title: titleMap[norm] ?? titleMap.en,
    body: bodyMap[norm] ?? bodyMap.en,
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
  const norm = normalizeShellLocale(desktopLocale()) ?? (zh ? 'zh' : 'en')
  const placeholderMap: Record<SupportedShellLocale, string> = {
    zh: `回复 ${DESKTOP_APP_NAME}`,
    en: `Reply to ${DESKTOP_APP_NAME}`,
    ja: `${DESKTOP_APP_NAME} に返信`,
    es: `Responder a ${DESKTOP_APP_NAME}`,
    fr: `Répondre à ${DESKTOP_APP_NAME}`,
    de: `Antworten an ${DESKTOP_APP_NAME}`,
    ru: `Ответить в ${DESKTOP_APP_NAME}`,
    pt: `Responder a ${DESKTOP_APP_NAME}`,
  }
  const replyLabelMap: Record<SupportedShellLocale, string> = {
    zh: '回复',
    en: 'Reply',
    ja: '返信',
    es: 'Responder',
    fr: 'Répondre',
    de: 'Antworten',
    ru: 'Ответить',
    pt: 'Responder',
  }
  const closeLabelMap: Record<SupportedShellLocale, string> = {
    zh: '关闭',
    en: 'Close',
    ja: '閉じる',
    es: 'Cerrar',
    fr: 'Fermer',
    de: 'Schließen',
    ru: 'Закрыть',
    pt: 'Fechar',
  }
  const replyPlaceholder = placeholderMap[norm] ?? placeholderMap.en
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
        replyLabel: replyLabelMap[norm] ?? replyLabelMap.en,
        replyArguments: windowsNotificationReplyArguments(event.sessionId),
        closeLabel: closeLabelMap[norm] ?? closeLabelMap.en,
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

/** Windows 关闭 parent/modal 子窗时会 EnableWindow 主窗，自定义标题栏会整窗闪一下。关闭前先断开归属。 */
function preventWindowsOwnedWindowFlash(window: BrowserWindow): void {
  window.on('close', () => {
    if (process.platform !== 'win32' || window.isDestroyed() || window.getParentWindow() === null) return
    window.setParentWindow(null)
  })
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
  preventWindowsOwnedWindowFlash(window)
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
  preventWindowsOwnedWindowFlash(window)
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
  preventWindowsOwnedWindowFlash(window)
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
  const norm = normalizeShellLocale(desktopLocale()) ?? (isChineseLocale(desktopLocale()) ? 'zh' : 'en')
  const badgeMap: Record<SupportedShellLocale, string> = {
    zh: ` · ${unreadCompletionCount} 个已完成任务`,
    en: ` · ${unreadCompletionCount} completed tasks`,
    ja: ` · 完了したタスク: ${unreadCompletionCount}件`,
    es: ` · ${unreadCompletionCount} tareas completadas`,
    fr: ` · ${unreadCompletionCount} tâches terminées`,
    de: ` · ${unreadCompletionCount} abgeschlossene Aufgaben`,
    ru: ` · Выполнено задач: ${unreadCompletionCount}`,
    pt: ` · ${unreadCompletionCount} tarefas concluídas`,
  }
  const badgeSuffix = unreadCompletionCount > 0 ? (badgeMap[norm] ?? badgeMap.en) : ''
  tray.setToolTip(DESKTOP_APP_NAME + badgeSuffix)
  const items = buildDesktopTrayItems({
    status: updateStatus,
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
    installable: runningDesktopUpdateInstallable(),
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
  if (id === 'open-archive') {
    await openDesktopArchiveDownload()
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
    if (result?.isUpdateAvailable !== true || version === undefined || version === app.getVersion()) {
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
      if (shouldDownloadUpdateAutomatically(updatePreferences, runningDesktopUpdateInstallable())) await downloadDesktopUpdate('background')
      else showDesktopUpdateNotification('available', version)
      return
    }
    if (interaction === 'settings') return
    if (!runningDesktopUpdateInstallable()) {
      const prompt = await dialog.showMessageBox({
        type: 'info',
        title: DESKTOP_APP_NAME,
        message: desktopArchiveUpdatePrompt(version, desktopLocale()),
        buttons: [desktopText('下载压缩包', 'Download Zip'), desktopText('取消', 'Cancel')],
        defaultId: 0,
        cancelId: 1,
      })
      if (prompt.response === 0) await openDesktopArchiveDownload(version)
      return
    }
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
  if (!runningDesktopUpdateInstallable()) {
    const version = updateStatus.kind === 'available' || updateStatus.kind === 'ready' ? updateStatus.version : undefined
    if (version !== undefined) await openDesktopArchiveDownload(version)
    return
  }
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
  else if (action === 'open-archive') await openDesktopArchiveDownload()
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
      ? desktopText(
          `桌面端 ${version} 已下载，点击选择安装时间。`,
          `Desktop ${version} is ready. Click to choose when to install.`,
          {
            ja: `デスクトップ ${version} のダウンロードが完了しました。クリックしてインストール時期を選択してください。`,
            es: `DSH Codex Desktop ${version} descargado. Haz clic para elegir cuándo instalar.`,
            fr: `DSH Codex Desktop ${version} est téléchargé. Cliquez pour choisir le moment d'installer.`,
            de: `Desktop ${version} heruntergeladen. Klicken, um Installationszeitpunkt zu wählen.`,
            ru: `Версия ${version} загружена. Нажмите, чтобы выбрать время установки.`,
            pt: `DSH Codex Desktop ${version} baixado. Clique para escolher quando instalar.`,
          },
        )
      : desktopText(
          `发现桌面端 ${version}，点击查看更新。`,
          `Desktop ${version} is available. Click to review the update.`,
          {
            ja: `デスクトップ ${version} が見つかりました。クリックして更新内容を確認してください。`,
            es: `DSH Codex Desktop ${version} disponible. Haz clic para ver la actualización.`,
            fr: `DSH Codex Desktop ${version} disponible. Cliquez pour voir la mise à jour.`,
            de: `Desktop ${version} verfügbar. Klicken, um das Update anzuzeigen.`,
            ru: `Доступна версия ${version}. Нажмите, чтобы посмотреть обновление.`,
            pt: `DSH Codex Desktop ${version} disponível. Clique para ver a atualização.`,
          },
        ),
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
  if (!runningDesktopUpdateInstallable()) {
    await openDesktopArchiveDownload()
    return
  }
  await shutdownDesktop(() => { autoUpdater.quitAndInstall(false, true) })
}

function runningDesktopUpdateInstallable(): boolean {
  return canInstallDesktopUpdateInPlace({
    platform: process.platform,
    execDir: dirname(app.getPath('exe')),
    exists: existsSync,
  })
}

async function openDesktopArchiveDownload(version = updateStatus.kind === 'available' || updateStatus.kind === 'ready' ? updateStatus.version : undefined): Promise<void> {
  if (version === undefined) return
  const url = desktopArchiveDownloadUrl(version, process.arch)
  if (url === undefined) return
  await shell.openExternal(url)
}

/** 登录完成页会打开 dsh://open。不注册的话，系统会把这个地址交给已安装的官方桌面。 */
function registerDshProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('dsh', process.execPath, [resolve(process.argv[1])])
    return
  }
  app.setAsDefaultProtocolClient('dsh')
}

function showMainWindow(): void {
  if (mainWindow === undefined) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}
