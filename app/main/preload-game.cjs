// Game window preload: a read-only artwork status, a button to open the Artwork Manager, and
// Play Online (D-032): the main process holds the connection; the window only exchanges text
// lines with it. Nothing here can change the game.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vanguardDesktop', {
  artworkStatus: () => ipcRenderer.invoke('art:quick'),
  openArtworkManager: () => ipcRenderer.invoke('art:open'),
  /** The player's own sleeve and playmat image file names (D-033). */
  cosmetics: () => ipcRenderer.invoke('cosmetics:list'),
  /** The player's own music file names (music\ next to cards\), for the battle playlist. */
  music: () => ipcRenderer.invoke('music:list'),
  /** Report a problem or suggest something: GitHub's new-issue page, in the browser. */
  openFeedback: () => ipcRenderer.invoke('feedback:open'),
  /** Vanguard Update Manager (D-037): look up the newest release; open its page. */
  updates: {
    info: () => ipcRenderer.invoke('updates:info'),
    check: (channel) => ipcRenderer.invoke('updates:check', channel),
    openPage: (url) => ipcRenderer.invoke('updates:open-page', url),
    download: (version) => ipcRenderer.invoke('updates:download', version),
    cancelDownload: () => ipcRenderer.invoke('updates:cancel'),
    install: (version) => ipcRenderer.invoke('updates:install', version),
    rollback: () => ipcRenderer.invoke('updates:rollback'),
    rollbackInfo: () => ipcRenderer.invoke('updates:rollback-info'),
    lastResult: () => ipcRenderer.invoke('updates:last-result'),
    /** Returns a function that stops listening. */
    onProgress: (callback) => {
      const listener = (_event, p) => callback(p);
      ipcRenderer.on('updates:progress', listener);
      return () => ipcRenderer.removeListener('updates:progress', listener);
    },
  },
  /** The chosen app icon (appIcons.ts): window, taskbar, and a desktop shortcut made in Settings. */
  appIcon: {
    set: (id) => ipcRenderer.invoke('icon:set', id),
    makeShortcut: (id) => ipcRenderer.invoke('icon:shortcut', id),
  },
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
