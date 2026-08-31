import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

import { packDirectoryToTarGz, writeFileSha256 } from '../src/runtime-archive.js'
import {
  RUNTIME_EXTRACTION_PROGRESS_PREFIX,
  extractPackagedRuntimes,
  extractPackagedRuntimesInChild,
  packagedRuntimesNeedExtraction,
  type RuntimeExtractionProgress,
} from '../src/extract-runtime.js'

function createChecksums(resources: string): void {
  writeFileSha256(join(resources, 'dsh-runtime.tgz'))
  writeFileSha256(join(resources, 'plugins-store.tgz'))
}

async function waitForProcessFile(path: string): Promise<number> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    try {
      const pid = Number((await readFile(path, 'utf8')).trim())
      if (Number.isInteger(pid) && pid > 0) return pid
    } catch {
      // 子进程尚未写入 PID。
    }
    await delay(25)
  }
  throw new Error(`等待子进程 PID 超时：${path}`)
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitForProcessExit(pid: number): Promise<void> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline && isProcessRunning(pid)) await delay(25)
  assert.equal(isProcessRunning(pid), false, `解压孙进程仍在运行：${pid}`)
}

async function createHangingExtractor(root: string): Promise<string> {
  const grandchildPath = join(root, 'grandchild.mjs')
  const extractorPath = join(root, 'hanging-extractor.mjs')
  await writeFile(grandchildPath, 'setInterval(() => undefined, 1_000)\n', 'utf8')
  await writeFile(extractorPath, [
    "import { spawn } from 'node:child_process'",
    "import { writeFileSync } from 'node:fs'",
    "import { join } from 'node:path'",
    "const child = spawn(process.execPath, [join(process.argv[2], 'grandchild.mjs')], { stdio: 'ignore' })",
    "writeFileSync(join(process.argv[2], 'grandchild.pid'), String(child.pid))",
    'setInterval(() => undefined, 1_000)',
  ].join('\n'), 'utf8')
  return extractorPath
}

