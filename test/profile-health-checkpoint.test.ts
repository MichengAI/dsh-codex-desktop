import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { captureProfileHealthCheckpoint, readProfileHealthCheckpoint, restoreProfileHealthCheckpoint } from '../src/profile-health-checkpoint.js'

test('健康检查点仅保存并还原 Profile 配置文件，不处理 node_modules', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-profile-health-'))
  const profile = join(root, 'web')
  try {
    await mkdir(join(profile, 'node_modules', 'kept-package'), { recursive: true })
    await writeFile(join(profile, 'package.json'), '{"name":"healthy"}\n', 'utf8')
    await writeFile(join(profile, 'cordis.patch.yml'), '- id: healthy\n', 'utf8')
    await writeFile(join(profile, 'node_modules', 'kept-package', 'marker.txt'), 'keep\n', 'utf8')

    await captureProfileHealthCheckpoint(profile, '2026-09-03T00:00:00.000Z')
    assert.deepEqual(await readProfileHealthCheckpoint(profile), {
      capturedAt: '2026-09-03T00:00:00.000Z',
    })

    await writeFile(join(profile, 'package.json'), '{"name":"broken"}\n', 'utf8')
    await writeFile(join(profile, 'cordis.patch.yml'), '- id: broken\n', 'utf8')
    await restoreProfileHealthCheckpoint(profile)

    assert.equal(await readFile(join(profile, 'package.json'), 'utf8'), '{"name":"healthy"}\n')
    assert.equal(await readFile(join(profile, 'cordis.patch.yml'), 'utf8'), '- id: healthy\n')
    assert.equal(await readFile(join(profile, 'node_modules', 'kept-package', 'marker.txt'), 'utf8'), 'keep\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
