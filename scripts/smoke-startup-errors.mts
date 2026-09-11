/** 冒烟使用独立 userData：任何本轮错误日志都使检查失败，即使 ready 已写出。 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function assertNoStartupErrors(userDataDir: string): void {
  for (const name of ['startup-error.log', 'plugin-seed.log', 'plugin-update.log']) {
    const path = join(userDataDir, name)
    if (existsSync(path)) throw new Error(`${name}: ${readFileSync(path, 'utf8').trim() || '启动产生错误日志。'}`)
  }
}
