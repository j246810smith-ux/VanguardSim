/**
 * G-CHB02 "We Are!!! Trinity Dragon": every card with text is scripted, Fullmark Gorilla (GB2)
 * does not retire when hit, oracle reads the hand, and Oracle Think Tank, Dimension Police and
 * Great Nature decks are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { gApply, gCtx, settle } from '../fixtures/gEra';
import { maker, pw, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const OTT = maker('Oracle Think Tank', ['G-CHB02-001', 'G-CHB02-010'], ctx);
const DP = maker('Dimension Police', ['G-CHB02-006', 'G-CHB02-029'], ctx);
const GN = maker('Great Nature', ['G-CHB02-003', 'G-CHB02-036'], ctx);

describe('G-CHB02', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CHB02-'));
    expect(cards).toHaveLength(75);
    expect(
      cards
        .filter(
          (d) =>
            d.text.trim() !== '' &&
            !/^\(You may only have up to four/.test(d.text.trim()) &&
            d.abilities.length === 0,
        )
        .map((d) => d.id),
    ).toEqual([]);
  });

  it('Fullmark Gorilla (GB2) stays on its circle when an attack hits it', () => {
    // the Kagero player attacks the Great Nature player's Gorilla
    const base = scene(
      [KG, GN],
      { circles: { vanguard: 'G-BT01-014' } },
      { circles: { vanguard: 'G-CHB02-009', front_left: 'G-CHB02-037' } },
    );
    const s: GameState = structuredClone(base);
    for (const id of s.players[1].gzone.slice(0, 2)) s.cards[id]!.faceUp = true;
    const gorilla = s.players[1].circles.front_left[0]!;
    const r = settle(
      gApply(s, {
        type: 'ATTACK',
        player: 0,
        attacker: s.players[0].circles.vanguard.at(-1)!,
        target: gorilla,
        booster: null,
      }),
      { no: true },
    );
    expect(r.events.some((e) => e.type === 'ATTACK_HIT' && e.target === gorilla)).toBe(true);
    expect(r.state.players[1].circles.front_left).toContain(gorilla);
  });

  it('oracle: Foredoom Miko, Sachi gets +2000 with five or more cards in hand', () => {
    const s = scene(
      [OTT, KG],
      {
        circles: { vanguard: 'G-CHB02-005', front_left: 'G-CHB02-047' },
        hand: ['G-CHB02-048', 'G-CHB02-048', 'G-CHB02-049', 'G-CHB02-049'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
    );
    const sachi = s.players[0].circles.front_left[0]!;
    const n = s.players[0].hand.length;
    expect(pw(s, sachi)).toBe(n >= 5 ? 10000 : 8000);
    const more: GameState = structuredClone(s);
    while (more.players[0].hand.length < 5)
      more.players[0].hand.push(more.players[0].deck.shift()!);
    expect(pw(more, sachi)).toBe(10000);
  });
});

describe('G-CHB02 decks played out by the basic AI', () => {
  it.each([
    [
      'Oracle Think Tank',
      OTT,
      ['G-CHB02-005', 'G-CHB02-012', 'G-CHB02-023', 'G-CHB02-024', 'G-CHB02-047'],
    ],
    [
      'Dimension Police',
      DP,
      ['G-CHB02-007', 'G-CHB02-030', 'G-CHB02-032', 'G-CHB02-034', 'G-CHB02-055'],
    ],
    [
      'Great Nature',
      GN,
      ['G-CHB02-009', 'G-CHB02-020', 'G-CHB02-037', 'G-CHB02-065', 'G-CHB02-067'],
    ],
  ] as const)('%s', (_name, make, include) => {
    const deck = make([...include]);
    for (const seed of [3, 11]) {
      const { finalState, truncated } = runMatch({ seed, decks: [deck, deck] }, ctx, [
        new BasicController(ctx),
        new BasicController(ctx),
      ]);
      expect(truncated).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
    }
  });
});
