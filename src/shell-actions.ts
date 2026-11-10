export type ShellMenuId = 'file' | 'edit' | 'view' | 'help'

export type ShellActionId =
  | 'new-chat'
  | 'open-folder'
  | 'close-window'
  | 'quit'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'delete'
  | 'select-all'
  | 'desktop-settings'
  | 'settings'
  | 'toggle-sidebar'
  | 'find'
  | 'previous-chat'
  | 'next-chat'
  | 'back'
  | 'forward'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'toggle-fullscreen'
  | 'toggle-devtools'
  | 'whats-new'
  | 'feedback'
  | 'show-shortcuts'
  | 'reload'
  | 'open-recovery'
  | 'check-updates'
  | 'about'

export type SupportedShellLocale = 'zh' | 'en' | 'ja' | 'es' | 'fr' | 'de' | 'ru' | 'pt'

export const SUPPORTED_SHELL_LOCALES: readonly SupportedShellLocale[] = [
  'zh',
  'en',
  'ja',
  'es',
  'fr',
  'de',
  'ru',
  'pt',
]

export interface LocalizedText {
  readonly zh: string
  readonly en: string
  readonly ja?: string
  readonly es?: string
  readonly fr?: string
  readonly de?: string
  readonly ru?: string
  readonly pt?: string
}

export function resolveLocalizedText(text: LocalizedText, locale: string): string {
  const norm = normalizeShellLocale(locale)
  if (norm !== undefined && text[norm] !== undefined) return text[norm]!
  if (locale.toLowerCase().startsWith('zh')) return text.zh
  return text.en
}

export interface ShellActionDefinition {
  readonly accelerator?: string
  readonly macAccelerator?: string
  readonly globalShortcut?: boolean
  readonly group: number
  readonly id: ShellActionId
  readonly keywords?: LocalizedText
  readonly label: LocalizedText
  readonly menu: ShellMenuId
}

export interface LocalizedShellAction extends Omit<ShellActionDefinition, 'keywords' | 'label'> {
  readonly acceleratorLabel?: string
  readonly keywords: string
  readonly label: string
}

export interface LocalizedShellMenu {
  readonly id: ShellMenuId
  readonly label: string
}

const text = (
  zh: string,
  en: string,
  ja?: string,
  es?: string,
  fr?: string,
  de?: string,
  ru?: string,
  pt?: string,
): LocalizedText => ({
  zh,
  en,
  ...(ja === undefined ? {} : { ja }),
  ...(es === undefined ? {} : { es }),
  ...(fr === undefined ? {} : { fr }),
  ...(de === undefined ? {} : { de }),
  ...(ru === undefined ? {} : { ru }),
  ...(pt === undefined ? {} : { pt }),
})

export const SHELL_MENUS: readonly { readonly id: ShellMenuId; readonly label: LocalizedText }[] = [
  { id: 'file', label: text('文件', 'File', 'ファイル', 'Archivo', 'Fichier', 'Datei', 'Файл', 'Arquivo') },
  { id: 'edit', label: text('编辑', 'Edit', '編集', 'Edición', 'Édition', 'Bearbeiten', 'Правка', 'Editar') },
  { id: 'view', label: text('视图', 'View', '表示', 'Ver', 'Affichage', 'Ansicht', 'Вид', 'Exibir') },
  { id: 'help', label: text('帮助', 'Help', 'ヘルプ', 'Ayuda', 'Aide', 'Hilfe', 'Справка', 'Ajuda') },
]

