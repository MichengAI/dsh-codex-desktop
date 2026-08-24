import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

test('shell preload 首帧同步暴露运行平台', async () => {
  const source = await readFile(new URL('../src/shell-preload.cjs', import.meta.url), 'utf8')
  let exposed: { platform?: string } | undefined
  vm.runInNewContext(source, {
    exports: {},
    module: { exports: {} },
    process: { platform: 'darwin' },
    require: () => ({
      contextBridge: { exposeInMainWorld: (_name: string, api: typeof exposed) => { exposed = api } },
      ipcRenderer: { invoke(): void {}, on(): void {}, removeListener(): void {} },
    }),
  })
  assert.equal(exposed?.platform, 'darwin')
})
