// @vitest-environment jsdom
// Phone support (docs/android/ANDROID_AUDIT_AND_PLAN.md): graphics level (U14), stage fit and
// text size (U8, U11), and deck backups (U9).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import {
  applyMerge,
  backupFileName,
  backupText,
  BACKUP_KIND,
  planMerge,
  readBackup,
} from '../renderer/decks/backup';
import { loadDecks, saveDeck, type SavedDeck } from '../renderer/decks/storage';
import { ctx } from '../renderer/engine';
import { DeckBuilder } from '../renderer/screens/DeckBuilder';
import {
  DEFAULT_SETTINGS,
  defaultGraphics,
  effectiveSettings,
  loadSettings,
  type Settings,
} from '../renderer/settings';
import {
  fitScale,
  fitSize,
  MIN_TEXT_PX,
  SMALL_SCALE,
  stageLayout,
  textBoost,
} from '../renderer/stageFit';

describe('graphics (U14)', () => {
  afterEach(() => localStorage.clear());

  it('defaults to Full on Windows, and on Android unless the phone reports under 6 GB', () => {
    expect(defaultGraphics(false, 2)).toBe('full');
    expect(defaultGraphics(true, 4)).toBe('reduced');
    expect(defaultGraphics(true, 8)).toBe('full');
    expect(defaultGraphics(true, undefined)).toBe('full');
    // the tests run as the desktop build
    expect(DEFAULT_SETTINGS.graphics).toBe('full');
  });

  it('older saved settings without it get the default; the rest is kept', () => {
    const { graphics: _drop, ...old } = { ...DEFAULT_SETTINGS, musicVolume: 12 };
    localStorage.setItem('vanguard-sim.settings.v1', JSON.stringify(old));
    const s = loadSettings();
    expect(s.graphics).toBe('full');
    expect(s.musicVolume).toBe(12);
  });

  it('Low turns off foil and cut-ins and uses the flat table; Full and Reduced change nothing', () => {
    const mine: Settings = { ...DEFAULT_SETTINGS, foil: true, cutIns: 'full', tableView: 'tilted' };
    expect(effectiveSettings({ ...mine, graphics: 'full' })).toEqual({ ...mine, graphics: 'full' });
    expect(effectiveSettings({ ...mine, graphics: 'reduced' })).toEqual({
      ...mine,
      graphics: 'reduced',
    });
    const low = effectiveSettings({ ...mine, graphics: 'low' });
    expect(low).toMatchObject({ foil: false, cutIns: 'off', tableView: 'overhead' });
    // the player's own choices are kept for when they raise Graphics again
    expect(mine).toMatchObject({ foil: true, cutIns: 'full', tableView: 'tilted' });
  });
});

describe('stage fit and readable text (U8, U11)', () => {
  it('fits the 1920×1080 stage into the space it is given', () => {
    expect(fitScale(1920, 1080)).toBe(1);
    expect(fitScale(960, 1080)).toBe(0.5);
    // a Pixel 10 in landscape, minus a 32 dp camera inset on the left
    expect(fitScale(923 - 32, 411)).toBeCloseTo(411 / 1080);
    expect(fitScale(0, 0)).toBe(1);
  });

  it('enlarges the log and prompt text only on small screens, within limits', () => {
    expect(textBoost(1)).toBe(1);
    expect(textBoost(SMALL_SCALE)).toBe(1);
    const phone = 411 / 1080;
    const boost = textBoost(phone);
    expect(boost).toBeGreaterThan(1);
    expect(14 * phone * boost).toBeCloseTo(MIN_TEXT_PX);
    expect(textBoost(0.1)).toBe(2);
  });
});

const deck = (id: string, name: string, n = 0): SavedDeck => ({
  id,
  name,
  deck: STARTER_DECKS[n]!.deck,
  updated: 1,
});

describe('phone layout (feedback E1, E2, E5)', () => {
  it('a 20:9 phone gets the phone layout and the space beside the 1920 px stage', () => {
    const l = stageLayout(923, 411);
    expect(l.phone).toBe(true);
    // 923 / (411 / 1080) = 2425 stage px wide: about 252 on each side of the 1920 px stage
    expect(l.edge).toBeGreaterThan(240);
    expect(l.edge).toBeLessThan(260);
  });
  it('Windows window sizes are unchanged: no phone layout, no side space', () => {
    for (const [w, h] of [
      [1024, 576],
      [1600, 900],
      [2560, 1080],
      [1920, 1200],
    ] as const)
      expect(stageLayout(w, h)).toEqual({ scale: fitScale(w, h), phone: false, edge: 0 });
  });
  it('a 16:9 phone gets bigger cards but no side space', () => {
    expect(stageLayout(640, 360)).toMatchObject({ phone: true, edge: 0 });
  });
  it('the keyboard opening while typing keeps the last size; closing it or turning does not', () => {
    const last = { width: 923, height: 411 };
    expect(fitSize(923, 200, last, true)).toBe(last);
    expect(fitSize(923, 200, last, false)).toEqual({ width: 923, height: 200 });
    expect(fitSize(411, 923, last, true)).toEqual({ width: 411, height: 923 });
    expect(fitSize(923, 411, { width: 923, height: 200 }, true)).toEqual(last);
  });
});

