/** 启动任务的实际计量；没有总量的任务保持不确定进度。 */
export interface StartupProgress {
  phase: 'verify' | 'extract' | 'copy' | 'scan' | 'sync' | 'index' | 'install' | 'server' | 'renderer'
  completed?: number
  total?: number
  unit?: 'bytes' | 'files' | 'entries'
  detail?: { resolved: number; reused: number; downloaded: number; added: number }
}

export function parsePnpmProgress(line: string): StartupProgress | undefined {
  const match = /^Progress: resolved (\d+), reused (\d+), downloaded (\d+), added (\d+)/.exec(line)
  if (!match) return undefined
  const [resolved, reused, downloaded, added] = match.slice(1).map(Number)
  return { phase: 'install', detail: { resolved, reused, downloaded, added } }
}

export function formatStartupProgress(progress: StartupProgress, zh: boolean): {
  message: string; detail: string; completed?: number; total?: number
} {
  const labels: Record<StartupProgress['phase'], [string, string]> = {
    verify: ['正在校验随包资源', 'Verifying bundled resources'],
    extract: ['正在解压随包资源', 'Extracting bundled resources'],
    copy: ['正在写入运行环境文件', 'Writing runtime files'],
    scan: ['正在统计配套依赖文件', 'Counting bundled dependency files'],
    sync: ['正在同步配套依赖文件', 'Syncing bundled dependency files'],
    index: ['正在更新依赖索引', 'Updating the dependency index'],
    install: ['正在安装插件及依赖', 'Installing plugins and dependencies'],
    server: ['正在启动 DSH 服务', 'Starting the DSH service'],
    renderer: ['正在加载工作界面', 'Loading the workspace'],
  }
  let detail = ''
  const { completed, total } = progress
  const measured = Number.isFinite(completed) && Number.isFinite(total) && total! > 0 && completed! >= 0 && completed! <= total!
  if (measured) {
    detail = progress.unit === 'bytes'
      ? `${(completed! / 1048576).toFixed(1)} / ${(total! / 1048576).toFixed(1)} MB`
      : `${completed!.toLocaleString()} / ${total!.toLocaleString()} ${progress.unit === 'entries'
        ? (zh ? '项' : 'entries') : progress.phase === 'sync'
          ? (zh ? '个文件（含已存在）' : 'files (including existing files)') : (zh ? '个文件' : 'files')}`
  }
  if (progress.detail) {
    const { resolved, reused, downloaded, added } = progress.detail
    detail = zh ? `已解析 ${resolved} · 已复用 ${reused} · 已下载 ${downloaded} · 已安装 ${added}`
      : `Resolved ${resolved} · Reused ${reused} · Downloaded ${downloaded} · Added ${added}`
  }
  return { message: labels[progress.phase][zh ? 0 : 1], detail,
    ...(measured ? { completed, total } : {}) }
}
