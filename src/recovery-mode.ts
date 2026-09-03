import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rename, rm } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { isAbsolute, join, relative, resolve } from 'node:path'

import { writeTextFileAtomic } from './atomic-file.js'
import { BUNDLED_PLUGINS, OFFICIAL_PROFILE_BUNDLES } from './bundled-plugins.js'

const RECOVERY_STATE_FILE = '.dsh-desktop-recovery.json'
const RECOVERY_BACKUP_FILE = '.dsh-desktop-recovery.package.json'
const RECOVERY_TRASH_DIR = '.dsh-desktop-recovery-trash'
const MAX_FAILURE_MESSAGE_LENGTH = 4_000

interface ProfileManifest {
  dependencies?: Record<string, string>
  dsh?: { profile?: { bundles?: string[] } }
}

interface RecoveryState {
  schemaVersion: 1
  enteredAt: string
  isolated: RecoveryPlugin[]
  pendingRestore: string[]
  suspectedPlugin?: string
  failureMessage?: string
  originalManifestSha256: string
}

export interface RecoveryPlugin {
  packageName: string
  version?: string
}

export interface RecoveryStatus {
  active: boolean
  isolated: RecoveryPlugin[]
  pendingRestore?: string[]
  suspectedPlugin?: string
  failureMessage?: string
}

function manifestPath(profileDir: string): string {
  return join(profileDir, 'package.json')
}

function statePath(profileDir: string): string {
  return join(profileDir, RECOVERY_STATE_FILE)
}

function backupPath(profileDir: string): string {
  return join(profileDir, RECOVERY_BACKUP_FILE)
}

function isValidPackageName(packageName: string): boolean {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(packageName)) return false
  return packageName.split('/').every(segment => segment !== '.' && segment !== '..')
}

function normalizeFailureMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const message = value.trim().slice(0, MAX_FAILURE_MESSAGE_LENGTH)
  return message === '' ? undefined : message
}

function packageDirectory(profileDir: string, packageName: string): string {
  if (!isValidPackageName(packageName)) throw new Error('插件名称不合法。')
  const nodeModulesDir = resolve(profileDir, 'node_modules')
  const packageDir = resolve(nodeModulesDir, ...packageName.split('/'))
  const pathInsideNodeModules = relative(nodeModulesDir, packageDir)
  if (pathInsideNodeModules === '' || isAbsolute(pathInsideNodeModules) || pathInsideNodeModules.split(/[\\/]/).includes('..')) {
    throw new Error('插件目录不在当前 profile 中。')
  }
  return packageDir
}

async function readManifest(path: string): Promise<ProfileManifest> {
  return JSON.parse(await readFile(path, 'utf8')) as ProfileManifest
}

async function writeManifest(profileDir: string, manifest: ProfileManifest): Promise<void> {
  await writeTextFileAtomic(manifestPath(profileDir), `${JSON.stringify(manifest, undefined, 2)}\n`)
}

async function readState(profileDir: string): Promise<RecoveryState | undefined> {
  try {
    const value = JSON.parse(await readFile(statePath(profileDir), 'utf8')) as Partial<RecoveryState>
    if (value.schemaVersion !== 1 || !Array.isArray(value.isolated) || !Array.isArray(value.pendingRestore)) return undefined
    if (!value.isolated.every(item => typeof item?.packageName === 'string' && isValidPackageName(item.packageName))) return undefined
    if (!value.pendingRestore.every(item => typeof item === 'string' && isValidPackageName(item))) return undefined
    if (value.suspectedPlugin !== undefined && (typeof value.suspectedPlugin !== 'string' || !isValidPackageName(value.suspectedPlugin))) return undefined
    if (value.failureMessage !== undefined && normalizeFailureMessage(value.failureMessage) === undefined) return undefined
    return value as RecoveryState
  } catch {
    return undefined
  }
}

async function writeState(profileDir: string, state: RecoveryState): Promise<void> {
  await writeTextFileAtomic(statePath(profileDir), `${JSON.stringify(state, undefined, 2)}\n`)
}

function packageVersion(profileDir: string, packageName: string): string | undefined {
  try {
    const path = join(packageDirectory(profileDir, packageName), 'package.json')
    if (!existsSync(path)) return undefined
    const value = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown }
    return typeof value.version === 'string' && value.version !== '' ? value.version : undefined
  } catch {
    return undefined
  }
}