export const SHELL_ACTIONS: readonly ShellActionDefinition[] = [
  {
    id: 'new-chat',
    menu: 'file',
    group: 0,
    label: text('新聊天', 'New Chat', '新規チャット', 'Nuevo chat', 'Nouvelle discussion', 'Neuer Chat', 'Новый чат', 'Novo chat'),
    accelerator: 'CmdOrCtrl+N',
    globalShortcut: true,
    keywords: text(
      '新建任务 会话',
      'new task session',
      'タスク セッション 新規',
      'nueva tarea sesión',
      'nouvelle tâche session',
      'neue aufgabe sitzung',
      'новая задача сессия',
      'nova tarefa sessão',
    ),
  },
  {
    id: 'open-folder',
    menu: 'file',
    group: 0,
    label: text('打开文件夹…', 'Open Folder…', 'フォルダーを開く…', 'Abrir carpeta…', 'Ouvrir le dossier…', 'Ordner öffnen…', 'Открыть папку…', 'Abrir pasta…'),
    accelerator: 'CmdOrCtrl+O',
    globalShortcut: true,
    keywords: text(
      '新建项目 工作区 目录',
      'new project workspace directory',
      'プロジェクト ワークスペース ディレクトリ',
      'proyecto espacio de trabajo directorio',
      'projet espace de travail répertoire',
      'projekt arbeitsbereich verzeichnis',
      'проект рабочая область каталог',
      'projeto espaço de trabalho diretório',
    ),
  },
  {
    id: 'close-window',
    menu: 'file',
    group: 1,
    label: text('关闭', 'Close', '閉じる', 'Cerrar', 'Fermer', 'Schließen', 'Закрыть', 'Fechar'),
    accelerator: 'CmdOrCtrl+W',
    globalShortcut: true,
    keywords: text(
      '最小化 托盘 隐藏',
      'minimize tray hide',
      '最小化 トレイ 非表示',
      'minimizar bandeja ocultar',
      'réduire barre masquer',
      'minimieren tray verbergen',
      'свернуть трей скрыть',
      'minimizar bandeja ocultar',
    ),
  },
  {
    id: 'quit',
    menu: 'file',
    group: 2,
    label: text('退出', 'Quit', '終了', 'Salir', 'Quitter', 'Beenden', 'Выход', 'Sair'),
    accelerator: 'CmdOrCtrl+Q',
    globalShortcut: true,
    keywords: text(
      '彻底退出 关闭软件',
      'exit application',
      '終了 アプリ',
      'salir aplicación',
      'quitter application',
      'beenden anwendung',
      'выход приложение',
      'sair aplicativo',
    ),
  },

  { id: 'undo', menu: 'edit', group: 0, label: text('撤销', 'Undo', '元に戻す', 'Deshacer', 'Annuler', 'Rückgängig', 'Отменить', 'Desfazer'), accelerator: 'CmdOrCtrl+Z' },
  { id: 'redo', menu: 'edit', group: 0, label: text('重做', 'Redo', 'やり直し', 'Rehacer', 'Rétablir', 'Wiederholen', 'Повторить', 'Refazer'), accelerator: 'CmdOrCtrl+Y', macAccelerator: 'CmdOrCtrl+Shift+Z' },
  { id: 'cut', menu: 'edit', group: 1, label: text('剪切', 'Cut', '切り取り', 'Cortar', 'Couper', 'Ausschneiden', 'Вырезать', 'Recortar'), accelerator: 'CmdOrCtrl+X' },
  { id: 'copy', menu: 'edit', group: 1, label: text('复制', 'Copy', 'コピー', 'Copiar', 'Copier', 'Kopieren', 'Копировать', 'Copiar'), accelerator: 'CmdOrCtrl+C' },
  { id: 'paste', menu: 'edit', group: 1, label: text('粘贴', 'Paste', '貼り付け', 'Pegar', 'Coller', 'Einfügen', 'Вставить', 'Colar'), accelerator: 'CmdOrCtrl+V' },
  { id: 'delete', menu: 'edit', group: 1, label: text('删除', 'Delete', '削除', 'Eliminar', 'Supprimer', 'Löschen', 'Удалить', 'Excluir') },
  { id: 'select-all', menu: 'edit', group: 2, label: text('全选', 'Select All', 'すべて選択', 'Seleccionar todo', 'Tout sélectionner', 'Alles auswählen', 'Выбрать все', 'Selecionar tudo'), accelerator: 'CmdOrCtrl+A' },
  {
    id: 'desktop-settings',
    menu: 'edit',
    group: 3,
    label: text('桌面端设置', 'Desktop Settings', 'デスクトップ設定', 'Configuración de escritorio', 'Paramètres du bureau', 'Desktop-Einstellungen', 'Настройки приложения', 'Configurações do aplicativo'),
    keywords: text(
      '通知 偏好 配置',
      'notifications preferences configuration',
      '通知 設定 環境設定',
      'notificaciones preferencias configuración',
      'notifications préférences configuration',
      'benachrichtigungen einstellungen konfiguration',
      'уведомления настройки конфигурация',
      'notificações preferências configuração',
    ),
  },
  {
    id: 'settings',
    menu: 'edit',
    group: 3,
    label: text('DSH 设置', 'DSH Settings', 'DSH 設定', 'Configuración de DSH', 'Paramètres DSH', 'DSH-Einstellungen', 'Настройки DSH', 'Configurações do DSH'),
    keywords: text(
      '模型 插件 业务设置',
      'models plugins DSH configuration',
      'モデル プラグイン 設定',
      'modelos complementos configuración',
      'modèles extensions configuration',
      'modelle plugins konfiguration',
      'модели плагины конфигурация',
      'modelos extensões configuração',
    ),
  },

  { id: 'toggle-sidebar', menu: 'view', group: 0, label: text('切换边栏', 'Toggle Sidebar', 'サイドバーの切り替え', 'Alternar barra lateral', 'Basculer la barre latérale', 'Seitenleiste umschalten', 'Переключить боковую панель', 'Alternar barra lateral'), accelerator: 'CmdOrCtrl+B', globalShortcut: true },
  {
    id: 'find',
    menu: 'view',
    group: 1,
    label: text('查找', 'Find', '検索', 'Buscar', 'Rechercher', 'Suchen', 'Найти', 'Localizar'),
    accelerator: 'CmdOrCtrl+F',
    globalShortcut: true,
    keywords: text('搜索会话', 'search sessions', 'セッション検索', 'buscar sesiones', 'rechercher des sessions', 'sitzungen durchsuchen', 'поиск сессий', 'pesquisar sessões'),
  },
  { id: 'previous-chat', menu: 'view', group: 2, label: text('上一个聊天', 'Previous Chat', '前のチャット', 'Chat anterior', 'Discussion précédente', 'Vorheriger Chat', 'Предыдущий чат', 'Chat anterior'), accelerator: 'CmdOrCtrl+Shift+[', globalShortcut: true },
  { id: 'next-chat', menu: 'view', group: 2, label: text('下一个聊天', 'Next Chat', '次のチャット', 'Chat siguiente', 'Discussion suivante', 'Nächster Chat', 'Следующий чат', 'Próximo chat'), accelerator: 'CmdOrCtrl+Shift+]', globalShortcut: true },
  { id: 'back', menu: 'view', group: 2, label: text('返回', 'Back', '戻る', 'Atrás', 'Retour', 'Zurück', 'Назад', 'Voltar'), accelerator: 'CmdOrCtrl+[', globalShortcut: true },
  { id: 'forward', menu: 'view', group: 2, label: text('前进', 'Forward', '進む', 'Adelante', 'Avancer', 'Vorwärts', 'Вперед', 'Avançar'), accelerator: 'CmdOrCtrl+]', globalShortcut: true },
  { id: 'zoom-in', menu: 'view', group: 3, label: text('放大', 'Zoom In', '拡大', 'Acercar', 'Zoom avant', 'Vergrößern', 'Увеличить', 'Mais zoom'), accelerator: 'CmdOrCtrl+Shift+Plus', globalShortcut: true },
  { id: 'zoom-out', menu: 'view', group: 3, label: text('缩小', 'Zoom Out', '縮小', 'Alejar', 'Zoom arrière', 'Verkleinern', 'Уменьшить', 'Menos zoom'), accelerator: 'CmdOrCtrl+-', globalShortcut: true },
  { id: 'zoom-reset', menu: 'view', group: 3, label: text('实际大小', 'Actual Size', '実際のサイズ', 'Tamaño real', 'Taille réelle', 'Tatsächliche Größe', 'Фактический размер', 'Tamanho real'), accelerator: 'CmdOrCtrl+0', globalShortcut: true },
  { id: 'toggle-fullscreen', menu: 'view', group: 4, label: text('切换全屏', 'Toggle Full Screen', '全画面表示の切り替え', 'Alternar pantalla completa', 'Basculer en plein écran', 'Vollbildmodus umschalten', 'Полноэкранный режим', 'Alternar tela cheia'), accelerator: 'F11', globalShortcut: true },
  {
    id: 'toggle-devtools',
    menu: 'view',
    group: 5,
    label: text('开发者工具', 'Developer Tools', '開発者ツール', 'Herramientas de desarrollo', 'Outils de développement', 'Entwicklertools', 'Инструменты разработчика', 'Ferramentas do desenvolvedor'),
    accelerator: 'F12',
    macAccelerator: 'CmdOrCtrl+Alt+I',
    globalShortcut: true,
    keywords: text(
      '开发者模式 调试 控制台 网络 检查元素',
      'developer mode debug console network inspect',
      '開発者モード デバッグ コンソール ネットワーク',
      'modo desarrollador depuración consola red inspeccionar',
      'mode développeur débogage console réseau inspecter',
      'entwicklermodus debug konsole netzwerk prüfen',
      'режим разработчика отладка консоль сеть инспектор',
      'modo desenvolvedor depuração console rede inspecionar',
    ),
  },

  { id: 'whats-new', menu: 'help', group: 0, label: text('新功能', "What's New", '最新情報', 'Novedades', 'Nouveautés', 'Neuigkeiten', 'Что нового', 'Novidades') },
  { id: 'feedback', menu: 'help', group: 0, label: text('反馈', 'Feedback', 'フィードバック', 'Comentarios', 'Commentaires', 'Feedback', 'Обратная связь', 'Feedback') },
  {
    id: 'show-shortcuts',
    menu: 'help',
    group: 1,
    label: text('显示键盘快捷键', 'Show Keyboard Shortcuts', 'キーボードショートカットを表示', 'Mostrar atajos de teclado', 'Afficher les raccourcis clavier', 'Tastaturkurzbefehle anzeigen', 'Показать сочетания клавиш', 'Mostrar atalhos de teclado'),
    accelerator: 'CmdOrCtrl+/',
    globalShortcut: true,
    keywords: text(
      '按键 命令',
      'keys commands',
      'キー コマンド',
      'teclas comandos',
      'touches commandes',
      'tasten befehle',
      'клавиши команды',
      'teclas comandos',
    ),
  },
  {
    id: 'reload',
    menu: 'help',
    group: 1,
    label: text('重新加载', 'Reload', '再読み込み', 'Recargar', 'Recharger', 'Neu laden', 'Перезагрузить', 'Recarregar'),
    accelerator: 'CmdOrCtrl+R',
    globalShortcut: true,
    keywords: text(
      '重载 插件 服务',
      'reload plugins service',
      'リロード プラグイン サービス',
      'recargar complementos servicio',
      'recharger extensions service',
      'neu laden plugins dienst',
      'перезагрузка плагины служба',
      'recarregar extensões serviço',
    ),
  },
  {
    id: 'open-recovery',
    menu: 'help',
    group: 1,
    label: text('打开恢复页', 'Open Recovery Page', '復元ページを開く', 'Abrir página de recuperación', 'Ouvrir la page de récupération', 'Wiederherstellungsseite öffnen', 'Открыть страницу восстановления', 'Abrir página de recuperação'),
    keywords: text(
      '恢复 插件 隔离 故障',
      'recovery plugins isolate failure',
      '復元 プラグイン 隔離 障害',
      'recuperación complementos aislar fallo',
      'récupération extensions isoler panne',
      'wiederherstellung plugins isolieren fehler',
      'восстановление плагины изоляция сбой',
      'recuperação extensões isolar falha',
    ),
  },
  { id: 'check-updates', menu: 'help', group: 2, label: text('检查更新…', 'Check for Updates…', 'アップデートを確認…', 'Buscar actualizaciones…', 'Rechercher des mises à jour…', 'Nach Updates suchen…', 'Проверить обновления…', 'Verificar atualizações…') },
  { id: 'about', menu: 'help', group: 2, label: text('关于 DSH Codex Desktop', 'About DSH Codex Desktop', 'DSH Codex Desktop について', 'Acerca de DSH Codex Desktop', 'À propos de DSH Codex Desktop', 'Über DSH Codex Desktop', 'О программе DSH Codex Desktop', 'Sobre o DSH Codex Desktop') },
]

