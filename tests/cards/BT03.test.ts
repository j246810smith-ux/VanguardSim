/**
 * BT03 card tests: every card with abilities is named here at least once (cards:report).
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
/** The defender stops guarding (if it still can guard: with nothing to guard with it passes itself). */
const passGuard = (r: Run): Run =>
  legal(r.state, 1, 'PASS_GUARD') ? then(r, { type: 'PASS_GUARD', player: 1 }) : r;
const attackPower = (r: Run) => find(r.events, 'ATTACK_RESOLVED')[0]!.attackPower;

/** Move cards with these definitions from the deck into a zone (face up). */
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
function drain(r: Run, player: PlayerId = 0): Run {
  for (let i = 0; i < 30 && r.state.pendingChoice?.player === player; i++) {
    const c = r.state.pendingChoice;
    r =
      c.kind === 'yes_no' ? answer(r, 'yes') : answer(r, ...c.options.slice(0, Math.max(c.min, 1)));
  }
  return r;
}

// bodies (vanilla units)
const DI_G2 = 'BT03-022'; // Werwolf Sieger
const DI_G1 = 'BT03-042';
const PM_G2 = 'BT03-027';
const PM_G1 = 'BT03-050';
const TK_G2 = 'BT03-033';
const TK_G1 = 'BT01-066';
const TK_G0 = 'BT01-067';
const RP_G2 = 'BT01-021';
const RP_G1 = 'BT01-042';
const OTT_G2 = 'BT01-026';
const OTT_G1 = 'BT01-054';
const NG_G1 = 'BT01-060';
const KAG_G2 = 'BT01-022';
const DP_G1 = 'BT03-079';
const OPP = 'BT01-038';
/** A defender hand that keeps the battle paused in the guard step. */
const GUARD = [RP_G1];

