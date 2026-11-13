// Electron main process: one window showing the built renderer. The game window is offline
// (D-004): every http(s)/ws request it makes is blocked except the Vite dev server during
// development. Online play (D-032) is a TCP connection opened here, in the main process, only when
// the player hosts or joins from Play Online (app/main/online.cjs), or, by room code, a WebRTC
// connection from the game window: then (and only then) requests to the PeerJS service are let
// through (ROOM_CODE_SERVICE).
//
// Card art is optional and never shipped (D-018, D-025). The renderer loads it from the
// `vgart:` scheme, served read-only from one folder:
//   - packaged app: `cards\` next to the executable (or next to the portable .exe),
//   - `npm run app` from the repository: `assets/cards/`.
// Missing images are fine: the UI shows a text card instead.
//
// The Artwork Manager (docs/ARTWORK.md) is a separate window of the same program
// (`Vanguard Sim.exe --artwork`, or Settings → Open Artwork Manager). It organises that folder and,
// only if the user has set up a download source in `artwork-sources.json` (in the app's data
// folder), downloads images from the main process when asked. The game window stays offline.
const { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell } = require('electron');
const { isArtPath, isCosmeticPath, isMusicName, isMusicPath } = require('./artPath.cjs');
const { createCosmetics } = require('./cosmetics.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createOnline } = require('./online.cjs');
const { createAppIcon } = require('./appIcon.cjs');
const updates = require('./updates.cjs');
const { createUpdateDownloader } = require('./updateDownload.cjs');
const { createUpdateInstaller } = require('./updateInstall.cjs');

const devUrl = process.env.VANGUARD_DEV_URL;
/** Set by the release smoke test (docs/RELEASING.md): load, report, quit. */
const smokeTest = process.env.VANGUARD_SMOKE_TEST === '1';
// the jitter probe (runJitterProbe) runs with default settings in a throwaway profile
if (process.env.VANGUARD_JITTER)
  app.setPath('userData', path.join(app.getPath('temp'), 'vanguard-sim-jitter-probe'));
// the online probe (runOnlineProbe) runs a host and a guest side by side, each in its own profile
const onlineProbe = process.env.VANGUARD_ONLINE_PROBE; // 'host' | 'join'
if (onlineProbe)
  app.setPath('userData', path.join(app.getPath('temp'), `vanguard-sim-online-${onlineProbe}`));
// VANGUARD_SHOTS_TEMP=1 (with VANGUARD_SHOTS): screenshots in a throwaway profile, so settings
// passed with VANGUARD_SHOTS_SET never touch the real installed copy's settings
if (process.env.VANGUARD_SHOTS && process.env.VANGUARD_SHOTS_TEMP)
  app.setPath('userData', path.join(app.getPath('temp'), 'vanguard-sim-shots'));

// the menu music (synthesised in the renderer, roadmap phase 2) may start before the first click
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  // stream: the player's own music plays from vgart://music/… (seeking needs range requests)
  {
    scheme: 'vgart',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function artDir() {
  if (!app.isPackaged) return path.join(__dirname, '../../assets/cards');
  const base = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
  return path.join(base, 'cards');
}

/** Sleeves and playmats (D-033) live next to `cards\`. */
const cosmetics = () => createCosmetics(path.dirname(artDir()));

function serveArt() {
  const root = path.resolve(artDir());
  const base = path.dirname(root);
  protocol.handle('vgart', (request) => {
    // vgart://cards/<SET>/<ID>.<ext> → <root>/<SET>/<ID>.<ext>, never outside root;
    // vgart://cosmetics/<sleeves|playmats>/<file> → the player's own sleeve or playmat image
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    // vgart://own/music/<file> → the player's own battle music (music\ next to cards\)
    const own = url.hostname === 'cosmetics' || url.hostname === 'own';
    const top = own ? base : root;
    const file = path.resolve(top, rel);
    const valid =
      url.hostname === 'own' ? isMusicPath(rel) : own ? isCosmeticPath(rel) : isArtPath(rel);
    if (!valid || !file.startsWith(top + path.sep) || !fs.existsSync(file)) {
      return new Response('not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

let artwork = null;
/** The Artwork Manager back end (app/main/generated/, built by scripts/artwork-build.ts). */
function artworkService() {
  if (artwork) return artwork;
  const { ArtworkService } = require('./generated/artwork.cjs');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'generated/artwork-manifest.json'), 'utf8'),
  );
  artwork = new ArtworkService(
    manifest,
    path.resolve(artDir()),
    path.join(app.getPath('userData'), 'artwork-sources.json'),
  );
  return artwork;
}

let managerWindow = null;
function openArtworkManager() {
  if (managerWindow && !managerWindow.isDestroyed()) {
    managerWindow.focus();
    return;
  }
  managerWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#04060b',
    autoHideMenuBar: true,
    title: 'Vanguard Sim — Artwork Manager',
    show: !smokeTest,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload-artwork.cjs'),
    },
  });
  if (devUrl) managerWindow.loadURL(new URL('artwork.html', devUrl).toString());
  else managerWindow.loadFile(path.join(__dirname, '../../dist/renderer/artwork.html'));
  if (smokeTest) runSmokeTest(managerWindow);
}

function registerArtworkIpc() {
  const progress = (event) => (p) => {
    if (!event.sender.isDestroyed()) event.sender.send('art:progress', p);
  };
  const pickFolder = async (event, title) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const r = await dialog.showOpenDialog(win, {
      title,
      properties: ['openDirectory', 'createDirectory'],
    });
    return r.canceled ? null : r.filePaths[0];
  };
  ipcMain.handle('art:quick', () => artworkService().quickStatus());
  ipcMain.handle('art:open', () => openArtworkManager());
  ipcMain.handle('art:info', () => artworkService().info());
  ipcMain.handle('art:scan', (event) =>
    artworkService().scan((done, total) => progress(event)({ phase: 'scan', done, total })),
  );
  ipcMain.handle('art:import', async (event, replace) => {
    const dir = await pickFolder(event, 'Choose the folder with your card images');
    if (!dir) return null;
    return artworkService().importFrom(dir, replace, (done, total) =>
      progress(event)({ phase: 'import', done, total }),
    );
  });
  ipcMain.handle('art:download', (event, sets, sourceId) =>
    artworkService().downloadSets(sets, sourceId, (p) =>
      progress(event)({ phase: 'download', ...p }),
    ),
  );
  ipcMain.handle('art:cancel', () => artworkService().cancel());
  ipcMain.handle('art:export', async (event) => {
    const dir = await pickFolder(event, 'Choose an empty folder to export the artwork to');
    return dir ? { count: await artworkService().exportTo(dir), folder: dir } : null;
  });
  ipcMain.handle('art:report', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const r = await dialog.showSaveDialog(win, {
      title: 'Save the artwork report',
      defaultPath: 'artwork-report.txt',
      filters: [{ name: 'Text', extensions: ['txt'] }],
    });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, await artworkService().reportText());
    return r.filePath;
  });
  // sleeves and playmats from the player's own images (D-033)
  // the player's own music files (music\ next to cards\), sorted by name
  ipcMain.handle('music:list', () => {
    const dir = path.join(path.dirname(path.resolve(artDir())), 'music');
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => isMusicName(f) && fs.statSync(path.join(dir, f)).isFile())
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  });
  ipcMain.handle('cosmetics:list', () => ({
    sleeves: cosmetics().list('sleeves'),
    playmats: cosmetics().list('playmats'),
  }));
  ipcMain.handle('cosmetics:import', async (event, kind) => {
    const c = cosmetics();
    if (!c.KINDS.includes(kind)) return null;
    const win = BrowserWindow.fromWebContents(event.sender);
    const r = await dialog.showOpenDialog(win, {
      title: kind === 'sleeves' ? 'Choose sleeve images' : 'Choose playmat images',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    return r.canceled ? null : c.importFiles(kind, r.filePaths);
  });
  // "Download from a link": an image address the player pasted, for their personal use
  ipcMain.handle('cosmetics:download', (_event, kind, address, name) =>
    cosmetics().download(kind, address, name, (url, init) => net.fetch(url, init)),
  );
  ipcMain.handle('cosmetics:reveal', (_event, kind) => {
    const c = cosmetics();
    if (!c.KINDS.includes(kind)) return '';
    fs.mkdirSync(c.dir(kind), { recursive: true });
    return shell.openPath(c.dir(kind));
  });
  ipcMain.handle('art:reveal', (_event, which) => {
    const service = artworkService();
    if (which === 'sources') {
      fs.mkdirSync(path.dirname(service.sourcesFile), { recursive: true });
      return shell.openPath(path.dirname(service.sourcesFile));
    }
    fs.mkdirSync(service.root, { recursive: true });
    return shell.openPath(service.root);
  });
}

/**
 * Vanguard Update Manager stage 1 (D-037): the game window asks, the main process looks up the
 * newest GitHub release (Node's fetch, like the Artwork Manager; the window itself stays offline,
 * D-004) and can open the official release page in the browser. Stage 3: on request it downloads
 * and verifies an update into a staging folder. Stage 4: the updater program installs it.
 */
const updateRoot = () =>
  path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'VanguardSim');
