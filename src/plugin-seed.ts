import { spawn } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import { writeTextFileAtomic, writeTextFileAtomicSync } from './atomic-file.js'
import { restrictProfileBundlesForRecovery } from './recovery-mode.js'
import {
  BUNDLED_PLUGINS,
  OFFICIAL_DSH_VERSION,
  OFFICIAL_LAUNCH_PEERS,
  OFFICIAL_PROFILE_BUNDLES,
  OFFICIAL_RUNTIME,
  officialRuntimeDependencies,
  officialRuntimePnpmConfig,
  pnpmWorkspaceYaml,
  SUITE_PACKAGE,
  isDeepSeekOfficialPackage,
  type BundledPlugin,
} from './bundled-plugins.js'
import { prependPath } from './plugin-toolchain.js'
import { terminateProcessTree } from './process-control.js'
import { mergeProfileUpdates, officialRuntimeUpdateVersion, parsePendingUpdates, partitionPackageUpdates, resolvePendingUpdatesPath, type ProfilePackageUpdate } from './profile-updates.js'
import { copyPrebuiltOfficialRuntime } from './runtime-prebuilt.js'

export type SeedSkipReason = 'already-installed' | 'missing-store'

export type SeedPlan =
  | { action: 'skip'; reason: SeedSkipReason }
  | { action: 'add'; packages: readonly BundledPlugin[] }
  | { action: 'replace-suite'; packages: readonly BundledPlugin[] }

interface SeedPlanInput {
  catalog: readonly BundledPlugin[]
  declaredPackages: readonly string[]
  installedPackages: readonly string[]
  storeExists: boolean
}

interface SeedPnpmOptions {
  storeDir?: string
  offline?: boolean
  autoInstallPeers?: boolean
}

interface SeedOptions {
  nodeExecutable: string
  profileDir: string
  pluginStoreDir: string
  desktopRuntimeDir?: string
  prebuiltRuntimeDir?: string
  pathPrefix?: string
  pnpmEntry?: string
  catalog?: readonly BundledPlugin[]
  runner?: (args: readonly string[]) => Promise<void>
  timeoutMs?: number
}

export interface SeedResult {
  seeded: readonly string[]
  skipped?: SeedSkipReason
}

const PROFILE_PATCH_TEMPLATE = `# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).
[]
`

export function isOfficialProfileDependency(packageName: string): boolean {
  return isDeepSeekOfficialPackage(packageName)
}

export function communitySeedCatalog(catalog: readonly BundledPlugin[]): BundledPlugin[] {
  return catalog.filter((plugin) => !isOfficialProfileDependency(plugin.packageName))
}

/** 社区插件必须写进 profile dependencies 才能单独更新；套件改为拆成子插件。官方包不进 Web profile。 */
export function planBundledPluginSeed(input: SeedPlanInput): SeedPlan {
  if (!input.storeExists) return { action: 'skip', reason: 'missing-store' }
  const declared = new Set(input.declaredPackages)
  const community = communitySeedCatalog(input.catalog)
  const missing = community.filter((plugin) => !declared.has(plugin.packageName))
  const suitePresent = declared.has(SUITE_PACKAGE) || input.installedPackages.includes(SUITE_PACKAGE)
  if (suitePresent) return { action: 'replace-suite', packages: missing }
  if (missing.length === 0) return { action: 'skip', reason: 'already-installed' }
  return { action: 'add', packages: missing }
}

/** 已有 node_modules 的目录禁止改 store-dir，否则 pnpm 报 UNEXPECTED_STORE。 */
export function shouldUsePackagedStore(targetDir: string): boolean {
  return !existsSync(join(targetDir, 'node_modules'))
}

