/** BT14 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, getLegalActions, type GameState, type PlayerId } from '../../src/engine';
import {
  answer,
  apply,
  andThen as then,
  ctx,
  find,
  scene,
  vanilla,
  type Run,
} from '../fixtures/bt01';
import { activate, attack, boosts, drain, field, inHand, passGuard } from '../fixtures/cardTest';
import {
  attackPumps,
  attackWith,
  callIt,
  fillSoul,
  OPP,
  OPP_G1,
  pw,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const RP_G2 = 'BT01-021';
const RP_G1 = 'BT01-042';
const GP_G2 = 'BT06-032';
const GP_G1 = 'BT06-082';
const GEN_G2 = 'BT10-028';
const GEN_G1 = 'BT10-066';
const KAG_G2 = 'BT01-022';
const KAG_G1 = 'BT01-048';
const NAR_G2 = 'BT06-037';
const NAR_G1 = 'BT06-091';
const MUR_G2 = 'BT05-029';
const MUR_G1 = 'BT05-055';
const NN_G2 = 'BT05-024';
const NN_G1 = 'BT05-044';

const defs = (s: GameState, ids: readonly string[]) => ids.map((id) => s.cards[id]!.definitionId);
const hand = (r: Run, p: PlayerId = 0) => r.state.players[p].hand.length;
/** Power modifiers of `amount` added during the run (to anything). */
const pumps = (r: Run, amount: number) =>
  find(r.events, 'MODIFIER_ADDED').filter(
    (e) => e.modifier.stat === 'power' && e.modifier.amount === amount,
  ).length;
/** The top `n` cards of player 0's deck become `def`. */
const topAs = (s: GameState, def: string, n: number) => {
  for (const id of s.players[0].deck.slice(0, n))
    (s.cards[id] as { definitionId: string }).definitionId = def;
};
const deckTo = (s: GameState, def: string, zone: 'drop' | 'soul' | 'damage', p: PlayerId = 0) => {
  const pl = s.players[p];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl[zone].push(id);
  s.cards[id]!.faceUp = true;
  return id;
};
const faceDown = (s: GameState) => {
  for (const id of s.players[0].damage) s.cards[id]!.faceUp = false;
};
const faceDownCount = (s: GameState) =>
  s.players[0].damage.filter((id) => !s.cards[id]!.faceUp).length;
const toEnd = (r: Run): Run => {
  for (let i = 0; i < 4 && r.state.phase !== 'end' && r.state.activePlayer === 0; i++)
    r = drain(then(r, { type: 'END_PHASE', player: 0 }));
  return drain(r);
};
/** Resolve the battle: the defender passes, both players answer their choices. */
const resolve = (r: Run): Run => {
  r = drain(passGuard(drain(r)));
  for (let i = 0; i < 6; i++) r = drain(drain(r, 1));
  return r;
};
/** Bonus of `card` on (VC) once a card named `named` is in the soul. */
const soulBonus = (card: string, named: string) => {
  const s = scene({
    attacker: { circles: { vanguard: card } },
    defender: { circles: { vanguard: OPP } },
    extra: [[named], []],
  });
  const vg = unitAt(s, 0, 'vanguard');
  const before = pw(s, vg);
  toSoul(s, named);
  return pw(s, vg) - before;
};
/** `card` rides `vanguard` (ride phase); `top` cards go on top of the deck. */
const ride = (
  card: string,
  vanguard: string,
  opts: {
    damage?: readonly string[];
    others?: Record<string, string>;
    soul?: string[];
    extra?: string[];
    top?: [string, number];
    oppField?: Record<string, string>;
    /** Prefer every card of this definition when answering choices ("up to two"). */
    prefer?: string;
  } = {},
) => {
  const s = scene({
    at: 'ride',
    attacker: { circles: { vanguard, ...opts.others }, hand: [card], damage: opts.damage ?? [] },
    defender: { circles: { vanguard: OPP, ...opts.oppField }, hand: [OPP_G1], deckTop: vanilla(4) },
    extra: [[...(opts.soul ?? []), ...(opts.extra ?? [])], []],
  });
  for (const d of opts.soul ?? []) toSoul(s, d);
  if (opts.top) topAs(s, ...opts.top);
  const prefer = opts.prefer
    ? Object.keys(s.cards).filter((id) => s.cards[id]!.definitionId === opts.prefer)
    : [];
  let r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) }), 0, prefer);
  for (let i = 0; i < 3; i++) r = drain(drain(r, 1), 0, prefer);
  return { s, r };
};
/** Player 1 (vanguard `vanguard`) guards an attack with `sentinel` from hand. */
const guardWith = (
  sentinel: string,
  vanguard: string,
  deckTop: string[],
  more: string[] = [OPP_G1],
) => {
  const s = scene({
    attacker: { circles: { vanguard: KAG_G2 } },
    defender: { circles: { vanguard }, hand: [sentinel, ...more], damage: vanilla(1), deckTop },
  });
  let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
  r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, sentinel) });
  return drain(r, 1);
};
/** "reveal five, call all <clan> to (GC) at [Rest], the rest to the drop zone" */
const sentinelCallCount = (sentinel: string, vanguard: string, own: string, other: string) => {
  const r = guardWith(sentinel, vanguard, [own, other, own, other, own]);
  const p = r.state.players[1];
  expect(p.guardian.every((id) => r.state.cards[id]!.orientation === 'rest')).toBe(true);
  expect(defs(r.state, p.drop)).toEqual([other, other]);
  return p.guardian.length;
};
/** [ACT](RC) of `card` on front-left (main phase) with `vanguard`. */
const actOn = (
  card: string,
  vanguard: string,
  opts: { damage?: number; soul?: number; hand?: string[]; id?: string; rested?: boolean } = {},
) => {
  const s = scene({
    at: 'main',
    attacker: {
      circles: { vanguard, front_left: card },
      hand: opts.hand ?? [],
      damage: vanilla(opts.damage ?? 0),
      ...(opts.rested ? { rested: ['front_left' as const] } : {}),
    },
    defender: { circles: { vanguard: OPP } },
  });
  if (opts.soul) fillSoul(s, 0, opts.soul);
  const unit = unitAt(s, 0, 'front_left');
  return { s, unit, r: drain(apply(s, activate(unit, opts.id ?? '1'))) };
};
/** [Put this unit into your soul & discard a card] draw: hand size stays, the unit goes to the soul. */
const soulDiscardDraws = (card: string, vanguard: string) => {
  const { r, unit } = actOn(card, vanguard, { hand: [OPP_G1], id: '2' });
  return (
    r.state.players[0].soul.includes(unit) && hand(r) === 1 && r.state.players[0].drop.length === 1
  );
};
/** "When this unit's attack hits a vanguard, … turn a damage card face up" */
const hitFlips = (card: string, vanguard: string) => {
  const { r } = attackWith(card, {
    on: 'front_left',
    vanguard,
    damage: 2,
    oppVanguard: OPP_G1,
    oppHand: [],
    before: faceDown,
  });
  return 2 - faceDownCount(resolve(r).state);
};
/** A grade 3 `rider` of the clan rides onto `vanguard` with `card` on front-left (+10000 shapes). */
const arrivesPump = (card: string, rider: string, vanguard: string) => {
  const { s, r } = ride(rider, vanguard, { others: { front_left: card } });
  return pw(r.state, unitAt(s, 0, 'front_left'));
};
/** Drive checks reveal two `def`: the number of +2000 bonuses. */
const driveChecks2000 = (card: string, def: string) => {
  const { r } = attackWith(card, { oppHand: [], before: (s) => topAs(s, def, 2) });
  return pumps(resolve(r), 2000);
};
/** [ACT](RC): send a grade 3 X from the drop zone to the deck bottom; your grade 3 X vanguard +5000. */
const dropBottomPumps = (card: string, vanguard: string) => {
  const s = scene({
    at: 'main',
    attacker: { circles: { vanguard, front_left: card } },
    defender: { circles: { vanguard: OPP } },
  });
  const dropped = deckTo(s, vanguard, 'drop');
  const vg = unitAt(s, 0, 'vanguard');
  const before = pw(s, vg);
  const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
  expect(r.state.players[0].deck.at(-1)).toBe(dropped);
  return pw(r.state, vg) - before;
};