const portable = () => Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
/** A portable copy unpacks itself on every run and a development build has no install to update. */
const canUpdateInPlace = () => app.isPackaged && !portable();
const NOT_IN_PLACE = { ok: false, error: 'This copy cannot be updated in place.' };
let installer = null;
const getInstaller = () =>
  (installer ??= createUpdateInstaller({
    installDir: path.dirname(app.getPath('exe')),
    downloadRoot: path.join(updateRoot(), 'updates'),
    stateDir: path.join(updateRoot(), 'state'),
    currentVersion: app.getVersion(),
    pid: process.pid,
  }));

function registerUpdateIpc() {
  let downloader = null;
  const getDownloader = () =>
    (downloader ??= createUpdateDownloader({
      installDir: path.dirname(app.getPath('exe')),
      downloadRoot: path.join(updateRoot(), 'updates'),
      currentVersion: app.getVersion(),
      fetchFn: (url, init) => globalThis.fetch(url, init),
    }));
  // the updater waits for this process to end before it touches anything
  const closeIfStarted = (r) => {
    if (r.ok) setTimeout(() => app.quit(), 200);
    return r;
  };
  ipcMain.handle('updates:install', async (_e, version) =>
    canUpdateInPlace() ? closeIfStarted(await getInstaller().start(version)) : NOT_IN_PLACE,
  );
  ipcMain.handle('updates:rollback', async () =>
    canUpdateInPlace() ? closeIfStarted(await getInstaller().restore('manual')) : NOT_IN_PLACE,
  );
  ipcMain.handle('updates:rollback-info', () =>
    canUpdateInPlace() ? getInstaller().rollbackInfo() : null,
  );
  ipcMain.handle('updates:last-result', () =>
    canUpdateInPlace() ? getInstaller().lastResult() : null,
  );
  ipcMain.handle('updates:download', (e, version) => {
    if (!canUpdateInPlace()) return NOT_IN_PLACE;
    return getDownloader().start(version, (progress) => {
      if (!e.sender.isDestroyed()) e.sender.send('updates:progress', progress);
    });
  });
  ipcMain.handle('updates:cancel', () => downloader?.cancel());
  ipcMain.handle('updates:check', (_e, channel) =>
    updates.checkForUpdates({
      currentVersion: app.getVersion(),
      channel,
      fetchFn: (url, init) => globalThis.fetch(url, init),
    }),
  );
  ipcMain.handle('updates:info', () => ({
    version: app.getVersion(),
    portable: portable(),
    packaged: app.isPackaged,
  }));
  // the address is made here: the window can ask for this page, not for any address
  ipcMain.handle('feedback:open', () => shell.openExternal(updates.feedbackUrl(app.getVersion())));
  ipcMain.handle('updates:open-page', (_e, url) =>
    updates.isReleasePage(url) ? shell.openExternal(url) : undefined,
  );
}

