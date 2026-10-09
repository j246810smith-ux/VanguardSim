/**
 * BT05 card tests: every card with abilities is named here at least once (cards:report).
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
const field = (s: GameState, p: PlayerId) =>
  Object.values(s.players[p].circles)
    .flat()
    .map((id) => defOf(s, id));
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
/** Answer `player`'s pending choices: "yes", a preferred option, else the first options offered. */
function drain(r: Run, player: PlayerId = 0, prefer: readonly string[] = []): Run {
  for (let i = 0; i < 40 && r.state.pendingChoice?.player === player; i++) {
    const c = r.state.pendingChoice;
    const preferred = c.options.filter((o) => prefer.includes(o)).slice(0, Math.max(c.max, 1));
    r =
      c.kind === 'yes_no'
        ? answer(r, 'yes')
        : preferred.length
          ? answer(r, ...preferred)
          : answer(r, ...c.options.slice(0, Math.max(c.min, 1)));
  }
  return r;
}

const NN_G2 = 'BT05-024'; // Iris Knight
const NN_G1 = 'BT05-044';
const NN_G0 = 'BT05-049';
const MK_G2 = 'BT05-029';
const MK_G1 = 'BT05-055';
const RP_G2 = 'BT01-021';
const RP_G1 = 'BT01-042';
const SP_G2 = 'BT04-023';
const SP_G1 = 'BT04-043';
const KAG_G2 = 'BT01-022';
const KAG_G1 = 'BT01-048';
const DP_G2 = 'BT04-027';
const DP_G1 = 'BT03-079';
const DI_G2 = 'BT03-022';
const DI_G1 = 'BT03-042';
const PM_G2 = 'BT03-027';
const PM_G1 = 'BT03-050';
const OTT_G2 = 'BT01-026';
const OTT_G1 = 'BT01-054';
const NG_G2 = 'BT01-030';
const NG_G1 = 'BT01-060';
const OPP = 'BT01-038';
const GUARD = [RP_G1];

