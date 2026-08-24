const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

const IPC = {
  action: 'dsh-shell:action',
  getBootstrap: 'dsh-shell:get-bootstrap',
  popupMenu: 'dsh-shell:popup-menu',
  state: 'dsh-shell:state',
} as const

contextBridge.exposeInMainWorld('dshShell', {
  platform: process.platform,
  action: (id: string) => ipcRenderer.invoke(IPC.action, id),
  getBootstrap: () => ipcRenderer.invoke(IPC.getBootstrap),
  onState: (listener: (state: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: unknown) => listener(state)
    ipcRenderer.on(IPC.state, wrapped)
    return () => ipcRenderer.removeListener(IPC.state, wrapped)
  },
  popupMenu: (request: unknown) => ipcRenderer.invoke(IPC.popupMenu, request),
})
