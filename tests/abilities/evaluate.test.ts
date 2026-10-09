import { describe, expect, it } from 'vitest';
import {
  ab,
  CardRegistry,
  CardDefinitionError,
  evaluate,
  select,
  validateAbilities,
  type EvalContext,
  type GameState,
} from '../../src/engine';
import { SYNTHETIC_CARDS, testContext } from '../fixtures/syntheticCards';
import { battleScenario, run, unitAt } from '../fixtures/scenario';

const { self, bound, units, cards, exists, count, is, yourTurn, not, all, any, inSoul } = ab;

/** Player 0 (turn player): VC G3, front_left G2 (rested), back_left G1; damage 2; soul has the starter. */
function board(): GameState {
  return battleScenario({
    attacker: {
      circles: { vanguard: 'TEST-013', front_left: 'TEST-010', back_left: 'TEST-006' },
      rested: ['front_left'],
      hand: ['TEST-002', 'TEST-011'],
      damage: ['TEST-009', 'TEST-012'],
    },
    defender: { circles: { vanguard: 'TEST-014', front_right: 'TEST-007' } },
  });
}

const ecFor = (state: GameState, master: 0 | 1, source: string, bindings = {}): EvalContext => ({
  state,
  ctx: testContext,
  master,
  source,
  bindings,
  eventCard: null,
});

describe('selectors', () => {
  it('select units by owner and area, relative to the master', () => {
    const s = board();
    const vg = unitAt(s, 0, 'vanguard');
    const ec = ecFor(s, 0, vg);
    expect(select(ec, units('you'))).toEqual([
      vg,
      unitAt(s, 0, 'front_left'),
      unitAt(s, 0, 'back_left'),
    ]);
    expect(select(ec, units('opponent', ['RC']))).toEqual([unitAt(s, 1, 'front_right')]);
    expect(select(ec, units('you', ['front_RC']))).toEqual([unitAt(s, 0, 'front_left')]);
    expect(select(ec, units('you', ['back_RC']))).toEqual([unitAt(s, 0, 'back_left')]);
    // the same selector from player 1's point of view
    expect(select(ecFor(s, 1, vg), units('opponent', ['VC']))).toEqual([vg]);
  });

  it('filters by grade range, trigger, orientation, name and self', () => {
    const s = board();
    const vg = unitAt(s, 0, 'vanguard');
    const ec = ecFor(s, 0, vg);
    expect(select(ec, units('you', ['VC', 'RC'], { grade: { min: 2 } }))).toHaveLength(2);
    expect(select(ec, units('you', ['VC', 'RC'], { orientation: 'rest' }))).toEqual([
      unitAt(s, 0, 'front_left'),
    ]);
    expect(select(ec, cards('you', ['hand'], { trigger: 'any' }))).toHaveLength(1);
    expect(select(ec, cards('you', ['hand'], { trigger: 'none' }))).toHaveLength(1);
    expect(select(ec, units('you', ['VC', 'RC'], { excludeSelf: true }))).not.toContain(vg);
    expect(select(ec, units('any', ['VC'], { name: 'Test Grade 3 B' }))).toEqual([
      unitAt(s, 1, 'vanguard'),
    ]);
    expect(select(ec, self())).toEqual([vg]);
  });

  it('bound and battle-role selectors', () => {
    const s0 = board();
    const vg = unitAt(s0, 0, 'vanguard');
    const bl = unitAt(s0, 0, 'back_left');
    expect(select(ecFor(s0, 0, vg, { t: [bl] }), bound('t'))).toEqual([bl]);
    expect(select(ecFor(s0, 0, vg), ab.attackingUnit())).toEqual([]);

    // stand the rested rear-guard and attack with it, boosted
    const s1 = structuredClone(s0);
    const fl = unitAt(s1, 0, 'front_left');
    s1.cards[fl]!.orientation = 'stand';
    const target = unitAt(s1, 1, 'vanguard');
    const s = run(s1, { type: 'ATTACK', player: 0, attacker: fl, target, booster: bl });
    const ec = ecFor(s, 1, target);
    expect(select(ec, ab.attackingUnit())).toEqual([fl]);
    expect(select(ec, ab.boostingUnit())).toEqual([bl]);
    expect(select(ec, ab.boostedUnit())).toEqual([fl]);
    expect(select(ec, ab.attackedUnit())).toEqual([target]);
    expect(select(ec, units('you', ['VC'], { beingAttacked: true }))).toEqual([target]);
  });
});

