/**
 * Hollow timing (CR 1.48.1 11.33; the user's review, 2026-11-11). A hollowed unit is retired at the
 * end of the turn (an "at the end of turn" automatic ability, CR 6.8.1.3); abilities that retire
 * triggers are ordinary automatic abilities: they stand by and resolve in that end phase's check
 * timing, in the order the player chooses — not deferred, not folded into the retire.
 * Real Granblue cards: G-TD08-011 Skeleton Underling Pirate (Hollow), G-TD08-014 Undying
 * Departed, Grenache (Hollow; [GB1] Counter-Charge 2 when put into the drop zone by hollow),
 * G-TD08-004 Nightrose ([GB2] when your rear-guard is put into the drop zone, [mill 3] call it).
 */
import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState } from '../../src/engine';
import type { Draft } from '../../src/engine/game/context';
import { moveCard } from '../../src/engine/game/zones';
import { gApply, gCtx, settle, type Run } from '../fixtures/gEra';
import {
  andThen,
  answer,
  callFrom,
  faceDownDamage,
  faceUpDamage,
  KG3,
  maker,
  scene,
} from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const GB = maker('Granblue', ['G-TD08-001']);
const PIRATE = 'G-TD08-011';
const GRENACHE = 'G-TD08-014';
const NIGHTROSE = 'G-TD08-004';
const CURSING_SPEAR = 'G-TD08-002';

/** Player 0 ends the turn; every choice answered (first option, yes) until player 1's turn. */
const endTurn = (r: Run) =>
  settle(andThen(r, { type: 'END_PHASE', player: 0 }), {
    stopWhen: (st) => st.activePlayer === 1,
  });
/** Ends the main phase and the battle phase, stopping in the end phase at the first open choice. */
const toEndPhaseChoice = (r: Run) =>
  settle(andThen(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 }), {
    stopWhen: (st) => st.pendingChoice?.kind === 'order_abilities' || st.activePlayer === 1,
  });

const hollowMoves = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: 'CARD_MOVED' }> => e.type === 'CARD_MOVED' && !!e.byHollow,
  );
const indexOf = (events: readonly GameEvent[], p: (e: GameEvent) => boolean) => events.findIndex(p);
const nextTurnStarts = (events: readonly GameEvent[]) =>
  indexOf(events, (e) => e.type === 'TURN_STARTED');

function grenacheScene(faceUpG: number, vanguard = CURSING_SPEAR) {
  return faceDownDamage(
    scene(
      [GB, GB],
      { circles: { vanguard }, hand: [GRENACHE], damage: ['G-TD08-005', 'G-TD08-005'] },
      KG3,
      {
        at: 'main',
        faceUpG,
      },
    ),
    2,
  );
}

describe('Hollow: the unit and its end-of-turn retire', () => {
  it('a unit called with Hollow becomes hollowed (the player may decline)', () => {
    const s = scene(
      [GB, GB],
      { circles: { vanguard: CURSING_SPEAR }, hand: [PIRATE, PIRATE] },
      KG3,
      {
        at: 'main',
      },
    );
    const yes = callFrom(s, PIRATE, 'front_left');
    expect(yes.state.cards[unitAt(yes.state, 0, 'front_left')]!.hollowed).toBe(true);
    const no = callFrom(s, PIRATE, 'front_left', { no: true });
    expect(no.state.cards[unitAt(no.state, 0, 'front_left')]!.hollowed).toBeUndefined();
  });

  it('is retired at the end of that turn, as a retire, before the next turn starts', () => {
    const s = scene([GB, GB], { circles: { vanguard: CURSING_SPEAR }, hand: [PIRATE] }, KG3, {
      at: 'main',
    });
    const called = callFrom(s, PIRATE, 'front_left');
    const u = unitAt(called.state, 0, 'front_left');
    const end = endTurn(andThen(called, { type: 'END_PHASE', player: 0 }));
    expect(end.state.players[0].drop).toContain(u);
    const [move] = hollowMoves(end.events);
    expect(move).toMatchObject({ instanceId: u, from: { zone: 'circle' }, to: { zone: 'drop' } });
    expect(indexOf(end.events, (e) => e === move)).toBeLessThan(nextTurnStarts(end.events));
    // a new card in the drop zone, not hollowed any more
    expect(end.state.cards[u]!.hollowed).toBeUndefined();
  });

  it('several hollowed units are all retired at the end of the turn', () => {
    const s = scene(
      [GB, GB],
      { circles: { vanguard: CURSING_SPEAR }, hand: [PIRATE, PIRATE] },
      KG3,
      {
        at: 'main',
      },
    );
    const r = callFrom(s, PIRATE, 'front_left');
    const second = callFrom(r.state, PIRATE, 'front_right');
    const units = [unitAt(second.state, 0, 'front_left'), unitAt(second.state, 0, 'front_right')];
    const end = endTurn(andThen(second, { type: 'END_PHASE', player: 0 }));
    expect(
      hollowMoves(end.events)
        .map((e) => e.instanceId)
        .sort(),
    ).toEqual([...units].sort());
    for (const u of units) expect(end.state.players[0].drop).toContain(u);
  });

  it('a hollowed unit that left the field before the end of the turn is not retired again', () => {
    const s = scene([GB, GB], { circles: { vanguard: CURSING_SPEAR }, hand: [PIRATE] }, KG3, {
      at: 'main',
    });
    const called = callFrom(s, PIRATE, 'front_left');
    const u = unitAt(called.state, 0, 'front_left');
    // an effect puts it into the soul during the turn
    const t: GameState = structuredClone(called.state);
    const d: Draft = { state: t, events: [], ctx: gCtx };
    moveCard(d, u, { player: 0, zone: 'soul' }, 'effect');
    const end = endTurn(andThen({ state: t, events: [] }, { type: 'END_PHASE', player: 0 }));
    expect(end.state.players[0].soul).toContain(u);
    expect(end.state.players[0].drop).not.toContain(u);
    expect(hollowMoves(end.events)).toEqual([]);
  });
});

