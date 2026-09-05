import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { writeTextFileAtomic } from './atomic-file.js'

const CHECKPOINT_FILE = '.dsh-desktop-health-checkpoint.json'
const CHECKPOINT_VERSION = 1
const MAX_CONFIG_BYTES = 1_024 * 1_024

interface StoredProfileHealthCheckpoint {
  version: 1
  capturedAt: string
  packageJson: string
  cordisPatch: string | null
}

export interface ProfileHealthCheckpointSummary {
  capturedAt: string
}

function checkpointPath(profileDir: string): string {
  return join(profileDir, CHECKPOINT_FILE)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function parseCheckpoint(value: unknown): StoredProfileHealthCheckpoint | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const checkpoint = value as Partial<StoredProfileHealthCheckpoint>
  if (checkpoint.version !== CHECKPOINT_VERSION || !isTimestamp(checkpoint.capturedAt)
    || typeof checkpoint.packageJson !== 'string' || checkpoint.packageJson.length > MAX_CONFIG_BYTES
    || (checkpoint.cordisPatch !== null && (typeof checkpoint.cordisPatch !== 'string' || checkpoint.cordisPatch.length > MAX_CONFIG_BYTES))) return undefined
  return checkpoint as StoredProfileHealthCheckpoint
}

async function readCheckpoint(profileDir: string): Promise<StoredProfileHealthCheckpoint | undefined> {
  try {
    return parseCheckpoint(JSON.parse(await readFile(checkpointPath(profileDir), 'utf8')))
  } catch {
    return undefined
  }
}

/** 返回最近一次完整启动后保存的 Profile 配置检查点摘要。 */
export async function readProfileHealthCheckpoint(profileDir: string): Promise<ProfileHealthCheckpointSummary | undefined> {
  const checkpoint = await readCheckpoint(profileDir)
  return checkpoint === undefined ? undefined : { capturedAt: checkpoint.capturedAt }
}

/** 仅在实际加载失败后作为诊断线索，安装或版本变化本身不触发恢复。 */
export async function changedBundlesSinceHealthy(profileDir: string): Promise<string[]> {
  const checkpoint = await readCheckpoint(profileDir)
  if (checkpoint === undefined) return []
  const before = JSON.parse(checkpoint.packageJson) as { dependencies?: Record<string, string>; dsh?: { profile?: { bundles?: string[] } } }
  const after = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8')) as typeof before
  const previous = new Set(before.dsh?.profile?.bundles ?? [])
  return (after.dsh?.profile?.bundles ?? []).filter(name => !previous.has(name) || after.dependencies?.[name] !== before.dependencies?.[name])
}

/** 只保存 DSH 组合所需的声明文件；会话、项目和依赖目录从不进入检查点。 */
export async function captureProfileHealthCheckpoint(profileDir: string, capturedAt = new Date().toISOString()): Promise<void> {
  const packageJson = await readFile(join(profileDir, 'package.json'), 'utf8')
  if (packageJson.length > MAX_CONFIG_BYTES) throw new Error('Profile package.json 超过健康检查点大小限制。')
  const cordisPatch = await readFile(join(profileDir, 'cordis.patch.yml'), 'utf8').catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  })
  if (cordisPatch !== null && cordisPatch.length > MAX_CONFIG_BYTES) throw new Error('Profile cordis.patch.yml 超过健康检查点大小限制。')
  const checkpoint: StoredProfileHealthCheckpoint = {
    version: CHECKPOINT_VERSION,
    capturedAt,
    packageJson,
    cordisPatch,
  }
  await writeTextFileAtomic(checkpointPath(profileDir), `${JSON.stringify(checkpoint, undefined, 2)}\n`)
}

/** 用户确认后恢复最近一次健康 Profile 配置；不安装、不删除任何插件文件。 */
export async function restoreProfileHealthCheckpoint(profileDir: string): Promise<ProfileHealthCheckpointSummary> {
  const checkpoint = await readCheckpoint(profileDir)
  if (checkpoint === undefined) throw new Error('未找到可用的健康配置检查点。')
  await writeTextFileAtomic(join(profileDir, 'package.json'), checkpoint.packageJson)
  const patchPath = join(profileDir, 'cordis.patch.yml')
  if (checkpoint.cordisPatch === null) await rm(patchPath, { force: true })
  else await writeTextFileAtomic(patchPath, checkpoint.cordisPatch)
  return { capturedAt: checkpoint.capturedAt }
}
