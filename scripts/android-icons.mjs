// Makes the Android launcher icons from packaging/android-icon.svg (an original design), with the
// Electron already in the project: a hidden window draws the SVG on a canvas at each size. No
// other packages needed.
//
//   npx electron scripts/android-icons.mjs
//
// Writes into android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/:
//   ic_launcher.png             the square icon (older Android versions)
//   ic_launcher_round.png       the round icon
//   ic_launcher_foreground.png  the adaptive icon's front layer (the art only, on transparent)
// The adaptive icon's back layer is the colour in res/values/ic_launcher_background.xml.
import { app, BrowserWindow } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'packaging', 'android-icon.svg'), 'utf8');
const res = join(root, 'android', 'app', 'src', 'main', 'res');

/** Launcher icon sizes in px: 48 dp, and 108 dp for the adaptive layer. */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Runs in the page: one PNG (as a data URL) of the SVG in the given shape and size.
const draw = (source, kind, size) => `(async () => {
  const doc = new DOMParser().parseFromString(${JSON.stringify(source)}, 'image/svg+xml');
  const s = doc.documentElement;
  const ns = 'http://www.w3.org/2000/svg';
  const kind = ${JSON.stringify(kind)};
  if (kind === 'foreground') {
    // the art only, smaller, so it stays inside the 66 dp circle every launcher mask keeps
    doc.getElementById('background').remove();
    doc.getElementById('art').setAttribute('transform', 'translate(256 256) scale(0.82) translate(-256 -256)');
  } else {
    const clip = doc.createElementNS(ns, 'clipPath');
    clip.setAttribute('id', 'shape');
    const shape = doc.createElementNS(ns, kind === 'round' ? 'circle' : 'rect');
    if (kind === 'round') {
      shape.setAttribute('cx', '256'); shape.setAttribute('cy', '256'); shape.setAttribute('r', '256');
    } else {
      shape.setAttribute('width', '512'); shape.setAttribute('height', '512'); shape.setAttribute('rx', '92');
    }
    clip.appendChild(shape);
    s.querySelector('defs').appendChild(clip);
    const g = doc.createElementNS(ns, 'g');
    g.setAttribute('clip-path', 'url(#shape)');
    while (s.lastChild && s.lastChild !== s.querySelector('defs')) g.insertBefore(s.lastChild, g.firstChild);
    s.appendChild(g);
  }
  const text = new XMLSerializer().serializeToString(doc);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = ${size};
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, ${size}, ${size});
  return c.toDataURL('image/png');
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<!doctype html><title>icons</title>');
  let n = 0;
  for (const [density, k] of Object.entries(DENSITIES)) {
    const dir = join(res, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });
    const jobs = [
      ['ic_launcher.png', 'square', Math.round(48 * k)],
      ['ic_launcher_round.png', 'round', Math.round(48 * k)],
      ['ic_launcher_foreground.png', 'foreground', Math.round(108 * k)],
    ];
    for (const [file, kind, size] of jobs) {
      const url = await win.webContents.executeJavaScript(draw(svg, kind, size));
      writeFileSync(join(dir, file), Buffer.from(url.split(',')[1], 'base64'));
      console.log(`mipmap-${density}/${file} ${size}×${size}`);
      n++;
    }
  }
  console.log(`${n} icons written to ${res}`);
  app.quit();
});
