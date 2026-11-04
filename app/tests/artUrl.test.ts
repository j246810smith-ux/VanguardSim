import { describe, expect, it } from 'vitest';
import { artUrl } from '../renderer/engine';

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