describe('shared shapes', () => {
  it.each([
    ['BT03-011', DI_G2, DI_G1],
    ['BT03-016', PM_G2, PM_G1],
    ['BT03-017', TK_G2, TK_G1],
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
    ['BT03-023', DI_G1, DI_G2],
    ['BT03-043', DI_G1, DI_G2],
    ['BT03-063', RP_G1, RP_G2],
    ['BT03-066', RP_G1, RP_G2],
  ])('%s: +3000 during your turn with six clan cards in the soul', (card, a, b) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: card } },
      defender: { circles: { vanguard: OPP } },
      extra: [[a, a, a, a, b, b], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = ctx.registry.get(card).power;
    put(s, 0, [a, a, a, a, b], 'soul');
    expect(pw(s, vg)).toBe(base);
    put(s, 0, [b], 'soul');
    expect(pw(s, vg)).toBe(base + 3000);
  });

  it.each([
    ['BT03-024', DI_G2],
    ['BT03-028', PM_G2],
  ])('%s: placed on RC with a clan vanguard, may Soul-Charge 1', (card, vg) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg }, hand: [card] },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = s.players[0].soul.length;
    let r = apply(s, call(inHand(s, 0, card), 'back_left'));
    r = answer(r, 'yes');
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
  });

  it.each([
    ['BT03-025', 'BT03-012'],
    ['BT03-031', 'BT03-030'],
  ])('%s: another clan unit rides it, may Soul-Charge 1', (g0, g1) => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: g0 }, hand: [g1] },
      defender: { circles: { vanguard: OPP } },
    });
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, g1) });
    const soul = r.state.players[0].soul.length;
    r = answer(r, 'yes');
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
  });

  it.each([
    ['BT03-041', DI_G1],
    ['BT03-048', PM_G1],
    ['BT03-055', TK_G1],
  ])('%s (VC): another clan unit placed on RC, may Soul-Charge 1', (vg, unit) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg }, hand: [unit, OPP] },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = s.players[0].soul.length;
    let r = apply(s, call(inHand(s, 0, unit), 'back_left'));
    r = answer(r, 'yes');
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
    // a unit of another clan does not trigger it
    r = then(r, call(inHand(r.state, 0, OPP), 'back_right'));
    expect(r.state.pendingChoice).toBeNull();
  });

  it.each([
    ['BT03-049', PM_G2],
    ['BT03-069', OTT_G2],
    ['BT03-074', KAG_G2],
  ])('%s: attack hits with a clan vanguard, may Soul-Charge 1', (card, vg) => {
    const s = scene({
      attacker: { circles: { vanguard: vg, front_left: card } },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const soul = s.players[0].soul.length;
    let r = apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')));
    r = answer(passGuard(r), 'yes');
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
  });

  it.each(['BT03-047', 'BT03-054', 'BT03-061'])(
    '%s: boosted attack hits, Soul-Charge 1 and return to the deck',
    (trigger) => {
      const s = scene({
        attacker: { circles: { vanguard: OPP, front_left: OPP, back_left: trigger } },
        defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
      });
      const booster = unitAt(s, 0, 'back_left');
      const soul = s.players[0].soul.length;
      let r = apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), booster));
      r = answer(passGuard(r), 'yes');
      expect(r.state.players[0].soul).toHaveLength(soul + 1);
      expect(r.state.players[0].deck).toContain(booster);
      expect(r.state.players[0].circles.back_left).toEqual([]);
    },
  );

  it.each([
    ['BT03-004', 'vanguard'],
    ['BT03-034', 'back_left'],
    ['BT03-056', 'back_left'],
  ] as const)('%s: another Tachikaze rear-guard put into the drop zone, +1000', (card, circle) => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          ...(circle === 'vanguard' ? {} : { vanguard: TK_G2 }),
          [circle]: card,
          front_left: TK_G1,
        },
        hand: [TK_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const unit = unitAt(s, 0, circle);
    const before = pw(s, unit);
    // calling over a rear-guard puts the old one into the drop zone (CR 9.3.6)
    const r = apply(s, call(inHand(s, 0, TK_G1), 'front_left'));
    expect(pw(r.state, unit)).toBe(before + 1000);
  });

  it.each([
    ['BT03-005', 13000],
    ['BT03-064', 11000],
  ])('%s: attacks with two grade 3 Royal Paladins on the field, +3000', (card, expected) => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT03-005', front_right: 'BT03-005', front_left: card } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const unit = unitAt(s, 0, 'front_left');
    const r = apply(s, attack(unit, unitAt(s, 1, 'vanguard')));
    expect(pw(r.state, unit)).toBe(expected);
  });

  it('BT03-005: only one grade 3 Royal Paladin, no bonus', () => {
    const s = scene({
      attacker: { circles: { vanguard: RP_G2, front_left: 'BT03-005' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const unit = unitAt(s, 0, 'front_left');
    const r = apply(s, attack(unit, unitAt(s, 1, 'vanguard')));
    expect(pw(r.state, unit)).toBe(10000);
  });

  it.each(['BT03-019', 'BT03-075'])('%s: opponent has two or fewer rear-guards, +3000', (card) => {
    const base = ctx.registry.get(card).power;
    const s = scene({
      attacker: { circles: { vanguard: KAG_G2, front_left: card } },
      defender: { circles: { vanguard: OPP, front_left: OPP, front_right: OPP }, hand: GUARD },
    });
    let r = apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')));
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(base + 3000);
    const s3 = scene({
      attacker: { circles: { vanguard: KAG_G2, front_left: card } },
      defender: {
        circles: { vanguard: OPP, front_left: OPP, front_right: OPP, back_left: OPP },
        hand: GUARD,
      },
    });
    r = apply(s3, attack(unitAt(s3, 0, 'front_left'), unitAt(s3, 1, 'vanguard')));
    expect(pw(r.state, unitAt(s3, 0, 'front_left'))).toBe(base);
  });

  it.each(['BT03-014', 'BT03-030'])(
    '%s: Crimson Beast Tamer in the soul, +3000 on your turn',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: PM_G2, front_left: card } },
        defender: { circles: { vanguard: OPP } },
        extra: [['BT03-014'], []],
      });
      const unit = unitAt(s, 0, 'front_left');
      const base = pw(s, unit);
      put(s, 0, ['BT03-014'], 'soul');
      expect(pw(s, unit)).toBe(base + 3000);
    },
  );

  it.each(['BT03-039', 'BT03-040'])(
    "%s: your vanguard's drive check reveals a grade 3 Nova Grappler, [Stand]",
    (card) => {
      const s = scene({
        attacker: {
          circles: { vanguard: 'BT03-008', front_left: card },
          rested: ['front_left'],
          deckTop: ['BT03-008', ...vanilla(1)],
        },
        defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      });
      let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
      r = drain(passGuard(r));
      expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
    },
  );

  it.each([
    ['BT03-068', 'vanguard'],
    ['BT03-070', 'front_left'],
  ] as const)(
    '%s: attacks with six OTT in the soul, draw then a card to the bottom',
    (card, circle) => {
      const s = scene({
        attacker: {
          circles:
            circle === 'vanguard' ? { vanguard: card } : { vanguard: OTT_G2, front_left: card },
          hand: [OTT_G1],
        },
        defender: { circles: { vanguard: OPP }, hand: GUARD },
        extra: [[OTT_G1, OTT_G2, 'BT03-072'], []],
      });
      put(s, 0, [OTT_G1, OTT_G1, OTT_G2, OTT_G2, OTT_G2, 'BT03-072'], 'soul');
      const handCard = inHand(s, 0, OTT_G1);
      let r = apply(s, attack(unitAt(s, 0, circle), unitAt(s, 1, 'vanguard')));
      expect(r.state.players[0].hand).toHaveLength(2);
      r = answer(r, handCard);
      expect(r.state.players[0].hand).toHaveLength(1);
      expect(r.state.players[0].deck.at(-1)).toBe(handCard);
    },
  );
});

