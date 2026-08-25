import { readFile } from 'node:fs/promises'

import { writeTextFileAtomic } from './atomic-file.js'

export type CompletionNotificationMode = 'off' | 'unfocused' | 'always'
export type DesktopNotificationKind = 'turn-complete' | 'approval' | 'question'

export interface DesktopNotificationPreferences {
  readonly turnMode: CompletionNotificationMode
  readonly approvalsEnabled: boolean
  readonly questionsEnabled: boolean
}

export interface DesktopNotificationEvent {
  readonly type: 'notify'
  readonly kind: DesktopNotificationKind
  readonly sessionId: string
  readonly title?: string
  /** Latest text produced by this turn, when the client still has its conversation window. */
  readonly body?: string
}

export interface DesktopNotificationDismissEvent {
  readonly type: 'dismiss'
  readonly sessionId: string
}

export interface DesktopNotificationBadgeEvent {
  readonly type: 'badge'
  readonly count: number
}

export interface DesktopNotificationReplyErrorEvent {
  readonly type: 'reply-error'
  readonly sessionId: string
}

export interface WindowsNotificationReplyActivation {
  readonly sessionId: string
  readonly text: string
}

export type DesktopNotificationBridgeEvent = DesktopNotificationEvent | DesktopNotificationDismissEvent | DesktopNotificationBadgeEvent | DesktopNotificationReplyErrorEvent

export const DEFAULT_NOTIFICATION_PREFERENCES: DesktopNotificationPreferences = {
  turnMode: 'unfocused',
  approvalsEnabled: true,
  questionsEnabled: true,
}

function escapeToastXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '\uFFFD')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function windowsNotificationReplyArguments(sessionId: string): string {
  return `type=reply&sessionId=${encodeURIComponent(sessionId)}`
}

export function parseWindowsNotificationReplyActivation(value: unknown): WindowsNotificationReplyActivation | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as { arguments?: unknown; reply?: unknown; type?: unknown; userInputs?: unknown }
  if (candidate.type !== 'reply' || typeof candidate.arguments !== 'string') return undefined
  const parameters = new URLSearchParams(candidate.arguments)
  if (parameters.get('type') !== 'reply') return undefined
  const sessionId = parameters.get('sessionId')?.trim()
  if (sessionId === undefined || sessionId === '' || sessionId.length > 256) return undefined
  const inputs = typeof candidate.userInputs === 'object' && candidate.userInputs !== null
    ? candidate.userInputs as Record<string, unknown>
    : undefined
  const rawText = typeof candidate.reply === 'string'
    ? candidate.reply
    : typeof inputs?.reply === 'string' ? inputs.reply : undefined
  const text = rawText?.trim().slice(0, 4_000)
  if (text === undefined || text === '') return undefined
  return { sessionId, text }
}

export function buildWindowsReplyToastXml(options: {
  readonly body: string
  readonly closeLabel: string
  readonly id: string
  readonly persistent: boolean
  readonly placeholder: string
  readonly replyLabel: string
  readonly replyArguments?: string
  readonly title: string
}): string {
  const title = escapeToastXml(options.title)
  const body = escapeToastXml(options.body)
  const replyArguments = escapeToastXml(options.replyArguments ?? `type=reply&tag=${options.id}`)
  const closeAction = options.persistent
    ? `<action activationType="system" arguments="dismiss" content="${escapeToastXml(options.closeLabel)}"/>`
    : ''
  return `<toast${options.persistent ? ' scenario="reminder"' : ''}>` +
    `<visual><binding template="ToastGeneric"><text>${title}</text><text>${body}</text></binding></visual>` +
    `<actions>${closeAction}<input id="reply" type="text" placeHolderContent="${escapeToastXml(options.placeholder)}"/>` +
    `<action activationType="foreground" arguments="${replyArguments}" content="${escapeToastXml(options.replyLabel)}" hint-inputId="reply"/>` +
    '</actions></toast>'
}

export function sanitizeNotificationPreferences(value: unknown): DesktopNotificationPreferences {
  if (typeof value !== 'object' || value === null) return DEFAULT_NOTIFICATION_PREFERENCES
  const candidate = value as Partial<DesktopNotificationPreferences>
  return {
    turnMode: candidate.turnMode === 'off' || candidate.turnMode === 'always' || candidate.turnMode === 'unfocused'
      ? candidate.turnMode
      : DEFAULT_NOTIFICATION_PREFERENCES.turnMode,
    approvalsEnabled: typeof candidate.approvalsEnabled === 'boolean'
      ? candidate.approvalsEnabled
      : DEFAULT_NOTIFICATION_PREFERENCES.approvalsEnabled,
    questionsEnabled: typeof candidate.questionsEnabled === 'boolean'
      ? candidate.questionsEnabled
      : DEFAULT_NOTIFICATION_PREFERENCES.questionsEnabled,
  }
}

export function parseDesktopNotificationBridgeEvent(value: unknown): DesktopNotificationBridgeEvent | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as Partial<DesktopNotificationBridgeEvent> & { body?: unknown; count?: unknown; title?: unknown; kind?: unknown }
  if (candidate.type === 'badge') {
    if (!Number.isInteger(candidate.count) || (candidate.count as number) < 0 || (candidate.count as number) > 999) return undefined
    return { type: 'badge', count: candidate.count as number }
  }
  if (candidate.type !== 'notify' && candidate.type !== 'dismiss' && candidate.type !== 'reply-error') return undefined
  if (typeof candidate.sessionId !== 'string' || candidate.sessionId.trim() === '' || candidate.sessionId.length > 256) return undefined
  const sessionId = candidate.sessionId.trim()
  if (candidate.type === 'dismiss') return { type: 'dismiss', sessionId }
  if (candidate.type === 'reply-error') return { type: 'reply-error', sessionId }
  if (candidate.kind !== 'turn-complete' && candidate.kind !== 'approval' && candidate.kind !== 'question') return undefined
  const title = typeof candidate.title === 'string' ? candidate.title.trim().slice(0, 240) : ''
  const body = typeof candidate.body === 'string' ? candidate.body.trim().slice(0, 500) : ''
  return {
    type: 'notify',
    kind: candidate.kind,
    sessionId,
    ...(title === '' ? {} : { title }),
    ...(body === '' ? {} : { body }),
  }
}

export function shouldShowDesktopNotification(
  event: DesktopNotificationEvent,
  preferences: DesktopNotificationPreferences,
  windowFocused: boolean,
): boolean {
  if (event.kind === 'approval') return preferences.approvalsEnabled
  if (event.kind === 'question') return preferences.questionsEnabled
  if (preferences.turnMode === 'off') return false
  return preferences.turnMode === 'always' || !windowFocused
}

export async function loadNotificationPreferences(path: string): Promise<DesktopNotificationPreferences> {
  try {
    return sanitizeNotificationPreferences(JSON.parse(await readFile(path, 'utf8')))
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES
  }
}

export async function saveNotificationPreferences(path: string, value: unknown): Promise<DesktopNotificationPreferences> {
  const preferences = sanitizeNotificationPreferences(value)
  await writeTextFileAtomic(path, JSON.stringify(preferences, null, 2) + '\n')
  return preferences
}
