import type { WebContents } from 'electron'

const AUTHORIZE_URL = /"authorizeUrl"\s*:\s*"((?:https?:)(?:\\\/|\/)[^"]+)"/u

/** 从账号状态消息里取出登录地址。没有可用地址时返回 undefined。 */
export function loginUrlFromPayload(payload: string): string | undefined {
  const match = AUTHORIZE_URL.exec(payload)
  if (match === null) return undefined
  try {
    const url = new URL(match[1].replace(/\\\//gu, '/'))
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    return url.href
  } catch {
    return undefined
  }
}

/** 给登录地址加上当前主题，和官方桌面打开浏览器时一致。 */
export function platformLoginUrl(authorizeUrl: string, dark: boolean): string {
  const url = new URL(authorizeUrl)
  url.searchParams.set('theme', dark ? 'dark' : 'light')
  return url.href
}

/**
 * 官方桌面会在登录进入 waiting-browser 时用系统浏览器打开授权页。
 * 页面本身不会弹窗，所以这里监听本机账号通道，发现授权地址就打开一次。
 */
export function installAccountLoginOpener(
  contents: WebContents,
  open: (url: string) => Promise<void>,
  dark = () => false,
): void {
  const seen = new Set<string>()
  const handle = (payload: string): void => {
    const authorizeUrl = loginUrlFromPayload(payload)
    if (authorizeUrl === undefined || seen.has(authorizeUrl)) return
    seen.add(authorizeUrl)
    void open(platformLoginUrl(authorizeUrl, dark())).catch(() => {
      seen.delete(authorizeUrl)
    })
  }
  try {
    if (!contents.debugger.isAttached()) contents.debugger.attach('1.3')
  } catch {
    return
  }
  contents.debugger.on('message', (_event, method, params: unknown) => {
    if (method !== 'Network.webSocketFrameReceived') return
    const payload = (params as { response?: { payloadData?: unknown } } | null)?.response?.payloadData
    if (typeof payload === 'string') handle(payload)
  })
  void contents.debugger.sendCommand('Network.enable').catch(() => {})
  contents.once('destroyed', () => {
    try { if (contents.debugger.isAttached()) contents.debugger.detach() } catch { /* 视图已关闭 */ }
  })
}
