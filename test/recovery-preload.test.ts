import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

test('恢复页 preload 仅暴露固定的恢复操作', async () => {
  const source = await readFile(new URL('../src/recovery-preload.cjs', import.meta.url), 'utf8')
  let exposed: Record<string, (...args: unknown[]) => unknown> | undefined
  const calls: Array<{ channel: string; args: unknown[] }> = []
  vm.runInNewContext(source, {
    exports: {},
    module: { exports: {} },
    require: () => ({
      contextBridge: { exposeInMainWorld: (_name: string, api: typeof exposed) => { exposed = api } },
      ipcRenderer: { invoke: (channel: string, ...args: unknown[]) => { calls.push({ channel, args }); return Promise.resolve() } },
    }),
  })
  assert.deepEqual(Object.keys(exposed ?? {}).sort(), ['activate', 'getStartupLog', 'getStatus', 'keepIsolated', 'restore', 'restoreHealthyConfig', 'returnToWorkbench', 'uninstall'])
  await exposed?.activate()
  await exposed?.getStartupLog()
  await exposed?.restore('third-party-plugin')
  await exposed?.restoreHealthyConfig()
  await exposed?.uninstall('third-party-plugin')
  assert.deepEqual(calls, [
    { channel: 'dsh-recovery:activate', args: [] },
    { channel: 'dsh-recovery:get-startup-log', args: [] },
    { channel: 'dsh-recovery:restore', args: ['third-party-plugin'] },
    { channel: 'dsh-recovery:restore-healthy-config', args: [] },
    { channel: 'dsh-recovery:uninstall', args: ['third-party-plugin'] },
  ])
})
