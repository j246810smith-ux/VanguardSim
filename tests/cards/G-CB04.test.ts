/**
 * G-CB04 "Gear of Fate": every card with text is scripted, a unit called by a time leap triggers
 * "placed on (RC) from your deck due to time leap", a drive check trigger is remembered for the
 * turn, and Gear Chronicle decks are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { gApply, gCtx, settle } from '../fixtures/gEra';
import { answer, maker, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const GC = maker('Gear Chronicle', ['G-CB04-002', 'G-CB04-003'], ctx);

describe('G-CB04', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CB04-'));
    expect(cards).toHaveLength(45);
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

  it('Unbounded Colossus time leaps a rear-guard, and Tick-away Dragon sees the time-leap call', () => {
    const base = scene(
      [GC, KG],
      {
        circles: { vanguard: 'G-CB04-028', back_left: 'G-CB04-026', front_right: 'G-CB04-023' },
        damage: ['G-CB04-036'],
        deckTop: ['G-CB04-033', 'G-CB04-032'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { faceUpG: 1 },
    );
    const s: GameState = structuredClone(base);
    const p = s.players[0];
    const toDrop = p.deck.at(-1)!;
    p.deck.splice(-1, 1);
    p.drop.push(toDrop);
    const tigar = p.circles.back_left[0]!;
    let r = settle(
      gApply(s, {
        type: 'ATTACK',
        player: 0,
        attacker: p.circles.vanguard.at(-1)!,
        target: s.players[1].circles.vanguard.at(-1)!,
        booster: null,
      }),
      { stopWhen: (x) => x.pendingChoice?.options.includes(tigar) === true },
    );
    expect(r.state.pendingChoice?.options).toContain(tigar);
    r = settle(answer(r, tigar));
    const after = r.state.players[0];
    expect(after.bind).toContain(tigar);
    // the time leap called a grade 1 card from the deck to one of the (RC)
    const leapCall = r.events.find(
      (e) => e.type === 'CARD_MOVED' && e.byTimeLeap === true && e.to.zone === 'circle',
    );
    expect(leapCall).toBeDefined();
    const called = leapCall && 'instanceId' in leapCall ? leapCall.instanceId : '';
    expect(ctx.registry.get(r.state.cards[called]!.definitionId).grade).toBe(1);
    // Tick-away: "choose up to one card from your drop zone, and put it on the bottom of your deck"
    expect(after.drop).not.toContain(toDrop);
  });

  it('a drive check trigger is remembered for the turn', () => {
    const s = scene(
      [GC, KG],
      {
        circles: { vanguard: 'G-CB04-028', front_left: 'G-CB04-033' },
        deckTop: ['G-CB04-013', 'G-CB04-013'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
    );
    const r = settle(
      gApply(s, {
        type: 'ATTACK',
        player: 0,
        attacker: s.players[0].circles.vanguard.at(-1)!,
        target: s.players[1].circles.vanguard.at(-1)!,
        booster: null,
      }),
      { no: true, stopWhen: (x) => (x.turnFlags.driveTriggers ?? []).length > 0 },
    );
    expect(r.state.turnFlags.driveTriggers).toContain(0);
  });
});

describe('G-CB04 decks played out by the basic AI', () => {
  it.each([
    ['Chronojet', ['G-CB04-006', 'G-CB04-011', 'G-CB04-012', 'G-CB04-021', 'G-CB04-023']],
    ['Chronofang', ['G-CB04-009', 'G-CB04-013', 'G-CB04-020', 'G-CB04-026', 'G-CB04-042']],
    ['Colossus', ['G-CB04-005', 'G-CB04-010', 'G-CB04-015', 'G-CB04-034', 'G-CB04-041']],
    ['Chronoscommand', ['G-CB04-004', 'G-CB04-016', 'G-CB04-017', 'G-CB04-029', 'G-CB04-040']],
  ] as const)('%s', (_name, include) => {
    const deck = GC([...include]);
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
