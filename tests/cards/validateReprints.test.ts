import { describe, expect, it } from 'vitest';
import { compareReprint } from '../../scripts/cards/validate';
import type { CardRecord, Localized } from '../../src/cards/record';

const loc = (name: string, text = ''): Localized => ({
  number: '',
  name,
  text,
  clan: '',
  race: '',
  image: null,
});

const record = (p: Partial<CardRecord>): CardRecord =>
  ({
    id: 'TEST-001',
    set: 'TEST',
    jp: null,
    en: null,
    cardType: 'normal_unit',
    grade: 2,
    power: 9000,
    shield: 5000,
    critical: 1,
    trigger: null,
    skillIcon: 'intercept',
    ...p,
  }) as CardRecord;

// G-FTD01-002 reprints G-BT03-006: the reprint is Japanese-only, the original has both records
const original = record({
  jp: loc('旭光の騎士 グルグウィント', '【自】：このユニットがアタックした時、パワー＋３０００'),
  en: loc('Sunrise Ray Knight, Gurguit', '[AUTO]: When this unit attacks, +3000 power'),
});

describe('compareReprint (cards:validate)', () => {
  it('compares a Japanese-only reprint by its Japanese name, not with the English one', () => {
    const reprint = record({
      jp: loc('旭光の騎士 グルグウィント', '【自】：このユニットがアタックした時、パワー+3000'),
    });
    const r = compareReprint(reprint, original);
    expect(r.language).toBe('jp');
    expect(r.sameCard).toBe(true);
    expect(r.sameText).toBe(true); // full-width ＋３０００ equals +3000
  });

  it('still catches a different Japanese name or different stats', () => {
    const otherName = record({ jp: loc('暁光の騎士 イアゴー') });
    expect(compareReprint(otherName, original).sameCard).toBe(false);
    const otherPower = record({ jp: loc('旭光の騎士 グルグウィント'), power: 10000 });
    expect(compareReprint(otherPower, original).sameCard).toBe(false);
  });

  it('prefers English when both records have it', () => {
    const reprint = record({ jp: loc('別名'), en: loc('Sunrise Ray Knight, Gurguit') });
    const r = compareReprint(reprint, original);
    expect(r.language).toBe('en');
    expect(r.sameCard).toBe(true);
  });

  it('compares stats only when the two share no language', () => {
    const enOnly = record({ id: 'TEST-001EN', en: loc('Sunrise Ray Knight, Gurguit') });
    const jpOnly = record({ jp: loc('旭光の騎士 グルグウィント') });
    const r = compareReprint(enOnly, jpOnly);
    expect(r.language).toBeNull();
    expect(r.sameCard).toBe(true);
    expect(r.sameText).toBe(false);
  });
});
