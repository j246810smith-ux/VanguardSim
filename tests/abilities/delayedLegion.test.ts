import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  checkZoneInvariant,
  getLegalActions,
  whyIllegal,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../../src/engine';
import { makeTestDeck, testContext } from '../fixtures/syntheticCards';
import { battleScenario, unitAt } from '../fixtures/scenario';

// Delayed Legion house rule (CustomRules.delayedLegion; game/delayedLegion.ts)
const SEEKER = 'TEST-207'; // Seek Mate leader, "when this unit legions, draw a card"
const MATE = 'TEST-208';
const G2 = 'TEST-010';
const G3_10K = 'TEST-014';
const G3 = 'TEST-013';
const SENTINEL = 'TEST-016';
const CRIT = 'TEST-002';

type Run = { state: GameState; events: GameEvent[] };
const then = (r: Run, ...commands: Command[]): Run => {
  let { state } = r;
  const events = [...r.events];
  for (const c of commands) {
    const res = applyCommand(state, c, testContext);
    state = res.state;
    events.push(...res.events);
  }
  return { state, events };
};
const answer = (r: Run, ...selection: string[]): Run => {
  const c = r.state.pendingChoice;
  if (!c) throw new Error('no pending choice');
  return then(r, { type: 'CHOOSE', player: c.player, choiceId: c.id, selection });
};
const find = <T extends GameEvent['type']>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const canActivate = (state: GameState, player: PlayerId, source: InstanceId) =>
  getLegalActions(state, player, testContext).some(
    (a) => a.type === 'ACTIVATE' && a.options.some((o) => o.source === source),
  );
const endPhase = (p: PlayerId): Command => ({ type: 'END_PHASE', player: p });
const def = (s: GameState, id: InstanceId) => s.cards[id]!.definitionId;
const save = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;

/** Test-only: move `n` deck cards matching `pick` to the drop zone. */
function toDrop(s: GameState, n: number, pick: (definitionId: string) => boolean): InstanceId[] {
  const p = s.players[0];
  const ids = p.deck.filter((id) => pick(def(s, id))).slice(0, n);
  if (ids.length < n) throw new Error('not enough matching cards in the deck');
  for (const id of ids) {
    p.deck.splice(p.deck.indexOf(id), 1);
    p.drop.push(id);
    s.cards[id]!.faceUp = true;
  }
  return ids;
}
const normal = (d: string) =>
  ['TEST-006', 'TEST-007', 'TEST-009', 'TEST-011', 'TEST-012'].includes(d);

const setup = (
  opts: { rule?: boolean; oppVanguard?: string; eligible?: number; extra?: string[] } = {},
) => {
  const s = battleScenario({
    at: 'main',
    attacker: { circles: { vanguard: SEEKER } },
    defender: { circles: { vanguard: opts.oppVanguard ?? G3_10K } },
    decks: [
      makeTestDeck({ 'TEST-014': SEEKER, 'TEST-010': MATE, 'TEST-008': SENTINEL }),
      makeTestDeck(),
    ],
    ...(opts.rule === false ? {} : { customRules: { delayedLegion: true } }),
  });
  const eligible = toDrop(s, opts.eligible ?? 4, normal);
  const extra = (opts.extra ?? []).flatMap((d) => toDrop(s, 1, (x) => x === d));
  return { s, eligible, extra, leader: unitAt(s, 0, 'vanguard') };
};

/** Activate Seek Mate, return `cost` (if asked), pick the first mate found. */
function seek(s: GameState, leader: InstanceId, cost?: InstanceId[]) {
  let r = then(
    { state: s, events: [] },
    {
      type: 'ACTIVATE',
      player: 0,
      source: leader,
      abilityId: 'seek_mate',
    },
  );
  if (r.state.pendingChoice?.kind === 'select') r = answer(r, ...cost!);
  expect(r.state.pendingChoice).toMatchObject({ kind: 'search' });
  const mate = r.state.pendingChoice!.options[0]!;
  r = answer(r, mate);
  return { r, mate };
}

/** Pass the rest of player 0's turn and all of player 1's, up to player 0's next stand phase. */
const toNextStandPhase = (r: Run): Run =>
  then(r, endPhase(0), endPhase(0), endPhase(1), endPhase(1), endPhase(1));

