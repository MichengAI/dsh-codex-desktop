import type { ShellActionId } from './shell-actions.js'

export type ShellRendererKind = 'main' | 'shortcuts' | 'about' | 'dsh' | 'unknown'

export function mayGetShellBootstrap(kind: ShellRendererKind): boolean {
  return kind === 'main' || kind === 'shortcuts' || kind === 'about'
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