describe('Royal Paladin: Jewel Knights and Sanctuary of Light', () => {
  it('BT14-001 Broken Heart Jewel Knight, Ashlei "Яeverse": [LB4] lock a Jewel Knight: retire a front-row rear-guard, call a Jewel Knight; +2000 with Pure Heart Ashlei in the soul', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT14-001', front_left: 'BT14-047' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
      extra: [['BT14-049'], []],
    });
    const melmy = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(r.state.cards[melmy]!.locked).toBe(true);
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
    expect(field(r.state, 0).filter((d) => d !== 'BT14-001')).toHaveLength(2);
    // once per turn
    expect(
      getLegalActions(r.state, 0, ctx).some(
        (a) =>
          a.type === 'ACTIVATE' && a.options.some((o) => o.source === unitAt(s, 0, 'vanguard')),
      ),
    ).toBe(false);
    expect(soulBonus('BT14-001', 'BT10-001')).toBe(2000);
  });

  it('BT14-009 Sanctuary of Light, Planetal Dragon: [LB4] Sanctuary of Light units +3000; placed on (VC): [CB2] call one; +1000 with Determinator in the soul', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT14-009', front_left: 'BT14-021' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, unitAt(s, 0, 'front_left'), 3000)).toBe(1);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
    const placed = ride('BT14-009', 'BT14-021', { damage: vanilla(2), extra: ['BT14-046'] });
    expect(field(placed.r.state, 0)).toHaveLength(2);
    expect(soulBonus('BT14-009', 'BT14-021')).toBe(1000);
  });

  it('BT14-010 Banding Jewel Knight, Miranda: +2000 with an Ashlei vanguard; on a hit a Royal Paladin +3000', () => {
    expect(attackPumps('BT14-010', 2000, { on: 'front_left', vanguard: 'BT14-001' })).toBe(1);
    expect(attackPumps('BT14-010', 2000, { on: 'front_left', vanguard: RP_G2 })).toBe(0);
    const { r } = attackWith('BT14-010', { on: 'front_left', vanguard: 'BT14-001', oppHand: [] });
    expect(pumps(resolve(r), 3000)).toBe(1);
  });

  it('BT14-011 Summoning Jewel Knight, Gloria: [CB1] placed on (GC) from hand: call every Royal Paladin of the top five to (GC)', () => {
    expect(sentinelCallCount('BT14-011', RP_G2, RP_G1, KAG_G1)).toBe(4);
  });

  it('BT14-021 Sanctuary of Light, Determinator: riding Little Storm with Planet Lancer in the soul calls a Sanctuary of Light; +1000 with Little Storm in the soul', () => {
    const { r } = ride('BT14-021', 'BT14-046', { soul: ['BT14-023'], extra: ['BT14-009'] });
    expect(field(r.state, 0)).toHaveLength(2);
    const none = ride('BT14-021', 'BT14-046', { extra: ['BT14-009'] });
    expect(field(none.r.state, 0)).toHaveLength(1);
    expect(soulBonus('BT14-021', 'BT14-046')).toBe(1000);
  });

  it('BT14-022 Linking Jewel Knight, Tilda: [CB1] a grade 3 Jewel Knight is placed on (VC): call a grade 1 or less Royal Paladin', () => {
    const { r } = ride('BT14-001', RP_G2, {
      damage: vanilla(1),
      others: { front_left: 'BT14-022' },
      extra: [RP_G1],
    });
    expect(field(r.state, 0)).toHaveLength(3);
  });

  it('BT14-023 Sanctuary of Light, Planet Lancer: Little Storm rides it: search Planetal Dragon or Determinator; another Royal Paladin rides it: call it', () => {
    const { r } = ride('BT14-046', 'BT14-023', { extra: ['BT14-009'], top: ['BT14-009', 7] });
    expect(defs(r.state, r.state.players[0].hand)).toContain('BT14-009');
    const other = ride(RP_G1, 'BT14-023');
    expect(field(other.r.state, 0)).toContain('BT14-023');
    expect(field(other.r.state, 0)).toHaveLength(2);
  });

  it('BT14-043 Knight of Frevor, Hector: +2000 for each Royal Paladin drive check', () => {
    expect(driveChecks2000('BT14-043', RP_G1)).toBe(2);
    expect(driveChecks2000('BT14-043', KAG_G1)).toBe(0);
  });

  it('BT14-044 Mystical Hermit: (RC) hits a vanguard: a Royal Paladin +3000', () => {
    const { r } = attackWith('BT14-044', { on: 'front_left', vanguard: RP_G2, oppHand: [] });
    expect(pumps(resolve(r), 3000)).toBe(1);
  });

  it('BT14-045 Jewel Knight, Tranmy / BT14-047 Jewel Knight, Melmy: [CB1] damage the top card, return one at the end of turn', () => {
    for (const card of ['BT14-045', 'BT14-047']) {
      const { r } = callIt(card, { vanguard: RP_G2, damage: 1 });
      expect(r.state.players[0].damage).toHaveLength(2);
      expect(toEnd(r).state.players[0].damage).toHaveLength(1);
    }
  });

  it('BT14-046 Sanctuary of Light, Little Storm: a grade 2 Royal Paladin rides it with Planet Lancer in the soul: ride Determinator; +1000 with Planet Lancer in the soul', () => {
    const { s, r } = ride(RP_G2, 'BT14-046', {
      soul: ['BT14-023'],
      extra: ['BT14-021'],
      top: ['BT14-021', 7],
    });
    expect(defs(r.state, r.state.players[0].circles.vanguard)).toEqual(['BT14-021']);
    expect(s).toBeDefined();
    expect(soulBonus('BT14-046', 'BT14-023')).toBe(1000);
  });

  it('BT14-048 Security Jewel Knight, Alwain: a grade 3 Ashlei from the drop zone to the deck bottom: an Ashlei +5000', () => {
    expect(dropBottomPumps('BT14-048', 'BT14-001')).toBe(5000);
  });

  it('BT14-049 Desire Jewel Knight, Heloise: boosts with three other Jewel Knight rear-guards: +3000', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: RP_G2,
          back_center: 'BT14-049',
          front_left: 'BT14-047',
          front_right: 'BT14-047',
          back_left: 'BT14-048',
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
    expect(boosts(r, vg, 3000)).toBe(1);
  });
});

