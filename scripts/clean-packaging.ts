import { existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { removePreparedPath } from './prepare-runtime.js'

const projectRoot = resolve(import.meta.dirname, '..', '..')

/** 本地打包残留。下次 prepare-runtime / pack 前应清掉，避免沿用旧 store.tgz。 */
export const PACKAGING_CLEAN_RELATIVE_PATHS = [
  'release',
  'runtime-node',
  'runtime-plugins',
  'runtime-dsh',
  'runtime-dsh.tgz',
  'runtime-dsh.tgz.sha256',
  'output/zip-smoke-current',
  'output/zip-smoke-current-complete',
  'output/zip-smoke-official-1061',
  'output/zip-smoke-baselines',
] as const

export async function cleanPackagingArtifacts(root = projectRoot): Promise<string[]> {
  const cleaned: string[] = []
  for (const relative of PACKAGING_CLEAN_RELATIVE_PATHS) {
    const target = resolve(root, relative)
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`拒绝清理项目外路径：${relative}`)
    }
    if (!existsSync(target)) continue
    await removePreparedPath(target)
    cleaned.push(relative)
  }
  return cleaned
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cleaned = await cleanPackagingArtifacts()
  if (cleaned.length === 0) console.log('没有需要清理的打包残留。')
  else for (const relative of cleaned) console.log(`已清理：${relative}`)
}
