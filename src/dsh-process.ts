import { spawn, type ChildProcess } from 'node:child_process'

import { prependPath } from './plugin-toolchain.js'
import { parseReadyUrl } from './readiness.js'
import { APPLY_PLUGIN_UPDATES_IPC } from './bundled-plugins.js'
import { terminateProcessTree } from './process-control.js'
import type { DshRuntime } from './runtime.js'

export { APPLY_PLUGIN_UPDATES_IPC }

const startupTimeoutMs = 45_000
const maxCapturedOutputLength = 12_000
const shutdownTimeoutMs = 5_000
const forcedShutdownDeadlineMs = 2_000

export interface DshServer {
  stop: () => Promise<void>
  url: string
}

export interface StartDshOptions {
  bootstrapPath: string
  environment?: NodeJS.ProcessEnv
  onUnexpectedExit?: (message: string) => void
  onIpcMessage?: (message: unknown) => void
  pathPrefix?: string
  workingDirectory?: string
  runtime: DshRuntime
  nodeExecutable: string
  startupTimeoutMs?: number
}

/** 桌面窗口已经承载 Web UI，禁止官方 dsh-web-app 再拉起系统浏览器。 */
export const DSH_WEB_LAUNCH_ARGS = ['web', '--port', resolveDesktopWebPort(process.env.DSH_DESKTOP_WEB_PORT), '--no-open'] as const

export function resolveDesktopWebPort(value: string | undefined): string {
  if (value === undefined || !/^\d+$/.test(value)) return '0'
  const port = Number(value)
  return Number.isSafeInteger(port) && port >= 1 && port <= 65_535 ? String(port) : '0'
}

/** 启动 DSH Web，并在收到本机就绪地址后返回。 */
export function startDsh(options: StartDshOptions): Promise<DshServer> {
  const child = spawn(options.nodeExecutable, [options.bootstrapPath, options.runtime.entry, ...DSH_WEB_LAUNCH_ARGS], {
    cwd: options.workingDirectory ?? options.runtime.workingDirectory ?? options.runtime.root,
    env: {
      ...process.env,
      ...options.environment,
      ...(options.pathPrefix === undefined ? {} : {
        PATH: prependPath(options.environment?.PATH ?? process.env.PATH, options.pathPrefix),
      }),
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  })

  return waitForReady(child, options.startupTimeoutMs ?? startupTimeoutMs)
    .then(url => createServer(child, url, options.onUnexpectedExit, options.onIpcMessage))
}

function waitForReady(child: ChildProcess, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let capturedOutput = ''
    let checkingHealth = false
    let settled = false
    let timeout: ReturnType<typeof setTimeout>
    const finish = (callback: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      callback()
    }
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      void stopChild(child).then(() => reject(error), () => reject(error))
    }
    const capture = (chunk: Buffer): void => {
      capturedOutput = (capturedOutput + chunk.toString('utf8')).slice(-maxCapturedOutputLength)
      const url = parseReadyUrl(capturedOutput)
      if (url === undefined || checkingHealth) return
      checkingHealth = true
      clearTimeout(timeout)
      void waitForHttpHealth(url, timeoutMs)
        .then(() => finish(() => resolve(url)))
        .catch(() => fail(new Error('DSH 启动失败：本机 HTTP 服务未通过健康检查。')))
    }
    timeout = setTimeout(() => {
      fail(new Error('DSH 启动超时。'))
    }, timeoutMs)

    if (child.stdout === null || child.stderr === null) {
      fail(new Error('DSH 无法建立标准输出管道。'))
      return
    }

    child.stdout.on('data', capture)
    child.stderr.on('data', capture)
    child.once('error', () => fail(new Error('DSH 无法启动。')))
    child.once('exit', code => {
      if (settled) return
      finish(() => reject(new Error(formatEarlyExitMessage(code, capturedOutput))))
    })
  })
}

export function isApplyPluginUpdatesIpc(message: unknown): boolean {
  return message === APPLY_PLUGIN_UPDATES_IPC
    || (typeof message === 'object' && message !== null && 'type' in message && message.type === APPLY_PLUGIN_UPDATES_IPC)
}

function createServer(child: ChildProcess, url: string, onUnexpectedExit?: (message: string) => void, onIpcMessage?: (message: unknown) => void): DshServer {
  let stopping = false
  let stopPromise: Promise<void> | undefined

  child.on('message', message => { onIpcMessage?.(message) })
  child.once('exit', (code, signal) => {
    if (!stopping) onUnexpectedExit?.(`DSH 运行中断（退出码 ${code ?? '未知'}，信号 ${signal ?? '无'}）。`)
  })

  return {
    url,
    stop: () => {
      stopping = true
      stopPromise ??= stopChild(child)
      return stopPromise
    },
  }
}

/** 通过 IPC 请求上游 DSH 优雅退出，超时后才强制结束本启动器创建的 PID。 */
function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()

  return new Promise(resolve => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(forceTimer)
      clearTimeout(deadlineTimer)
      resolve()
    }
    const deadlineTimer = setTimeout(finish, shutdownTimeoutMs + forcedShutdownDeadlineMs)
    const forceTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) terminateProcessTree(child)
    }, shutdownTimeoutMs)

    child.once('exit', finish)
    if (child.connected && child.send !== undefined) {
      child.send('shutdown', error => {
        if (error !== null) terminateProcessTree(child)
      })
      return
    }
    child.kill('SIGTERM')
  })
}

function formatEarlyExitMessage(code: number | null, capturedOutput: string): string {
  const detail = capturedOutput.replace(/\s+/g, ' ').trim()
  return detail === ''
    ? `DSH 提前退出（退出码 ${code ?? '未知'}）。`
    : `DSH 提前退出（退出码 ${code ?? '未知'}）。${detail}`
}

async function waitForHttpHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(1_000, Math.max(1, deadline - Date.now()))) })
      if (response.ok) {
        await response.body?.cancel()
        return
      }
    } catch {
      // 就绪行可能早于 HTTP 监听完成，超时前继续轮询。
    }
    await new Promise<void>(resolve => setTimeout(resolve, 50))
  }
  throw new Error('HTTP 健康检查超时。')
}
