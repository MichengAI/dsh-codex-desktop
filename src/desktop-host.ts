import { spawn, type ChildProcess } from 'node:child_process'
import { PassThrough } from 'node:stream'

import { APPLY_PLUGIN_UPDATES_IPC, OFFICIAL_DSH_VERSION, isDeepSeekOfficialPackage, isOfficialDshPackage } from './bundled-plugins.js'
import { desktopBridgeClientBundle } from './desktop-bridge-client-source.js'
import { finalizeProfileBundlesAfterInstall, officialRuntimeInstallArgs, writeOfficialRuntimeManifest } from './plugin-seed.js'
import { terminateProcessTree } from './process-control.js'

export const DESKTOP_BRIDGE_PACKAGE = 'dsh-desktop-bridge'

export interface DesktopPnpmHandle {
  readonly stdout: NodeJS.ReadableStream
  readonly stderr: NodeJS.ReadableStream
  readonly done: Promise<{ readonly exitCode: number | null; readonly signal: NodeJS.Signals | null }>
  cancel(): void
}

export interface DesktopHostOptions {
  profileName: string
  profileDir: string
  desktopRuntimeDir?: string
  send?: (message: unknown) => void
  runner?: (args: readonly string[], cwd: string, signal?: AbortSignal) => DesktopPnpmHandle
  recycleDelayMs?: number
  isInstalled?: (packageName: string) => boolean
}

export function shouldRecycleAfterPluginArgs(args: readonly string[]): boolean {
  return pluginCommandAction(args) !== 'other'
}

export function packageNameFromSpec(spec: string): string {
  if (spec.startsWith('@')) {
    const rest = spec.slice(1)
    const cut = rest.indexOf('@')
    return cut === -1 ? spec : '@' + rest.slice(0, cut)
  }
  return spec.split('@')[0] ?? spec
}

export function pluginCommandAction(args: readonly string[]): 'add' | 'remove' | 'update' | 'install' | 'other' {
  if (args.includes('add')) return 'add'
  if (args.includes('remove') || args.includes('uninstall')) return 'remove'
  if (args.includes('update')) return 'update'
  if (args.includes('install')) return 'install'
  return 'other'
}

export function pluginCommandPackageNames(args: readonly string[]): string[] {
  return args
    .filter((item) => item !== 'add' && item !== 'remove' && item !== 'uninstall' && item !== 'update' && item !== 'install' && !item.startsWith('-'))
    .map(packageNameFromSpec)
}

export function officialPluginCommandSpecs(args: readonly string[]): string[] {
  return args
    .filter((item) => item !== 'add' && item !== 'remove' && item !== 'uninstall' && item !== 'update' && item !== 'install' && !item.startsWith('-'))
    .filter((item) => isDeepSeekOfficialPackage(packageNameFromSpec(item)))
}

export function officialPluginUpdateVersion(args: readonly string[]): string | undefined {
  const action = pluginCommandAction(args)
  if (action !== 'add' && action !== 'update' && action !== 'install') return undefined
  const specs = officialPluginCommandSpecs(args).filter(item => isOfficialDshPackage(packageNameFromSpec(item)))
  if (specs.length === 0) return undefined
  const preferred = specs.find((item) => packageNameFromSpec(item) === '@deepseek-ai/dsh') ?? specs[0]
  if (preferred === undefined) return undefined
  const name = packageNameFromSpec(preferred)
  const version = preferred.slice(name.length).replace(/^@/, '')
  return version === '' ? OFFICIAL_DSH_VERSION : version
}

/** add/update 必须能在 profile 里解析到包，才算安装成功并允许热重启。 */
export function shouldRecycleAfterPluginResult(
  args: readonly string[],
  isInstalled: (packageName: string) => boolean,
  beforeProfileState?: string,
  afterProfileState?: string,
): boolean {
  const action = pluginCommandAction(args)
  if (action === 'other') return false
  const names = pluginCommandPackageNames(args)
  if (action !== 'remove' && names.length > 0 && !names.every((name) => isInstalled(name))) return false
  if (beforeProfileState !== undefined && afterProfileState !== undefined) return beforeProfileState !== afterProfileState
  if (action === 'remove') return true
  if (names.length === 0) return true
  return true
}

/** 仅比较本次命令涉及的运行时状态，避免 pnpm 未替换版本时误重载 DSH。 */
function profilePackageState(profileDir: string, packageNames: readonly string[]): string | undefined {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { profile?: { bundles?: string[] } }
    }
    const dependencies = manifest.dependencies ?? {}
    const bundles = new Set(manifest.dsh?.profile?.bundles ?? [])
    return JSON.stringify(packageNames.map((name) => ({
      name,
      dependency: dependencies[name],
      bundled: bundles.has(name),
      version: installedPackageVersion(profileDir, name),
    })))
  } catch {
    return undefined
  }
}

function installedPackageVersion(profileDir: string, packageName: string): string | undefined {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir, 'node_modules', ...packageName.split('/'), 'package.json'), 'utf8')) as { version?: unknown }
    return typeof manifest.version === 'string' ? manifest.version : undefined
  } catch {
    return undefined
  }
}