/** The chosen app icon (app/main/appIcon.cjs). */
let appIconStore = null;
const appIcon = () =>
  (appIconStore ??= createAppIcon({
    userData: app.getPath('userData'),
    iconsDir: path.join(__dirname, 'icons'),
    desktop: app.getPath('desktop'),
    // the portable exe unpacks to a temporary folder: a shortcut starts the real file
    launch: () => {
      const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
      return {
        target: exe,
        args: app.isPackaged ? '' : `"${app.getAppPath()}"`,
        cwd: path.dirname(exe),
      };
    },
    writeShortcut: (file, op, options) => shell.writeShortcutLink(file, op, options),
  }));

function registerAppIconIpc(win) {
  ipcMain.handle('icon:set', (_e, id) => {
    const used = appIcon().set(id);
    if (!win.isDestroyed()) win.setIcon(appIcon().iconPath(used));
  });
  ipcMain.handle('icon:shortcut', (_e, id) => appIcon().makeShortcut(id));
  win.on('closed', () => {
    ipcMain.removeHandler('icon:set');
    ipcMain.removeHandler('icon:shortcut');
  });
}

/** Play Online (D-032): the game window hosts or joins through these; one connection at a time. */
function registerOnlineIpc(win) {
  const online = createOnline((kind, data) => {
    if (!win.isDestroyed()) win.webContents.send('online:event', { kind, data });
  });
  const port = (p) => (Number.isInteger(p) && p > 0 && p < 65536 ? p : null);
  ipcMain.handle('online:host', (_e, p) =>
    port(p) ? online.host(p) : { ok: false, error: 'Invalid port.' },
  );
  ipcMain.handle('online:join', (_e, address, p) =>
    typeof address === 'string' && address.length <= 255 && port(p)
      ? online.join(address.trim(), p)
      : { ok: false, error: 'Invalid address or port.' },
  );
  ipcMain.handle('online:send', (_e, line) => online.send(line));
  ipcMain.handle('online:drop', () => online.drop());
  ipcMain.handle('online:stop', () => online.stop());
  ipcMain.handle('online:room-codes', (_e, on) => {
    roomCodesOpen = on === true;
  });
  win.on('closed', () => {
    online.stop();
    roomCodesOpen = false;
  });
}

function createWindow() {
  // VANGUARD_SHOTS_SIZE=923x411 (with VANGUARD_SHOTS): a phone-sized page, drawn at 2x, to review
  // the Android layout on the PC. Never active in normal use.
  const phone = shotsDir && /^(\d+)x(\d+)$/.exec(process.env.VANGUARD_SHOTS_SIZE || '');
  const win = new BrowserWindow({
    width: phone ? Number(phone[1]) * 2 : 1600,
    height: phone ? Number(phone[2]) * 2 : 900,
    useContentSize: !!phone,
    minWidth: phone ? 0 : 1024,
    minHeight: phone ? 0 : 576,
    backgroundColor: '#04060b',
    autoHideMenuBar: true,
    title: 'Vanguard Simulator',
    icon: appIcon().iconPath(),
    show: !smokeTest,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload-game.cjs'),
    },
  });
  registerOnlineIpc(win);
  // phone-size pictures are drawn at 2x; Chromium remembers a page's zoom, so other runs reset it
  if (shotsDir)
    win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(phone ? 2 : 1));
  registerAppIconIpc(win);
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  if (smokeTest) runSmokeTest(win);
  else if (shotsDir) runShots(win);
  else if (jitterOut) runJitterProbe(win);
  else if (onlineProbe) runOnlineProbe(win, onlineProbe);
}

/**
 * Development aid (`npm run ui:shots`): plays the first turns through the UI by clicking (keep the
 * hand, ride when possible, pass guards, end phases) and saves a screenshot after every step into
 * VANGUARD_SHOTS, so UI changes can be reviewed as pictures. Never active in normal use.
 */
