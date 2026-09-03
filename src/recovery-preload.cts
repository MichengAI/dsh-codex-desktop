const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

const RECOVERY_IPC = {
  activate: 'dsh-recovery:activate',
  getStatus: 'dsh-recovery:get-status',
  keepIsolated: 'dsh-recovery:keep-isolated',
  getStartupLog: 'dsh-recovery:get-startup-log',
  restore: 'dsh-recovery:restore',
  restoreHealthyConfig: 'dsh-recovery:restore-healthy-config',
  returnToWorkbench: 'dsh-recovery:return-to-workbench',
  uninstall: 'dsh-recovery:uninstall',
} as const

contextBridge.exposeInMainWorld('dshRecovery', {
  activate: () => ipcRenderer.invoke(RECOVERY_IPC.activate),
  getStatus: () => ipcRenderer.invoke(RECOVERY_IPC.getStatus),
  keepIsolated: (packageName: string) => ipcRenderer.invoke(RECOVERY_IPC.keepIsolated, packageName),
  getStartupLog: () => ipcRenderer.invoke(RECOVERY_IPC.getStartupLog),
  restore: (packageName: string) => ipcRenderer.invoke(RECOVERY_IPC.restore, packageName),
  restoreHealthyConfig: () => ipcRenderer.invoke(RECOVERY_IPC.restoreHealthyConfig),
  returnToWorkbench: () => ipcRenderer.invoke(RECOVERY_IPC.returnToWorkbench),
  uninstall: (packageName: string) => ipcRenderer.invoke(RECOVERY_IPC.uninstall, packageName),
})
