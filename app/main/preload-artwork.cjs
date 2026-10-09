// Artwork Manager window preload: the manager's actions, carried out in the main process
// (src/artwork/service.ts). Folders are always chosen through the system's folder dialog.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('artworkManager', {
  info: () => ipcRenderer.invoke('art:info'),
  scan: () => ipcRenderer.invoke('art:scan'),
  importFolder: (replace) => ipcRenderer.invoke('art:import', Boolean(replace)),
  download: (sets, sourceId) => ipcRenderer.invoke('art:download', sets, sourceId),
  cancel: () => ipcRenderer.invoke('art:cancel'),
  exportFolder: () => ipcRenderer.invoke('art:export'),
  saveReport: () => ipcRenderer.invoke('art:report'),
  openFolder: (which) => ipcRenderer.invoke('art:reveal', which),
  onProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('art:progress', listener);
    return () => ipcRenderer.removeListener('art:progress', listener);
  },
});
