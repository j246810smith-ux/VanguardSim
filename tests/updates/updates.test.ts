// Vanguard Update Manager stage 1 (D-037): version comparison, channels and the GitHub lookup.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface Latest {
  version: string;
  name: string;
  date: string | null;
  notes: string;
  page: string;
  preview: boolean;
}
type Check =
  | { ok: true; current: string; channel: string; latest: Latest; available: boolean }
  | { ok: false; error: string };

const require = createRequire(import.meta.url);
const u = require('../../app/main/updates.cjs') as {
  API: string;
  RELEASES_PAGE: string;
  parseVersion: (s: unknown) => unknown;
  compareVersions: (a: string, b: string) => number;
  compareReleases: (a: string, b: string) => number;
  pickLatest: (releases: unknown, channel: string) => Latest | null;
  isReleasePage: (url: unknown) => boolean;
  feedbackUrl: (version: string) => string;
  checkForUpdates: (o: {
    currentVersion: string;
    channel: string;
    fetchFn: (url: string, init?: RequestInit) => Promise<Response>;
    timeoutMs?: number;
  }) => Promise<Check>;
};

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: `Vanguard Sim ${tag}`,
  draft: false,
  prerelease: true,
  published_at: '2026-11-03T10:00:00Z',
  body: `## Vanguard Sim ${tag}\n\n- something new`,
  html_url: `${u.RELEASES_PAGE}/tag/${tag}`,
  ...extra,
});

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('version comparison', () => {
  const sorted = [
    '0.9.0',
    '0.27.0-alpha',
    '0.27.1-alpha',
    '0.28.0-alpha',
    '0.28.0-alpha.2',
    '0.28.0-beta',
    '0.28.0-preview.1',
    '0.28.0-preview.2',
    '0.28.0-preview.10',
    '0.28.0',
    '0.29.0-alpha',
    '1.0.0',
  ];
  it('orders versions by semantic-versioning precedence', () => {
    for (let i = 0; i < sorted.length; i++)
      for (let j = 0; j < sorted.length; j++)
        expect(Math.sign(u.compareVersions(sorted[i]!, sorted[j]!))).toBe(Math.sign(i - j));
  });
  it('accepts a leading v and build metadata; rejects anything else', () => {
    expect(u.compareVersions('v0.28.0-alpha', '0.28.0-alpha')).toBe(0);
    expect(u.compareVersions('0.28.0+build.5', '0.28.0')).toBe(0);
    for (const bad of ['', '0.28', 'latest', '0.28.0-', '../0.1.0', 28, null])
      expect(u.parseVersion(bad)).toBeNull();
    expect(() => u.compareVersions('0.28', '0.28.0')).toThrow();
  });
});

describe('release order (previews before their release)', () => {
  it('a preview of x.y.z is older than the normal x.y.z release, newer than earlier ones', () => {
    expect(u.compareReleases('0.29.0-preview.2', '0.29.0-alpha')).toBeLessThan(0);
    expect(u.compareReleases('0.29.0-preview.1', '0.28.0-alpha')).toBeGreaterThan(0);
    expect(u.compareReleases('0.29.0-preview.2', '0.29.0-preview.10')).toBeLessThan(0);
    expect(u.compareReleases('0.29.0-alpha', '0.29.0-alpha')).toBe(0);
  });
});

describe('picking the newest release', () => {
  const list = [
    release('v0.28.0-alpha'),
    release('v0.29.0-preview.1'),
    release('v0.30.0-alpha', { draft: true }),
    release('not-a-version'),
    release('v0.27.1-alpha'),
  ];
  it('stable skips drafts, previews and tags that are not versions', () => {
    expect(u.pickLatest(list, 'stable')?.version).toBe('0.28.0-alpha');
  });
  it('preview also offers preview releases', () => {
    const p = u.pickLatest(list, 'preview');
    expect(p?.version).toBe('0.29.0-preview.1');
    expect(p?.preview).toBe(true);
  });
  it('preview still offers a stable release that is newer than every preview', () => {
    expect(u.pickLatest([...list, release('v0.29.0-alpha')], 'preview')?.version).toBe(
      '0.29.0-alpha',
    );
  });
  it('never hands on a page outside the official repository', () => {
    const evil = release('v0.28.0-alpha', { html_url: 'https://example.com/malware' });
    expect(u.pickLatest([evil], 'stable')?.page).toBe(u.RELEASES_PAGE);
    expect(u.isReleasePage('https://example.com/x')).toBe(false);
    expect(u.isReleasePage(`${u.RELEASES_PAGE}evil.com`)).toBe(false);
    expect(u.isReleasePage(`${u.RELEASES_PAGE}/tag/v0.28.0-alpha`)).toBe(true);
  });
  it('handles an empty or broken answer', () => {
    expect(u.pickLatest([], 'stable')).toBeNull();
    expect(u.pickLatest({ message: 'Not Found' }, 'stable')).toBeNull();
    expect(u.pickLatest([null, 5, release('v1.0.0', { name: '' })], 'stable')?.name).toBe('v1.0.0');
  });
});

