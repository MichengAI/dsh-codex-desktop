import assert from 'node:assert/strict'
import test from 'node:test'

import { localizedShellActions, localizedShellMenus, normalizeShellLocale, shellActionForShortcut, SHELL_ACTIONS } from '../src/shell-actions.js'

test('桌面壳动作注册表没有重复命令且四个菜单均有内容', () => {
  assert.equal(new Set(SHELL_ACTIONS.map(action => action.id)).size, SHELL_ACTIONS.length)
  assert.deepEqual(new Set(SHELL_ACTIONS.map(action => action.menu)), new Set(['file', 'edit', 'view', 'help']))
})

test('桌面壳菜单和动作随 DSH 语言本地化', () => {
  assert.deepEqual(localizedShellMenus('zh-CN').map(menu => menu.label), ['文件', '编辑', '视图', '帮助'])
  assert.deepEqual(localizedShellMenus('en-US').map(menu => menu.label), ['File', 'Edit', 'View', 'Help'])
  assert.deepEqual(localizedShellMenus('ja-JP').map(menu => menu.label), ['ファイル', '編集', '表示', 'ヘルプ'])
  assert.deepEqual(localizedShellMenus('es-ES').map(menu => menu.label), ['Archivo', 'Edición', 'Ver', 'Ayuda'])
  assert.deepEqual(localizedShellMenus('fr-FR').map(menu => menu.label), ['Fichier', 'Édition', 'Affichage', 'Aide'])
  assert.deepEqual(localizedShellMenus('de-DE').map(menu => menu.label), ['Datei', 'Bearbeiten', 'Ansicht', 'Hilfe'])
  assert.deepEqual(localizedShellMenus('ru-RU').map(menu => menu.label), ['Файл', 'Правка', 'Вид', 'Справка'])
  assert.deepEqual(localizedShellMenus('pt-BR').map(menu => menu.label), ['Arquivo', 'Editar', 'Exibir', 'Ajuda'])
  assert.equal(localizedShellActions('zh-CN', 'win32').find(action => action.id === 'reload')?.label, '重新加载')
  assert.equal(localizedShellActions('ja-JP', 'win32').find(action => action.id === 'reload')?.label, '再読み込み')
  assert.equal(localizedShellActions('es-ES', 'win32').find(action => action.id === 'reload')?.label, 'Recargar')
  assert.equal(localizedShellActions('zh-CN', 'win32').find(action => action.id === 'open-recovery')?.label, '打开恢复页')
  assert.equal(localizedShellActions('en-US', 'win32').find(action => action.id === 'open-recovery')?.label, 'Open Recovery Page')
  assert.equal(localizedShellActions('zh-CN', 'win32').find(action => action.id === 'open-recovery')?.menu, 'help')
  assert.equal(localizedShellActions('zh-CN', 'win32').find(action => action.id === 'quit')?.label, '退出')
  assert.equal(localizedShellActions('zh-CN', 'win32').find(action => action.id === 'desktop-settings')?.label, '桌面端设置')
  assert.equal(localizedShellActions('zh-CN', 'win32').find(action => action.id === 'desktop-settings')?.acceleratorLabel, undefined)
  assert.equal(localizedShellActions('zh-CN', 'win32').find(action => action.id === 'settings')?.label, 'DSH 设置')
  assert.equal(localizedShellActions('en-US', 'darwin').find(action => action.id === 'show-shortcuts')?.acceleratorLabel, 'Cmd+/')
  assert.equal(localizedShellActions('zh-CN', 'darwin').find(action => action.id === 'redo')?.acceleratorLabel, 'Cmd+Shift+Z')
})

test('完整接受并识别 DSH 支持的全部语言 locale', () => {
  assert.equal(normalizeShellLocale('zh-CN'), 'zh')
  assert.equal(normalizeShellLocale('en'), 'en')
  assert.equal(normalizeShellLocale('ja-JP'), 'ja')
  assert.equal(normalizeShellLocale('es-ES'), 'es')
  assert.equal(normalizeShellLocale('fr-FR'), 'fr')
  assert.equal(normalizeShellLocale('de-DE'), 'de')
  assert.equal(normalizeShellLocale('ru-RU'), 'ru')
  assert.equal(normalizeShellLocale('pt-BR'), 'pt')
  assert.equal(normalizeShellLocale('unknown-locale'), undefined)
  assert.equal(normalizeShellLocale(null), undefined)
})

test('全局快捷键使用同一动作注册表并正确区分平台修饰键', () => {
  assert.equal(shellActionForShortcut({ key: 'n', control: true, meta: false, alt: false, shift: false }, 'win32'), 'new-chat')
  assert.equal(shellActionForShortcut({ key: 'n', control: false, meta: true, alt: false, shift: false }, 'darwin'), 'new-chat')
  assert.equal(shellActionForShortcut({ key: '=', control: true, meta: false, alt: false, shift: true }, 'win32'), 'zoom-in')
  assert.equal(shellActionForShortcut({ key: ',', control: true, meta: false, alt: false, shift: false }, 'win32'), undefined)
  assert.equal(shellActionForShortcut({ key: 'F11', control: false, meta: false, alt: false, shift: false }, 'win32'), 'toggle-fullscreen')
  assert.equal(shellActionForShortcut({ key: 'n', control: false, meta: false, alt: false, shift: false }, 'win32'), undefined)
})

test('开发者工具位于视图菜单，按平台提供快捷键和搜索关键词', () => {
  const action = localizedShellActions('zh-CN', 'win32').find(action => action.id === 'toggle-devtools')
  assert.equal(action?.menu, 'view')
  assert.equal(action?.label, '开发者工具')
  assert.equal(action?.acceleratorLabel, 'F12')
  assert.match(action?.keywords ?? '', /开发者模式/)
  assert.equal(shellActionForShortcut({ key: 'F12', control: false, meta: false, alt: false, shift: false }, 'win32'), 'toggle-devtools')
  assert.equal(shellActionForShortcut({ key: 'F12', control: false, meta: false, alt: false, shift: false }, 'linux'), 'toggle-devtools')
  assert.equal(shellActionForShortcut({ key: 'i', control: false, meta: true, alt: true, shift: false }, 'darwin'), 'toggle-devtools')
  assert.equal(localizedShellActions('en-US', 'darwin').find(action => action.id === 'toggle-devtools')?.acceleratorLabel, 'Cmd+Alt+I')
})
