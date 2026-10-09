// Electron main process: one window showing the built renderer. Version 1 is offline only
// (D-004), so every http(s) request is blocked except the Vite dev server during development.
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
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const devUrl = process.env.VANGUARD_DEV_URL;
/** Set by the release smoke test (docs/RELEASING.md): load, report, quit. */
const smokeTest = process.env.VANGUARD_SMOKE_TEST === '1';

// the menu music (synthesised in the renderer, roadmap phase 2) may start before the first click
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  { scheme: 'vgart', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function artDir() {
  if (!app.isPackaged) return path.join(__dirname, '../../assets/cards');
  const base = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
  return path.join(base, 'cards');
}

function serveArt() {
  const root = path.resolve(artDir());
  protocol.handle('vgart', (request) => {
    // vgart://cards/<SET>/<ID>.<ext> → <root>/<SET>/<ID>.<ext>, never outside root
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(root, rel);
    const valid = /^[A-Z]{2}\d{2}\/[A-Z]{2}\d{2}-\d{3}\.(png|jpg)$/.test(rel);
    if (!valid || !file.startsWith(root + path.sep) || !fs.existsSync(file)) {
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 576,
    backgroundColor: '#04060b',
    autoHideMenuBar: true,
    title: 'Vanguard Simulator',
    show: !smokeTest,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload-game.cjs'),
    },
  });
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  if (smokeTest) runSmokeTest(win);
  else if (shotsDir) runShots(win);
}

/**
 * Development aid (`npm run ui:shots`): plays the first turns through the UI by clicking (keep the
 * hand, ride when possible, pass guards, end phases) and saves a screenshot after every step into
 * VANGUARD_SHOTS, so UI changes can be reviewed as pictures. Never active in normal use.
 */
const shotsDir = process.env.VANGUARD_SHOTS;
function runShots(win) {
  const step = `(() => {
    const q = (s) => document.querySelector(s);
    const click = (el) => (el ? (el.click(), el.textContent || el.dataset.testid || 'clicked') : null);
    const hand = q('[data-testid=hand-0]');
    const vc = q('[data-testid="circle-0-vanguard"]');
    const end = q('[data-testid=action-end]');
    const myRide = end && /ride/i.test(end.textContent || '');
    q('[data-testid=card-details]')?.click(); // close a details window opened by a stray click
    return (
      click(q('[data-testid=new-game]')) ||
      click(q('[data-testid=start]')) ||
      click(q('[data-testid=mulligan] button')) ||
      click(q('[data-testid=choice] button')) ||
      click(q('[data-testid=action-pass]')) ||
      (myRide && hand && vc && !window.__rode && (window.__rode = true) && (hand.click(), vc.click(), 'ride?')) ||
      click(q('[data-testid=action-cancel]')) ||
      click(q('[data-testid=action-end]')) ||
      'wait'
    );
  })()`;
  const errors = [];
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') errors.push(event.message);
  });
  win.webContents.on('did-finish-load', async () => {
    fs.mkdirSync(shotsDir, { recursive: true });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(1500);
    for (let i = 0; i < Number(process.env.VANGUARD_SHOTS_STEPS || 40); i++) {
      const did = await win.webContents.executeJavaScript(step);
      // one frame mid-animation, one after it has settled
      await wait(120);
      const mid = await win.webContents.capturePage();
      fs.writeFileSync(path.join(shotsDir, `${String(i).padStart(3, '0')}-mid.png`), mid.toPNG());
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

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const remote = /^(https?|wss?):/.test(details.url);
    callback({ cancel: remote && !(devUrl && details.url.startsWith(devUrl)) });
  });
  serveArt();
  registerArtworkIpc();
  if (process.argv.includes('--artwork')) openArtworkManager();
  else createWindow();
});

app.on('window-all-closed', () => app.quit());
