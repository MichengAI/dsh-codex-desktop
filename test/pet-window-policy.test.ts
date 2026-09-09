import test from 'node:test'
import assert from 'node:assert/strict'
import { constrainPetBounds, parsePetWindowState } from '../src/pet-window-policy.js'
const valid = { pet: { id: 'codex', name: 'Codex', description: '', version: 2, source: 'builtin', url: '/dsh-codex-pet/asset/codex' }, config: { selected: 'codex', visible: true, size: 120, position: null }, activity: { pose: 'waiting', title: '任务', text: '等待确认' } }
test('宠物IPC拒绝远程或脚本资源及非有限大小', () => {
  assert.ok(parsePetWindowState(valid))
  for (const url of ['https://evil.test/pet.webp', 'javascript:alert(1)', '/api/secret', '/dsh-codex-pet/asset/other']) assert.equal(parsePetWindowState({ ...valid, pet: { ...valid.pet, url } }), null)
  for (const size of [NaN, Infinity, -1, 999]) assert.equal(parsePetWindowState({ ...valid, config: { ...valid.config, size } }), null)
})
test('移除屏幕后宠物回到可见工作区，支持负坐标副屏', () => {
  assert.deepEqual(constrainPetBounds({ x: 9999, y: 9999 }, { x: 0, y: 0, width: 1920, height: 1040 }), { x: 1600, y: 480 })
  assert.deepEqual(constrainPetBounds({ x: -3000, y: -200 }, { x: -1920, y: 0, width: 1920, height: 1040 }), { x: -1920, y: 0 })
})