describe('ride chains (BT03-007, 036, 038, 062, 065, 071)', () => {
  it.each([
    ['BT03-038', 'BT03-071'],
    ['BT03-071', 'BT03-007'],
    ['BT03-007', 'BT03-006'],
    ['BT03-036', 'BT03-065'],
    ['BT03-065', 'BT03-062'],
    ['BT03-062', 'BT03-018'],
  ])('%s at the beginning of the ride phase rides %s from the top five', (vg, next) => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: vg }, deckTop: [...vanilla(3), next, ...vanilla(2)] },
    });
    // player 0 ends the turn; player 1 stands, draws one card, and the ride phase begins
    let r = apply(s, endPhase(0));
    const choice = r.state.pendingChoice!;
    expect(choice.player).toBe(1);
    expect(choice.options.map((id) => defOf(r.state, id))).toEqual([next]);
    const target = choice.options[0]!;
    const looked = r.state.players[1].deck.slice(0, 5).filter((id) => id !== target);
    r = drain(answer(r, target), 1); // the other four go to the bottom in the chosen order
    const p1 = r.state.players[1];
    expect(p1.circles.vanguard).toEqual([target]);
    expect(p1.deck.slice(-4)).toEqual(looked);
    // "if you rode, you cannot normal ride during that ride phase"
    expect(legal(r.state, 1, 'RIDE')).toBeUndefined();
  });

  it('declining keeps the normal ride and puts all five on the bottom in the chosen order', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: {
        circles: { vanguard: 'BT03-036' },
        hand: ['BT03-065'],
        deckTop: [...vanilla(1), 'BT03-065', ...vanilla(4)],
      },
    });
    let r = apply(s, endPhase(0));
    r = answer(r); // ride nothing
    const order: string[] = [];
    while (r.state.pendingChoice) {
      const last = r.state.pendingChoice.options.at(-1)!;
      order.push(last);
      r = answer(r, last);
    }
    const p1 = r.state.players[1];
    expect(order).toHaveLength(4); // the fifth goes last on its own
    expect(p1.deck.slice(-5, -1)).toEqual(order);
    expect(legal(r.state, 1, 'RIDE')).toBeDefined();
  });

  it('BT03-007: placed on VC with Crescent Moon and Ichibyoshi in the soul, may Soul-Charge 2', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT03-071' }, hand: ['BT03-007'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT03-038'], []],
    });
    put(s, 0, ['BT03-038'], 'soul');
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT03-007') });
    const soul = r.state.players[0].soul.length;
    r = answer(r, 'yes');
    expect(r.state.players[0].soul).toHaveLength(soul + 2);
  });

  it('BT03-062: when Knight of Godly Speed, Galahad rides it, may Soul-Charge 2', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT03-062' }, hand: ['BT03-018'] },
      defender: { circles: { vanguard: OPP } },
    });
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT03-018') });
    const soul = r.state.players[0].soul.length;
    r = answer(r, 'yes');
    expect(r.state.players[0].soul).toHaveLength(soul + 2);
  });
});