const shotsDir = process.env.VANGUARD_SHOTS;
const shotsStep = `(() => {
    const q = (s) => document.querySelector(s);
    const click = (el) => (el ? (el.click(), el.textContent || el.dataset.testid || 'clicked') : null);
    const hand = q('[data-testid=hand-0]');
    const vc = q('[data-testid="circle-0-vanguard"]');
    const end = q('[data-testid=action-end]');
    const myRide = end && /ride/i.test(end.textContent || '');
    q('[data-testid=card-details]')?.click(); // close a details window opened by a stray click
    return (
      // the home screen: START BATTLE opens the game modes first
      click(q('[data-testid=start-battle]')) ||
      // VANGUARD_SHOTS_DEMO=1: start a CPU demonstration instead and just watch (v0.28)
      (${JSON.stringify(!!process.env.VANGUARD_SHOTS_DEMO)} &&
        (click(q('[data-testid=cpu-demo]')) || click(q('[data-testid=demo-start]')) || 'watch')) ||
      click(q('[data-testid=new-game]')) ||
      (${JSON.stringify(process.env.VANGUARD_SHOTS_FORMAT === 'g')} && !window.__fmt && q('[data-testid=format-g]') && ((window.__fmt = 1), click(q('[data-testid=format-g]')))) ||
      (${JSON.stringify(process.env.VANGUARD_SHOTS_FORMAT === 'classic')} && !window.__fmt && q('[data-testid=format-classic]') && ((window.__fmt = 1), click(q('[data-testid=format-classic]')))) ||
      click(q('[data-testid=start]')) ||
      click(q('[data-testid=stride-go]')) ||
      click(q('[data-testid=g-guard-go]')) ||
      click(q('[data-testid=action-stride]')) ||
      click(q('[data-testid=mulligan] button')) ||
      click(q('[data-testid=choice] button')) ||
      click(q('[data-testid=action-pass]')) ||
      (myRide && hand && vc && !window.__rode && (window.__rode = true) && (hand.click(), vc.click(), 'ride?')) ||
      (end && /to battle/i.test(end.textContent || '') && q('.hand-card.usable') && !window.__menu && (window.__menu = true) && (q('.hand-card.usable').click(), 'card-menu')) ||
      click(q('[data-testid=action-cancel]')) ||
      click(q('[data-testid=action-end]')) ||
      'wait'
    );
  })()`;
/** VANGUARD_SHOTS_SCREEN=decks: the Deck Builder instead (G era, a search, cards added). */
const deckShotsStep = `(() => {
    const q = (s) => document.querySelector(s);
    const n = (window.__n = (window.__n || 0) + 1);
    const typeIn = (text) => {
      const box = q('[data-testid=card-search]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(box, text);
      box.dispatchEvent(new Event('input', { bubbles: true }));
      return 'search ' + text;
    };
    const addAll = (times) => {
      const cards = [...document.querySelectorAll('.pool-card')];
      for (let t = 0; t < times; t++) for (const c of cards) c.click();
      return 'added ' + cards.length;
    };
    if (n === 1) return (q('[data-testid=deck-builder]').click(), 'deck builder');
    if (n === 2) return (q('[data-testid=deck-format-g]').click(), 'G era');
    if (n === 3) return typeIn('gear chronicle');
    if (n === 4) return addAll(4);
    if (n === 5) return typeIn('chrono');
    if (n === 6) return typeIn('');
    if (n === 7) {
      document.querySelectorAll('.ui-select-trigger')[1]?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
      );
      return 'clan filter open';
    }
    if (n === 8)
      return (document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 'closed');
    if (n === 9)
      return ([...document.querySelectorAll('.ui-btn')].find((b) => b.textContent === 'Test hand')?.click(), 'test hand');
    return 'wait';
  })()`;
/** VANGUARD_SHOTS_SCREEN=updates: the Update Manager (D-037), a live check, the release notes. */
const updateShotsStep = `(() => {
    const q = (s) => document.querySelector(s);
    const n = (window.__n = (window.__n || 0) + 1);
    if (n === 1) return (q('[data-testid=settings]').click(), 'settings');
    if (n === 2) return (q('[data-testid=open-updates]').click(), 'updates');
    if (n === 3) return (q('[data-testid=check-updates]').click(), 'check');
    if (n === 6 && q('[data-testid=toggle-notes]')) return (q('[data-testid=toggle-notes]').click(), 'notes');
    return 'wait';
  })()`;
/** VANGUARD_SHOTS_SCREEN=home: the home screen, its game modes, the profile, the Card Database. */
const homeShotsStep = `(() => {
    const q = (s) => document.querySelector(s);
    const n = (window.__n = (window.__n || 0) + 1);
    if (n === 2) return (q('[data-testid=start-battle]').click(), 'modes');
    if (n === 3) return (q('[data-testid=modes-back]').click(), 'back');
    if (n === 4) return (q('[data-testid=home-profile]').click(), 'profile');
    if (n === 5) return (q('[data-testid=profile-back]').click(), 'closed');
    if (n === 6 && q('[data-testid=home-menu]')) return (q('[data-testid=home-menu]').click(), 'menu');
    if (n === 7) return (q('[data-testid=card-db]').click(), 'card database');
    if (n === 8) return (q('.pool-card')?.click(), 'card details');
    return 'wait';
  })()`;
