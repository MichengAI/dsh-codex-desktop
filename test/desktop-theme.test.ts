import assert from 'node:assert/strict'
import test from 'node:test'

import { DESKTOP_THEME_PALETTES, normalizeDesktopThemeSnapshot, supportsNativeBackdrop } from '../src/desktop-theme.js'

test('桌面主题只接受 light/dark 解析结果和内置偏好', () => {
  assert.deepEqual(normalizeDesktopThemeSnapshot('light'), { colorScheme: 'light' })
  assert.deepEqual(normalizeDesktopThemeSnapshot({ colorScheme: 'dark', preference: 'system' }), { colorScheme: 'dark', preference: 'system' })
  assert.deepEqual(normalizeDesktopThemeSnapshot({ colorScheme: 'light', preference: 'custom' }), { colorScheme: 'light' })
  assert.equal(normalizeDesktopThemeSnapshot({ colorScheme: 'sepia', preference: 'dark' }), undefined)
})

test('浅色和深色桌面调色板提供所有原生窗口背景', () => {
  assert.equal(DESKTOP_THEME_PALETTES.light.titleBarBackground, '#f1f4f3')
  assert.equal(DESKTOP_THEME_PALETTES.light.settingsBackground, '#ffffff')
  assert.equal(DESKTOP_THEME_PALETTES.dark.titleBarBackground, '#1f2020')
  assert.equal(DESKTOP_THEME_PALETTES.dark.shortcutsBackground, '#262827')
})

test('原生背景只在支持的 Windows 版本启用', () => {
  assert.equal(supportsNativeBackdrop('win32', '10.0.22621'), true)
  assert.equal(supportsNativeBackdrop('win32', '10.0.26200'), true)
  for (const version of ['10.0.22000', '10.0.19045', 'invalid']) assert.equal(supportsNativeBackdrop('win32', version), false)
  assert.equal(supportsNativeBackdrop('darwin', '24.0.0'), false)
  assert.equal(supportsNativeBackdrop('linux', '6.1.0'), false)
})
