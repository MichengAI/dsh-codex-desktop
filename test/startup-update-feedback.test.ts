import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { assertNoStartupErrors } from '../scripts/smoke-startup-errors.mjs'

test('补种和待应用更新失败均显示原因，冒烟模式不等待弹窗', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  const helper = /^async function showStartupPluginWarning\([\s\S]*?^\}/m.exec(source)?.[0]
  assert.ok(helper)
  const dialogs: Array<{ message: string; detail: string }> = []
  const env: Record<string, string> = {}
  const scope = vm.createContext({ process: { env }, desktopText: (zh: string) => zh,
    dialog: { async showMessageBox(options: typeof dialogs[number]) { dialogs.push(options) } } })
  vm.runInContext(helper, scope)
  for (const kind of ['seed', 'pending']) {
    await vm.runInContext(`showStartupPluginWarning('${kind}', '安装失败原因')`, scope)
  }
  assert.equal(dialogs.length, 2)
  assert.notEqual(dialogs[0].message, dialogs[1].message)
  assert.ok(dialogs.every(item => item.detail.includes('安装失败原因')))
  env.DSH_DESKTOP_SMOKE_READY_FILE = 'test-ready'
  for (const kind of ['seed', 'pending']) await vm.runInContext(`showStartupPluginWarning('${kind}', '失败')`, scope)
  assert.equal(dialogs.length, 2)
})

test('ready 不能掩盖本轮任意一种启动错误日志', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-smoke-errors-'))
  try {
    await writeFile(join(root, 'ready'), 'ready\n')
    assert.doesNotThrow(() => assertNoStartupErrors(root))
    for (const name of ['startup-error.log', 'plugin-seed.log', 'plugin-update.log']) {
      await writeFile(join(root, name), '依赖安装失败', 'utf8')
      assert.throws(() => assertNoStartupErrors(root), /依赖安装失败/)
      await rm(join(root, name))
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})
