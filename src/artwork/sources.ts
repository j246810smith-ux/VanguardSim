/**
 * Artwork download sources (Artwork Manager), kept apart from the download logic. One source is
 * built in (DEFAULT_SOURCES: the official card list, D-027); users may add or override sources in a
 * local `artwork-sources.json` in the game's data folder. Format (docs/ARTWORK.md):
 *
 *   { "sources": [ { "id": "…", "name": "…", "baseUrl": "https://…",
 *                    "images": ["en", "jp"], "delayMs": 500, "attribution": "…" } ] }
 *
 * `images` says which of the card database's image paths to use, in order of preference: the URL
 * is `baseUrl` (or `baseUrls.en` / `baseUrls.jp`, when the two languages are on different sites) +
 * that path, and must stay on that https host.
 */
import type { ManifestEntry } from './manifest';

export interface ArtworkSource {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  /** A different site per language, overriding `baseUrl`. */
  readonly baseUrls?: { readonly en?: string; readonly jp?: string };
  readonly images: readonly ('en' | 'jp')[];
  /** Pause after each request, per download slot (at least 250 ms). */
  readonly delayMs: number;
  readonly attribution?: string;
}

/**
 * Built in (D-027): Bushiroad's official card list, whose image paths the card database records.
 * Used only when the user presses Download in the Artwork Manager; images stay on their PC.
 */
export const DEFAULT_SOURCES: readonly ArtworkSource[] = [
  {
    id: 'official',
    name: 'Official card list (Bushiroad)',
    baseUrl: 'https://en.cf-vanguard.com',
    baseUrls: { en: 'https://en.cf-vanguard.com', jp: 'https://cf-vanguard.com' },
    images: ['en', 'jp'],
    delayMs: 500,
    attribution:
      'Card images © Bushiroad, from the official Cardfight!! Vanguard card list. For personal use on this PC only; please do not share or upload them.',
  },
];

/** The built-in sources, plus the user's own; a user source with a built-in id replaces it. */
export function withDefaults(user: readonly ArtworkSource[]): ArtworkSource[] {
  const ids = new Set(user.map((s) => s.id));
  return [...DEFAULT_SOURCES.filter((s) => !ids.has(s.id)), ...user];
}

export interface SourcesFile {
  readonly sources: readonly ArtworkSource[];
}

/** Reads and checks a sources file; invalid entries are reported, never used. */
export function parseSources(json: string): { sources: ArtworkSource[]; problems: string[] } {
  const problems: string[] = [];
  const sources: ArtworkSource[] = [];
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { sources, problems: ['the sources file is not valid JSON'] };
  }
  const list = (data as { sources?: unknown }).sources;
  if (!Array.isArray(list)) return { sources, problems: ['"sources" must be a list'] };
  for (const [i, raw] of list.entries()) {
    const s = raw as Partial<Record<keyof ArtworkSource, unknown>>;
    const where = `source ${i + 1}`;
    let url: URL | null;
    try {
      url = new URL(String(s.baseUrl));
    } catch {
      url = null;
    }
    const perLanguage: { en?: string; jp?: string } = {};
    let badLanguageUrl = false;
    const raw2 = (s.baseUrls ?? {}) as Record<string, unknown>;
    for (const lang of ['en', 'jp'] as const) {
      if (raw2[lang] === undefined) continue;
      try {
        const u = new URL(String(raw2[lang]));
        if (u.protocol === 'https:') perLanguage[lang] = u.origin;
        else badLanguageUrl = true;
      } catch {
        badLanguageUrl = true;
      }
    }
    const images = Array.isArray(s.images) ? s.images.filter((x) => x === 'en' || x === 'jp') : [];
    if (typeof s.id !== 'string' || !/^[\w-]{1,40}$/.test(s.id))
      problems.push(`${where}: bad "id"`);
    else if (!url || url.protocol !== 'https:' || badLanguageUrl)
      problems.push(`${where}: "baseUrl" must be an https address`);
    else if (images.length === 0) problems.push(`${where}: "images" must list "en" and/or "jp"`);
    else
      sources.push({
        id: s.id,
        name: typeof s.name === 'string' ? s.name : s.id,
        baseUrl: url.origin,
        ...(Object.keys(perLanguage).length ? { baseUrls: perLanguage } : {}),
        images: images as ('en' | 'jp')[],
        delayMs: Math.max(250, Number(s.delayMs) || 500),
        ...(typeof s.attribution === 'string' ? { attribution: s.attribution } : {}),
      });
  }
  return { sources, problems };
}

/** The URLs to try for a card, in order; only same-host https paths from the card database. */
export function imageUrl(source: ArtworkSource, entry: ManifestEntry): string[] {
  const out: string[] = [];
  for (const lang of source.images) {
    const base = source.baseUrls?.[lang] ?? source.baseUrl;
    const host = new URL(base).host;
    const p = entry.images[lang];
    if (!p || !p.startsWith('/') || p.startsWith('//') || p.includes('..') || p.includes('\\'))
      continue;
    const url = new URL(p, base);
    if (url.protocol === 'https:' && url.host === host) out.push(url.toString());
  }
  return out;
}
