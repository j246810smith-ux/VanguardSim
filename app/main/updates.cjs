// Vanguard Update Manager, stage 1 (D-037): look up the newest published release on GitHub and
// show it in the game. Read-only: nothing is downloaded or installed here (later stages add a
// signed manifest and a separate updater program). Runs in the main process; the game window
// stays offline (D-004) and only receives the result.
//
// Channels:
//   - stable  (default): every published release except previews,
//   - preview (opt-in):  also releases whose version has a "preview" part, e.g. 0.29.0-preview.1.
// "alpha" / "beta" in a version name are the project's development stage, not a channel: the
// whole game is in alpha, so stable alpha releases are what ordinary players get.

const OWNER = 'j246810smith-ux';
const REPO = 'VanguardSim';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=30`;
const RELEASES_PAGE = `https://github.com/${OWNER}/${REPO}/releases`;
const CHANNELS = ['stable', 'preview'];
const TIMEOUT_MS = 15000;

/** `0.28.0-alpha` / `v0.28.0-alpha` → parts, or null when it is not a semantic version. */
function parseVersion(text) {
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

/** Semantic Versioning 2.0.0 precedence: negative when a < b, 0 when equal, positive when a > b. */
function compareVersions(a, b) {
  const x = typeof a === 'string' ? parseVersion(a) : a;
  const y = typeof b === 'string' ? parseVersion(b) : b;
  if (!x || !y) throw new Error(`Not a version: ${!x ? a : b}`);
  for (const k of ['major', 'minor', 'patch']) if (x[k] !== y[k]) return x[k] - y[k];
  // a version without a pre-release part ranks above the same version with one
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

const isPreview = (v) => v.pre.some((p) => p.toLowerCase() === 'preview');

/**
 * Which of two releases is newer for the Update Manager. Like `compareVersions`, except that a
 * preview of x.y.z ranks below every normal x.y.z release: 0.29.0-preview.2 comes before
 * 0.29.0-alpha, although plain semantic versioning sorts "preview" after "alpha".
 */
function compareReleases(a, b) {
  const x = typeof a === 'string' ? parseVersion(a) : a;
  const y = typeof b === 'string' ? parseVersion(b) : b;
  if (!x || !y) throw new Error(`Not a version: ${!x ? a : b}`);
  for (const k of ['major', 'minor', 'patch']) if (x[k] !== y[k]) return x[k] - y[k];
  const px = isPreview(x);
  const py = isPreview(y);
  if (px !== py) return px ? -1 : 1;
  return compareVersions(x, y);
}

/**
 * The official repository's "new issue" page: the player picks a form, fills it in and posts it
 * there. GitHub passes `version` on to the chosen form's field of that id. The game sends nothing.
 */
const feedbackUrl = (version) =>
  `https://github.com/${OWNER}/${REPO}/issues/new/choose?version=${encodeURIComponent(version)}`;

/** Only release pages of the official repository may be opened from the game. */
const isReleasePage = (url) =>
  typeof url === 'string' && (url === RELEASES_PAGE || url.startsWith(`${RELEASES_PAGE}/`));

/**
 * The newest release for a channel from GitHub's release list (already parsed JSON). Drafts,
 * releases without a version tag and (on stable) previews are skipped.
 */
function pickLatest(releases, channel) {
  if (!Array.isArray(releases)) return null;
  let best = null;
  for (const r of releases) {
    if (!r || typeof r !== 'object' || r.draft) continue;
    const v = parseVersion(r.tag_name);
    if (!v) continue;
    if (channel !== 'preview' && isPreview(v)) continue;
    if (!best || compareReleases(v, best.v) > 0) best = { v, r };
  }
  if (!best) return null;
  const r = best.r;
  return {
    version: String(r.tag_name).replace(/^v/, ''),
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : String(r.tag_name),
    date: typeof r.published_at === 'string' ? r.published_at : null,
    notes: typeof r.body === 'string' ? r.body.slice(0, 20000) : '',
    page: isReleasePage(r.html_url) ? r.html_url : RELEASES_PAGE,
    preview: isPreview(best.v),
  };
}

/**
 * `fetchFn(url, init)` is Electron's `net.fetch` in the app and a stub in tests. Returns
 * `{ ok: true, current, channel, latest, available }` or `{ ok: false, error }`; never throws.
 */
async function checkForUpdates({ currentVersion, channel, fetchFn, timeoutMs = TIMEOUT_MS }) {
  const ch = CHANNELS.includes(channel) ? channel : 'stable';
  if (!parseVersion(currentVersion))
    return { ok: false, error: `This copy has no valid version number (${currentVersion}).` };
  let res;
  try {
    res = await fetchFn(API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'VanguardSim-Updater' },
      signal: globalThis.AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return {
      ok: false,
      error: timedOut
        ? 'GitHub did not answer in time. Check your internet connection and try again.'
        : 'Could not reach GitHub. Check your internet connection and try again.',
    };
  }
  if (res.status === 403 || res.status === 429)
    return { ok: false, error: 'GitHub is limiting requests right now. Try again in an hour.' };
  if (!res.ok) return { ok: false, error: `GitHub answered with an error (${res.status}).` };
  let list;
  try {
    list = await res.json();
  } catch {
    return { ok: false, error: 'GitHub sent an answer the game could not read.' };
  }
  const latest = pickLatest(list, ch);
  if (!latest) return { ok: false, error: 'No published release was found.' };
  return {
    ok: true,
    current: currentVersion,
    channel: ch,
    latest,
    available: compareReleases(latest.version, currentVersion) > 0,
  };
}

module.exports = {
  OWNER,
  REPO,
  API,
  RELEASES_PAGE,
  CHANNELS,
  parseVersion,
  compareVersions,
  compareReleases,
  pickLatest,
  checkForUpdates,
  isReleasePage,
  feedbackUrl,
};
