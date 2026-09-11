import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { localizedShellActions } from '../src/shell-actions.js'
import { mayInvokeShellAction } from '../src/shell-ipc-policy.js'

// 执行主进程构建产物中的真实动作和菜单处理，只替换 Electron 对象。
const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
const executable = ['resolveDevToolsContents', 'isActionEnabled', 'executeShellAction', 'popupShellMenu'].map(name => {
  const declaration = new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^\\}`, 'm').exec(source)?.[0]
  assert.ok(declaration)
  return declaration
}).join('\n')

test('菜单与动作检查当前内容页，开关及手动关闭后的勾选状态一致', async () => {
  function contents() {
    return { opened: false, destroyed: false, mode: '', isDestroyed() { return this.destroyed },
      isDevToolsOpened() { return this.opened }, closeDevTools() { this.opened = false },
      openDevTools(options: { mode: string }) { this.opened = true; this.mode = options.mode } }
  }
  const workbench = contents(), recovery = contents()
  let recoveryVisible = false
  let template: Array<{ label?: string; checked?: boolean; enabled?: boolean }> = []
  const scope = vm.createContext({
    dshView: { webContents: workbench }, recoveryView: { webContents: recovery, getVisible: () => recoveryVisible },
    mainWindow: { isDestroyed: () => false }, desktopLocale: () => 'zh', localizedShellActions,
    process: { platform: 'win32' }, dshNavigationState: {},
    Menu: { buildFromTemplate(items: typeof template) {
      template = items
      return { once() {}, popup({ callback }: { callback(): void }) { callback() } }
    } },
  })
  vm.runInContext(executable, scope)
  const toggle = () => vm.runInContext("executeShellAction('toggle-devtools')", scope)
  const menu = async () => {
    await vm.runInContext("popupShellMenu({menu:'view',x:0,y:0})", scope)
    return template.find(item => item.label === '开发者工具')!
  }
  assert.equal((await menu()).checked, false)
  await toggle()
  assert.equal(workbench.opened, true)
  assert.equal(workbench.mode, 'detach')
  assert.equal((await menu()).checked, true)
  await toggle()
  assert.equal(workbench.opened, false)
  recoveryVisible = true
  await toggle()
  assert.equal(recovery.opened, true)
  assert.equal(workbench.opened, false)
  recovery.closeDevTools()
  assert.equal((await menu()).checked, false)
  recovery.destroyed = true
  assert.equal((await menu()).enabled, false)
  await toggle()
  assert.equal(recovery.opened, false)
})

test('开发者工具动作只接受桌面菜单来源，不向业务页面开放调用权限', () => {
  assert.equal(mayInvokeShellAction('main', 'toggle-devtools'), true)
  for (const kind of ['dsh', 'unknown', 'settings', 'about', 'shortcuts'] as const) {
    assert.equal(mayInvokeShellAction(kind, 'toggle-devtools'), false)
  }
})