describe('Gold Paladin: Liberators and Ezel', () => {
  it('BT14-002 Liberator of Bonds, Gancelot Zenith: [LB4][CB1 Liberator, a grade 2 or less rear-guard to the deck bottom] call the top Gold Paladin +10000; +2000 with Solitary Liberator in the soul', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT14-002', front_left: GP_G2 },
        damage: ['BT14-056', ...vanilla(3)],
      },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    topAs(s, GP_G1, 1);
    const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(pumps(r, 10000)).toBe(1);
    expect(field(r.state, 0)).toEqual(['BT14-002', GP_G1]);
    expect(soulBonus('BT14-002', 'TD08-001')).toBe(2000);
  });

  it('BT14-003 Salvation Lion, Grand Ezel Scissors: +1000 per Gold Paladin rear-guard; [LB4] unlock all, five rear-guards: +10000/+1, end of turn Soul-Charge and flip a damage', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'BT14-003',
          front_left: GP_G2,
          front_right: GP_G2,
          back_left: GP_G1,
          back_center: GP_G1,
          back_right: GP_G1,
        },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 2);
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(16000);
    const locked = unitAt(s, 0, 'back_right');
    s.cards[locked]!.locked = true;
    s.cards[locked]!.faceUp = false;
    const r = drain(apply(s, activate(vg)));
    expect(r.state.cards[locked]!.locked).toBe(false);
    expect(pw(r.state, vg)).toBe(26000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    expect(faceDownCount(r.state)).toBe(2);
    const end = toEnd(r);
    expect(end.state.players[0].soul).toHaveLength(2); // the scene's soul card + Soul-Charge 1
    expect(faceDownCount(end.state)).toBe(1);
  });

  it('BT14-012 Sword Formation Liberator, Igraine: calls every Gold Paladin of the top five to (GC)', () => {
    expect(sentinelCallCount('BT14-012', GP_G2, GP_G1, KAG_G1)).toBe(4);
  });

  it('BT14-024 Treasure Liberator, Calogrenant: [CB1] a grade 3 Gold Paladin drive check calls the top Gold Paladin; +3000 attacking a vanguard', () => {
    const { r } = attackWith('BT14-024', {
      damage: 1,
      oppHand: [],
      before: (s) => topAs(s, 'BT14-055', 3),
    });
    expect(pumps(r, 3000)).toBe(1);
    expect(field(resolve(r).state, 0)).toHaveLength(2);
  });

  it('BT14-025 Blue Skies Liberator, Hengist: [CB2] hits: draw', () => {
    const { r } = attackWith('BT14-025', {
      on: 'front_left',
      vanguard: GP_G2,
      damage: 2,
      oppVanguard: OPP_G1,
      oppHand: [],
    });
    expect(hand(resolve(r))).toBe(1);
  });

  it('BT14-026 Burning Scale Knight, Eliwood: [CB1] a grade 3 Ezel is placed on (VC): call the top Gold Paladin', () => {
    const { r } = ride('BT14-003', GP_G2, {
      damage: vanilla(1),
      others: { front_left: 'BT14-026' },
      top: [GP_G1, 1],
    });
    expect(field(r.state, 0)).toHaveLength(3);
  });

  it('BT14-054 Sacred Guardian Beast, Ceryneia: (RC) hits a vanguard: a Gold Paladin +3000', () => {
    const { r } = attackWith('BT14-054', { on: 'front_left', vanguard: GP_G2, oppHand: [] });
    expect(pumps(resolve(r), 3000)).toBe(1);
  });

  it('BT14-055 Liberator, Burning Blow: +2000 for each Gold Paladin drive check', () => {
    expect(driveChecks2000('BT14-055', GP_G1)).toBe(2);
  });

  it('BT14-056 Dolgal Liberator: [CB1] another Liberator hits a vanguard: +5000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: GP_G2, front_left: 'BT14-025', front_right: 'BT14-056' },
        damage: vanilla(3),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = resolve(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, unitAt(s, 0, 'front_right'), 5000)).toBe(1);
  });

  it('BT14-057 Sacred Twin Beast, Black Lion / BT14-088 Stealth Beast, Chain Geek: +3000 with four rear-guards of the clan during your turn', () => {
    for (const [card, g2, g1] of [
      ['BT14-057', GP_G2, GP_G1],
      ['BT14-088', MUR_G2, MUR_G1],
    ] as const) {
      const three = { vanguard: g2, front_left: card, front_right: g2, back_left: g1 };
      const s = scene({
        attacker: { circles: { ...three, back_center: g1 } },
        defender: { circles: { vanguard: OPP } },
      });
      expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(11000);
      const t = scene({ attacker: { circles: three }, defender: { circles: { vanguard: OPP } } });
      expect(pw(t, unitAt(t, 0, 'front_left'))).toBe(8000);
    }
  });

  it('BT14-058 Blue Axe Knight, Taliesin: a grade 3 Gold Paladin is placed on (VC): +10000', () => {
    expect(arrivesPump('BT14-058', 'BT14-055', GP_G2)).toBe(18000);
  });

  it('BT14-059 Knight of Passion, Torre: +3000 with an Ezel vanguard', () => {
    expect(attackPumps('BT14-059', 3000, { on: 'front_left', vanguard: 'BT14-003' })).toBe(1);
    expect(attackPumps('BT14-059', 3000, { on: 'front_left', vanguard: GP_G2 })).toBe(0);
  });

  it('BT14-060 Sacred Twin Beast, White Lion: [CB1] placed on (RC) with an Ezel vanguard: Soul-Charge 1, damage the top card, return one at the end of turn', () => {
    const { r } = callIt('BT14-060', { vanguard: 'BT14-003', damage: 1 });
    expect(r.state.players[0].soul).toHaveLength(2);
    expect(r.state.players[0].damage).toHaveLength(2);
    expect(toEnd(r).state.players[0].damage).toHaveLength(1);
  });

  it('BT14-061 Flying Sword Liberator, Gorlois: a grade 3 Gancelot from the drop zone: a Gancelot +5000', () => {
    expect(dropBottomPumps('BT14-061', 'BT14-002')).toBe(5000);
  });

  it('BT14-062 Knife Throwing Knight, Maleagant: [SB2] placed on (RC): turn up to two damage cards face up', () => {
    const { r } = callIt('BT14-062', { vanguard: GP_G2, damage: 2, soul: 2, before: faceDown });
    expect(faceDownCount(r.state)).toBe(1); // "up to two": the test picks one
  });

  it('BT14-063 Scarlet Lion Cub, Caria: boosted Ezel hits: into the soul, call Gold Paladins of the top two to open (RC) at [Rest]', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT14-003', back_center: 'BT14-063' } },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    topAs(s, GP_G1, 4);
    const caria = unitAt(s, 0, 'back_center');
    const r = resolve(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), caria)));
    expect(r.state.players[0].soul).toContain(caria);
    const called = Object.values(r.state.players[0].circles)
      .flat()
      .filter((id) => r.state.cards[id]!.definitionId === GP_G1);
    expect(called).toHaveLength(1); // "up to two": the test picks one
    expect(called.every((id) => r.state.cards[id]!.orientation === 'rest')).toBe(true);
  });
});

