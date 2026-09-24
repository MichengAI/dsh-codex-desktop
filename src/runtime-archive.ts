import { spawn, spawnSync } from 'node:child_process'
import { createHash, timingSafeEqual } from 'node:crypto'
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { copyFile, cp, readdir, rename, rm, stat } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'

/** 把指向目录外的硬链接落成普通文件，避免 tar 只记下外部链接，解压后内容丢失。 */
export async function materializeHardlinks(root: string): Promise<number> {
  let count = 0
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
        continue
      }
      if (!entry.isFile()) continue
      if ((await stat(path)).nlink <= 1) continue
      const temporary = `${path}.materialize`
      await copyFile(path, temporary)
      await rm(path)
      await rename(temporary, path)
      count += 1
    }
  }
  await walk(root)
  return count
}

/** 把 WAL 里尚未检查点的包索引写入主库。打包若漏掉 WAL，解压后就会少包。 */
export function checkpointPnpmStore(storeDir: string): void {
  const dbPath = join(storeDir, 'v11', 'index.db')
  if (!existsSync(dbPath)) return
  const db = new DatabaseSync(dbPath)
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } finally {
    db.close()
  }
  rmSync(`${dbPath}-wal`, { force: true })
  rmSync(`${dbPath}-shm`, { force: true })
}

/** 复制成普通文件树。硬链接、联接和符号链接都展开，避免 tar 只记下外部路径。 */
export async function cloneTreeForArchive(source: string, destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true })
  await cp(source, destination, { recursive: true, dereference: true })
  checkpointPnpmStore(destination)
}

export function listPnpmStorePackageIds(storeDir: string): string[] {
  const dbPath = join(storeDir, 'v11', 'index.db')
  if (!existsSync(dbPath)) return []
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    return db.prepare('SELECT key FROM package_index').all().map(row => String((row as { key: unknown }).key))
  } catch {
    return []
  } finally {
    db.close()
  }
}

/** 压缩并按安装时的复制解压后，索引里的包必须还在。 */
export function assertPnpmStorePackagesPreserved(sourceStore: string, packagedStore: string): void {
  const missing = listPnpmStorePackageIds(sourceStore).filter(id => !listPnpmStorePackageIds(packagedStore).includes(id))
  if (missing.length === 0) return
  const names = missing.slice(0, 5).map(id => id.split('\t')[1] ?? id)
  throw new Error(`压缩包丢失了仓库索引：${names.join('、')}${missing.length > 5 ? ` 等 ${missing.length} 项` : ''}`)
}

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
