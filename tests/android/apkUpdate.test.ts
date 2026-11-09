import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { checkApkUpdate, compareReleases, pickLatestApk } from '../../app/renderer/android/apkUpdate';
import type { HttpPlugin } from '../../app/renderer/android/native';

const require = createRequire(import.meta.url);
const windows = require('../../app/main/updates.cjs') as {
  pickLatest: (r: unknown, ch: string) => { version: string } | null;
  compareReleases: (a: string, b: string) => number;
};

const DL = 'https://github.com/j246810smith-ux/VanguardSim/releases/download';
const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: `Vanguard Sim ${tag}`,
  body: '### New\n- something',
  html_url: `https://github.com/j246810smith-ux/VanguardSim/releases/tag/${tag}`,
  assets: [
    {
      name: `VanguardSim-${tag.slice(1)}-android.apk`,
      browser_download_url: `${DL}/${tag}/VanguardSim-${tag.slice(1)}-android.apk`,
      size: 17_000_000,
      digest: `sha256:${'ab'.repeat(32)}`,
    },
  ],
  ...extra,
});

const LIST = [
  release('v0.34.0-alpha'),
  release('v0.36.0-preview.1'),
  release('v0.35.0-alpha'),
  release('v0.37.0-alpha', { draft: true }),
  release('not-a-version'),
  release('v0.33.0-alpha'),
];

describe('Android updates: picking the release', () => {
  it('picks the same release as the Windows Update Manager on both channels', () => {
    for (const ch of ['stable', 'preview'] as const)
      expect(pickLatestApk(LIST, ch)?.version).toBe(windows.pickLatest(LIST, ch)?.version);
    expect(pickLatestApk(LIST, 'stable')?.version).toBe('0.35.0-alpha');
    expect(pickLatestApk(LIST, 'preview')?.version).toBe('0.36.0-preview.1');
  });

  it('orders versions as Windows does', () => {
    const v = ['0.29.0-preview.2', '0.29.0-alpha', '0.29.0', '0.30.0-alpha', '0.29.1-alpha', '1.0.0'];
    for (const a of v) for (const b of v) expect(Math.sign(compareReleases(a, b))).toBe(Math.sign(windows.compareReleases(a, b)));
  });

  it('finds the APK with its size and checksum', () => {
    expect(pickLatestApk(LIST, 'stable')?.apk).toEqual({
      url: `${DL}/v0.35.0-alpha/VanguardSim-0.35.0-alpha-android.apk`,
      size: 17_000_000,
      sha256: 'ab'.repeat(32),
    });
  });

  it('never offers a download from anywhere but the official repository', () => {
    const r = release('v0.35.0-alpha');
    (r.assets[0] as { browser_download_url: string }).browser_download_url =
      'https://example.com/VanguardSim-0.35.0-alpha-android.apk';
    expect(pickLatestApk([r], 'stable')?.apk).toBeNull();
  });

  it('a release without an Android app has no APK', () => {
    expect(pickLatestApk([release('v0.35.0-alpha', { assets: [] })], 'stable')?.apk).toBeNull();
  });
});

describe('Android updates: the check', () => {
  const http = (status: number, data: unknown): HttpPlugin =>
    ({ request: async () => ({ status, data, headers: {} }) }) as unknown as HttpPlugin;

  it('says when a newer version is available, and when this one is the newest', async () => {
    expect(await checkApkUpdate(http(200, LIST), 'stable', '0.34.0-alpha')).toMatchObject({
      ok: true,
      available: true,
      latest: { version: '0.35.0-alpha' },
    });
    expect(await checkApkUpdate(http(200, LIST), 'stable', '0.35.0-alpha')).toMatchObject({
      ok: true,
      available: false,
    });
  });

  it('explains GitHub errors and a missing connection', async () => {
    expect(await checkApkUpdate(http(403, null), 'stable', '0.34.0-alpha')).toMatchObject({ ok: false });
    const offline = { request: async () => Promise.reject(new Error('x')) } as unknown as HttpPlugin;
    expect(await checkApkUpdate(offline, 'stable', '0.34.0-alpha')).toEqual({
      ok: false,
      error: 'Could not reach GitHub. Check your internet connection.',
    });
  });
});