describe('Genesis: Regalia and soul', () => {
  it('BT14-004 Sunlight Goddess, Yatagarasu: [LB4][SB9] draw two and stand two Genesis rear-guards; a Genesis guardian goes to the soul once per battle', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT14-004', front_left: GEN_G2 },
        rested: ['front_left'],
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    fillSoul(s, 0, 9);
    const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(hand(r)).toBe(2);
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');

    const g = scene({
      attacker: { circles: { vanguard: KAG_G2 }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: 'BT14-004' }, hand: [GEN_G1, GEN_G1] },
    });
    let b = apply(g, attack(unitAt(g, 0, 'vanguard'), unitAt(g, 1, 'vanguard')));
    for (const id of [...b.state.players[1].hand])
      b = drain(then(b, { type: 'GUARD', player: 1, cardId: id }), 1);
    b = passGuard(b);
    for (let i = 0; i < 6; i++) b = drain(drain(b), 1);
    expect(b.state.battle).toBeNull();
    expect(b.state.players[1].soul).toHaveLength(2); // the scene's soul card + one guardian
    expect(b.state.players[1].drop).toHaveLength(1);
  });

  it('BT14-005 Omniscience Regalia, Minerva: [LB4][CB1, SB3, discard three Genesis] at the end of its battle: [Stand] and +5000; +2000 with Angelica in the soul', () => {
    const { r, unit } = attackWith('BT14-005', {
      damage: 4,
      soul: 3,
      hand: [GEN_G1, GEN_G1, GEN_G1],
      oppHand: [],
    });
    const done = resolve(r);
    expect(done.state.cards[unit]!.orientation).toBe('stand');
    expect(boosts(done, unit, 5000)).toBe(1);
    expect(defs(done.state, done.state.players[0].hand)).not.toContain(GEN_G1);
    expect(soulBonus('BT14-005', 'TD13-001')).toBe(2000);
  });

  it('BT14-013 Shield Goddess, Aegis: calls every Genesis of the top five to (GC)', () => {
    expect(sentinelCallCount('BT14-013', GEN_G2, GEN_G1, KAG_G1)).toBe(4);
  });

  it('BT14-029 Battle Maiden, Amenohoakari: boosts a grade 3 Genesis: may Soul-Charge 1', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT14-005', back_center: 'BT14-029' } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const r = drain(
      apply(
        s,
        attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
      ),
    );
    expect(r.state.players[0].soul).toHaveLength(2);
  });

  it('BT14-066 Angelic Wiseman: [SB3] attacks: +4000', () => {
    expect(attackPumps('BT14-066', 4000, { soul: 2 })).toBe(1); // plus the scene's soul card
    expect(attackPumps('BT14-066', 4000, { soul: 1 })).toBe(0);
  });

  it('BT14-067 Myth Guard, Fomalhaut: +2000 for each Genesis drive check', () => {
    expect(driveChecks2000('BT14-067', GEN_G1)).toBe(2);
  });

  it('BT14-068 Witch of Grapes, Grappa / BT14-071 Witch of Oranges, Valencia: put into the drop zone from the soul: may Soul-Charge 2', () => {
    for (const card of ['BT14-068', 'BT14-071']) {
      // Wiseman's [SB3] sends all three soul cards (the scene's, one more and `card`) to the drop zone
      const s = scene({
        attacker: { circles: { vanguard: 'BT14-066' } },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
        extra: [[card], []],
      });
      fillSoul(s, 0, 1);
      toSoul(s, card);
      const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
      expect(r.state.players[0].soul).toHaveLength(2);
    }
  });

  it('BT14-069 Myth Guard, Denebola / BT14-072 Myth Guard, Achernar: a card of the same name leaves the soul for the drop zone: +3000', () => {
    for (const card of ['BT14-069', 'BT14-072']) {
      const s = scene({
        attacker: { circles: { vanguard: 'BT14-066', front_left: card } },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
      });
      fillSoul(s, 0, 1);
      toSoul(s, card);
      const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
      expect(boosts(r, unitAt(s, 0, 'front_left'), 3000)).toBe(1);
    }
  });

  it('BT14-070 Battle Maiden, Kayanarumi / BT14-079 Demonic Dragon Mage, Taksaka: +3000 with more rear-guards than the opponent', () => {
    expect(attackPumps('BT14-070', 3000, { on: 'front_left', vanguard: GEN_G2 })).toBe(1);
    expect(attackPumps('BT14-079', 3000, { on: 'front_left', vanguard: KAG_G2 })).toBe(1);
    expect(attackPumps('BT14-070', 3000)).toBe(0);
  });

  it('BT14-073 Goddess of Union, Yuno: +3000 with a Regalia vanguard', () => {
    expect(attackPumps('BT14-073', 3000, { on: 'front_left', vanguard: 'BT14-005' })).toBe(1);
  });

  it('BT14-074 Ordain Owl: a grade 3 Regalia from the drop zone: a Regalia +5000', () => {
    expect(dropBottomPumps('BT14-074', 'BT14-005')).toBe(5000);
  });

  it('BT14-075 Spectral Sheep / BT14-083 Egg Prison Seal Dragon Knight / BT14-097 Wish Granting Djinn: into the soul and discard: draw', () => {
    expect(soulDiscardDraws('BT14-075', GEN_G2)).toBe(true);
    expect(soulDiscardDraws('BT14-083', KAG_G2)).toBe(true);
    expect(soulDiscardDraws('BT14-097', NAR_G2)).toBe(true);
  });
});

