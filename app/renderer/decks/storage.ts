/**
 * Saved decks (DECISIONS D-022): kept inside the app in local storage (Electron keeps it in the
 * app's data folder). Decks store card IDs only. Import/export as text is in src/decks/text.ts.
 */
import type { DeckList, FormatKey } from '../../../src/engine';

export interface SavedDeck {
  readonly id: string;
  readonly name: string;
  readonly deck: DeckList;
  /** The format it is built for (D-034); absent: Classic, or the G era if it has a G deck. */
  readonly format?: FormatKey;
  /** Sleeve id (app/renderer/cosmetics.ts, D-033); absent: the default sleeve from Settings. */
  readonly sleeve?: string;
  /** Playmat id (D-033); absent: the default playmat from Settings. */
  readonly playmat?: string;
  /** When it was last saved (ms since 1970). */
  readonly updated: number;
}

const KEY = 'vanguard-sim.decks.v1';

export function loadDecks(): SavedDeck[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedDeck[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function store(decks: readonly SavedDeck[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(decks));
    return true;
  } catch {
    return false;
  }
}

/** Insert or replace by id; returns false if it could not be written. */
export function saveDeck(deck: SavedDeck): boolean {
  const others = loadDecks().filter((d) => d.id !== deck.id);
  return store([...others, deck].sort((a, b) => a.name.localeCompare(b.name)));
}

/** Replace every saved deck at once (importing a backup, decks/backup.ts). */
export function saveAllDecks(decks: readonly SavedDeck[]): boolean {
  return store(decks);
}

export function deleteDeck(id: string): boolean {
  return store(loadDecks().filter((d) => d.id !== id));
}

export const newDeckId = () =>
  `deck-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

/** A saved deck's format: as recorded, else the G era when it has a G deck. */
export const formatOfSaved = (d: SavedDeck): FormatKey =>
  d.format ?? ((d.deck.gDeck?.length ?? 0) > 0 ? 'g' : 'classic');
