import assert from 'node:assert/strict'
import test from 'node:test'

import { DESKTOP_THEME_PALETTES, normalizeDesktopThemeSnapshot } from '../src/desktop-theme.js'

test('桌面主题只接受 light/dark 解析结果和内置偏好', () => {
  assert.deepEqual(normalizeDesktopThemeSnapshot('light'), { colorScheme: 'light' })
  assert.deepEqual(normalizeDesktopThemeSnapshot({ colorScheme: 'dark', preference: 'system' }), { colorScheme: 'dark', preference: 'system' })
  assert.deepEqual(normalizeDesktopThemeSnapshot({ colorScheme: 'light', preference: 'custom' }), { colorScheme: 'light' })
  assert.equal(normalizeDesktopThemeSnapshot({ colorScheme: 'sepia', preference: 'dark' }), undefined)
})

test('浅色和深色桌面调色板提供所有原生窗口背景', () => {
  assert.equal(DESKTOP_THEME_PALETTES.light.titleBarBackground, '#f0f4f3')
  assert.equal(DESKTOP_THEME_PALETTES.light.settingsBackground, '#ffffff')
  assert.equal(DESKTOP_THEME_PALETTES.dark.titleBarBackground, '#1f2020')
  assert.equal(DESKTOP_THEME_PALETTES.dark.shortcutsBackground, '#262827')
})