function isTrustedBundle(profileDir: string, packageName: string): boolean {
  if ((OFFICIAL_PROFILE_BUNDLES as readonly string[]).includes(packageName)) return true
  if (packageName === 'dsh-desktop-bridge') return true
  const bundled = BUNDLED_PLUGINS.find(plugin => plugin.packageName === packageName)
  return bundled !== undefined && packageVersion(profileDir, packageName) === bundled.version
}

function originalBundles(manifest: ProfileManifest): string[] {
  return (manifest.dsh?.profile?.bundles ?? []).filter(packageName => typeof packageName === 'string')
}

function statusFrom(state: RecoveryState | undefined): RecoveryStatus {
  return state === undefined
    ? { active: false, isolated: [] }
    : {
        active: true,
        isolated: state.isolated,
        ...(state.pendingRestore.length === 0 ? {} : { pendingRestore: state.pendingRestore }),
        ...(state.suspectedPlugin === undefined ? {} : { suspectedPlugin: state.suspectedPlugin }),
        ...(state.failureMessage === undefined ? {} : { failureMessage: state.failureMessage }),
      }
}

export function isRecoveryModeActive(profileDir: string): boolean {
  try {
    if (!existsSync(statePath(profileDir))) return false
    const value = JSON.parse(readFileSync(statePath(profileDir), 'utf8')) as Partial<RecoveryState>
    return value.schemaVersion === 1 && Array.isArray(value.isolated) && Array.isArray(value.pendingRestore)
  } catch {
    return false
  }
}

export async function getRecoveryStatus(profileDir: string): Promise<RecoveryStatus> {
  return statusFrom(await readState(profileDir))
}

/**
 * 健康配置恢复成功后，清除本次恢复会话的状态与原始清单备份。
 * 插件目录保持不变，后续启动仍以已恢复的健康配置为准。
 */
export async function leaveRecoveryMode(profileDir: string): Promise<void> {
  await Promise.all([
    rm(statePath(profileDir), { force: true }),
    rm(backupPath(profileDir), { force: true }),
  ])
}

function filteredBundles(profileDir: string, bundles: readonly string[], pendingRestore: readonly string[]): string[] {
  const pending = new Set(pendingRestore)
  return bundles.filter(packageName => isTrustedBundle(profileDir, packageName) || pending.has(packageName))
}

function withBundles(manifest: ProfileManifest, bundles: readonly string[]): ProfileManifest {
  return { ...manifest, dsh: { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: [...bundles] } } }
}

export async function enterRecoveryMode(profileDir: string, options: { force?: boolean, suspectedPlugin?: string, failureMessage?: string } = {}): Promise<RecoveryStatus> {
  if (options.suspectedPlugin !== undefined && !isValidPackageName(options.suspectedPlugin)) throw new Error('插件名称不合法。')
  if (options.failureMessage !== undefined && normalizeFailureMessage(options.failureMessage) === undefined) throw new Error('启动错误信息不合法。')
  const currentState = await readState(profileDir)
  if (currentState !== undefined && !options.force && options.suspectedPlugin === undefined && options.failureMessage === undefined) return statusFrom(currentState)
  const currentManifest = await readManifest(manifestPath(profileDir))
  const originalManifest = currentState === undefined
    ? currentManifest
    : await readManifest(backupPath(profileDir))
  const bundles = originalBundles(originalManifest)
  if (!bundles.every(isValidPackageName)) throw new Error('插件名称不合法。')
  const isolated = bundles
    .filter(packageName => !isTrustedBundle(profileDir, packageName))
    .map(packageName => ({ packageName, version: originalManifest.dependencies?.[packageName] ?? packageVersion(profileDir, packageName) }))
  const suspectedPlugin = options.suspectedPlugin ?? currentState?.suspectedPlugin
  const failureMessage = normalizeFailureMessage(options.failureMessage) ?? currentState?.failureMessage
  const state: RecoveryState = {
    schemaVersion: 1,
    enteredAt: currentState?.enteredAt ?? new Date().toISOString(),
    isolated,
    pendingRestore: [],
    ...(suspectedPlugin === undefined || !isolated.some(plugin => plugin.packageName === suspectedPlugin)
      ? {}
      : { suspectedPlugin }),
    ...(failureMessage === undefined ? {} : { failureMessage }),
    originalManifestSha256: createHash('sha256').update(JSON.stringify(originalManifest)).digest('hex'),
  }
  if (currentState === undefined) await writeTextFileAtomic(backupPath(profileDir), `${JSON.stringify(originalManifest, undefined, 2)}\n`)
  await writeState(profileDir, state)
  await writeManifest(profileDir, withBundles(currentManifest, filteredBundles(profileDir, originalBundles(currentManifest), state.pendingRestore)))
  return statusFrom(state)
}

