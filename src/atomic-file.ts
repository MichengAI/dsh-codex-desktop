import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { rename, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, dirname, join } from 'node:path'

function temporaryPath(path: string): string {
  return join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`)
}

function isTransientRenameError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) return false
  return ['EACCES', 'EBUSY', 'EPERM'].includes(String(error.code))
}

async function renameWithRetry(source: string, destination: string): Promise<void> {
  const delays = [25, 50, 100, 200, 400]
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(source, destination)
      return
    } catch (error) {
      const delay = delays[attempt]
      if (delay === undefined || !isTransientRenameError(error)) throw error
      await new Promise<void>((resolve) => setTimeout(resolve, delay))
    }
  }
}

export async function writeTextFileAtomic(path: string, content: string): Promise<void> {
  const temporary = temporaryPath(path)
  try {
    await writeFile(temporary, content, 'utf8')
    await renameWithRetry(temporary, path)
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined)
  }
}

export function writeTextFileAtomicSync(path: string, content: string): void {
  const temporary = temporaryPath(path)
  try {
    writeFileSync(temporary, content, 'utf8')
    renameSync(temporary, path)
  } finally {
    rmSync(temporary, { force: true })
  }
}
