/**
 * Grade 2 guardians from the hand (audit 2026-11-14). A grade 2 may be called from the hand to
 * (GC) whenever the vanguard is grade 2 or higher (CR 8.5.2.1.1.2: grade ≤ the vanguard's); it
 * needs no Intercept icon for that. Intercept (CR 10.2.2) stays a separate action for front-row
 * rear-guards. Checked in both the Original Era and the G era.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  currentPower,
  getLegalActions,
  IllegalActionError,
  type Command,
  type EngineContext,
  type GameEvent,
  type GameState,
  type LegalAction,
  type PlayerId,
} from '../../src/engine';
import { battleScenario, unitAt, type SideSpec } from '../fixtures/scenario';
import { gTestContext, makeTestDeck, testContext } from '../fixtures/syntheticCards';

const CRIT = 'TEST-002'; // shield 10000
const G1 = 'TEST-006'; // shield 5000
const FILLER = 'TEST-009';
const G2 = 'TEST-010'; // 9000, shield 5000, intercept
const G2_B = 'TEST-011'; // 10000, shield 5000, intercept
const G3 = 'TEST-013'; // 11000, twin drive
const G3_10K = 'TEST-014'; // 10000

const ERAS: readonly [string, EngineContext][] = [
  ['Original Era', testContext],
  ['G era', gTestContext],
];

describe.each(ERAS)('grade 2 guardians from the hand (%s)', (_era, ctx) => {
  const decks =
    ctx === gTestContext
      ? ([
          { ...makeTestDeck(), gDeck: [] },
          { ...makeTestDeck(), gDeck: [] },
        ] as const)
      : undefined;

  const scenario = (defender: SideSpec) =>
    battleScenario({
      ctx,
      ...(decks ? { decks } : {}),
      attacker: { circles: { vanguard: G3, front_left: G2 }, deckTop: [FILLER, FILLER] },
      defender: { deckTop: [FILLER, FILLER], ...defender },
    });

  const legal = <T extends LegalAction['type']>(s: GameState, p: PlayerId, type: T) =>
    getLegalActions(s, p, ctx).find((a): a is Extract<LegalAction, { type: T }> => a.type === type);

  const apply = (s: GameState, ...commands: Command[]) => {
    const events: GameEvent[] = [];
    for (const c of commands) {
      const r = applyCommand(s, c, ctx);
      s = r.state;
      events.push(...r.events);
    }
    return { state: s, events };
  };

  const attackVanguard = (s: GameState) =>
    apply(s, {
      type: 'ATTACK',
      player: 0,
      attacker: unitAt(s, 0, 'vanguard'),
      target: unitAt(s, 1, 'vanguard'),
      booster: null,
    }).state;

  const inHand = (s: GameState, def: string) =>
    s.players[1].hand.filter((id) => s.cards[id]!.definitionId === def);

  it('a grade 2 in hand is offered as a guardian under a grade 3 vanguard', () => {
    const s = attackVanguard(scenario({ circles: { vanguard: G3_10K }, hand: [G2] }));
    const g2 = inHand(s, G2)[0]!;
    expect(legal(s, 1, 'GUARD')!.cardIds).toEqual([g2]);
    // nothing else to guard with, so the guard step ends by itself (CR 7.4.1.2.3.1)
    const { state: after, events } = apply(s, { type: 'GUARD', player: 1, cardId: g2 });
    expect(events.map((e) => e.type)).toContain('GUARDIAN_CALLED');
    expect(events.find((e) => e.type === 'ATTACK_RESOLVED')).toMatchObject({
      hit: false,
      defensePower: 10000 + 5000,
    });
    expect(after.players[1].hand).not.toContain(g2);
    expect(after.players[1].drop).toContain(g2);
  });

  it('a grade 2 vanguard can guard with grade 2 (equal grade is enough)', () => {
    const s = attackVanguard(scenario({ circles: { vanguard: G2_B }, hand: [G2] }));
    expect(legal(s, 1, 'GUARD')!.cardIds).toEqual(inHand(s, G2));
  });

  it('a grade 1 vanguard cannot (CR 8.5.2.1.1.2), but grade 0 and 1 still can', () => {
    const s = attackVanguard(scenario({ circles: { vanguard: G1 }, hand: [G2, G1, CRIT] }));
    const offered = legal(s, 1, 'GUARD')!.cardIds.map((id) => s.cards[id]!.definitionId);
    expect(offered.sort()).toEqual([CRIT, G1].sort());
    expect(() => apply(s, { type: 'GUARD', player: 1, cardId: inHand(s, G2)[0]! })).toThrow(
      IllegalActionError,
    );
  });

  it('grade 2, grade 1 and grade 0 shields add up in one guard, then all are retired', () => {
    const s = attackVanguard(scenario({ circles: { vanguard: G3_10K }, hand: [G2, G1, CRIT] }));
    const ids = [inHand(s, G2)[0]!, inHand(s, G1)[0]!, inHand(s, CRIT)[0]!];
    let t = s;
    for (const cardId of ids.slice(0, 2)) {
      expect(legal(t, 1, 'GUARD')!.cardIds).toContain(cardId);
      t = apply(t, { type: 'GUARD', player: 1, cardId }).state;
    }
    expect(t.players[1].guardian.sort()).toEqual(ids.slice(0, 2).sort());
    expect(currentPower(t, ctx, unitAt(t, 1, 'vanguard'))).toBe(10000 + 5000 + 5000);
    // the last card ends the guard step by itself
    const { state: done, events } = apply(t, { type: 'GUARD', player: 1, cardId: ids[2]! });
    expect(events.find((e) => e.type === 'ATTACK_RESOLVED')).toMatchObject({
      hit: false,
      defensePower: 10000 + 5000 + 5000 + 10000,
    });
    for (const id of ids) expect(done.players[1].drop).toContain(id);
  });

  it('guard from hand and Intercept stay separate actions in the same guard step', () => {
    const s = attackVanguard(
      scenario({ circles: { vanguard: G3_10K, front_left: G2_B }, hand: [G2] }),
    );
    const interceptor = unitAt(s, 1, 'front_left');
    const g2 = inHand(s, G2)[0]!;
    expect(legal(s, 1, 'GUARD')!.cardIds).toEqual([g2]);
    expect(legal(s, 1, 'INTERCEPT')!.unitIds).toEqual([interceptor]);
    // the rear-guard is not a hand guardian, and the hand card cannot intercept
    expect(legal(s, 1, 'GUARD')!.cardIds).not.toContain(interceptor);
    expect(() => apply(s, { type: 'INTERCEPT', player: 1, unitId: g2 })).toThrow(
      IllegalActionError,
    );
    const { state: t, events } = apply(
      s,
      { type: 'INTERCEPT', player: 1, unitId: interceptor },
      { type: 'GUARD', player: 1, cardId: g2 },
    );
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['INTERCEPTED', 'GUARDIAN_CALLED']),
    );
    expect(events.find((e) => e.type === 'ATTACK_RESOLVED')).toMatchObject({
      hit: false,
      defensePower: 10000 + 5000 + 5000,
    });
    expect(t.players[1].drop).toEqual(expect.arrayContaining([interceptor, g2]));
  });
});