export async function restrictProfileBundlesForRecovery(profileDir: string): Promise<boolean> {
  const state = await readState(profileDir)
  if (state === undefined) return false
  const manifest = await readManifest(manifestPath(profileDir))
  const current = originalBundles(manifest)
  const next = filteredBundles(profileDir, current, state.pendingRestore)
  if (next.length === current.length && next.every((value, index) => value === current[index])) return false
  await writeManifest(profileDir, withBundles(manifest, next))
  return true
}

function restoreBundleOrder(current: readonly string[], original: readonly string[], packageName: string): string[] {
  const included = new Set([...current, packageName])
  const ordered = original.filter(item => included.has(item))
  for (const packageName of current) if (!ordered.includes(packageName)) ordered.push(packageName)
  return ordered
}

export async function restoreRecoveryPlugin(profileDir: string, packageName: string): Promise<RecoveryStatus> {
  const state = await readState(profileDir)
  if (state === undefined) throw new Error('恢复模式未启用。')
  const isolated = state.isolated.find(plugin => plugin.packageName === packageName)
  if (isolated === undefined) throw new Error('该插件当前不在隔离列表中。')
  if (!existsSync(join(packageDirectory(profileDir, packageName), 'package.json'))) throw new Error('插件文件不存在，无法恢复。')
  const original = await readManifest(backupPath(profileDir))
  const originalBundleList = originalBundles(original)
  if (!originalBundleList.includes(packageName)) throw new Error('原始清单不包含该插件。')
  const current = await readManifest(manifestPath(profileDir))
  const dependencies = { ...current.dependencies }
  const originalVersion = original.dependencies?.[packageName]
  if (originalVersion !== undefined) dependencies[packageName] = originalVersion
  const nextState: RecoveryState = {
    ...state,
    isolated: state.isolated.filter(plugin => plugin.packageName !== packageName),
    pendingRestore: [...new Set([...state.pendingRestore, packageName])],
  }
  await writeState(profileDir, nextState)
  await writeManifest(profileDir, { ...withBundles(current, restoreBundleOrder(originalBundles(current), originalBundleList, packageName)), dependencies })
  return statusFrom(nextState)
}

export async function uninstallRecoveryPlugin(profileDir: string, packageName: string): Promise<RecoveryStatus> {
  const state = await readState(profileDir)
  if (state === undefined) throw new Error('恢复模式未启用。')
  if (!state.isolated.some(plugin => plugin.packageName === packageName)) throw new Error('仅能卸载当前隔离的第三方插件。')
  const manifest = await readManifest(manifestPath(profileDir))
  const dependencies = { ...manifest.dependencies }
  delete dependencies[packageName]
  const nextManifest = { ...withBundles(manifest, originalBundles(manifest).filter(name => name !== packageName)), dependencies }
  const nextState: RecoveryState = {
    ...state,
    isolated: state.isolated.filter(plugin => plugin.packageName !== packageName),
    pendingRestore: state.pendingRestore.filter(name => name !== packageName),
    ...(state.suspectedPlugin === packageName ? { suspectedPlugin: undefined } : {}),
  }
  const source = packageDirectory(profileDir, packageName)
  const trashDir = join(profileDir, RECOVERY_TRASH_DIR)
  const trash = join(trashDir, `${packageName.replace(/[@/]/g, '_')}-${randomUUID()}`)
  const shouldMove = existsSync(source)
  let manifestWritten = false
  let stateWritten = false
  let moved = false
  try {
    await writeManifest(profileDir, nextManifest)
    manifestWritten = true
    await writeState(profileDir, nextState)
    stateWritten = true
    if (shouldMove) {
      await mkdir(trashDir, { recursive: true })
      await rename(source, trash)
      moved = true
    }
  } catch (error) {
    const rollbackErrors: unknown[] = []
    if (moved) {
      await rename(trash, source).catch(rollbackError => rollbackErrors.push(rollbackError))
    }
    if (stateWritten) {
      await writeState(profileDir, state).catch(rollbackError => rollbackErrors.push(rollbackError))
    }
    if (manifestWritten) {
      await writeManifest(profileDir, manifest).catch(rollbackError => rollbackErrors.push(rollbackError))
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], '卸载插件失败，且未能完整回滚恢复模式配置。')
    }
    throw error
  }
  if (moved) {
    await rm(trash, { recursive: true, force: true }).catch(error => {
      console.error('插件已卸载，但无法清理恢复模式临时目录。', error)
    })
  }
  return statusFrom(nextState)
}
