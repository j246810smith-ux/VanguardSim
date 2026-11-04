// Update signing key (D-037): `npm run release:keygen`, once per project. Writes the private key
// outside the repository and the public key into the app. It refuses to replace an existing key:
// copies of the game that are already out only trust the key they shipped with.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const privatePath =
  process.env.VANGUARD_UPDATE_KEY || join(homedir(), '.vanguardsim', 'update-signing-key.pem');
const publicPath = join('app', 'main', 'updatePublicKey.cjs');

for (const p of [privatePath, publicPath]) {
  if (existsSync(p)) {
    console.error(`${p} already exists; not replacing the signing key.`);
    process.exit(1);
  }
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
mkdirSync(dirname(privatePath), { recursive: true });
writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
writeFileSync(
  publicPath,
  `// The public half of the update signing key (D-037), made by \`npm run release:keygen\`.\n` +
    `// The private half stays on the developer's PC and is never committed.\n` +
    `module.exports = { UPDATE_PUBLIC_KEY: '${spki}' };\n`,
);
console.log(`Private key: ${privatePath}`);
console.log(`Public key:  ${publicPath}`);
console.log('Back up the private key. Without it, no copy of the game can be updated in-app.');
