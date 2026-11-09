import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Regression (2026-11-08): the manifest had no INTERNET permission, so on the phone every card
// failed with "Permission denied (missing INTERNET permission?)" while the tests passed.
describe('the Android manifest', () => {
  it('asks for INTERNET, which Settings → Download card art needs', () => {
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).toMatch(/<uses-permission\s+android:name="android\.permission\.INTERNET"\s*\/>/);
  });
});
