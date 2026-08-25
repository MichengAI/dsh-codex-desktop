export type DesktopUpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string; releaseNotes?: string }
  | { kind: 'none' }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string }

export type DesktopTrayItem = {
  id: string
  label: string
  enabled: boolean
  type: 'normal' | 'separator'
}

export const DESKTOP_UPDATE_WARNING = '下载完成后将重启并替换当前桌面应用，请先保存正在进行的工作。'
export const DESKTOP_UPDATE_WARNING_EN = 'The app will restart and replace the current desktop build after download. Save your work first.'

export function desktopUpdateChannel(platform = process.platform, arch = process.arch): string | undefined {
  if (platform !== 'darwin') return undefined
  return arch === 'arm64' ? 'latest-arm64' : 'latest-x64'
}

/** 去掉路径和底层堆栈，避免把本机目录回给对话框。 */
export function publicDesktopUpdateError(error: unknown, locale = 'zh'): string {
  const detail = error instanceof Error ? error.message : String(error)
  const zh = locale.toLowerCase().startsWith('zh')
  if (/ENOTFOUND|ECONN|ETIMEDOUT|net::|404|403/i.test(detail)) return zh ? '无法检查桌面端更新，请稍后重试。' : 'Unable to check for desktop updates. Try again later.'
  if (/download|sha512|blockmap|differential/i.test(detail)) return zh ? '无法下载桌面端更新，请稍后重试。' : 'Unable to download the desktop update. Try again later.'
  if (/[A-Za-z]:\\|\//.test(detail)) return zh ? '桌面端更新失败，请查看桌面日志。' : 'The desktop update failed. Check the desktop logs.'
  return zh ? '桌面端更新失败，请稍后重试。' : 'The desktop update failed. Try again later.'
}

export function desktopUpdatePrompt(status: Extract<DesktopUpdateStatus, { kind: 'available' | 'ready' }>, locale = 'zh'): string {
  const zh = locale.toLowerCase().startsWith('zh')
  if (status.kind === 'ready') {
    return zh ? `桌面端 ${status.version} 已下载。关闭应用后安装新版本。` : `Desktop ${status.version} is ready. Close the app to install it.`
  }
  const notes = status.releaseNotes === undefined || status.releaseNotes.trim() === '' ? '' : `\n\n${status.releaseNotes.trim()}`
  return zh
    ? `发现桌面端 ${status.version}。\n\n${DESKTOP_UPDATE_WARNING}${notes}`
    : `Desktop ${status.version} is available.\n\n${DESKTOP_UPDATE_WARNING_EN}${notes}`
}

/** 原生系统对话框不渲染 HTML 或 Markdown，发布说明统一转为可读文本。 */
export function formatDesktopReleaseNotes(notes: string | Array<{ note?: string | null }> | null | undefined): string | undefined {
  const source = typeof notes === 'string'
    ? notes
    : Array.isArray(notes)
      ? notes.map(item => item.note ?? '').join('\n')
      : ''
  const text = source
    .replace(/\r\n?/g, '\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(?:p|div|section|article|h[1-6])\s*>/gi, '\n\n')
    .replace(/<\s*li\b[^>]*>/gi, '- ')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<\/\s*(?:ul|ol)\s*>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1: $2')
    .replace(/\*\*|__|`/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text === '' ? undefined : text
}

export function buildDesktopTrayItems(input: {
  status: DesktopUpdateStatus
  currentVersion: string
  packaged: boolean
  locale?: string
}): DesktopTrayItem[] {
  const zh = (input.locale ?? 'zh').toLowerCase().startsWith('zh')
  const items: DesktopTrayItem[] = [
    { id: 'show', label: zh ? '显示窗口' : 'Show Window', enabled: true, type: 'normal' },
    { id: 'reload', label: zh ? '重新加载' : 'Reload', enabled: true, type: 'normal' },
    { id: 'sep-1', label: '', enabled: false, type: 'separator' },
    { id: 'version', label: zh ? `当前版本 ${input.currentVersion}` : `Current version ${input.currentVersion}`, enabled: false, type: 'normal' },
  ]

  if (!input.packaged) {
    items.push({ id: 'check', label: zh ? '检查更新…' : 'Check for Updates…', enabled: true, type: 'normal' })
  } else if (input.status.kind === 'checking') {
    items.push({ id: 'check', label: zh ? '正在检查更新…' : 'Checking for Updates…', enabled: false, type: 'normal' })
  } else if (input.status.kind === 'downloading') {
    const percent = Math.max(0, Math.min(100, Math.round(input.status.percent)))
    items.push({ id: 'download', label: zh ? `正在下载 ${percent}%` : `Downloading ${percent}%`, enabled: false, type: 'normal' })
  } else if (input.status.kind === 'available') {
    items.push({ id: 'download', label: zh ? `下载并安装 ${input.status.version}` : `Download and Install ${input.status.version}`, enabled: true, type: 'normal' })
  } else if (input.status.kind === 'ready') {
    items.push({ id: 'install', label: zh ? `安装并重启 ${input.status.version}` : `Install and Restart ${input.status.version}`, enabled: true, type: 'normal' })
  } else {
    items.push({ id: 'check', label: zh ? '检查更新…' : 'Check for Updates…', enabled: true, type: 'normal' })
  }

  items.push({ id: 'sep-2', label: '', enabled: false, type: 'separator' })
  items.push({ id: 'quit', label: zh ? '退出' : 'Quit', enabled: true, type: 'normal' })
  return items
}
