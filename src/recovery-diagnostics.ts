import { isDeepSeekOfficialPackage } from './bundled-plugins.js'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { changedBundlesSinceHealthy } from './profile-health-checkpoint.js'
import { isRecoverablePlugin } from './recovery-mode.js'

const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i

export function extractPluginFromStartupFailure(message: string): string | undefined {
  const unresolved = normalizePackageName(/cannot resolve profile bundle "([^"]+)"/.exec(message)?.[1])
  if (unresolved !== undefined) return unresolved
  const overlayMatch = /failed to (?:parse|load) overlay\s+.+?[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/i.exec(message)
  const overlayPackage = normalizePackageName(overlayMatch?.[1])
  if (overlayPackage !== undefined) return overlayPackage

  // 缺失依赖、原生模块加载失败通常不会带 overlay 前缀，但仍会保留所属插件的 node_modules 路径。
  const candidates = [...message.matchAll(/[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/\s:'"()]+)(?:[\\/]|$)/ig)]
    .map(match => normalizePackageName(match[1]))
    .filter((packageName): packageName is string => packageName !== undefined)
  return candidates.find(packageName => !isDeepSeekOfficialPackage(packageName)) ?? candidates[0]
}

interface PluginManifest {
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  dsh?: { profile?: { bundles?: string[] } }
}

/** 从真实加载错误定位启用的插件；原生依赖报错时回溯所属插件，不展示依赖包本身。 */
export async function findRecoveryCandidates(profileDir: string, message: string, reportedPlugins: readonly string[] = []): Promise<string[]> {
  const manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8')) as PluginManifest
  const bundles = (manifest.dsh?.profile?.bundles ?? []).filter(isRecoverablePlugin)
  const names = new Set([
    ...reportedPlugins,
    extractPluginFromStartupFailure(message),
    ...[...message.matchAll(/[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/\s:'"()]+)(?:[\\/]|$)/ig)].map(match => normalizePackageName(match[1])),
    ...[...message.matchAll(/Cannot find (?:package|module) ['"]([^'"/]+|@[^'"/]+\/[^'"]+)['"]/g)].map(match => normalizePackageName(match[1])),
  ].filter((name): name is string => name !== undefined && PACKAGE_NAME_PATTERN.test(name)))
  const direct = bundles.filter(name => names.has(name))
  if (direct.length > 0) return direct
  const owners: string[] = []
  if (names.size > 0) {
    for (const bundle of bundles) {
      if (await dependsOnFailure(join(profileDir, 'node_modules', ...bundle.split('/'), 'package.json'), names, new Set())) owners.push(bundle)
    }
  }
  if (owners.length > 0) return owners
  // 通用运行时/系统错误不能仅凭最近装过插件就归责插件。
  if (names.size > 0 || /EADDRINUSE|EACCES|ENOSPC|官方运行时|HTTP 服务未通过健康检查/i.test(message)) return []
  const changed = new Set(await changedBundlesSinceHealthy(profileDir))
  return bundles.filter(name => changed.has(name))
}

async function dependsOnFailure(manifestPath: string, failed: ReadonlySet<string>, visited: Set<string>): Promise<boolean> {
  if (visited.has(manifestPath)) return false
  visited.add(manifestPath)
  let manifest: PluginManifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PluginManifest
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies })) {
    if (failed.has(name)) return true
    let dependencyPath: string
    try {
      dependencyPath = createRequire(manifestPath).resolve(`${name}/package.json`)
    } catch {
      continue
    }
    if (await dependsOnFailure(dependencyPath, failed, visited)) return true
  }
  return false
}

function normalizePackageName(value: string | undefined): string | undefined {
  const packageName = value?.replace('\\', '/')
  return packageName !== undefined && PACKAGE_NAME_PATTERN.test(packageName) ? packageName : undefined
}

export function trimStartupLogForRecovery(content: string, maximumLength = 12_000): string {
  if (content.length <= maximumLength) return content
  return `…${content.slice(-(maximumLength - 1))}`
}
