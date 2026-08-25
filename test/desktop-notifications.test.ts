import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  buildWindowsReplyToastXml,
  loadNotificationPreferences,
  parseDesktopNotificationBridgeEvent,
  parseWindowsNotificationReplyActivation,
  sanitizeNotificationPreferences,
  saveNotificationPreferences,
  shouldShowDesktopNotification,
  windowsNotificationReplyArguments,
} from '../src/desktop-notifications.js'

const completion = { type: 'notify', kind: 'turn-complete', sessionId: 'session-1' } as const
const approval = { type: 'notify', kind: 'approval', sessionId: 'session-1' } as const
const question = { type: 'notify', kind: 'question', sessionId: 'session-1' } as const

test('Windows 回复 toast 的按钮、占位符和内容可完整国际化并安全转义', () => {
  const xml = buildWindowsReplyToastXml({
    id: 'dsh-123', title: '需要审批 & 检查', body: '请检查 <配置>', persistent: true,
    placeholder: '回复 “DSH”', replyLabel: '回复', closeLabel: '关闭',
  })
  assert.match(xml, /^<toast scenario="reminder">/)
  assert.match(xml, /需要审批 &amp; 检查/)
  assert.match(xml, /请检查 &lt;配置&gt;/)
  assert.match(xml, /placeHolderContent="回复 “DSH”"/)
  assert.match(xml, /content="回复" hint-inputId="reply"/)
  assert.match(xml, /activationType="system" arguments="dismiss" content="关闭"/)
  assert.match(xml, /arguments="type=reply&amp;tag=dsh-123"/)
})

test('Windows 集中激活回调可把回复还原到原任务', () => {
  const replyArguments = windowsNotificationReplyArguments('session-带 空格')
  const xml = buildWindowsReplyToastXml({
    id: 'dsh-123', title: '需要输入', body: '请回复', persistent: true,
    placeholder: '回复', replyLabel: '回复', closeLabel: '关闭', replyArguments,
  })
  assert.match(xml, /arguments="type=reply&amp;sessionId=session-%E5%B8%A6%20%E7%A9%BA%E6%A0%BC"/)
  assert.deepEqual(parseWindowsNotificationReplyActivation({
    type: 'reply', arguments: replyArguments, reply: '  好的  ', userInputs: { reply: '旧值' },
  }), { sessionId: 'session-带 空格', text: '好的' })
  assert.deepEqual(parseWindowsNotificationReplyActivation({
    type: 'reply', arguments: replyArguments, userInputs: { reply: '继续' },
  }), { sessionId: 'session-带 空格', text: '继续' })
  assert.equal(parseWindowsNotificationReplyActivation({ type: 'click', arguments: replyArguments, reply: '好的' }), undefined)
  assert.equal(parseWindowsNotificationReplyActivation({ type: 'reply', arguments: 'type=reply', reply: '好的' }), undefined)
})

test('通知偏好使用 Codex 对齐的安全默认值并逐项校验', () => {
  assert.deepEqual(sanitizeNotificationPreferences(null), DEFAULT_NOTIFICATION_PREFERENCES)
  assert.deepEqual(sanitizeNotificationPreferences({ turnMode: 'always', approvalsEnabled: false, questionsEnabled: false }), {
    turnMode: 'always', approvalsEnabled: false, questionsEnabled: false,
  })
  assert.deepEqual(sanitizeNotificationPreferences({ turnMode: 'later', approvalsEnabled: 'yes' }), DEFAULT_NOTIFICATION_PREFERENCES)
})

test('完成通知遵守聚焦模式，审批和问题使用独立开关', () => {
  assert.equal(shouldShowDesktopNotification(completion, DEFAULT_NOTIFICATION_PREFERENCES, true), false)
  assert.equal(shouldShowDesktopNotification(completion, DEFAULT_NOTIFICATION_PREFERENCES, false), true)
  assert.equal(shouldShowDesktopNotification(completion, { ...DEFAULT_NOTIFICATION_PREFERENCES, turnMode: 'always' }, true), true)
  assert.equal(shouldShowDesktopNotification(approval, { ...DEFAULT_NOTIFICATION_PREFERENCES, approvalsEnabled: false }, false), false)
  assert.equal(shouldShowDesktopNotification(question, { ...DEFAULT_NOTIFICATION_PREFERENCES, questionsEnabled: false }, false), false)
})

test('bridge 通知事件拒绝未知类型并裁剪标题', () => {
  assert.equal(parseDesktopNotificationBridgeEvent({ type: 'notify', kind: 'unknown', sessionId: 'a' }), undefined)
  assert.equal(parseDesktopNotificationBridgeEvent({ type: 'dismiss', sessionId: '' }), undefined)
  assert.deepEqual(parseDesktopNotificationBridgeEvent({ type: 'notify', kind: 'approval', sessionId: ' a ', title: '  审批  ' }), {
    type: 'notify', kind: 'approval', sessionId: 'a', title: '审批',
  })
  assert.deepEqual(parseDesktopNotificationBridgeEvent({ type: 'badge', count: 12 }), { type: 'badge', count: 12 })
  assert.equal(parseDesktopNotificationBridgeEvent({ type: 'badge', count: -1 }), undefined)
  assert.deepEqual(parseDesktopNotificationBridgeEvent({ type: 'reply-error', sessionId: ' session-2 ' }), {
    type: 'reply-error', sessionId: 'session-2',
  })
  assert.deepEqual(parseDesktopNotificationBridgeEvent({
    type: 'notify', kind: 'turn-complete', sessionId: 'a', body: '  最新回复  ',
  }), { type: 'notify', kind: 'turn-complete', sessionId: 'a', body: '最新回复' })
})

test('通知偏好原子持久化且损坏文件回退默认值', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-notifications-'))
  const path = join(dir, 'desktop-settings.json')
  try {
    const saved = await saveNotificationPreferences(path, { turnMode: 'off', approvalsEnabled: false, questionsEnabled: true })
    assert.equal(JSON.parse(await readFile(path, 'utf8')).turnMode, 'off')
    assert.deepEqual(await loadNotificationPreferences(path), saved)
    await import('node:fs/promises').then(({ writeFile }) => writeFile(path, '{broken', 'utf8'))
    assert.deepEqual(await loadNotificationPreferences(path), DEFAULT_NOTIFICATION_PREFERENCES)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