export function resolvePnpmStoreDir(targetDir: string, fallback?: string): string | undefined {
  try {
    const modulesState = readFileSync(join(targetDir, 'node_modules', '.modules.yaml'), 'utf8')
    const value = /^storeDir:\s*(.+?)\s*$/m.exec(modulesState)?.[1]?.replace(/^['"]|['"]$/g, '')
    if (value) return value
  } catch {
    // 首次安装还没有 pnpm 状态文件。
  }
  return shouldUsePackagedStore(targetDir) && fallback ? fallback : undefined
}

export function buildSeedRemoveArgs(packageNames: readonly string[], targetDir: string, options: SeedPnpmOptions = {}): string[] {
  return [
    'remove',
    ...packageNames,
    `--dir=${targetDir}`,
    ...(options.storeDir === undefined ? [] : [`--store-dir=${options.storeDir}`]),
    '--config.node-linker=hoisted',
    '--config.minimumReleaseAge=0',
    '--registry=https://registry.npmjs.org/',
  ]
}

export function buildSeedPluginArgs(packages: readonly BundledPlugin[], targetDir: string, options: SeedPnpmOptions = {}): string[] {
  return [
    'add',
    ...packages.map((plugin) => `${plugin.packageName}@${plugin.version}`),
    `--dir=${targetDir}`,
    ...(options.storeDir === undefined ? [] : [`--store-dir=${options.storeDir}`]),
    ...(options.offline === true ? ['--offline'] : []),
    '--config.node-linker=hoisted',
    '--config.auto-install-peers=' + (options.autoInstallPeers === true ? 'true' : 'false'),
    '--config.minimumReleaseAge=0',
    '--registry=https://registry.npmjs.org/',
  ]
}

export function resolveWebProfileDir(home = process.env.DSH_HOME): string {
  return join(home ?? join(homedir(), '.dsh'), 'profiles', 'web')
}

export function ensureAutoInstallPeersEnabled(dir: string): void {
  const manifestPath = join(dir, 'pnpm-workspace.yaml')
  if (!existsSync(manifestPath)) return
  const current = readFileSync(manifestPath, 'utf8')
  if (/\bautoInstallPeers:\s*true\b/.test(current)) return
  const next = current.includes('autoInstallPeers:')
    ? current.replace(/autoInstallPeers:\s*['"]?false['"]?/g, 'autoInstallPeers: true')
    : `autoInstallPeers: true\n${current}`
  writeFileSync(manifestPath, next, 'utf8')
}

/** Web profile 不能自动装官方 peer，否则会把官方 UI 包装进 profile 并盖掉运行时。 */
export function ensureAutoInstallPeersDisabled(dir: string): void {
  const manifestPath = join(dir, 'pnpm-workspace.yaml')
  if (!existsSync(manifestPath)) return
  const current = readFileSync(manifestPath, 'utf8')
  if (/\bautoInstallPeers:\s*false\b/.test(current)) return
  const next = current.includes('autoInstallPeers:')
    ? current.replace(/autoInstallPeers:\s*['"]?true['"]?/g, 'autoInstallPeers: false')
    : `autoInstallPeers: false\n${current}`
  writeFileSync(manifestPath, next, 'utf8')
}

export function resolveProfileDshEntry(dir: string): string {
  return join(dir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

export function resolvePackageManifestPath(dir: string, packageName: string): string {
  return join(dir, 'node_modules', ...packageName.split('/'), 'package.json')
}

export function missingOfficialLaunchPeers(dir: string, peers = OFFICIAL_LAUNCH_PEERS): BundledPlugin[] {
  return peers.filter((plugin) => !existsSync(resolvePackageManifestPath(dir, plugin.packageName)))
}

/** 官方入口存在，且启动必需 peer 都已落地，才认为可以拉起 DSH。 */
export function isOfficialRuntimeLaunchable(dir: string): boolean {
  return existsSync(resolveProfileDshEntry(dir)) && missingOfficialLaunchPeers(dir).length === 0
}

const OFFICIAL_LOCK_PACKAGES = [
  OFFICIAL_RUNTIME.packageName,
  '@deepseek-ai/dsh-attachment-local',
  '@deepseek-ai/dsh-host-apiproxy',
  '@deepseek-ai/dsh-invariants',
] as const

export function readInstalledPackageVersion(dir: string, packageName: string): string | undefined {
  const manifestPath = resolvePackageManifestPath(dir, packageName)
  if (!existsSync(manifestPath)) return undefined
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: string }
  return typeof manifest.version === 'string' && manifest.version !== '' ? manifest.version : undefined
}

export function officialRuntimeHasVersionLock(dir: string, version: string): boolean {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      pnpm?: { overrides?: Record<string, string> }
    }
    const overrides = manifest.pnpm?.overrides ?? {}
    return overrides['@deepseek-ai/dsh'] === version && overrides['@deepseek-ai/dsh-*'] === version
  } catch {
    return false
  }
}

export function isOfficialRuntimeFamilyAligned(dir: string, version: string): boolean {
  if (!officialRuntimeHasVersionLock(dir, version)) return false
  return OFFICIAL_LOCK_PACKAGES.every((packageName) => readInstalledPackageVersion(dir, packageName) === version)
}

export function writeOfficialRuntimeManifest(runtimeDir: string, version = OFFICIAL_DSH_VERSION): void {
  const manifestPath = join(runtimeDir, 'package.json')
  let current: { name?: string; private?: boolean; dependencies?: Record<string, string>; pnpm?: Record<string, unknown> } = {}
  if (existsSync(manifestPath)) {
    current = JSON.parse(readFileSync(manifestPath, 'utf8')) as typeof current
  }
  const next = {
    name: current.name ?? 'dsh-desktop-runtime',
    private: true,
    pnpm: officialRuntimePnpmConfig(version),
    dependencies: {
      ...(current.dependencies ?? {}),
      ...officialRuntimeDependencies(version),
    },
  }
  writeTextFileAtomicSync(manifestPath, JSON.stringify(next, undefined, 2) + '\n')
}

export function officialRuntimeInstallArgs(runtimeDir: string, storeDir?: string): string[] {
  return [
    'install',
    '--dir=' + runtimeDir,
    '--prod',
    '--no-frozen-lockfile',
    ...(storeDir === undefined ? [] : [`--store-dir=${storeDir}`]),
    '--config.node-linker=hoisted',
    '--config.auto-install-peers=true',
    '--config.minimumReleaseAge=0',
    '--registry=https://registry.npmjs.org/',
  ]
}

export async function applyOfficialRuntimeVersion(options: SeedOptions, version: string): Promise<string> {
  const runtimeDir = options.desktopRuntimeDir
  if (runtimeDir === undefined) throw new Error('未配置官方运行时目录，无法在线升级官方包。')
  await mkdir(runtimeDir, { recursive: true })
  writeOfficialRuntimeManifest(runtimeDir, version)
  if (!existsSync(join(runtimeDir, 'pnpm-workspace.yaml'))) {
    await writeFile(join(runtimeDir, 'pnpm-workspace.yaml'), pnpmWorkspaceYaml(), 'utf8')
  }
  ensureAutoInstallPeersEnabled(runtimeDir)
  const runner = options.runner ?? ((pluginArgs) => runPnpm(options, pluginArgs))
  await runner(officialRuntimeInstallArgs(runtimeDir, resolvePnpmStoreDir(runtimeDir, options.pluginStoreDir)))
  if (!isOfficialRuntimeLaunchable(runtimeDir)) {
    throw new Error('官方运行时升级到 ' + version + ' 后仍无法启动。')
  }
  return version
}

export async function stripOfficialProfileDependencies(profileDir: string): Promise<string[]> {
  const manifestPath = join(profileDir, 'package.json')
  if (!existsSync(manifestPath)) return []
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    dependencies?: Record<string, string>
    dsh?: { profile?: { bundles?: string[] } }
  }
  const removed: string[] = []
  const nextDependencies = { ...(manifest.dependencies ?? {}) }
  for (const packageName of Object.keys(nextDependencies)) {
    if (!isOfficialProfileDependency(packageName)) continue
    delete nextDependencies[packageName]
    removed.push(packageName)
  }
  const nextBundles = [...(manifest.dsh?.profile?.bundles ?? [])].filter((name) => {
    if (name === SUITE_PACKAGE) return false
    if (!isOfficialProfileDependency(name)) return true
    return (OFFICIAL_PROFILE_BUNDLES as readonly string[]).includes(name)
  })
  const officialModules = join(profileDir, 'node_modules', '@deepseek-ai')
  if (existsSync(officialModules)) {
    for (const entry of await readdir(officialModules, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      await rm(join(officialModules, entry.name), { recursive: true, force: true })
    }
    if (!removed.includes('@deepseek-ai')) removed.push('@deepseek-ai')
  }
  if (removed.length === 0 && nextBundles.join('\0') === (manifest.dsh?.profile?.bundles ?? []).join('\0')) return []
  manifest.dependencies = nextDependencies
  manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: nextBundles } }
  await writeTextFileAtomic(manifestPath, `${JSON.stringify(manifest, undefined, 2)}\n`)
  return removed
}

export async function applyPendingProfileUpdates(options: SeedOptions): Promise<readonly string[]> {
  const pendingPath = resolvePendingUpdatesPath(options.profileDir)
  let pending: ProfilePackageUpdate[] = []
  try {
    pending = parsePendingUpdates(await readFile(pendingPath, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const { community } = partitionPackageUpdates(pending)
  const declared = await readDeclaredPackageVersions(options.profileDir)
  const installed = await readInstalledPackageVersions(options.profileDir, [...new Set([
    ...declared.map((item) => item.packageName),
    ...community.map((item) => item.packageName),
  ])])
  const updates = mergeProfileUpdates({ pending: community, declared, installed })
  const applied: string[] = []
  const runner = options.runner ?? ((args) => runPnpm(options, args))
  if (updates.length > 0) {
    const storeDir = resolvePnpmStoreDir(options.profileDir, options.pluginStoreDir)
    await runner(buildSeedPluginArgs(updates, options.profileDir, storeDir === undefined ? {} : { storeDir }))
    applied.push(...updates.map((item) => item.packageName))
  }
  const officialVersion = officialRuntimeUpdateVersion(pending)
  if (officialVersion !== undefined && options.desktopRuntimeDir !== undefined) {
    applied.push(await applyOfficialRuntimeVersion(options, officialVersion))
  }
  if (existsSync(pendingPath)) await rm(pendingPath, { force: true })
  return applied
}

async function readDeclaredPackageVersions(profileDir: string): Promise<ProfilePackageUpdate[]> {
  try {
    const manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    return Object.entries(manifest.dependencies ?? {})
      .filter(([packageName, version]) => !isOfficialProfileDependency(packageName) && typeof version === 'string')
      .map(([packageName, version]) => ({ packageName, version }))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function readInstalledPackageVersions(profileDir: string, names: readonly string[]): Promise<Array<{ packageName: string; version?: string }>> {
  const installed: Array<{ packageName: string; version?: string }> = []
  for (const packageName of names) {
    const manifestPath = resolvePackageManifestPath(profileDir, packageName)
    if (!existsSync(manifestPath)) {
      installed.push({ packageName })
      continue
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: string }
    installed.push({ packageName, version: typeof manifest.version === 'string' ? manifest.version : undefined })
  }
  return installed
}

export async function seedBundledPlugins(options: SeedOptions): Promise<SeedResult> {
  const seeded: string[] = []
  if (options.desktopRuntimeDir !== undefined) {
    const official = await seedOfficialRuntime(options)
    seeded.push(...official)
  }
  await stripOfficialProfileDependencies(options.profileDir)
  const community = await seedCommunityPlugins(options)
  seeded.push(...community.seeded)
  const extraDirs = options.desktopRuntimeDir === undefined ? [] : [options.desktopRuntimeDir]
  await finalizeProfileBundlesAfterInstall(options.profileDir, extraDirs)
  if (seeded.length === 0) return { seeded, skipped: community.skipped ?? 'already-installed' }
  return { seeded }
}

async function seedOfficialRuntime(options: SeedOptions): Promise<readonly string[]> {
  const runtimeDir = options.desktopRuntimeDir
  if (runtimeDir === undefined) return []
  const seeded: string[] = []
  ensureAutoInstallPeersEnabled(runtimeDir)
  if (options.prebuiltRuntimeDir !== undefined && copyPrebuiltOfficialRuntime(options.prebuiltRuntimeDir, runtimeDir) === 'copied') {
    seeded.push(OFFICIAL_RUNTIME.packageName)
  }
  if (!existsSync(resolveProfileDshEntry(runtimeDir))) {
    await ensureRuntimeScaffold(runtimeDir)
    const storeDir = resolvePnpmStoreDir(runtimeDir, existsSync(options.pluginStoreDir) ? options.pluginStoreDir : undefined)
    const useStore = storeDir !== undefined
    const args = buildSeedPluginArgs([OFFICIAL_RUNTIME], runtimeDir, {
      autoInstallPeers: true,
      ...(useStore ? { storeDir, offline: true } : {}),
    })
    const runner = options.runner ?? ((pluginArgs) => runPnpm(options, pluginArgs))
    try {
      await runner(args)
    } catch (error) {
      if (useStore) {
        await runner(buildSeedPluginArgs([OFFICIAL_RUNTIME], runtimeDir, { autoInstallPeers: true }))
      } else {
        throw error
      }
    }
    if (!existsSync(resolveProfileDshEntry(runtimeDir))) throw new Error('官方 DSH 运行时补种后仍未找到入口。')
    seeded.push(OFFICIAL_RUNTIME.packageName)
  }
  seeded.push(...await ensureOfficialLaunchPeers(options, runtimeDir))
  return seeded
}

async function ensureOfficialLaunchPeers(options: SeedOptions, targetDir: string): Promise<readonly string[]> {
  ensureAutoInstallPeersEnabled(targetDir)
  const missing = missingOfficialLaunchPeers(targetDir)
  if (missing.length === 0) return []
  const storeDir = resolvePnpmStoreDir(targetDir, existsSync(options.pluginStoreDir) ? options.pluginStoreDir : undefined)
  const useStore = storeDir !== undefined
  const args = buildSeedPluginArgs([OFFICIAL_RUNTIME, ...missing], targetDir, {
    autoInstallPeers: true,
    ...(useStore ? { storeDir, offline: true } : {}),
  })
  const runner = options.runner ?? ((pluginArgs) => runPnpm(options, pluginArgs))
  try {
    await runner(args)
  } catch (error) {
    if (useStore) await runner(buildSeedPluginArgs([OFFICIAL_RUNTIME, ...missing], targetDir, { autoInstallPeers: true }))
    else throw error
  }
  const stillMissing = missingOfficialLaunchPeers(targetDir)
  if (stillMissing.length > 0) {
    throw new Error(`官方运行时缺少启动依赖：${stillMissing.map((plugin) => plugin.packageName).join('、')}`)
  }
  return missing.map((plugin) => plugin.packageName)
}

async function seedCommunityPlugins(options: SeedOptions): Promise<SeedResult> {
  await ensureProfileScaffold(options.profileDir)
  const { declared, installed } = await readProfilePluginNames(options.profileDir)
  const plan = planBundledPluginSeed({
    catalog: options.catalog ?? BUNDLED_PLUGINS,
    declaredPackages: declared,
    installedPackages: installed,
    storeExists: existsSync(options.pluginStoreDir),
  })
  if (plan.action === 'skip') return { seeded: [], skipped: plan.reason }
  const storeDir = resolvePnpmStoreDir(options.profileDir, existsSync(options.pluginStoreDir) ? options.pluginStoreDir : undefined)
  const useStore = storeDir !== undefined
  const storeOptions = useStore ? { storeDir, offline: true } : {}
  const runner = options.runner ?? ((pluginArgs) => runPnpm(options, pluginArgs))
  if (plan.packages.length > 0) {
    const args = buildSeedPluginArgs(plan.packages, options.profileDir, storeOptions)
    try {
      await runner(args)
    } catch (error) {
      if (useStore) await runner(buildSeedPluginArgs(plan.packages, options.profileDir, {}))
      else throw error
    }
  }
  if (plan.action === 'replace-suite') {
    try {
      await runner(buildSeedRemoveArgs([SUITE_PACKAGE], options.profileDir, storeOptions))
    } catch (error) {
      if (useStore) await runner(buildSeedRemoveArgs([SUITE_PACKAGE], options.profileDir, {}))
      else throw error
    }
  }
  await reconcileProfileBundles(options.profileDir)
  return { seeded: plan.packages.map((plugin) => plugin.packageName) }
}

export async function ensureProfileScaffold(profileDir: string): Promise<void> {
  await mkdir(profileDir, { recursive: true })
  const manifestPath = join(profileDir, 'package.json')
  if (!existsSync(manifestPath)) {
    await writeTextFileAtomic(manifestPath, `${JSON.stringify({
      name: 'dsh-profile-web',
      private: true,
      dependencies: {},
      dsh: { profile: { bundles: [...OFFICIAL_PROFILE_BUNDLES] } },
    }, undefined, 2)}\n`)
  }
  if (!existsSync(join(profileDir, 'cordis.patch.yml'))) {
    await writeFile(join(profileDir, 'cordis.patch.yml'), PROFILE_PATCH_TEMPLATE, 'utf8')
  }
  if (!existsSync(join(profileDir, 'pnpm-workspace.yaml'))) {
    await writeFile(join(profileDir, 'pnpm-workspace.yaml'), pnpmWorkspaceYaml(false), 'utf8')
  }
  ensureAutoInstallPeersDisabled(profileDir)
}

async function ensureRuntimeScaffold(runtimeDir: string): Promise<void> {
  await mkdir(runtimeDir, { recursive: true })
  if (!existsSync(join(runtimeDir, 'package.json'))) {
    writeOfficialRuntimeManifest(runtimeDir)
  }
  if (!existsSync(join(runtimeDir, 'pnpm-workspace.yaml'))) {
    await writeFile(join(runtimeDir, 'pnpm-workspace.yaml'), pnpmWorkspaceYaml(), 'utf8')
  }
}

export async function reconcileProfileBundles(profileDir: string, packageNames?: readonly string[]): Promise<string[]> {
  const manifestPath = join(profileDir, 'package.json')
  if (!existsSync(manifestPath)) return []
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    dependencies?: Record<string, string>
    dsh?: { profile?: { bundles?: string[] } }
  }
  const bundles = [...(manifest.dsh?.profile?.bundles ?? [...OFFICIAL_PROFILE_BUNDLES])].filter((name) => {
    if (name === SUITE_PACKAGE) return false
    if (!isOfficialProfileDependency(name)) return true
    return (OFFICIAL_PROFILE_BUNDLES as readonly string[]).includes(name)
  })
  const marketDisabled = readMarketDisabledPackages(profileDir)
  let changed = false
  const allowed = packageNames === undefined ? undefined : new Set(packageNames)
  for (const packageName of Object.keys(manifest.dependencies ?? {})) {
    if (allowed !== undefined && !allowed.has(packageName)) continue
    if (isOfficialProfileDependency(packageName) || packageName === SUITE_PACKAGE) continue
    if (marketDisabled.has(packageName)) continue
    if (!hasBundleManifest(profileDir, packageName) || bundles.includes(packageName)) continue
    bundles.push(packageName)
    changed = true
  }
  if (changed) {
    manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles } }
    await writeTextFileAtomic(manifestPath, `${JSON.stringify(manifest, undefined, 2)}\n`)
  }
  return bundles
}

/** 插件市场已禁用的 bundle 不能在桌面启动补种时被重新激活。 */
function readMarketDisabledPackages(profileDir: string): ReadonlySet<string> {
  try {
    const state = JSON.parse(readFileSync(join(profileDir, '.dsh-market', 'state.json'), 'utf8')) as { disabled?: unknown }
    return new Set(Array.isArray(state.disabled) ? state.disabled.filter((name): name is string => typeof name === 'string') : [])
  } catch {
    return new Set()
  }
}

/** 未声明、缺包或清单损坏的社区 bundle 会让 DSH 直接退出；启动前隔离，官方 bundle 仍由运行时解析。 */
export async function pruneMissingProfileBundles(profileDir: string, extraDirs: readonly string[] = []): Promise<string[]> {
  const manifestPath = join(profileDir, 'package.json')
  if (!existsSync(manifestPath)) return []
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    dependencies?: Record<string, string>
    dsh?: { profile?: { bundles?: string[] } }
  }
  const current = manifest.dsh?.profile?.bundles ?? []
  const dependencies = new Set(Object.keys(manifest.dependencies ?? {}))
  const next = current.filter((packageName) => (OFFICIAL_PROFILE_BUNDLES as readonly string[]).includes(packageName)
    // Internal package name: keep synchronized with DESKTOP_BRIDGE_PACKAGE in desktop-host.ts.
    || (packageName === 'dsh-desktop-bridge' && isResolvableProfileBundle(profileDir, packageName, extraDirs))
    || (dependencies.has(packageName) && isResolvableProfileBundle(profileDir, packageName, extraDirs)))
  const removed = current.filter((packageName) => !next.includes(packageName))
  if (removed.length === 0) return []
  const nextDependencies = { ...(manifest.dependencies ?? {}) }
  for (const packageName of removed) delete nextDependencies[packageName]
  manifest.dependencies = nextDependencies
  manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: next } }
  await writeTextFileAtomic(manifestPath, `${JSON.stringify(manifest, undefined, 2)}\n`)
  return removed
}

/** 先认磁盘上的包，再改 bundle 列表：缺包的先摘掉，装上的再补进清单。 */
export async function finalizeProfileBundlesAfterInstall(profileDir: string, extraDirs: readonly string[] = [], packageNames?: readonly string[]): Promise<{ removed: string[]; bundles: string[] }> {
  const removed = await pruneMissingProfileBundles(profileDir, extraDirs)
  const bundles = await reconcileProfileBundles(profileDir, packageNames)
  if (!await restrictProfileBundlesForRecovery(profileDir)) return { removed, bundles }
  const manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8')) as {
    dsh?: { profile?: { bundles?: string[] } }
  }
  return { removed, bundles: manifest.dsh?.profile?.bundles ?? [] }
}

export function isResolvableProfileBundle(profileDir: string, packageName: string, extraDirs: readonly string[] = []): boolean {
  if ((OFFICIAL_PROFILE_BUNDLES as readonly string[]).includes(packageName)) return true
  return [profileDir, ...extraDirs].some((dir) => hasBundleManifest(dir, packageName))
}

/** 官方 bundle 位于 @deepseek-ai/dsh 的依赖树中，须按运行时的实际解析规则验证。 */
export function assertOfficialProfileBundlesAvailable(profileDir: string, runtimeDirs: readonly string[]): void {
  if (runtimeDirs.length === 0) return
  let bundles: string[]
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) as { dsh?: { profile?: { bundles?: unknown } } }
    bundles = Array.isArray(manifest.dsh?.profile?.bundles)
      ? manifest.dsh.profile.bundles.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return
  }
  const missing = bundles
    .filter((bundle): bundle is typeof OFFICIAL_PROFILE_BUNDLES[number] => (OFFICIAL_PROFILE_BUNDLES as readonly string[]).includes(bundle))
    .filter(bundle => !runtimeDirs.some(runtimeDir => hasOfficialRuntimeBundle(runtimeDir, bundle)))
  if (missing.length > 0) throw new Error(`官方运行时安装不完整：缺少内置 bundle ${missing.join('、')}。请重新启动应用以修复官方运行时。`)
}