describe('Delayed Legion (custom rule)', () => {
  it('is rejected while the opposing vanguard is below grade 3', () => {
    const { s, leader } = setup({ oppVanguard: G2 });
    expect(canActivate(s, 0, leader)).toBe(false);
    expect(
      whyIllegal(
        s,
        { type: 'ACTIVATE', player: 0, source: leader, abilityId: 'seek_mate' },
        testContext,
      ),
    ).not.toBeNull();
  });

  it('is permitted against a grade 3 vanguard with four eligible cards', () => {
    const { s, leader } = setup();
    expect(canActivate(s, 0, leader)).toBe(true);
  });

  it('returns the four chosen normal units to the deck', () => {
    const { s, leader, eligible } = setup();
    const { r } = seek(s, leader);
    const p = r.state.players[0];
    expect(p.drop).toEqual([]);
    for (const id of eligible) expect(p.deck).toContain(id);
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('offers only normal units without Sentinel as the cost, and rejects others', () => {
    const { s, leader, eligible, extra } = setup({ eligible: 5, extra: [SENTINEL, CRIT] });
    const r = then(
      { state: s, events: [] },
      {
        type: 'ACTIVATE',
        player: 0,
        source: leader,
        abilityId: 'seek_mate',
      },
    );
    const c = r.state.pendingChoice!;
    expect(c).toMatchObject({ kind: 'select', min: 4, max: 4 });
    expect([...c.options].sort()).toEqual([...eligible].sort());
    for (const bad of extra) {
      const cmd: Command = {
        type: 'CHOOSE',
        player: 0,
        choiceId: c.id,
        selection: [bad, ...eligible.slice(0, 3)],
      };
      expect(whyIllegal(r.state, cmd, testContext)).not.toBeNull();
    }
    // three eligible cards plus a sentinel and a trigger cannot pay
    expect(canActivate(setup({ eligible: 3, extra: [SENTINEL, CRIT] }).s, 0, leader)).toBe(false);
  });

  it('shuffles the deck after returning the cost, then searches for the Legion Mate', () => {
    const { s, leader } = setup();
    const { r, mate } = seek(s, leader);
    expect(def(r.state, mate)).toBe(MATE);
    const types = r.events.map((e) => e.type);
    const firstShuffle = types.indexOf('DECK_SHUFFLED');
    const search = r.events.findIndex(
      (e) => e.type === 'CHOICE_REQUESTED' && e.choice.kind === 'search',
    );
    expect(firstShuffle).toBeGreaterThan(-1);
    expect(firstShuffle).toBeLessThan(search);
    expect(find(r.events, 'DECK_SHUFFLED')).toHaveLength(2); // before and after the search
    expect(r.state.players[0].legion).toEqual({ leader, mate });
    expect(r.state.delayedLegions).toEqual([{ player: 0, leader, mate }]);
  });

  it('does not resolve before the next stand phase', () => {
    const { s, leader } = setup();
    const { r, mate } = seek(s, leader);
    // end of this turn and the whole of the opponent's turn: still in legion
    const opp = then(r, endPhase(0), endPhase(0), endPhase(1), endPhase(1));
    expect(opp.state.activePlayer).toBe(1);
    expect(opp.state.players[0].legion).toEqual({ leader, mate });
    expect(find(opp.events, 'CHOICE_REQUESTED').some((e) => e.choice.kind === 'soul_or_drop')).toBe(
      false,
    );
  });

  it('asks at the beginning of the next stand phase, before units stand', () => {
    const { s, leader } = setup();
    const { r } = seek(s, leader);
    const t = toNextStandPhase(r);
    expect(t.state.activePlayer).toBe(0);
    expect(t.state.phase).toBe('stand');
    expect(t.state.pendingChoice).toMatchObject({
      player: 0,
      kind: 'soul_or_drop',
      options: ['soul', 'drop'],
    });
    const sinceTurn = t.events.slice(t.events.map((e) => e.type).lastIndexOf('TURN_STARTED'));
    expect(find(sinceTurn, 'UNITS_STOOD')).toHaveLength(0);
  });

  it('Soul: the Legion Mate goes into the soul and the legion ends', () => {
    const { s, leader } = setup();
    const { r, mate } = seek(s, leader);
    const t = answer(toNextStandPhase(r), 'soul');
    const p = t.state.players[0];
    expect(p.soul).toContain(mate);
    expect(p.legion).toBeNull();
    expect(p.circles.vanguard).toEqual([leader]);
    expect(t.state.delayedLegions).toEqual([]);
    expect(t.state.phase).toBe('ride'); // the turn carries on
    expect(checkZoneInvariant(t.state)).toEqual([]);
  });

  it('Drop Zone: the Legion Mate goes into the drop zone and the legion ends', () => {
    const { s, leader } = setup();
    const { r, mate } = seek(s, leader);
    const t = answer(toNextStandPhase(r), 'drop');
    const p = t.state.players[0];
    expect(p.drop).toContain(mate);
    expect(p.soul).not.toContain(mate);
    expect(p.legion).toBeNull();
    expect(p.circles.vanguard).toEqual([leader]);
  });

  it('the same vanguard cannot legion again while it stays on the vanguard circle', () => {
    const { s, leader } = setup();
    const { r } = seek(s, leader);
    let t = answer(toNextStandPhase(r), 'soul');
    t = then(t, endPhase(0)); // to the main phase
    const st = structuredClone(t.state);
    toDrop(st, 4, normal);
    expect(st.players[0].circles.vanguard).toEqual([leader]);
    expect(canActivate(st, 0, leader)).toBe(false);
  });

  it('a newly placed vanguard does not inherit the restriction', () => {
    const { s, leader } = setup();
    const { r } = seek(s, leader);
    const t = answer(toNextStandPhase(r), 'drop');
    expect(t.state.phase).toBe('ride');
    const st = structuredClone(t.state);
    const p = st.players[0];
    const next = p.deck.find((id) => def(st, id) === SEEKER)!;
    p.deck.splice(p.deck.indexOf(next), 1);
    p.hand.push(next);
    let u = then({ state: st, events: [] }, { type: 'RIDE', player: 0, cardId: next });
    expect(u.state.players[0].soul).toContain(leader); // the old leader left the circle
    u = then(u, endPhase(0));
    const main = structuredClone(u.state);
    toDrop(main, 4, normal);
    expect(canActivate(main, 0, next)).toBe(true);
  });

  it('forgets a legion that ended early (leader ridden over): no choice is asked', () => {
    const { s, leader } = setup();
    const { r, mate } = seek(s, leader);
    const st = structuredClone(r.state);
    st.phase = 'ride';
    st.turnFlags.normalRideUsed = false;
    const p = st.players[0];
    const g3 = p.deck.find((id) => def(st, id) === G3)!;
    p.deck.splice(p.deck.indexOf(g3), 1);
    p.hand.push(g3);
    let t = then({ state: st, events: [] }, { type: 'RIDE', player: 0, cardId: g3 });
    expect(t.state.players[0].soul).toEqual(expect.arrayContaining([leader, mate]));
    t = then(t, endPhase(0), endPhase(0), endPhase(0), endPhase(1), endPhase(1), endPhase(1));
    expect(t.state.activePlayer).toBe(0);
    expect(t.state.pendingChoice).toBeNull();
    expect(t.state.delayedLegions).toEqual([]);
    expect(t.state.phase).toBe('ride');
  });

  it('standard Seek Mate is unchanged when the rule is off', () => {
    const { s, leader } = setup({ rule: false, eligible: 2, extra: [SENTINEL, CRIT] });
    expect(s.customRules).toBeUndefined();
    // any four drop cards pay, triggers and sentinels included (forced: exactly four)
    const { r, mate } = seek(s, leader);
    expect(r.state.players[0].drop).toEqual([]);
    expect(find(r.events, 'DECK_SHUFFLED')).toHaveLength(1);
    expect(r.state.delayedLegions).toBeUndefined();
    const t = toNextStandPhase(r);
    expect(t.state.pendingChoice).toBeNull();
    expect(t.state.players[0].legion).toEqual({ leader, mate });
  });

  it('save and load keeps the rule, the pending legion and the restriction', () => {
    const { s, leader } = setup();
    const { r, mate } = seek(s, leader);
    // saved between turns
    let loaded = save(r.state);
    expect(loaded.customRules).toEqual({ delayedLegion: true });
    expect(loaded.delayedLegions).toEqual([{ player: 0, leader, mate }]);
    let t = toNextStandPhase({ state: loaded, events: [] });
    expect(t.state.pendingChoice).toMatchObject({ kind: 'soul_or_drop' });
    // saved while the choice is waiting
    loaded = save(t.state);
    t = answer({ state: loaded, events: [] }, 'soul');
    expect(t.state.players[0].soul).toContain(mate);
    expect(t.state.players[0].legion).toBeNull();
    // the restriction survives a save too
    t = then(t, endPhase(0));
    const main = save(t.state);
    toDrop(main, 4, normal);
    expect(canActivate(main, 0, leader)).toBe(false);
  });
});
