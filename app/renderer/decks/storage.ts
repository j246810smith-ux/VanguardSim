/**
 * Saved decks (DECISIONS D-022): kept inside the app in local storage (Electron keeps it in the
 * app's data folder). Decks store card IDs only. Import/export as text is in src/decks/text.ts.
 */
import type { DeckList } from '../../../src/engine';

export interface SavedDeck {
  readonly id: string;
  readonly name: string;
  readonly deck: DeckList;
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

export function deleteDeck(id: string): boolean {
  return store(loadDecks().filter((d) => d.id !== id));
}

export const newDeckId = () =>
  `deck-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