test('已解压过的运行时不会重复解压，内容缺失时会自愈', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-extract-'))
  try {
    const resources = join(root, 'resources')
    const officialSrc = join(root, 'official')
    const storeSrc = join(root, 'store')
    await mkdir(join(officialSrc, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    await writeFile(join(officialSrc, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), 'ok', 'utf8')
    await mkdir(join(storeSrc, 'v11'), { recursive: true })
    await writeFile(join(storeSrc, 'v11', 'keep.txt'), 'store', 'utf8')
    await mkdir(resources, { recursive: true })
    packDirectoryToTarGz(officialSrc, join(resources, 'dsh-runtime.tgz'))
    packDirectoryToTarGz(storeSrc, join(resources, 'plugins-store.tgz'))
    createChecksums(resources)
    const runtimeDir = join(root, 'app', 'dsh-runtime')
    const storeDir = join(root, 'app', 'plugins', 'store')
    const progress: RuntimeExtractionProgress[] = []
    assert.equal(packagedRuntimesNeedExtraction(resources, runtimeDir, storeDir), true)
    assert.deepEqual(extractPackagedRuntimes(resources, runtimeDir, storeDir, event => progress.push(event)), { official: true, store: true })
    assert.deepEqual(progress, [
      { phase: 'runtime', state: 'start' },
      { phase: 'runtime', state: 'complete' },
      { phase: 'plugins', state: 'start' },
      { phase: 'plugins', state: 'complete' },
    ])
    assert.equal(packagedRuntimesNeedExtraction(resources, runtimeDir, storeDir), false)
    assert.deepEqual(extractPackagedRuntimes(resources, runtimeDir, storeDir), { official: false, store: false })
    await writeFile(join(runtimeDir, '.dsh-extract-complete'), '', 'utf8')
    await writeFile(join(storeDir, '.dsh-extract-complete'), '', 'utf8')
    await writeFile(join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), 'stale', 'utf8')
    assert.equal(packagedRuntimesNeedExtraction(resources, runtimeDir, storeDir), true)
    assert.deepEqual(extractPackagedRuntimes(resources, runtimeDir, storeDir), { official: true, store: true })
    assert.equal(await readFile(join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), 'utf8'), 'ok')
    assert.equal((await readFile(join(runtimeDir, '.dsh-extract-complete'), 'utf8')).trim(), (await readFile(join(resources, 'dsh-runtime.tgz.sha256'), 'utf8')).trim())
    assert.equal((await readFile(join(storeDir, '.dsh-extract-complete'), 'utf8')).trim(), (await readFile(join(resources, 'plugins-store.tgz.sha256'), 'utf8')).trim())
    await unlink(join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
    assert.deepEqual(extractPackagedRuntimes(resources, runtimeDir, storeDir), { official: true, store: false })
    assert.equal(await readFile(join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), 'utf8'), 'ok')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('便携版通过独立 Node 进程初始化并转发阶段进度', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-extract-child-'))
  try {
    const scriptPath = join(root, 'fake-extractor.mjs')
    await writeFile(scriptPath, [
      `console.log(${JSON.stringify(RUNTIME_EXTRACTION_PROGRESS_PREFIX)} + JSON.stringify({ phase: 'runtime', state: 'start' }))`,
      `console.log(${JSON.stringify(RUNTIME_EXTRACTION_PROGRESS_PREFIX)} + JSON.stringify({ phase: 'runtime', state: 'complete' }))`,
      `console.log(${JSON.stringify(RUNTIME_EXTRACTION_PROGRESS_PREFIX)} + JSON.stringify({ phase: 'plugins', state: 'start' }))`,
      `console.log(${JSON.stringify(RUNTIME_EXTRACTION_PROGRESS_PREFIX)} + JSON.stringify({ phase: 'plugins', state: 'complete' }))`,
    ].join('\n'), 'utf8')
    const progress: RuntimeExtractionProgress[] = []
    await extractPackagedRuntimesInChild({
      nodeExecutable: process.execPath,
      scriptPath,
      installDir: root,
      resourcesDir: root,
      onProgress: event => progress.push(event),
    })
    assert.deepEqual(progress, [
      { phase: 'runtime', state: 'start' },
      { phase: 'runtime', state: 'complete' },
      { phase: 'plugins', state: 'start' },
      { phase: 'plugins', state: 'complete' },
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('运行时初始化超时会等待并清理完整子进程树', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-extract-timeout-'))
  let grandchildPid: number | undefined
  try {
    const scriptPath = await createHangingExtractor(root)
    const extraction = extractPackagedRuntimesInChild({
      nodeExecutable: process.execPath,
      scriptPath,
      installDir: root,
      resourcesDir: root,
      timeoutMs: 200,
    })
    grandchildPid = await waitForProcessFile(join(root, 'grandchild.pid'))
    await assert.rejects(extraction, /初始化超时/)
    await waitForProcessExit(grandchildPid)
  } finally {
    if (grandchildPid !== undefined && isProcessRunning(grandchildPid)) process.kill(grandchildPid, 'SIGKILL')
    await rm(root, { recursive: true, force: true })
  }
})

test('主动取消运行时初始化会等待并清理完整子进程树', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-extract-abort-'))
  let grandchildPid: number | undefined
  try {
    const scriptPath = await createHangingExtractor(root)
    const controller = new AbortController()
    const extraction = extractPackagedRuntimesInChild({
      nodeExecutable: process.execPath,
      scriptPath,
      installDir: root,
      resourcesDir: root,
      signal: controller.signal,
    })
    grandchildPid = await waitForProcessFile(join(root, 'grandchild.pid'))
    controller.abort()
    await assert.rejects(extraction, /初始化已取消/)
    await waitForProcessExit(grandchildPid)
  } finally {
    if (grandchildPid !== undefined && isProcessRunning(grandchildPid)) process.kill(grandchildPid, 'SIGKILL')
    await rm(root, { recursive: true, force: true })
  }
})

test('运行时和插件仓库可以解压到用户数据回退目录', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-extract-fallback-'))
  try {
    const resources = join(root, 'resources')
    const officialSrc = join(root, 'official')
    const storeSrc = join(root, 'store')
    const runtimeDir = join(root, 'user-data', 'dsh-runtime')
    const storeDir = join(root, 'user-data', 'plugins', 'store')
    await mkdir(join(officialSrc, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    await writeFile(join(officialSrc, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), 'ok', 'utf8')
    await mkdir(join(storeSrc, 'v11'), { recursive: true })
    await writeFile(join(storeSrc, 'v11', 'keep.txt'), 'store', 'utf8')
    await mkdir(resources, { recursive: true })
    packDirectoryToTarGz(officialSrc, join(resources, 'dsh-runtime.tgz'))
    packDirectoryToTarGz(storeSrc, join(resources, 'plugins-store.tgz'))
    createChecksums(resources)
    assert.deepEqual(extractPackagedRuntimes(resources, runtimeDir, storeDir), { official: true, store: true })
    assert.equal(await readFile(join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), 'utf8'), 'ok')
    assert.equal(await readFile(join(storeDir, 'v11', 'keep.txt'), 'utf8'), 'store')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('随包归档被篡改时拒绝解压', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-extract-hash-'))
  try {
    const resources = join(root, 'resources')
    const source = join(root, 'source')
    await mkdir(join(source, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    await writeFile(join(source, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), 'ok', 'utf8')
    await mkdir(resources)
    const archive = join(resources, 'dsh-runtime.tgz')
    packDirectoryToTarGz(source, archive)
    writeFileSha256(archive)
    await writeFile(archive, 'tampered', 'utf8')
    assert.throws(() => extractPackagedRuntimes(resources, join(root, 'runtime'), join(root, 'store')), /SHA256/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
