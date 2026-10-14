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
// the jitter probe (runJitterProbe) runs with default settings in a throwaway profile
if (process.env.VANGUARD_JITTER)
  app.setPath('userData', path.join(app.getPath('temp'), 'vanguard-sim-jitter-probe'));

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
  else if (jitterOut) runJitterProbe(win);
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
function runShots(win) {
  const step = shotsStep;
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

/**
 * Development aid (`npm run ui:jitter`): repeatable check for hand cards moving on their own
 * (KNOWN_ISSUES: v0.19 hand jitter). Starts a game through the UI, then counts movement animations
 * that start on hand cards although the hand did not change, while the mouse is away, rests on a
 * card, sweeps across the hand, and while the game goes on. Writes JSON to VANGUARD_JITTER.
 */
const jitterOut = process.env.VANGUARD_JITTER;
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
