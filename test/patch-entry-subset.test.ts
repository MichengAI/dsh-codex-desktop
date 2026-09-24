import assert from 'node:assert/strict'
import test from 'node:test'

import { findMissingPatchEntry, keptPatchEntries } from '../scripts/patch-entry-subset.mjs'

// 1.0.41 真实落下的补丁文件：只有一个 insert 列表，条目没有 id。
const legacyInsertEntry = { insert: [{ id: 'dsh-desktop-bridge', name: 'dsh-desktop-bridge' }] }
const puaEntry = { id: 'michengai-pua', name: 'michengai-pua', config: { alwaysOn: false } }

test('insert 形式的旧条目不会因为没有 id 被判丢失', () => {
  assert.equal(findMissingPatchEntry([legacyInsertEntry], [legacyInsertEntry, puaEntry]), undefined)
})

test('按 id 定向的旧条目保留时通过', () => {
  const previous = [{ id: 'michengai-pet', name: 'michengai-pet' }]
  assert.equal(findMissingPatchEntry(previous, [...previous, puaEntry]), undefined)
})

test('旧条目被删掉时报出该条目', () => {
  const dropped = { id: 'michengai-pet', name: 'michengai-pet' }
  assert.deepEqual(findMissingPatchEntry([dropped, legacyInsertEntry], [legacyInsertEntry, puaEntry]), dropped)
})

test('insert 列表被删掉时报出该条目', () => {
  assert.deepEqual(findMissingPatchEntry([legacyInsertEntry], [puaEntry]), legacyInsertEntry)
})

test('旧条目的配置被改写时报出该条目', () => {
  const previous = [{ id: 'michengai-pua', config: { alwaysOn: true, extra: 1 } }]
  const rewritten = [{ id: 'michengai-pua', config: { alwaysOn: false, extra: 1 } }]
  assert.deepEqual(findMissingPatchEntry(previous, rewritten), previous[0])
})

test('条目顺序变化不算丢失', () => {
  assert.equal(findMissingPatchEntry([legacyInsertEntry, puaEntry], [puaEntry, legacyInsertEntry]), undefined)
})

// 1.0.41 真实落下的补丁文件原文：只有一条 insert 声明。
const legacyPatchText = [
  '# Your patch layer for this dsh profile, applied after every bundle layer:',
  '# a top-level YAML array of loader patch entries (id-targeted config',
  '# overrides, disables, and insert lists; `!!js` expressions allowed).',
  '- insert:',
  '  - id: dsh-desktop-bridge',
  '    name: dsh-desktop-bridge',
  '',
].join('\n')

test('桥梁迁移会移除的旧声明不算作必须保留的条目', () => {
  assert.deepEqual(keptPatchEntries(legacyPatchText), [])
})

test('桥梁声明之外的用户条目仍要求保留', () => {
  const userEntry = '- id: michengai-pet\n  name: michengai-pet\n'
  assert.deepEqual(keptPatchEntries(legacyPatchText + userEntry), [{ id: 'michengai-pet', name: 'michengai-pet' }])
})

test('没有桥梁声明的补丁文件原样保留', () => {
  const patch = '- id: michengai-pet\n  name: michengai-pet\n'
  assert.deepEqual(keptPatchEntries(patch), [{ id: 'michengai-pet', name: 'michengai-pet' }])
})
