/**
 * The artwork manifest (Artwork Manager): one entry per card of the supported sets, built from the
 * card database (the authority for card IDs). Pure: no file system, no network.
 *
 * Images live in the game's existing layout, `<SET>/<CARD-ID>.<png|jpg>` (e.g. `BT01/BT01-001.png`,
 * `TD01/TD01-001.jpg`), inside the game's `cards\` folder (app/main/main.cjs).
 */
import type { CardRecord } from '../cards/record';

/** Image formats the game loads, in the order it tries them. */
export const IMAGE_EXTENSIONS = ['png', 'jpg'] as const;
export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

export interface ManifestEntry {
  /** Card ID as the game uses it, e.g. "BT01-001". */
  readonly id: string;
  /** Set or trial deck, e.g. "BT01", "TD03": also the sub-folder. */
  readonly set: string;
  readonly name: string;
  /**
   * Image paths given by the card database for each official source, relative to that site
   * (e.g. "/wordpress/…/BT01_001EN.png"). Absent when the database has none.
   */
  readonly images: { readonly en?: string; readonly jp?: string };
  /**
   * The English printing's number (e.g. "BT16/007EN"), when it differs from the card ID: English
   * BT03–BT06, BT16, BT17 and EB03 number many cards differently from the Japanese sets.
   */
  readonly enNumber?: string;
}

export interface ArtworkManifest {
  readonly format: 'vanguard-sim-artwork-manifest';
  readonly version: 1;
  /** The card-database version the manifest was built from. */
  readonly cardData: string;
  readonly entries: readonly ManifestEntry[];
}

export interface SetData {
  readonly set: string;
  readonly cards: readonly CardRecord[];
}

export function buildManifest(sets: readonly SetData[], cardData: string): ArtworkManifest {
  const entries: ManifestEntry[] = [];
  for (const s of sets) {
    for (const c of s.cards) {
      const images: { en?: string; jp?: string } = {};
      if (c.en?.image) images.en = c.en.image;
      if (c.jp?.image) images.jp = c.jp.image;
      const enNumber = c.en?.number;
      entries.push({
        id: c.id,
        set: s.set,
        name: (c.en ?? c.jp)!.name,
        images,
        ...(enNumber && englishId(enNumber) !== c.id ? { enNumber } : {}),
      });
    }
  }
  return { format: 'vanguard-sim-artwork-manifest', version: 1, cardData, entries };
}

/** The file of a card's image inside the artwork folder (forward slashes). */
export const imagePath = (id: string, ext: ImageExtension): string =>
  `${id.replace(/-(\d{3}(EN)?|\d{4}[A-Z]?)$/, '')}/${id}.${ext}`;

const SET_KINDS = ['BT', 'TD', 'EB', 'FC', 'DG', 'MBT', 'MTD', 'PR', 'VZ'];
/** Classic kinds in order, then the G era's products (G-BT, G-TD, …, DECISIONS D-034). */
const kindOf = (set: string) => {
  const kind = set.replace(/\d+$/, '');
  return kind.startsWith('G-') ? SET_KINDS.length + 1 : SET_KINDS.indexOf(kind);
};

/** Sets in the manifest: boosters, trial decks, then the side sets, each in number order. */
export function setsOf(manifest: ArtworkManifest): string[] {
  return [...new Set(manifest.entries.map((e) => e.set))].sort(
    (a, b) => kindOf(a) - kindOf(b) || a.localeCompare(b),
  );
}

/** "BT16/007EN" → "BT16-007EN": the ID an English number would have if it were the card ID. */
const englishId = (number: string): string => number.replace('/', '-');

/**
 * English numbers ("BT16-007") → card ID, for every card whose English printing has a different
 * number than its ID. A number printed for several cards (reprints) goes to the card of that set.
 */
export function englishNumbers(manifest: ArtworkManifest): Map<string, string> {
  // cards printed in English under their own ID keep it ("BT01_021EN" stays BT01-021, not the
  // FC01 reprint)
  const ownNumber = new Set(manifest.entries.filter((e) => !e.enNumber).map((e) => e.id));
  const out = new Map<string, string>();
  for (const e of manifest.entries) {
    if (!e.enNumber) continue;
    const key = englishId(e.enNumber).replace(/EN$/, '');
    if (ownNumber.has(key)) continue;
    const prev = out.get(key);
    if (!prev || (!prev.startsWith(key.slice(0, 4)) && e.id.startsWith(key.slice(0, 4))))
      out.set(key, e.id);
  }
  return out;
}

/**
 * The card ID a user's file name stands for, or null. Accepts the game's own names and the usual
 * official spellings, ignoring case: "BT01-001", "BT01_001", "bt01_001EN", "BT01 001en". Names
 * ending in "EN" are English printing numbers, looked up in `english` (englishNumbers): English
 * "BT16_007EN" is the game's BT16-004. Special printings ("BT01_S01") are not separate cards in the
 * game and are not matched.
 */
export function cardIdFromFileName(
  fileName: string,
  known: ReadonlySet<string> = new Set(),
  english: ReadonlyMap<string, string> = new Map(),
): string | null {
  const stem = fileName.replace(/\.[^.]+$/, '');
  // the Vanguard 0 Start Set: official "VZ_001", the game's "VZ01-001"
  const vz = /^VZ(?:01)?[-_ ]?(\d{3})$/i.exec(stem.trim());
  if (vz) return `VZ01-${vz[1]}`;
  // PR cards: the game's own "PR11-0003"; official "PR_0003" (the Japanese number, in any yearly
  // set) and "PR_0011EN" (the English number, which is unrelated)
  const own = /^PR(\d{2})[-_ ]?(\d{4}[A-Z]?)$/i.exec(stem.trim());
  if (own) return `PR${own[1]}-${own[2]!.toUpperCase()}`;
  const pr = /^PR[-_ ]?(\d{4}[A-Z]?)(EN)?$/i.exec(stem.trim());
  if (pr) {
    const no = pr[1]!.toUpperCase();
    if (pr[2]) return english.get(`PR-${no}`) ?? null;
    return [...known].find((k) => new RegExp(`^PR\\d{2}-${no}$`).test(k)) ?? null;
  }
  // G-era numbers: "G-TD01_001EN", "GTD01-001" (D-034)
  const g = /^G[-_ ]?([A-Z]{2,4})(\d{2})[-_ ]?(\d{3})(EN)?$/i.exec(stem.trim());
  if (g) return `G-${g[1]!.toUpperCase()}${g[2]}-${g[3]}`;
  const m = /^(BT|TD|EB|FC|DG|MBT|MTD|MT)(\d{2})[-_ ]?(\d{3})(EN)?$/i.exec(stem.trim());
  if (!m) return null;
  const id = `${m[1]!.toUpperCase()}${m[2]}-${m[3]}`;
  if (!m[4]) return id;
  const renumbered = english.get(id);
  if (renumbered) return renumbered;
  // English-only cards (D-031) keep the English number in their id: "BT16_001EN" is BT16-001EN
  if (known.has(`${id}EN`)) return `${id}EN`;
  // a card printed in English under another number: this English number is a card not in the
  // game (English BT03's Bloody Calf, "BT03_026EN", is not the game's BT03-026)
  for (const v of english.values()) if (v === id) return null;
  return id;
}
