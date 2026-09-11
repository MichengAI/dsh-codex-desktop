import assert from 'node:assert/strict'
import test from 'node:test'
import { formatStartupProgress, parsePnpmProgress } from '../src/startup-progress.js'

test('安装计数只接受 pnpm 进度行，不把日志或路径显示给用户', () => {
  assert.deepEqual(parsePnpmProgress('Progress: resolved 15, reused 12, downloaded 3, added 8'), {
    phase: 'install', detail: { resolved: 15, reused: 12, downloaded: 3, added: 8 },
  })
  assert.equal(parsePnpmProgress('ERR_PNPM_FAILED C:\\Users\\private'), undefined)
})

test('文件进度标明当前步骤，安装与启动不虚构百分比', () => {
  const files = formatStartupProgress({ phase: 'sync', completed: 3, total: 4 }, true)
  assert.equal(files.completed, 3)
  assert.equal(files.total, 4)
  assert.match(files.message, /同步/)
  assert.match(files.detail, /3.*4/)
  assert.equal(formatStartupProgress({ phase: 'server' }, false).total, undefined)
  assert.equal(formatStartupProgress({ phase: 'install', detail: { resolved: 15, reused: 12, downloaded: 3, added: 8 } }, true).total, undefined)
})