describe('Kagero: Dauntless and Seal Dragons', () => {
  it('BT14-006 Dauntless Dominate Dragon "Яeverse": [LB4] lock a Kagero: grade 1+ Kagero drive checks retire a grade 1 or less rear-guard and +3000; +2000 with Dauntless Drive Dragon in the soul', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT14-006', front_left: KAG_G2 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1 } },
    });
    topAs(s, KAG_G1, 3);
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(apply(s, activate(vg)));
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.locked).toBe(true);
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = resolve(then(r, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
    expect(r.state.players[1].circles.front_right).toHaveLength(0);
    expect(boosts(r, vg, 3000)).toBe(2);
    expect(soulBonus('BT14-006', 'BT11-005')).toBe(2000);
  });

  it('BT14-030 Vorpal Cannon Dragon: [LB4] +5000 attacking a vanguard; [CB2] placed on (VC): retire a grade 2 or less rear-guard', () => {
    expect(attackPumps('BT14-030', 5000, { damage: 4 })).toBe(1);
    const { r } = ride('BT14-030', KAG_G2, {
      damage: vanilla(2),
      oppField: { front_left: OPP_G1 },
    });
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
  });

  it('BT14-031 Flame Dance, Agni: (VC) +10000 against 12000 or more; (RC) +2000 with a Kagero vanguard', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT14-031' } },
      defender: { circles: { vanguard: 'BT14-002' }, hand: [OPP_G1] },
      extra: [[], ['TD08-001']],
    });
    deckTo(s, 'TD08-001', 'soul', 1); // the defender's Gancelot Zenith is 13000
    const vg = unitAt(s, 0, 'vanguard');
    expect(boosts(drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard')))), vg, 10000)).toBe(1);
    expect(attackPumps('BT14-031', 10000)).toBe(0);
    expect(attackPumps('BT14-031', 2000, { on: 'front_left', vanguard: KAG_G2 })).toBe(1);
  });

  it('BT14-032 Dominate Drive Dragon / BT14-080 Diable Drive Dragon: +3000 with a Dauntless vanguard', () => {
    expect(attackPumps('BT14-032', 3000, { on: 'front_left', vanguard: 'BT14-006' })).toBe(1);
    expect(attackPumps('BT14-080', 3000, { on: 'front_left', vanguard: 'BT14-006' })).toBe(1);
    expect(attackPumps('BT14-080', 3000, { on: 'front_left', vanguard: KAG_G2 })).toBe(0);
  });

  it('BT14-033 Dragon Knight, Akram: [SB1] boosts a Dauntless: +6000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT14-006', back_center: 'BT14-033' } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    fillSoul(s, 0, 1);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
    expect(boosts(r, vg, 6000)).toBe(1);
  });

  it('BT14-034 Dragon Knight, Sadegh: [into the soul] an opposing rear-guard is retired by your effect: the opponent retires another', () => {
    const { r } = ride('BT14-030', KAG_G2, {
      damage: vanilla(2),
      others: { front_left: 'BT14-034' },
      oppField: { front_left: OPP_G1, front_right: OPP_G1 },
    });
    expect(r.state.players[1].drop).toHaveLength(2);
    expect(defs(r.state, r.state.players[0].soul)).toContain('BT14-034');
  });

  it('BT14-076 Dragon Knight, Jaral: +2000 for each Kagero drive check', () => {
    expect(driveChecks2000('BT14-076', KAG_G1)).toBe(2);
  });

  it("BT14-077 Flame Star Seal Dragon Knight: [CB1] with a Seal Dragon vanguard: the opponent's rear-guards cannot intercept", () => {
    const run = (vanguard: string) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard, front_left: 'BT14-077' }, damage: vanilla(1) },
        defender: { circles: { vanguard: OPP, front_left: OPP } },
      });
      const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
      return r.state.restrictions.filter(
        (x) => x.target === unitAt(s, 1, 'front_left') && x.restriction === 'cannot_intercept',
      ).length;
    };
    expect(run('BT11-010')).toBe(1);
    expect(run(KAG_G2)).toBe(0);
  });

  it('BT14-078 Dragon Knight, Razer / BT14-094 Plasma Scimitar Dragoon: a grade 3 of the clan is placed on (VC): +10000', () => {
    expect(arrivesPump('BT14-078', 'BT14-076', KAG_G2)).toBe(18000);
    expect(arrivesPump('BT14-094', 'BT14-093', NAR_G2)).toBe(18000);
  });

  it('BT14-081 Explosive Claw Seal Dragon Knight: +3000 attacking a grade 2', () => {
    expect(attackPumps('BT14-081', 3000, { on: 'front_left', vanguard: KAG_G2 })).toBe(1);
    expect(
      attackPumps('BT14-081', 3000, { on: 'front_left', vanguard: KAG_G2, oppVanguard: OPP_G1 }),
    ).toBe(0);
  });

  it('BT14-082 Calamity Tower Wyvern: [SB2] placed on (RC): draw', () => {
    const { r } = callIt('BT14-082', { vanguard: KAG_G2, soul: 2 });
    expect(hand(r)).toBe(1);
  });
});

