import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, readFileSync } from 'node:fs'
import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALLOWED_BUILD_PACKAGES, officialRuntimeDependencies, officialRuntimePnpmConfig, pnpmWorkspaceYaml, STORE_PACKAGES } from '../src/bundled-plugins.js'
import { BUNDLED_LOCKFILE_NAME } from '../src/plugin-seed.js'
import { extractTarGz, materializeHardlinks, packDirectoryToTarGz, writeFileSha256, cloneTreeForArchive, assertPnpmStorePackagesPreserved } from '../src/runtime-archive.js'
import { copyExtractedTree } from '../src/extract-runtime.js'

const projectRoot = resolve(import.meta.dirname, '..', '..')
const nodeRoot = join(projectRoot, 'runtime-node')
const pluginRoot = join(projectRoot, 'runtime-plugins')
const officialRuntimeRoot = join(projectRoot, 'runtime-dsh')
const bundledPnpmVersion = '11.26.0'

export async function removePreparedPath(target: string): Promise<void> {
  if (!existsSync(target)) return
  try {
    await rm(target, { force: true, maxRetries: 10, recursive: true, retryDelay: 200 })
  } catch (error) {
    if (process.platform !== 'win32' || !isRetryableRemoveError(error)) throw error
    spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `rmdir /s /q "${target}"`], { stdio: 'ignore', windowsHide: true })
    spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `del /f /q "${target}"`], { stdio: 'ignore', windowsHide: true })
    if (existsSync(target)) throw error
  }
}

function isRetryableRemoveError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'ENOTEMPTY' || code === 'EBUSY' || code === 'EPERM' || code === 'EACCES'
}

export function resolveBundledNodeSha256(checksums: unknown, platform = process.platform, architecture = process.arch): string {
  if (typeof checksums !== 'object' || checksums === null || Array.isArray(checksums)) {
    throw new Error('package.json 缺少随包 Node SHA256 配置。')
  }
  const target = `${platform}-${architecture}`
  const checksum = (checksums as Record<string, unknown>)[target]
  if (typeof checksum !== 'string') throw new Error(`缺少随包 Node SHA256：${target}。`)
  return checksum
}

async function main(): Promise<void> {
  const projectManifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8')) as {
    config?: { bundledNodeSha256?: unknown, bundledNodeVersion?: unknown }
  }
  const expectedNodeVersion = projectManifest.config?.bundledNodeVersion
  const expectedNodeSha256 = resolveBundledNodeSha256(projectManifest.config?.bundledNodeSha256)

  if (typeof expectedNodeVersion !== 'string') throw new Error('package.json 缺少随包 Node 版本配置。')
  if (process.version !== expectedNodeVersion) {
    throw new Error('随包 Node 版本不匹配：需要 ' + expectedNodeVersion + '，实际 ' + process.version + '。')
  }
  const officialArchive = join(projectRoot, 'runtime-dsh.tgz')
  for (const target of [nodeRoot, pluginRoot, officialRuntimeRoot, officialArchive]) {
    if (!target.startsWith(projectRoot + sep)) throw new Error(`拒绝清理项目外路径：${target}`)
    await removePreparedPath(target)
  }

  const nodeExecutable = process.execPath
  const nodeSha256 = createHash('sha256').update(await readFile(nodeExecutable)).digest('hex').toUpperCase()
  if (nodeSha256 !== expectedNodeSha256) throw new Error('随包 Node SHA256 不匹配：' + nodeSha256 + '。')
  await mkdir(nodeRoot, { recursive: true })
  const stagedNodeExecutable = join(nodeRoot, process.platform === 'win32' ? 'node.exe' : 'node')
  await cp(nodeExecutable, stagedNodeExecutable)
  await writeFile(`${stagedNodeExecutable}.sha256`, nodeSha256 + '\n', 'utf8')
  await stagePnpm(nodeRoot)
  await stageBundledPlugins(pluginRoot, nodeRoot)
  const officialStore = join(officialRuntimeRoot, '.store')
  await stageOfficialRuntime(officialRuntimeRoot, nodeRoot, officialStore)
  await removePreparedPath(officialStore)
  await materializeHardlinks(join(pluginRoot, 'store'))
  await materializeHardlinks(officialRuntimeRoot)
  const storeDir = join(pluginRoot, 'store')
  const snapshotDir = join(pluginRoot, 'store-snapshot')
  const archivePath = join(pluginRoot, 'store.tgz')
  await cloneTreeForArchive(storeDir, snapshotDir)
  try {
    packDirectoryToTarGz(snapshotDir, archivePath)
    await verifyPackagedPluginArchive(pluginRoot, nodeRoot, snapshotDir, archivePath)
  } finally {
    await removePreparedPath(snapshotDir)
  }
  packDirectoryToTarGz(officialRuntimeRoot, join(projectRoot, 'runtime-dsh.tgz'))
  writeFileSha256(join(pluginRoot, 'store.tgz'))
  writeFileSha256(join(projectRoot, 'runtime-dsh.tgz'))
  console.log(`已装配 Node 运行时：${nodeRoot}`)
  console.log(`已装配内置插件仓库：${join(pluginRoot, 'store.tgz')}`)
  console.log(`已装配预装官方运行时：${join(projectRoot, 'runtime-dsh.tgz')}`)
}

