import assert from 'node:assert/strict'
import { link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { extractTarGz, materializeHardlinks, packDirectoryToTarGz, validateArchiveEntries } from '../src/runtime-archive.js'

test('目录可以打成 tar.gz 再解回原结构', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-archive-'))
  try {
    const source = join(root, 'source')
    const dest = join(root, 'dest')
    const archive = join(root, 'bundle.tgz')
    await mkdir(join(source, 'nested'), { recursive: true })
    await writeFile(join(source, 'nested', 'ok.txt'), 'ready', 'utf8')
    packDirectoryToTarGz(source, archive)
    extractTarGz(archive, dest)
    assert.equal(await readFile(join(dest, 'nested', 'ok.txt'), 'utf8'), 'ready')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('目录外硬链接会先落成普通文件再打包', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-hardlink-'))
  try {
    const outside = join(root, 'outside.txt')
    const source = join(root, 'source')
    await writeFile(outside, 'tarball', 'utf8')
    await mkdir(source)
    await link(outside, join(source, 'inside.txt'))
    assert.equal(await materializeHardlinks(source), 1)
    packDirectoryToTarGz(source, join(root, 'bundle.tgz'))
    extractTarGz(join(root, 'bundle.tgz'), join(root, 'dest'))
    assert.equal(await readFile(join(root, 'dest', 'inside.txt'), 'utf8'), 'tarball')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('解压前拒绝绝对路径和目录穿越条目', () => {
  assert.doesNotThrow(() => validateArchiveEntries(['./nested/ok.txt']))
  assert.throws(() => validateArchiveEntries(['../escape.txt']), /不安全/)
  assert.throws(() => validateArchiveEntries(['/absolute.txt']), /不安全/)
  assert.throws(() => validateArchiveEntries(['C:\\absolute.txt']), /不安全/)
})
