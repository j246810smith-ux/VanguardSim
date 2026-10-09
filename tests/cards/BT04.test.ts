/**
 * BT04 card tests: every card with abilities is named here at least once (cards:report).
 */
import { describe, expect, it } from 'vitest';
import {
  currentCritical,
  currentPower,
  currentShield,
  getLegalActions,
  type Command,
  type GameState,
  type LegalAction,
  type PlayerId,
} from '../../src/engine';
import {
  andThen as then,
  answer,
  apply,
  ctx,
  find,
  scene,
  vanilla,
  type Run,
} from '../fixtures/bt01';
import { unitAt } from '../fixtures/scenario';

const legal = <T extends LegalAction['type']>(s: GameState, p: PlayerId, type: T) =>
  getLegalActions(s, p, ctx).find((a): a is Extract<LegalAction, { type: T }> => a.type === type);
const inHand = (s: GameState, p: PlayerId, def: string) =>
  s.players[p].hand.find((id) => s.cards[id]!.definitionId === def)!;
const defOf = (s: GameState, id: string) => s.cards[id]!.definitionId;
const pw = (s: GameState, id: string) => currentPower(s, ctx, id);
const attack = (attacker: string, target: string, booster: string | null = null): Command => ({
  type: 'ATTACK',
  player: 0,
  attacker,
  target,
  booster,
});
const activate = (source: string, abilityId = '1', player: PlayerId = 0): Command => ({
  type: 'ACTIVATE',
  player,
  source,
  abilityId,
});
const call = (
  cardId: string,
  circle: 'front_left' | 'back_left' | 'front_right' | 'back_right' | 'back_center',
): Command => ({ type: 'CALL', player: 0, cardId, circle });
const endPhase = (p: PlayerId = 0): Command => ({ type: 'END_PHASE', player: p });
const passGuard = (r: Run): Run =>
  legal(r.state, 1, 'PASS_GUARD') ? then(r, { type: 'PASS_GUARD', player: 1 }) : r;
const attackPower = (r: Run) => find(r.events, 'ATTACK_RESOLVED')[0]!.attackPower;
function put(s: GameState, p: PlayerId, defs: readonly string[], zone: 'soul' | 'drop') {
  const pl = s.players[p];
  return defs.map((def) => {
    const id = pl.deck.find((x) => s.cards[x]!.definitionId === def);
    if (!id) throw new Error(`put: no ${def} in deck`);
    pl.deck.splice(pl.deck.indexOf(id), 1);
    pl[zone].push(id);
    s.cards[id]!.faceUp = true;
    return id;
  });
}
const fillSoul = (s: GameState, p: PlayerId, n: number) => {
  const pl = s.players[p];
  pl.soul.push(...pl.deck.splice(pl.deck.length - n, n));
};
/** Answer `player`'s pending choices: "yes", else the first options offered. */
function drain(r: Run, player: PlayerId = 0, prefer: readonly string[] = []): Run {
  for (let i = 0; i < 30 && r.state.pendingChoice?.player === player; i++) {
    const c = r.state.pendingChoice;
    const preferred = c.options.find((o) => prefer.includes(o));
    r =
      c.kind === 'yes_no'
        ? answer(r, 'yes')
        : preferred
          ? answer(r, preferred)
          : answer(r, ...c.options.slice(0, Math.max(c.min, 1)));
  }
  return r;
}

const SP_G2 = 'BT04-023';
const SP_G1 = 'BT04-043';
const DP_G2 = 'BT04-027';
const DP_G1 = 'BT03-079';
const MC_G2 = 'BT01-040';
const MC_G1 = 'BT02-077';
const KAG_G2 = 'BT01-022';
const NG_G2 = 'BT01-030';
const NG_G1 = 'BT01-060';
const RP_G2 = 'BT01-021';
const RP_G1 = 'BT01-042';
const OPP = 'BT01-038';
const GUARD = [RP_G1];

