import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Battle UI renderer (app/renderer). In development card art is served from the git-ignored
 * assets/ folder (D-018: personal offline use only) at `cards/<SET>/<ID>.<ext>`. Release builds
 * (`vite build --mode release`, used by `npm run dist:win`) never include it (D-025); the desktop
 * app loads optional art from a folder next to the executable instead (app/main/main.cjs).
 */
const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
  version: string;
};

/**
 * U18 (docs/android/ANDROID_AUDIT_AND_PLAN.md): the Android app's pages may load only the app's
 * own files, so nothing can reach the network, as main.cjs enforces on Windows. Capacitor serves
 * the app and the card art copied to the phone (convertFileSrc) from https://localhost.
 */
export const ANDROID_CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://localhost",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "script-src 'self'",
  "connect-src 'self' https://localhost https://0.peerjs.com wss://0.peerjs.com",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

/** Adds the Content-Security-Policy to every page, in the Android build only. */
const androidCsp = (mode: string): Plugin => ({
  name: 'vanguard-android-csp',
  transformIndexHtml: () =>
    mode === 'android'
      ? [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: ANDROID_CSP },
            injectTo: 'head-prepend',
          },
        ]
      : [],
});

export default defineConfig(({ mode }) => ({
  root: 'app/renderer',
  // online play checks that both players run the same version (D-032); the platform flag picks
  // the Android build's behaviour (app/renderer/platform.ts)
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __VANGUARD_PLATFORM__: JSON.stringify(mode === 'android' ? 'android' : 'desktop'),
  },
  base: './',
  // release and Android builds never include card art (D-025)
  publicDir: mode === 'release' || mode === 'android' ? false : '../../assets',
  plugins: [react(), androidCsp(mode)],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    // the game, and the Artwork Manager window (docs/ARTWORK.md)
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'app/renderer/index.html'),
        artwork: resolve(import.meta.dirname, 'app/renderer/artwork.html'),
      },
    },
  },
  server: { port: 5173, strictPort: true },
}));
