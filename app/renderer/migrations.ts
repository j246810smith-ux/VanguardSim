// Vanguard Update Manager, stage 5 (D-037): upgrade the player's saved data when an update changes
// its format. Decks and settings live in local storage, outside the game folder, so an update never
// touches them: a new version must read what the old one wrote. Runs once at start, before anything
// loads. The first format change is the first entry in MIGRATIONS: see docs/RELEASING.md.

/** The saved-data format this version of the game reads and writes. */
export const DATA_VERSION = 1;

/** A step from format `to - 1` to `to`. Works on a copy: if it throws, nothing has changed. */
export interface Migration {
  readonly to: number;
  run(data: Record<string, string>): Record<string, string>;
}

export const MIGRATIONS: readonly Migration[] = [];

const VERSION_KEY = 'vanguard-sim.data-version';
const SNAPSHOT_PREFIX = 'vanguard-sim.snapshot.v';
const SET_ASIDE_PREFIX = 'vanguard-sim.set-aside.v';
const isPlayerData = (key: string) =>
  (key.startsWith('vanguard-sim.') || key.startsWith('online.')) &&
  key !== VERSION_KEY &&
  !key.startsWith(SNAPSHOT_PREFIX) &&
  !key.startsWith(SET_ASIDE_PREFIX);

export type MigrationResult =
  | { readonly kind: 'current' }
  | { readonly kind: 'upgraded'; readonly from: number; readonly to: number }
  /** The upgrade failed: the data is as it was, and is tried again next start. */
  | { readonly kind: 'failed'; readonly from: number; readonly to: number }
  /** Back on an older version: the data from before the upgrade was put back. */
  | { readonly kind: 'restored'; readonly from: number; readonly to: number }
  /** Back on an older version with no earlier copy: the data was left alone. */
  | { readonly kind: 'newer'; readonly from: number; readonly to: number };

function readAll(store: Storage): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key === null || !isPlayerData(key)) continue;
    const value = store.getItem(key);
    if (value !== null) data[key] = value;
  }
  return data;
}

/** Make the player's data exactly `data`; on failure put `before` back and rethrow. */
function writeAll(store: Storage, before: Record<string, string>, data: Record<string, string>) {
  const apply = (from: Record<string, string>, to: Record<string, string>) => {
    for (const key of Object.keys(from)) if (!(key in to)) store.removeItem(key);
    for (const [key, value] of Object.entries(to)) store.setItem(key, value);
  };
  try {
    apply(before, data);
  } catch (e) {
    apply(data, before);
    throw e;
  }
}

function removeWithPrefix(store: Storage, prefix: string) {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) store.removeItem(key);
}

export function runMigrations(
  store: Storage = localStorage,
  migrations: readonly Migration[] = MIGRATIONS,
  current: number = DATA_VERSION,
): MigrationResult {
  const parsed = Number(store.getItem(VERSION_KEY));
  // data from before this system has no version: that is format 1
  const stored = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;

  if (stored === current) {
    store.setItem(VERSION_KEY, String(current));
    return { kind: 'current' };
  }

  if (stored > current) {
    const snapshot = store.getItem(`${SNAPSHOT_PREFIX}${current}`);
    if (snapshot === null) return { kind: 'newer', from: stored, to: current };
    const before = readAll(store);
    // what was saved since the upgrade is kept aside, not deleted
    store.setItem(`${SET_ASIDE_PREFIX}${stored}`, JSON.stringify(before));
    writeAll(store, before, JSON.parse(snapshot) as Record<string, string>);
    store.setItem(VERSION_KEY, String(current));
    store.removeItem(`${SNAPSHOT_PREFIX}${current}`);
    return { kind: 'restored', from: stored, to: current };
  }

  const failed = { kind: 'failed', from: stored, to: current } as const;
  try {
    const before = readAll(store);
    let data = { ...before };
    for (let to = stored + 1; to <= current; to++) {
      const step = migrations.find((m) => m.to === to);
      if (!step) return failed;
      data = step.run({ ...data });
    }
    // one kept copy, like the one kept version of the game: written before anything changes
    removeWithPrefix(store, SNAPSHOT_PREFIX);
    store.setItem(`${SNAPSHOT_PREFIX}${stored}`, JSON.stringify(before));
    writeAll(store, before, data);
    store.setItem(VERSION_KEY, String(current));
    return { kind: 'upgraded', from: stored, to: current };
  } catch {
    return failed;
  }
}

/** What the player should be told, if anything. */
export function migrationNotice(r: MigrationResult): string | null {
  switch (r.kind) {
    case 'failed':
      return 'Your saved decks and settings could not be upgraded for this version. They were not changed. If something looks wrong, go back to the previous version in Updates.';
    case 'restored':
      return 'Your saved decks and settings went back to how they were before the update. Anything saved since was kept aside, not deleted.';
    default:
      return null;
  }
}

let startResult: MigrationResult = { kind: 'current' };

/** Called once by main.tsx, before the game renders. A failure here must never stop the game. */
export function runStartMigrations(): void {
  try {
    startResult = runMigrations();
  } catch {
    startResult = { kind: 'failed', from: DATA_VERSION, to: DATA_VERSION };
  }
}

export const startMigrationResult = (): MigrationResult => startResult;
