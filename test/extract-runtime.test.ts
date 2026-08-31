import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

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