describe('conditions', () => {
  it('count, exists, is, turn, not/all/any', () => {
    const s = board();
    const vg = unitAt(s, 0, 'vanguard');
    const mine = ecFor(s, 0, vg);
    const theirs = ecFor(s, 1, unitAt(s, 1, 'vanguard'));
    expect(evaluate(mine, ab.damageAtLeast(2))).toBe(true);
    expect(evaluate(mine, ab.damageAtLeast(3))).toBe(false);
    expect(evaluate(mine, exists(units('opponent', ['RC'])))).toBe(true);
    expect(evaluate(mine, count(units('you', ['RC']), { min: 2, max: 2 }))).toBe(true);
    expect(evaluate(mine, is(self(), { grade: { min: 3 } }))).toBe(true);
    expect(evaluate(mine, yourTurn())).toBe(true);
    expect(evaluate(theirs, yourTurn())).toBe(false);
    expect(evaluate(mine, not(yourTurn()))).toBe(false);
    expect(evaluate(mine, all(yourTurn(), ab.damageAtLeast(3)))).toBe(false);
    expect(evaluate(mine, any(yourTurn(), ab.damageAtLeast(3)))).toBe(true);
    expect(evaluate(mine, inSoul('Test Starter'))).toBe(true);
  });

  it('clan relative to the source (Lord / Forerunner)', () => {
    const s = board();
    const vg = unitAt(s, 0, 'vanguard');
    const ec = ecFor(s, 0, vg);
    expect(
      evaluate(ec, exists(units('you', ['VC', 'RC'], { differentClanFromSource: true }))),
    ).toBe(false);
    expect(select(ec, units('you', ['VC', 'RC'], { sameClanAsSource: true }))).toHaveLength(3);
  });
});

describe('ability validation', () => {
  const text = 'x';
  it('accepts well-formed abilities and the keyword builders', () => {
    const abilities = [
      ab.auto({
        id: '1',
        zones: ['any'],
        text,
        trigger: ab.placedOn('VC'),
        cost: [ab.counterBlast(2)],
        optional: true,
        effect: [ab.choose('t', units('opponent', ['RC'])), ab.retire(bound('t'))],
      }),
      ab.act({
        id: '2',
        zones: ['VC'],
        text,
        cost: [ab.counterBlast(2)],
        effect: [ab.if_(inSoul('Blaster Blade'), [ab.power(self(), 5000), ab.critical(self(), 1)])],
      }),
      ab.cont({
        id: '3',
        zones: ['VC'],
        text,
        condition: yourTurn(),
        effects: [ab.gets(self(), 'power', 2000, units('you', ['RC'], { clan: 'Royal Paladin' }))],
      }),
      ab.restraint(),
      ab.lord(),
      ab.forerunner(),
    ];
    expect(validateAbilities('X', abilities)).toEqual([]);
  });

  it('reports authoring mistakes', () => {
    const problems = validateAbilities('X', [
      ab.act({
        id: '1',
        zones: ['VC'],
        text,
        cost: [ab.counterBlast(0)],
        effect: [ab.retire(bound('t'))],
      }),
      ab.act({ id: '1', zones: [], text: '', cost: [], effect: [ab.retire(ab.eventCard())] }),
      ab.auto({
        id: '2',
        zones: ['VC'],
        text,
        trigger: ab.attacks(),
        optional: true,
        effect: [ab.draw(0)],
      }),
    ]);
    expect(problems).toEqual([
      'X/1: cost: cost count must be ≥ 1',
      'X/1: effect retire uses "t" before it is chosen',
      'X/1: duplicate ability id',
      'X/1: ability has no active zone',
      'X/1: missing text',
      'X/1: effect retire: event_card outside an AUTO ability',
      'X/2: optional is only meaningful with a cost',
      'X/2: effect draw: n must be ≥ 1',
    ]);
  });

  it('the card registry refuses cards with invalid abilities', () => {
    const bad = {
      ...SYNTHETIC_CARDS[0]!,
      id: 'BAD-001',
      abilities: [
        ab.act({ id: '1', zones: ['VC'], text: 'x', cost: [], effect: [ab.retire(bound('nope'))] }),
      ],
    };
    expect(() => new CardRegistry([bad], 't')).toThrow(CardDefinitionError);
  });
});
