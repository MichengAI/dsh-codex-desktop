import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  desktopPluginOperationMarkerPath,
  isPluginOperationActive,
  parsePluginOperationPid,
  pluginRunRecordPath,
  waitForProfileQuiet,
} from '../src/profile-quiet.js'

/** 取一个已经退出进程的 pid，用来验证陈旧记录不被当成进行中的操作。 */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' })
  const pid = child.pid
  await new Promise<void>(resolve => { child.once('exit', () => resolve()) })
  assert.equal(typeof pid, 'number')
  return pid as number
}

interface QuietStep {
  readonly market?: boolean
  readonly run?: boolean
}

/**
 * 按时间线驱动两个信号：同一轮里两个信号读同一行，暂停一次才前进一行。
 * 直接用两个数组会在短路求值下错位（market 忙碌时 run 根本不会被读取）。
 */
function quietHarness(timeline: readonly QuietStep[]): {
  signals: { marketBusy: () => Promise<boolean>, pluginOperationActive: () => boolean }
  pause: () => Promise<void>
  pauses: () => number
} {
  let step = 0
  let pauses = 0
  const at = (): QuietStep => timeline[Math.min(step, timeline.length - 1)] ?? {}
  return {
    signals: {
      marketBusy: async () => at().market === true,
      pluginOperationActive: () => at().run === true,
    },
    pause: async () => {
      pauses += 1
      step += 1
    },
    pauses: () => pauses,
  }
}

test('插件操作记录只接受合法的正数 pid', () => {
  assert.equal(parsePluginOperationPid('{"pid":1234}'), 1234)
  assert.equal(parsePluginOperationPid('{"pid":2147483648}'), undefined)
  assert.equal(parsePluginOperationPid('{"pid":0}'), undefined)
  assert.equal(parsePluginOperationPid('{"pid":-2}'), undefined)
  assert.equal(parsePluginOperationPid('{"pid":1.5}'), undefined)
  assert.equal(parsePluginOperationPid('{"pid":"1234"}'), undefined)
  assert.equal(parsePluginOperationPid('{"grouped":true}'), undefined)
  assert.equal(parsePluginOperationPid('not json'), undefined)
})

