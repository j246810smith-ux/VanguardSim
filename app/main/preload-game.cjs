// Game window preload: a read-only artwork status, a button to open the Artwork Manager, and
// Play Online (D-032): the main process holds the connection; the window only exchanges text
// lines with it. Nothing here can change the game.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vanguardDesktop', {
  artworkStatus: () => ipcRenderer.invoke('art:quick'),
  openArtworkManager: () => ipcRenderer.invoke('art:open'),
  /** The player's own sleeve and playmat image file names (D-033). */
  cosmetics: () => ipcRenderer.invoke('cosmetics:list'),
  online: {
    host: (port) => ipcRenderer.invoke('online:host', port),
    join: (address, port) => ipcRenderer.invoke('online:join', address, port),
    send: (line) => ipcRenderer.invoke('online:send', line),
    drop: () => ipcRenderer.invoke('online:drop'),
    stop: () => ipcRenderer.invoke('online:stop'),
    allowRoomCodes: (on) => ipcRenderer.invoke('online:room-codes', on === true),
    /** Returns a function that stops listening. */
    onEvent: (callback) => {
      const listener = (_event, e) => callback(e);
      ipcRenderer.on('online:event', listener);
      return () => ipcRenderer.removeListener('online:event', listener);
    },
  },
});
