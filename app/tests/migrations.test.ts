// @vitest-environment jsdom
// Vanguard Update Manager stage 5 (D-037): saved data survives format changes and going back.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DATA_VERSION,
  MIGRATIONS,
  migrationNotice,
  runMigrations,
  type Migration,
} from '../renderer/migrations';

const DECKS = 'vanguard-sim.decks.v1';
const SETTINGS = 'vanguard-sim.settings.v1';
const VERSION = 'vanguard-sim.data-version';
const deck = (name: string) => JSON.stringify([{ id: 'd', name }]);

/** Format 2 renames decks' key; format 3 upper-cases the deck name. */
const toV2: Migration = {
  to: 2,
  run(data) {
    const { [DECKS]: decks, ...rest } = data;
    return { ...rest, 'vanguard-sim.decks.v2': decks! };
  },
};
const toV3: Migration = {
  to: 3,
  run: (data) => ({
    ...data,
    'vanguard-sim.decks.v2': data['vanguard-sim.decks.v2']!.toUpperCase(),
  }),
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(DECKS, deck('Royal Paladin'));
  localStorage.setItem(SETTINGS, '{"speed":"fast"}');
  localStorage.setItem('online.name', 'Aichi');
});

describe('the real migration list', () => {
  it('is a complete chain up to the current format', () => {
    expect(MIGRATIONS.map((m) => m.to)).toEqual(
      Array.from({ length: DATA_VERSION - 1 }, (_, i) => i + 2),
    );
  });

  it("a player's existing data, which has no version, is kept exactly and marked", () => {
    expect(runMigrations()).toEqual({ kind: 'current' });
    expect(localStorage.getItem(DECKS)).toBe(deck('Royal Paladin'));
    expect(localStorage.getItem(SETTINGS)).toBe('{"speed":"fast"}');
    expect(localStorage.getItem(VERSION)).toBe(String(DATA_VERSION));
  });
});

describe('upgrading', () => {
  it('runs one step and keeps a copy from before it', () => {
    expect(runMigrations(localStorage, [toV2], 2)).toEqual({ kind: 'upgraded', from: 1, to: 2 });
    expect(localStorage.getItem(DECKS)).toBeNull();
    expect(localStorage.getItem('vanguard-sim.decks.v2')).toBe(deck('Royal Paladin'));
    expect(localStorage.getItem(SETTINGS)).toBe('{"speed":"fast"}');
    expect(localStorage.getItem('online.name')).toBe('Aichi');
    expect(localStorage.getItem(VERSION)).toBe('2');
    expect(JSON.parse(localStorage.getItem('vanguard-sim.snapshot.v1')!)[DECKS]).toBe(
      deck('Royal Paladin'),
    );
  });

  it('runs every step in order when versions were skipped', () => {
    expect(runMigrations(localStorage, [toV3, toV2], 3)).toEqual({
      kind: 'upgraded',
      from: 1,
      to: 3,
    });
    expect(localStorage.getItem('vanguard-sim.decks.v2')).toBe(deck('Royal Paladin').toUpperCase());
  });

  it('does nothing on the next start', () => {
    runMigrations(localStorage, [toV2], 2);
    const before = localStorage.getItem('vanguard-sim.decks.v2');
    expect(runMigrations(localStorage, [toV2], 2)).toEqual({ kind: 'current' });
    expect(localStorage.getItem('vanguard-sim.decks.v2')).toBe(before);
  });

  it('keeps one copy: the next upgrade replaces it', () => {
    runMigrations(localStorage, [toV2], 2);
    runMigrations(localStorage, [toV2, toV3], 3);
    expect(localStorage.getItem('vanguard-sim.snapshot.v1')).toBeNull();
    expect(localStorage.getItem('vanguard-sim.snapshot.v2')).not.toBeNull();
  });

  it('a step that throws changes nothing, says so, and is tried again next start', () => {
    const broken: Migration = {
      to: 3,
      run() {
        throw new Error('bad data');
      },
    };
    expect(runMigrations(localStorage, [toV2, broken], 3).kind).toBe('failed');
    expect(localStorage.getItem(DECKS)).toBe(deck('Royal Paladin'));
    expect(localStorage.getItem('vanguard-sim.decks.v2')).toBeNull();
    expect(localStorage.getItem(VERSION)).toBeNull();
    expect(runMigrations(localStorage, [toV2, toV3], 3).kind).toBe('upgraded');
  });

  it('a missing step changes nothing', () => {
    expect(runMigrations(localStorage, [toV3], 3).kind).toBe('failed');
    expect(localStorage.getItem(DECKS)).toBe(deck('Royal Paladin'));
  });

  it('puts everything back when storage fills up while writing', () => {
    const real = Storage.prototype.setItem;
    let writes = 0;
    Storage.prototype.setItem = function (key: string, value: string) {
      // the snapshot goes in; the first write of the new data fails, then storage recovers
      if (key.endsWith('.decks.v2') && writes++ === 0) throw new Error('quota');
      real.call(this, key, value);
    };
    try {
      expect(runMigrations(localStorage, [toV2], 2).kind).toBe('failed');
    } finally {
      Storage.prototype.setItem = real;
    }
    expect(localStorage.getItem(DECKS)).toBe(deck('Royal Paladin'));
    expect(localStorage.getItem('vanguard-sim.decks.v2')).toBeNull();
    expect(localStorage.getItem(SETTINGS)).toBe('{"speed":"fast"}');
  });
});

describe('going back to an older version', () => {
  it('puts the old data back and keeps what was saved since', () => {
    runMigrations(localStorage, [toV2], 2);
    localStorage.setItem('vanguard-sim.decks.v2', deck('Made after the update'));
    expect(runMigrations(localStorage, [], 1)).toEqual({ kind: 'restored', from: 2, to: 1 });
    expect(localStorage.getItem(DECKS)).toBe(deck('Royal Paladin'));
    expect(localStorage.getItem('vanguard-sim.decks.v2')).toBeNull();
    expect(localStorage.getItem(VERSION)).toBe('1');
    const kept = JSON.parse(localStorage.getItem('vanguard-sim.set-aside.v2')!);
    expect(kept['vanguard-sim.decks.v2']).toBe(deck('Made after the update'));
  });

  it('can update forward again afterwards', () => {
    runMigrations(localStorage, [toV2], 2);
    runMigrations(localStorage, [], 1);
    expect(runMigrations(localStorage, [toV2], 2).kind).toBe('upgraded');
    expect(localStorage.getItem('vanguard-sim.decks.v2')).toBe(deck('Royal Paladin'));
  });

  it('with no copy from before, leaves the data alone', () => {
    localStorage.setItem(VERSION, '5');
    expect(runMigrations(localStorage, [], 1)).toEqual({ kind: 'newer', from: 5, to: 1 });
    expect(localStorage.getItem(DECKS)).toBe(deck('Royal Paladin'));
    expect(localStorage.getItem(VERSION)).toBe('5');
  });
});

describe('notices', () => {
  it('tells the player only when something needs saying', () => {
    expect(migrationNotice({ kind: 'current' })).toBeNull();
    expect(migrationNotice({ kind: 'upgraded', from: 1, to: 2 })).toBeNull();
    expect(migrationNotice({ kind: 'newer', from: 2, to: 1 })).toBeNull();
    expect(migrationNotice({ kind: 'failed', from: 1, to: 2 })).toMatch(/not changed/);
    expect(migrationNotice({ kind: 'restored', from: 2, to: 1 })).toMatch(/kept aside/);
  });
});