describe('shared shapes', () => {
  it.each([
    ['BT05-011', NN_G2, NN_G1],
    ['BT05-013', MK_G2, MK_G1],
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
    ['BT05-001', MK_G1],
    ['BT05-004', SP_G1],
    ['BT05-005', KAG_G1],
    ['BT05-009', NN_G1],
  ])('%s: -2000 with a unit of another clan', (card, ally) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: card, front_left: ally } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(11000);
    const mixed = scene({
      at: 'main',
      attacker: { circles: { vanguard: card, front_left: OPP } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(mixed, unitAt(mixed, 0, 'vanguard'))).toBe(9000);
  });

  it.each([
    ['BT05-014', 'BT05-002', 'Blaster'],
    ['BT05-015', 'BT05-002', 'Blaster'],
    ['BT05-018', 'BT05-004', 'Blaster'],
    ['BT05-037', 'BT05-005', 'Overlord'],
  ])('%s: attacks with a "%s"-named vanguard, +3000', (card, vg) => {
    const s = scene({
      attacker: { circles: { vanguard: vg, front_left: card } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const unit = unitAt(s, 0, 'front_left');
    const r = apply(s, attack(unit, unitAt(s, 1, 'vanguard')));
    expect(pw(r.state, unit)).toBe(ctx.registry.get(card).power + 3000);
  });

  it.each([
    ['BT05-036', 'BT05-004'],
    ['BT05-038', 'BT05-005'],
  ])('%s: SB1 when boosting %s, +6000', (card, vg) => {
    const s = scene({
      attacker: { circles: { vanguard: vg, back_center: card } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    fillSoul(s, 0, 1);
    const unit = unitAt(s, 0, 'vanguard');
    let r = apply(s, attack(unit, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    r = drain(r);
    expect(pw(r.state, unit)).toBe(11000 + 4000 + 6000);
  });

  it.each([
    ['BT05-012', 'Stealth Fiend, Midnight Crow'],
    ['BT05-028', 'Stealth Dragon, Voidgelga'],
    ['BT05-033', 'Stealth Beast, Million Rat'],
  ])(
    '%s: CB1 calls another copy, which goes to the bottom of the deck at the end phase',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: 'BT05-027' }, hand: [card], damage: vanilla(1) },
        defender: { circles: { vanguard: OPP } },
      });
      let r = apply(s, call(inHand(s, 0, card), 'front_left'));
      r = drain(r, 0, ['back_left']);
      const copy = r.state.players[0].circles.back_left[0]!;
      expect(defOf(r.state, copy)).toBe(card);
      r = then(r, endPhase(), endPhase()); // main → battle → end
      expect(r.state.players[0].deck.at(-1)).toBe(copy);
    },
  );

  it.each([
    ['BT05-062', RP_G2, RP_G1],
    ['BT05-064', SP_G2, SP_G1],
    ['BT05-068', OTT_G2, OTT_G1],
    ['BT05-079', PM_G2, PM_G1],
  ])('%s: placed, puts a clan card from hand into the soul', (card, vg, other) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg }, hand: [card, other] },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = s.players[0].soul.length;
    const r = drain(apply(s, call(inHand(s, 0, card), 'front_left')));
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
    expect(r.state.players[0].hand).toHaveLength(0);
  });

  it.each([
    ['BT05-053', NN_G2],
    ['BT05-063', RP_G2],
    ['BT05-075', DP_G2],
  ])('%s: into the soul, a clan unit gets +3000', (card, vg) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg, back_left: card } },
      defender: { circles: { vanguard: OPP } },
    });
    const v = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))));
    expect(pw(r.state, v)).toBe(13000);
    expect(r.state.players[0].soul).toContain(unitAt(s, 0, 'back_left'));
  });

  it.each([
    ['BT05-060', MK_G2],
    ['BT05-080', PM_G2],
  ])('%s: into the soul, turns a damage card face up', (card, vg) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg, back_left: card }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const dmg = s.players[0].damage[0]!;
    s.cards[dmg]!.faceUp = false;
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))));
    expect(r.state.cards[dmg]!.faceUp).toBe(true);
  });

  it.each([
    ['BT05-065', SP_G2, SP_G1, 'BT05-004'],
    ['BT05-070', KAG_G2, KAG_G1, 'BT05-005'],
  ])('%s: CB1 and retire two rear-guards to search for its grade 3', (card, vg, body, findDef) => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: vg, back_left: card, front_left: body, front_right: body },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [[findDef], []],
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))));
    expect(r.state.players[0].hand.map((id) => defOf(r.state, id))).toEqual([findDef]);
    expect(r.state.players[0].drop).toHaveLength(2);
  });

  it.each([
    ['BT05-076', DI_G2],
    ['BT05-078', PM_G2],
  ])('%s: put into the drop zone from (GC), may Soul-Charge 2', (card, vg) => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: vg }, hand: [card, RP_G1], deckTop: vanilla(3) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, card) });
    const soul = r.state.players[1].soul.length;
    r = drain(passGuard(r), 1);
    expect(r.state.players[1].soul).toHaveLength(soul + 2);
  });

  it.each([
    ['BT05-031', 'vanguard'],
    ['BT05-032', 'front_left'],
  ] as const)('%s: hits a vanguard, looks at five for Mandala Lord', (card, circle) => {
    const s = scene({
      attacker: {
        circles: circle === 'vanguard' ? { vanguard: card } : { vanguard: MK_G2, front_left: card },
        deckTop: [...vanilla(2), 'BT05-001', ...vanilla(2)],
      },
      defender: { circles: { vanguard: 'BT04-051' }, deckTop: vanilla(1) },
    });
    let r = passGuard(apply(s, attack(unitAt(s, 0, circle), unitAt(s, 1, 'vanguard'))));
    r = drain(
      r,
      0,
      r.state.players[0].deck.filter((id) => defOf(r.state, id) === 'BT05-001'),
    );
    expect(r.state.players[0].hand.map((id) => defOf(r.state, id))).toContain('BT05-001');
  });

  it.each(['BT05-010', 'BT05-017'])('%s: hits with a clan vanguard, CB2 to draw', (card) => {
    const vg = card === 'BT05-010' ? NN_G2 : SP_G2;
    const s = scene({
      attacker: { circles: { vanguard: vg, front_left: card }, damage: vanilla(2) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it.each([
    ['BT05-061', RP_G2, 'front_left'],
    ['BT05-074', DP_G2, 'front_left'],
  ] as const)('%s: hits a vanguard, a clan unit gets +3000', (card, vg, circle) => {
    const s = scene({
      attacker: { circles: { vanguard: vg, [circle]: card } },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const v = unitAt(s, 0, 'vanguard');
    let r = passGuard(apply(s, attack(unitAt(s, 0, circle), unitAt(s, 1, 'vanguard'))));
    r = drain(r, 0, [v]);
    expect(pw(r.state, v)).toBe(13000);
  });
});

describe('BT05 cards', () => {
  it('BT05-001 Mandala Lord: attacked, at the guard step gives the attacker -10000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: 'BT05-001' },
        hand: ['BT05-001', MK_G1],
        damage: vanilla(1),
      },
    });
    const attacker = unitAt(s, 0, 'vanguard');
    let r = apply(s, attack(attacker, unitAt(s, 1, 'vanguard')));
    r = drain(r, 1, [inHand(r.state, 1, 'BT05-001')]);
    expect(
      r.state.modifiers.some(
        (m) => m.target === attacker && m.stat === 'power' && m.amount === -10000,
      ),
    ).toBe(true);
  });

  it('BT05-002 Majesty Lord Blaster: +2000/+1 with both Blasters in the soul; puts them in for +10000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT05-002', front_left: 'BT01-002', front_right: 'BT04-024' },
      },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(10000);
    let r = apply(s, attack(vg, unitAt(s, 1, 'vanguard')));
    r = drain(r);
    expect(pw(r.state, vg)).toBe(10000 + 2000 + 10000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });

  it('BT05-003 Star Call Trumpeter: CB2 calls a grade 2 or less "Blaster" card', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: RP_G2 }, hand: ['BT05-003'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT01-002'], []],
    });
    const r = drain(apply(s, call(inHand(s, 0, 'BT05-003'), 'front_left')), 0, ['back_left']);
    expect(field(r.state, 0)).toContain('BT01-002');
  });

  it('BT05-004 Phantom Blaster Overlord: +2000 with PBD in the soul; CB3 + discard for +10000/+1', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT05-004' }, hand: ['BT05-004'], damage: vanilla(3) },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
      extra: [['BT04-001'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    put(s, 0, ['BT04-001'], 'soul');
    expect(pw(s, vg)).toBe(13000);
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(pw(r.state, vg)).toBe(23000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });

  it('BT05-005 Dragonic Overlord the End: hits, CB2 + discard to stand', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT05-005' },
        hand: ['BT05-005'],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(passGuard(apply(s, attack(vg, unitAt(s, 1, 'vanguard')))));
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(legal(r.state, 0, 'ATTACK')?.options.map((o) => o.attacker)).toContain(vg);
  });

  it('BT05-006 Miracle Beauty: stands in the battle phase, stands the rear-guard in its column', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: DP_G2, front_left: 'BT05-006', back_left: DP_G1 },
        rested: ['front_left', 'back_left'],
        deckTop: ['BT04-058'], // Cosmo Fang: a Dimension Police stand trigger
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(1) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = passGuard(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    r = drain(r, 0, [unitAt(s, 0, 'front_left'), vg]);
    expect(r.state.cards[unitAt(s, 0, 'back_left')]!.orientation).toBe('stand');
  });

  it('BT05-007 Beelzebub: +1000 with eight DI in the soul; CB2 on attack gives two rear-guards +3000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT05-007', front_left: DI_G1, front_right: DI_G2 },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
      extra: [[DI_G1, DI_G1, DI_G2, DI_G2, 'BT03-012', 'BT03-012', 'BT03-024', 'BT03-024'], []],
    });
    put(s, 0, [DI_G1, DI_G1, DI_G2, DI_G2, 'BT03-012', 'BT03-012', 'BT03-024', 'BT03-024'], 'soul');
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(11000);
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))), 0, [
      unitAt(s, 0, 'front_left'),
      unitAt(s, 0, 'front_right'),
    ]);
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(11000);
    expect(pw(r.state, unitAt(s, 0, 'front_right'))).toBe(13000);
  });

  it('BT05-008 Mistress Hurricane: placed on VC, CB2 calls a Pale Moon from the soul', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: PM_G2 }, hand: ['BT05-008'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [[PM_G1], []],
    });
    put(s, 0, [PM_G1], 'soul');
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT05-008') }));
    expect(field(r.state, 0)).toContain(PM_G1);
  });

  it('BT05-009 Maiden of Trailing Rose: hits a vanguard, calls up to two Neo Nectar from the top five', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT05-009' },
        hand: ['BT05-009'],
        damage: vanilla(1),
        deckTop: [...vanilla(2), NN_G1, NN_G0, ...vanilla(3)],
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    let r = passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    r = answer(r, 'yes');
    r = drain(r);
    const c = r.state.pendingChoice;
    if (c && c.player === 0) r = answer(r, ...c.options.slice(0, 2));
    r = drain(r);
    expect(
      field(r.state, 0).filter((d) => d === NN_G1 || d === NN_G0).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('BT05-016 Wingal Brave: forerunner; boosted hit on a "Blaster" unit searches a "Blaster" card', () => {
    const ride = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT05-016' }, hand: [RP_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    let r = apply(ride, { type: 'RIDE', player: 0, cardId: inHand(ride, 0, RP_G1) });
    r = drain(r, 0, ['back_left']);
    expect(defOf(r.state, r.state.players[0].circles.back_left[0]!)).toBe('BT05-016');

    const s = scene({
      attacker: { circles: { vanguard: 'BT01-002', back_center: 'BT05-016' }, deckTop: vanilla(1) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
      extra: [['BT04-024'], []],
    });
    r = passGuard(
      apply(
        s,
        attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
      ),
    );
    r = drain(r);
    expect(
      r.state.players[0].hand.some(
        (id) =>
          defOf(r.state, id).length &&
          ctx.registry.get(defOf(r.state, id)).name.includes('Blaster'),
      ),
    ).toBe(true);
  });

  it("BT05-019 Euryale: binds a random card from the opponent's hand until the end phase", () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: OTT_G2 }, hand: ['BT05-019'] },
      defender: { circles: { vanguard: OPP }, hand: [RP_G1, RP_G2] },
      extra: [[OTT_G1, OTT_G1, OTT_G1, OTT_G2, OTT_G2, OTT_G2], []],
    });
    put(s, 0, [OTT_G1, OTT_G1, OTT_G1, OTT_G2, OTT_G2, OTT_G2], 'soul');
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT05-019') });
    expect(r.state.players[1].hand).toHaveLength(1);
    expect(r.state.players[1].bind).toHaveLength(1);
    expect(r.state.cards[r.state.players[1].bind[0]!]!.faceUp).toBe(false);
    r = then(r, endPhase(), endPhase(), endPhase()); // ride → main → battle → end
    expect(r.state.players[1].bind).toHaveLength(0);
    expect(r.state.players[1].hand.length).toBeGreaterThanOrEqual(2);
  });

  it('BT05-020 Street Bouncer: rest itself and the Nova Grappler in its column to draw', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: NG_G2, back_left: NG_G1 }, hand: ['BT05-020'] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, call(inHand(s, 0, 'BT05-020'), 'front_left')));
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.cards[unitAt(s, 0, 'back_left')]!.orientation).toBe('rest');
  });

  it('BT05-021 Frontline Valkyrie, Laurel: attacks a vanguard with an NN vanguard, +2000', () => {
    const s = scene({
      attacker: { circles: { vanguard: NN_G2, front_left: 'BT05-021' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const u = unitAt(s, 0, 'front_left');
    expect(pw(apply(s, attack(u, unitAt(s, 1, 'vanguard'))).state, u)).toBe(12000);
  });

  it.each([
    ['BT05-022', 'BT05-041', 2],
    ['BT05-041', 'BT05-022', 1],
    ['BT05-047', 'BT05-041', 1],
    ['BT05-026', 'BT05-047', 1],
  ])('%s: hits a vanguard, goes on top of the deck and calls %s as [Rest]', (card, target) => {
    const s = scene({
      attacker: { circles: { vanguard: NN_G2, front_left: card } },
      defender: { circles: { vanguard: 'BT04-051' }, deckTop: vanilla(1) },
      extra: [[target, target], []],
    });
    const self = unitAt(s, 0, 'front_left');
    let r = passGuard(apply(s, attack(self, unitAt(s, 1, 'vanguard'))));
    r = answer(r, 'yes');
    r = drain(
      r,
      0,
      r.state.players[0].deck.filter((id) => defOf(r.state, id) === target),
    );
    expect(r.state.players[0].deck).toContain(self);
    const called = Object.values(r.state.players[0].circles)
      .flat()
      .filter((id) => defOf(r.state, id) === target);
    expect(called.length).toBeGreaterThanOrEqual(1);
    expect(called.every((id) => r.state.cards[id]!.orientation === 'rest')).toBe(true);
  });

  it('BT05-023 Behemoth: hits a vanguard, CB2 to stand a Neo Nectar rear-guard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT05-023', front_left: NN_G1 },
        rested: ['front_left'],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
  });

  it('BT05-025 Hey Yo Pineapple: four Neo Nectar units, +3000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: NN_G2, front_left: 'BT05-025', back_left: NN_G1, front_right: NN_G1 },
      },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const u = unitAt(s, 0, 'front_left');
    expect(pw(apply(s, attack(u, unitAt(s, 1, 'vanguard'))).state, u)).toBe(11000);
  });

  it('BT05-027 Kurama Lord: main phase charge and counter charge; Ultimate stands everything', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'BT05-027', front_left: MK_G1 },
        damage: vanilla(5),
        deckTop: vanilla(3),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(2) },
    });
    const dmg = s.players[0].damage[0]!;
    s.cards[dmg]!.faceUp = false;
    let r = drain(apply(s, endPhase()));
    expect(r.state.cards[dmg]!.faceUp).toBe(true);
    fillSoul(r.state, 0, 8 - r.state.players[0].soul.length);
    r = then(r, endPhase());
    const vg = unitAt(s, 0, 'vanguard');
    r = drain(passGuard(then(r, attack(vg, unitAt(s, 1, 'vanguard')))));
    expect(r.state.cards[vg]!.orientation).toBe('stand');
  });

  it('BT05-030 Shanaou: hits a vanguard with a Murakumo vanguard, may return to hand', () => {
    const s = scene({
      attacker: { circles: { vanguard: MK_G2, front_left: 'BT05-030' } },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const u = unitAt(s, 0, 'front_left');
    const r = drain(passGuard(apply(s, attack(u, unitAt(s, 1, 'vanguard')))));
    expect(r.state.players[0].hand).toContain(u);
  });

  it('BT05-034 Evil Ferret: to the bottom of the deck, calls a Murakumo that returns to hand at the end phase', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: MK_G2, back_left: 'BT05-034' }, hand: [MK_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    let r = apply(s, activate(unitAt(s, 0, 'back_left'), '2'));
    r = drain(r, 0, ['front_right']);
    const called = r.state.players[0].circles.front_right[0]!;
    expect(defOf(r.state, called)).toBe(MK_G1);
    r = then(r, endPhase(), endPhase());
    expect(r.state.players[0].hand).toContain(called);
  });

  it('BT05-035 Skull Face: main phase charge; Ultimate retires all rear-guards', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT05-035' }, damage: vanilla(5), deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: RP_G1, front_left: OPP, back_left: RP_G1 },
        deckTop: vanilla(1),
      },
    });
    fillSoul(s, 0, 7);
    let r = then(apply(s, endPhase()), attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(passGuard(r));
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(r.state.players[1].circles.back_left).toEqual([]);
  });

  it('BT05-039 Magical Police Quilt: boosted hit, discard to draw', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: DP_G2, back_center: 'BT05-039' },
        hand: [DP_G1],
        deckTop: vanilla(1),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const r = drain(
      passGuard(
        apply(
          s,
          attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
        ),
      ),
    );
    expect(r.state.players[0].drop.map((id) => defOf(r.state, id))).toContain(DP_G1);
  });

  it('BT05-040 Devil Child: boosts a DI vanguard with six DI in the soul, +4000', () => {
    const s = scene({
      attacker: { circles: { vanguard: DI_G2, back_center: 'BT05-040' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
      extra: [[DI_G1, DI_G1, DI_G1, 'BT03-012', 'BT03-012', 'BT03-012'], []],
    });
    put(s, 0, [DI_G1, DI_G1, DI_G1, 'BT03-012', 'BT03-012', 'BT03-012'], 'soul');
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(10000 + 6000 + 4000);
  });

  it('BT05-042 Simurgh: intercepts with an NN vanguard, +5000 shield', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: NN_G2, front_left: 'BT05-042' }, hand: GUARD },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'INTERCEPT', player: 1, unitId: unitAt(s, 1, 'front_left') });
    expect(currentShield(r.state, ctx, unitAt(s, 1, 'front_left'))).toBe(10000);
  });

  it('BT05-043 Irminsul: reveals the top card, calls a grade 1 or 2 Neo Nectar', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: NN_G2 }, hand: ['BT05-043'], deckTop: [NN_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, call(inHand(s, 0, 'BT05-043'), 'front_left')), 0, ['back_left']);
    expect(field(r.state, 0)).toContain(NN_G1);
  });

  it('BT05-045 Caramel Popcorn / BT05-046 Lady of the Sunlight Forest', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: NN_G2, front_left: 'BT05-045', back_left: 'BT05-046' },
        hand: [NN_G1],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    let r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(8000);
    r = drain(then(r, activate(unitAt(s, 0, 'back_left'))));
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.cards[unitAt(s, 0, 'back_left')]!.orientation).toBe('rest');
  });

  it('BT05-048 Lily Knight of the Valley: boosts Iris Knight, +4000', () => {
    const s = scene({
      attacker: { circles: { vanguard: NN_G2, back_center: 'BT05-048' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(10000 + 6000 + 4000);
  });

  it('BT05-054 White Mane: hits a vanguard, a damage card face up', () => {
    const s = scene({
      attacker: { circles: { vanguard: MK_G2, front_left: 'BT05-054' }, damage: vanilla(1) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const dmg = s.players[0].damage[0]!;
    s.cards[dmg]!.faceUp = false;
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.cards[dmg]!.faceUp).toBe(true);
  });

  it('BT05-056 Leaf Raccoon: boosts a Murakumo vanguard with a bigger hand, +4000', () => {
    const s = scene({
      attacker: { circles: { vanguard: MK_G2, back_center: 'BT05-056' }, hand: [MK_G1, MK_G1] },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(10000 + 6000 + 4000);
  });

  it('BT05-067 Tagitsuhime: attacks with six OTT in the soul, +3000', () => {
    const s = scene({
      attacker: { circles: { vanguard: OTT_G2, front_left: 'BT05-067' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
      extra: [[OTT_G1, OTT_G1, OTT_G1, OTT_G2, OTT_G2, OTT_G2], []],
    });
    put(s, 0, [OTT_G1, OTT_G1, OTT_G1, OTT_G2, OTT_G2, OTT_G2], 'soul');
    const u = unitAt(s, 0, 'front_left');
    expect(pw(apply(s, attack(u, unitAt(s, 1, 'vanguard'))).state, u)).toBe(12000);
  });

  it('BT05-071 Top Gun / BT05-072 Anthrodroid: a Nova Grappler rear-guard rests, +1000; CB1 to stand', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT05-071', front_left: 'BT05-072' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const anthro = unitAt(s, 0, 'front_left');
    let r = apply(s, attack(anthro, unitAt(s, 1, 'vanguard')));
    expect(pw(r.state, vg)).toBe(11000);
    r = passGuard(r);
    expect(legal(r.state, 0, 'ACTIVATE')).toBeUndefined(); // not in the battle phase
    const m = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: NG_G2, front_left: 'BT05-072' },
        rested: ['front_left'],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    r = drain(apply(m, activate(unitAt(m, 0, 'front_left'))));
    expect(r.state.cards[unitAt(m, 0, 'front_left')]!.orientation).toBe('stand');
  });

  it('BT05-077 Hysteric Shirley: into the soul, may Soul-Charge 1', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: DI_G2, back_left: 'BT05-077' } },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = s.players[0].soul.length;
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))));
    expect(r.state.players[0].soul).toHaveLength(soul + 2);
  });

  it('heal triggers have only reminder text (BT05-052, BT05-059)', () => {
    expect(ctx.registry.get('BT05-052').trigger).toBe('heal');
    expect(ctx.registry.get('BT05-059').trigger).toBe('heal');
    void attackPower;
  });
});