function hasOfficialRuntimeBundle(runtimeDir: string, packageName: string): boolean {
  const dshManifestPath = join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
  if (!existsSync(dshManifestPath)) return false
  try {
    const resolvedManifestPath = createRequire(dshManifestPath).resolve(`${packageName}/package.json`)
    const packageDir = dirname(resolvedManifestPath)
    const manifest = JSON.parse(readFileSync(resolvedManifestPath, 'utf8')) as { name?: unknown, dsh?: { bundle?: { patch?: unknown } } }
    const patch = manifest.dsh?.bundle?.patch
    return manifest.name === packageName && typeof patch === 'string' && patch.trim() !== '' && isPackageFile(packageDir, patch)
  } catch {
    return false
  }
}

function hasBundleManifest(profileDir: string, packageName: string): boolean {
  const packageDir = join(profileDir, 'node_modules', ...packageName.split('/'))
  const manifestPath = join(packageDir, 'package.json')
  if (!existsSync(manifestPath)) return false
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name?: unknown
      dsh?: { bundle?: { patch?: unknown } }
    }
    const patch = manifest.dsh?.bundle?.patch
    if (manifest.name !== packageName || typeof patch !== 'string' || patch.trim() === '') return false
    return isPackageFile(packageDir, patch)
  } catch {
    return false
  }
}

