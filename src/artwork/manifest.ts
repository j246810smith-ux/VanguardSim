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
      entries.push({ id: c.id, set: s.set, name: (c.en ?? c.jp)!.name, images });
    }
  }
  return { format: 'vanguard-sim-artwork-manifest', version: 1, cardData, entries };
}

/** The file of a card's image inside the artwork folder (forward slashes). */
export const imagePath = (id: string, ext: ImageExtension): string =>
  `${id.slice(0, id.indexOf('-'))}/${id}.${ext}`;

/** Sets in the manifest, boosters first then trial decks, each in number order. */
export function setsOf(manifest: ArtworkManifest): string[] {
  return [...new Set(manifest.entries.map((e) => e.set))].sort((a, b) =>
    a.slice(0, 2) === b.slice(0, 2) ? a.localeCompare(b) : a.startsWith('BT') ? -1 : 1,
  );
}

/**
 * The card ID a user's file name stands for, or null. Accepts the game's own names and the usual
 * official spellings, ignoring case: "BT01-001", "BT01_001", "bt01_001EN", "BT01 001en". Special
 * printings ("BT01_S01") are not separate cards in the game and are not matched.
 */
export function cardIdFromFileName(fileName: string): string | null {
  const stem = fileName.replace(/\.[^.]+$/, '');
  const m = /^(BT|TD)(\d{2})[-_ ]?(\d{3})(EN)?$/i.exec(stem.trim());
  if (!m) return null;
  return `${m[1]!.toUpperCase()}${m[2]}-${m[3]}`;
}
