/**
 * Builds the Artwork Manager's main-process files (git-ignored, packaged with the app):
 *   app/main/generated/artwork-manifest.json  one entry per card of the supported sets
 *   app/main/generated/artwork.cjs            src/artwork/service.ts bundled for Node
 * Run by `npm run app` and `npm run dist:win`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { buildManifest } from '../src/artwork/manifest';
import { CARD_DATA_VERSION, SETS } from '../src/cards';

const out = 'app/main/generated';
mkdirSync(out, { recursive: true });
const manifest = buildManifest(
  SETS.map((s) => ({ set: s.file.set, cards: s.file.cards })),
  CARD_DATA_VERSION,
);
writeFileSync(`${out}/artwork-manifest.json`, JSON.stringify(manifest));
await build({
  entryPoints: ['src/artwork/service.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: `${out}/artwork.cjs`,
  logLevel: 'warning',
});
console.log(`artwork: ${manifest.entries.length} cards (${CARD_DATA_VERSION}) → ${out}`);
