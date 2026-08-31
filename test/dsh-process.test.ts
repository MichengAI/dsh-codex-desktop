import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import test from 'node:test'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

import { APPLY_PLUGIN_UPDATES_IPC, DSH_WEB_LAUNCH_ARGS, isApplyPluginUpdatesIpc, isAuthenticatedBootstrapRedirect, resolveDesktopWebPort, startDsh, type DshServer } from '../src/dsh-process.js'

const projectRoot = resolve(import.meta.dirname, '..', '..')
const fixtureEntry = join(projectRoot, 'test', 'fixtures', 'dsh-fixture.mjs')
const bootstrapPath = join(projectRoot, 'dist', 'src', 'dsh-bootstrap.mjs')

test('等待分片就绪输出与 HTTP 健康检查', async () => {
  const server = await startFixture('chunked')
  try {
    const response = await fetch(`${server.url}asset.js`)
    assert.equal(response.status, 200)
  } finally {
    await server.stop()
  }
})

test('DSH 提前退出时报告错误', async () => {
  await assert.rejects(startFixture('exit'), /DSH 提前退出[\s\S]*cordis-plugin-group/)
})

test('DSH 未输出就绪地址时超时', async () => {
  await assertFixtureStoppedAfterFailure('silent', /DSH 启动超时/)
})

test('等待 alpha.2 分片输出完整 token 后再做健康检查', async () => {
  const server = await startFixture('authenticated')
  try {
    assert.match(server.url, /\?token=desktop-secret$/)
    const response = await fetch(server.url, { redirect: 'manual' })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('location'), '/')
    assert.equal(response.headers.has('set-cookie'), true)
  } finally {
    await server.stop()
  }
})

test('仅接受同源 loopback token 引导重定向', () => {
  const bootstrapUrl = 'http://127.0.0.1:31337/?token=desktop-secret'
  assert.equal(isAuthenticatedBootstrapRedirect(bootstrapUrl, new Response(null, {
    status: 303,
    headers: { location: '/', 'set-cookie': 'dsh_session=desktop; Path=/; HttpOnly' },
  })), true)
  assert.equal(isAuthenticatedBootstrapRedirect('http://127.0.0.1:31337/', new Response(null, {
    status: 303,
    headers: { location: '/', 'set-cookie': 'dsh_session=desktop; Path=/; HttpOnly' },
  })), false)
  assert.equal(isAuthenticatedBootstrapRedirect(bootstrapUrl, new Response(null, {
    status: 303,
    headers: { location: '/' },
  })), false)
  assert.equal(isAuthenticatedBootstrapRedirect(bootstrapUrl, new Response(null, {
    status: 303,
    headers: { location: 'http://example.com/', 'set-cookie': 'dsh_session=desktop; Path=/; HttpOnly' },
  })), false)
  assert.equal(isAuthenticatedBootstrapRedirect(bootstrapUrl, new Response(null, {
    status: 303,
    headers: { location: '//evil.example/', 'set-cookie': 'dsh_session=desktop; Path=/; HttpOnly' },
  })), false)
})

test('DSH 健康检查失败时会先结束子进程再报错', async () => {
  await assertFixtureStoppedAfterFailure('unhealthy', /未通过健康检查/)
})

test('重复关闭同一 DSH 子进程是安全的', async () => {
  const server = await startFixture('healthy')
  await Promise.all([server.stop(), server.stop()])
})

function startFixture(mode: 'authenticated' | 'chunked' | 'exit' | 'healthy' | 'silent' | 'unhealthy', startupTimeoutMs = 1_000, environment: NodeJS.ProcessEnv = {}): Promise<DshServer> {
  return startDsh({
    bootstrapPath,
    environment: { ...process.env, ...environment, DSH_FIXTURE_MODE: mode },
    nodeExecutable: process.execPath,
    runtime: { entry: fixtureEntry, root: projectRoot },
    startupTimeoutMs,
  })
}

async function assertFixtureStoppedAfterFailure(mode: 'silent' | 'unhealthy', message: RegExp): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-process-'))
  const pidFile = join(root, 'pid.txt')
  try {
    await assert.rejects(startFixture(mode, 1_000, { DSH_FIXTURE_PID_FILE: pidFile }), message)
    const pid = Number(await readFile(pidFile, 'utf8'))
    assert.throws(() => process.kill(pid, 0))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}


test('识别插件热更新 IPC', () => {
  assert.equal(isApplyPluginUpdatesIpc(APPLY_PLUGIN_UPDATES_IPC), true)
  assert.equal(isApplyPluginUpdatesIpc({ type: APPLY_PLUGIN_UPDATES_IPC }), true)
  assert.equal(isApplyPluginUpdatesIpc('shutdown'), false)
})

test('桌面启动 DSH 时必须禁止打开系统浏览器', () => {
  assert.deepEqual([...DSH_WEB_LAUNCH_ARGS], ['web', '--port', '0', '--no-open'])
})

test('本地联调可以复用已有 DSH Web origin', () => {
  assert.equal(resolveDesktopWebPort('13988'), '13988')
  assert.equal(resolveDesktopWebPort('0'), '0')
  assert.equal(resolveDesktopWebPort('65536'), '0')
  assert.equal(resolveDesktopWebPort('not-a-port'), '0')
})
