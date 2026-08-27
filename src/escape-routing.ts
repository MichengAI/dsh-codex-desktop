export type EscapeRoute = 'pass-through' | 'close-auxiliary' | 'dismiss-dsh-settings'

export function escapeRoute(input: {
  readonly key: string
  readonly isAuxiliaryWindow: boolean
  readonly isDesktopSettingsWindow: boolean
  readonly isMainShell: boolean
  readonly isDshSettingsDialogVisible: boolean
}): EscapeRoute {
  if (input.key !== 'Escape') return 'pass-through'
  if (input.isDesktopSettingsWindow) return 'pass-through'
  if (input.isAuxiliaryWindow) return 'close-auxiliary'
  if (input.isMainShell && input.isDshSettingsDialogVisible) return 'dismiss-dsh-settings'
  return 'pass-through'
}