export function createDesktopHostServices(options: DesktopHostOptions) {
  const runPlugin = (args: readonly string[], _invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle => {
    const officialSpecs = officialPluginCommandSpecs(args)
    const communitySpecs = pluginCommandPackageNames(args).filter(name => !isDeepSeekOfficialPackage(name))
    if (officialSpecs.length > 0 && communitySpecs.length > 0) {
      return completedPnpmHandle(1, '不能在同一条命令中混合安装官方包和社区包，请分别操作。\n')
    }
    const officialVersion = officialPluginUpdateVersion(args)
    if (officialVersion !== undefined && options.desktopRuntimeDir !== undefined) {
      writeOfficialRuntimeManifest(options.desktopRuntimeDir, officialVersion)
      const handle = (options.runner ?? runBundledPnpm)(officialRuntimeInstallArgs(options.desktopRuntimeDir), options.desktopRuntimeDir, signal)
      void handle.done.then(async (outcome) => {
        if (outcome.exitCode !== 0) return
        const delay = options.recycleDelayMs ?? 400
        setTimeout(() => {
          options.send?.(APPLY_PLUGIN_UPDATES_IPC)
        }, delay).unref?.()
      }).catch(error => { console.error('官方运行时更新后处理失败。', error) })
      return handle
    }
    if (officialSpecs.length > 0) {
      const message = pluginCommandAction(args) === 'remove'
        ? '官方运行时由桌面端统一管理，不能从插件市场卸载。\n'
        : '官方依赖随桌面运行时统一更新，不能单独安装到 Web profile。\n'
      return completedPnpmHandle(1, message)
    }
    const packageNames = pluginCommandPackageNames(args)
    const beforeProfileState = packageNames.length === 0 ? undefined : profilePackageState(options.profileDir, packageNames)
    const handle = (options.runner ?? runBundledPnpm)(args, options.profileDir, signal)
    void handle.done.then(async (outcome) => {
      if (outcome.exitCode !== 0) return
      const isInstalled = options.isInstalled ?? ((packageName) => existsSync(join(options.profileDir, 'node_modules', ...packageName.split('/'), 'package.json')))
      await finalizeProfileBundlesAfterInstall(options.profileDir, [], packageNames.length === 0 ? undefined : packageNames)
      const afterProfileState = packageNames.length === 0 ? undefined : profilePackageState(options.profileDir, packageNames)
      if (!shouldRecycleAfterPluginResult(args, isInstalled, beforeProfileState, afterProfileState)) return
      const delay = options.recycleDelayMs ?? 400
      setTimeout(() => {
        options.send?.(APPLY_PLUGIN_UPDATES_IPC)
      }, delay).unref?.()
    }).catch(error => { console.error('插件安装后处理失败。', error) })
    return handle
  }
  return {
    desktopProfiles: {
      connected: true,
      current: {
        name: options.profileName,
        dir: options.profileDir,
        connected: true,
      },
      list() {
        return [{ name: options.profileName, dir: options.profileDir }]
      },
      async select() {
        return
      },
    },
    desktopPnpm: {
      connected: true,
      run(args: readonly string[], signal?: AbortSignal): DesktopPnpmHandle {
        return runPlugin(args, options.profileDir, signal)
      },
      runPlugin,
    },
  }
}
export function runBundledPnpm(args: readonly string[], cwd: string, signal?: AbortSignal, timeoutMs = 300_000): DesktopPnpmHandle {
  const pnpmEntry = process.env.DSH_PNPM_ENTRY ?? process.env.npm_execpath
  if (pnpmEntry === undefined || !existsSync(pnpmEntry)) {
    return completedPnpmHandle(127, '未找到 pnpm 入口，无法执行插件操作。\n')
  }
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const storeDir = process.env.DSH_PNPM_STORE_DIR
  const effectiveArgs = storeDir === undefined || args.some(arg => arg === '--store-dir' || arg.startsWith('--store-dir=')) ? args : [...args, `--store-dir=${storeDir}`]
  const child: ChildProcess = spawn(process.execPath, [pnpmEntry, ...effectiveArgs], {
    cwd,
    env: process.env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.pipe(stdout)
  child.stderr?.pipe(stderr)
  const done = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolvePromise) => {
    let settled = false
    let timedOut = false
    let killDeadline: ReturnType<typeof setTimeout> | undefined
    const finish = (exitCode: number | null, exitSignal: NodeJS.Signals | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearTimeout(killDeadline)
      stdout.end()
      stderr.end()
      resolvePromise({ exitCode, signal: exitSignal })
    }
    const timeout = setTimeout(() => {
      timedOut = true
      stderr.write('pnpm 操作超时，已终止子进程。\n')
      terminateProcessTree(child)
      killDeadline = setTimeout(() => finish(124, null), 2_000)
    }, timeoutMs)
    timeout.unref?.()
    child.once('error', () => finish(127, null))
    child.once('exit', (code, exitSignal) => timedOut ? finish(124, null) : finish(code, exitSignal))
    signal?.addEventListener('abort', () => terminateProcessTree(child), { once: true })
  })
  return {
    stdout,
    stderr,
    done,
    cancel: () => { terminateProcessTree(child) },
  }
}

function completedPnpmHandle(exitCode: number, message = ''): DesktopPnpmHandle {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  queueMicrotask(() => {
    stdout.end()
    stderr.end(message)
  })
  return {
    stdout,
    stderr,
    done: Promise.resolve({ exitCode, signal: null }),
    cancel: () => undefined,
  }
}

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const DESKTOP_BRIDGE_FILES = [
  'desktop-bridge.mjs',
  'desktop-bridge-client-source.js',
  'atomic-file.js',
  'desktop-host.js',
  'bundled-plugins.js',
  'dsh-process.js',
  'plugin-seed.js',
  'plugin-toolchain.js',
  'profile-updates.js',
  'process-control.js',
  'readiness.js',
  'runtime-archive.js',
  'runtime-prebuilt.js',
] as const

export function resolveDesktopBridgeDir(options: { isPackaged: boolean; appPath: string; resourcesPath: string }): string {
  return options.isPackaged
    ? join(options.resourcesPath, 'desktop-bridge')
    : join(options.appPath, 'dist', 'src')
}

export function installDesktopBridge(profileDir: string, sourceDir: string): void {
  const destDir = join(profileDir, 'node_modules', DESKTOP_BRIDGE_PACKAGE)
  mkdirSync(destDir, { recursive: true })
  for (const file of DESKTOP_BRIDGE_FILES) {
    const from = join(sourceDir, file)
    if (!existsSync(from)) throw new Error(`桌面桥接文件缺失：${from}`)
    copyFileSync(from, join(destDir, file))
  }
  writeFileSync(join(destDir, 'desktop-bridge-client.js'), desktopBridgeClientBundle(), 'utf8')
  writeFileSync(join(destDir, 'package.json'), `${JSON.stringify({
    name: DESKTOP_BRIDGE_PACKAGE,
    version: '0.0.0-desktop',
    type: 'module',
    main: 'desktop-bridge.mjs',
    exports: {
      '.': './desktop-bridge.mjs',
      './client': './desktop-bridge-client.js',
      './package.json': './package.json',
    },
    dsh: {
      bundle: { patch: './cordis.patch.yml' },
      client: {
        inject: [
          '@deepseek-ai/dsh-client-locale',
          '@deepseek-ai/dsh-client-runtime',
          '@deepseek-ai/dsh-client-ui-conversation',
          '@deepseek-ai/dsh-client-ui-layout',
          '@deepseek-ai/dsh-client-ui-workspace',
        ],
        platform: 'web',
      },
    },
  }, undefined, 2)}\n`, 'utf8')
  // The profile patch owns the host insertion; this empty bundle patch makes
  // the internal package a first-class profile bundle so DSH discovers its
  // client half as well.
  writeFileSync(join(destDir, 'cordis.patch.yml'), '[]\n', 'utf8')
  ensureDesktopBridgeBundle(profileDir)
  ensureDesktopBridgePatch(profileDir)
}

export function ensureDesktopBridgeBundle(profileDir: string): void {
  const manifestPath = join(profileDir, 'package.json')
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8')) as { dsh?: { profile?: { bundles?: string[] } } }
    : {}
  const bundles = manifest.dsh?.profile?.bundles ?? []
  if (bundles.includes(DESKTOP_BRIDGE_PACKAGE)) return
  manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: [...bundles, DESKTOP_BRIDGE_PACKAGE] } }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, undefined, 2)}\n`, 'utf8')
}

export function mergeDesktopBridgePatch(current: string): string {
  const entry = `- insert:\n  - id: ${DESKTOP_BRIDGE_PACKAGE}\n    name: ${DESKTOP_BRIDGE_PACKAGE}`
  const lines = current.replace(/\r\n/g, '\n').split('\n')
  const comments = lines.filter((line) => line.trim().startsWith('#'))
  const body = lines.filter((line) => {
    const trimmed = line.trim()
    return trimmed !== '' && !trimmed.startsWith('#')
  }).join('\n').trim()
  const rest = body === '[]' ? '' : body.replace(/(?:^|\n)\[\]\s*$/g, '').trim()
  const legacyEntry = new RegExp(`(?:^|\\n)- id: ${DESKTOP_BRIDGE_PACKAGE}\\n  name: ${DESKTOP_BRIDGE_PACKAGE}(?=\\n|$)`, 'g')
  const normalized = rest.replace(legacyEntry, '').trim()
  const hasEntry = normalized.includes(`- insert:\n  - id: ${DESKTOP_BRIDGE_PACKAGE}\n    name: ${DESKTOP_BRIDGE_PACKAGE}`)
  const items = hasEntry
    ? normalized
    : normalized === '' ? entry : `${entry}\n${normalized}`
  const header = comments.length > 0 ? `${comments.join('\n')}\n` : ''
  return `${header}${items}\n`
}

export function ensureDesktopBridgePatch(profileDir: string): void {
  const patchPath = join(profileDir, 'cordis.patch.yml')
  const current = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : ''
  const next = mergeDesktopBridgePatch(current)
  if (next !== current) writeFileSync(patchPath, next, 'utf8')
}
