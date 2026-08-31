import { spawn, type ChildProcess } from 'node:child_process'

interface TerminateProcessTreeOptions {
  processGroup?: boolean
}

export function terminateProcessTree(child: ChildProcess, options: TerminateProcessTreeOptions = {}): void {
  if (child.exitCode !== null || child.signalCode !== null || child.killed) return
  if (process.platform === 'win32' && child.pid !== undefined) {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
    killer.once('error', () => { child.kill('SIGKILL') })
    return
  }
  if (options.processGroup === true && child.pid !== undefined) {
    try {
      process.kill(-child.pid, 'SIGKILL')
      return
    } catch {
      // 子进程可能在创建进程组前退出；回退到直接终止。
    }
  }
  child.kill('SIGKILL')
}