test('没有记录文件时视为没有插件操作在飞', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-quiet-empty-'))
  try {
    assert.equal(isPluginOperationActive(root), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('core 插件管理器写下的 run.json 记录进行中的 pnpm 操作', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-quiet-run-'))
  try {
    await mkdir(join(root, '.plugin-manager'), { recursive: true })
    await writeFile(join(root, 'package.json.lock'), `${process.pid}\n`)
    await writeFile(pluginRunRecordPath(root), `${JSON.stringify({ pid: process.pid, grouped: true })}\n`, 'utf8')
    assert.equal(isPluginOperationActive(root), true)
    await writeFile(pluginRunRecordPath(root), `${JSON.stringify({ pid: await deadPid(), grouped: true })}\n`, 'utf8')
    assert.equal(isPluginOperationActive(root), true, 'pnpm 已退出但 core 仍可能在校准 bundle')
    assert.equal(existsSync(pluginRunRecordPath(root)), true)
    await rm(pluginRunRecordPath(root))
    assert.equal(isPluginOperationActive(root), true, 'run 缺失时活 lock owner 仍保护校准')
    await rm(join(root, 'package.json.lock'))
    assert.equal(isPluginOperationActive(root), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('core 的孤儿 run 记录不会永久阻塞且读取方不删除记录', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orphan-run-'))
  try {
    await mkdir(join(root, '.plugin-manager'), { recursive: true })
    const pid = await deadPid()
    for (const lock of [undefined, `${pid}\n`]) {
      if (lock !== undefined) await writeFile(join(root, 'package.json.lock'), lock)
      for (const record of [JSON.stringify({ pid, grouped: false }), '{', 'null', '{"pid":2147483648}']) {
        await writeFile(pluginRunRecordPath(root), record)
        assert.equal(isPluginOperationActive(root), false)
        assert.equal(existsSync(pluginRunRecordPath(root)), true)
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('POSIX grouped run 使用负 pid 探测存活后代，Windows 只探测正 pid（注入平台）', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-grouped-run-'))
  try {
    await mkdir(join(root, '.plugin-manager'))
    await writeFile(pluginRunRecordPath(root), JSON.stringify({ pid: 123456, grouped: true }))
    const targets: number[] = []
    const kill = (target: number): void => {
      targets.push(target)
      if (target > 0) throw Object.assign(new Error('gone'), { code: 'ESRCH' })
    }
    assert.equal(isPluginOperationActive(root, { platform: 'linux', kill }), true)
    assert.deepEqual(targets, [-123456])
    targets.length = 0
    assert.equal(isPluginOperationActive(root, { platform: 'win32', kill }), false)
    assert.deepEqual(targets, [123456])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('只有 ESRCH 才证明 core 进程退出，权限或未知错误仍阻止重载', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-probe-errors-'))
  try {
    await writeFile(join(root, 'package.json.lock'), '123456\n')
    for (const code of ['EPERM', 'EACCES', 'EIO', 'EINVAL']) {
      assert.equal(isPluginOperationActive(root, {
        kill: () => { throw Object.assign(new Error(code), { code }) },
      }), true, code)
    }
    assert.equal(isPluginOperationActive(root, {
      kill: () => { throw Object.assign(new Error('gone'), { code: 'ESRCH' }) },
    }), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('半写锁先等待，内容稳定超过宽限才忽略，内容变化重新等待', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-partial-lock-'))
  try {
    const path = join(root, 'package.json.lock')
    let now = 0
    const probe = (): boolean => isPluginOperationActive(root, { now: () => now })
    await writeFile(path, '')
    assert.equal(probe(), true)
    now = 1_000
    assert.equal(probe(), true)
    now = 2_000
    assert.equal(probe(), false)
    assert.equal(existsSync(path), true, '不删除 core 文件')
    await writeFile(path, '{')
    assert.equal(probe(), true, '内容变化必须重置宽限')
    now = 4_000
    assert.equal(probe(), false)
    await writeFile(path, `${process.pid}\n`)
    now = 1_000_000
    assert.equal(probe(), true, '有效活 owner 绝不凭年龄放行')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('无法读取 core run/lock 时保持等待而非当成文件不存在', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-unreadable-core-'))
  try {
    await mkdir(pluginRunRecordPath(root), { recursive: true })
    assert.equal(isPluginOperationActive(root), true, '目录型 run 的 EISDIR 不证明操作已结束')
    await rm(pluginRunRecordPath(root), { recursive: true })
    await mkdir(join(root, 'package.json.lock'))
    assert.equal(isPluginOperationActive(root), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('忽略陈旧或稳定损坏记录时提供路径诊断，活 owner 不报孤儿', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-stale-diagnostic-'))
  try {
    await mkdir(join(root, '.plugin-manager'))
    await writeFile(pluginRunRecordPath(root), '{')
    const diagnostics: { reason: string, path: string }[] = []
    let now = 0
    const options = { now: () => now, onDiagnostic: (value: { reason: string, path: string }) => diagnostics.push(value) }
    assert.equal(isPluginOperationActive(root, options), false)
    assert.deepEqual(diagnostics, [{ reason: 'orphan-run', path: pluginRunRecordPath(root) }])
    diagnostics.length = 0
    await writeFile(join(root, 'package.json.lock'), '')
    assert.equal(isPluginOperationActive(root, options), true)
    assert.equal(diagnostics.length, 0)
    now = 2_000
    assert.equal(isPluginOperationActive(root, options), false)
    assert.deepEqual(diagnostics.map(value => value.reason), ['malformed-lock', 'orphan-run'])
    diagnostics.length = 0
    await writeFile(join(root, 'package.json.lock'), `${process.pid}\n`)
    assert.equal(isPluginOperationActive(root, options), true)
    assert.equal(diagnostics.length, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('owner 已死但 pnpm 仍活时继续等待，即使锁已消失', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-orphan-live-run-'))
  try {
    await mkdir(join(root, '.plugin-manager'))
    await writeFile(pluginRunRecordPath(root), JSON.stringify({ pid: process.pid, grouped: false }))
    await writeFile(join(root, 'package.json.lock'), `${await deadPid()}\n`)
    assert.equal(isPluginOperationActive(root), true)
    await rm(join(root, 'package.json.lock'))
    assert.equal(isPluginOperationActive(root), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('桌面桥接写下的操作标记同样表示安装后处理尚未结束', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-quiet-marker-'))
  try {
    await writeFile(desktopPluginOperationMarkerPath(root), `${JSON.stringify({ pid: process.pid })}\n`, 'utf8')
    assert.equal(isPluginOperationActive(root), true)
    await writeFile(desktopPluginOperationMarkerPath(root), `${JSON.stringify({ pid: await deadPid() })}\n`, 'utf8')
    assert.equal(isPluginOperationActive(root), false)
    // 读取方不清理旧版共享文件，避免检查和删除之间写入方替换记录的竞争。
    assert.equal(existsSync(desktopPluginOperationMarkerPath(root)), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('读取空或非法旧标记不会删除写入方的文件', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-partial-marker-'))
  try {
    for (const content of ['', '{', 'null', '{"pid":"bad"}']) {
      const path = desktopPluginOperationMarkerPath(root)
      await writeFile(path, content)
      assert.equal(isPluginOperationActive(root), false)
      assert.equal(existsSync(path), true, '读取方不得把瞬态坏记录当陈旧文件删除')
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('全部信号静默且跨过安静窗口后才允许重启', async () => {
  let pauses = 0
  const settled = await waitForProfileQuiet(
    {
      marketBusy: async () => false,
      pluginOperationActive: () => false,
    },
    async () => { pauses += 1 },
    { maxWaitMs: 10_000, pollIntervalMs: 1_000, quietWindows: 2 },
  )
  assert.equal(settled, true)
  assert.equal(pauses, 1)
})

test('市场忙碌或插件操作在飞时都不重启，直到两者都静默', async () => {
  const harness = quietHarness([{ market: true }, { market: true }, { run: true }, {}, {}, {}])
  const settled = await waitForProfileQuiet(harness.signals, harness.pause, {
    maxWaitMs: 10_000,
    pollIntervalMs: 1_000,
    quietWindows: 2,
  })
  assert.equal(settled, true)
  // 三轮忙碌各暂停一次，之后需要两个安静窗口，其中最后一个不再暂停。
  assert.equal(harness.pauses(), 4)
})

test('信号一直不静默时在等待上限后返回超时而非无限轮询', async () => {
  let pauses = 0
  const settled = await waitForProfileQuiet(
    {
      marketBusy: async () => false,
      pluginOperationActive: () => true,
    },
    async () => { pauses += 1 },
    { maxWaitMs: 2_000, pollIntervalMs: 1_000, quietWindows: 2 },
  )
  assert.equal(settled, false)
  assert.equal(pauses, 2)
})

test('真实进程持有标记时等待不会结束，进程退出后才放行', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-quiet-live-'))
  // 子进程把自己的 pid 写进标记，模拟 core/桥接在 pnpm 运行期间留下的记录。
  const child = spawn(process.execPath, ['-e', `
    const { mkdirSync, writeFileSync } = require('node:fs')
    const { join } = require('node:path')
    const dir = process.argv[1]
    mkdirSync(join(dir, '.plugin-manager'), { recursive: true })
    writeFileSync(join(dir, 'package.json.lock'), String(process.ppid) + '\\n')
    writeFileSync(join(dir, '.plugin-manager', 'run.json'), JSON.stringify({ pid: process.pid, grouped: false }) + '\\n')
    writeFileSync(join(dir, '.desktop-plugin-operation.json'), JSON.stringify({ pid: process.pid }) + '\\n')
    setInterval(() => undefined, 1_000)
  `, root], { stdio: 'ignore' })
  try {
    // 等记录真正落盘。
    const deadline = Date.now() + 5_000
    while (!existsSync(pluginRunRecordPath(root)) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    assert.equal(isPluginOperationActive(root), true)
    let settled: boolean | undefined
    const waiting = waitForProfileQuiet(
      { marketBusy: async () => false, pluginOperationActive: () => isPluginOperationActive(root) },
      () => new Promise(resolve => setTimeout(resolve, 30)),
      { maxWaitMs: 10_000, pollIntervalMs: 30, quietWindows: 2 },
    ).then(value => { settled = value })
    await new Promise(resolve => setTimeout(resolve, 300))
    assert.equal(settled, undefined, '记录里的进程还活着时不能放行')
    child.kill()
    // core 在 pnpm 退出后继续校准，完成后才由 core 自己删除记录。
    await new Promise(resolve => setTimeout(resolve, 60))
    assert.equal(settled, undefined, 'core 记录还在时仍不得放行')
    await rm(pluginRunRecordPath(root))
    await rm(join(root, 'package.json.lock'))
    await waiting
    assert.equal(settled, true)
  } finally {
    child.kill()
    await rm(root, { recursive: true, force: true })
  }
})

test('安静窗口内重新出现操作会重新计数', async () => {
  const harness = quietHarness([{}, { run: true }, {}, {}, {}])
  const settled = await waitForProfileQuiet(harness.signals, harness.pause, {
    maxWaitMs: 10_000,
    pollIntervalMs: 1_000,
    quietWindows: 2,
  })
  assert.equal(settled, true)
  assert.equal(harness.pauses(), 3)
})
