import type { LocalizedShellAction, LocalizedShellMenu, ShellActionId, ShellMenuId } from './shell-actions.js'

export const SHELL_BAR_HEIGHT = 40

export const SHELL_IPC = {
  action: 'dsh-shell:action',
  getBootstrap: 'dsh-shell:get-bootstrap',
  popupMenu: 'dsh-shell:popup-menu',
  state: 'dsh-shell:state',
  bootstrap: 'dsh-shell:bootstrap',
  dshAction: 'dsh-shell:dsh-action',
  dshLocale: 'dsh-shell:dsh-locale',
  dshOpenSession: 'dsh-shell:dsh-open-session',
  dshNotificationReply: 'dsh-shell:dsh-notification-reply',
  dshState: 'dsh-shell:dsh-state',
  dshNotification: 'dsh-shell:dsh-notification',
  getNotificationPreferences: 'dsh-shell:get-notification-preferences',
  updateNotificationPreferences: 'dsh-shell:update-notification-preferences',
} as const

export interface DshNavigationState {
  readonly canBack: boolean
  readonly canForward: boolean
  readonly canNextChat: boolean
  readonly canPreviousChat: boolean
}

export interface ShellState extends DshNavigationState {
  readonly fullscreen: boolean
  readonly reloading: boolean
  readonly zoomPercent: number
}

export interface ShellBootstrap {
  readonly actions: readonly LocalizedShellAction[]
  readonly locale: string
  readonly menus: readonly LocalizedShellMenu[]
  readonly platform: NodeJS.Platform
  readonly runtimeVersion: string
  readonly state: ShellState
  readonly version: string
}

export interface ShellMenuPopupRequest {
  readonly menu: ShellMenuId
  /** X coordinate in the shell renderer's content viewport. */
  readonly x: number
  /** Y coordinate in the shell renderer's content viewport. */
  readonly y: number
}

export type DshShellActionId = Extract<ShellActionId,
  'new-chat' | 'open-folder' | 'settings' | 'toggle-sidebar' | 'find' |
  'previous-chat' | 'next-chat' | 'back' | 'forward'>
