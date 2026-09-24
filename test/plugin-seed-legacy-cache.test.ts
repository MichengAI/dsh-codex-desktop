import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

import { prepareBundledPluginStore } from '../src/plugin-seed.js'

/** 随包仓库校验只要求 v11、cache、v11/files 和带索引表的 index.db。 */
async function createBundledStore(root: string): Promise<string> {
  const store = join(root, 'bundled-store')
  await mkdir(join(store, 'v11', 'files'), { recursive: true })
  await mkdir(join(store, 'cache', 'v11', 'metadata', 'registry.npmjs.org'), { recursive: true })
  const db = new DatabaseSync(join(store, 'v11', 'index.db'))
  db.exec('CREATE TABLE package_index (key TEXT PRIMARY KEY, data BLOB NOT NULL) WITHOUT ROWID')
  db.prepare('INSERT INTO package_index VALUES (?, ?)').run('bundled', Buffer.from('bundled'))
  db.close()
  return store
}

test('离线升级会并入本机旧 pnpm 元数据缓存，老 lockfile 引用的包也能离线校验', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-seed-legacy-cache-'))
  try {
    const store = await createBundledStore(root)
    const home = join(root, 'home')
    const cacheHome = join(home, '.cache')
    // 旧版桌面端联网安装时写下的缩写元数据缓存：老 Profile 的 lockfile 指向 cosmokit@1.8.1。
    const legacyMetadata = join(cacheHome, 'pnpm', 'v11', 'metadata', 'registry.npmjs.org')
    await mkdir(legacyMetadata, { recursive: true })
    await writeFile(join(legacyMetadata, 'cosmokit.jsonl'), '{ "name": "cosmokit" }\n', 'utf8')
    await writeFile(join(legacyMetadata, '@kenz1117.jsonl'), '{ "name": "@kenz1117" }\n', 'utf8')

    const storeDir = join(home, '.local', 'share', 'pnpm', 'store', 'v11')
    const profile = join(home, 'profiles', 'web')
    await mkdir(join(profile, 'node_modules'), { recursive: true })
    await writeFile(join(profile, 'node_modules', '.modules.yaml'), JSON.stringify({ storeDir }), 'utf8')

    const options = await prepareBundledPluginStore(profile, store, undefined, {
      HOME: home, USERPROFILE: home, XDG_CACHE_HOME: cacheHome, LOCALAPPDATA: join(home, 'AppData', 'Local'),
    })

    assert.equal(options.cacheDir, join(home, '.local', 'share', 'pnpm', 'store', 'cache'))
    const metadata = join(options.cacheDir, 'v11', 'metadata', 'registry.npmjs.org', 'cosmokit.jsonl')
    const metadataFull = join(options.cacheDir, 'v11', 'metadata-full', 'registry.npmjs.org', 'cosmokit.jsonl')
    assert.ok(existsSync(metadata), '缩写元数据应并入仓库缓存')
    assert.ok(existsSync(metadataFull), '校验只认 metadata-full，必须补上同名文件')
    assert.ok(existsSync(join(options.cacheDir, 'v11', 'metadata', 'registry.npmjs.org', '@kenz1117.jsonl')), '旧缓存里的其他包也应一并并入')
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

test('仓库无法沿用旧 store 时不向随包仓库写入用户缓存', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-seed-legacy-cache-'))
  try {
    const store = await createBundledStore(root)
    const home = join(root, 'home')
    const legacyMetadata = join(home, '.cache', 'pnpm', 'v11', 'metadata', 'registry.npmjs.org')
    await mkdir(legacyMetadata, { recursive: true })
    await writeFile(join(legacyMetadata, 'cosmokit.jsonl'), '{ "name": "cosmokit" }\n', 'utf8')

    const profile = join(home, 'profiles', 'web')
    await mkdir(profile, { recursive: true })

    const options = await prepareBundledPluginStore(profile, store, undefined, {
      HOME: home, USERPROFILE: home, XDG_CACHE_HOME: join(home, '.cache'), LOCALAPPDATA: join(home, 'AppData', 'Local'),
    })

    assert.equal(options.cacheDir, join(store, 'cache'))
    assert.equal(existsSync(join(store, 'cache', 'v11', 'metadata', 'registry.npmjs.org', 'cosmokit.jsonl')), false)
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})
