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
  | 'whats-new'
  | 'feedback'
  | 'show-shortcuts'
  | 'reload'
  | 'check-updates'
  | 'about'

export interface LocalizedText {
  readonly en: string
  readonly zh: string
}

export interface ShellActionDefinition {
  readonly accelerator?: string
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

const text = (zh: string, en: string): LocalizedText => ({ zh, en })

export const SHELL_MENUS: readonly { readonly id: ShellMenuId; readonly label: LocalizedText }[] = [
  { id: 'file', label: text('文件', 'File') },
  { id: 'edit', label: text('编辑', 'Edit') },
  { id: 'view', label: text('视图', 'View') },
  { id: 'help', label: text('帮助', 'Help') },
]

export const SHELL_ACTIONS: readonly ShellActionDefinition[] = [
  { id: 'new-chat', menu: 'file', group: 0, label: text('新聊天', 'New Chat'), accelerator: 'CmdOrCtrl+N', globalShortcut: true, keywords: text('新建任务 会话', 'new task session') },
  { id: 'open-folder', menu: 'file', group: 0, label: text('打开文件夹…', 'Open Folder…'), accelerator: 'CmdOrCtrl+O', globalShortcut: true, keywords: text('新建项目 工作区 目录', 'new project workspace directory') },
  { id: 'close-window', menu: 'file', group: 1, label: text('关闭', 'Close'), accelerator: 'CmdOrCtrl+W', globalShortcut: true, keywords: text('最小化 托盘 隐藏', 'minimize tray hide') },
  { id: 'quit', menu: 'file', group: 2, label: text('退出', 'Quit'), accelerator: 'CmdOrCtrl+Q', globalShortcut: true, keywords: text('彻底退出 关闭软件', 'exit application') },

  { id: 'undo', menu: 'edit', group: 0, label: text('撤销', 'Undo'), accelerator: 'CmdOrCtrl+Z' },
  { id: 'redo', menu: 'edit', group: 0, label: text('重做', 'Redo'), accelerator: 'CmdOrCtrl+Y' },
  { id: 'cut', menu: 'edit', group: 1, label: text('剪切', 'Cut'), accelerator: 'CmdOrCtrl+X' },
  { id: 'copy', menu: 'edit', group: 1, label: text('复制', 'Copy'), accelerator: 'CmdOrCtrl+C' },
  { id: 'paste', menu: 'edit', group: 1, label: text('粘贴', 'Paste'), accelerator: 'CmdOrCtrl+V' },
  { id: 'delete', menu: 'edit', group: 1, label: text('删除', 'Delete') },
  { id: 'select-all', menu: 'edit', group: 2, label: text('全选', 'Select All'), accelerator: 'CmdOrCtrl+A' },
  { id: 'settings', menu: 'edit', group: 3, label: text('设置', 'Settings'), accelerator: 'CmdOrCtrl+,', globalShortcut: true, keywords: text('偏好 配置', 'preferences configuration') },

  { id: 'toggle-sidebar', menu: 'view', group: 0, label: text('切换边栏', 'Toggle Sidebar'), accelerator: 'CmdOrCtrl+B', globalShortcut: true },
  { id: 'find', menu: 'view', group: 1, label: text('查找', 'Find'), accelerator: 'CmdOrCtrl+F', globalShortcut: true, keywords: text('搜索会话', 'search sessions') },
  { id: 'previous-chat', menu: 'view', group: 2, label: text('上一个聊天', 'Previous Chat'), accelerator: 'CmdOrCtrl+Shift+[', globalShortcut: true },
  { id: 'next-chat', menu: 'view', group: 2, label: text('下一个聊天', 'Next Chat'), accelerator: 'CmdOrCtrl+Shift+]', globalShortcut: true },
  { id: 'back', menu: 'view', group: 2, label: text('返回', 'Back'), accelerator: 'CmdOrCtrl+[', globalShortcut: true },
  { id: 'forward', menu: 'view', group: 2, label: text('前进', 'Forward'), accelerator: 'CmdOrCtrl+]', globalShortcut: true },
  { id: 'zoom-in', menu: 'view', group: 3, label: text('放大', 'Zoom In'), accelerator: 'CmdOrCtrl+Shift+Plus', globalShortcut: true },
  { id: 'zoom-out', menu: 'view', group: 3, label: text('缩小', 'Zoom Out'), accelerator: 'CmdOrCtrl+-', globalShortcut: true },
  { id: 'zoom-reset', menu: 'view', group: 3, label: text('实际大小', 'Actual Size'), accelerator: 'CmdOrCtrl+0', globalShortcut: true },
  { id: 'toggle-fullscreen', menu: 'view', group: 4, label: text('切换全屏', 'Toggle Full Screen'), accelerator: 'F11', globalShortcut: true },

  { id: 'whats-new', menu: 'help', group: 0, label: text('新功能', "What's New") },
  { id: 'feedback', menu: 'help', group: 0, label: text('反馈', 'Feedback') },
  { id: 'show-shortcuts', menu: 'help', group: 1, label: text('显示键盘快捷键', 'Show Keyboard Shortcuts'), accelerator: 'CmdOrCtrl+/', globalShortcut: true, keywords: text('按键 命令', 'keys commands') },
  { id: 'reload', menu: 'help', group: 1, label: text('重新加载', 'Reload'), accelerator: 'CmdOrCtrl+R', globalShortcut: true, keywords: text('重载 插件 服务', 'reload plugins service') },
  { id: 'check-updates', menu: 'help', group: 2, label: text('检查更新…', 'Check for Updates…') },
  { id: 'about', menu: 'help', group: 2, label: text('关于 DSH Codex Desktop', 'About DSH Codex Desktop') },
]

export function isChineseLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith('zh')
}

export function formatAccelerator(accelerator: string, platform: NodeJS.Platform): string {
  return accelerator
    .replace('CmdOrCtrl', platform === 'darwin' ? 'Cmd' : 'Ctrl')
    .replace('Shift+Plus', 'Shift+=')
}

export function localizedShellMenus(locale: string): LocalizedShellMenu[] {
  const chinese = isChineseLocale(locale)
  return SHELL_MENUS.map(menu => ({ id: menu.id, label: chinese ? menu.label.zh : menu.label.en }))
}

export function localizedShellActions(locale: string, platform: NodeJS.Platform): LocalizedShellAction[] {
  const chinese = isChineseLocale(locale)
  return SHELL_ACTIONS.map(action => ({
    ...action,
    label: chinese ? action.label.zh : action.label.en,
    keywords: chinese ? action.keywords?.zh ?? '' : action.keywords?.en ?? '',
    ...(action.accelerator === undefined ? {} : { acceleratorLabel: formatAccelerator(action.accelerator, platform) }),
  }))
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
    && action.accelerator !== undefined
    && acceleratorMatches(action.accelerator, input, platform))?.id
}