async function copyWorkspacePackage(sourcePackage: string, destinationPackage: string): Promise<void> {
  await removePreparedPath(destinationPackage)
  const nestedNodeModules = join(sourcePackage, 'node_modules')
  await cp(sourcePackage, destinationPackage, {
    dereference: false,
    filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
    recursive: true,
  })
}

export async function copyWorkspacePackages(directory: string, depth: 1 | 2, destinationRoot: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const firstLevel = join(directory, entry.name)
    if (!(await isDirectory(entry, firstLevel))) continue
    const candidates = depth === 1
      ? [firstLevel]
      : await findDirectories(firstLevel)
    for (const candidate of candidates) {
      const manifestPath = join(candidate, 'package.json')
      if (!existsSync(manifestPath)) continue
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { name?: unknown }
      if (typeof manifest.name !== 'string' || !manifest.name.startsWith('@deepseek-ai/')) continue
      await copyWorkspacePackage(await realpath(candidate), join(destinationRoot, 'node_modules', manifest.name))
    }
  }
}

export function resolvePnpmPackageRoot(entry = process.env.npm_execpath): string {
  if (entry === undefined || entry === '') throw new Error('未找到 pnpm 入口，必须通过 pnpm 执行运行时装配。')
  let current = resolve(entry)
  for (let index = 0; index < 8; index += 1) {
    const manifestPath = join(current, 'package.json')
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: unknown }
      if (manifest.name === 'pnpm' || manifest.name === '@pnpm/exe') return current
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  throw new Error('无法从当前 pnpm 入口定位 pnpm 包装目录。')
}

export async function stagePnpm(destinationRoot: string): Promise<void> {
  const packageRoot = await materializePnpmPackage(destinationRoot)
  const entry = resolvePnpmEntry(packageRoot)
  await writePnpmShims(destinationRoot, relative(packageRoot, entry).replaceAll('\\', '/'))
}

export async function writePnpmShims(destinationRoot: string, relativeEntry: string, platform = process.platform): Promise<void> {
  const nodeName = platform === 'win32' ? 'node.exe' : 'node'
  await writeFile(
    join(destinationRoot, 'pnpm.cmd'),
    `@echo off\r\n"%~dp0${nodeName}" "%~dp0pnpm-package\\${relativeEntry.replaceAll('/', '\\')}" %*\r\n`,
    'utf8',
  )
  if (platform === 'win32') return
  await writeFile(
    join(destinationRoot, 'pnpm'),
    `#!/bin/sh\nexec "$(dirname "$0")/${nodeName}" "$(dirname "$0")/pnpm-package/${relativeEntry}" "$@"\n`,
    'utf8',
  )
  chmodSync(join(destinationRoot, 'pnpm'), 0o755)
}
export async function stageBundledPlugins(destinationRoot: string, nodeRoot: string): Promise<void> {
  const storeDir = join(destinationRoot, 'store')
  const stagingDir = join(destinationRoot, 'staging')
  await mkdir(stagingDir, { recursive: true })
  const stagedPackages = [...STORE_PACKAGES]
  await writeFile(join(stagingDir, 'package.json'), JSON.stringify({
    name: 'dsh-desktop-bundled-plugins',
    private: true,
    dependencies: Object.fromEntries(stagedPackages.map(plugin => [plugin.packageName, plugin.version])),
  }, undefined, 2) + '\n', 'utf8')
  await writeFile(join(stagingDir, 'pnpm-workspace.yaml'), pnpmWorkspaceYaml(false), 'utf8')
  runStagedPnpm(nodeRoot, [
    'install',
    '--dir', stagingDir,
    '--store-dir', storeDir,
    '--cache-dir', join(storeDir, 'cache'),
    '--prod',
    '--config.node-linker=hoisted',
    '--config.auto-install-peers=false',
    '--config.minimumReleaseAge=0',
    '--network-concurrency=1',
    '--fetch-retries=5',
    '--fetch-retry-mintimeout=10000',
    '--fetch-retry-maxtimeout=60000',
    '--registry=https://registry.npmjs.org/',
  ])
  for (const plugin of stagedPackages) {
    if (!existsSync(join(stagingDir, 'node_modules', ...plugin.packageName.split('/'), 'package.json'))) {
      throw new Error(`内置插件装配后缺失：${plugin.packageName}`)
    }
  }
  await publishBundledLockfile(stagingDir, storeDir)
  await pruneStoreForPackaging(storeDir)
  await completeBundledPluginMetadata(storeDir)
  await assertBundledPluginMetadataComplete(storeDir)
  await verifyBundledPluginStore(destinationRoot, nodeRoot)
  await pruneStoreForPackaging(storeDir)
  await removePreparedPath(stagingDir)
}