describe('shared shapes', () => {
  it.each([
    ['BT04-011', SP_G2, SP_G1],
    ['BT04-014', DP_G2, DP_G1],
    ['BT04-017', MC_G2, MC_G1],
  ])('perfect guard %s', (pg, vg, discardDef) => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: vg }, hand: [pg, discardDef] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, pg) });
    r = passGuard(drain(r, 1));
    expect(find(r.events, 'ATTACK_RESOLVED')[0]!.hit).toBe(false);
  });

  it.each([
    ['BT04-001', 'BT04-024', 1000],
    ['BT04-004', 'BT04-012', 1000],
    ['BT04-005', 'BT04-016', 1000],
    ['BT04-006', 'BT04-018', 1000],
    ['BT04-008', 'BT04-019', 1000],
    ['BT04-012', 'BT04-054', 1000],
    ['BT04-016', 'BT04-062', 1000],
    ['BT04-018', 'BT04-070', 1000],
    ['BT04-019', 'BT04-075', 1000],
    ['BT04-024', 'BT04-046', 1000],
    ['BT04-046', 'BT04-025', 2000],
    ['BT04-054', 'BT04-030', 2000],
    ['BT04-062', 'BT04-035', 2000],
    ['BT04-070', 'BT04-037', 2000],
    ['BT04-075', 'BT04-039', 2000],
  ])('%s (VC): +power with %s in the soul', (card, named, amount) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: card } },
      defender: { circles: { vanguard: OPP } },
      extra: [[named], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    put(s, 0, [named], 'soul');
    expect(pw(s, vg)).toBe(base + amount);
  });

  it.each([
    ['BT04-025', 'BT04-046', 'BT04-024'],
    ['BT04-030', 'BT04-054', 'BT04-012'],
    ['BT04-035', 'BT04-062', 'BT04-016'],
    ['BT04-037', 'BT04-070', 'BT04-018'],
    ['BT04-039', 'BT04-075', 'BT04-019'],
  ])('%s: ridden by %s, searches %s', (g0, rider, findDef) => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: g0 }, hand: [rider] },
      defender: { circles: { vanguard: OPP } },
      extra: [[findDef], []],
    });
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, rider) });
    r = answer(r, r.state.pendingChoice!.options[0]!);
    expect(r.state.players[0].hand.map((id) => defOf(r.state, id))).toEqual([findDef]);
  });

  it.each([
    ['BT04-046', SP_G2, 'BT04-021', 'BT04-001'],
    ['BT04-054', DP_G2, 'BT04-026', 'BT04-004'],
    ['BT04-062', MC_G2, 'BT04-031', 'BT04-005'],
    ['BT04-070', KAG_G2, 'BT04-068', 'BT04-006'],
    ['BT04-075', NG_G2, 'BT04-038', 'BT04-008'],
  ])('%s: placed on RC, discard a grade 3 to search for its grade 3', (card, vg, g3, findDef) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg }, hand: [card, g3] },
      defender: { circles: { vanguard: OPP } },
      extra: [[findDef], []],
    });
    let r = apply(s, call(inHand(s, 0, card), 'back_left'));
    r = answer(r, 'yes');
    r = drain(r);
    expect(r.state.players[0].drop.map((id) => defOf(r.state, id))).toContain(g3);
    expect(r.state.players[0].hand.map((id) => defOf(r.state, id))).toEqual([findDef]);
  });

  it.each([
    ['BT04-041', SP_G2, 'BT04-024'],
    ['BT04-053', DP_G2, 'BT04-012'],
    ['BT04-060', MC_G2, 'BT04-016'],
    ['BT04-069', KAG_G2, 'BT04-018'],
    ['BT04-073', NG_G2, 'BT04-019'],
  ])('%s: -5000 unless the named vanguard; +2000 when attacking', (card, plainVg, namedVg) => {
    const weak = scene({
      at: 'main',
      attacker: { circles: { vanguard: plainVg, front_left: card } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(weak, unitAt(weak, 0, 'front_left'))).toBe(5000);
    const s = scene({
      attacker: { circles: { vanguard: namedVg, front_left: card } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const unit = unitAt(s, 0, 'front_left');
    expect(pw(s, unit)).toBe(10000);
    const r = drain(apply(s, attack(unit, unitAt(s, 1, 'vanguard'))));
    expect(pw(r.state, unit)).toBe(12000);
  });

  it.each([
    ['BT04-052', DP_G2],
    ['BT04-068', KAG_G2],
  ])('%s: hits a vanguard, one of your clan units gets +3000', (card, ally) => {
    const s = scene({
      attacker: { circles: { vanguard: ally, front_left: card } },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))));
    r = answer(r, vg);
    expect(pw(r.state, vg)).toBe(13000);
  });

  it.each([
    ['BT04-007', KAG_G2, 1],
    ['BT04-072', KAG_G2, 0],
  ])(
    '%s: boosted hit on a vanguard, retire a grade %i rear-guard, then back to the deck',
    (card, vg, grade) => {
      const target = grade === 1 ? RP_G1 : 'BT04-047';
      const s = scene({
        attacker: { circles: { vanguard: vg, front_left: KAG_G2, back_left: card } },
        defender: { circles: { vanguard: RP_G1, front_right: target }, deckTop: vanilla(1) },
      });
      const booster = unitAt(s, 0, 'back_left');
      const victim = unitAt(s, 1, 'front_right');
      let r = passGuard(
        apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), booster)),
      );
      r = drain(r);
      expect(r.state.players[1].drop).toContain(victim);
      r = then(r, endPhase()); // battle → end phase: the booster returns to the deck
      expect(r.state.players[0].deck).toContain(booster);
    },
  );
});

