import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { cloneTreeForArchive, extractTarGz, materializeHardlinks, packDirectoryToTarGz, validateArchiveEntries } from '../src/runtime-archive.js'

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
  assert.throws(() => validateArchiveEntries(['C:/absolute.txt']), /不安全/)
})

test('WAL 里的包索引会写入主库，去掉 WAL 后仍然能读到', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-archive-wal-'))
  try {
    const store = join(root, 'store')
    await mkdir(join(store, 'v11'), { recursive: true })
    const db = new DatabaseSync(join(store, 'v11', 'index.db'))
    db.exec('PRAGMA journal_mode=WAL')
    db.exec('PRAGMA wal_autocheckpoint=0')
    db.exec('CREATE TABLE package_index (key TEXT PRIMARY KEY, data BLOB NOT NULL)')
    db.prepare('INSERT INTO package_index (key, data) VALUES (?, ?)').run('sha512-abc\tlucide-react@1.48.0', Buffer.from('row'))
    db.close()
    const snapshot = join(root, 'snapshot')
    await cloneTreeForArchive(store, snapshot)
    assert.equal(existsSync(join(snapshot, 'v11', 'index.db-wal')), false)
    const packed = new DatabaseSync(join(snapshot, 'v11', 'index.db'), { readOnly: true })
    try {
      const row = packed.prepare('SELECT count(*) AS n FROM package_index').get() as { n: number }
      assert.equal(row.n, 1)
    } finally {
      packed.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
