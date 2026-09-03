import { isDeepSeekOfficialPackage } from './bundled-plugins.js'

const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i

export function extractPluginFromStartupFailure(message: string): string | undefined {
  const overlayMatch = /failed to (?:parse|load) overlay\s+.+?[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/i.exec(message)
  const overlayPackage = normalizePackageName(overlayMatch?.[1])
  if (overlayPackage !== undefined) return overlayPackage

  // 缺失依赖、原生模块加载失败通常不会带 overlay 前缀，但仍会保留所属插件的 node_modules 路径。
  const candidates = [...message.matchAll(/[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/\s:'"()]+)(?:[\\/]|$)/ig)]
    .map(match => normalizePackageName(match[1]))
    .filter((packageName): packageName is string => packageName !== undefined)
  return candidates.find(packageName => !isDeepSeekOfficialPackage(packageName)) ?? candidates[0]
}

function normalizePackageName(value: string | undefined): string | undefined {
  const packageName = value?.replace('\\', '/')
  return packageName !== undefined && PACKAGE_NAME_PATTERN.test(packageName) ? packageName : undefined
}

export function trimStartupLogForRecovery(content: string, maximumLength = 12_000): string {
  if (content.length <= maximumLength) return content
  return `…${content.slice(-(maximumLength - 1))}`
}
