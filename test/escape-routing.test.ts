import assert from 'node:assert/strict'
import test from 'node:test'

import { escapeRoute } from '../src/escape-routing.js'

const route = (overrides: Partial<Parameters<typeof escapeRoute>[0]> = {}) => escapeRoute({
  key: 'Escape',
  isAuxiliaryWindow: false,
  isDesktopSettingsWindow: false,
  isMainShell: false,
  isDshSettingsDialogVisible: false,
  ...overrides,
})

test('DSH view and shell do not swallow Escape when Settings is absent', () => {
  assert.equal(route(), 'pass-through')
  assert.equal(route({ isMainShell: true }), 'pass-through')
})

test('only the shell falls back to dismiss a reported visible DSH Settings dialog', () => {
  assert.equal(route({ isMainShell: true, isDshSettingsDialogVisible: true }), 'dismiss-dsh-settings')
  assert.equal(route({ isDshSettingsDialogVisible: true }), 'pass-through')
})

test('desktop settings leaves Escape to its renderer while other auxiliary windows close', () => {
  assert.equal(route({ isAuxiliaryWindow: true, isDesktopSettingsWindow: true }), 'pass-through')
  assert.equal(route({ isAuxiliaryWindow: true }), 'close-auxiliary')
})