describe('deck backup (U9)', () => {
  it('writes every deck with its text list and reads them back', () => {
    const decks = [deck('a', 'Alpha'), { ...deck('b', 'Beta', 1), format: 'classic' as const }];
    const now = new Date('2026-11-07T10:00:00Z');
    const text = backupText(decks, ctx.registry, now);
    expect(JSON.parse(text).kind).toBe(BACKUP_KIND);
    expect(text).toContain('Starting vanguard');
    expect(backupFileName(now)).toBe('vanguard-sim-decks-2026-11-07.json');
    const back = readBackup(text);
    expect(back.problems).toEqual([]);
    expect(back.decks).toEqual(decks);
  });

  it('refuses other files and skips broken decks', () => {
    expect(readBackup('not json').decks).toEqual([]);
    expect(readBackup('{"kind":"other","decks":[]}').problems[0]).toContain('not a deck backup');
    expect(
      readBackup(JSON.stringify({ kind: BACKUP_KIND, version: 99, decks: [] })).problems[0],
    ).toContain('newer version');
    const mixed = readBackup(
      JSON.stringify({ kind: BACKUP_KIND, version: 1, decks: [deck('a', 'A'), { id: 'x' }] }),
    );
    expect(mixed.decks).toHaveLength(1);
    expect(mixed.problems[0]).toContain('1 deck could not be read');
  });

  it('merges by id: new ones are added, changed ones replaced only when agreed', () => {
    const saved = [deck('a', 'Alpha'), deck('b', 'Beta')];
    const incoming = [
      { ...deck('a', 'Alpha'), updated: 99 }, // same deck, newer time: ignored
      deck('b', 'Beta (changed)', 1),
      deck('c', 'Gamma'),
    ];
    const plan = planMerge(saved, incoming);
    expect(plan.added.map((d) => d.id)).toEqual(['c']);
    expect(plan.replacing.map((d) => d.id)).toEqual(['b']);
    expect(applyMerge(saved, plan, false).map((d) => d.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(applyMerge(saved, plan, true).map((d) => d.name)).toEqual([
      'Alpha',
      'Beta (changed)',
      'Gamma',
    ]);
  });
});

describe('deck backup in the Deck Builder', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const importFile = async (text: string) => {
    const file = new File([text], 'decks.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(screen.getByTestId('import-decks-file'), { target: { files: [file] } });
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('exports all decks as a file download', () => {
    saveDeck(deck('a', 'Alpha'));
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<DeckBuilder onBack={() => {}} />);
    fireEvent.click(screen.getByText('Load…'));
    fireEvent.click(screen.getByTestId('export-all-decks'));
    expect(created).toHaveLength(1);
    expect(created[0]!.type).toBe('application/json');
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('imports decks, and asks before replacing changed ones', async () => {
    saveDeck(deck('a', 'Alpha'));
    render(<DeckBuilder onBack={() => {}} />);
    fireEvent.click(screen.getByText('Load…'));
    const file = backupText(
      [deck('a', 'Alpha (changed)', 1), deck('c', 'Gamma')],
      ctx.registry,
      new Date(),
    );
    await importFile(file);
    expect(screen.getByTestId('confirm-dialog').textContent).toContain('Replace it?');
    fireEvent.click(screen.getByTestId('confirm-no'));
    expect(loadDecks().map((d) => d.name)).toEqual(['Alpha']);
    await importFile(file);
    fireEvent.click(screen.getByTestId('confirm-yes'));
    expect(loadDecks().map((d) => d.name)).toEqual(['Alpha (changed)', 'Gamma']);
  });

  it('new decks only: imported without asking', async () => {
    render(<DeckBuilder onBack={() => {}} />);
    fireEvent.click(screen.getByText('Load…'));
    await importFile(backupText([deck('c', 'Gamma')], ctx.registry, new Date()));
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(loadDecks().map((d) => d.name)).toEqual(['Gamma']);
  });
});
