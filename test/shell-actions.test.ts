import assert from 'node:assert/strict'
import test from 'node:test'

import { localizedShellActions, localizedShellMenus, shellActionForShortcut, SHELL_ACTIONS } from '../src/shell-actions.js'

test('桌面壳动作注册表没有重复命令且四个菜单均有内容', () => {
  assert.equal(new Set(SHELL_ACTIONS.map(action => action.id)).size, SHELL_ACTIONS.length)
  assert.deepEqual(new Set(SHELL_ACTIONS.map(action => action.menu)), new Set(['file', 'edit', 'view', 'help']))
})

test('桌面壳菜单和动作随系统语言本地化', () => {
  assert.deepEqual(localizedShellMenus('zh-CN').map(menu => menu.label), ['文件', '编辑', '视图', '帮助'])
  assert.deepEqual(localizedShellMenus('en-US').map(menu => menu.label), ['File', 'Edit', 'View', 'Help'])
  assert.equal(localizedShellActions('zh-CN', 'win32').find(action => action.id === 'reload')?.label, '重新加载')
  assert.equal(localizedShellActions('zh-CN', 'win32').find(action => action.id === 'quit')?.label, '退出')
  assert.equal(localizedShellActions('en-US', 'darwin').find(action => action.id === 'show-shortcuts')?.acceleratorLabel, 'Cmd+/')
})

test('全局快捷键使用同一动作注册表并正确区分平台修饰键', () => {
  assert.equal(shellActionForShortcut({ key: 'n', control: true, meta: false, alt: false, shift: false }, 'win32'), 'new-chat')
  assert.equal(shellActionForShortcut({ key: 'n', control: false, meta: true, alt: false, shift: false }, 'darwin'), 'new-chat')
  assert.equal(shellActionForShortcut({ key: '=', control: true, meta: false, alt: false, shift: true }, 'win32'), 'zoom-in')
  assert.equal(shellActionForShortcut({ key: 'F11', control: false, meta: false, alt: false, shift: false }, 'win32'), 'toggle-fullscreen')
  assert.equal(shellActionForShortcut({ key: 'n', control: false, meta: false, alt: false, shift: false }, 'win32'), undefined)
})
