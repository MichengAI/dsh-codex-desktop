import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

import { DEFAULT_UPDATE_PREFERENCES, buildDesktopTrayItems, DESKTOP_UPDATE_WARNING, desktopUpdateChannel, desktopUpdatePrompt, formatDesktopReleaseNotes, loadUpdatePreferences, publicDesktopUpdateError, sanitizeUpdatePreferences, saveUpdatePreferences, shouldCheckForUpdatesOnStartup, shouldDownloadUpdateAutomatically } from '../src/desktop-updater.js'

test('更新策略使用安全默认值并持久化', async () => {
  assert.deepEqual(sanitizeUpdatePreferences(undefined), DEFAULT_UPDATE_PREFERENCES)
  assert.deepEqual(sanitizeUpdatePreferences({ policy: 'unexpected' }), DEFAULT_UPDATE_PREFERENCES)
  assert.deepEqual(sanitizeUpdatePreferences({ policy: 'auto-download' }), { policy: 'auto-download' })
  assert.equal(shouldCheckForUpdatesOnStartup({ policy: 'notify' }, true), true)
  assert.equal(shouldCheckForUpdatesOnStartup({ policy: 'auto-download' }, true), true)
  assert.equal(shouldCheckForUpdatesOnStartup({ policy: 'manual' }, true), false)
  assert.equal(shouldCheckForUpdatesOnStartup({ policy: 'notify' }, false), false)
  assert.equal(shouldDownloadUpdateAutomatically({ policy: 'auto-download' }), true)

  const root = await mkdtemp(join(tmpdir(), 'dsh-update-preferences-'))
  const path = join(root, 'settings.json')
  try {
    assert.deepEqual(await loadUpdatePreferences(path), DEFAULT_UPDATE_PREFERENCES)
    assert.deepEqual(await saveUpdatePreferences(path, { policy: 'manual' }), { policy: 'manual' })
    assert.deepEqual(await loadUpdatePreferences(path), { policy: 'manual' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('开发态和空闲态都提供手动检查，不自动下载', () => {
  const idle = buildDesktopTrayItems({ status: { kind: 'idle' }, currentVersion: '0.1.4', packaged: true })
  assert.equal(idle.some(item => item.id === 'check' && item.enabled), true)
  assert.equal(idle.some(item => item.id === 'check' && item.label === '检查更新…'), true)
  assert.equal(idle.some(item => item.id === 'download'), false)
  assert.equal(idle.some(item => item.id === 'reload' && item.label === '重新加载'), true)
  const dev = buildDesktopTrayItems({ status: { kind: 'idle' }, currentVersion: '0.1.4', packaged: false })
  assert.equal(dev.some(item => item.id === 'check' && item.enabled), true)
  assert.equal(dev.some(item => item.id === 'check' && item.label === '检查更新…'), true)
  assert.equal(dev.some(item => item.id === 'reload' && item.enabled), true)
})

test('发现新版本后托盘只出现下载安装，不出现自动安装文案', () => {
  const items = buildDesktopTrayItems({
    status: { kind: 'available', version: '0.1.5' },
    currentVersion: '0.1.4',
    packaged: true,
  })
  assert.equal(items.some(item => item.id === 'download' && item.label === '下载并安装 0.1.5'), true)
  assert.equal(items.some(item => item.id === 'check'), false)
})

test('下载完成后托盘改为安装并重启', () => {
  const items = buildDesktopTrayItems({
    status: { kind: 'ready', version: '0.1.5' },
    currentVersion: '0.1.4',
    packaged: true,
  })
  assert.equal(items.some(item => item.id === 'install' && item.label.includes('0.1.5')), true)
})

test('托盘和更新提示可跟随 DSH 英文 locale', () => {
  const items = buildDesktopTrayItems({ status: { kind: 'idle' }, currentVersion: '0.1.4', packaged: true, locale: 'en' })
  assert.equal(items.some(item => item.id === 'show' && item.label === 'Show Window'), true)
  assert.equal(items.some(item => item.id === 'check' && item.label === 'Check for Updates…'), true)
  assert.match(desktopUpdatePrompt({ kind: 'ready', version: '0.1.5' }, 'en'), /is ready/)
  assert.match(publicDesktopUpdateError(new Error('getaddrinfo ENOTFOUND github.com'), 'en'), /Unable to check/)
})

test('更新说明描述桌面应用更新，不混用官方运行时警告', () => {
  const text = desktopUpdatePrompt({ kind: 'available', version: '0.1.5', releaseNotes: '修复托盘' })
  assert.match(text, /0\.1\.5/)
  assert.match(text, new RegExp(DESKTOP_UPDATE_WARNING))
  assert.match(text, /修复托盘/)
})

test('更新说明将 GitHub 的 HTML 和 Markdown 转为支持中英文的纯文本', () => {
  const notes = formatDesktopReleaseNotes('<p><strong>更新说明</strong></p><ul><li>修复中文显示</li><li><a href="https://github.com/MichengAI/dsh-codex-desktop/compare/v1.0.13...v1.0.14">Full Changelog</a></li></ul>\n\n## English\n- [Install guide](https://example.com/install)')
  assert.equal(notes, '更新说明\n- 修复中文显示\n- Full Changelog\nEnglish\n- Install guide: https://example.com/install')
})

test('macOS 更新通道按 CPU 架构隔离', () => {
  assert.equal(desktopUpdateChannel('darwin', 'arm64'), 'latest-arm64')
  assert.equal(desktopUpdateChannel('darwin', 'x64'), 'latest-x64')
  assert.equal(desktopUpdateChannel('win32', 'x64'), undefined)
})

test('更新错误不得回传本地路径', () => {
  assert.equal(publicDesktopUpdateError(new Error('ENOENT: D:\\Tools\\DSH Codex Desktop\\latest.yml')), '桌面端更新失败，请查看桌面日志。')
  assert.match(publicDesktopUpdateError(new Error('getaddrinfo ENOTFOUND github.com')), /无法检查/)
})

test('打包配置把更新源指到 GitHub Releases', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>
    repository?: { url?: string }
    build?: { publish?: { provider?: string; owner?: string; repo?: string } | Array<{ provider?: string }> }
  }
  assert.ok(manifest.dependencies?.['electron-updater'])
  assert.match(String(manifest.repository?.url), /MichengAI\/dsh-codex-desktop/)
  const publish = Array.isArray(manifest.build?.publish) ? manifest.build?.publish[0] : manifest.build?.publish
  assert.equal(publish?.provider, 'github')
})

test('主进程在窗口稳定后按策略安排启动检查', async () => {
  const main = await readFile(new URL('../../src/main.ts', import.meta.url), 'utf8')
  assert.match(main, /buildDesktopTrayItems/)
  assert.match(main, /import updater from 'electron-updater'/)
  assert.doesNotMatch(main, /import \{ autoUpdater \} from 'electron-updater'/)
  assert.match(main, /autoDownload = false/)
  assert.match(main, /function checkDesktopUpdate/)
  const startupView = main.indexOf('await openWorkbenchOrRecovery(profileDir, server.url)')
  const startupCheck = main.indexOf('scheduleStartupUpdateCheck()', startupView)
  assert.equal(startupView >= 0 && startupCheck > startupView, true)
  assert.match(main, /shouldCheckForUpdatesOnStartup\(updatePreferences, app\.isPackaged\)/)
  assert.match(main, /checkDesktopUpdate\('background'\)/)
})

test('主进程遵循更新库可用标志，旧版和受策略限制的新版不触发下载', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  const start = main.indexOf('async function checkDesktopUpdate(')
  const end = main.indexOf('async function downloadDesktopUpdate(', start)
  assert.ok(start >= 0 && end > start)
  const check = main.slice(start, end)
  for (const scenario of [
    { version: '1.0.47', available: false },
    { version: '1.0.48', available: false },
    { version: '1.0.49', available: false },
    { version: '1.0.49', available: true },
    { version: undefined, available: false },
  ]) {
    let status: { kind: string; version?: string } = { kind: 'idle' }
    let downloads = 0
    let notices = 0
    const result = scenario.version === undefined ? null : {
      isUpdateAvailable: scenario.available,
      updateInfo: { version: scenario.version, releaseNotes: '## 修复' },
    }
    // 执行实际编译后的检查函数，覆盖状态转换与后台自动下载分支。
    await runInNewContext(`(async () => { ${check}; await checkDesktopUpdate('background') })()`, {
      updateStatus: status,
      updatePreferences: { policy: 'auto-download' },
      app: { isPackaged: true, getVersion: () => '1.0.48' },
      autoUpdater: { checkForUpdates: async () => result },
      setDesktopUpdateStatus: (next: typeof status) => { status = next },
      dismissDesktopUpdateNotification: () => {},
      shouldDownloadUpdateAutomatically,
      downloadDesktopUpdate: async () => { downloads += 1 },
      showDesktopUpdateNotification: () => { notices += 1 },
      formatDesktopReleaseNotes,
      publicDesktopUpdateError,
      desktopLocale: () => 'zh',
    })
    assert.equal(status.kind, scenario.available ? 'available' : 'none', `线上版本 ${scenario.version}`)
    assert.equal(downloads, scenario.available ? 1 : 0)
    assert.equal(notices, 0)
  }
})
