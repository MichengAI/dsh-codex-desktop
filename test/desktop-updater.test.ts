import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { buildDesktopTrayItems, DESKTOP_UPDATE_WARNING, desktopUpdateChannel, desktopUpdatePrompt, formatDesktopReleaseNotes, publicDesktopUpdateError } from '../src/desktop-updater.js'

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

test('主进程不得在启动时自动检查更新', async () => {
  const main = await readFile(new URL('../../src/main.ts', import.meta.url), 'utf8')
  assert.match(main, /buildDesktopTrayItems/)
  assert.match(main, /import updater from 'electron-updater'/)
  assert.doesNotMatch(main, /import \{ autoUpdater \} from 'electron-updater'/)
  assert.match(main, /autoDownload = false/)
  assert.match(main, /function checkDesktopUpdate/)
  assert.doesNotMatch(main, /createTray\(\)\s*void checkDesktopUpdate/)
})
