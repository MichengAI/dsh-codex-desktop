import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  advanceStartupDiagnostic,
  beginStartupDiagnostic,
  completeStartupDiagnostic,
  failStartupDiagnostic,
  noteStartupDiagnostic,
  readStartupDiagnostic,
  parseRendererBootReport,
  suspectedPluginFromRendererReport,
} from '../src/startup-diagnostics.js'

test('工作台可用性只接受布尔值，兼容不携带该字段的旧报告', () => {
  const report = { status: 'failed', plugins: ['broken-plugin'] }
  assert.deepEqual(parseRendererBootReport(report), report)
  assert.deepEqual(parseRendererBootReport({ ...report, workbenchReady: true }), { ...report, workbenchReady: true })
  assert.deepEqual(parseRendererBootReport({ ...report, workbenchReady: false }), { ...report, workbenchReady: false })
  assert.equal(parseRendererBootReport({ ...report, workbenchReady: 'true' }), undefined)
})

test('结构化渲染器报告只接受合法的包名，并返回首个可处理插件', () => {
  assert.equal(suspectedPluginFromRendererReport({ status: 'failed', plugins: ['@scope/broken-plugin', 'not a package'] }), '@scope/broken-plugin')
  assert.equal(suspectedPluginFromRendererReport({ status: 'failed', plugins: ['not a package'] }), undefined)
  assert.equal(suspectedPluginFromRendererReport({ status: 'healthy' }), undefined)
})

test('启动诊断记录阶段、故障插件和最近一次健康启动时间', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-startup-diagnostics-'))
  const path = join(root, 'startup-diagnostics.json')
  try {
    await beginStartupDiagnostic(path, 'server-starting', { startedAt: '2026-09-03T00:00:00.000Z' })
    await failStartupDiagnostic(path, {
      stage: 'renderer-loading',
      source: 'renderer',
      message: '插件加载失败',
      plugins: ['third-party-plugin'],
    }, '2026-09-03T00:00:01.000Z')
    assert.deepEqual(await readStartupDiagnostic(path), {
      version: 1,
      mode: 'normal',
      startedAt: '2026-09-03T00:00:00.000Z',
      stage: 'renderer-loading',
      failure: {
        source: 'renderer',
        message: '插件加载失败',
        plugins: ['third-party-plugin'],
        occurredAt: '2026-09-03T00:00:01.000Z',
      },
    })

    await completeStartupDiagnostic(path, '2026-09-03T00:00:02.000Z')
    const persisted = await readFile(path, 'utf8')
    assert.match(persisted, /"lastHealthyAt": "2026-09-03T00:00:02.000Z"/)
    assert.deepEqual(await readStartupDiagnostic(path), {
      version: 1,
      mode: 'normal',
      startedAt: '2026-09-03T00:00:00.000Z',
      stage: 'healthy',
      lastHealthyAt: '2026-09-03T00:00:02.000Z',
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('登录告警只追加到进行中的诊断，并在阶段变化后保留', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-startup-diagnostics-'))
  const path = join(root, 'startup-diagnostics.json')
  try {
    await noteStartupDiagnostic(path, '未能监听登录通道')
    await assert.rejects(access(path))

    await beginStartupDiagnostic(path, 'server-starting', { startedAt: '2026-09-03T00:00:00.000Z' })
    await Promise.all([
      noteStartupDiagnostic(path, '第一条'),
      noteStartupDiagnostic(path, '第二条'),
    ])
    for (let index = 3; index <= 8; index += 1) await noteStartupDiagnostic(path, `第${index}条`)
    await noteStartupDiagnostic(path, `登录告警 ${'x'.repeat(600)}`)
    const noted = await readStartupDiagnostic(path)
    assert.equal(noted?.warnings?.length, 8)
    assert.equal(noted?.warnings?.[0], '第二条')
    assert.equal(noted?.warnings?.at(-1)?.length, 500)

    await advanceStartupDiagnostic(path, 'renderer-loading')
    await failStartupDiagnostic(path, {
      stage: 'renderer-loading',
      source: 'process',
      message: '启动失败',
      plugins: [],
    }, '2026-09-03T00:00:01.000Z')
    assert.equal((await readStartupDiagnostic(path))?.warnings?.length, 8)

    await completeStartupDiagnostic(path, '2026-09-03T00:00:02.000Z')
    assert.equal((await readStartupDiagnostic(path))?.warnings?.length, 8)

    await beginStartupDiagnostic(path, 'server-starting', { startedAt: '2026-09-03T00:01:00.000Z' })
    assert.equal((await readStartupDiagnostic(path))?.warnings, undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('恢复会话健康不会覆盖最近一次正常健康时间', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-startup-diagnostics-'))
  const path = join(root, 'startup-diagnostics.json')
  try {
    await writeFile(path, JSON.stringify({
      version: 1,
      mode: 'recovery',
      startedAt: '2026-09-03T01:00:00.000Z',
      stage: 'renderer-loading',
      lastHealthyAt: '2026-09-03T00:00:00.000Z',
    }), 'utf8')

    await completeStartupDiagnostic(path, '2026-09-03T01:00:02.000Z')

    assert.deepEqual(await readStartupDiagnostic(path), {
      version: 1,
      mode: 'recovery',
      startedAt: '2026-09-03T01:00:00.000Z',
      stage: 'healthy',
      lastHealthyAt: '2026-09-03T00:00:00.000Z',
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
