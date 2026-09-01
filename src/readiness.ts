// 只消费完整输出行。alpha.2+ 的 URL 带一次性 token；如果 stdout 恰好在
// `http://127.0.0.1:<port>/` 后分片，提前解析会永久丢掉下一片里的 token。
const readyPattern = /dsh web:[ \t]*(https?:\/\/[^\s\r\n]+)\r?\n/i

/** 从 DSH 标准输出中提取可安全嵌入窗口的本机 HTTP 地址。 */
export function parseReadyUrl(output: string): string | undefined {
  const matched = readyPattern.exec(output)
  if (matched?.[1] === undefined) return undefined

  try {
    const url = new URL(matched[1])
    const port = Number(url.port)
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !Number.isInteger(port) || port < 1 || port > 65535) {
      return undefined
    }
    return url.href
  } catch {
    return undefined
  }
}
