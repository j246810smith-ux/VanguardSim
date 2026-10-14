/** EB06 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { andThen as then, apply, ctx, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand } from '../fixtures/cardTest';
import { onField, pull, settle } from '../fixtures/setHelpers';
import {
  attackPumps,
  callIt,
  canAttack,
  fillSoul,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const BT_G1 = 'EB02-023'; // Mermaid Idol, Felucca
const BT_G2 = 'EB02-012'; // Mermaid Idol, Flute
const BT_G3 = 'EB02-008'; // Super Idol, Ceram

const inSoul = (s: GameState, def: string) => {
  const [id] = pull(s, def, 'drop');
  s.players[0].drop.splice(s.players[0].drop.indexOf(id!), 1);
  s.players[0].soul.push(id!);
  return id!;
};
const strike = (
  s: GameState,
  from: 'vanguard' | 'front_left',
  booster?: 'back_center' | 'back_left',
  prefer: string[] = [],
) =>
  settle(
    apply(
      s,
      attack(unitAt(s, 0, from), unitAt(s, 1, 'vanguard'), booster ? unitAt(s, 0, booster) : null),
    ),
    prefer,
  );
const call = (
  s: GameState,
  def: string,
  circle: 'front_left' | 'back_left' = 'front_left',
  prefer: string[] = [],
) => drain(apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, def), circle }), 0, prefer);

describe('EB06 grade 3s', () => {
  it('EB06-001 Eternal Idol, Pacifica: Lord; +2000 with Top Idol, Pacifica in the soul; [LB4, CB3] returns two rear-guards and calls one from the deck', () => {
    expect(canAttack('EB06-001', OPP)).toBe(false);
    const s = scene({
      attacker: {
        circles: { vanguard: 'EB06-001', front_left: BT_G1, back_left: BT_G1 },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['EB02-001'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    inSoul(s, 'EB02-001');
    expect(pw(s, vg)).toBe(base + 2000);
    const rgs = [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'back_left')];
    const r = strike(s, 'vanguard', undefined, rgs);
    for (const id of rgs) expect(r.state.players[0].hand).toContain(id);
    expect(onField(r.state, 0)).toHaveLength(2);
  });

  it('EB06-002 Labrador: [LB4] attacking, calls three PR♥ISM from hand for +10000/critical +1; [CB1 PR♥ISM] returns a PR♥ISM rear-guard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'EB06-002' },
        hand: ['EB06-013', 'EB06-013', 'EB06-011'],
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = strike(s, 'vanguard', undefined, [...s.players[0].hand]);
    expect(onField(r.state, 0)).toHaveLength(4);
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(
      find(r.events, 'MODIFIER_ADDED').some(
        (e) => e.modifier.target === vg && e.modifier.stat === 'critical',
      ),
    ).toBe(true);
    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB06-002', front_left: 'EB06-013' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const prism = t.players[0].damage[0]!;
    (t.cards[prism] as { definitionId: string }).definitionId = 'EB06-013';
    const rr = drain(apply(t, activate(unitAt(t, 0, 'vanguard'), '2')));
    expect(rr.state.players[0].hand).toContain(unitAt(t, 0, 'front_left'));
  });

  it('EB06-003 Vert: [LB4] when a Bermuda Triangle rides it, draw, return two rear-guards and the vanguard gets +10000; +2000 with four rear-guards', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'EB06-003', front_left: BT_G1 },
        hand: [BT_G3],
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, BT_G3) }), 0, [
      unitAt(s, 0, 'front_left'),
    ]);
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'front_left'));
    const four = scene({
      attacker: {
        circles: {
          vanguard: 'EB06-003',
          front_left: BT_G1,
          front_right: BT_G1,
          back_left: BT_G1,
          back_right: BT_G1,
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(four, unitAt(four, 0, 'vanguard'))).toBe(13000);
  });

  it('EB06-004 Aurora Star, Coral: [LB4, CB2] attacking: Soul-Charge 1, return a rear-guard, +5000; +1000 with Shiny Star in the soul', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB06-004', front_left: BT_G1 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      extra: [['EB06-010'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    inSoul(s, 'EB06-010');
    expect(pw(s, vg)).toBe(base + 1000);
    const r = strike(s, 'vanguard');
    expect(boosts(r, vg, 5000)).toBe(1);
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'front_left'));
  });

  it('EB06-008 Ionia: [LB4] +5000 attacking a vanguard; +2000 on (RC) with a Bermuda Triangle vanguard', () => {
    expect(attackPumps('EB06-008', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('EB06-008', 2000, { on: 'front_left', vanguard: BT_G2 })).toBe(1);
  });

  it('EB06-016 Minato: +10000 when your grade 3 Bermuda Triangle is placed on (VC)', () => {
    const { s, r } = rideIt(BT_G3, { vanguard: BT_G2, others: { front_left: 'EB06-016' } });
    expect(boosts(r, unitAt(s, 0, 'front_left'), 10000)).toBe(1);
  });

  it('EB06-017 Etoile: +2000 boosted by a Bermuda Triangle', () => {
    expect(attackPumps('EB06-017', 2000, { booster: BT_G1 })).toBe(1);
  });
});

describe('EB06 returning to hand', () => {
  it.each(['EB06-005', 'EB06-006', 'EB06-035'])(
    '%s: [SB1] returned to your hand, another Bermuda Triangle gets +4000',
    (card) => {
      // Sweets Harmony, Mona returns it
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: BT_G2, back_left: card },
          hand: ['EB06-012'],
          damage: vanilla(1),
        },
        defender: { circles: { vanguard: OPP } },
      });
      fillSoul(s, 0, 1);
      const unit = unitAt(s, 0, 'back_left');
      const r = call(s, 'EB06-012', 'front_left', [unit, unitAt(s, 0, 'vanguard')]);
      expect(r.state.players[0].hand).toContain(unit);
      expect(find(r.events, 'MODIFIER_ADDED').some((e) => e.modifier.amount === 4000)).toBe(true);
    },
  );

  it('EB06-012 Mona: [CB1] placed, returns another rear-guard (see above); EB06-027 Coro follows it back', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: BT_G2, back_left: BT_G1, back_right: 'EB06-027' },
        hand: ['EB06-012'],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = call(s, 'EB06-012', 'front_left', [unitAt(s, 0, 'back_left')]);
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'back_left'));
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'back_right'));
  });

  it('EB06-010 Shiny Star, Coral: its hit returns a front-row unit, and a back-row one with Fresh Star in the soul; +1000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB06-010', front_left: BT_G1, back_left: BT_G1 } },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['EB06-022'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    inSoul(s, 'EB06-022');
    expect(pw(s, vg)).toBe(base + 1000);
    const rgs = [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'back_left')];
    const r = strike(s, 'vanguard', undefined, rgs);
    for (const id of rgs) expect(r.state.players[0].hand).toContain(id);
  });
});

describe('EB06 others', () => {
  it.each(['EB06-011', 'EB06-013'])('%s: +3000 attacking with a PR♥ISM vanguard', (card) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: 'EB06-002' })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: BT_G2 })).toBe(0);
  });

  it('EB06-014 Biscayne: [SB1] placed, takes another Biscayne from the top seven', () => {
    const { s, r } = callIt('EB06-014', {
      vanguard: BT_G2,
      soul: 1,
      before: (st) => void pull(st, 'EB06-014', 'top'),
    });
    expect(r.state.players[0].hand.map((x) => r.state.cards[x]!.definitionId)).toContain(
      'EB06-014',
    );
    void s;
  });

  it('EB06-015 / EB06-022 Coral ride chain', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB06-015' }, hand: ['EB06-022'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB06-010'], []],
    });
    const [shiny] = pull(s, 'EB06-010', 'top');
    let r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'EB06-022') }), 0, [
      shiny!,
    ]);
    expect(r.state.players[0].hand).toContain(shiny);
    // Fresh Star: a grade 2 Bermuda Triangle other than Shiny Star rides it with Angelic Star in the soul: superior ride Shiny Star
    const t = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB06-022' }, hand: [BT_G2] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB06-015', 'EB06-010'], []],
    });
    inSoul(t, 'EB06-015');
    const [star] = pull(t, 'EB06-010', 'top');
    r = drain(apply(t, { type: 'RIDE', player: 0, cardId: inHand(t, 0, BT_G2) }), 0, [star!]);
    expect(r.state.players[0].circles.vanguard[0]).toBe(star);
  });

  it.each(['EB06-018', 'EB06-025'])(
    '%s: [CB1] placed, a damage card goes in and one comes back at the end of turn',
    (card) => {
      const { s, r } = callIt(card, { vanguard: BT_G2, damage: 1 });
      expect(r.state.players[0].damage.length).toBe(s.players[0].damage.length + 1);
    },
  );

  it('EB06-019 Rosa: +3000 attacking with a Limit Break Bermuda Triangle on the field', () => {
    expect(attackPumps('EB06-019', 3000, { on: 'front_left', vanguard: 'EB06-008' })).toBe(1);
    expect(attackPumps('EB06-019', 3000, { on: 'front_left', vanguard: BT_G2 })).toBe(0);
  });

  it('EB06-020 Scotia: [CB1 Bermuda Triangle] +4000 attacking', () => {
    const run = attackPumps('EB06-020', 4000, {
      on: 'front_left',
      vanguard: BT_G2,
      damage: 1,
      before: (s) =>
        void ((s.cards[s.players[0].damage[0]!] as { definitionId: string }).definitionId = BT_G1),
    });
    expect(run).toBe(1);
  });

  it('EB06-023 Leyte: [SB1] boosting Labrador gives +5000; EB06-024 Oria: [CB1] boosting a Limit Break Bermuda Triangle gives +3000', () => {
    expect(attackPumps('EB06-002', 5000, { booster: 'EB06-023', soul: 1 })).toBe(1);
    expect(attackPumps('EB06-008', 3000, { booster: 'EB06-024', damage: 1 })).toBe(1);
  });

  it('EB06-026 Plage: goes to the soul after guarding', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: BT_G2 }, hand: ['EB06-026', OPP_G1], deckTop: vanilla(2) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    const plage = inHand(r.state, 1, 'EB06-026');
    r = settle(then(r, { type: 'GUARD', player: 1, cardId: plage }));
    expect(r.state.players[1].soul).toContain(plage);
  });

  it('EB06-028 Alk: forerunner; [soul] its boosted hit on a Limit Break unit draws', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB06-008', back_center: 'EB06-028' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = strike(s, 'vanguard', 'back_center');
    expect(r.state.players[0].soul).toContain(unitAt(s, 0, 'back_center'));
    expect(currentCritical(r.state, ctx, unitAt(s, 0, 'vanguard'))).toBe(1);
  });

  it('EB06-034 Fundy: [soul] a Bermuda Triangle gets +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: BT_G2, back_left: 'EB06-034' } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))), 0, [unitAt(s, 0, 'vanguard')]);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
  });
});