/** bundle patch 只能读取插件目录内的普通文件，避免半安装与路径逃逸进入 DSH 加载图。 */
function isPackageFile(packageDir: string, candidate: string): boolean {
  try {
    const packageRoot = realpathSync(packageDir)
    const target = realpathSync(resolve(packageDir, candidate))
    const pathFromRoot = relative(packageRoot, target)
    if (pathFromRoot === '' || pathFromRoot === '..' || pathFromRoot.startsWith('..' + sep) || isAbsolute(pathFromRoot)) return false
    return statSync(target).isFile()
  } catch {
    return false
  }
}

async function readProfilePluginNames(profileDir: string): Promise<{ declared: string[]; installed: string[] }> {
  const declared = await readDeclaredPackages(profileDir)
  const names = [...declared, ...BUNDLED_PLUGINS.map((plugin) => plugin.packageName), SUITE_PACKAGE]
  return { declared, installed: await readInstalledPackages(profileDir, names) }
}

async function readDeclaredPackages(profileDir: string): Promise<string[]> {
  try {
    const manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { profile?: { bundles?: string[] } }
    }
    return [...new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...(manifest.dsh?.profile?.bundles ?? []),
    ])]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function readInstalledPackages(profileDir: string, names: readonly string[]): Promise<string[]> {
  const installed: string[] = []
  for (const name of new Set(names)) {
    if (existsSync(join(profileDir, 'node_modules', ...name.split('/'), 'package.json'))) installed.push(name)
  }
  return installed
}

