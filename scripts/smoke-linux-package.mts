import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const startupTimeoutMs = 60_000

async function main(): Promise<void> {
  if (process.platform !== 'linux') throw new Error('Linux 冒烟脚本只能在 Linux 上执行。')
  const applicationPath = resolve(readArgument('--application-path'))
  if (!existsSync(applicationPath)) throw new Error(`未找到 Linux 应用可执行文件：${applicationPath}`)

  // GitHub Runner 无法为未安装目录中的 chrome-sandbox 设置 root/4755；仅冒烟检查禁用 Chromium 沙箱。
  const application = spawn(applicationPath, ['--no-sandbox'], { stdio: ['ignore', 'pipe', 'pipe'] })
  if (!application.pid) throw new Error('未获取到应用进程 ID。')
  let applicationOutput = ''
  const captureOutput = (chunk: Buffer): void => {
    applicationOutput = (applicationOutput + chunk.toString('utf8')).slice(-4_096)
  }
  application.stdout?.on('data', captureOutput)
  application.stderr?.on('data', captureOutput)
  let bootstrapProcessId: number | undefined
  try {
    const baseUrl = await waitForHealthyServer(application, () => applicationOutput)
    bootstrapProcessId = await findBootstrapProcessId(application.pid)
    const page = await fetch(`${baseUrl}/`)
    if (page.status !== 200) throw new Error(`根页面返回 HTTP ${page.status}。`)
    const content = await page.text()
    const assetPath = /(?:src|href)=["'](?<path>\/[^"']+\.(?:js|css))/.exec(content)?.groups?.path
    if (!assetPath) throw new Error('根页面未找到可验证的前端资源。')
    const asset = await fetch(baseUrl + assetPath)
    if (asset.status !== 200) throw new Error(`前端资源返回 HTTP ${asset.status}。`)
  } finally {
    await stopApplication(application)
    if (bootstrapProcessId !== undefined && !await waitForProcessExit(bootstrapProcessId, 10_000)) {
      throw new Error(`DSH 引导进程 ${bootstrapProcessId} 未在应用退出后结束。`)
    }
  }
}

function readArgument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value) throw new Error(`缺少参数：${name}`)
  return value
}

async function waitForHealthyServer(application: ChildProcess, getApplicationOutput: () => string): Promise<string> {
  const deadline = Date.now() + startupTimeoutMs
  while (Date.now() < deadline) {
    if (application.exitCode !== null) {
      throw new Error(`打包应用提前退出（退出码 ${application.exitCode}）。${getApplicationOutput()}`)
    }
    const bootstrapProcessId = await findBootstrapProcessId(application.pid!)
    if (bootstrapProcessId !== undefined) {
      const port = await findListeningPort(bootstrapProcessId)
      if (port !== undefined) return `http://127.0.0.1:${port}`
    }
    await delay(500)
  }
  const startupError = readStartupError()
  throw new Error(`打包应用在 60 秒内未启动本机 HTTP 服务。${startupError === undefined ? getApplicationOutput() : ` 启动诊断：${startupError}`}`)
}

function readStartupError(): string | undefined {
  const appDataPath = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
  const logPath = join(appDataPath, 'DSH Codex Desktop', 'startup-error.log')
  if (!existsSync(logPath)) return undefined
  return readFileSync(logPath, 'utf8').trim()
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

async function findListeningPort(processId: number): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(processId), '-iTCP', '-sTCP:LISTEN', '-n', '-P'])
    const port = /127\.0\.0\.1:(\d+)/.exec(stdout)?.[1]
    return port ? Number(port) : undefined
  } catch {
    return undefined
  }
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
