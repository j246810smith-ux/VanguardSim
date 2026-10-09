/** BT09 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/engine';
import { apply, andThen as then, find, scene, vanilla, type Run } from '../fixtures/bt01';
import {
  activate,
  attack,
  boosts,
  drain,
  field,
  inHand,
  legal,
  passGuard,
} from '../fixtures/cardTest';
import {
  actPower,
  attackPumps,
  attackWith,
  callIt,
  fillSoul,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const MK_G2 = 'BT05-029';
const MK_G1 = 'BT05-055';
const AQF_G3 = 'BT08-086'; // Titan of the Pyroxene Mine
const AQF_G2 = 'BT08-036';
const AQF_G1 = 'BT08-090';
const OTT_G2 = 'BT01-026';
const OTT_G1 = 'BT01-054';
const NG_G2 = 'BT01-030';
const NG_G1 = 'BT01-060';
const ANF_G2 = 'BT06-024';
const ANF_G1 = 'BT06-047';
const GP_G2 = 'TD08-004';
const GP_G1 = 'TD08-009';
const NK_G2 = 'BT06-037';
const NK_G1 = 'BT06-091';
const PM_G2 = 'BT03-027';
const PM_G1 = 'BT03-050';
const GN_G2 = 'BT02-040';
const GN_G1 = 'BT02-079';

const defs = (s: GameState, ids: readonly string[]) => ids.map((id) => s.cards[id]!.definitionId);
const hand = (r: Run) => r.state.players[0].hand.length;
const deckTo = (s: GameState, def: string, zone: 'drop' | 'soul' | 'damage') => {
  const pl = s.players[0];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl[zone].push(id);
  s.cards[id]!.faceUp = true;
  return id;
};
const onTop = (s: GameState, def: string) => {
  const pl = s.players[0];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl.deck.unshift(id);
  return id;
};
const attackFrom = (
  s: GameState,
  from: 'vanguard' | 'front_left' | 'front_right',
  booster?: 'back_left' | 'back_center' | 'back_right',
) =>
  apply(
    s,
    attack(unitAt(s, 0, from), unitAt(s, 1, 'vanguard'), booster ? unitAt(s, 0, booster) : null),
  );
const toEnd = (r: Run, prefer: readonly string[] = []): Run => {
  for (let i = 0; i < 2 && r.state.phase !== 'end' && r.state.activePlayer === 0; i++)
    r = drain(then(r, { type: 'END_PHASE', player: 0 }), 0, prefer);
  return drain(r, 0, prefer);
};
const toBattle = (r: Run): Run => drain(then(r, { type: 'END_PHASE', player: 0 }));
const attackers = (s: GameState) => (legal(s, 0, 'ATTACK')?.options ?? []).map((o) => o.attacker);
const boostersOf = (s: GameState, attacker: string) =>
  (legal(s, 0, 'ATTACK')?.options.find((o) => o.attacker === attacker)?.boosters ?? []).map(
    (b) => b.id,
  );

describe('Murakumo: copies until end of turn', () => {
  it('BT09-001 Covert Demonic Dragon, Magatsu Storm: [LB4][CB2] +3000, call two copies; they leave at the end of turn', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT09-001' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const copies = s.players[0].deck.filter((id) => s.cards[id]!.definitionId === 'BT09-001');
    let r = drain(apply(s, activate(vg)), 0, copies);
    expect(pw(r.state, vg)).toBe(13000);
    expect(field(r.state, 0).filter((d) => d === 'BT09-001')).toHaveLength(3);
    r = toEnd(r);
    expect(field(r.state, 0)).toEqual(['BT09-001']);
    expect(r.state.players[0].deck.slice(-2).every((id) => copies.includes(id))).toBe(true);
  });

  it('BT09-021 Magatsu Gale / BT09-048 Magatsu Breath: ridden with the line in soul: two copies until end of turn', () => {
    const run = (card: string, vanguard: string, soul: string, copy: string) => {
      const s = scene({
        at: 'ride',
        attacker: { circles: { vanguard }, hand: [card] },
        defender: { circles: { vanguard: OPP } },
        extra: [[soul, copy], []],
      });
      toSoul(s, soul);
      const copies = s.players[0].deck.filter((id) => s.cards[id]!.definitionId === copy);
      const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) }), 0, copies);
      return field(r.state, 0).filter((d) => d === copy).length;
    };
    expect(run('BT09-001', 'BT09-021', 'BT09-048', 'BT09-001')).toBe(3);
    expect(run('BT09-021', 'BT09-048', 'BT09-023', 'BT09-021')).toBe(3);
  });

  it('BT09-023 Stealth Dragon, Magatsu Wind: ridden by Breath: take Storm or Gale; Forerunner', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT09-023' }, hand: ['BT09-048'], deckTop: ['BT09-001'] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT09-048') }));
    expect(defs(r.state, r.state.players[0].hand)).toContain('BT09-001');
    expect(field(rideIt(MK_G1, { vanguard: 'BT09-023' }).r.state, 0)).toContain('BT09-023');
  });

  it('BT09-010 Platinum Blond Fox Spirit, Tamamo / BT09-022 Oboro Cart: copy a rear-guard until end of turn', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT09-010', front_left: MK_G2 }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    let r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(field(r.state, 0).filter((d) => d === MK_G2)).toHaveLength(2);
    r = toEnd(r);
    expect(field(r.state, 0).filter((d) => d === MK_G2)).toHaveLength(1);
    const cart = callIt('BT09-022', {
      vanguard: 'BT09-010',
      others: { front_right: MK_G1 },
      damage: 1,
    });
    expect(field(cart.r.state, 0).filter((d) => d === MK_G1)).toHaveLength(2);
    expect(attackPumps('BT09-010', 5000, { damage: 4 })).toBe(1);
  });

  it('BT09-009 Fantasy Petal Storm, Shirayuki: [LB4] attacked: [CB1 & discard a Shirayuki] the attacker -20000', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: {
        circles: { vanguard: 'BT09-009' },
        hand: ['BT09-009'],
        damage: vanilla(4),
      },
    });
    const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), 1);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), -20000)).toBe(1);
  });

  it('BT09-044 Stealth Beast, Gigantoad: +3000 on (VC) / +1000 on (RC) with another Gigantoad on (RC)', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT09-044', front_left: 'BT09-044', front_right: 'BT09-044' },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(13000);
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(11000);
  });

  it('BT09-047 Stealth Rogue of Summoning, Jiraiya: [CB1 & to the deck bottom] call a Gigantoad', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: MK_G2, front_left: 'BT09-047' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT09-044'], []],
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(field(r.state, 0)).toContain('BT09-044');
    expect(field(r.state, 0)).not.toContain('BT09-047');
  });

  it('BT09-045 Stealth Dragon, Royale Nova: -5000 without Storm or Gale on (VC); +2000 attacking', () => {
    const s = scene({
      attacker: { circles: { vanguard: MK_G2, front_left: 'BT09-045' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(5000);
    expect(attackPumps('BT09-045', 2000, { on: 'front_left', vanguard: 'BT09-021' })).toBe(1);
  });
});

describe('Aqua Force', () => {
  it('BT09-002 Blue Storm Supreme Dragon, Glory Maelstrom: [LB5][CB1] +5000 and no grade 1+ guards from hand', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT09-002' }, damage: vanilla(5), deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1, 'BT08-083'] },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(attackFrom(s, 'vanguard'));
    expect(boosts(r, vg, 5000)).toBe(1);
    const guards = legal(r.state, 1, 'GUARD')?.cardIds ?? [];
    expect(defs(r.state, guards)).toEqual(['BT08-083']); // the grade 0 only
  });

  it.each(['BT09-024', 'BT09-025', 'BT09-027'])(
    '%s Storm Rider: [CB1] at the end of the battle it attacked a vanguard: exchange with the unit behind',
    (card) => {
      const s = scene({
        attacker: {
          circles: { vanguard: AQF_G3, front_left: card, back_left: AQF_G1 },
          damage: vanilla(1),
        },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      const rider = unitAt(s, 0, 'front_left');
      const r = drain(passGuard(attackFrom(s, 'front_left')));
      expect(r.state.players[0].circles.back_left).toEqual([rider]);
    },
  );

  it('BT09-026 Battle Siren, Theresa / BT09-028 Tri-holl Dracokid: third battle', () => {
    const s = scene({
      attacker: { circles: { vanguard: AQF_G3, front_left: 'BT09-026', front_right: 'BT09-028' } },
      defender: { circles: { vanguard: OPP } },
    });
    s.turnFlags.battles = 2;
    expect(boosts(attackFrom(s, 'front_left'), unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
    expect(boosts(attackFrom(s, 'front_right'), unitAt(s, 0, 'front_right'), 3000)).toBe(1);
    s.turnFlags.battles = 1;
    expect(boosts(attackFrom(s, 'front_left'), unitAt(s, 0, 'vanguard'), 3000)).toBe(0);
    expect(field(rideIt(AQF_G1, { vanguard: 'BT09-028' }).r.state, 0)).toContain('BT09-028');
  });

  it('BT09-011 Tri-stinger Dragon: [LB4] third battle: two damage face up; [CB2] a rear-guard +3000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT09-011', front_left: AQF_G2 },
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    for (const id of s.players[0].damage.slice(0, 2)) s.cards[id]!.faceUp = false;
    s.turnFlags.battles = 2;
    const r = drain(attackFrom(s, 'vanguard'), 0, s.players[0].damage);
    expect(r.state.players[0].damage.every((id) => r.state.cards[id]!.faceUp)).toBe(true);
    const m = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT09-011', front_left: AQF_G2 }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(
        drain(apply(m, activate(unitAt(m, 0, 'vanguard'), '2'))).state,
        unitAt(m, 0, 'front_left'),
      ),
    ).toBe(13000);
  });

  it('BT09-058 Deck Sweeper: [SB1] boosting a Maelstrom: +6000', () => {
    expect(attackPumps('BT08-005', 6000, { booster: 'BT09-058', soul: 1 })).toBe(1);
  });

  it('BT09-059 Light Signals Penguin Soldier: [SB2] placed: draw', () => {
    const { r } = callIt('BT09-059', { vanguard: AQF_G3, soul: 2 });
    expect(hand(r)).toBe(1);
  });

  it('BT09-060 Officer Cadet, Astraea: Forerunner; [CB1 & soul] the boosted attack hits: stand a rear-guard', () => {
    expect(field(rideIt(AQF_G1, { vanguard: 'BT09-060' }).r.state, 0)).toContain('BT09-060');
    const s = scene({
      attacker: {
        circles: {
          vanguard: AQF_G3,
          front_left: AQF_G2,
          back_left: 'BT09-060',
          front_right: AQF_G1,
        },
        rested: ['front_right'],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')), 0, [
      unitAt(s, 0, 'front_right'),
    ]);
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.orientation).toBe('stand');
  });

  it('BT09-062 Supersonic Sailor: [soul] a damage face up', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: AQF_G3, front_left: 'BT09-062' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const d = s.players[0].damage[0]!;
    s.cards[d]!.faceUp = false;
    expect(drain(apply(s, activate(unitAt(s, 0, 'front_left')))).state.cards[d]!.faceUp).toBe(true);
  });
});

describe('Oracle Think Tank', () => {
  it('BT09-003 Goddess of the Sun, Amaterasu: [LB4][CB2] hits a vanguard: search an Oracle Think Tank; Lord', () => {
    const { r } = attackWith('BT09-003', { damage: 4, oppVanguard: OPP_G1, oppHand: [] });
    expect(hand(r)).toBe(3); // two drive checks + the search
    expect(field(callIt(OTT_G1, { vanguard: 'BT09-003', soul: 0 }).r.state, 0)).toHaveLength(2);
  });

  it('BT09-012 Battle Sister, Cookie: [CB2] placed on (VC): draw two, discard one; [LB4] +5000', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: OTT_G2 }, hand: ['BT09-012'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT09-012') }));
    expect(hand(r)).toBe(1);
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(attackPumps('BT09-012', 5000, { damage: 4 })).toBe(1);
  });

  it('BT09-029 Battle Deity, Susanoo / BT09-030 Battle Maiden, Sayorihime: +3000 with an Amaterasu vanguard', () => {
    expect(attackPumps('BT09-029', 3000, { on: 'front_left', vanguard: 'BT09-003' })).toBe(1);
    expect(attackPumps('BT09-030', 3000, { on: 'front_left', vanguard: 'BT09-003' })).toBe(1);
    expect(attackPumps('BT09-030', 3000, { on: 'front_left', vanguard: OTT_G2 })).toBe(0);
  });

  it.each(['BT09-063', 'BT09-067'])(
    '%s: [SB1 & discard] attacking a vanguard: another +3000',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: OTT_G2, front_left: card }, hand: [OTT_G1] },
        defender: { circles: { vanguard: OPP } },
      });
      fillSoul(s, 0, 1);
      expect(boosts(drain(attackFrom(s, 'front_left')), unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
    },
  );

  it('BT09-065 Rock Witch, GaGa: attacking with no soul: draw, then a card to the deck bottom', () => {
    const s = scene({
      attacker: { circles: { vanguard: OTT_G2, front_left: 'BT09-065' } },
      defender: { circles: { vanguard: OPP } },
    });
    s.players[0].deck.push(...s.players[0].soul.splice(0));
    const before = s.players[0].deck.length;
    const r = drain(attackFrom(s, 'front_left'));
    expect(hand(r)).toBe(0);
    expect(r.state.players[0].deck).toHaveLength(before);
  });

  it('BT09-066 Battle Sister, Cream: [SB1] boosting Cookie: +5000', () => {
    expect(attackPumps('BT09-012', 5000, { booster: 'BT09-066', soul: 1 })).toBe(1);
  });

  it('BT09-068 Solar Maiden, Uzume: [CB1 & retire two] search Amaterasu', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: OTT_G2, front_left: 'BT09-068', front_right: OTT_G1 },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT09-003'], []],
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(defs(r.state, r.state.players[0].hand)).toEqual(['BT09-003']);
  });

  it('BT09-064 Oracle Guardian, Sphinx: [CB2] +4000', () => {
    expect(actPower('BT09-064', { vanguard: OTT_G2, damage: 2 })).toBe(12000);
  });

  it('BT09-069 Supple Bamboo Princess, Kaguya: Forerunner; [soul] +3000', () => {
    expect(field(rideIt(OTT_G1, { vanguard: 'BT09-069' }).r.state, 0)).toContain('BT09-069');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OTT_G2, front_left: 'BT09-069' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(s, activate(unitAt(s, 0, 'front_left')))).state, unitAt(s, 0, 'vanguard')),
    ).toBe(13000);
  });
});

describe('Nova Grappler', () => {
  it('BT09-004 Ultra Beast Deity, Illuminal Dragon: [LB4][CB3] stands two Beast Deities; BT09-031/033 +3000 when they stand', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT09-004', front_left: 'BT09-033', front_right: 'BT09-031' },
        rested: ['front_left', 'front_right'],
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(attackFrom(s, 'vanguard'), 0, [
      unitAt(s, 0, 'front_left'),
      unitAt(s, 0, 'front_right'),
    ]);
    for (const c of ['front_left', 'front_right'] as const) {
      expect(r.state.cards[unitAt(s, 0, c)]!.orientation).toBe('stand');
      expect(boosts(r, unitAt(s, 0, c), 3000)).toBe(1);
    }
  });

  it('BT09-034 Beast Deity, Blank Marsh: [CB1 & soul] the boosted attack hits: stand a Beast Deity', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: NG_G2,
          front_left: NG_G2,
          back_left: 'BT09-034',
          front_right: 'BT09-033',
        },
        rested: ['front_right'],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')));
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.orientation).toBe('stand');
  });

  it('BT09-032 Hollow Nomad: +2000 attacking a vanguard', () => {
    expect(attackPumps('BT09-032', 2000, { on: 'front_left', vanguard: NG_G2 })).toBe(1);
  });

  it.each([
    ['BT09-071', NG_G2, NG_G1],
    ['BT09-077', ANF_G2, ANF_G1],
    ['BT09-087', GN_G2, GN_G1],
  ] as const)(
    '%s: placed: reveal the top card; a grade 1 or 2 of the clan is called',
    (card, vanguard, g1) => {
      const { r } = callIt(card, { vanguard, hand: [g1], before: (s) => void onTop(s, g1) });
      expect(field(r.state, 0)).toContain(g1);
    },
  );

  it('BT09-075 Lionet Heat: Forerunner; [soul] +3000', () => {
    expect(field(rideIt(NG_G1, { vanguard: 'BT09-075' }).r.state, 0)).toContain('BT09-075');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: NG_G2, front_left: 'BT09-075' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(s, activate(unitAt(s, 0, 'front_left')))).state, unitAt(s, 0, 'vanguard')),
    ).toBe(13000);
  });
});

describe('Angel Feather', () => {
  it('BT09-005 Crimson Impact, Metatron: [LB4][CB1 & two rear-guards into damage] call two from damage; +3000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT09-005', front_left: ANF_G2, front_right: ANF_G1 },
        damage: [ANF_G2, ANF_G1, ...vanilla(2)],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(r.state.players[0].damage).toHaveLength(4);
    expect(field(r.state, 0)).toHaveLength(3);
    expect(legal(r.state, 0, 'ACTIVATE')?.options.some((o) => o.abilityId === '1')).toBeFalsy();
    expect(attackPumps('BT09-005', 3000)).toBe(1);
  });

  it.each(['BT09-076', 'BT09-078', 'BT09-083'])(
    '%s: [ACT] from the damage zone, turned face down: Angel Feather vanguard +3000',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: ANF_G2 }, damage: [card] },
        defender: { circles: { vanguard: OPP } },
      });
      const d = s.players[0].damage[0]!;
      const r = drain(apply(s, activate(d)));
      expect(r.state.cards[d]!.faceUp).toBe(false);
      expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(13000);
      expect(legal(r.state, 0, 'ACTIVATE')?.options.some((o) => o.source === d)).toBeFalsy();
    },
  );

  it('BT09-081 Crimson Heart, Nahas: [soul itself and Baruch] with Aphrodite on (VC): ride Metatron from the deck', () => {
    expect(field(rideIt(ANF_G1, { vanguard: 'BT09-081' }).r.state, 0)).toContain('BT09-081');
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT09-076', front_left: 'BT09-081', back_left: 'BT09-078' },
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT09-005'], []],
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(defs(r.state, r.state.players[0].circles.vanguard)).toEqual(['BT09-005']);
    expect(r.state.players[0].soul).toHaveLength(s.players[0].soul.length + 3);
  });

  it('BT09-035 Mobile Hospital, Elysium: [discard an Angel Feather] +6000 on (VC) / +3000 on (RC)', () => {
    expect(attackPumps('BT09-035', 6000, { hand: [ANF_G1] })).toBe(1);
    expect(
      attackPumps('BT09-035', 3000, { on: 'front_left', vanguard: ANF_G2, hand: [ANF_G1] }),
    ).toBe(1);
  });

  it.each([
    ['BT09-079', ANF_G2],
    ['BT09-090', GN_G2],
  ] as const)('%s: [CB1] placed on (GC): +5000 shield', (card, vanguard) => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard }, hand: [card], damage: vanilla(1) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, card) }), 1);
    expect(
      find(r.events, 'MODIFIER_ADDED').some(
        (e) => e.modifier.stat === 'shield' && e.modifier.amount === 5000,
      ),
    ).toBe(true);
  });

  it('BT09-080 Candlelight Angel: [discard] the boosted attack hits: draw', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: ANF_G2, front_left: ANF_G2, back_left: 'BT09-080' },
        hand: [ANF_G1],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')));
    expect(hand(r)).toBe(1);
    expect(r.state.players[0].drop).toHaveLength(1);
  });
});

describe('Gold Paladin and the Spirits', () => {
  it('BT09-019 Blaster Blade Spirit: also a Gold Paladin (no Lord penalty); called from the deck: [CB1] retire a grade 2+', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT09-006', front_left: 'BT09-096' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: OPP, front_right: OPP_G1 } },
      extra: [['BT09-019'], []],
    });
    onTop(s, 'BT09-019');
    // Runebau looks at the top card and calls a Gold Paladin: the Spirit qualifies
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(field(r.state, 0)).toContain('BT09-019');
    expect(defs(r.state, r.state.players[1].drop)).toEqual([OPP]);
    // Lord: Platina Ezel can still attack beside it
    expect(attackers(toBattle(r).state)).toContain(unitAt(s, 0, 'vanguard'));
  });

  it('BT09-020 Blaster Dark Spirit: called from the deck: retire a grade 2 or less; retired after being attacked', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GP_G2, front_left: 'BT09-096' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
      extra: [['BT09-020'], []],
    });
    onTop(s, 'BT09-020');
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(defs(r.state, r.state.players[1].drop)).toEqual([OPP_G1]);
    // attacked and guarded: still retired at the end of that battle
    const d = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: GP_G2, front_left: 'BT09-020' }, hand: [GP_G1] },
    });
    const spirit = unitAt(d, 1, 'front_left');
    let b = apply(d, attack(unitAt(d, 0, 'vanguard'), spirit));
    b = drain(then(b, { type: 'GUARD', player: 1, cardId: inHand(b.state, 1, GP_G1) }), 1);
    b = drain(passGuard(b), 1);
    expect(b.state.players[1].drop).toContain(spirit);
  });

  it('BT09-006 Blazing Lion, Platina Ezel: [LB5][CB3] up to five rear-guards +5000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT09-006', front_left: GP_G2, front_right: GP_G1 },
        damage: vanilla(5),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))), 0, [
      unitAt(s, 0, 'front_left'),
      unitAt(s, 0, 'front_right'),
    ]);
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(15000);
    expect(pw(r.state, unitAt(s, 0, 'front_right'))).toBe(13000);
  });

  it('BT09-007 Conviction Dragon, Chromejailer Dragon: [LB4] +10000/+1; [CB1 & discard a copy] call two from the top four', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT09-007', front_left: GP_G2, front_right: GP_G1 },
        damage: vanilla(4),
        hand: ['BT09-007'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg, '1')));
    expect(pw(r.state, vg)).toBe(20000);
    const look = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT09-007' },
        damage: vanilla(1),
        hand: ['BT09-007'],
        deckTop: [GP_G2, GP_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const top2 = look.players[0].deck.slice(0, 2);
    const l = drain(apply(look, activate(unitAt(look, 0, 'vanguard'), '2')), 0, top2);
    expect(field(l.state, 0)).toHaveLength(3);
  });

  it('BT09-036 Knight of Passion, Bagdemagus: +3000 with an Ezel vanguard', () => {
    expect(attackPumps('BT09-036', 3000, { on: 'front_left', vanguard: 'BT09-006' })).toBe(1);
  });

  it('BT09-037 Advance of the Black Chains, Kahedin: [CB1 & retire another] the boosted hit: call the top Gold Paladin rested', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: GP_G2, front_left: GP_G2, back_left: 'BT09-037', front_right: GP_G1 },
        damage: vanilla(1),
        deckTop: [GP_G1],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const retired = unitAt(s, 0, 'front_right');
    const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')), 0, [retired]);
    expect(r.state.players[0].drop).toEqual([retired]);
    const top = s.players[0].deck[0]!;
    expect(field(r.state, 0)).toContain(GP_G1);
    expect(r.state.cards[top]!.orientation).toBe('rest');
  });

  it('BT09-038 Dreaming Sage, Corron: Forerunner; [CB1 & soul] take an Ezel from the top five', () => {
    expect(field(rideIt(GP_G1, { vanguard: 'BT09-038' }).r.state, 0)).toContain('BT09-038');
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: GP_G2, front_left: 'BT09-038' },
        damage: vanilla(1),
        deckTop: ['BT09-006'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(defs(r.state, r.state.players[0].hand)).toContain('BT09-006');
  });

  it.each([
    ['BT09-093', 'BT09-006'],
    ['BT09-089', 'BT09-013'],
  ] as const)('%s: placed: another grade 3 +3000', (card, vanguard) => {
    const { s, r } = callIt(card, { vanguard });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
  });

  it('BT09-094 Stronghold of the Black Chains, Hoel: Forerunner; [soul] +3000', () => {
    expect(field(rideIt(GP_G1, { vanguard: 'BT09-094' }).r.state, 0)).toContain('BT09-094');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GP_G2, front_left: 'BT09-094' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(s, activate(unitAt(s, 0, 'front_left')))).state, unitAt(s, 0, 'vanguard')),
    ).toBe(13000);
  });
});

describe('Narukami', () => {
  it('BT09-008 Dragonic Kaiser Vermillion "THE BLOOD": [LB5][CB3] +5000/+1 and battles the whole front row', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT09-008' }, damage: vanilla(5), deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = toBattle(drain(apply(s, activate(vg))));
    expect(pw(r.state, vg)).toBe(16000);
    const b = then(r, attack(vg, unitAt(s, 1, 'vanguard')));
    expect(b.state.battle?.extraTargets).toHaveLength(2);
  });

  it('BT09-015 Lord of the Demonic Winds, Vayu: [CB1] +10000 for each Vayu on (RC)', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT09-015', front_left: 'BT09-015', front_right: 'BT09-015' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boosts(drain(attackFrom(s, 'vanguard')), unitAt(s, 0, 'vanguard'), 20000)).toBe(1);
  });

  it('BT09-039 Dusty Plasma Dragon: +3000 with a Vermillion vanguard', () => {
    expect(attackPumps('BT09-039', 3000, { on: 'front_left', vanguard: 'BT09-008' })).toBe(1);
  });

  it('BT09-040 Exorcist Demonic Dragon, Indigo: cannot boost grade 2 or less; +3000 boosting a Narukami', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: 'BT09-008',
          front_left: NK_G2,
          back_left: 'BT09-040',
          back_center: 'BT09-040',
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boostersOf(s, unitAt(s, 0, 'front_left'))).toEqual([]);
    expect(boostersOf(s, unitAt(s, 0, 'vanguard'))).toEqual([unitAt(s, 0, 'back_center')]);
    expect(boosts(attackFrom(s, 'vanguard', 'back_center'), unitAt(s, 0, 'vanguard'), 3000)).toBe(
      1,
    );
  });

  it('BT09-098 Deity Sealing Kid, Soh Koh: Forerunner; Restraint; cannot boost a rear-guard', () => {
    expect(field(rideIt(NK_G1, { vanguard: 'BT09-098' }).r.state, 0)).toContain('BT09-098');
    const s = scene({
      attacker: {
        circles: {
          vanguard: NK_G2,
          front_left: NK_G2,
          back_left: 'BT09-098',
          back_center: 'BT09-098',
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boostersOf(s, unitAt(s, 0, 'front_left'))).toEqual([]);
    expect(boostersOf(s, unitAt(s, 0, 'vanguard'))).toEqual([unitAt(s, 0, 'back_center')]);
  });

  it.each(['BT09-097', 'BT09-100'])(
    '%s: placed: a Narukami loses a [CONT] until end of turn',
    (card) => {
      const { s, r } = callIt(card, { vanguard: NK_G2, others: { front_right: 'BT08-098' } });
      expect(pw(r.state, unitAt(s, 0, 'front_right'))).toBe(8000); // Lightning Sword loses its -4000
    },
  );
});

describe('Pale Moon', () => {
  it('BT09-017 Starlight Melody Tamer, Farah: [LB4][CB1 & discard a copy] [Soul-Charge 2], call from soul +3000; Lord', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT09-017' }, damage: vanilla(4), hand: ['BT09-017'] },
      defender: { circles: { vanguard: OPP } },
      extra: [[PM_G2], []],
    });
    const soulCard = deckTo(s, PM_G2, 'soul');
    const soul = s.players[0].soul.length;
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))), 0, [soulCard]);
    expect(r.state.players[0].soul).toHaveLength(soul + 2 - 1); // Soul-Charge 2, one called
    expect(pw(r.state, soulCard)).toBe(13000);
  });

  it('BT09-018 Nightmare Summoner, Raqiel: [CB2] placed on (VC): call from soul; [LB4] +5000; BT09-101 boosts it +5000', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: PM_G2 }, hand: ['BT09-018'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT09-018') }));
    expect(field(r.state, 0)).toEqual(['BT09-018', PM_G2]);
    expect(attackPumps('BT09-018', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT09-018', 5000, { booster: 'BT09-101', soul: 1 })).toBe(1);
  });

  it('BT09-041 Barking Wyvern: [discard a Pale Moon] +6000 on (VC)', () => {
    expect(attackPumps('BT09-041', 6000, { hand: [PM_G1] })).toBe(1);
  });

  it('BT09-042 Fire Juggler: boosted vanguard drive-checks a grade 3 Pale Moon: at the end of battle, soul it and call from soul', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT09-041', back_center: 'BT09-042' },
        deckTop: ['BT09-018', 'BT09-018'],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [[PM_G2], []],
    });
    deckTo(s, PM_G2, 'soul');
    const juggler = unitAt(s, 0, 'back_center');
    const r = drain(passGuard(attackFrom(s, 'vanguard', 'back_center')));
    expect(r.state.players[0].soul).toContain(juggler);
    expect(field(r.state, 0)).toContain(PM_G2);
  });

  it('BT09-102 Smiling Presenter: Forerunner; [CB1 & soul] a Pale Moon from the top ten into the soul', () => {
    expect(field(rideIt(PM_G1, { vanguard: 'BT09-102' }).r.state, 0)).toContain('BT09-102');
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: PM_G2, front_left: 'BT09-102' },
        damage: vanilla(1),
        deckTop: [PM_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = s.players[0].soul.length;
    expect(
      drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2'))).state.players[0].soul,
    ).toHaveLength(soul + 2);
  });
});

describe('Great Nature', () => {
  it('BT09-013 Battler of the Twin Brush, Polaris: [LB4][CB2] stand a rear-guard +4000, retired at the end of turn; +3000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT09-013', front_left: GN_G2 },
        rested: ['front_left'],
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const rg = unitAt(s, 0, 'front_left');
    let r = drain(attackFrom(s, 'vanguard'));
    expect(r.state.cards[rg]!.orientation).toBe('stand');
    expect(pw(r.state, rg)).toBe(14000);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
    r = toEnd(drain(passGuard(r)));
    expect(r.state.players[0].drop).toContain(rg);
  });

  it('BT09-084 → BT09-085 → BT09-088: retired in the end phase: [CB1] call the next of the band', () => {
    for (const [card, next] of [
      ['BT09-084', 'BT09-085'],
      ['BT09-085', 'BT09-088'],
      ['BT09-088', 'BT09-084'],
    ] as const) {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: 'BT08-041', front_left: card }, damage: vanilla(1) },
        defender: { circles: { vanguard: OPP } },
        extra: [[next], []],
      });
      // Compass Lion on (VC) retires a rear-guard at the beginning of the end phase
      const r = toEnd({ state: s, events: [] }, [unitAt(s, 0, 'front_left')]);
      expect(field(r.state, 0)).toContain(next);
    }
  });

  it('BT09-091 Gardening Mole: Forerunner; [CB1 & soul] a Great Nature rear-guard retired in the end phase returns to hand', () => {
    expect(field(rideIt(GN_G1, { vanguard: 'BT09-091' }).r.state, 0)).toContain('BT09-091');
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT08-041', front_left: GN_G2, back_left: 'BT09-091' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const rg = unitAt(s, 0, 'front_left');
    const r = toEnd({ state: s, events: [] }, [rg]);
    expect(r.state.players[0].hand).toContain(rg);
  });

  it('BT09-086 Parabolic Moose: [CB2] +4000; BT09-092 Castanet Donkey: [soul] +3000', () => {
    expect(actPower('BT09-086', { vanguard: GN_G2, damage: 2 })).toBe(12000);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GN_G2, front_left: 'BT09-092' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(s, activate(unitAt(s, 0, 'front_left')))).state, unitAt(s, 0, 'vanguard')),
    ).toBe(13000);
  });
});

describe('shared shapes', () => {
  it('Forerunner and look-five grade 0s: BT09-051, BT09-074', () => {
    for (const [card, rider, vanguard, g3] of [
      ['BT09-051', MK_G1, MK_G2, 'BT09-001'],
      ['BT09-074', NG_G1, NG_G2, 'BT09-004'],
    ] as const) {
      expect(field(rideIt(rider, { vanguard: card }).r.state, 0)).toContain(card);
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard, front_left: card }, damage: vanilla(1), deckTop: [g3] },
        defender: { circles: { vanguard: OPP } },
      });
      const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
      expect(defs(r.state, r.state.players[0].hand)).toContain(g3);
    }
  });

  it.each([
    ['BT09-046', MK_G2],
    ['BT09-070', NG_G2],
    ['BT09-073', NG_G2],
  ] as const)('%s: [CB1] a damage now, returned at the end of turn', (card, vanguard) => {
    const { r } = callIt(card, { vanguard, damage: 1 });
    expect(r.state.players[0].damage).toHaveLength(2);
    expect(toEnd(r).state.players[0].damage).toHaveLength(1);
  });

  it('[CB1] +1000: BT09-049, BT09-072', () => {
    expect(actPower('BT09-049', { vanguard: MK_G2 })).toBe(8000);
    expect(actPower('BT09-072', { vanguard: NG_G2 })).toBe(8000);
  });

  it('BT09-043 Spiked Club Stealth Rogue, Arahabaki: +2000 boosted by a Murakumo; BT09-050 Flame Fox boosts Tamamo +5000', () => {
    expect(attackPumps('BT09-043', 2000, { booster: MK_G1 })).toBe(1);
    expect(attackPumps('BT09-010', 5000, { booster: 'BT09-050', soul: 1 })).toBe(1);
  });

  it('BT09-057 Stealth Beast, Cat Devil: [soul] +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: MK_G2, front_left: 'BT09-057' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(s, activate(unitAt(s, 0, 'front_left')))).state, unitAt(s, 0, 'vanguard')),
    ).toBe(13000);
  });
});