describe('Narukami: Eradicators', () => {
  it('BT14-007 Eradicator, Ignition Dragon: [LB4][CB1] a Narukami rides it: the opponent retires two, the vanguard +10000; +2000 with more rear-guards', () => {
    const { s, r } = ride('BT14-093', 'BT14-007', {
      damage: vanilla(4),
      oppField: { front_left: OPP_G1, front_right: OPP_G1 },
    });
    expect(r.state.players[1].drop).toHaveLength(2);
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
    expect(s).toBeDefined();
    const a = scene({
      attacker: { circles: { vanguard: 'BT14-007', front_left: NAR_G2 } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const vg = unitAt(a, 0, 'vanguard');
    expect(boosts(drain(apply(a, attack(vg, unitAt(a, 1, 'vanguard')))), vg, 2000)).toBe(1);
  });

  it('BT14-008 Eradicator, Tempest Bolt Dragon: +2000 for each open (RC) of both fighters; [LB4][CB3 Eradicator] retire every rear-guard', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT14-008', front_left: NAR_G2 },
        damage: ['BT14-017', 'BT14-038', 'BT14-039', NAR_G1],
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1, back_left: OPP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(11000 + 7 * 2000);
    const r = drain(apply(s, activate(vg)));
    expect(field(r.state, 0)).toEqual(['BT14-008']);
    expect(field(r.state, 1)).toEqual([OPP]);
    expect(pw(r.state, vg)).toBe(11000 + 10 * 2000);
  });

  it('BT14-017 Eradicator, Lorentz Force Dragon: [CB1] a grade 3 Eradicator is placed on (VC): the opponent retires a rear-guard', () => {
    const { r } = ride('BT14-008', NAR_G2, {
      damage: vanilla(1),
      others: { front_left: 'BT14-017' },
      oppField: { front_left: OPP_G1 },
    });
    expect(r.state.players[1].drop).toHaveLength(1);
  });

  it('BT14-038 Deadly Eradicator, Ouei / BT14-095 Dragon Dancer, Agatha: Ouei retires a front-row rear-guard when a grade 3 Narukami arrives; Agatha then gives +3000', () => {
    const { r } = ride('BT14-093', NAR_G2, {
      others: { front_left: 'BT14-038', back_left: 'BT14-095' },
      oppField: { front_left: OPP_G1 },
    });
    expect(r.state.players[1].drop).toHaveLength(1);
    expect(defs(r.state, r.state.players[0].soul)).toContain('BT14-038');
    expect(pumps(r, 3000)).toBe(1);
  });

  it('BT14-039 Spirit Beads Eradicator, Nata: [into the soul] the Eradicator vanguard gets +3000 whenever an opposing rear-guard is put into the drop zone by your effect', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT14-008', front_left: 'BT14-039' },
        damage: ['BT14-017', 'BT14-038', 'BT14-039', NAR_G1],
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    r = drain(then(r, activate(vg)));
    expect(boosts(r, vg, 3000)).toBe(2);
  });

  it('BT14-093 Thundering Bow, Zahraa / BT14-040 White Rose Musketeer, Alberto: hits a vanguard: turn a damage card face up', () => {
    expect(hitFlips('BT14-093', NAR_G2)).toBe(1);
    expect(hitFlips('BT14-040', NN_G2)).toBe(1);
  });

  it('BT14-096 Wyvern Strike, Zalus: [Rest] another Narukami +2000', () => {
    const { s, r } = actOn('BT14-096', NAR_G2);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 2000)).toBe(1);
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('rest');
  });
});

