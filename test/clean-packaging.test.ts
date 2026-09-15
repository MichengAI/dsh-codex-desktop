import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { cleanPackagingArtifacts, PACKAGING_CLEAN_RELATIVE_PATHS } from '../scripts/clean-packaging.js'

test('打包清理覆盖运行时残留和 release，不含用户 Profile', async () => {
  const source = await readFile(new URL('../../scripts/clean-packaging.ts', import.meta.url), 'utf8')
  const manifest = await readFile(new URL('../../package.json', import.meta.url), 'utf8')
  assert.ok(PACKAGING_CLEAN_RELATIVE_PATHS.includes('runtime-plugins'))
  assert.ok(PACKAGING_CLEAN_RELATIVE_PATHS.includes('runtime-node'))
  assert.ok(PACKAGING_CLEAN_RELATIVE_PATHS.includes('release'))
  assert.doesNotMatch(source, /USERPROFILE|\.dsh[\\/]|src[\\/]/)
  assert.match(manifest, /"clean": "pnpm run build && node dist\/scripts\/clean-packaging\.js"/)
  assert.match(manifest, /"pack": "pnpm run clean && pnpm run prepare-runtime && electron-builder --dir"/)
  assert.match(manifest, /"dist": "pnpm run clean && pnpm run prepare-runtime && electron-builder --publish never"/)
})

test('清理只删除列出的残留目录，保留其他文件', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-clean-packaging-'))
  try {
    await mkdir(join(root, 'runtime-plugins'), { recursive: true })
    await writeFile(join(root, 'runtime-plugins', 'store.tgz'), 'stale', 'utf8')
    await mkdir(join(root, 'release'), { recursive: true })
    await writeFile(join(root, 'release', 'app.zip'), 'zip', 'utf8')
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src', 'main.ts'), 'keep', 'utf8')
    const cleaned = await cleanPackagingArtifacts(root)
    assert.deepEqual(cleaned.sort(), ['release', 'runtime-plugins'].sort())
    assert.equal(existsSync(join(root, 'runtime-plugins')), false)
    assert.equal(existsSync(join(root, 'release')), false)
    assert.equal(existsSync(join(root, 'src', 'main.ts')), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