export function isChineseLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith('zh')
}

export function normalizeShellLocale(value: unknown): SupportedShellLocale | undefined {
  if (typeof value !== 'string') return undefined
  const primary = value.trim().toLowerCase().split('-')[0] as SupportedShellLocale
  return SUPPORTED_SHELL_LOCALES.includes(primary) ? primary : undefined
}

export function formatAccelerator(accelerator: string, platform: NodeJS.Platform): string {
  return accelerator
    .replace('CmdOrCtrl', platform === 'darwin' ? 'Cmd' : 'Ctrl')
    .replace('Shift+Plus', 'Shift+=')
}

export function localizedShellMenus(locale: string): LocalizedShellMenu[] {
  return SHELL_MENUS.map(menu => ({ id: menu.id, label: resolveLocalizedText(menu.label, locale) }))
}

export function localizedShellActions(locale: string, platform: NodeJS.Platform): LocalizedShellAction[] {
  return SHELL_ACTIONS.map(action => {
    const accelerator = platform === 'darwin' ? action.macAccelerator ?? action.accelerator : action.accelerator
    return {
      ...action,
      ...(accelerator === undefined ? {} : { accelerator }),
      label: resolveLocalizedText(action.label, locale),
      keywords: action.keywords === undefined ? '' : resolveLocalizedText(action.keywords, locale),
      ...(accelerator === undefined ? {} : { acceleratorLabel: formatAccelerator(accelerator, platform) }),
    }
  })
}

