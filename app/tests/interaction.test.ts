import { describe, expect, it } from 'vitest';
import type { AttackOption, Circle, GameState, LegalAction } from '../../src/engine';
import {
  choiceReady,
  circleState,
  clickCircle,
  clickHand,
  defaultBooster,
  legalOf,
  type Legal,
} from '../renderer/game/interaction';

/** Just enough GameState for the interaction helpers (they only read circles and legion). */
function board(units: {
  me?: Partial<Record<Circle, string>>;
  ai?: Partial<Record<Circle, string>>;
}) {
  const circles = (u: Partial<Record<Circle, string>> = {}) => ({
    vanguard: u.vanguard ? [u.vanguard] : [],
    front_left: u.front_left ? [u.front_left] : [],
    front_right: u.front_right ? [u.front_right] : [],
    back_left: u.back_left ? [u.back_left] : [],
    back_center: u.back_center ? [u.back_center] : [],
    back_right: u.back_right ? [u.back_right] : [],
  });
  return {
    players: [
      { circles: circles(units.me), legion: null },
      { circles: circles(units.ai), legion: null },
    ],
  } as unknown as GameState;
}

const legal = (actions: LegalAction[]): Legal => legalOf(actions);

const attack: AttackOption = {
  attacker: 'vg',
  attackerCircle: 'vanguard',
  targets: [
    { id: 'opp-vg', circle: 'vanguard' },
    { id: 'opp-fl', circle: 'front_left' },
  ],
  boosters: [{ id: 'bc', circle: 'back_center' }],
};

const s = board({
  me: { vanguard: 'vg', back_center: 'bc', front_left: 'fl' },
  ai: { vanguard: 'opp-vg', front_left: 'opp-fl' },
});

describe('legalOf', () => {
  it('collects every kind of legal action', () => {
    const l = legal([
      { type: 'RIDE', cardIds: ['h1'] },
      { type: 'CALL', cardIds: ['h2'], circles: ['front_left'] },
      { type: 'END_PHASE', phase: 'main' },
    ]);
    expect([...l.ride]).toEqual(['h1']);
    expect([...l.call]).toEqual(['h2']);
    expect(l.callCircles).toEqual(['front_left']);
    expect(l.endPhase).toBe(true);
    expect(l.passGuard).toBe(false);
    expect(l.choose).toBeNull();
  });
});

describe('clickHand', () => {
  it('toggles cards during the mulligan', () => {
    expect(clickHand(legal([{ type: 'MULLIGAN', selectable: ['h1'] }]), null, 'h1')).toEqual({
      do: 'toggle_choice',
      option: 'h1',
    });
  });

  it('guards immediately with a guardable card', () => {
    const l = legal([
      { type: 'GUARD', cardIds: ['h1'], guardable: ['vg'] },
      { type: 'PASS_GUARD' },
    ]);
    expect(clickHand(l, null, 'h1')).toEqual({
      do: 'command',
      command: { type: 'GUARD', player: 0, cardId: 'h1' },
    });
    expect(clickHand(l, null, 'h2')).toEqual({ do: 'details', id: 'h2' });
  });

  it('selects a usable card, and a second click deselects it', () => {
    const l = legal([{ type: 'RIDE', cardIds: ['h1'] }]);
    expect(clickHand(l, null, 'h1')).toEqual({
      do: 'select',
      selection: { kind: 'hand', id: 'h1' },
    });
    expect(clickHand(l, { kind: 'hand', id: 'h1' }, 'h1')).toEqual({
      do: 'select',
      selection: null,
    });
  });

  it('picks hand cards that are options of a pending choice', () => {
    const l = legal([
      {
        type: 'CHOOSE',
        choiceId: 1,
        kind: 'cost',
        options: ['h1'],
        min: 1,
        max: 1,
        prompt: 'Discard 1',
      } as LegalAction,
    ]);
    expect(clickHand(l, null, 'h1')).toEqual({ do: 'toggle_choice', option: 'h1' });
    expect(clickHand(l, null, 'h2')).toEqual({ do: 'details', id: 'h2' });
  });
});

