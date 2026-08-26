import type { ShellActionId } from './shell-actions.js'

export type ShellRendererKind = 'main' | 'shortcuts' | 'about' | 'settings' | 'dsh' | 'unknown'

export function mayGetShellBootstrap(kind: ShellRendererKind): boolean {
  return kind === 'main' || kind === 'shortcuts' || kind === 'about' || kind === 'settings'
}

export function mayInvokeShellAction(kind: ShellRendererKind, id: ShellActionId): boolean {
  if (kind === 'main') return true
  return kind === 'about' && (id === 'whats-new' || id === 'feedback')
}

export function mayPopupShellMenu(kind: ShellRendererKind): boolean {
  return kind === 'main'
}

export function mayReportDshState(kind: ShellRendererKind): boolean {
  return kind === 'dsh'
}

export function mayReportDshNotification(kind: ShellRendererKind): boolean {
  return kind === 'dsh'
}

export function mayReportDshLocale(kind: ShellRendererKind): boolean {
  return kind === 'dsh'
}

export function mayAccessNotificationPreferences(kind: ShellRendererKind): boolean {
  return kind === 'settings'
}

export function mayAccessDesktopUpdates(kind: ShellRendererKind): boolean {
  return kind === 'settings'
}
