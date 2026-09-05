import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

for (const missing of [undefined, 'zh', 'en'] as const) {
  test(`发布说明${missing === undefined ? '包含中文在前、英文在后的对应版本' : `缺少 ${missing} 时拒绝生成`}`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-release-notes-'))
    t.after(() => rm(root, { recursive: true, force: true }))
    if (missing !== 'zh') await writeFile(join(root, 'CHANGELOG.zh-CN.md'), '## 1.0.47\n\n中文修复说明\n\n## 1.0.46\n\n旧版中文\n', 'utf8')
    if (missing !== 'en') await writeFile(join(root, 'CHANGELOG.md'), '## 1.0.47\n\nEnglish fix notes\n\n## 1.0.46\n\nOld English notes\n', 'utf8')
    const output = join(root, 'notes.md')
    const result = spawnSync(process.execPath, [resolve('scripts/extract-release-notes.mjs'), 'v1.0.47', output], { cwd: root, encoding: 'utf8' })
    if (missing !== undefined) {
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /Both Chinese and English changelog sections are required/)
      await assert.rejects(readFile(output), { code: 'ENOENT' })
      return
    }
    assert.equal(result.status, 0, result.stderr)
    assert.equal(await readFile(output, 'utf8'), '## 中文说明\n\n中文修复说明\n\n---\n\n## English\n\nEnglish fix notes\n')
  })
}
