/**
 * Backing up all saved decks to one file and reading them back (U9). Saved decks live in local
 * storage, which uninstalling the Android app (or clearing its data) wipes, so players need a copy
 * they can keep. Each deck is stored as data, plus its text list (src/decks/text.ts) so the file
 * is also readable by people and by any deck importer.
 */
import { exportDeck } from '../../../src/decks/text';
import type { CardRegistry, DeckList } from '../../../src/engine';
import type { SavedDeck } from './storage';

export const BACKUP_KIND = 'vanguard-sim.decks';
export const BACKUP_VERSION = 1;

interface BackupFile {
  readonly kind: typeof BACKUP_KIND;
  readonly version: number;
  readonly exported: string;
  readonly decks: readonly (SavedDeck & { readonly text?: string })[];
}

export function backupText(decks: readonly SavedDeck[], registry: CardRegistry, now: Date): string {
  const file: BackupFile = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exported: now.toISOString(),
    decks: decks.map((d) => ({ ...d, text: exportDeck(d.name, d.deck, registry) })),
  };
  return JSON.stringify(file, null, 2);
}

/** `vanguard-sim-decks-2026-11-07.json` */
export const backupFileName = (now: Date) =>
  `vanguard-sim-decks-${now.toISOString().slice(0, 10)}.json`;

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

function readDeck(raw: unknown): SavedDeck | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const deck = r.deck as Record<string, unknown> | undefined;
  if (typeof r.id !== 'string' || !r.id || typeof r.name !== 'string') return null;
  if (typeof deck !== 'object' || deck === null) return null;
  const { firstVanguard, cards, gDeck } = deck;
  if (typeof firstVanguard !== 'string' || !isStrings(cards)) return null;
  if (gDeck !== undefined && !isStrings(gDeck)) return null;
  const list: DeckList = {
    firstVanguard,
    cards,
    ...(isStrings(gDeck) ? { gDeck } : {}),
  };
  return {
    id: r.id,
    name: r.name,
    deck: list,
    ...(r.format === 'classic' || r.format === 'classic_ou' || r.format === 'g'
      ? { format: r.format }
      : {}),
    ...(typeof r.sleeve === 'string' ? { sleeve: r.sleeve } : {}),
    ...(typeof r.playmat === 'string' ? { playmat: r.playmat } : {}),
    updated: typeof r.updated === 'number' ? r.updated : 0,
  };
}

export interface ReadBackup {
  readonly decks: readonly SavedDeck[];
  /** Why the file, or some decks in it, could not be read. */
  readonly problems: readonly string[];
}

export function readBackup(text: string): ReadBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { decks: [], problems: ['This is not a deck backup file.'] };
  }
  const file = parsed as Partial<BackupFile> | null;
  if (!file || file.kind !== BACKUP_KIND || !Array.isArray(file.decks))
    return { decks: [], problems: ['This is not a deck backup file.'] };
  if (typeof file.version !== 'number' || file.version > BACKUP_VERSION)
    return { decks: [], problems: ['This backup is from a newer version of the game.'] };
  const decks: SavedDeck[] = [];
  let skipped = 0;
  for (const raw of file.decks) {
    const d = readDeck(raw);
    if (d) decks.push(d);
    else skipped++;
  }
  return {
    decks,
    problems: skipped ? [`${skipped} deck${skipped === 1 ? '' : 's'} could not be read.`] : [],
  };
}

export interface Merge {
  /** Decks not saved here yet. */
  readonly added: readonly SavedDeck[];
  /** Decks saved here under the same id, but different now: replaced only if the player agrees. */
  readonly replacing: readonly SavedDeck[];
}

const same = (a: SavedDeck, b: SavedDeck) =>
  JSON.stringify({ ...a, updated: 0 }) === JSON.stringify({ ...b, updated: 0 });

/** Merge by id: what is new, and what would replace a saved deck (identical copies are ignored). */
export function planMerge(saved: readonly SavedDeck[], incoming: readonly SavedDeck[]): Merge {
  const byId = new Map(saved.map((d) => [d.id, d]));
  const added: SavedDeck[] = [];
  const replacing: SavedDeck[] = [];
  for (const d of incoming) {
    const old = byId.get(d.id);
    if (!old) added.push(d);
    else if (!same(old, d)) replacing.push(d);
  }
  return { added, replacing };
}

/** The saved decks after the merge, sorted by name like storage.ts keeps them. */
export function applyMerge(
  saved: readonly SavedDeck[],
  merge: Merge,
  replace: boolean,
): SavedDeck[] {
  const incoming = [...merge.added, ...(replace ? merge.replacing : [])];
  const ids = new Set(incoming.map((d) => d.id));
  return [...saved.filter((d) => !ids.has(d.id)), ...incoming].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
