import type { WebContents } from 'electron'


/** 登录页只接受 DeepSeek 官方账号域，避免页面里的任意 WebSocket 帧打开外部地址。 */
const ACCOUNT_LOGIN_HOSTS = ['platform.deepseek.com', 'api.deepseek.com'] as const

const WAITING_PHASE = /["\\]+phase["\\]+\s*:\s*["\\]+waiting-browser["\\]+/u
const IDLE_PHASE = /["\\]+phase["\\]+\s*:\s*["\\]+(?:cancelled|failed|expired|succeeded)["\\]+/u

/** 同一登录地址至少隔这么久才允许再开，避免消息级 id 变化时反复打开浏览器。 */
export const LOGIN_URL_COOLDOWN_MS = 30_000

export interface AccountLoginSniffer {
  handleFrame: (payload: string) => void
}

function unescapeJsonString(value: string): string {
  return value.replace(/\\u([0-9a-fA-F]{4})/gu, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\(["\\/bfnrt])/gu, (_match, char: string) => {
      if (char === 'n') return '\n'
      if (char === 'r') return '\r'
      if (char === 't') return '\t'
      if (char === 'b') return '\b'
      if (char === 'f') return '\f'
      return char
    })
}

function payloadVariants(payload: string): string[] {
  const variants = [payload]
  let current = payload
  for (let depth = 0; depth < 2; depth += 1) {
    const next = unescapeJsonString(current)
    if (next === current) break
    variants.push(next)
    current = next
  }
  return variants
}

/** 官方登录地址必须是 https，且主机名是 DeepSeek 账号域。 */
export function allowedLoginUrl(value: string): string | undefined {
  try {
    const url = new URL(unescapeJsonString(value))
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return undefined
    if (!ACCOUNT_LOGIN_HOSTS.some(name => host === name || host.endsWith(`.${name}`))) return undefined
    return url.href
  } catch {
    return undefined
  }
}

/** 从普通 JSON 或再编码的账号消息里取出全部合法登录地址。 */
export function loginUrlsFromPayload(payload: string): string[] {
  const found: string[] = []
  for (const text of payloadVariants(payload)) {
    for (const match of text.matchAll(/"authorizeUrl"\s*:\s*"([^"]+)"/gu)) {
      const url = allowedLoginUrl(match[1] ?? '')
      if (url !== undefined && !found.includes(url)) found.push(url)
    }
  }
  return found
}

/** 给登录地址加上当前主题，和官方桌面打开浏览器时一致。 */
export function platformLoginUrl(authorizeUrl: string, dark: boolean): string {
  const url = new URL(authorizeUrl)
  url.searchParams.set('theme', dark ? 'dark' : 'light')
  return url.href
}

/**
 * 同一登录地址在冷却期内只打开一次，不看帧里的 id。
 * open 失败或阶段结束后可以立刻再开。
 */
export function createAccountLoginSniffer(
  open: (url: string) => Promise<void>,
  dark: () => boolean = () => false,
  now: () => number = Date.now,
  warn: (message: string) => void = message => console.warn(message),
): AccountLoginSniffer {
  const openedAt = new Map<string, number>()
  return {
    handleFrame(payload: string): void {
      const waiting = WAITING_PHASE.test(payload)
      if (!waiting && IDLE_PHASE.test(payload)) openedAt.clear()
      if (!waiting) return
      for (const authorizeUrl of loginUrlsFromPayload(payload)) {
        const opened = openedAt.get(authorizeUrl)
        if (opened !== undefined && now() - opened < LOGIN_URL_COOLDOWN_MS) continue
        openedAt.set(authorizeUrl, now())
        void open(platformLoginUrl(authorizeUrl, dark())).catch(error => {
          openedAt.delete(authorizeUrl)
          warn(`未能打开登录页：${error instanceof Error ? error.message : '未知错误'}`)
        })
      }
    },
  }
}

function socketUrl(params: unknown): string | undefined {
  const url = (params as { url?: unknown } | null)?.url
  return typeof url === 'string' ? url : undefined
}

function frameRequestId(params: unknown): string | undefined {
  const requestId = (params as { requestId?: unknown } | null)?.requestId
  return typeof requestId === 'string' ? requestId : undefined
}

function framePayload(params: unknown): string | undefined {
  const payload = (params as { response?: { payloadData?: unknown } } | null)?.response?.payloadData
  return typeof payload === 'string' ? payload : undefined
}

/** 只处理连到本机 DSH 的 WebSocket，不扫描页面上的外部连接。 */
export function isLocalAccountSocket(url: string): boolean {
  try {
    const target = new URL(url)
    return (target.protocol === 'ws:' || target.protocol === 'wss:')
      && (target.hostname === '127.0.0.1' || target.hostname === 'localhost' || target.hostname === '[::1]')
  } catch {
    return false
  }
}

/**
 * 官方桌面会在登录进入 waiting-browser 时用系统浏览器打开授权页。
 * 页面本身不会弹窗，所以这里只监听本机 DSH 通道里的授权地址。
 */
export function installAccountLoginOpener(
  contents: WebContents,
  open: (url: string) => Promise<void>,
  dark: () => boolean = () => false,
  warn: (message: string) => void = message => console.warn(message),
): void {
  const sniffer = createAccountLoginSniffer(open, dark, Date.now, warn)
  const localSockets = new Set<string>()
  try {
    if (!contents.debugger.isAttached()) contents.debugger.attach('1.3')
  } catch (error) {
    warn(`未能监听登录通道：${error instanceof Error ? error.message : '调试器不可用'}`)
    return
  }
  contents.debugger.on('message', (_event, method, params: unknown) => {
    if (method === 'Network.webSocketCreated') {
      const requestId = frameRequestId(params)
      const url = socketUrl(params)
      if (requestId !== undefined && url !== undefined && isLocalAccountSocket(url)) localSockets.add(requestId)
      return
    }
    if (method === 'Network.webSocketClosed') {
      const requestId = frameRequestId(params)
      if (requestId !== undefined) localSockets.delete(requestId)
      return
    }
    if (method !== 'Network.webSocketFrameReceived') return
    const requestId = frameRequestId(params)
    if (requestId === undefined || !localSockets.has(requestId)) return
    const payload = framePayload(params)
    if (payload !== undefined) sniffer.handleFrame(payload)
  })
  void contents.debugger.sendCommand('Network.enable').catch(error => {
    warn(`未能启用登录通道监听：${error instanceof Error ? error.message : 'Network.enable 失败'}`)
  })
  contents.once('destroyed', () => {
    try { if (contents.debugger.isAttached()) contents.debugger.detach() } catch { /* 视图已关闭 */ }
  })
}

