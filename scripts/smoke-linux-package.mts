import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

import { verifyBundledPluginsInstalled } from './smoke-packaged-plugins.mjs'

const execFileAsync = promisify(execFile)
const startupTimeoutMs = 60_000

async function main(): Promise<void> {
  if (process.platform !== 'linux') throw new Error('Linux 冒烟脚本只能在 Linux 上执行。')
  const applicationPath = resolve(readArgument('--application-path'))
  if (!existsSync(applicationPath)) throw new Error(`未找到 Linux 应用可执行文件：${applicationPath}`)

  const tempRoot = await mkdtemp(join(tmpdir(), 'dsh-desktop-smoke-'))
  const userDataDir = join(tempRoot, 'user-data')
  const dshHome = join(tempRoot, 'dsh-home')
  const smokeReadyFile = join(userDataDir, 'startup-ready')
  const startupErrorFile = join(userDataDir, 'startup-error.log')
  await Promise.all([mkdir(userDataDir, { recursive: true }), mkdir(dshHome, { recursive: true })])
  const deadline = Date.now() + startupTimeoutMs
  // GitHub Runner 无法为未安装目录中的 chrome-sandbox 设置 root/4755；仅冒烟检查禁用 Chromium 沙箱。
  const application = spawn(applicationPath, ['--no-sandbox', `--user-data-dir=${userDataDir}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DSH_HOME: dshHome,
      DSH_DESKTOP_SMOKE_READY_FILE: smokeReadyFile,
      npm_config_offline: 'true',
    },
  })
  if (!application.pid) throw new Error('未获取到应用进程 ID。')
  let applicationOutput = ''
  const captureOutput = (chunk: Buffer): void => {
    applicationOutput = (applicationOutput + chunk.toString('utf8')).slice(-4_096)
  }
  application.stdout?.on('data', captureOutput)
  application.stderr?.on('data', captureOutput)
  let bootstrapProcessId: number | undefined
  try {
    const baseUrl = await waitForHealthyServer(application, () => applicationOutput, deadline, startupErrorFile)
    bootstrapProcessId = await findBootstrapProcessId(application.pid)
    const page = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(10_000) })
    const content = await page.text()
    if (page.status === 401) {
      if (!content.includes('dsh web authentication required')) throw new Error('根页面返回了未知的 HTTP 401 响应。')
      await waitForApplicationReady(application, smokeReadyFile, startupErrorFile, deadline, () => applicationOutput)
    } else {
      if (page.status !== 200) throw new Error(`根页面返回 HTTP ${page.status}。`)
      const assetPath = /(?:src|href)=["'](?<path>\/[^"']+\.(?:js|css))/.exec(content)?.groups?.path
      if (!assetPath) throw new Error('根页面未找到可验证的前端资源。')
      const asset = await fetch(baseUrl + assetPath, { signal: AbortSignal.timeout(10_000) })
      if (asset.status !== 200) throw new Error(`前端资源返回 HTTP ${asset.status}。`)
      await waitForApplicationReady(application, smokeReadyFile, startupErrorFile, deadline, () => applicationOutput)
    }
    await verifyBundledPluginsInstalled(dshHome)
  } finally {
    await stopApplication(application)
    const bootstrapStillRunning = bootstrapProcessId !== undefined && !await waitForProcessExit(bootstrapProcessId, 10_000)
    await rm(tempRoot, { recursive: true, force: true })
    if (bootstrapStillRunning) throw new Error(`DSH 引导进程 ${bootstrapProcessId} 未在应用退出后结束。`)
  }
}

function readArgument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value) throw new Error(`缺少参数：${name}`)
  return value
}

async function waitForHealthyServer(application: ChildProcess, getApplicationOutput: () => string, deadline: number, startupErrorFile: string): Promise<string> {
  while (Date.now() < deadline) {
    if (application.exitCode !== null) {
      throw new Error(`打包应用提前退出（退出码 ${application.exitCode}）。${getApplicationOutput()}`)
    }
    const bootstrapProcessId = await findBootstrapProcessId(application.pid!)
    if (bootstrapProcessId !== undefined) {
      const baseUrl = await findHealthyBaseUrl(bootstrapProcessId)
      if (baseUrl !== undefined) return baseUrl
    }
    await delay(500)
  }
  const startupError = readStartupError(startupErrorFile)
  throw new Error(`打包应用在 60 秒内未启动本机 HTTP 服务。${startupError === undefined ? getApplicationOutput() : ` 启动诊断：${startupError}`}`)
}

function readStartupError(startupErrorFile: string): string | undefined {
  if (!existsSync(startupErrorFile)) return undefined
  return readFileSync(startupErrorFile, 'utf8').trim()
}

async function waitForApplicationReady(
  application: ChildProcess,
  smokeReadyFile: string,
  startupErrorFile: string,
  deadline: number,
  getApplicationOutput: () => string,
): Promise<void> {
  const initialStartupError = readStartupError(startupErrorFile)
  if (initialStartupError !== undefined) throw new Error(`桌面应用启动失败：${initialStartupError}`)
  if (application.exitCode !== null) {
    throw new Error(`桌面应用在报告启动完成前退出（退出码 ${application.exitCode}）。${getApplicationOutput()}`)
  }
  while (Date.now() < deadline && !existsSync(smokeReadyFile)) {
    const startupError = readStartupError(startupErrorFile)
    if (startupError !== undefined) throw new Error(`桌面应用启动失败：${startupError}`)
    if (application.exitCode !== null) {
      throw new Error(`桌面应用在报告启动完成前退出（退出码 ${application.exitCode}）。${getApplicationOutput()}`)
    }
    await delay(250)
  }
  if (!existsSync(smokeReadyFile)) throw new Error('桌面应用未在 60 秒内报告启动完成。')
  if (application.exitCode !== null) throw new Error(`桌面应用在启动标记后退出（退出码 ${application.exitCode}）。${getApplicationOutput()}`)
}

async function findBootstrapProcessId(applicationProcessId: number): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-P', String(applicationProcessId)])
    for (const value of stdout.split(/\s+/)) {
      if (!/^\d+$/.test(value)) continue
      const processId = Number(value)
      const { stdout: command } = await execFileAsync('ps', ['-o', 'command=', '-p', String(processId)])
      if (command.includes('bootstrap.mjs')) return processId
    }
  } catch {
    return undefined
  }
  return undefined
}

async function findListeningPorts(processId: number): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(processId), '-iTCP', '-sTCP:LISTEN', '-n', '-P'])
    return [...stdout.matchAll(/127\.0\.0\.1:(\d+)/g)].map(match => Number(match[1]))
  } catch {
    return []
  }
}

async function findHealthyBaseUrl(processId: number): Promise<string | undefined> {
  for (const port of await findListeningPorts(processId)) {
    const baseUrl = `http://127.0.0.1:${port}`
    try {
      const response = await fetch(`${baseUrl}/`, { redirect: 'manual', signal: AbortSignal.timeout(1_000) })
      const content = await response.text()
      if (response.status === 200 || (response.status === 401 && content.includes('dsh web authentication required'))) {
        return baseUrl
      }
    } catch {
      // The listener may still be starting, or it may be an unrelated bootstrap endpoint.
    }
  }
  return undefined
}

async function stopApplication(application: ChildProcess): Promise<void> {
  if (application.exitCode !== null) return
  application.kill('SIGTERM')
  const deadline = Date.now() + 10_000
  while (application.exitCode === null && Date.now() < deadline) await delay(250)
  if (application.exitCode === null) application.kill('SIGKILL')
}

function isProcessRunning(processId: number): boolean {
  try {
    process.kill(processId, 0)
    return true
  } catch {
    return false
  }
}

async function waitForProcessExit(processId: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (isProcessRunning(processId) && Date.now() < deadline) await delay(250)
  return !isProcessRunning(processId)
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) await main()