/** VANGUARD_SHOTS_SCREEN=profile: the Player Profile, its statistics, the editor and the banners. */
const profileShotsStep = `(() => {
    const q = (s) => document.querySelector(s);
    const n = (window.__n = (window.__n || 0) + 1);
    if (n === 2) return (q('[data-testid=home-profile]').click(), 'profile');
    if (n === 3) return (q('[data-testid=profile-tab-sync]').click(), 'sync');
    if (n === 4) return (q('[data-testid=profile-tab-stats]').click(), 'statistics');
    if (n === 5) return (q('[data-testid=profile-tab-profile]').click(), 'back to profile');
    if (n === 6) return (q('[data-testid=profile-edit]').click(), 'edit');
    if (n === 7) return (q('[data-testid=profile-banner-change]').click(), 'banners');
    if (n === 8) return (q('[data-testid=banner-group-playmats]').click(), 'playmats');
    return 'wait';
  })()`;
/** VANGUARD_SHOTS_SCREEN=showcase: the UI Component Showcase, a dropdown open, a dialog open. */
const showcaseShotsStep = `(() => {
    const q = (s) => document.querySelector(s);
    const n = (window.__n = (window.__n || 0) + 1);
    if (n === 1) return (q('[data-testid=settings]').click(), 'settings');
    if (n === 2) return (q('[data-testid=open-showcase]').click(), 'showcase');
    if (n === 4) {
      const t = q('.ui-select-trigger');
      t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
      return 'dropdown';
    }
    if (n === 5) return (document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 'closed');
    if (n === 6) return ([...document.querySelectorAll('.ui-btn')].find((b) => b.textContent.includes('Delete deck')).click(), 'dialog');
    return 'wait';
  })()`;
function runShots(win) {
  const screen = process.env.VANGUARD_SHOTS_SCREEN;
  const step =
    screen === 'decks'
      ? deckShotsStep
      : screen === 'updates'
        ? updateShotsStep
        : screen === 'home'
          ? homeShotsStep
          : screen === 'profile'
            ? profileShotsStep
            : screen === 'showcase'
              ? showcaseShotsStep
              : shotsStep;
  const errors = [];
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') errors.push(event.message);
  });
  win.webContents.on('did-finish-load', async () => {
    // VANGUARD_SHOTS_VIEW=overhead: the overhead battle view (Settings → Battle view)
    const view = process.env.VANGUARD_SHOTS_VIEW;
    // VANGUARD_SHOTS_SOUND=1: sound on (unmuted, music at 50) to check the music in music.json
    // VANGUARD_SHOTS_SET='{"theme":"gera"}': any settings, merged in (themes, text size…)
    const sound = {
      ...(process.env.VANGUARD_SHOTS_SOUND
        ? { muted: false, masterVolume: 80, musicVolume: 50, mutedCategories: [] }
        : {}),
      ...(process.env.VANGUARD_SHOTS_SET ? JSON.parse(process.env.VANGUARD_SHOTS_SET) : {}),
    };
    if (
      (view || process.env.VANGUARD_SHOTS_SOUND || process.env.VANGUARD_SHOTS_SET) &&
      !runShots.viewSet
    ) {
      runShots.viewSet = true;
      await win.webContents.executeJavaScript(`(() => {
        const k = 'vanguard-sim.settings.v1';
        const s = JSON.parse(localStorage.getItem(k) || '{}');
        // overrides replace the per-profile view, playmat and moving background (Battlefield 2.0) too
        delete s.profiles;
        localStorage.setItem(k, JSON.stringify({ ...s, ${view ? `tableView: ${JSON.stringify(view)},` : ''} ...${JSON.stringify(sound)} }));
        location.reload();
      })()`);
      return;
    }
    fs.mkdirSync(shotsDir, { recursive: true });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const musicLog = [];
    await wait(1500);
    for (let i = 0; i < Number(process.env.VANGUARD_SHOTS_STEPS || 40); i++) {
      const did = await win.webContents.executeJavaScript(step);
      // the music each step (window.__vanguardMusic, a read-only diagnostic): is it playing?
      musicLog.push({
        step: i,
        music: await win.webContents.executeJavaScript('window.__vanguardMusic?.() ?? null'),
        layout: await win.webContents.executeJavaScript(
          `({ phone: !!document.querySelector('.m-battle'), stage: document.querySelector('.stage')?.className, set: JSON.parse(localStorage.getItem('vanguard-sim.settings.v1') || '{}').battleLayout, w: innerWidth, h: innerHeight })`,
        ),
      });
      // one frame mid-animation, one after it has settled
      await wait(120);
      const mid = await win.webContents.capturePage();
      fs.writeFileSync(path.join(shotsDir, `${String(i).padStart(3, '0')}-mid.png`), mid.toPNG());
      // an ability callout beside the G circle, if one is up
      if (await win.webContents.executeJavaScript('!!document.querySelector(".ability-callout")'))
        fs.writeFileSync(
          path.join(shotsDir, `${String(i).padStart(3, '0')}-ability.png`),
          mid.toPNG(),
        );
      // the battle VS display and cut-ins (D-035), if one is up
      for (const [sel, tag] of [
        ['.battle-vs', 'battle'],
        ['.cutin', 'cutin'],
      ])
        if (await win.webContents.executeJavaScript(`!!document.querySelector("${sel}")`)) {
          fs.writeFileSync(
            path.join(shotsDir, `${String(i).padStart(3, '0')}-${tag}.png`),
            (await win.webContents.capturePage()).toPNG(),
          );
        }
      await wait(330);
      const image = await win.webContents.capturePage();
      fs.writeFileSync(
        path.join(
          shotsDir,
          `${String(i).padStart(3, '0')}-${String(did)
            .replace(/[^\w-]+/g, '_')
            .slice(0, 20)}.png`,
        ),
        image.toPNG(),
      );
      await wait(500);
      if (did === 'turn-over') break;
    }
    // finally hover a card in the hand to show the card preview
    const [w, h] = win.getContentSize();
    win.webContents.sendInputEvent({
      type: 'mouseMove',
      x: Math.round(w / 2),
      y: Math.round(h * 0.93),
    });
    await wait(400);
    fs.writeFileSync(
      path.join(shotsDir, 'zz-hover.png'),
      (await win.webContents.capturePage()).toPNG(),
    );
    // where the main board areas are, in stage px (1920×1080), for layout work
    const rects = await win.webContents.executeJavaScript(`(() => {
      const stage = document.querySelector('.stage').getBoundingClientRect();
      const k = stage.width / 1920;
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return [r.left, r.top, r.right, r.bottom].map((v, i) =>
          Math.round((v - (i % 2 ? stage.top : stage.left)) / k));
      };
      const out = {};
      for (const sel of ['.phase-rail', '.hand', '.hover-preview', '.feed', '.action-bar',
        '.attack-preview', '.plate', '.hint', '[data-testid^=circle-]', '.pile', '.pile-tile',
        '[data-zone]', '.prompt'])
        document.querySelectorAll(sel).forEach((el, i) => {
          out[sel + '#' + i + ' ' + (el.dataset.testid || el.dataset.zone || el.className)] = box(el);
        });
      return out;
    })()`);
    fs.writeFileSync(path.join(shotsDir, 'rects.json'), JSON.stringify(rects, null, 1));
    fs.writeFileSync(path.join(shotsDir, 'music.json'), JSON.stringify(musicLog, null, 1));
    // and concede through the game menu to show the result screen
    await win.webContents.executeJavaScript(`(() => {
      document.querySelector('button[title="Game menu"]')?.click();
      setTimeout(() => [...document.querySelectorAll('button')]
        .find((b) => b.textContent.trim() === 'Concede')?.click(), 200);
    })()`);
    await wait(2500);
    fs.writeFileSync(
      path.join(shotsDir, 'zz-result.png'),
      (await win.webContents.capturePage()).toPNG(),
    );
    fs.writeFileSync(path.join(shotsDir, 'console.txt'), errors.join('\n'));
    app.exit(0);
  });
}

