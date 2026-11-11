/**
 * OU, "Original Era Usable" (six-workstream brief W1; docs/design/SIX_WORKSTREAMS_AUDIT.md
 * section 3): a versioned list of G era cards that may be played in Original Era — Expanded. It is
 * metadata about card ids only: a card keeps its id, set, art and effects, and stays in its G era
 * collection. Only `approved` entries are legal; the list ships with the game and players cannot
 * change it (it is edited in the repository and reviewed by the owner).
 */
import data from '../../../data/ou/ou-list.json';

export type OuStatus = 'approved' | 'proposed' | 'rejected';

export interface OuEntry {
  readonly id: string;
  readonly status: OuStatus;
  /** The list version that added the card ("added through updates"). */
  readonly since: string;
  readonly notes?: string;
}

export interface OuList {
  readonly name: string;
  readonly version: string;
  readonly date: string;
  readonly cards: readonly OuEntry[];
}

const STATUSES: readonly OuStatus[] = ['approved', 'proposed', 'rejected'];

/** A list read from JSON, with anything malformed left out (never thrown at a player). */
export function parseOuList(raw: unknown): OuList {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const cards = Array.isArray(o.cards) ? o.cards : [];
  const seen = new Set<string>();
  const entries: OuEntry[] = [];
  for (const c of cards as Record<string, unknown>[]) {
    if (!c || typeof c.id !== 'string' || seen.has(c.id)) continue;
    if (!STATUSES.includes(c.status as OuStatus)) continue;
    seen.add(c.id);
    entries.push({
      id: c.id,
      status: c.status as OuStatus,
      since: typeof c.since === 'string' ? c.since : String(o.version ?? '1.0'),
      ...(typeof c.notes === 'string' ? { notes: c.notes } : {}),
    });
  }
  return {
    name: typeof o.name === 'string' ? o.name : 'OU Compatibility List',
    version: typeof o.version === 'string' ? o.version : '1.0',
    date: typeof o.date === 'string' ? o.date : '',
    cards: entries,
  };
}

/** The list this build ships with. */
export const OU_LIST: OuList = parseOuList(data);

/** The ids legal in Original Era — Expanded. */
export const ouApproved = (list: OuList = OU_LIST): readonly string[] =>
  list.cards.filter((c) => c.status === 'approved').map((c) => c.id);

/** A card's OU entry, if it has one. */
export const ouEntryOf = (id: string, list: OuList = OU_LIST): OuEntry | undefined =>
  list.cards.find((c) => c.id === id);

/** Script tokens and text that need G era rules (CR 1.48.1): such a card can never be OU. */
const G_SCRIPT = [
  ['"generationBreak"', 'Generation Break'],
  ['"gzone"', 'the G zone'],
  ['"gUnit":true', 'G units'],
  ['heart', 'heart cards'],
  ['stride', 'Stride'],
  ['"hollow"', 'Hollow'],
  ['g_guard', 'G guardians'],
] as const;
const G_TEXT =
  /\bStride\b|Generation Break|\[GB\d|G zone|G guardian|\bheart\b|\bHollow\b|\bG units?\b/i;

/**
 * Why a card cannot be played with the Original Era rules (empty: nothing found). A guard for the
 * OU list: an approved card must have no blockers (tests/engine/ou.test.ts, `npm run ou`).
 */
export function ouBlockers(def: {
  readonly cardType: string;
  readonly abilities: readonly unknown[];
  readonly text?: string;
}): string[] {
  const found = new Set<string>();
  if (def.cardType === 'g_unit') found.add('it is a G unit');
  const script = JSON.stringify(def.abilities);
  for (const [token, what] of G_SCRIPT)
    if (script.includes(token)) found.add(`its script uses ${what}`);
  const m = def.text ? G_TEXT.exec(def.text) : null;
  if (m) found.add(`its text mentions "${m[0]}"`);
  return [...found];
}
