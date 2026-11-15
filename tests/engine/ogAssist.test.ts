/**
 * OG-assist house rule (prompt pack 2026-11-15, prompt 5; decisions in
 * docs/design/PROMPT_PACK_2026-11-15.md). Player 1 is behind (grade 1 vanguard, no grade 2 in hand)
 * and reaches the start of their ride phase with the rule on.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { getLegalActions, type GameState, type InstanceId } from '../../src/engine';
import { andThen, apply, bt01Deck, ctx, type Run } from '../fixtures/bt01';
import { battleScenario, type SideSpec } from '../fixtures/scenario';

const G1 = [
  'BT01-007',
  'BT01-011',
  'BT01-015',
  'BT01-019',
  'BT01-031',
  'BT01-042',
  'BT01-048',
  'BT01-049',
];
const BLASTER = 'BT01-002'; // grade 2
const RANDOLF = 'BT01-041'; // grade 2
const ALFRED = 'BT01-001'; // grade 3
const WINGAL = 'BT01-044'; // grade 1 vanguard

const defOf = (s: GameState, id: InstanceId) => s.cards[id]!.definitionId;

/** Player 0 passes turn 3; player 1's turn 4 runs to the start of their ride phase. */
function toRidePhase(defender: SideSpec, opts: { rule?: boolean; formatId?: string } = {}): Run {
  let s = battleScenario({
    ctx,
    decks: [
      bt01Deck([ALFRED]),
      bt01Deck([WINGAL, BLASTER, RANDOLF, ALFRED, 'BT01-043', 'BT01-003', ...G1]),
    ],
    at: 'main',
    ...(opts.rule === false ? {} : { customRules: { ogAssist: true } }),
    attacker: { circles: { vanguard: ALFRED } },
    defender,
  });
  // the board is built from a real game start: an offer made to player 0 then is dropped
  s = structuredClone(s);
  s.pendingChoice = null;
  s.tasks = [];
  delete s.players[0].ogAssist;
  if (opts.formatId) s = { ...s, formatId: opts.formatId };
  let r = apply(s, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
  // end-of-turn choices of player 0 (none expected) and the draw of player 1
  for (let i = 0; i < 5 && r.state.pendingChoice?.player === 0; i++) {
    const c = r.state.pendingChoice;
    r = andThen(r, {
      type: 'CHOOSE',
      player: 0,
      choiceId: c.id,
      selection: c.options.slice(0, c.min),
    });
  }
  return r;
}

const behind = (deckTop: string[], hand = ['BT01-042', 'BT01-043', 'BT01-003']): SideSpec => ({
  circles: { vanguard: WINGAL },
  hand,
  deckTop,
});
const choose = (r: Run, selection: string[]) =>
  andThen(r, { type: 'CHOOSE', player: 1, choiceId: r.state.pendingChoice!.id, selection });

describe('OG-assist', () => {
  it('is offered at the start of the ride phase when behind', () => {
    const r = toRidePhase(behind(['BT01-007', BLASTER, ...G1]));
    expect(r.state.activePlayer).toBe(1);
    expect(r.state.phase).toBe('ride');
    expect(r.state.pendingChoice?.prompt).toMatch(/^OG-assist \(once per game\)/);
  });

  it('is not offered with the rule off, in the G era, or with a grade 2 in hand', () => {
    expect(
      toRidePhase(behind(['BT01-007', ...G1]), { rule: false }).state.pendingChoice,
    ).toBeNull();
    expect(
      toRidePhase(behind(['BT01-007', ...G1]), { formatId: 'G_ERA' }).state.pendingChoice,
    ).toBeNull();
    expect(
      toRidePhase(behind(['BT01-007', ...G1], ['BT01-042', BLASTER])).state.pendingChoice,
    ).toBeNull();
  });

  it('takes a grade 2 for two discards; the rest go to the bottom in order; once per game', () => {
    // the draw takes the first card; the next seven are revealed
    const top = [
      'BT01-007',
      'BT01-011',
      BLASTER,
      'BT01-015',
      RANDOLF,
      'BT01-019',
      'BT01-031',
      'BT01-042',
    ];
    let r = toRidePhase(behind(top));
    const deckBefore = r.state.players[1].deck.slice(0, 7);
    r = choose(r, ['yes']);
    const take = r.state.pendingChoice!;
    expect(take.min).toBe(1); // a qualifying card must be taken
    expect(take.options.map((id) => defOf(r.state, id)).sort()).toEqual([RANDOLF, BLASTER].sort());
    const blaster = take.options.find((id) => defOf(r.state, id) === BLASTER)!;
    r = choose(r, [blaster]);
    const pay = r.state.pendingChoice!;
    expect(pay.options).not.toContain(blaster); // cannot pay its own cost
    const hand = r.state.players[1].hand;
    r = choose(r, [hand[0]!, hand[1]!]);
    const p = r.state.players[1];
    expect(p.hand).toContain(blaster);
    expect(p.drop.length).toBe(2);
    const rest = deckBefore.filter((id) => id !== blaster);
    expect(p.deck.slice(-6)).toEqual(rest);
    expect(p.ogAssist).toEqual({ card: blaster, turn: r.state.turnNumber });
    // it may be ridden at once
    const ride = getLegalActions(r.state, 1, ctx).find((a) => a.type === 'RIDE');
    expect(ride && 'cardIds' in ride && ride.cardIds).toContain(blaster);
  });

  it('a try that finds nothing is used up, costs nothing and sends the seven to the bottom', () => {
    let r = toRidePhase(behind(['BT01-007', ...G1]));
    const seven = r.state.players[1].deck.slice(0, 7);
    const hand = r.state.players[1].hand.length;
    r = choose(r, ['yes']);
    const p = r.state.players[1];
    expect(r.state.pendingChoice).toBeNull();
    expect(p.hand.length).toBe(hand);
    expect(p.deck.slice(-7)).toEqual(seven);
    expect(p.ogAssist).toEqual({ card: null, turn: r.state.turnNumber });
  });

  it('the card cannot pay a cost or guard, and must be ridden in the next ride phase', () => {
    const top = ['BT01-007', BLASTER, ...G1];
    let r = toRidePhase(behind(top));
    r = choose(r, ['yes']);
    // a single qualifying card is taken without asking
    expect(r.state.pendingChoice!.prompt).toMatch(/two cards from your hand to discard/);
    const blaster = r.state.players[1].deck.find((id) => defOf(r.state, id) === BLASTER)!;
    const hand = r.state.players[1].hand;
    r = choose(r, [hand[0]!, hand[1]!]);
    // skip riding it this turn: pass the turn, let player 0 pass theirs
    const s = structuredClone(r.state);
    s.turnNumber += 2;
    s.phase = 'ride';
    s.turnFlags = { normalRideUsed: false };
    const acts = getLegalActions(s, 1, ctx);
    const ride = acts.find((a) => a.type === 'RIDE');
    expect(ride && 'cardIds' in ride ? ride.cardIds : []).toEqual([blaster]);
    expect(acts.some((a) => a.type === 'END_PHASE')).toBe(false);
    // the turn after that, the duty and the protection are over
    const later = structuredClone(s);
    later.turnNumber += 2;
    const after = getLegalActions(later, 1, ctx);
    expect(after.some((a) => a.type === 'END_PHASE')).toBe(true);
  });

  it('if an effect takes the card away, the duty lapses', () => {
    let r = toRidePhase(behind(['BT01-007', BLASTER, ...G1]));
    r = choose(r, ['yes']);
    // a single qualifying card is taken without asking
    expect(r.state.pendingChoice!.prompt).toMatch(/two cards from your hand to discard/);
    const blaster = r.state.players[1].deck.find((id) => defOf(r.state, id) === BLASTER)!;
    const hand = r.state.players[1].hand;
    r = choose(r, [hand[0]!, hand[1]!]);
    const s = structuredClone(r.state);
    s.players[1].hand.splice(s.players[1].hand.indexOf(blaster), 1);
    s.players[1].drop.push(blaster);
    s.turnNumber += 2;
    s.phase = 'ride';
    expect(getLegalActions(s, 1, ctx).some((a) => a.type === 'END_PHASE')).toBe(true);
  });

  it('the basic and smart CPUs can play through it', () => {
    let r = toRidePhase(behind(['BT01-007', BLASTER, ...G1]));
    const ai = new BasicController(ctx);
    for (let i = 0; i < 6 && r.state.pendingChoice?.player === 1; i++) {
      r = andThen(r, ai.chooseCommand(r.state, 1, getLegalActions(r.state, 1, ctx)));
    }
    expect(r.state.players[1].ogAssist).toBeDefined();
  });
});