function runPnpm(options: SeedOptions, args: readonly string[]): Promise<void> {
  const pnpmEntry = options.pnpmEntry ?? (options.pathPrefix === undefined ? undefined : join(options.pathPrefix, 'pnpm-package', 'bin', 'pnpm.cjs'))
  if (pnpmEntry === undefined) throw new Error('未找到随包 pnpm，无法补种官方运行时和社区插件。')
  return new Promise((resolvePromise, reject) => {
    const child = spawn(options.nodeExecutable, [pnpmEntry, ...args], {
      cwd: dirname(pnpmEntry),
      env: {
        ...process.env,
        CI: 'true',
        DSH_HOME: resolve(options.profileDir, '..', '..'),
        ...(options.pathPrefix === undefined ? {} : { PATH: prependPath(process.env.PATH, options.pathPrefix) }),
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    let settled = false
    let timeoutError: Error | undefined
    let killDeadline: ReturnType<typeof setTimeout> | undefined
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearTimeout(killDeadline)
      if (error === undefined) resolvePromise()
      else reject(error)
    }
    const timeout = setTimeout(() => {
      timeoutError = new Error('pnpm 操作超时，已终止子进程。')
      terminateProcessTree(child)
      killDeadline = setTimeout(() => finish(timeoutError), 2_000)
    }, options.timeoutMs ?? 300_000)
    timeout.unref?.()
    const collect = (chunk: Buffer): void => { output = (output + String(chunk)).slice(-8_000) }
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)
    child.once('error', () => { finish(new Error('无法启动随包 pnpm 补种命令。')) })
    child.once('exit', code => {
      if (timeoutError !== undefined) {
        finish(timeoutError)
        return
      }
      if (code === 0) {
        finish()
        return
      }
      finish(new Error(output.replace(/\s+/g, ' ').trim() || '内置插件补种失败。'))
    })
  })
}