describe('Murakumo: copies', () => {
  it('BT14-014 Covert Demonic Dragon, Kagura Bloome: [LB4][CB1] a Murakumo rides it: +10000 and two copies of the vanguard until the end of turn; +2000 boosted by a Murakumo', () => {
    const { r } = ride('BT14-035', 'BT14-014', { damage: vanilla(4), prefer: 'BT14-035' });
    expect(field(r.state, 0)).toEqual(['BT14-035', 'BT14-035', 'BT14-035']);
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
    const end = toEnd(r);
    expect(field(end.state, 0)).toEqual(['BT14-035']);
    expect(defs(end.state, end.state.players[0].hand)).toEqual(['BT14-035', 'BT14-035']);
    const s = scene({
      attacker: { circles: { vanguard: 'BT14-014', back_center: MUR_G1 } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(
      boosts(
        drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')))),
        vg,
        2000,
      ),
    ).toBe(1);
  });

  it('BT14-015 Covert Demonic Dragon, Hyakki Vogue "Яeverse": [CB2] placed on (VC): call a copy until the end of turn; [LB4] lock two: up to three Hyakki Vogue "Яeverse" +10000', () => {
    const { r } = ride('BT14-015', MUR_G2, { damage: vanilla(2) });
    expect(field(r.state, 0)).toEqual(['BT14-015', 'BT14-015']);
    expect(toEnd(r).state.players[0].hand).toHaveLength(1);
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'BT14-015',
          front_left: 'BT14-015',
          back_left: MUR_G1,
          back_right: MUR_G1,
        },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const both = [unitAt(s, 0, 'vanguard'), unitAt(s, 0, 'front_left')];
    const locks = [unitAt(s, 0, 'back_left'), unitAt(s, 0, 'back_right')];
    const a = drain(answer(apply(s, activate(both[0]!)), ...locks), 0, both);
    expect(both.map((id) => boosts(a, id, 10000))).toEqual([1, 1]);
    expect(a.state.cards[unitAt(s, 0, 'back_left')]!.locked).toBe(true);
  });

  it('BT14-016 Silver Snow, Sasame: calls every Murakumo of the top five to (GC)', () => {
    expect(sentinelCallCount('BT14-016', MUR_G2, MUR_G1, KAG_G1)).toBe(4);
  });

  it('BT14-035 Truth Seeking Stealth Rogue, Amakusa: [LB4] +5000; (RC) +2000 with a Murakumo vanguard', () => {
    expect(attackPumps('BT14-035', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT14-035', 2000, { on: 'front_left', vanguard: MUR_G2 })).toBe(1);
  });

  it('BT14-036 Demonic Hair Stealth Rogue, Grenjin: [CB1] boosted by a Murakumo, hits a vanguard: call another Grenjin until the end of turn', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: MUR_G2, front_left: 'BT14-036', back_left: MUR_G1 },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const r = resolve(
      apply(
        s,
        attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
      ),
    );
    expect(field(r.state, 0).filter((d) => d === 'BT14-036')).toHaveLength(2);
    const end = toEnd(r);
    expect(field(end.state, 0).filter((d) => d === 'BT14-036')).toHaveLength(1);
    expect(end.state.cards[end.state.players[0].deck.at(-1)!]!.definitionId).toBe('BT14-036');
  });

  it('BT14-037 Bangasa Stealth Rogue, Sukerock / BT14-090 Masago Stealth Rogue, Goemon: [SB1] move to an open (RC), keeping its state', () => {
    for (const [card, id] of [
      ['BT14-037', '1'],
      ['BT14-090', '2'],
    ] as const) {
      const { r, unit } = actOn(card, MUR_G2, { soul: 1, id, rested: true });
      expect(r.state.players[0].circles.front_left).toHaveLength(0);
      expect(Object.values(r.state.players[0].circles).flat()).toContain(unit);
      expect(r.state.cards[unit]!.orientation).toBe('rest');
    }
  });

  it('BT14-089 Stealth Beast, Deathly Dagger: boosts a Murakumo with a same-named unit: +3000', () => {
    const s = scene({
      attacker: { circles: { vanguard: MUR_G2, back_center: 'BT14-089', front_left: MUR_G2 } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
    expect(boosts(r, vg, 3000)).toBe(1);
  });
});

describe('Neo Nectar: Musketeers and Maidens', () => {
  it('BT14-018 Maiden of Venus Trap "Яeverse": [LB4] lock a Neo Nectar: call one of the top five +5000; [CB1] +2000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT14-018', front_left: NN_G2 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    topAs(s, NN_G1, 5);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg)));
    expect(pumps(r, 5000)).toBe(1);
    expect(field(r.state, 0)).toHaveLength(3);
    expect(boosts(drain(then(r, activate(vg, '2'))), vg, 2000)).toBe(1);
  });

  it('BT14-019 Deep Green Lord, Master Wisteria: [LB4][CB1] a Neo Nectar rides it: copies of your rear-guards, the vanguard +10000; +2000 boosted by a Neo Nectar', () => {
    const { r } = ride('BT14-018', 'BT14-019', {
      damage: vanilla(4),
      others: { front_left: NN_G2 },
    });
    expect(field(r.state, 0).filter((d) => d === NN_G2)).toHaveLength(2);
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(21000);
    const s = scene({
      attacker: { circles: { vanguard: 'BT14-019', back_center: NN_G1 } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(
      boosts(
        drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')))),
        vg,
        2000,
      ),
    ).toBe(1);
  });

  it('BT14-020 Red Rose Musketeer, Antonio: discard a Neo Nectar: the attacked Neo Nectar cannot be hit', () => {
    const r = guardWith('BT14-020', NN_G2, vanilla(2), [NN_G1, OPP_G1]);
    expect(r.state.restrictions.some((x) => x.restriction === 'cannot_be_hit')).toBe(true);
  });

  it('BT14-041 Maiden of Cherry Bloom / BT14-042 Maiden of Cherry Stone: on a hit, call the other at [Rest]', () => {
    const bloom = scene({
      attacker: { circles: { vanguard: NN_G2, front_left: 'BT14-041' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['BT14-042'], []],
    });
    fillSoul(bloom, 0, 1);
    const b = resolve(
      apply(bloom, attack(unitAt(bloom, 0, 'front_left'), unitAt(bloom, 1, 'vanguard'))),
    );
    expect(field(b.state, 0)).toContain('BT14-042');

    const stone = scene({
      attacker: { circles: { vanguard: NN_G2, front_left: NN_G2, back_left: 'BT14-042' } },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['BT14-041'], []],
    });
    const st = resolve(
      apply(
        stone,
        attack(
          unitAt(stone, 0, 'front_left'),
          unitAt(stone, 1, 'vanguard'),
          unitAt(stone, 0, 'back_left'),
        ),
      ),
    );
    expect(field(st.state, 0)).toContain('BT14-041');
    expect(field(st.state, 0)).not.toContain('BT14-042');
  });

  it('BT14-098 Jack in Pumpkin: [CB1 Neo Nectar] attacks: +4000', () => {
    const s = scene({
      attacker: { circles: { vanguard: NN_G2, front_left: 'BT14-098' }, damage: [NN_G1] },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const unit = unitAt(s, 0, 'front_left');
    expect(boosts(drain(apply(s, attack(unit, unitAt(s, 1, 'vanguard')))), unit, 4000)).toBe(1);
  });

  it('BT14-099 Lotus Druid: placed on (RC): another Neo Nectar +2000', () => {
    const { s, r } = callIt('BT14-099', { vanguard: NN_G2 });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 2000)).toBe(1);
  });

  it('BT14-100 Maiden of Physalis: [into the soul] the boosted attack hits: call a grade 1 Neo Nectar of the top five at [Rest]', () => {
    const s = scene({
      attacker: { circles: { vanguard: NN_G2, back_center: 'BT14-100' } },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    topAs(s, NN_G1, 6);
    const r = resolve(
      apply(
        s,
        attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
      ),
    );
    const called = Object.values(r.state.players[0].circles)
      .flat()
      .filter((id) => r.state.cards[id]!.definitionId === NN_G1);
    expect(called).toHaveLength(1);
    expect(r.state.cards[called[0]!]!.orientation).toBe('rest');
  });

  it('BT14-102 Blue Rose Musketeer, Ernst: [CB1, to the deck bottom] call a Musketeer of the top four', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: NN_G2, front_left: 'BT14-102' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    topAs(s, 'BT14-040', 4);
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(field(r.state, 0)).toContain('BT14-040');
    expect(field(r.state, 0)).not.toContain('BT14-102');
  });
});