describe('BT04 cards', () => {
  it('BT04-001 Phantom Blaster Dragon: CB2 and retire three Shadow Paladins for +10000/+1', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT04-001', front_left: SP_G1, back_left: SP_G1, front_right: SP_G2 },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg, '2')));
    expect(pw(r.state, vg)).toBe(20000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    expect(r.state.players[0].drop).toHaveLength(3);
  });

  it('BT04-002 Darkness Maiden, Macha: CB2, call a grade 1 or less Shadow Paladin in the same column', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: SP_G2 }, hand: ['BT04-002'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [[SP_G1], []],
    });
    let r = apply(s, call(inHand(s, 0, 'BT04-002'), 'front_left'));
    r = answer(r, 'yes');
    while (r.state.pendingChoice && r.state.pendingChoice.kind !== 'circle') {
      const c = r.state.pendingChoice;
      const g1 = c.options.find((id) => defOf(r.state, id) === SP_G1);
      r = answer(r, ...(g1 ? [g1] : c.options.slice(0, c.min)));
    }
    expect([...r.state.pendingChoice!.options].sort()).toEqual(['back_left', 'front_left']);
    r = answer(r, 'back_left');
    expect(defOf(r.state, r.state.players[0].circles.back_left[0]!)).toBe(SP_G1);
  });

  it('BT04-003 Skull Witch, Nemain: placed with an SP vanguard, CB1 and discard to draw two', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: SP_G2 }, hand: ['BT04-003', SP_G1], damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, call(inHand(s, 0, 'BT04-003'), 'front_left')));
    expect(r.state.players[0].hand).toHaveLength(2);
  });

  it.each([
    ['BT04-004', 15000],
    ['BT04-028', 13000],
  ])('%s: +1 critical at %i power or more at the attack step', (card) => {
    const s = scene({
      attacker: { circles: { vanguard: card, back_center: DP_G1 } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    const s2 = scene({
      attacker: { circles: { vanguard: card } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    r = apply(s2, attack(unitAt(s2, 0, 'vanguard'), unitAt(s2, 1, 'vanguard')));
    expect(currentCritical(r.state, ctx, unitAt(s2, 0, 'vanguard'))).toBe(1);
  });

  it('BT04-005 Evil Armor General, Giraffa: hit a vanguard, pay CB2 + two rear-guards, retire up to two grade 1 or less', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT04-005', front_left: MC_G1, back_left: MC_G1 },
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: {
        circles: { vanguard: RP_G1, front_left: RP_G1, front_right: 'BT04-047', back_left: RP_G2 },
        deckTop: vanilla(1),
      },
    });
    let r = passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    r = answer(r, 'yes'); // CB2 and the two rear-guards are the only options: paid automatically
    const c = r.state.pendingChoice!;
    expect([...c.options].sort()).toEqual(
      [unitAt(s, 1, 'front_left'), unitAt(s, 1, 'front_right')].sort(),
    );
    r = answer(r, ...c.options);
    expect(r.state.players[1].circles.back_left).toHaveLength(1);
    expect(r.state.players[1].drop).toHaveLength(2);
  });

  it('BT04-006 Amber Dragon, Eclipse: CB2 grants "hit a vanguard: retire up to two rear-guards"', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT04-006' }, damage: vanilla(2), deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: RP_G1, front_left: RP_G1, front_right: RP_G2 },
        deckTop: vanilla(1),
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = then(drain(apply(s, activate(vg, '2'))), endPhase());
    r = passGuard(then(r, attack(vg, unitAt(s, 1, 'vanguard'))));
    r = answer(r, ...r.state.pendingChoice!.options);
    expect(r.state.players[1].drop).toHaveLength(2);
  });

  it('BT04-008 Stern Blaukluger: hit a vanguard, stand its column and lose Twin Drive', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT04-008', back_center: NG_G1 },
        hand: [NG_G1, NG_G1],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const bc = unitAt(s, 0, 'back_center');
    let r = passGuard(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), bc)));
    r = drain(r);
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(r.state.cards[bc]!.orientation).toBe('stand');
    // attack again: one drive check only
    r = passGuard(then(r, attack(vg, unitAt(s, 1, 'vanguard'))));
    const checks = find(r.events, 'CHECK_REVEALED').filter((e) => e.check === 'drive');
    expect(checks).toHaveLength(2 + 1);
  });

  it('BT04-009 Dark Metal Dragon: drive check reveals a Shadow Paladin, +2000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT04-009' }, deckTop: [SP_G1, ...vanilla(1)] },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(1) },
    });
    const r = passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(attackPower(r)).toBe(12000);
  });

  it('BT04-010 Gururubau: attacks a vanguard with an SP vanguard, +2000 (not a rear-guard)', () => {
    const s = scene({
      attacker: { circles: { vanguard: SP_G2, front_left: 'BT04-010' } },
      defender: { circles: { vanguard: OPP, front_right: OPP }, hand: GUARD },
    });
    const unit = unitAt(s, 0, 'front_left');
    let r = apply(s, attack(unit, unitAt(s, 1, 'vanguard')));
    expect(pw(r.state, unit)).toBe(9000);
    r = apply(s, attack(unit, unitAt(s, 1, 'front_right')));
    expect(pw(r.state, unit)).toBe(7000);
  });

  it('BT04-012 Enigman Wave: 14000 or more at the attack step, its hit on a vanguard draws', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT04-012', back_center: DP_G1 }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
      extra: [['BT04-054'], []],
    });
    put(s, 0, ['BT04-054'], 'soul');
    const hand = s.players[0].hand.length;
    const r = passGuard(
      apply(
        s,
        attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
      ),
    );
    expect(r.state.players[0].hand).toHaveLength(hand + 1 + 1); // drive check + Wave
  });

  it('BT04-013 Cosmo Beak: placed on RC, CB2, another Dimension Police gets +4000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: DP_G2 }, hand: ['BT04-013'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, call(inHand(s, 0, 'BT04-013'), 'front_left')));
    expect(pw(r.state, vg)).toBe(14000);
  });

  it("BT04-015 Commander Laurel: your DP vanguard's attack hits, rest four DP rear-guards to stand it", () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: DP_G2,
          front_left: 'BT04-015',
          back_left: DP_G1,
          front_right: DP_G1,
          back_right: DP_G1,
        },
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = passGuard(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    r = drain(r);
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(r.state.cards[unitAt(s, 0, 'back_right')]!.orientation).toBe('rest');
  });

  it('BT04-016 Elite Mutant, Giraffa: hit a vanguard, a rear-guard cannot stand next stand phase', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT04-016' }, deckTop: vanilla(1) },
      defender: {
        circles: { vanguard: RP_G1, front_left: RP_G1 },
        rested: ['front_left'],
        deckTop: vanilla(2),
      },
    });
    // the only attacker has attacked, so the turn ends and the opponent's stand phase follows
    const r = passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(r.state.activePlayer).toBe(1);
    expect(r.state.cards[unitAt(s, 1, 'front_left')]!.orientation).toBe('rest');
    expect(r.state.cards[unitAt(s, 1, 'vanguard')]!.orientation).toBe('stand');
  });

  it('BT04-018 Amber Dragon, Dusk: attacks a vanguard, +2000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT04-018' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard')));
    expect(pw(r.state, vg)).toBe(11000);
  });

  it('BT04-019 Blaukluger: hit a vanguard, turn a damage card face up', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT04-019' }, damage: vanilla(1), deckTop: vanilla(1) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const dmg = s.players[0].damage[0]!;
    s.cards[dmg]!.faceUp = false;
    const r = passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(r.state.cards[dmg]!.faceUp).toBe(true);
  });

  it('BT04-020 Fang of Light, Garmore: +1000 per Snogal/Brugal; placed, calls one from the deck', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: RP_G2, front_left: 'BT04-079' }, hand: ['BT04-020', RP_G1] },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT04-080'], []],
    });
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT04-020') });
    r = answer(r, 'yes');
    r = drain(r, 0, ['back_left']);
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(pw(r.state, vg)).toBe(10000 + 2000);
  });

  it('BT04-021 Silver Spear Demon, Gusion: CB2 for +4000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT04-021' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(drain(apply(s, activate(vg))).state, vg)).toBe(14000);
  });

  it.each([
    ['BT04-022', SP_G1, 'BT04-021'],
    ['BT04-032', MC_G1, 'BT04-005'],
  ])('%s: placed, reveals the top card and calls it if it is of the clan', (card, top, vg) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg }, hand: [card], deckTop: [top] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, call(inHand(s, 0, card), 'front_left')));
    const field = Object.values(r.state.players[0].circles).flat();
    expect(field.map((id) => defOf(r.state, id))).toContain(top);
  });

  it('BT04-024 Blaster Dark: placed on VC, CB2 to retire a rear-guard', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: SP_G1 }, hand: ['BT04-024'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT04-024') }));
    expect(r.state.players[1].circles.front_left).toEqual([]);
  });

  it('BT04-026 Enigman Rain: 12000 or more, its hit on a vanguard stands a rear-guard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT04-026', back_center: DP_G1, front_left: DP_G1 },
        rested: ['front_left'],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    let r = passGuard(
      apply(
        s,
        attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
      ),
    );
    r = answer(r, unitAt(s, 0, 'front_left'));
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
  });

  it('BT04-029 Cosmo Roar: rest to give another Dimension Police +2000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: DP_G2, front_left: 'BT04-029' } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(12000);
  });

  it('BT04-031 Death Warden Ant Lion: main phase charge; Ultimate freezes all rear-guards', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT04-031' }, damage: vanilla(5) },
      defender: { circles: { vanguard: OPP, front_left: OPP, back_left: RP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = apply(s, endPhase());
    expect(pw(r.state, vg)).toBe(12000);
    fillSoul(r.state, 0, 8 - r.state.players[0].soul.length);
    r = drain(then(r, activate(vg, '2')));
    const frozen = r.state.restrictions.filter((x) => x.restriction === 'cannot_stand');
    expect(frozen.map((x) => x.target).sort()).toEqual(
      [unitAt(s, 1, 'front_left'), unitAt(s, 1, 'back_left')].sort(),
    );
  });

  it('BT04-033 Water Gang: hit with a Megacolony vanguard, CB2 to draw', () => {
    const s = scene({
      attacker: { circles: { vanguard: MC_G2, front_left: 'BT04-033' }, damage: vanilla(2) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it("BT04-034 Gloom Flyman: guards with a Megacolony vanguard, rests an opponent's grade 0 rear-guard", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033', back_left: 'BT04-047' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: MC_G2 }, hand: ['BT04-034', RP_G1] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT04-034') });
    expect(r.state.cards[unitAt(s, 0, 'back_left')]!.orientation).toBe('rest');
  });

  it('BT04-036 Lizard Soldier, Raopia: boosts a Kagero vanguard vs two or fewer rear-guards, +4000', () => {
    const s = scene({
      attacker: { circles: { vanguard: KAG_G2, back_center: 'BT04-036' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(10000 + 6000 + 4000);
  });

  it('BT04-038 Armored Fairy, Shubiela: boosted by a Nova Grappler +3000; hit, SB3 to draw', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT04-038', back_center: NG_G1 }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    fillSoul(s, 0, 2);
    let r = apply(
      s,
      attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
    );
    r = drain(passGuard(r));
    expect(attackPower(r)).toBe(10000 + 8000 + 3000);
    expect(r.state.players[0].hand).toHaveLength(2 + 1); // twin drive + draw
  });

  it('BT04-040 Beast Knight, Garmore: placed, discard to call Brugal from the deck', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: RP_G2 }, hand: ['BT04-040', RP_G1] },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT04-080'], []],
    });
    const r = drain(apply(s, call(inHand(s, 0, 'BT04-040'), 'front_left')));
    const field = Object.values(r.state.players[0].circles).flat();
    expect(field.map((id) => defOf(r.state, id))).toContain('BT04-080');
  });

  it('BT04-042 Demon World Castle, Fatalita: intercepts with an SP vanguard, +5000 shield', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: SP_G2, front_left: 'BT04-042' }, hand: GUARD },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'INTERCEPT', player: 1, unitId: unitAt(s, 1, 'front_left') });
    expect(currentShield(r.state, ctx, unitAt(s, 1, 'front_left'))).toBe(10000);
  });

  it('BT04-044 Witch of Nostrum, Arianrhod: rest and discard to draw', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: SP_G2, front_left: 'BT04-044' }, hand: [SP_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].drop).toHaveLength(1);
  });

  it('BT04-045 Doranbau: boosts Blaster Dark, +4000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT04-024', back_center: 'BT04-045' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(9000 + 6000 + 4000);
  });

  it('BT04-055 Glory Maker: boosts a DP vanguard with four or more damage, +4000', () => {
    const s = scene({
      attacker: { circles: { vanguard: DP_G2, back_center: 'BT04-055' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(10000 + 6000 + 4000);
  });

  it('BT04-061 Tail Joe / BT04-063 Stealth Millipede: everything of the opponent rested', () => {
    const s = scene({
      attacker: { circles: { vanguard: MC_G2, front_left: 'BT04-061', back_center: 'BT04-063' } },
      defender: {
        circles: { vanguard: OPP, front_left: OPP },
        rested: ['vanguard', 'front_left'],
        hand: GUARD,
      },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(11000);
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(10000 + 6000 + 4000);
  });

  it('BT04-074 Dancing Wolf: stands during your battle phase, +3000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: NG_G2, front_left: 'BT04-074' },
        rested: ['front_left'],
        deckTop: ['BT04-078'],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(1) },
    });
    const wolf = unitAt(s, 0, 'front_left');
    const vg = unitAt(s, 0, 'vanguard');
    let r = passGuard(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    while (r.state.pendingChoice?.player === 0) {
      const c = r.state.pendingChoice;
      r = answer(r, c.options.includes(vg) ? vg : c.options[0]!); // the +5000 goes to the vanguard
    }
    expect(r.state.cards[wolf]!.orientation).toBe('stand');
    expect(pw(r.state, wolf)).toBe(7000 + 3000);
  });

  it.each(['BT04-076', 'BT04-078'])(
    '%s: boosted hit on a vanguard by a Nova Grappler, a damage card face up',
    (card) => {
      const s = scene({
        attacker: {
          circles: { vanguard: NG_G2, back_center: card },
          damage: vanilla(1),
          deckTop: vanilla(1),
        },
        defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
      });
      const dmg = s.players[0].damage[0]!;
      s.cards[dmg]!.faceUp = false;
      let r = passGuard(
        apply(
          s,
          attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
        ),
      );
      r = drain(r);
      expect(r.state.cards[dmg]!.faceUp).toBe(true);
      if (card === 'BT04-078') {
        // no attacker left: the turn ends, and at its end phase the unit returned to the deck
        expect(r.state.players[0].deck).toContain(unitAt(s, 0, 'back_center'));
      }
    },
  );

  it('BT04-079 Snogal / BT04-080 Brugal: +1000 per other copy; Brugal can be called when ridden', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: RP_G2,
          front_left: 'BT04-079',
          back_left: 'BT04-079',
          front_right: 'BT04-080',
          back_right: 'BT04-080',
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(7000);
    expect(pw(s, unitAt(s, 0, 'front_right'))).toBe(5000);

    const ride = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT04-080' }, hand: [RP_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    const brugal = unitAt(ride, 0, 'vanguard');
    let r = apply(ride, { type: 'RIDE', player: 0, cardId: inHand(ride, 0, RP_G1) });
    r = answer(r, 'yes');
    r = answer(r, 'back_left');
    expect(r.state.players[0].circles.back_left).toEqual([brugal]);
  });
});
