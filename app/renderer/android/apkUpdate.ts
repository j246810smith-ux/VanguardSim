/**
 * Updating the Android app from inside it (Settings → Updates): find the newest release on the
 * official GitHub repository with the same rules as the Windows Update Manager (app/main/updates.cjs:
 * drafts skipped, previews only on the Preview channel; tests/android/apkUpdate.test.ts checks the
 * two agree), then its `VanguardSim-<version>-android.apk`. The download, its checks and the install
 * are native (ApkUpdatePlugin.java); Android asks the player to confirm the install and accepts only
 * an APK signed with the game's own key.
 */
import type { HttpPlugin } from './native';

/** As settings.tsx UpdateChannel (kept here so the root tests can import this file). */
export type UpdateChannel = 'stable' | 'preview';

export const OWNER = 'j246810smith-ux';
export const REPO = 'VanguardSim';
export const API = `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=30`;

declare const __APP_VERSION__: string | undefined;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';

interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly pre: readonly string[];
}

export function parseVersion(text: unknown): Version | null {
  if (typeof text !== 'string') return null;
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(text.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split('.') : [],
  };
}

function compareVersions(x: Version, y: Version): number {
  for (const k of ['major', 'minor', 'patch'] as const) if (x[k] !== y[k]) return x[k] - y[k];
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) {
      if (Number(p) !== Number(q)) return Number(p) - Number(q);
    } else if (pn !== qn) return pn ? -1 : 1;
    else if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

const isPreview = (v: Version) => v.pre.some((p) => p.toLowerCase() === 'preview');

/** As app/main/updates.cjs compareReleases: a preview of x.y.z ranks below every normal x.y.z. */
export function compareReleases(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) throw new Error(`Not a version: ${!x ? a : b}`);
  for (const k of ['major', 'minor', 'patch'] as const) if (x[k] !== y[k]) return x[k] - y[k];
  if (isPreview(x) !== isPreview(y)) return isPreview(x) ? -1 : 1;
  return compareVersions(x, y);
}

export interface ApkRelease {
  readonly version: string;
  readonly name: string;
  readonly notes: string;
  readonly page: string;
  /** null: the release has no Android app attached. */
  readonly apk: { readonly url: string; readonly size: number; readonly sha256: string } | null;
}

interface GitHubAsset {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
  digest?: unknown;
}
interface GitHubRelease {
  draft?: unknown;
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  html_url?: unknown;
  assets?: unknown;
}

const RELEASES_PAGE = `https://github.com/${OWNER}/${REPO}/releases`;
const DOWNLOAD_PREFIX = `https://github.com/${OWNER}/${REPO}/releases/download/`;

/** The newest release for a channel, with its APK when it has one (same rules as Windows). */
export function pickLatestApk(releases: unknown, channel: UpdateChannel): ApkRelease | null {
  if (!Array.isArray(releases)) return null;
  let best: { tag: string; r: GitHubRelease } | null = null;
  for (const r of releases as GitHubRelease[]) {
    if (!r || typeof r !== 'object' || r.draft) continue;
    const v = parseVersion(r.tag_name);
    if (!v) continue;
    if (channel !== 'preview' && isPreview(v)) continue;
    if (!best || compareReleases(String(r.tag_name), best.tag) > 0)
      best = { tag: String(r.tag_name), r };
  }
  if (!best) return null;
  const version = best.tag.replace(/^v/, '');
  const r = best.r;
  const file = `VanguardSim-${version}-android.apk`;
  const asset = Array.isArray(r.assets)
    ? (r.assets as GitHubAsset[]).find((a) => a && a.name === file)
    : undefined;
  const url = typeof asset?.browser_download_url === 'string' ? asset.browser_download_url : '';
  const sha = typeof asset?.digest === 'string' ? /^sha256:([0-9a-f]{64})$/i.exec(asset.digest) : null;
  return {
    version,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : best.tag,
    notes: typeof r.body === 'string' ? r.body.slice(0, 20000) : '',
    page:
      typeof r.html_url === 'string' && r.html_url.startsWith(`${RELEASES_PAGE}/`)
        ? r.html_url
        : RELEASES_PAGE,
    // only the official repository's release downloads
    apk:
      asset && url.startsWith(DOWNLOAD_PREFIX)
        ? { url, size: typeof asset.size === 'number' ? asset.size : 0, sha256: sha?.[1] ?? '' }
        : null,
  };
}

export type ApkCheck =
  | { readonly ok: true; readonly latest: ApkRelease; readonly available: boolean }
  | { readonly ok: false; readonly error: string };

/** Looks up the newest release; never throws. */
export async function checkApkUpdate(
  http: HttpPlugin,
  channel: UpdateChannel,
  current: string = APP_VERSION,
): Promise<ApkCheck> {
  let res;
  try {
    res = await http.request({
      url: API,
      method: 'GET',
      responseType: 'json',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'VanguardSim-Updater' },
      connectTimeout: 15000,
      readTimeout: 15000,
    });
  } catch {
    return { ok: false, error: 'Could not reach GitHub. Check your internet connection.' };
  }
  if (res.status === 403 || res.status === 429)
    return { ok: false, error: 'GitHub is limiting requests right now. Try again in an hour.' };
  if (res.status !== 200) return { ok: false, error: `GitHub answered with an error (${res.status}).` };
  const latest = pickLatestApk(res.data, channel);
  if (!latest) return { ok: false, error: 'No release was found on GitHub.' };
  const available = parseVersion(current) ? compareReleases(latest.version, current) > 0 : false;
  return { ok: true, latest, available };
}