describe('abilities triggered by the hollow retire', () => {
  it('trigger then and resolve in that end phase (Grenache Counter-Charges before the next turn)', () => {
    const called = callFrom(grenacheScene(1), GRENACHE, 'back_left');
    const end = endTurn(andThen(called, { type: 'END_PHASE', player: 0 }));
    expect(faceUpDamage(end.state)).toBe(2);
    // the Counter-Charge (damage turned face up) happens before the next turn starts
    const flipped = indexOf(end.events, (e) => e.type === 'CARD_TURNED');
    expect(flipped).toBeGreaterThanOrEqual(0);
    expect(flipped).toBeLessThan(nextTurnStarts(end.events));
  });

  it('only a retire by Hollow triggers "due to the effect of the hollow ability"', () => {
    const called = callFrom(grenacheScene(1), GRENACHE, 'back_left', { no: true });
    const g = unitAt(called.state, 0, 'back_left');
    const standbyAfter = (byHollow: boolean) => {
      const t: GameState = structuredClone(called.state);
      const d: Draft = { state: t, events: [], ctx: gCtx };
      moveCard(d, g, { player: 0, zone: 'drop' }, 'effect', byHollow ? { byHollow: true } : {});
      return t.standby.filter((x) => x.source === g).map((x) => x.abilityId);
    };
    expect(standbyAfter(false)).toEqual([]); // retired by something else: no Counter-Charge
    expect(standbyAfter(true)).toEqual(['3']);
  });

  it('respects Generation Break: no face-up G unit, no Counter-Charge', () => {
    const called = callFrom(grenacheScene(0), GRENACHE, 'back_left');
    const end = endTurn(andThen(called, { type: 'END_PHASE', player: 0 }));
    expect(hollowMoves(end.events)).toHaveLength(1);
    expect(faceUpDamage(end.state)).toBe(0);
  });

  it('several abilities from one retire stand by together; the player chooses their order', () => {
    // Nightrose (vanguard, GB2) and Grenache's own ability both trigger from Grenache's hollow retire
    const called = callFrom(grenacheScene(2, NIGHTROSE), GRENACHE, 'back_left');
    const g = unitAt(called.state, 0, 'back_left');
    const at = toEndPhaseChoice(called);
    const c = at.state.pendingChoice!;
    expect(c.kind).toBe('order_abilities');
    const sources = c.options.map((o) => at.state.standby.find((x) => String(x.id) === o)!.source);
    expect(sources).toEqual(expect.arrayContaining([g, unitAt(at.state, 0, 'vanguard')]));

    // either order: both resolve in this end phase
    for (const first of c.options) {
      const end = settle(answer(at, first), { stopWhen: (st) => st.activePlayer === 1 });
      expect(faceUpDamage(end.state)).toBe(2); // Grenache's Counter-Charge 2
      // Nightrose paid [mill 3] and called Grenache back to (RC)
      expect(end.state.players[0].deck.length).toBe(at.state.players[0].deck.length - 3);
      expect(end.state.players[0].drop).not.toContain(g);
    }
  });
});

describe('both players with Hollow', () => {
  it("each player's hollowed units are retired at the end of their own turn only", () => {
    const s = scene(
      [GB, GB],
      { circles: { vanguard: CURSING_SPEAR }, hand: [PIRATE, PIRATE] },
      { circles: { vanguard: CURSING_SPEAR }, hand: [PIRATE] },
      { at: 'main' },
    );
    // player 0: one hollowed, one not
    const kept = callFrom(s, PIRATE, 'front_right', { no: true });
    const hollowed = callFrom(kept.state, PIRATE, 'front_left');
    const p0Kept = unitAt(hollowed.state, 0, 'front_right');
    const p0Gone = unitAt(hollowed.state, 0, 'front_left');
    let r = endTurn(andThen(hollowed, { type: 'END_PHASE', player: 0 }));
    expect(r.state.players[0].drop).toContain(p0Gone);
    // player 1's turn: to the main phase, call a hollowed unit, end the turn
    for (let i = 0; i < 6 && r.state.phase !== 'main'; i++)
      r = settle(andThen(r, { type: 'END_PHASE', player: 1 }));
    expect(r.state.phase).toBe('main');
    const id = r.state.players[1].hand.find((x) => r.state.cards[x]!.definitionId === PIRATE)!;
    r = settle(gApply(r.state, { type: 'CALL', player: 1, cardId: id, circle: 'front_left' }));
    const p1Unit = unitAt(r.state, 1, 'front_left');
    expect(r.state.cards[p1Unit]!.hollowed).toBe(true);
    const end = settle(
      andThen(r, { type: 'END_PHASE', player: 1 }, { type: 'END_PHASE', player: 1 }),
      { stopWhen: (st) => st.activePlayer === 0 },
    );
    expect(hollowMoves(end.events).map((e) => [e.instanceId, e.from.player])).toEqual([
      [p1Unit, 1],
    ]);
    expect(end.state.players[1].drop).toContain(p1Unit);
    expect(end.state.players[0].circles.front_right).toEqual([p0Kept]); // player 0's other unit stays
  });
});
