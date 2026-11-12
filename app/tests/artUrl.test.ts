import { describe, expect, it } from 'vitest';
import { artUrl, displayNumber, isSpecialPrinting, metaOf } from '../renderer/engine';

describe('card number shown (metaOf)', () => {
  it('prefers the English base number, but never a special printing (feedback 2026-11-12)', () => {
    // Blaster Blade Seeker: the English record is the Legion Rare BT16/L02EN
    expect(metaOf('BT16-009')).toEqual({ number: 'BT16/009', rarity: 'RR' });
    expect(metaOf('TD14-005')?.number).toBe('TD14/005EN');
    expect(metaOf('BT16-009EN')?.number).toBe('BT16/009EN');
    expect(metaOf('BT01-001')?.number).toBe('BT01/001EN');
    expect(isSpecialPrinting('BT16/L02EN')).toBe(true);
    expect(isSpecialPrinting('BT16/S02')).toBe(true);
    expect(isSpecialPrinting('G-BT08/Re:01')).toBe(true);
    expect(isSpecialPrinting('BT16/009EN')).toBe(false);
    expect(isSpecialPrinting('PR/0003EN')).toBe(false);
    expect(displayNumber({ id: 'X-001', en: { number: 'X/S01' }, jp: null })).toBe('X/S01');
    expect(displayNumber({ id: 'X-001', en: null, jp: null })).toBe('X-001');
  });
});

describe('artUrl', () => {
  it('finds the set folder of every kind of card number', () => {
    expect(artUrl('BT01-001')).toBe('cards/BT01/BT01-001.png');
    expect(artUrl('BT16-001EN', 'jpg')).toBe('cards/BT16/BT16-001EN.jpg');
    expect(artUrl('G-TD01-001')).toBe('cards/G-TD01/G-TD01-001.png');
    expect(artUrl('VZ01-001')).toBe('cards/VZ01/VZ01-001.png');
    // PR cards have four-digit numbers: their art did not show before this was tested
    expect(artUrl('PR11-0003')).toBe('cards/PR11/PR11-0003.png');
    expect(artUrl('PR14-0160A')).toBe('cards/PR14/PR14-0160A.png');
  });
});