describe('clickCircle', () => {
  const rideCall = legal([
    { type: 'RIDE', cardIds: ['h1'] },
    { type: 'CALL', cardIds: ['h2'], circles: ['front_right', 'back_left'] },
  ]);

  it('rides onto the vanguard circle and calls onto a legal rear-guard circle', () => {
    expect(clickCircle(s, rideCall, { kind: 'hand', id: 'h1' }, 0, 'vanguard')).toEqual({
      do: 'command',
      command: { type: 'RIDE', player: 0, cardId: 'h1' },
    });
    expect(clickCircle(s, rideCall, { kind: 'hand', id: 'h2' }, 0, 'front_right')).toEqual({
      do: 'command',
      command: { type: 'CALL', player: 0, cardId: 'h2', circle: 'front_right' },
    });
  });

  it('does not call onto a circle the engine did not offer', () => {
    const click = clickCircle(s, rideCall, { kind: 'hand', id: 'h2' }, 0, 'back_right');
    expect(click.do).not.toBe('command');
  });

  it('selects an attacker with the unit behind it as the default booster', () => {
    const l = legal([{ type: 'ATTACK', options: [attack] }]);
    expect(clickCircle(s, l, null, 0, 'vanguard')).toEqual({
      do: 'select',
      selection: { kind: 'attacker', id: 'vg', booster: 'bc' },
    });
  });

  it('toggles the booster and attacks a legal target', () => {
    const l = legal([{ type: 'ATTACK', options: [attack] }]);
    const sel = { kind: 'attacker', id: 'vg', booster: 'bc' } as const;
    expect(clickCircle(s, l, sel, 0, 'back_center')).toEqual({
      do: 'select',
      selection: { ...sel, booster: null },
    });
    expect(clickCircle(s, l, sel, 1, 'front_left')).toEqual({
      do: 'command',
      command: { type: 'ATTACK', player: 0, attacker: 'vg', target: 'opp-fl', booster: 'bc' },
    });
  });

  it('intercepts with a legal front-row rear-guard', () => {
    const l = legal([
      { type: 'INTERCEPT', unitIds: ['fl'], guardable: ['vg'] },
      { type: 'PASS_GUARD' },
    ]);
    expect(clickCircle(s, l, null, 0, 'front_left')).toEqual({
      do: 'command',
      command: { type: 'INTERCEPT', player: 0, unitId: 'fl' },
    });
  });

  it('answers a circle choice with the circle, only on my side', () => {
    const l = legal([
      {
        type: 'CHOOSE',
        choiceId: 2,
        kind: 'circle',
        options: ['front_right'],
        min: 1,
        max: 1,
        prompt: 'Choose a circle',
      } as LegalAction,
    ]);
    expect(clickCircle(s, l, null, 0, 'front_right')).toEqual({
      do: 'toggle_choice',
      option: 'front_right',
    });
    expect(clickCircle(s, l, null, 1, 'front_right')).toEqual({ do: 'nothing' });
  });

  it("shows details for a unit that can't do anything", () => {
    expect(clickCircle(s, legal([]), null, 1, 'vanguard')).toEqual({
      do: 'details',
      id: 'opp-vg',
    });
  });
});

describe('multi-unit attacks', () => {
  const l = legal([
    { type: 'GUARD', cardIds: ['h1'], guardable: ['vg', 'fl'] },
    { type: 'INTERCEPT', unitIds: ['fr'], guardable: ['vg', 'fl'] },
    { type: 'PASS_GUARD' },
  ]);
  const multi = board({ me: { vanguard: 'vg', front_left: 'fl', front_right: 'fr' } });

  it('a guard card first asks which attacked unit it guards', () => {
    expect(clickHand(l, null, 'h1')).toEqual({
      do: 'select',
      selection: { kind: 'guard', id: 'h1' },
    });
    const sel = { kind: 'guard', id: 'h1' } as const;
    expect(circleState(multi, l, sel, [], 0, 'front_left').mark).toBe('choice');
    expect(circleState(multi, l, sel, [], 0, 'front_right').mark).toBeNull();
    expect(clickCircle(multi, l, sel, 0, 'front_left')).toEqual({
      do: 'command',
      command: { type: 'GUARD', player: 0, cardId: 'h1', guarding: 'fl' },
    });
  });

  it('an interceptor too', () => {
    expect(clickCircle(multi, l, null, 0, 'front_right')).toEqual({
      do: 'select',
      selection: { kind: 'intercept', id: 'fr' },
    });
    expect(clickCircle(multi, l, { kind: 'intercept', id: 'fr' }, 0, 'vanguard')).toEqual({
      do: 'command',
      command: { type: 'INTERCEPT', player: 0, unitId: 'fr', guarding: 'vg' },
    });
  });
});

describe('circleState', () => {
  it('marks ride and call circles for a selected hand card', () => {
    const l = legal([{ type: 'CALL', cardIds: ['h2'], circles: ['back_left'] }]);
    const sel = { kind: 'hand', id: 'h2' } as const;
    expect(circleState(s, l, sel, [], 0, 'back_left').mark).toBe('call');
    expect(circleState(s, l, sel, [], 0, 'vanguard').mark).toBeNull();
  });

  it('marks targets and the chosen booster while attacking', () => {
    const l = legal([{ type: 'ATTACK', options: [attack] }]);
    const sel = { kind: 'attacker', id: 'vg', booster: 'bc' } as const;
    expect(circleState(s, l, sel, [], 1, 'vanguard').mark).toBe('target');
    expect(circleState(s, l, sel, [], 0, 'back_center')).toEqual({
      mark: 'booster',
      selected: 'booster',
    });
    expect(circleState(s, l, sel, [], 0, 'vanguard').selected).toBe('attacker');
  });
});

describe('helpers', () => {
  it('defaultBooster is the unit behind the attacker, if it may boost', () => {
    expect(defaultBooster(attack)).toBe('bc');
    expect(defaultBooster({ ...attack, boosters: [] })).toBeNull();
  });

  it('choiceReady respects min and max', () => {
    const ch = { min: 1, max: 2 } as Parameters<typeof choiceReady>[0];
    expect(choiceReady(ch, [])).toBe(false);
    expect(choiceReady(ch, ['a'])).toBe(true);
    expect(choiceReady(ch, ['a', 'b', 'c'])).toBe(false);
  });
});