/**
 * Development aid (`npm run ui:jitter`): repeatable check for hand cards moving on their own
 * (KNOWN_ISSUES: v0.19 hand jitter). Starts a game through the UI, then counts movement animations
 * that start on hand cards although the hand did not change, while the mouse is away, rests on a
 * card, sweeps across the hand, and while the game goes on. Writes JSON to VANGUARD_JITTER.
 */
const jitterOut = process.env.VANGUARD_JITTER;
/**
 * Development aid (`npm run online:probe`, D-032): one app hosts, another joins 127.0.0.1 (or the
 * same room code with `-- --code`); both go
 * through Play Online into the battle, keep their opening hands, and write what they saw to
 * VANGUARD_ONLINE_OUT. Never active in normal use.
 */
function runOnlineProbe(win, role) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => win.webContents.executeJavaScript(code);
  const click = (testId) =>
    js(`document.querySelector('[data-testid="${testId}"]')?.click() ?? null`);
  const type = (testId, value) =>
    js(`(() => {
      const el = document.querySelector('[data-testid="${testId}"]');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  const until = async (code, ms = 30000) => {
    for (let t = 0; t < ms; t += 250) {
      if (await js(code)) return true;
      await wait(250);
    }
    return false;
  };
  const report = {};
  win.webContents.once('did-finish-load', async () => {
    try {
      await wait(800);
      await click('start-battle');
      await wait(300);
      await click('play-online');
      await wait(400);
      await type('online-name', role === 'host' ? 'Probe Host' : 'Probe Guest');
      const code = process.env.VANGUARD_ONLINE_CODE;
      if (code) {
        // by room code, through the PeerJS service (needs the internet)
        await type('online-code', code);
        if (role === 'host') {
          await click('online-host-code');
          report.hosting = await until(
            `!!document.querySelector('[data-testid="online-hosting-code"]')`,
            20000,
          );
        } else {
          await wait(6000);
          await click('online-join-code');
        }
      } else {
        await click('online-by-address');
        await wait(200);
        if (role === 'host') {
          await click('online-host');
          report.addresses = await until(
            `!!document.querySelector('[data-testid="online-addresses"]')`,
            5000,
          );
        } else {
          await wait(2500);
          await type('online-address', '127.0.0.1');
          await click('online-join');
        }
      }
      report.battle = await until(`!!document.querySelector('.plate.opp')`);
      report.opponent = await js(`document.querySelector('.plate.opp .who')?.textContent ?? null`);
      // keep the opening hand when asked; then wait for turn 1 to start
      report.keptHand = await until(`(() => {
        const b = document.querySelector('[data-testid="mulligan"] button');
        if (b) { b.click(); return true; }
        return false;
      })()`);
      report.turnStarted = await until(
        `document.body.textContent.includes('YOUR TURN') || document.body.textContent.includes("OPPONENT'S TURN") || !!document.querySelector('.phase-rail .on, .phase-rail .active')`,
      );
      report.status = await js(
        `document.querySelector('[data-testid="online-status"]')?.textContent ?? null`,
      );
      // VANGUARD_ONLINE_SECONDS: keep playing (the ui:shots clicker) and watch for errors and a
      // blank window, e.g. the guest's screen going blank mid-game (2026-11-03 report)
      const seconds = Number(process.env.VANGUARD_ONLINE_SECONDS || 0);
      if (seconds > 0) {
        const errors = (report.errors = []);
        win.webContents.on('console-message', (event) => {
          if (event.level === 'error') errors.push(event.message.slice(0, 2000));
        });
        win.webContents.on('render-process-gone', (_e, d) =>
          errors.push(`renderer gone: ${d.reason}`),
        );
        report.steps = 0;
        for (let t = 0; t < seconds * 1000; t += 400) {
          const blank = await js(
            `(document.getElementById('root')?.children.length ?? 0) === 0 || !document.body.innerText.trim()`,
          );
          if (blank) {
            report.blank = { afterSteps: report.steps, turn: report.lastTurn ?? null };
            const img = await win.webContents.capturePage();
            fs.writeFileSync(
              process.env.VANGUARD_ONLINE_OUT.replace(/\.json$/, '-blank.png'),
              img.toPNG(),
            );
            break;
          }
          if (await js(`!!document.querySelector('.game-over, [data-testid=game-over]')`)) {
            report.gameOver = await js(`document.body.innerText.slice(0, 300)`);
            break;
          }
          report.lastTurn = await js(
            `(document.body.innerText.match(/TURN\\s*(\\d+)/i) || [])[1] ?? null`,
          );
          // each turn: ride again, then attack with the vanguard (drive/damage checks, guarding)
          const attacked = await js(`(() => {
            const q = (s) => document.querySelector(s);
            const end = (q('[data-testid=action-end]')?.textContent || '').toLowerCase();
            if (end.includes('end ride') && window.__atk) window.__atk = window.__rode = window.__menu = false;
            if (!end.includes('end turn') || window.__atk || q('[data-testid=choice]')) return false;
            const vc = q('[data-testid="circle-0-vanguard"]'), opp = q('[data-testid="circle-1-vanguard"]');
            if (!vc || !opp) return false;
            window.__atk = true;
            vc.click();
            setTimeout(() => opp.click(), 150);
            return true;
          })()`);
          if (attacked) report.attacks = (report.attacks ?? 0) + 1;
          else await js(shotsStep);
          report.steps++;
          await wait(400);
        }
      }
    } catch (err) {
      report.error = String(err);
    }
    fs.writeFileSync(process.env.VANGUARD_ONLINE_OUT, JSON.stringify(report, null, 2));
    await wait(1500);
    app.exit(0);
  });
}

function runJitterProbe(win) {
  const instrument = `(() => {
    const handIds = () => [...document.querySelectorAll('.hand [data-iid]')].map((e) => e.dataset.iid).join();
    const s = (window.__jit = { phase: 'setup', stats: {}, last: handIds(), changedAt: 0 });
    const bump = (k) => {
      const p = (s.stats[s.phase] ??= { handAnims: 0, spurious: 0, handChanges: 0, mouseovers: 0 });
      p[k]++;
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this.dataset?.iid && this.closest('.hand')) {
        bump('handAnims');
        if (handIds() !== s.last) s.changedAt = performance.now();
        // a slide may continue (from where it is drawn) while it runs; any other slide needs a new hand
        const sinceChange = performance.now() - s.changedAt;
        if (handIds() === s.last && sinceChange > 800) {
          bump('spurious');
          (s.samples ??= []).push({ phase: s.phase, iid: this.dataset.iid, from: args[0]?.[0], sinceChange });
        }
      }
      return animate.apply(this, args);
    };
    window.addEventListener('mouseover', () => bump('mouseovers'));
    // runs after React's commit (and its layout effects), so animate() above still sees the old hand;
    // a MutationObserver keeps working when the window is hidden, unlike requestAnimationFrame
    new MutationObserver(() => {
      const ids = handIds();
      if (ids !== s.last) {
        bump('handChanges');
        s.changedAt = performance.now();
      }
      s.last = ids;
    }).observe(document.body, { childList: true, subtree: true });
  })()`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => win.webContents.executeJavaScript(code);
  const hidden = [];
  // a hidden or covered window stops animations and gets no hover, so its numbers mean nothing
  const drawing = () =>
    js(`new Promise((done) => {
      const t0 = document.timeline.currentTime;
      setTimeout(() => done({
        visible: document.visibilityState === 'visible',
        focused: document.hasFocus(),
        animating: document.timeline.currentTime - t0 > 100,
      }), 200);
    })`);
  const phase = async (name) => {
    const d = await drawing();
    if (!d.visible || !d.animating) hidden.push(`${name} ${JSON.stringify(d)}`);
    await js(`(() => {
      const s = window.__jit;
      s.phase = ${JSON.stringify(name)};
      s.stats[s.phase] ??= { handAnims: 0, spurious: 0, handChanges: 0, mouseovers: 0 };
    })()`);
  };
  const move = (x, y) =>
    win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) });
  win.webContents.on('did-finish-load', async () => {
    await wait(1500);
    for (let i = 0; i < 40; i++) {
      await js(shotsStep);
      await wait(700);
      if (
        await js(
          `!!document.querySelector('[data-testid=hand-0]') && !document.querySelector('[data-testid=mulligan]')`,
        )
      )
        break;
    }
    await js(instrument);
    const [w, h] = win.getContentSize();
    await phase('idle, mouse away');
    move(w / 2, h * 0.2);
    await wait(3000);
    await phase('mouse resting low on a hand card');
    move(w / 2, h * 0.975);
    await wait(4000);
    await phase('mouse sweeping across the hand');
    for (let t = 0; t < 200; t++) {
      move(w / 2 + Math.sin(t / 12) * w * 0.2, h * (0.93 + 0.04 * Math.sin(t / 5)));
      await wait(25);
    }
    move(w / 2, h * 0.95);
    await wait(500);
    // hover must still lift and enlarge the card's picture
    const hoverLift = await js(`(() => {
      const el = document.querySelector('.hand-card:hover .card');
      return el ? getComputedStyle(el).transform : null;
    })()`);
    await phase('game goes on, mouse on the hand');
    move(w / 2, h * 0.95);
    for (let i = 0; i < 12; i++) {
      await js(shotsStep);
      await wait(700);
    }
    await phase('log opened and closed, mouse on the hand');
    for (let i = 0; i < 8; i++) {
      await js(`document.querySelector('[data-testid=action-log]')?.click()`);
      await wait(250);
      await js(`document.querySelector('[data-testid=log] .btn')?.click()`);
      await wait(250);
    }
    await phase('hand cards selected and deselected');
    for (let i = 0; i < 6; i++) {
      await js(`document.querySelector('[data-testid=hand-${i % 3}]')?.click()`);
      await wait(300);
      await js(`document.querySelector('[data-testid=action-cancel]')?.click()`);
      await wait(300);
    }
    await phase('window resized');
    const [ow, oh] = win.getSize();
    for (const [sw, sh] of [
      [1024, 640],
      [1600, 900],
      [ow, oh],
    ]) {
      win.setSize(sw, sh);
      await wait(600);
    }
    await phase('long game (draws, calls, battles), mouse on the hand');
    for (let i = 0; i < 120; i++) {
      if (i % 10 === 0) move(w / 2 + ((i % 30) - 15) * 12, h * 0.95);
      const did = await js(shotsStep);
      await wait(400);
      if (await js(`!!document.querySelector('[data-testid=game-over]')`)) break;
      if (did === 'wait' && i > 100) break;
    }
    const stats = await js('window.__jit.stats');
    stats.hoverLift = hoverLift;
    const d = await drawing();
    if (!d.visible || !d.animating) hidden.push(`end ${JSON.stringify(d)}`);
    stats.hidden = hidden;
    stats.samples = await js('(window.__jit.samples ?? []).slice(0, 20)');
    stats.context = await js(`({
      handCards: document.querySelectorAll('.hand [data-iid]').length,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      settings: localStorage.getItem(Object.keys(localStorage).find((k) => /setting/i.test(k)) ?? ''),
    })`);
    fs.writeFileSync(jitterOut, JSON.stringify(stats, null, 2));
    app.exit(0);
  });
}

/** Prints one JSON line about the loaded UI and exits (0 = the main menu rendered, no errors). */
function runSmokeTest(win) {
  const errors = [];
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error') errors.push(event.message);
  });
  win.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      const ui = await win.webContents.executeJavaScript(
        `(async () => ({
          title: document.title,
          rendered: document.getElementById('root')?.children.length ?? 0,
          text: document.body.innerText.slice(0, 120),
          // the game window's artwork status (preload), or null in the Artwork Manager
          artwork: (await window.vanguardDesktop?.artworkStatus()) ?? null,
          // the way the UI loads art: an <img>, which reports 'loaded' or 'missing'
          artProbe: await new Promise((done) => {
            const img = new Image();
            img.onload = () => done('loaded');
            img.onerror = () => done('missing');
            img.src = 'vgart://cards/BT01/BT01-001.png';
          }),
        }))()`,
      );
      const ok = ui.rendered > 0 && errors.length === 0;
      const report = JSON.stringify({ ok, packaged: app.isPackaged, artDir: artDir(), ui, errors });
      // a packaged Windows app has no console: write to VANGUARD_SMOKE_OUT when it is given
      if (process.env.VANGUARD_SMOKE_OUT) {
        fs.writeFileSync(process.env.VANGUARD_SMOKE_OUT, report);
      } else {
        process.stdout.write(`${report}\n`);
      }
      app.exit(ok ? 0 : 1);
    }, 2500);
  });
}

/** Play Online by room code (D-032): the public PeerJS service that introduces the two games. */
const ROOM_CODE_SERVICE = /^(https|wss):\/\/0\.peerjs\.com\//;
let roomCodesOpen = false;

app.whenReady().then(async () => {
  // an update stopped part-way (power cut, crash): go back to the version it came from first
  if (canUpdateInPlace() && !smokeTest && (await getInstaller().interrupted())) {
    const r = await getInstaller().restore('interrupted');
    if (r.ok) {
      app.quit();
      return;
    }
  }
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const remote = /^(https?|wss?):/.test(details.url);
    const allowed =
      (devUrl && details.url.startsWith(devUrl)) ||
      (roomCodesOpen && ROOM_CODE_SERVICE.test(details.url));
    callback({ cancel: remote && !allowed });
  });
  serveArt();
  registerArtworkIpc();
  registerUpdateIpc();
  if (process.argv.includes('--artwork')) openArtworkManager();
  else createWindow();
});

app.on('window-all-closed', () => app.quit());
