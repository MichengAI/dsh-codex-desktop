import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractTarGz, verifyFileSha256 } from './runtime-archive.js'

export const RUNTIME_EXTRACTION_PROGRESS_PREFIX = 'DSH_EXTRACT_PROGRESS '

export interface RuntimeExtractionProgress {
  phase: 'runtime' | 'plugins'
  state: 'start' | 'complete' | 'skip'
}

interface RuntimeExtractionProcessOptions {
  nodeExecutable: string
  scriptPath: string
  installDir: string
  resourcesDir: string
  timeoutMs?: number
  onProgress?: (progress: RuntimeExtractionProgress) => void
}

function officialEntry(dir: string): string {
  return join(dir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

/** 首启把随包压缩包原子解压到已选定的可写目录。 */
export function extractPackagedRuntimes(
  resourcesDir: string,
  officialDest: string,
  storeDest: string,
  onProgress?: (progress: RuntimeExtractionProgress) => void,
): { official: boolean; store: boolean } {
  const officialArchive = join(resourcesDir, 'dsh-runtime.tgz')
  const storeArchive = join(resourcesDir, 'plugins-store.tgz')
  onProgress?.({ phase: 'runtime', state: 'start' })
  const official = extractOnce(officialArchive, officialDest, officialEntry)
  onProgress?.({ phase: 'runtime', state: official ? 'complete' : 'skip' })
  onProgress?.({ phase: 'plugins', state: 'start' })
  const store = extractOnce(storeArchive, storeDest, dir => join(dir, 'v11'))
  onProgress?.({ phase: 'plugins', state: store ? 'complete' : 'skip' })
  return { official, store }
}

export function packagedRuntimesNeedExtraction(resourcesDir: string, officialDest: string, storeDest: string): boolean {
  return needsExtraction(join(resourcesDir, 'dsh-runtime.tgz'), officialDest, officialEntry)
    || needsExtraction(join(resourcesDir, 'plugins-store.tgz'), storeDest, dir => join(dir, 'v11'))
}

/**
 * 便携版首启必须把重型校验、解压和数万文件复制放到独立 Node 进程，
 * 否则 Electron 主进程无法派发 Windows 消息，会被系统标记为“未响应”。
 */
export function extractPackagedRuntimesInChild(options: RuntimeExtractionProcessOptions): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(options.nodeExecutable, [
      options.scriptPath,
      options.installDir,
      options.resourcesDir,
      '--progress-json',
    ], {
      cwd: options.installDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    let pending = ''
    let settled = false

    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error === undefined) resolvePromise()
      else reject(error)
    }
    const consumeLine = (line: string): void => {
      if (!line.startsWith(RUNTIME_EXTRACTION_PROGRESS_PREFIX)) return
      try {
        const progress = JSON.parse(line.slice(RUNTIME_EXTRACTION_PROGRESS_PREFIX.length)) as RuntimeExtractionProgress
        if ((progress.phase === 'runtime' || progress.phase === 'plugins')
          && (progress.state === 'start' || progress.state === 'complete' || progress.state === 'skip')) {
          options.onProgress?.(progress)
        }
      } catch {
        // 忽略非本协议输出，错误仍会由退出码和 stderr 报告。
      }
    }
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      output = (output + chunk).slice(-8_000)
      pending += chunk
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) consumeLine(line)
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => { output = (output + chunk).slice(-8_000) })
    child.once('error', error => finish(new Error(`无法启动随包运行时初始化进程：${error.message}`)))
    child.once('exit', code => {
      if (pending !== '') consumeLine(pending)
      if (code === 0) finish()
      else finish(new Error(output.replace(/\s+/g, ' ').trim() || `随包运行时初始化失败，退出码：${code ?? 'unknown'}`))
    })
    const timeout = setTimeout(() => {
      child.kill()
      finish(new Error('随包运行时初始化超时，请重新启动应用后重试。'))
    }, options.timeoutMs ?? 15 * 60_000)
  })
}

function extractOnce(archivePath: string, destDir: string, readyPath: (dir: string) => string): boolean {
  const completeMarker = join(destDir, '.dsh-extract-complete')
  if (!existsSync(archivePath)) return false
  if (isExtractionCurrent(archivePath, destDir, readyPath)) return false
  rmSync(completeMarker, { force: true })
  verifyFileSha256(archivePath)
  const archiveVersion = readArchiveVersion(archivePath)
  if (archiveVersion === undefined) throw new Error(`无法读取压缩包 SHA256：${archivePath}`)
  mkdirSync(dirname(destDir), { recursive: true })
  const stagingDir = mkdtempSync(join(dirname(destDir), `.${basename(destDir)}-`))
  try {
    extractTarGz(archivePath, stagingDir)
    if (!existsSync(readyPath(stagingDir))) throw new Error(`压缩包内容不完整：${archivePath}`)
    if (isExtractionCurrent(archivePath, destDir, readyPath)) return false
    if (process.platform === 'win32') {
      mkdirSync(destDir, { recursive: true })
      cpSync(stagingDir, destDir, { recursive: true, force: true })
    } else {
      rmSync(destDir, { recursive: true, force: true })
      renameSync(stagingDir, destDir)
    }
    writeFileSync(completeMarker, `${archiveVersion}\n`, 'utf8')
    return true
  } finally {
    rmSync(stagingDir, { recursive: true, force: true })
  }
}

function needsExtraction(archivePath: string, destDir: string, readyPath: (dir: string) => string): boolean {
  return existsSync(archivePath) && !isExtractionCurrent(archivePath, destDir, readyPath)
}

function isExtractionCurrent(archivePath: string, destDir: string, readyPath: (dir: string) => string): boolean {
  if (!existsSync(readyPath(destDir))) return false
  const archiveVersion = readArchiveVersion(archivePath)
  if (archiveVersion === undefined) return false
  try {
    return readFileSync(join(destDir, '.dsh-extract-complete'), 'utf8').trim().toLowerCase() === archiveVersion
  } catch {
    return false
  }
}

function readArchiveVersion(archivePath: string): string | undefined {
  try {
    const value = readFileSync(`${archivePath}.sha256`, 'utf8').trim().toLowerCase()
    return /^[a-f0-9]{64}$/.test(value) ? value : undefined
  } catch {
    return undefined
  }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === self) {
  const installDir = process.argv[2] ?? dirname(dirname(self))
  const resourcesDir = process.argv[3] ?? join(installDir, 'resources')
  const progress = process.argv.includes('--progress-json')
    ? (event: RuntimeExtractionProgress): void => { console.log(RUNTIME_EXTRACTION_PROGRESS_PREFIX + JSON.stringify(event)) }
    : undefined
  extractPackagedRuntimes(resourcesDir, join(installDir, 'dsh-runtime'), join(installDir, 'plugins', 'store'), progress)
}