describe('BT03 vanguards and unique cards', () => {
  it('BT03-001 Stil Vampir: main phase Soul-Charge and +2000', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT03-001' } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const soul = s.players[0].soul.length;
    const r = apply(s, endPhase());
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
    expect(pw(r.state, vg)).toBe(12000);
  });

  it("BT03-001 Stil Vampir: puts an opponent's rear-guard on their VC; they ride from the soul at the end phase", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT03-001' }, damage: vanilla(5) },
      defender: { circles: { vanguard: OPP, front_left: RP_G1 } },
    });
    fillSoul(s, 0, 7);
    const oldVg = unitAt(s, 1, 'vanguard');
    const rg = unitAt(s, 1, 'front_left');
    let r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(r.state.players[1].circles.vanguard).toEqual([rg]);
    expect(r.state.players[1].soul).toContain(oldVg);
    expect(find(r.events, 'UNIT_RIDDEN')).toHaveLength(0);
    // main → battle → end phase: the opponent chooses a card from the soul and rides it
    r = then(r, endPhase(), endPhase());
    expect(r.state.pendingChoice?.player).toBe(1);
    r = answer(r, oldVg);
    expect(r.state.players[1].circles.vanguard).toEqual([oldVg]);
    expect(r.state.players[1].soul).toContain(rg);
  });

  it('BT03-002 Amon: +1000 per Dark Irregulars in the soul; the opponent retires a rear-guard', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT03-002', front_left: DI_G1 }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP, front_left: RP_G1, front_right: RP_G2 } },
      extra: [[DI_G1, DI_G1, DI_G1], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    put(s, 0, [DI_G1, DI_G1], 'soul');
    expect(pw(s, vg)).toBe(10000 + 2000);
    let r = drain(apply(s, activate(vg, '2'))); // pay: CB1 and Prisoner Beast into the soul
    expect(pw(r.state, vg)).toBe(10000 + 3000);
    expect(r.state.pendingChoice?.player).toBe(1);
    const victim = unitAt(s, 1, 'front_right');
    r = answer(r, victim);
    expect(r.state.players[1].drop).toContain(victim);
  });

  it.each(['BT03-003', 'BT03-015'])(
    '%s: attack hits, put it into the soul and call another Pale Moon from the soul',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: PM_G2, front_left: card }, damage: vanilla(1) },
        defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
        extra: [[PM_G1], []],
      });
      const [bicorn] = put(s, 0, [PM_G1], 'soul');
      const self = unitAt(s, 0, 'front_left');
      let r = apply(s, attack(self, unitAt(s, 1, 'vanguard')));
      r = drain(passGuard(r));
      expect(r.state.players[0].soul).toContain(self);
      expect(r.state.players[0].circles.front_left).toEqual([bicorn]);
    },
  );

  it('BT03-029 Midnight Bunny: boosted attack hits, swaps with a Pale Moon from the soul', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: PM_G2, front_left: PM_G2, back_left: 'BT03-029' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
      extra: [[PM_G1], []],
    });
    const [bicorn] = put(s, 0, [PM_G1], 'soul');
    const bunny = unitAt(s, 0, 'back_left');
    let r = apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), bunny));
    r = drain(passGuard(r));
    expect(r.state.players[0].soul).toContain(bunny);
    expect(Object.values(r.state.players[0].circles).flat()).toContain(bicorn);
  });

  it('BT03-006 Full Moon Tsukuyomi: -2000 without its lineage; ACT draws two and soul-ins one', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT03-006' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT03-007', 'BT03-071', 'BT03-038', OTT_G1, OTT_G2], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(11000 - 2000);
    put(s, 0, ['BT03-007', 'BT03-071', 'BT03-038'], 'soul');
    expect(pw(s, vg)).toBe(11000);
    put(s, 0, [OTT_G1, OTT_G2, OTT_G2], 'soul');
    const soul = s.players[0].soul.length;
    const r = drain(apply(s, activate(vg, '2')));
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
  });

  it('BT03-018 Godly Speed Galahad: -2000 without its lineage; ACT +3000/+1 with six RP in the soul', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT03-018' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT03-062', 'BT03-065', 'BT03-036', RP_G1, RP_G2], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(9000);
    put(s, 0, ['BT03-062', 'BT03-065', 'BT03-036', RP_G1, RP_G2, RP_G2], 'soul');
    const r = drain(apply(s, activate(vg, '2')));
    expect(pw(r.state, vg)).toBe(11000 + 3000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });

  it('BT03-008 Cosmo Lord: rest a Nova Grappler rear-guard for +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT03-008', front_left: NG_G1 } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg)));
    expect(pw(r.state, vg)).toBe(13000);
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('rest');
    // no standing Nova Grappler rear-guard left: not offered again
    expect(legal(r.state, 0, 'ACTIVATE')).toBeUndefined();
  });

  it('BT03-009 Edel Rose: from hand, searches Werwolf Sieger; +5000/+1 with it in the soul', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: DI_G2 }, hand: ['BT03-009'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    const rose = inHand(s, 0, 'BT03-009');
    let r = drain(apply(s, activate(rose, '2')));
    expect(r.state.players[0].deck).toContain(rose);
    expect(r.state.players[0].hand.map((id) => defOf(r.state, id))).toEqual(['BT03-022']);

    const s2 = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT03-009' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT03-022'], []],
    });
    put(s2, 0, ['BT03-022'], 'soul');
    const vg = unitAt(s2, 0, 'vanguard');
    r = drain(apply(s2, activate(vg, '1')));
    expect(pw(r.state, vg)).toBe(9000 + 5000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });

  it("BT03-010 Gwynn the Ripper: placed with a DI vanguard, retires an opponent's grade 2 or less rear-guard", () => {
    const g3 = scene({
      at: 'main',
      attacker: { circles: { vanguard: DI_G2 }, hand: ['BT03-010'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: 'BT01-001' } },
    });
    let r = drain(apply(g3, call(inHand(g3, 0, 'BT03-010'), 'front_left')));
    expect(r.state.players[1].circles.front_left).toHaveLength(1); // grade 3: not a target
    const g2 = scene({
      at: 'main',
      attacker: { circles: { vanguard: DI_G2 }, hand: ['BT03-010'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: RP_G2 } },
    });
    r = drain(apply(g2, call(inHand(g2, 0, 'BT03-010'), 'front_left')));
    expect(r.state.players[1].circles.front_left).toEqual([]);
  });

  it('BT03-012 Doreen: a card put into the soul in the main phase, +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: DI_G2, front_left: 'BT03-012' }, hand: ['BT03-024'] },
      defender: { circles: { vanguard: OPP } },
    });
    const doreen = unitAt(s, 0, 'front_left');
    let r = apply(s, call(inHand(s, 0, 'BT03-024'), 'back_left'));
    r = answer(r, 'yes'); // Alluring Succubus: Soul-Charge 1
    expect(pw(r.state, doreen)).toBe(6000 + 3000);
  });

  it('BT03-013 Robert: main phase charge and look; Ultimate puts grade 1 or less rear-guards into the soul', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT03-013' }, damage: vanilla(5) },
      defender: {
        circles: { vanguard: OPP, front_left: RP_G1, front_right: RP_G2, back_left: TK_G0 },
      },
    });
    const soul = s.players[0].soul.length;
    const top = s.players[0].deck[1]!; // after the Soul-Charge, this is the top card
    let r = apply(s, endPhase());
    r = answer(r, 'bottom');
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
    expect(r.state.players[0].deck.at(-1)).toBe(top);
    fillSoul(r.state, 0, 8 - r.state.players[0].soul.length);
    const g1 = unitAt(s, 1, 'front_left');
    const g0 = unitAt(s, 1, 'back_left');
    r = drain(then(r, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(r.state.players[1].soul).toEqual(expect.arrayContaining([g1, g0]));
    expect(r.state.players[1].circles.front_right).toHaveLength(1);
  });

  it('BT03-026 Barking Manticore: placed on VC, draw then a card into the soul; +3000 with Crimson', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: PM_G2 }, hand: ['BT03-026', PM_G1] },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT03-014'], []],
    });
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT03-026') });
    const soul = r.state.players[0].soul.length;
    r = answer(r, inHand(r.state, 0, PM_G1));
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
    const vg = r.state.players[0].circles.vanguard[0]!;
    put(r.state, 0, ['BT03-014'], 'soul');
    expect(pw(r.state, vg)).toBe(10000 + 3000);
  });

  it.each(['BT03-032', 'BT03-057'])(
    '%s: put into the drop zone from RC, discard to call another copy from the deck',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: TK_G2, front_left: card }, hand: [TK_G1, OPP] },
        defender: { circles: { vanguard: OPP } },
      });
      const old = unitAt(s, 0, 'front_left');
      const r = drain(apply(s, call(inHand(s, 0, TK_G1), 'front_left')));
      expect(r.state.players[0].drop).toContain(old);
      const field = Object.values(r.state.players[0].circles).flat();
      expect(field.some((id) => id !== old && defOf(r.state, id) === card)).toBe(true);
    },
  );

  it('BT03-020 Daiyusha: 14000 or more at the attack step, +1 critical', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT03-020', back_center: DP_G1 } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    const s2 = scene({
      attacker: { circles: { vanguard: 'BT03-020' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    r = apply(s2, attack(unitAt(s2, 0, 'vanguard'), unitAt(s2, 1, 'vanguard')));
    expect(currentCritical(r.state, ctx, unitAt(s2, 0, 'vanguard'))).toBe(1);
  });

  it('BT03-021 Saraqael: cannot attack until it pays Soul-Blast 3; +5000 boosted by a DI', () => {
    const blocked = scene({
      attacker: { circles: { vanguard: 'BT03-021' } },
      defender: { circles: { vanguard: OPP } },
    });
    const attackers = legal(blocked, 0, 'ATTACK')?.options.map((o) => o.attacker) ?? [];
    expect(attackers).not.toContain(unitAt(blocked, 0, 'vanguard'));

    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT03-021', back_center: DI_G1 } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    fillSoul(s, 0, 2);
    const vg = unitAt(s, 0, 'vanguard');
    let r = then(drain(apply(s, activate(vg, '2'))), endPhase());
    expect(legal(r.state, 0, 'ATTACK')?.options.map((o) => o.attacker)).toContain(vg);
    r = then(r, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    r = passGuard(r);
    expect(attackPower(r)).toBe(11000 + 8000 + 5000);
  });

  it('BT03-035 Toypugal: boosts with two grade 3 Royal Paladins, +3000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT03-005', front_right: 'BT03-005', back_center: 'BT03-035' },
      },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const bc = unitAt(s, 0, 'back_center');
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), bc));
    r = drain(r); // two abilities (Palamedes, Toypugal): the player orders them
    expect(pw(r.state, bc)).toBe(9000);
  });

  it('BT03-037 Blue Eye: boosts with six OTT in the soul, draw then a card to the bottom', () => {
    const s = scene({
      attacker: { circles: { vanguard: OTT_G2, back_center: 'BT03-037' }, hand: [OTT_G1] },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
      extra: [[OTT_G1, OTT_G2, 'BT03-072'], []],
    });
    put(s, 0, [OTT_G1, OTT_G1, OTT_G2, OTT_G2, OTT_G2, 'BT03-072'], 'soul');
    const handCard = inHand(s, 0, OTT_G1);
    let r = apply(
      s,
      attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
    );
    r = answer(r, handCard);
    expect(r.state.players[0].deck.at(-1)).toBe(handCard);
  });

  it('BT03-072 Battle Sister, Vanilla: guards with six OTT in the soul, +5000 shield', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OTT_G2 }, hand: ['BT03-072', RP_G1] },
      extra: [[], [OTT_G1, OTT_G2]],
    });
    put(s, 1, [OTT_G1, OTT_G1, OTT_G1, OTT_G2, OTT_G2, OTT_G2], 'soul');
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    const sister = inHand(r.state, 1, 'BT03-072');
    r = then(r, { type: 'GUARD', player: 1, cardId: sister });
    expect(currentShield(r.state, ctx, sister)).toBe(10000);
  });

  it('BT03-078 Grander: attacks with a DP vanguard, the vanguard gets +2000', () => {
    const s = scene({
      attacker: { circles: { vanguard: DP_G1, front_left: 'BT03-078' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const r = apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')));
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(8000 + 2000);
  });
});
