// Game window preload: a read-only artwork status and a button to open the Artwork Manager.
// Nothing here can change the game; the game itself stays offline (D-004).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vanguardDesktop', {
  artworkStatus: () => ipcRenderer.invoke('art:quick'),
  openArtworkManager: () => ipcRenderer.invoke('art:open'),
});
