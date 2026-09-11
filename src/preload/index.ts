import { contextBridge, ipcRenderer } from 'electron'
import type { ScanProgress } from '../shared/types'

function subscribe<T>(channel: string, cb: (data: T) => void): () => void {
  const listener = (_e: unknown, data: T): void => cb(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  getInfo: () => ipcRenderer.invoke('app:info'),
  pickFolders: () => ipcRenderer.invoke('dialog:pick-folders'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: unknown) => ipcRenderer.invoke('settings:update', patch),
  getRules: () => ipcRenderer.invoke('rules:get'),
  saveRules: (rules: unknown) => ipcRenderer.invoke('rules:save', rules),
  resetRules: () => ipcRenderer.invoke('rules:reset'),
  startScan: () => ipcRenderer.invoke('scan:start'),
  getLatestScan: () => ipcRenderer.invoke('scan:latest'),
  runScanNow: () => ipcRenderer.invoke('scan:run-now'),
  dryRun: (folders: string[]) => ipcRenderer.invoke('scan:dry-run', folders),
  applyBatch: (req: unknown) => ipcRenderer.invoke('apply:batch', req),
  getHistory: () => ipcRenderer.invoke('history:list'),
  undoBatch: (batchId: string) => ipcRenderer.invoke('history:undo', batchId),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  runScheduledNow: () => ipcRenderer.invoke('scheduler:run-now'),
  prepareSampleData: () => ipcRenderer.invoke('sample:prepare'),
  openDataFolder: () => ipcRenderer.invoke('data:open-folder'),
  onScanProgress: (cb: (p: ScanProgress) => void) => subscribe<ScanProgress>('scan:progress', cb),
  onSchedulerFired: (cb: (d: { count: number; scannedAt: number }) => void) =>
    subscribe('scheduler:fired', cb)
}

contextBridge.exposeInMainWorld('api', api)
