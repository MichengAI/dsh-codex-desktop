import type { Cookies } from 'electron'

/** 新后端使用启动 token 重新登录前，清理专用桌面会话内的旧 DSH 认证。 */
export async function clearPreviousDshAuthCookies(cookies: Pick<Cookies, 'get' | 'remove'>, serverUrl: string): Promise<void> {
  const target = new URL(serverUrl)
  if (!target.searchParams.get('token') || target.protocol !== 'http:') return
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) return
  const cookieUrl = `${target.origin}/`
  const existing = await cookies.get({ url: cookieUrl })
  // Cookie 不区分端口；随机端口的旧后端认证会随每次请求一起发送，最终触发 HTTP 431。
  for (const cookie of existing) {
    if (cookie.domain !== target.hostname || cookie.path !== '/' || !/^dsh-auth-[A-Za-z0-9_-]+$/.test(cookie.name)) continue
    await cookies.remove(cookieUrl, cookie.name)
  }
}