describe('checking for updates', () => {
  const list = [release('v0.28.0-alpha'), release('v0.29.0-preview.1'), release('v0.27.1-alpha')];
  const fetchList = (url: string) => {
    expect(url).toBe(u.API);
    expect(url.startsWith('https://')).toBe(true);
    return json(list);
  };

  it('reports no update when the newest release is installed', async () => {
    const r = await u.checkForUpdates({
      currentVersion: '0.28.0-alpha',
      channel: 'stable',
      fetchFn: fetchList,
    });
    expect(r).toMatchObject({ ok: true, available: false, channel: 'stable' });
  });
  it('reports a newer stable release', async () => {
    const r = await u.checkForUpdates({
      currentVersion: '0.27.1-alpha',
      channel: 'stable',
      fetchFn: fetchList,
    });
    expect(r).toMatchObject({ ok: true, available: true, latest: { version: '0.28.0-alpha' } });
  });
  it('offers the preview only on the preview channel', async () => {
    const r = await u.checkForUpdates({
      currentVersion: '0.28.0-alpha',
      channel: 'preview',
      fetchFn: fetchList,
    });
    expect(r).toMatchObject({ ok: true, available: true, latest: { version: '0.29.0-preview.1' } });
  });
  it('a newer installed build (development copy) is not offered an older release', async () => {
    const r = await u.checkForUpdates({
      currentVersion: '0.30.0-alpha',
      channel: 'preview',
      fetchFn: fetchList,
    });
    expect(r).toMatchObject({ ok: true, available: false });
  });
  it('a preview player is offered the final release of that version', async () => {
    const final = [release('v0.29.0-alpha'), release('v0.29.0-preview.1')];
    for (const channel of ['stable', 'preview']) {
      const r = await u.checkForUpdates({
        currentVersion: '0.29.0-preview.1',
        channel,
        fetchFn: () => json(final),
      });
      expect(r).toMatchObject({ ok: true, available: true, latest: { version: '0.29.0-alpha' } });
    }
  });
  it('an unknown channel falls back to stable', async () => {
    const r = await u.checkForUpdates({
      currentVersion: '0.28.0-alpha',
      channel: 'nightly',
      fetchFn: fetchList,
    });
    expect(r).toMatchObject({ ok: true, channel: 'stable', available: false });
  });
  it('explains network failures, timeouts, rate limits and bad answers without throwing', async () => {
    const base = { currentVersion: '0.28.0-alpha', channel: 'stable' };
    const offline = await u.checkForUpdates({
      ...base,
      fetchFn: () => Promise.reject(new TypeError('fetch failed')),
    });
    expect(offline).toMatchObject({
      ok: false,
      error: expect.stringContaining('Could not reach GitHub'),
    });
    const slow = await u.checkForUpdates({
      ...base,
      timeoutMs: 20,
      fetchFn: (_url, init) =>
        new Promise((_res, rej) =>
          init?.signal?.addEventListener('abort', () => rej(init.signal!.reason)),
        ),
    });
    expect(slow).toMatchObject({ ok: false, error: expect.stringContaining('in time') });
    const limited = await u.checkForUpdates({ ...base, fetchFn: () => json({}, 403) });
    expect(limited).toMatchObject({ ok: false, error: expect.stringContaining('limiting') });
    const broken = await u.checkForUpdates({
      ...base,
      fetchFn: () => Promise.resolve(new Response('<html>', { status: 200 })),
    });
    expect(broken).toMatchObject({ ok: false, error: expect.stringContaining('could not read') });
    const none = await u.checkForUpdates({ ...base, fetchFn: () => json([]) });
    expect(none).toMatchObject({
      ok: false,
      error: expect.stringContaining('No published release'),
    });
    const notFound = await u.checkForUpdates({ ...base, fetchFn: () => json({}, 404) });
    expect(notFound).toMatchObject({ ok: false, error: expect.stringContaining('404') });
  });
  it('refuses to compare when the installed version is not a version', async () => {
    const r = await u.checkForUpdates({
      currentVersion: 'dev',
      channel: 'stable',
      fetchFn: fetchList,
    });
    expect(r.ok).toBe(false);
  });
});

describe('feedback link', () => {
  it('opens the official new-issue page with the version for the form', () => {
    expect(u.feedbackUrl('0.29.0-alpha')).toBe(
      'https://github.com/j246810smith-ux/VanguardSim/issues/new/choose?version=0.29.0-alpha',
    );
  });

  it('cannot be led elsewhere by an odd version', () => {
    expect(u.feedbackUrl('1.0.0&title=x#y')).toMatch(/\?version=1\.0\.0%26title%3Dx%23y$/);
  });
});
