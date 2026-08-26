import assert from 'node:assert/strict'
import test from 'node:test'

import { mayAccessDesktopUpdates, mayAccessNotificationPreferences, mayGetShellBootstrap, mayInvokeShellAction, mayPopupShellMenu, mayReportDshLocale, mayReportDshNotification, mayReportDshState } from '../src/shell-ipc-policy.js'

test('IPC 权限按 renderer 最小化开放', () => {
  assert.equal(mayGetShellBootstrap('main'), true)
  assert.equal(mayGetShellBootstrap('shortcuts'), true)
  assert.equal(mayGetShellBootstrap('about'), true)
  assert.equal(mayGetShellBootstrap('dsh'), false)
  assert.equal(mayGetShellBootstrap('settings'), true)
  assert.equal(mayPopupShellMenu('main'), true)
  assert.equal(mayPopupShellMenu('about'), false)
  assert.equal(mayReportDshState('dsh'), true)
  assert.equal(mayReportDshState('main'), false)
  assert.equal(mayReportDshNotification('dsh'), true)
  assert.equal(mayReportDshNotification('settings'), false)
  assert.equal(mayReportDshLocale('dsh'), true)
  assert.equal(mayReportDshLocale('main'), false)
  assert.equal(mayAccessNotificationPreferences('settings'), true)
  assert.equal(mayAccessNotificationPreferences('main'), false)
  assert.equal(mayAccessDesktopUpdates('settings'), true)
  assert.equal(mayAccessDesktopUpdates('main'), false)
  assert.equal(mayInvokeShellAction('about', 'whats-new'), true)
  assert.equal(mayInvokeShellAction('about', 'feedback'), true)
  assert.equal(mayInvokeShellAction('about', 'quit'), false)
  assert.equal(mayInvokeShellAction('shortcuts', 'quit'), false)
  assert.equal(mayInvokeShellAction('main', 'quit'), true)
})
