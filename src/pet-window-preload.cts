/** 透明窗口的有限桥接，禁止任意 IPC 与文件系统访问。 */
const { contextBridge: petContextBridge, ipcRenderer: petIpcRenderer } = require('electron') as typeof import('electron')
petContextBridge.exposeInMainWorld('petWindow', {
  onState(listener: (value: unknown) => void) { const wrapped = (_event: Electron.IpcRendererEvent, value: unknown) => listener(value); petIpcRenderer.on('dsh-pet:state', wrapped); return () => petIpcRenderer.removeListener('dsh-pet:state', wrapped) },
  ready() { petIpcRenderer.send('dsh-pet:ready') },
  pointer(interactive: boolean) { petIpcRenderer.send('dsh-pet:pointer', interactive) },
  move(dx: number, dy: number) { petIpcRenderer.send('dsh-pet:move', dx, dy) },
  action(action: string) { petIpcRenderer.send('dsh-pet:action', action) },
})
