const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

const IPC = {
  action: 'dsh-shell:action',
  getBootstrap: 'dsh-shell:get-bootstrap',
  popupMenu: 'dsh-shell:popup-menu',
  state: 'dsh-shell:state',
  bootstrap: 'dsh-shell:bootstrap',
  getNotificationPreferences: 'dsh-shell:get-notification-preferences',
  updateNotificationPreferences: 'dsh-shell:update-notification-preferences',
} as const

contextBridge.exposeInMainWorld('dshShell', {
  platform: process.platform,
  action: (id: string) => ipcRenderer.invoke(IPC.action, id),
  getBootstrap: () => ipcRenderer.invoke(IPC.getBootstrap),
  getNotificationPreferences: () => ipcRenderer.invoke(IPC.getNotificationPreferences),
  updateNotificationPreferences: (value: unknown) => ipcRenderer.invoke(IPC.updateNotificationPreferences, value),
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
  popupMenu: (request: unknown) => ipcRenderer.invoke(IPC.popupMenu, request),
})
