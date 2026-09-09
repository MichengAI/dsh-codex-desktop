import test from 'node:test'
import assert from 'node:assert/strict'
import { constrainPetBounds, parsePetWindowState, validPetCommand } from '../src/pet-window-policy.js'
const valid = { pet: { id: 'codex', name: 'Codex', description: '', version: 2, source: 'builtin', url: '/dsh-codex-pet/asset/codex' }, config: { selected: 'codex', visible: true, size: 120, position: null }, activity: { pose: 'waiting', title: '任务', text: '等待确认' } }
test('语言缺省兼容旧状态，拒绝非法语言字段', () => {
  assert.equal(parsePetWindowState(valid)?.language, 'zh')
  assert.equal(parsePetWindowState({ ...valid, language: 'en-US' })?.language, 'en-US')
  for (const language of [null, 42, '<script>', '']) assert.equal(parsePetWindowState({ ...valid, language }), null)
})
test('宠物IPC拒绝远程或脚本资源及非有限大小', () => {
  assert.ok(parsePetWindowState(valid))
  for (const url of ['https://evil.test/pet.webp', 'javascript:alert(1)', '/api/secret', '/dsh-codex-pet/asset/other']) assert.equal(parsePetWindowState({ ...valid, pet: { ...valid.pet, url } }), null)
  for (const size of [NaN, Infinity, -1, 999]) assert.equal(parsePetWindowState({ ...valid, config: { ...valid.config, size } }), null)
})
test('图集传输只接受有限的 PNG/WebP 数据，拒绝 SVG 与任意 URL', () => {
  assert.ok(parsePetWindowState({ ...valid, sprite: 'data:image/webp;base64,AA==' }))
  for (const sprite of ['https://evil.test/a.png', 'data:image/svg+xml;base64,AA==', 'data:image/png;base64,<>', 'data:image/png;base64,' + 'A'.repeat(23 * 1024 * 1024)]) assert.equal(parsePetWindowState({ ...valid, sprite }), null)
})
test('移除屏幕后宠物回到可见工作区，支持负坐标副屏', () => {
  assert.deepEqual(constrainPetBounds({ x: 9999, y: 9999 }, { x: 0, y: 0, width: 1920, height: 1040 }), { x: 1600, y: 480 })
  assert.deepEqual(constrainPetBounds({ x: -3000, y: -200 }, { x: -1920, y: 0, width: 1920, height: 1040 }), { x: -1920, y: 0 })
})
test('多会话 IPC 校验结构与请求身份，拒绝过期及越界操作', () => {
  const notifications = { items: [{ id: 'a', token: '1:q', pose: 'waiting', title: '甲', text: '等待', updatedAt: 1, request: { key: 'q', kind: 'approval' } }], hidden: 0, activity: valid.activity }
  const state = parsePetWindowState({ ...valid, notifications })
  assert.ok(state)
  assert.equal(validPetCommand({ type: 'approve', id: 'a', token: '1:q', requestKey: 'q' }, state), true)
  assert.equal(validPetCommand({ type: 'approve', id: 'a', token: '0', requestKey: 'q' }, state), false)
  assert.equal(validPetCommand({ type: 'message', id: 'unknown', text: 'test' }, state), false)
  assert.equal(validPetCommand({ type: 'message', text: 'x'.repeat(10001) }, state), false)
  assert.equal(parsePetWindowState({ ...valid, notifications: { ...notifications, items: [{ ...notifications.items[0], request: { key: 'q', kind: 'question', questions: 'bad' } }] } }), null)
})