/** 把装配时解析好的锁文件放进仓库，首启按它冻结安装，避免范围再解析到未下载的压缩包。 */
export async function publishBundledLockfile(stagingDir: string, storeDir: string): Promise<void> {
  const source = join(stagingDir, 'pnpm-lock.yaml')
  if (!existsSync(source)) throw new Error('内置插件装配没有生成锁文件。')
  await copyFile(source, join(storeDir, BUNDLED_LOCKFILE_NAME))
}

/** 打包前用空 Profile 和随包锁文件离线安装，缺少任何依赖即阻止生成安装包。 */
export async function verifyBundledPluginStore(destinationRoot: string, nodeRoot: string,
  run: (args: readonly string[]) => void = args => runStagedPnpm(nodeRoot, args),
  storeDir = join(destinationRoot, 'store')): Promise<void> {
  const profile = await mkdtemp(join(destinationRoot, 'verify-offline-'))
  const lockSource = join(storeDir, BUNDLED_LOCKFILE_NAME)
  try {
    if (!existsSync(lockSource)) throw new Error('随包仓库缺少锁定的依赖树。')
    await writeFile(join(profile, 'package.json'), JSON.stringify({
      private: true,
      dependencies: Object.fromEntries(STORE_PACKAGES.map(plugin => [plugin.packageName, plugin.version])),
    }, undefined, 2) + '\n', 'utf8')
    await writeFile(join(profile, 'pnpm-workspace.yaml'), pnpmWorkspaceYaml(false), 'utf8')
    await copyFile(lockSource, join(profile, 'pnpm-lock.yaml'))
    run([
      'install', `--dir=${profile}`, '--frozen-lockfile',
      '--store-dir', storeDir, '--cache-dir', join(storeDir, 'cache'), '--offline',
      '--config.node-linker=hoisted', '--config.auto-install-peers=false', '--config.minimumReleaseAge=0',
      '--registry=https://registry.npmjs.org/',
    ])
    for (const plugin of STORE_PACKAGES) {
      const manifest = JSON.parse(await readFile(join(profile, 'node_modules', plugin.packageName, 'package.json'), 'utf8'))
      if (manifest.version !== plugin.version) throw new Error(`随包离线校验版本不匹配：${plugin.packageName}`)
    }
  } finally {
    await rm(profile, { recursive: true, force: true })
  }
}