interface ShortcutInput {
  readonly alt: boolean
  readonly control: boolean
  readonly key: string
  readonly meta: boolean
  readonly shift: boolean
}

function acceleratorMatches(accelerator: string, input: ShortcutInput, platform: NodeJS.Platform): boolean {
  const parts = accelerator.split('+')
  const expectedKey = parts.at(-1)?.toLowerCase()
  const cmdOrCtrl = parts.includes('CmdOrCtrl')
  const expectedControl = cmdOrCtrl && platform !== 'darwin'
  const expectedMeta = cmdOrCtrl && platform === 'darwin'
  if (input.control !== expectedControl || input.meta !== expectedMeta) return false
  if (input.alt !== parts.includes('Alt') || input.shift !== parts.includes('Shift')) return false
  const key = input.key.toLowerCase()
  if (expectedKey === 'plus') return key === '=' || key === '+'
  return key === expectedKey
}

export function shellActionForShortcut(input: ShortcutInput, platform: NodeJS.Platform): ShellActionId | undefined {
  return SHELL_ACTIONS.find(action => action.globalShortcut === true
    && (platform === 'darwin' ? action.macAccelerator ?? action.accelerator : action.accelerator) !== undefined
    && acceleratorMatches((platform === 'darwin' ? action.macAccelerator ?? action.accelerator : action.accelerator)!, input, platform))?.id
}
