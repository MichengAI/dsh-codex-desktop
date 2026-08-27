const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

const IPC = {
  action: 'dsh-shell:action',
  getBootstrap: 'dsh-shell:get-bootstrap',
  popupMenu: 'dsh-shell:popup-menu',
  state: 'dsh-shell:state',
  bootstrap: 'dsh-shell:bootstrap',
  getNotificationPreferences: 'dsh-shell:get-notification-preferences',
  updateNotificationPreferences: 'dsh-shell:update-notification-preferences',
  getUpdatePreferences: 'dsh-shell:get-update-preferences',
  updateUpdatePreferences: 'dsh-shell:update-update-preferences',
  getDesktopUpdateState: 'dsh-shell:get-desktop-update-state',
  desktopUpdateAction: 'dsh-shell:desktop-update-action',
  desktopUpdateState: 'dsh-shell:desktop-update-state',
  settingsSection: 'dsh-shell:settings-section',
  closeDesktopSettings: 'dsh-shell:close-desktop-settings',
} as const

contextBridge.exposeInMainWorld('dshShell', {
  platform: process.platform,
  action: (id: string) => ipcRenderer.invoke(IPC.action, id),
  getBootstrap: () => ipcRenderer.invoke(IPC.getBootstrap),
  getNotificationPreferences: () => ipcRenderer.invoke(IPC.getNotificationPreferences),
  updateNotificationPreferences: (value: unknown) => ipcRenderer.invoke(IPC.updateNotificationPreferences, value),
  getUpdatePreferences: () => ipcRenderer.invoke(IPC.getUpdatePreferences),
  updateUpdatePreferences: (value: unknown) => ipcRenderer.invoke(IPC.updateUpdatePreferences, value),
  getDesktopUpdateState: () => ipcRenderer.invoke(IPC.getDesktopUpdateState),
  desktopUpdateAction: (action: unknown) => ipcRenderer.invoke(IPC.desktopUpdateAction, action),
  closeDesktopSettings: () => ipcRenderer.invoke(IPC.closeDesktopSettings),
  onState: (listener: (state: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: unknown) => listener(state)
    ipcRenderer.on(IPC.state, wrapped)
    return () => ipcRenderer.removeListener(IPC.state, wrapped)
  },
  onBootstrap: (listener: (bootstrap: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, bootstrap: unknown) => listener(bootstrap)
    ipcRenderer.on(IPC.bootstrap, wrapped)
    return () => ipcRenderer.removeListener(IPC.bootstrap, wrapped)
  },
  onDesktopUpdateState: (listener: (state: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: unknown) => listener(state)
    ipcRenderer.on(IPC.desktopUpdateState, wrapped)
    return () => ipcRenderer.removeListener(IPC.desktopUpdateState, wrapped)
  },
  onSettingsSection: (listener: (section: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, section: unknown) => listener(section)
    ipcRenderer.on(IPC.settingsSection, wrapped)
    return () => ipcRenderer.removeListener(IPC.settingsSection, wrapped)
  },
  popupMenu: (request: unknown) => ipcRenderer.invoke(IPC.popupMenu, request),
})
