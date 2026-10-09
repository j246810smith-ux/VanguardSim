// Electron main process: one window showing the built renderer. Version 1 is offline only
// (D-004), so every http(s) request is blocked except the Vite dev server during development.
//
// Card art is optional and never shipped (D-018, D-025). The renderer loads it from the
// `vgart:` scheme, served read-only from one folder:
//   - packaged app: `cards\` next to the executable (or next to the portable .exe),
//   - `npm run app` from the repository: `assets/cards/`.
// Missing images are fine: the UI shows a text card instead.
const { app, BrowserWindow, net, protocol, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const devUrl = process.env.VANGUARD_DEV_URL;
/** Set by the release smoke test (docs/RELEASING.md): load, report, quit. */
const smokeTest = process.env.VANGUARD_SMOKE_TEST === '1';

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
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  if (smokeTest) runSmokeTest(win);
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
  createWindow();
});

app.on('window-all-closed', () => app.quit());
