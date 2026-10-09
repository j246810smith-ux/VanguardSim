import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Battle UI renderer (app/renderer). In development card art is served from the git-ignored
 * assets/ folder (D-018: personal offline use only) at `cards/<SET>/<ID>.<ext>`. Release builds
 * (`vite build --mode release`, used by `npm run dist:win`) never include it (D-025); the desktop
 * app loads optional art from a folder next to the executable instead (app/main/main.cjs).
 */
export default defineConfig(({ mode }) => ({
  root: 'app/renderer',
  base: './',
  publicDir: mode === 'release' ? false : '../../assets',
  plugins: [react()],
  build: { outDir: '../../dist/renderer', emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  server: { port: 5173, strictPort: true },
}));
