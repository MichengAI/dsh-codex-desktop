import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('主进程安装全局异常兜底并复用统一退出清理', async () => {
  const source = await readFile(new URL('../../src/main.ts', import.meta.url), 'utf8')
  assert.match(source, /process\.on\('uncaughtException'/)
  assert.match(source, /process\.on\('unhandledRejection'/)
  assert.match(source, /async function shutdownDesktop/)
  assert.equal((source.match(/quitDesktopApp\(/g) ?? []).length, 1)
})

test('缺少离线 store 时仍执行官方清理和补种入口', async () => {
  const source = await readFile(new URL('../../src/main.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /if \(pluginStoreDir !== undefined\) \{\s*try \{\s*const seeded = await seedBundledPlugins/)
})

test('主窗口导航完成前不结束启动或插件热重载', async () => {
  const source = await readFile(new URL('../../src/main.ts', import.meta.url), 'utf8')
  assert.equal((source.match(/await createMainWindow\(server\.url\)/g) ?? []).length, 2)
  assert.match(source, /isRecycling = true\s+broadcastShellState\(\)\s+try \{\s+await showStartupWindow\('加载中'\)/)
  assert.match(source, /console\.error\('显示启动错误页面失败。'/)
  assert.match(source, /will-navigate'[\s\S]*?windowNavigation\.isNavigating\(\)[\s\S]*?event\.preventDefault\(\)/)
})

test('桌面壳与 DSH 内容分层并复用托盘重载实现', async () => {
  const source = await readFile(new URL('../../src/main.ts', import.meta.url), 'utf8')
  assert.match(source, /new WebContentsView/)
  assert.match(source, /window\.contentView\.addChildView\(view\)/)
  assert.match(source, /id === 'reload'\) await recycleDshForPluginUpdate\(\)/)
  assert.match(source, /if \(id === 'reload'\) \{\s+await recycleDshForPluginUpdate\(\)/)
  assert.match(source, /title: DESKTOP_APP_NAME/)
})

test('桌面壳预加载脚本被编译并提供 DSH 动作兜底', async () => {
  const config = await readFile(new URL('../../tsconfig.json', import.meta.url), 'utf8')
  const preload = await readFile(new URL('../../src/dsh-view-preload.cts', import.meta.url), 'utf8')
  assert.match(config, /src\/\*\*\/\*\.cts/)
  assert.match(preload, /clientBridgeRegistrations/)
  assert.match(preload, /runDomAction/)
  assert.match(preload, /添加工作区\|打开文件夹/)
  assert.match(preload, /\.dcu-wb-session\[role="treeitem"\]\[aria-selected\]/)
  assert.match(preload, /\^新建任务\$/)
})

test('桌面菜单使用窗口内坐标且 DSH 客户端桥接导出标准插件入口', async () => {
  const main = await readFile(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const bridge = await readFile(new URL('../../src/desktop-bridge-client-source.ts', import.meta.url), 'utf8')
  assert.match(main, /x: Math\.round\(request\.x\),\s+y: Math\.round\(request\.y\)/)
  assert.doesNotMatch(main, /contentBounds\.x \+ Math\.round\(request\.x\)/)
  assert.match(bridge, /window\.__ModuleLoader__\.load/)
  assert.match(bridge, /const inject/)
  assert.match(bridge, /const apply/)
  assert.match(bridge, /ctx\.workspaces\.startSession\(\)/)
})

test('关于窗口使用独立丰富页面并进入打包资源', async () => {
  const main = await readFile(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const manifest = await readFile(new URL('../../package.json', import.meta.url), 'utf8')
  const about = await readFile(new URL('../../assets/about.html', import.meta.url), 'utf8')
  assert.match(main, /showAboutWindow\(\)/)
  assert.match(manifest, /assets\/about\.html/)
  assert.match(about, /关于这个项目/)
  assert.match(about, /runtimeVersion/)
  assert.match(about, /overflow:hidden/)
  assert.match(main, /resizable: false/)
  assert.match(main, /frame: false/)
  assert.match(main, /minimizable: false/)
  assert.match(main, /maximizable: false/)
})

test('shell 在 macOS 为交通灯预留空间且状态早到不会读取空 bootstrap', async () => {
  const shell = await readFile(new URL('../../assets/shell.html', import.meta.url), 'utf8')
  assert.match(shell, /data-platform="darwin"[^}]*padding-left:78px/)
  assert.ok(shell.indexOf('document.documentElement.dataset.platform=window.dshShell.platform') < shell.indexOf('<style>'))
  assert.match(shell, /bootstrap\?\.locale/)
  assert.match(shell, /state\?\?value\.state/)
})
