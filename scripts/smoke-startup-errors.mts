/** 冒烟使用独立 userData：任何本轮错误日志都使检查失败，即使 ready 已写出。 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function assertNoStartupErrors(userDataDir: string): void {
  for (const name of ['startup-error.log', 'plugin-seed.log', 'plugin-update.log']) {
    const path = join(userDataDir, name)
    if (existsSync(path)) throw new Error(`${name}: ${readFileSync(path, 'utf8').trim() || '启动产生错误日志。'}`)
  }
}

/** DSH 0.2.3-alpha.2+ 无令牌访问根路径时返回 HTML 登录页，旧版返回纯文本提示。 */
export function isDshAuthChallenge(content: string): boolean {
  return content.includes('dsh web authentication required')
    || (content.includes('<title>Connect to this Host</title>') && content.includes('id="token-form"'))
}
