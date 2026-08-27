import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { SHELL_IPC } from '../src/shell-contract.js'

function channelLiterals(source: string): string[] {
  return [...source.matchAll(/'([^']+)'/g)]
    .map(match => match[1]!)
    .filter(value => value.startsWith('dsh-shell:'))
    .sort()
}

test('sandbox preload 的 IPC 字面量与主契约保持一致', async () => {
  const shell = await readFile(new URL('../../src/shell-preload.cts', import.meta.url), 'utf8')
  const dsh = await readFile(new URL('../../src/dsh-view-preload.cts', import.meta.url), 'utf8')
  assert.deepEqual(channelLiterals(shell), [SHELL_IPC.action, SHELL_IPC.bootstrap, SHELL_IPC.desktopUpdateAction, SHELL_IPC.desktopUpdateState, SHELL_IPC.getBootstrap, SHELL_IPC.getDesktopUpdateState, SHELL_IPC.getNotificationPreferences, SHELL_IPC.getUpdatePreferences, SHELL_IPC.popupMenu, SHELL_IPC.settingsSection, SHELL_IPC.state, SHELL_IPC.updateNotificationPreferences, SHELL_IPC.updateUpdatePreferences].sort())
  assert.deepEqual(channelLiterals(dsh), [SHELL_IPC.dshAction, SHELL_IPC.dshLocale, SHELL_IPC.dshNotification, SHELL_IPC.dshNotificationReply, SHELL_IPC.dshOpenSession, SHELL_IPC.dshState, SHELL_IPC.dshTheme].sort())
})
