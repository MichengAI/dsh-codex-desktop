import { spawn, spawnSync } from 'node:child_process'
import { createHash, timingSafeEqual } from 'node:crypto'
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readSync, readFileSync, writeFileSync } from 'node:fs'

/** 把目录打成单个 tar.gz，避免安装器解压上万个小文件。 */
export function packDirectoryToTarGz(sourceDir: string, archivePath: string): void {
  if (!existsSync(sourceDir)) throw new Error(`压缩源目录不存在：${sourceDir}`)
  const result = spawnSync('tar', ['-czf', archivePath, '-C', sourceDir, '.'], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) {
    throw new Error(`压缩失败：${(result.stderr || result.stdout || archivePath).trim()}`)
  }
}

/** 首启把随包压缩包解到可写目录。 */
export function extractTarGz(archivePath: string, destDir: string): void {
  readArchiveEntries(archivePath)
  mkdirSync(destDir, { recursive: true })
  const result = spawnSync('tar', ['-xzf', archivePath, '-C', destDir], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) {
    throw new Error(`解压失败：${(result.stderr || result.stdout || archivePath).trim()}`)
  }
}

function readArchiveEntries(archivePath: string): string[] {
  if (!existsSync(archivePath)) throw new Error(`压缩包不存在：${archivePath}`)
  const listed = spawnSync('tar', ['-tzf', archivePath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
  if (listed.status !== 0) {
    throw new Error(`无法读取压缩包目录：${(listed.error?.message || listed.stderr || archivePath).trim()}`)
  }
  const entries = listed.stdout.split(/\r?\n/).filter(entry => entry !== '')
  validateArchiveEntries(entries)
  return entries
}

/** 从 tar 的实际条目输出计数，只有成功退出才报告全部完成。 */
export async function extractTarGzWithProgress(archivePath: string, destDir: string,
  onProgress: (completed: number, total: number) => void): Promise<void> {
  const entries = readArchiveEntries(archivePath)
  const expected = new Set(entries)
  const seen = new Set<string>()
  mkdirSync(destDir, { recursive: true })
  onProgress(0, expected.size)
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-xvzf', archivePath, '-C', destDir], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = '', lastReport = 0
    const consume = (line: string): void => {
      // BSD tar 在 stderr 前缀 x，GNU tar 在 stdout 输出路径。
      const entry = expected.has(line) ? line : line.startsWith('x ') ? line.slice(2) : ''
      if (!expected.has(entry)) return
      seen.add(entry)
      if (Date.now() - lastReport >= 100) {
        // 部分 tar 在写文件前输出路径，因此仅计入前一个已处理条目。
        onProgress(Math.max(0, seen.size - 1), expected.size)
        lastReport = Date.now()
      }
    }
    for (const stream of [child.stdout, child.stderr]) {
      let pending = ''
      stream.setEncoding('utf8')
      stream.on('data', (chunk: string) => {
        output = (output + chunk).slice(-8000)
        const lines = (pending + chunk).split(/\r?\n/)
        pending = lines.pop() ?? ''
        for (const line of lines) consume(line)
      })
      stream.on('end', () => { if (pending) consume(pending) })
    }
    child.once('error', reject)
    child.once('close', code => {
      if (code !== 0) reject(new Error(`解压失败：${output.trim() || code}`))
      else resolve()
    })
  })
  onProgress(expected.size, expected.size)
}

export function writeFileSha256(path: string): void {
  writeFileSync(`${path}.sha256`, `${fileSha256(path)}\n`, 'utf8')
}

export function verifyFileSha256(path: string, onProgress?: (completed: number, total: number) => void): void {
  const checksumPath = `${path}.sha256`
  if (!existsSync(checksumPath)) throw new Error(`缺少 SHA256 校验文件：${checksumPath}`)
  const expected = readFileSync(checksumPath, 'utf8').trim().toLowerCase()
  const actual = fileSha256(path, onProgress)
  if (!/^[a-f0-9]{64}$/.test(expected) || !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))) {
    throw new Error(`SHA256 校验失败：${path}`)
  }
}

function fileSha256(path: string, onProgress?: (completed: number, total: number) => void): string {
  const fd = openSync(path, 'r')
  try {
    const total = fstatSync(fd).size
    const buffer = Buffer.allocUnsafe(4 * 1024 * 1024)
    const hash = createHash('sha256')
    let completed = 0, lastReport = 0
    onProgress?.(0, total)
    for (;;) {
      const size = readSync(fd, buffer, 0, buffer.length, null)
      if (size === 0) break
      hash.update(buffer.subarray(0, size))
      completed += size
      if (Date.now() - lastReport >= 100) { onProgress?.(completed, total); lastReport = Date.now() }
    }
    onProgress?.(completed, total)
    return hash.digest('hex')
  } finally { closeSync(fd) }
}

export function validateArchiveEntries(entries: readonly string[]): void {
  for (const entry of entries) {
    if (entry === '') continue
    const normalized = entry.replace(/\\/g, '/')
    if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized) || normalized.split('/').includes('..')) {
      throw new Error(`压缩包包含不安全路径：${entry}`)
    }
  }
}
