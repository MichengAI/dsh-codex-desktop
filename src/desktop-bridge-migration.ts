import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { isMap, isSeq, parseDocument, type YAMLSeq } from 'yaml'

import { writeTextFileAtomicSync } from './atomic-file.js'
import { DESKTOP_BRIDGE_PACKAGE } from './desktop-host.js'

/** 先移除旧桥接声明，再清理文件；文件占用只报告警告，下次启动重试。 */
export function migrateDesktopBridgeProfile(profileDir: string, onWarning: (message: string) => void = console.warn): void {
  const changes: { file: string; content: string }[] = []
  const manifestPath = join(profileDir, 'package.json')
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    let changed = false
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      if (Object.hasOwn(manifest[field] ?? {}, DESKTOP_BRIDGE_PACKAGE)) {
        delete manifest[field][DESKTOP_BRIDGE_PACKAGE]
        changed = true
      }
    }
    const bundles: unknown = manifest.dsh?.profile?.bundles
    if (Array.isArray(bundles) && bundles.includes(DESKTOP_BRIDGE_PACKAGE)) {
      manifest.dsh.profile.bundles = bundles.filter(name => name !== DESKTOP_BRIDGE_PACKAGE)
      changed = true
    }
    if (changed) {
      changes.push({ file: 'package.json', content: `${JSON.stringify(manifest, undefined, 2)}\n` })
    }
  }
  const patchPath = join(profileDir, 'cordis.patch.yml')
  if (existsSync(patchPath)) {
    const current = readFileSync(patchPath, 'utf8')
    const next = removeDesktopBridgePatch(current)
    if (next !== current) changes.push({ file: 'cordis.patch.yml', content: next })
  }
  const backupDir = join(profileDir, '.desktop-bridge-backup')
  if (changes.length > 0) mkdirSync(backupDir, { recursive: true })
  for (const { file } of changes) {
    try {
      copyFileSync(join(profileDir, file), join(backupDir, file), constants.COPYFILE_EXCL)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  for (const { file, content } of changes) writeTextFileAtomicSync(join(profileDir, file), content)
  // 旧版已迁移配置的用户仍可能留有文件，因此清理不能依赖 changes 是否为空。
  const modulesDir = join(profileDir, 'node_modules')
  try {
    // 不进入用户链接到其他目录的整个 node_modules；包自身的链接由 rm 删除而不跟随。
    if (lstatSync(modulesDir).isSymbolicLink()) {
      onWarning('旧桌面桥接配置已清理；node_modules 为目录链接，跳过旧 bridge 文件清理。')
      return
    }
    rmSync(join(modulesDir, DESKTOP_BRIDGE_PACKAGE), { recursive: true, force: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    onWarning(`旧桌面桥接配置已清理，文件清理失败，将在下次启动重试：${error instanceof Error ? error.message : String(error)}`)
  }
}

export function removeDesktopBridgePatch(current: string): string {
  if (!current.includes(DESKTOP_BRIDGE_PACKAGE)) return current
  let document = parseDocument(current)
  if (document.errors.length > 0) {
    // 早期版本把桥接行直接拼在空数组前，先兼容这一种已知的损坏格式。
    const normalized = current.replace(/\r\n/g, '\n')
    const legacy = /^- id: dsh-desktop-bridge\n  name: dsh-desktop-bridge\n/m
    if (legacy.test(normalized)) document = parseDocument(normalized.replace(legacy, ''))
  }
  if (document.errors.length > 0 || !isSeq(document.contents)) {
    throw new Error('无法迁移桌面桥接配置：cordis.patch.yml 不是有效的 YAML patch 数组。')
  }
  const removed = removeBridgeRows(document.contents)
  if (!removed && document.toString() === current) return current
  // 无桥接行时不重排用户文件；已知损坏格式的修复除外。
  if (!removed && parseDocument(current).errors.length === 0) return current
  return document.toString()
}

function removeBridgeRows(rows: YAMLSeq): boolean {
  let changed = false
  for (let index = rows.items.length - 1; index >= 0; index -= 1) {
    const row = rows.items[index]
    if (!isMap(row)) continue
    const name = row.get('name')
    if (row.get('id') === DESKTOP_BRIDGE_PACKAGE && (name === undefined || name === DESKTOP_BRIDGE_PACKAGE)) {
      rows.delete(index)
      changed = true
      continue
    }
    const insert = row.get('insert', true)
    if (isSeq(insert) && removeBridgeRows(insert)) {
      changed = true
      if (insert.items.length === 0) {
        row.delete('insert')
        if (row.items.length === 0) rows.delete(index)
      }
    }
  }
  return changed
}