/** 用安装时的解压复制检查压缩包，不能只检查还没打包的目录。 */
export async function verifyPackagedPluginArchive(destinationRoot: string, nodeRoot: string, sourceStore: string, archivePath: string,
  run?: (args: readonly string[]) => void): Promise<void> {
  const root = await mkdtemp(join(destinationRoot, 'verify-archive-'))
  const staging = join(root, 'staging')
  const copied = join(root, 'store')
  try {
    extractTarGz(archivePath, staging)
    copyExtractedTree(staging, copied)
    await rm(staging, { recursive: true, force: true })
    assertPnpmStorePackagesPreserved(sourceStore, copied)
    await verifyBundledPluginStore(root, nodeRoot, run, copied)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

/** 只保证 metadata-full 路径存在：把缺失的文件从缩写 metadata 拷过去，不改已有文件，也不补 time 等完整字段。App 侧 seed 必须保持 minimumReleaseAge=0。 */
export async function completeBundledPluginMetadata(storeDir: string): Promise<void> {
  const metadataRoot = join(storeDir, 'cache', 'v11', 'metadata')
  if (!existsSync(metadataRoot)) return
  for (const relative of await listMetadataJsonl(metadataRoot)) {
    const from = join(metadataRoot, relative)
    const to = join(storeDir, 'cache', 'v11', 'metadata-full', relative)
    if (existsSync(to)) continue
    await mkdir(dirname(to), { recursive: true })
    await writeFile(to, await readFile(from))
  }
}

export async function assertBundledPluginMetadataComplete(storeDir: string): Promise<void> {
  const metadataRoot = join(storeDir, 'cache', 'v11', 'metadata')
  if (!existsSync(metadataRoot)) return
  const missing = (await listMetadataJsonl(metadataRoot))
    .filter(relative => !existsSync(join(storeDir, 'cache', 'v11', 'metadata-full', relative)))
  if (missing.length === 0) return
  const preview = missing.slice(0, 5).join('、')
  throw new Error(`随包仓库缺少离线升级所需的完整元数据：${preview}${missing.length > 5 ? ` 等 ${missing.length} 项` : ''}`)
}

async function listMetadataJsonl(root: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : join(prefix, entry.name)
    if (entry.isDirectory()) files.push(...await listMetadataJsonl(join(root, entry.name), relative))
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(relative)
  }
  return files
}

/** 预装完整官方运行时，首启只需复制，避免现场 pnpm add。 */
export async function stageOfficialRuntime(destinationRoot: string, nodeRoot: string, storeDir: string): Promise<void> {
  if (!destinationRoot.startsWith(projectRoot + sep)) throw new Error(`拒绝写入项目外路径：${destinationRoot}`)
  await removePreparedPath(destinationRoot)
  await mkdir(destinationRoot, { recursive: true })
  await writeFile(join(destinationRoot, 'package.json'), JSON.stringify({
    name: 'dsh-desktop-runtime',
    private: true,
    pnpm: officialRuntimePnpmConfig(),
    dependencies: officialRuntimeNpmDependencies(),
  }, undefined, 2) + '\n', 'utf8')
  await writeFile(join(destinationRoot, 'pnpm-workspace.yaml'), pnpmWorkspaceYaml(), 'utf8')
  runCurrentNpm(officialRuntimeNpmInstallArgs(destinationRoot))
  const installedNodeModules = officialRuntimeGlobalNodeModulesRoot(destinationRoot)
  const runtimeNodeModules = join(destinationRoot, 'node_modules')
  if (installedNodeModules !== runtimeNodeModules) {
    await cp(installedNodeModules, runtimeNodeModules, { dereference: true, recursive: true })
    await removePreparedPath(join(destinationRoot, 'lib'))
  }
  const entry = join(destinationRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (!existsSync(entry)) throw new Error('预装官方运行时后仍未找到入口。')
  validateOfficialRuntimeLayout(destinationRoot)
}

/** 官方预发布包存在 pnpm 无法解析的 peer 范围，运行时打包统一改用 npm。 */
export function officialRuntimeNpmDependencies(): Record<string, string> {
  return officialRuntimeDependencies()
}

export function officialRuntimeNpmInstallArgs(destinationRoot: string): string[] {
  return [
    'install',
    '--global',
    '--prefix=' + destinationRoot,
    '--omit=dev',
    '--package-lock=false',
    '--no-audit',
    '--no-fund',
    '--allow-scripts=' + ALLOWED_BUILD_PACKAGES.join(','),
    '--registry=https://registry.npmjs.org/',
    ...Object.entries(officialRuntimeNpmDependencies()).map(([packageName, version]) => `${packageName}@${version}`),
  ]
}

/** 打包产物必须把启动 peer 放在运行时顶层，避免离线首启再回退到 npm。 */
export function validateOfficialRuntimeLayout(destinationRoot: string): void {
  for (const [packageName, expectedVersion] of Object.entries(officialRuntimeNpmDependencies())) {
    const manifestPath = join(destinationRoot, 'node_modules', ...packageName.split('/'), 'package.json')
    if (!existsSync(manifestPath)) throw new Error(`预装官方运行时缺少顶层依赖：${packageName}`)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: unknown }
    if (manifest.version !== expectedVersion) {
      throw new Error(`预装官方运行时依赖版本不匹配：${packageName}，需要 ${expectedVersion}，实际 ${String(manifest.version ?? '未知')}`)
    }
  }
}

/** npm 全局安装在 Unix 位于 lib/node_modules，Windows 则直接位于 node_modules。 */
export function officialRuntimeGlobalNodeModulesRoot(destinationRoot: string, platform = process.platform): string {
  return platform === 'win32'
    ? join(destinationRoot, 'node_modules')
    : join(destinationRoot, 'lib', 'node_modules')
}

export async function pruneStoreForPackaging(storeDir: string): Promise<void> {
  const projects = join(storeDir, 'v11', 'projects')
  if (existsSync(projects)) await removePreparedPath(projects)
  const verified = join(storeDir, 'cache', 'lockfile-verified.jsonl')
  if (existsSync(verified)) await removePreparedPath(verified)
}

async function materializePnpmPackage(destinationRoot: string): Promise<string> {
  const destination = join(destinationRoot, 'pnpm-package')
  await mkdir(destination, { recursive: true })
  try {
    await cp(resolvePnpmPackageRoot(), destination, { dereference: true, recursive: true })
    const copiedManifest = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8')) as { name?: unknown; version?: unknown }
    if (!['pnpm', '@pnpm/exe'].includes(String(copiedManifest.name)) || copiedManifest.version !== bundledPnpmVersion) {
      throw new Error('当前 pnpm 与随包版本不一致。')
    }
    resolvePnpmEntry(destination)
    return destination
  } catch {
    const packDir = join(destinationRoot, '.pnpm-pack')
    await mkdir(packDir, { recursive: true })
    const packed = runCurrentPnpm(['pack', `pnpm@${bundledPnpmVersion}`, '--pack-destination', packDir])
    const archive = packed.stdout.split(/\r?\n/).map(line => line.trim()).find(line => line.endsWith('.tgz'))
    if (archive === undefined) throw new Error('下载随包 pnpm 失败。')
    extractTarGz(join(packDir, archive), packDir)
    const packedManifest = JSON.parse(await readFile(join(packDir, 'package', 'package.json'), 'utf8')) as { name?: unknown; version?: unknown }
    if (packedManifest.name !== 'pnpm' || packedManifest.version !== bundledPnpmVersion) {
      throw new Error('下载的 pnpm 包身份或版本不匹配。')
    }
    await removePreparedPath(destination)
    await cp(join(packDir, 'package'), destination, { dereference: true, recursive: true })
    await removePreparedPath(packDir)
    return destination
  }
}

function resolvePnpmEntry(packageRoot: string): string {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { bin?: string | Record<string, string> }
  const declared = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.pnpm
  const candidates = [declared, 'bin/pnpm.cjs', 'dist/pnpm.cjs', 'bin/pnpm.js'].filter((item): item is string => Boolean(item))
  for (const candidate of candidates) {
    const entry = join(packageRoot, candidate)
    if (existsSync(entry)) return entry
  }
  throw new Error(`随包 pnpm 入口不存在：${packageRoot}`)
}

function runStagedPnpm(nodeRoot: string, args: readonly string[]): void {
  const nodeExecutable = join(nodeRoot, process.platform === 'win32' ? 'node.exe' : 'node')
  const result = spawnSync(nodeExecutable, [resolvePnpmEntry(join(nodeRoot, 'pnpm-package')), ...args], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`随包 pnpm 执行失败（退出码 ${result.status ?? '未知'}）。`)
}

function runCurrentNpm(args: readonly string[]): void {
  const entry = [
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(dirname(dirname(process.execPath)), 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].find(path => existsSync(path))
  if (entry === undefined) throw new Error('未找到当前 Node 附带的 npm CLI。')
  const result = spawnSync(process.execPath, [entry, ...args], { stdio: 'inherit', windowsHide: true })
  if (result.status !== 0) throw new Error(`npm ${args[0]} 失败（退出码 ${result.status ?? '未知'}）。`)
}

function runCurrentPnpm(args: readonly string[]): { stdout: string } {
  const pnpmEntry = process.env.npm_execpath
  if (!pnpmEntry) throw new Error('未找到 pnpm 入口，必须通过 pnpm 执行运行时装配。')
  const result = spawnSync(process.execPath, [pnpmEntry, ...args], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`pnpm ${args[0]} 失败（退出码 ${result.status ?? '未知'}）。`)
  return { stdout: result.stdout ?? '' }
}

async function findDirectories(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const directories: string[] = []
  for (const entry of entries) {
    const candidate = join(directory, entry.name)
    if (await isDirectory(entry, candidate)) directories.push(candidate)
  }
  return directories
}

async function isDirectory(entry: { isDirectory(): boolean, isSymbolicLink(): boolean }, path: string): Promise<boolean> {
  return entry.isDirectory() || (entry.isSymbolicLink() && (await stat(path)).isDirectory())
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()


