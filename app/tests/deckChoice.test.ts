import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../../src/decks/library';
import { validateDeck } from '../../src/engine';
import { ctx } from '../renderer/engine';
import { deckEntries, libraryDescription } from '../renderer/screens/deckChoice';

describe('choosing a deck', () => {
  it('offers every library deck first, and each is legal', () => {
    const entries = deckEntries();
    const library = entries.filter((e) => e.section === 'library');
    expect(library).toHaveLength(LIBRARY.length);
    expect(entries.slice(0, LIBRARY.length).every((e) => e.section === 'library')).toBe(true);
    for (const e of library) {
      expect(validateDeck(e.deck, ctx.registry, ctx.format), e.name).toEqual([]);
    }
  });

  it('in the G era the G Trial Decks stay first, with a G deck as the default', () => {
    const entries = deckEntries('g');
    expect(entries[0]!.section).toBe('gtrial');
    expect(entries[0]!.deck.gDeck?.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.section === 'library')).toBe(true);
  });

  it('keeps the other sections until every clan is covered', () => {
    const sections = new Set(deckEntries().map((e) => e.section));
    expect(sections).toContain('starter');
    expect(sections).toContain('trial');
    expect(deckEntries('g').some((e) => e.section === 'gtrial')).toBe(true);
    expect(deckEntries('g').filter((e) => e.section === 'gstarter')).toHaveLength(11);
    expect(deckEntries('classic').some((e) => e.section === 'gstarter')).toBe(false);
  });

  it('Original Era — Expanded offers the G-BT01 playtest decks first; the other formats never do', () => {
    const entries = deckEntries('classic_ou');
    expect(entries.slice(0, 4).map((e) => e.section)).toEqual(Array(4).fill('ogplaytest'));
    expect(entries.filter((e) => e.section === 'ogplaytest')).toHaveLength(4);
    expect(deckEntries('classic').some((e) => e.section === 'ogplaytest')).toBe(false);
    expect(deckEntries('g').some((e) => e.section === 'ogplaytest')).toBe(false);
  });

  it('says what a source states, and never a result it does not', () => {
    const champion = LIBRARY.find((d) => d.id === 'jp-sp-raging-form-2013')!;
    expect(libraryDescription(champion)).toContain('National Champion');
    expect(libraryDescription(champion)).toContain('Verified list');
    const burst = LIBRARY.find((d) => d.id === 'jp-rp-blaster-blade-burst-2013')!;
    expect(libraryDescription(burst)).toBe('Official cards, card counts are ours');
    const noPlace = LIBRARY.find((d) => d.tournament && d.tournament.placement === null)!;
    expect(libraryDescription(noPlace)).not.toMatch(/null|undefined/);
  });
});
