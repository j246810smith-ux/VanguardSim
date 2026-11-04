// Check a published release the way the game will (D-037 stage 5): `npm run release:verify 0.29.0-alpha`
// straight after publishing. It reads the manifest and signature from the release, checks them with
// the key in the game, and downloads both packages to compare them with the manifest. The usual
// mistake it catches: signing one build of the zip and uploading another, which would tell every
// player their download is damaged.
//
// --base <url> reads from that address instead of GitHub (used by the tests).
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const m = require('../app/main/updateManifest.cjs');
const { OWNER, REPO } = require('../app/main/updates.cjs');

class Refused extends Error {}
const fail = (text) => {
  throw new Refused(text);
};

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { base: { type: 'string' } },
});
async function main() {
  const version = (positionals[0] ?? '').replace(/^v/, '');
  if (!version) fail('which version? npm run release:verify 0.29.0-alpha');

  const official = `https://github.com/${OWNER}/${REPO}/releases/download`;
  const where = (url) => (opts.base ? url.replace(official, opts.base) : url);

  async function fetchOk(url) {
    const res = await globalThis.fetch(where(url));
    if (res.status === 404) fail(`${url} is not on the release`);
    if (!res.ok) fail(`${url} answered ${res.status}`);
    return res;
  }
  const bytesOf = async (asset) =>
    Buffer.from(await (await fetchOk(m.assetUrl(version, asset))).arrayBuffer());

  const bytes = await bytesOf('manifest.json');
  const signature = (await bytesOf('manifest.json.sig')).toString('utf8');
  const read = m.readSignedManifest({
    bytes,
    signature,
    expectedVersion: version,
    ...(process.env.VANGUARD_UPDATE_PUBLIC_KEY
      ? { publicKey: process.env.VANGUARD_UPDATE_PUBLIC_KEY }
      : {}),
  });
  if (!read.ok) fail(read.error);
  console.log(`Manifest for ${version}: signature good, ${read.manifest.files.length} files`);
  if (!read.manifest.files.some((f) => f.path === 'VanguardUpdater.exe' && f.group === 'app'))
    fail(
      'the manifest does not list the updater in the app package, so the game cannot install it',
    );

  for (const [name, pack] of Object.entries(read.manifest.packages)) {
    const res = await fetchOk(pack.url);
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of res.body) {
      hash.update(chunk);
      size += chunk.length;
    }
    if (size !== pack.size) fail(`${pack.asset} is ${size} bytes, the manifest says ${pack.size}`);
    if (hash.digest('hex') !== pack.sha256)
      fail(`${pack.asset} does not match the manifest: it is not the zip that was signed`);
    console.log(`Package ${name}: ${pack.asset} matches`);
  }
  console.log('This release can be installed from inside the game.');
}

try {
  await main();
} catch (e) {
  if (!(e instanceof Refused)) throw e;
  console.error(`release:verify: ${e.message}`);
  // not process.exit: right after fetch it crashes Node on Windows
  process.exitCode = 1;
}
