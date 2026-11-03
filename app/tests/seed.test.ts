import { describe, expect, it } from 'vitest';
import { seedFrom } from '../renderer/game/seed';
import { Aliases, guestEvents } from '../../src/net/guestView';

describe('the Seed field (v0.28)', () => {
  it('blank = random; a number is used as it is; any other text always gives the same number', () => {
    expect(seedFrom('  ')).toBeNull();
    expect(seedFrom('12345')).toBe(12345);
    const a = seedFrom('dragon');
    expect(a).toBe(seedFrom(' dragon '));
    expect(a).not.toBe(seedFrom('Dragon'));
    expect(Number.isInteger(a)).toBe(true);
    expect(a!).toBeGreaterThanOrEqual(0);
    expect(a!).toBeLessThan(2 ** 31);
    // too big for a seed: hashed, not cut off
    expect(seedFrom('99999999999')).toBeLessThan(2 ** 31);
  });

  it('is never sent to an online guest (it would reveal every shuffle)', () => {
    let n = 1;
    const out = guestEvents(
      [
        { type: 'GAME_CREATED', seed: 42, firstPlayer: 0 },
        { type: 'DECK_SHUFFLED', player: 0 },
      ],
      1,
      new Aliases(() => n++),
    );
    expect(out.map((e) => e.type)).toEqual(['DECK_SHUFFLED']);
  });
});
