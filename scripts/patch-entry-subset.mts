/** 升级冒烟的补丁条目比对：升级只允许追加，旧条目必须原样保留。 */
import { parse } from 'yaml'

import { removeDesktopBridgePatch } from '../src/desktop-bridge-migration.js'

function isSubset(needle: unknown, candidate: unknown): boolean {
  if (Array.isArray(needle)) {
    return Array.isArray(candidate) && needle.every(item => candidate.some(other => isSubset(item, other)))
  }
  if (needle !== null && typeof needle === 'object') {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return false
    const record = candidate as Record<string, unknown>
    return Object.entries(needle as Record<string, unknown>)
      .every(([key, value]) => Object.hasOwn(record, key) && isSubset(value, record[key]))
  }
  return needle === candidate
}

/**
 * 返回新补丁里找不到的旧条目，全部保留时返回 undefined。
 * 补丁条目既有 `- id:` 定向覆盖，也有 1.0.41 那种只有 `insert:` 的形式，不能按 id 比对。
 */
export function findMissingPatchEntry(previous: unknown[], next: unknown[]): unknown {
  return previous.find(entry => !next.some(candidate => isSubset(entry, candidate)))
}

/**
 * 升级必须保留的旧补丁条目。
 * 桥梁迁移会按设计移除旧的 dsh-desktop-bridge 声明（1.0.41 落下的就是这种 insert 条目），
 * 所以先用产品自己的迁移函数算一遍，再要求剩下条目一个不少。
 */
export function keptPatchEntries(patchText: string): unknown[] {
  return (parse(removeDesktopBridgePatch(patchText)) ?? []) as unknown[]
}
