import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  beginStartupDiagnostic,
  completeStartupDiagnostic,
  failStartupDiagnostic,
  readStartupDiagnostic,
  suspectedPluginFromRendererReport,
} from '../src/startup-diagnostics.js'

test('结构化渲染器报告只接受合法的包名，并返回首个可处理插件', () => {
  assert.equal(suspectedPluginFromRendererReport({ status: 'failed', plugins: ['@scope/broken-plugin', 'not a package'] }), '@scope/broken-plugin')
  assert.equal(suspectedPluginFromRendererReport({ status: 'failed', plugins: ['not a package'] }), undefined)
  assert.equal(suspectedPluginFromRendererReport({ status: 'healthy' }), undefined)
})

test('启动诊断记录阶段、故障插件和最近一次健康启动时间', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-startup-diagnostics-'))
  const path = join(root, 'startup-diagnostics.json')
  try {
    await beginStartupDiagnostic(path, 'server-starting', '2026-09-03T00:00:00.000Z')
    await failStartupDiagnostic(path, {
      stage: 'renderer-loading',
      source: 'renderer',
      message: '插件加载失败',
      plugins: ['third-party-plugin'],
    }, '2026-09-03T00:00:01.000Z')
    assert.deepEqual(await readStartupDiagnostic(path), {
      version: 1,
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
      startedAt: '2026-09-03T00:00:00.000Z',
      stage: 'healthy',
      lastHealthyAt: '2026-09-03T00:00:02.000Z',
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
