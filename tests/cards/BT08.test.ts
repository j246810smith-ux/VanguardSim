/** BT08 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import {
  apply,
  andThen as then,
  answer,
  ctx,
  find,
  scene,
  vanilla,
  type Run,
} from '../fixtures/bt01';
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

const DP_G3 = 'BT08-022'; // Lady Justice
const DP_G2 = 'BT04-027'; // vanilla
const DP_G1 = 'BT03-079'; // vanilla
const NN_G2 = 'BT05-024'; // vanilla
const NN_G1 = 'BT05-044'; // vanilla
const AF_G3 = 'BT08-086'; // Titan of the Pyroxene Mine
const AF_G2 = 'BT08-036'; // Tear Knight, Lazarus (vanilla)
const AF_G1 = 'BT08-090'; // Tear Knight, Theo (vanilla)
const NK_G2 = 'BT06-037'; // vanilla
const NK_G1 = 'BT06-091'; // vanilla
const TK_G3 = 'BT08-073'; // Savage War Chief
const TK_G2 = 'BT03-033'; // vanilla
const TK_G1 = 'BT01-066'; // vanilla
const GN_G2 = 'BT02-040'; // vanilla
const GN_G1 = 'BT02-079'; // vanilla
const FIVE_K = 'BT08-083'; // Carry Trilobite, grade 0, 5000

const defs = (s: GameState, ids: readonly string[]) => ids.map((id) => s.cards[id]!.definitionId);
const hand = (r: Run) => r.state.players[0].hand.length;
/** Move one `def` from player 0's deck into a zone. */
const deckTo = (s: GameState, def: string, zone: 'bind' | 'drop' | 'soul') => {
  const pl = s.players[0];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl[zone].push(id);
  s.cards[id]!.faceUp = true;
  return id;
};
/** Put one `def` from player 0's deck on top of it. */
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
/** Player 0 rides `card` from hand onto `vanguard`, with `soul` cards put into the soul first. */
const rideWithSoul = (
  card: string,
  vanguard: string,
  soul: readonly string[],
  deckTop: readonly string[] = [],
) => {
  const s = scene({
    at: 'ride',
    attacker: { circles: { vanguard }, hand: [card], deckTop },
    defender: { circles: { vanguard: OPP } },
    extra: [soul, []],
  });
  for (const d of soul) toSoul(s, d);
  return { s, r: drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) })) };
};

describe('Aqua Force: battle counts', () => {
  it.each(['BT08-007', 'BT08-035', 'BT08-037'])(
    '%s Storm Rider: first battle +2000, then it exchanges with the rear-guard behind it',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: AF_G3, front_left: card, back_left: AF_G1 } },
        defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      });
      const rider = unitAt(s, 0, 'front_left');
      const behind = unitAt(s, 0, 'back_left');
      const r = drain(passGuard(attackFrom(s, 'front_left')));
      expect(boosts(r, rider, 2000)).toBe(1);
      expect(r.state.players[0].circles.back_left).toEqual([rider]);
      expect(r.state.players[0].circles.front_left).toEqual([behind]);
      // "the state of the card does not change"
      expect(r.state.cards[rider]!.orientation).toBe('rest');
      expect(r.state.cards[behind]!.orientation).toBe('stand');
    },
  );

  it('BT08-007 Storm Rider, Basil: not the first battle: no bonus, no exchange', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: AF_G3, front_left: 'BT08-007', back_left: AF_G1 },
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(4) },
    });
    const rider = unitAt(s, 0, 'front_left');
    let r = drain(passGuard(attackFrom(s, 'vanguard')));
    r = drain(passGuard(then(r, attack(rider, unitAt(s, 1, 'vanguard')))));
    expect(boosts(r, rider, 2000)).toBe(0);
    expect(r.state.players[0].circles.front_left).toEqual([rider]);
  });

  it('BT08-018 Tear Knight, Valeria: hits a vanguard in the fourth battle: retire a rear-guard', () => {
    const run = (battlesBefore: number) => {
      const s = scene({
        attacker: { circles: { vanguard: AF_G3, front_left: 'BT08-018' } },
        defender: { circles: { vanguard: OPP_G1, front_left: OPP }, deckTop: vanilla(2) },
      });
      s.turnFlags.battles = battlesBefore;
      return drain(passGuard(attackFrom(s, 'front_left'))).state.players[1].drop.length;
    };
    expect(run(3)).toBe(1);
    expect(run(2)).toBe(0);
  });

  it('BT08-038 Torpedo Rush Dragon: boosting in the fourth battle: +3000', () => {
    const s = scene({
      attacker: { circles: { vanguard: AF_G3, front_left: AF_G2, back_left: 'BT08-038' } },
      defender: { circles: { vanguard: OPP } },
    });
    s.turnFlags.battles = 3;
    const r = attackFrom(s, 'front_left', 'back_left');
    expect(boosts(r, unitAt(s, 0, 'front_left'), 3000)).toBe(1);
  });

  it('BT08-005 Blue Storm Dragon, Maelstrom: [LB4] fourth battle +5000; [CB1] hits: draw and retire', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT08-005' }, damage: vanilla(4), deckTop: vanilla(3) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 }, deckTop: vanilla(2) },
    });
    s.turnFlags.battles = 3;
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(passGuard(attackFrom(s, 'vanguard')));
    expect(boosts(r, vg, 5000)).toBe(1);
    expect(r.state.players[1].drop).toHaveLength(1);
    expect(hand(r)).toBe(3); // two drive checks and a draw
    // purity: -2000 with a non-Aqua Force unit
    const mixed = scene({
      attacker: { circles: { vanguard: 'BT08-005', front_left: TK_G1 } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(mixed, unitAt(mixed, 0, 'vanguard'))).toBe(9000);
  });

  it('BT08-006 Hydro Hurricane Dragon: +3000 attacking; [LB4][CB2] hits in the fourth battle: retire every rear-guard', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT08-006' }, damage: vanilla(4), deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, back_left: OPP },
        deckTop: vanilla(2),
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = toBattle(drain(apply(s, activate(vg))));
    expect(pw(r.state, vg)).toBe(13000);
    r.state.turnFlags.battles = 3;
    r = drain(passGuard(then(r, attack(vg, unitAt(s, 1, 'vanguard')))));
    expect(boosts(r, vg, 3000)).toBe(2);
    expect(r.state.players[1].drop).toHaveLength(2);
  });

  it('BT08-039 Aqua Breath Dracokid: Forerunner; [ACT] soul: +1000 and draw on a fourth-battle hit', () => {
    expect(field(rideIt(AF_G1, { vanguard: 'BT08-039' }).r.state, 0)).toContain('BT08-039');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: AF_G3, front_left: 'BT08-039' } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(r.state, vg)).toBe(11000);
    expect(r.state.grants.some((g) => g.target === vg)).toBe(true);
  });

  it('BT08-019 Emerald Shield, Paschal: perfect guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: AF_G3 }, hand: ['BT08-019', AF_G1] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT08-019') }), 1);
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
  });
});

describe('Narukami', () => {
  it('BT08-008 Sealed Demon Dragon, Dungaree: binds two on (VC); [LB4][ACT] returns one to retire a front rear-guard', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: NK_G2 }, hand: ['BT08-008'], damage: vanilla(4) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    let r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT08-008') }));
    const vg = unitAt(r.state, 0, 'vanguard');
    const bound = r.state.players[0].bind;
    expect(bound).toHaveLength(2);
    expect(bound.every((id) => r.state.cards[id]!.boundBy === vg)).toBe(true);
    expect(pw(r.state, vg)).toBe(11000);
    r = drain(then(drain(then(r, { type: 'END_PHASE', player: 0 })), activate(vg)));
    expect(r.state.players[1].drop).toHaveLength(1);
    expect(r.state.players[0].bind).toHaveLength(1);
    expect(r.state.cards[bound[0]!]!.boundBy).toBeUndefined(); // back in the deck
    expect(legal(r.state, 0, 'ACTIVATE')?.options.some((o) => o.source === vg)).toBeFalsy();
  });

  it('BT08-008 Dungaree: -2000 with no cards bound by its own effect', () => {
    const s = scene({
      attacker: { circles: { vanguard: NK_G2, front_left: 'BT08-008' } },
      defender: { circles: { vanguard: OPP } },
      extra: [[NK_G1], []],
    });
    deckTo(s, NK_G1, 'bind'); // bound, but not by this card
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(9000);
  });

  it('BT08-040 Thunder Spear Wielding Exorcist Knight: Restraint until [CB1] removes it; +2000 attacking', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: NK_G2, front_left: 'BT08-040' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const spear = unitAt(s, 0, 'front_left');
    expect(attackers(toBattle({ state: s, events: [] }).state)).not.toContain(spear);
    const r = toBattle(drain(apply(s, activate(spear, '2'))));
    expect(attackers(r.state)).toContain(spear);
    expect(boosts(then(r, attack(spear, unitAt(s, 1, 'vanguard'))), spear, 2000)).toBe(1);
  });

  it('BT08-098 Lightning Sword Wielding Exorcist Knight: -4000 on (RC); +2000 attacking', () => {
    const s = scene({
      attacker: { circles: { vanguard: NK_G2, front_left: 'BT08-098' } },
      defender: { circles: { vanguard: OPP } },
    });
    const unit = unitAt(s, 0, 'front_left');
    expect(pw(s, unit)).toBe(4000);
    expect(boosts(attackFrom(s, 'front_left'), unit, 2000)).toBe(1);
  });

  it('BT08-100 Exorcist Mage, Koh Koh: Forerunner; [SB1] a chosen [CONT] is lost until end of turn', () => {
    expect(field(rideIt(NK_G1, { vanguard: 'BT08-100' }).r.state, 0)).toContain('BT08-100');
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: NK_G2,
          front_left: 'BT08-098',
          front_right: 'BT08-040',
          back_left: 'BT08-100',
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 1);
    const sword = unitAt(s, 0, 'front_left');
    const spear = unitAt(s, 0, 'front_right');
    let r = apply(s, activate(unitAt(s, 0, 'back_left'), '2'));
    r = answer(r, r.state.pendingChoice!.options[0]!); // [Soul-Blast 1]
    const c = r.state.pendingChoice!;
    expect(c.kind).toBe('ability');
    expect(c.options).toEqual([`${sword}/1`, `${spear}/restraint`]);
    // the sword loses its -4000
    expect(pw(answer(r, `${sword}/1`).state, sword)).toBe(8000);
    // or the spear loses Restraint and can attack
    expect(attackers(toBattle(answer(r, `${spear}/restraint`)).state)).toContain(spear);
  });

  it('BT08-096 Black Celestial Maiden, Kali: +3000 on (VC) / +1000 on (RC) with more rear-guards than the opponent', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT08-096', front_left: 'BT08-096', back_left: NK_G1 },
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    expect(boosts(attackFrom(s, 'vanguard'), unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
    expect(boosts(attackFrom(s, 'front_left'), unitAt(s, 0, 'front_left'), 1000)).toBe(1);
    const even = scene({
      attacker: { circles: { vanguard: 'BT08-096', front_left: NK_G1 }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    expect(boosts(attackFrom(even, 'vanguard'), unitAt(even, 0, 'vanguard'), 3000)).toBe(0);
  });
});

describe('Tachikaze: retire for value', () => {
  it('BT08-016 Raptor Colonel: [LB4][CB1] retires BT08-076 and BT08-033: + their original power; they trigger', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: 'BT08-016',
          front_left: 'BT08-076',
          back_left: 'BT08-033',
          front_right: 'BT08-032',
        },
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(4) },
      extra: [['BT08-074'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const paid = [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'back_left')];
    let r = drain(attackFrom(s, 'vanguard'), 0, paid);
    expect(boosts(r, vg, 7000 + 7000)).toBe(1); // Brachiocarrier 7000 + Beamptero 7000
    expect(r.state.turnFlags.droppedFromRC).toEqual(expect.arrayContaining(paid));
    // Beamptero: +3000 to a Tachikaze; Brachiocarrier: [CB1] calls Brachiocastle
    expect(find(r.events, 'MODIFIER_ADDED').some((e) => e.modifier.amount === 3000)).toBe(true);
    expect(field(r.state, 0)).toContain('BT08-074');
    // Pachyphalos: a Tachikaze went to the drop zone from (RC) this turn: +3000
    r = drain(passGuard(r));
    const pachy = unitAt(s, 0, 'front_right');
    expect(boosts(then(r, attack(pachy, unitAt(s, 1, 'vanguard'))), pachy, 3000)).toBe(1);
  });

  it('BT08-032 Assault Dragon, Pachyphalos: nothing dropped from (RC) this turn: no bonus', () => {
    expect(attackPumps('BT08-032', 3000, { on: 'front_left', vanguard: TK_G3 })).toBe(0);
  });

  it.each([
    ['BT08-074', 'BT08-080'],
    ['BT08-080', 'BT08-076'],
  ] as const)(
    '%s: [CB1] put into the drop zone from (RC): call %s from the deck',
    (card, named) => {
      const s = scene({
        attacker: {
          circles: { vanguard: 'BT08-016', front_left: card, back_left: TK_G1 },
          damage: vanilla(4),
          deckTop: vanilla(2),
        },
        defender: { circles: { vanguard: OPP } },
        extra: [[named], []],
      });
      const r = drain(attackFrom(s, 'vanguard'), 0, [
        unitAt(s, 0, 'front_left'),
        unitAt(s, 0, 'back_left'),
      ]);
      expect(field(r.state, 0)).toContain(named);
    },
  );

  it('BT08-031 Winged Dragon, Slashptero: put into the drop zone in the battle phase: a Tachikaze +3000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT08-016', front_left: 'BT08-031', back_left: TK_G1 },
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(attackFrom(s, 'vanguard'), 0, [
      unitAt(s, 0, 'front_left'),
      unitAt(s, 0, 'back_left'),
    ]);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
  });

  it('BT08-017 Destruction Dragon, Dark Rex: [LB4] from the bind zone after a miss: retire three, ride it', () => {
    const run = (guard: boolean) => {
      const s = scene({
        attacker: {
          circles: { vanguard: TK_G3, front_left: TK_G2, back_left: TK_G1, front_right: TK_G2 },
          damage: vanilla(4),
          deckTop: vanilla(2),
        },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
        extra: [['BT08-017'], []],
      });
      const rex = deckTo(s, 'BT08-017', 'bind');
      let r = attackFrom(s, 'vanguard');
      if (guard) r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, OPP_G1) });
      r = drain(passGuard(r));
      return { r, rex };
    };
    const missed = run(true);
    expect(unitAt(missed.r.state, 0, 'vanguard')).toBe(missed.rex);
    expect(missed.r.state.players[0].drop).toHaveLength(3);
    const hit = run(false);
    expect(hit.r.state.players[0].bind).toContain(hit.rex);
  });

  it('BT08-017 Dark Rex: [ACT] from hand: bind it, a Tachikaze +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: TK_G3 }, hand: ['BT08-017'] },
      defender: { circles: { vanguard: OPP } },
    });
    const rex = inHand(s, 0, 'BT08-017');
    const r = drain(apply(s, activate(rex, '2')));
    expect(r.state.players[0].bind).toEqual([rex]);
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(13000);
  });

  it('BT08-030 Raptor Captain / BT08-077 Raptor Sergeant / BT08-034 Raptor Soldier: the Raptor chain', () => {
    // ridden by Colonel with Sergeant in soul: call a Captain
    expect(field(rideWithSoul('BT08-016', 'BT08-030', ['BT08-077']).r.state, 0)).toEqual([
      'BT08-016',
      'BT08-030',
    ]);
    // ridden by Captain with Soldier in soul: call a Sergeant
    expect(field(rideWithSoul('BT08-030', 'BT08-077', ['BT08-034']).r.state, 0)).toEqual([
      'BT08-030',
      'BT08-077',
    ]);
    // Soldier ridden by Sergeant: look at seven, take Colonel or Captain
    const { r } = rideWithSoul('BT08-077', 'BT08-034', [], ['BT08-016']);
    expect(defs(r.state, r.state.players[0].hand)).toContain('BT08-016');
    // other Tachikaze: Forerunner
    expect(field(rideIt(TK_G1, { vanguard: 'BT08-034' }).r.state, 0)).toContain('BT08-034');
  });

  it('soul bonuses of the named lines', () => {
    const bonus = (card: string, soul: string) => {
      const s = scene({
        attacker: { circles: { vanguard: card } },
        defender: { circles: { vanguard: OPP } },
        extra: [[soul], []],
      });
      const base = pw(s, unitAt(s, 0, 'vanguard'));
      toSoul(s, soul);
      return pw(s, unitAt(s, 0, 'vanguard')) - base;
    };
    expect(bonus('BT08-016', 'BT08-030')).toBe(1000);
    expect(bonus('BT08-030', 'BT08-077')).toBe(1000);
    expect(bonus('BT08-077', 'BT08-034')).toBe(1000);
    expect(bonus('BT08-002', 'BT08-024')).toBe(1000);
    expect(bonus('BT08-024', 'BT08-047')).toBe(1000);
    expect(bonus('BT08-047', 'BT08-027')).toBe(1000);
    expect(bonus('BT08-003', 'BT08-028')).toBe(1000);
    expect(bonus('BT08-028', 'BT08-064')).toBe(1000);
    expect(bonus('BT08-064', 'BT08-029')).toBe(1000);
    expect(bonus('BT08-001', 'BT03-020')).toBe(2000);
  });
});

describe('Dimension Police', () => {
  it('BT08-001 Ultimate Dimensional Robo, Great Daiyusha: [LB4] three Dimensional Robo in soul: +2000/+1 critical', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT08-001' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT03-020'], []],
    });
    for (let i = 0; i < 3; i++) toSoul(s, 'BT03-020');
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(11000 + 2000 + 2000);
    expect(currentCritical(s, ctx, vg)).toBe(2);
  });

  it('BT08-002 Galactic Beast, Zeal: [LB4][CB2] opposing vanguard -1000 per Dimension Police rear-guard, once a turn', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT08-002', front_left: DP_G2, back_left: DP_G1 },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg)));
    expect(pw(r.state, unitAt(s, 1, 'vanguard'))).toBe(8000);
    expect(legal(r.state, 0, 'ACTIVATE')?.options.some((o) => o.source === vg)).toBeFalsy();
  });

  it('BT08-021 Enigman Cyclone: 14000 or more at the attack step: hits retire a rear-guard', () => {
    const run = (booster: boolean) => {
      const s = scene({
        attacker: { circles: { vanguard: 'BT08-021', back_center: DP_G1 }, deckTop: vanilla(2) },
        defender: { circles: { vanguard: OPP_G1, front_left: OPP }, deckTop: vanilla(2) },
      });
      return drain(passGuard(attackFrom(s, 'vanguard', booster ? 'back_center' : undefined))).state
        .players[1].drop.length;
    };
    expect(run(true)).toBe(1);
    expect(run(false)).toBe(0);
  });

  it('BT08-023 Subterranean Beast, Magma Lord: [CB5 & SB8] vanguard -5000, retire rear-guards of 5000 or less', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT08-023' }, damage: vanilla(5) },
      defender: { circles: { vanguard: OPP, front_left: FIVE_K, front_right: OPP_G1 } },
    });
    fillSoul(s, 0, 8);
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(pw(r.state, unitAt(s, 1, 'vanguard'))).toBe(5000);
    expect(defs(r.state, r.state.players[1].drop)).toEqual([FIVE_K]);
  });

  it('BT08-024 Devourer of Planets, Zeal / BT08-047 Eye of Destruction, Zeal: ridden with the line in soul: vanguard -3000', () => {
    const oppVG = (r: Run) => pw(r.state, unitAt(r.state, 1, 'vanguard'));
    expect(oppVG(rideWithSoul('BT08-002', 'BT08-024', ['BT08-047']).r)).toBe(7000);
    expect(oppVG(rideWithSoul('BT08-024', 'BT08-047', ['BT08-027']).r)).toBe(7000);
    expect(oppVG(rideWithSoul('BT08-024', 'BT08-047', []).r)).toBe(10000);
  });

  it('BT08-027 Larva Beast, Zeal: ridden by Eye: take a Zeal from the top seven; Forerunner', () => {
    const { r } = rideWithSoul('BT08-047', 'BT08-027', [], ['BT08-002']);
    expect(defs(r.state, r.state.players[0].hand)).toContain('BT08-002');
    expect(field(rideIt(DP_G1, { vanguard: 'BT08-027' }).r.state, 0)).toContain('BT08-027');
  });

  it('BT08-025 Dimensional Robo, Dailander: [CB1] placed: a Dimensional Robo +4000', () => {
    const { s, r } = callIt('BT08-025', { vanguard: 'BT03-020', damage: 1 });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 4000)).toBe(1);
  });

  it('BT08-046 Assault Monster, Gunrock / BT08-050 Psychic Grey: battle opponent 8000 or less', () => {
    expect(
      attackPumps('BT08-046', 3000, { on: 'front_left', vanguard: DP_G2, oppVanguard: OPP_G1 }),
    ).toBe(1);
    expect(attackPumps('BT08-046', 3000, { on: 'front_left', vanguard: DP_G2 })).toBe(0);
    expect(attackPumps(DP_G2, 4000, { booster: 'BT08-050', oppVanguard: OPP_G1 })).toBe(1);
    expect(attackPumps(DP_G2, 4000, { booster: 'BT08-050' })).toBe(0);
  });

  it('BT08-022 Lady Justice: +2000 attacking a vanguard', () => {
    expect(attackPumps(DP_G3, 2000)).toBe(1);
  });
});

describe('Neo Nectar', () => {
  it('BT08-003 Arboros Dragon, Sephirot: [LB4] units sharing a name +3000 during your turn', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT08-003', front_left: NN_G2, front_right: NN_G2, back_left: NN_G1 },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(13000);
    expect(pw(s, unitAt(s, 0, 'front_right'))).toBe(13000);
    expect(pw(s, unitAt(s, 0, 'back_left'))).toBe(8000);
    s.players[0].damage.pop();
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(10000);
  });

  it('BT08-004 White Lily Musketeer, Cecilia: [ACT] retire a Musketeer: call one from the top five', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT08-004', front_left: 'BT08-011' } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT08-014'], []],
    });
    onTop(s, 'BT08-014');
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(defs(r.state, r.state.players[0].drop)).toEqual(['BT08-011']);
    expect(field(r.state, 0)).toContain('BT08-014');
  });

  it('BT08-004 Cecilia: [LB4][CB1 & five normal Musketeers from drop to deck] call two Cecilias', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT08-004' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT08-011', 'BT08-014', 'BT08-015'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const canUse = () =>
      legal(s, 0, 'ACTIVATE')?.options.some((o) => o.source === vg && o.abilityId === '1') ?? false;
    for (const d of ['BT08-011', 'BT08-011', 'BT08-014', 'BT08-014']) deckTo(s, d, 'drop');
    expect(canUse()).toBe(false);
    deckTo(s, 'BT08-015', 'drop');
    expect(canUse()).toBe(true);
    const cecilias = s.players[0].deck.filter((id) => s.cards[id]!.definitionId === 'BT08-004');
    const r = drain(apply(s, activate(vg, '1')), 0, cecilias);
    expect(field(r.state, 0).filter((d) => d === 'BT08-004')).toHaveLength(3);
    expect(r.state.players[0].drop).toHaveLength(0);
  });

  it.each(['BT08-012', 'BT08-015'])(
    '%s: [CB1 & retire another Musketeer] placed: call a Musketeer from the top four',
    (card) => {
      const { s, r } = callIt(card, {
        vanguard: NN_G2,
        others: { front_right: 'BT08-011' },
        damage: 1,
        before: (st) => void onTop(st, 'BT08-011'),
      });
      const retired = unitAt(s, 0, 'front_right');
      expect(r.state.players[0].drop).toEqual([retired]);
      expect(field(r.state, 0).filter((d) => d === 'BT08-011')).toHaveLength(1);
    },
  );

  it('BT08-011 / BT08-014: +3000 attacking with a Musketeer vanguard', () => {
    expect(attackPumps('BT08-011', 3000, { on: 'front_left', vanguard: 'BT08-058' })).toBe(1);
    expect(attackPumps('BT08-014', 3000, { on: 'front_left', vanguard: 'BT08-058' })).toBe(1);
    expect(attackPumps('BT08-014', 3000, { on: 'front_left', vanguard: NN_G2 })).toBe(0);
  });

  it('BT08-028 Arboros Dragon, Timber / BT08-064 Branch: ridden with the line in soul: call a copy of a rear-guard', () => {
    const run = (card: string, vanguard: string, soul: string) => {
      const s = scene({
        at: 'ride',
        attacker: { circles: { vanguard, front_left: NN_G1 }, hand: [card] },
        defender: { circles: { vanguard: OPP } },
        extra: [[soul], []],
      });
      toSoul(s, soul);
      const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) }));
      return field(r.state, 0).filter((d) => d === NN_G1).length;
    };
    expect(run('BT08-003', 'BT08-028', 'BT08-064')).toBe(2);
    expect(run('BT08-028', 'BT08-064', 'BT08-029')).toBe(2);
  });

  it('BT08-029 Arboros Dragon, Ratoon: ridden by Branch: take Sephirot or Timber; Forerunner', () => {
    const { r } = rideWithSoul('BT08-064', 'BT08-029', [], ['BT08-003']);
    expect(defs(r.state, r.state.players[0].hand)).toContain('BT08-003');
    expect(field(rideIt(NN_G1, { vanguard: 'BT08-029' }).r.state, 0)).toContain('BT08-029');
  });

  it('BT08-067 Fruits Basket Elf: [CB1] no guarding from hand, and the hit deals no damage', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: NN_G2, back_center: 'BT08-067' },
        damage: vanilla(1),
        deckTop: vanilla(2),
      },
      defender: {
        circles: { vanguard: OPP_G1, front_left: AF_G2 },
        hand: [OPP_G1],
        deckTop: vanilla(2),
      },
    });
    let r = drain(attackFrom(s, 'vanguard', 'back_center'));
    expect(legal(r.state, 1, 'GUARD')).toBeUndefined();
    expect(legal(r.state, 1, 'INTERCEPT')).toBeDefined(); // intercepting is not a normal call
    r = drain(passGuard(r));
    expect(find(r.events, 'ATTACK_HIT')).toHaveLength(1);
    expect(r.state.players[1].damage).toHaveLength(0);
    // the ban was for that battle only
    const elf = unitAt(s, 0, 'back_center');
    expect(r.state.grants.filter((g) => g.target === elf)).toHaveLength(0);
  });
});

describe('Great Nature', () => {
  it('BT08-020 Armed Instructor, Bison: [CB2] +4000 then retired; [LB4] that turns two damage face up', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT08-020', front_left: GN_G2 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    let r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(14000);
    const faceUp = (x: Run) =>
      x.state.players[0].damage.filter((id) => x.state.cards[id]!.faceUp).length;
    expect(faceUp(r)).toBe(2);
    r = toEnd(r, r.state.players[0].damage); // "up to two": turn both
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(faceUp(r)).toBe(4);
  });

  it('BT08-042 Coiling Duckbill + BT08-041 Compass Lion: the marked rear-guard is retired at the end phase: draw', () => {
    const { s, r } = callIt('BT08-042', { vanguard: 'BT08-041', others: { front_right: GN_G2 } });
    const marked = unitAt(s, 0, 'front_right');
    expect(r.state.grants.some((g) => g.target === marked)).toBe(true);
    const before = hand(r);
    const end = toEnd(r, [marked]);
    expect(end.state.players[0].drop).toContain(marked);
    expect(hand(end)).toBe(before + 1);
  });

  it('BT08-102 Blackboard Parrot: Forerunner; [ACT] soul: a rear-guard gains the end-phase draw', () => {
    expect(field(rideIt(GN_G1, { vanguard: 'BT08-102' }).r.state, 0)).toContain('BT08-102');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GN_G2, front_left: 'BT08-102', front_right: GN_G2 } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(r.state.grants.some((g) => g.target === unitAt(s, 0, 'front_right'))).toBe(true);
  });
});

describe('shared shapes', () => {
  it.each([
    ['BT08-009', DP_G3],
    ['BT08-013', NN_G2],
  ] as const)('%s: [CB2] hits: draw', (card, vanguard) => {
    const r = attackWith(card, {
      on: 'front_left',
      vanguard,
      damage: 2,
      oppVanguard: OPP_G1,
      oppHand: [],
    }).r;
    expect(hand(r)).toBe(1);
  });

  it.each([
    ['BT08-059', NN_G2],
    ['BT08-087', AF_G2],
  ] as const)('%s: [discard] hits: draw', (card, vanguard) => {
    const r = attackWith(card, {
      on: 'front_left',
      vanguard,
      hand: [NN_G1],
      oppVanguard: OPP_G1,
      oppHand: [],
    }).r;
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(hand(r)).toBe(1);
  });

  it.each([
    ['BT08-043', DP_G1],
    ['BT08-058', NN_G1],
    ['BT08-073', TK_G1],
    ['BT08-086', AF_G1],
  ] as const)('%s: +2000 boosted by its clan', (card, booster) => {
    expect(attackPumps(card, 2000, { booster })).toBe(1);
  });

  it.each([
    ['BT08-045', DP_G3],
    ['BT08-051', DP_G3],
  ] as const)('%s: placed: another Dimension Police +2000', (card, vanguard) => {
    const { s, r } = callIt(card, { vanguard });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 2000)).toBe(1);
  });

  it.each([
    ['BT08-044', DP_G3],
    ['BT08-052', DP_G3],
    ['BT08-062', NN_G2],
    ['BT08-065', NN_G2],
    ['BT08-075', TK_G3],
    ['BT08-078', TK_G3],
    ['BT08-088', AF_G3],
    ['BT08-092', AF_G3],
    ['BT08-097', NK_G2],
    ['BT08-099', NK_G2],
  ] as const)('%s: [CB1] a damage now, returned to the deck at the end phase', (card, vanguard) => {
    const { r } = callIt(card, { vanguard, damage: 1 });
    expect(r.state.players[0].damage).toHaveLength(2);
    expect(toEnd(r).state.players[0].damage).toHaveLength(1);
  });

  it.each([
    ['BT08-049', DP_G2, DP_G3],
    ['BT08-066', NN_G2, NN_G2],
    ['BT08-091', AF_G2, AF_G3],
  ] as const)(
    '%s: the boosted attack hits a vanguard: return this unit to hand',
    (card, front, vanguard) => {
      const s = scene({
        attacker: { circles: { vanguard, front_left: front, back_left: card } },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      const booster = unitAt(s, 0, 'back_left');
      const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')));
      expect(r.state.players[0].hand).toContain(booster);
    },
  );

  it('BT08-079 Fortress Ammonite: [discard] the boosted attack hits: draw', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: TK_G3, front_left: TK_G2, back_left: 'BT08-079' },
        hand: [TK_G1],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')));
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(hand(r)).toBe(1);
  });

  it.each([
    ['BT08-063', NN_G2, [NN_G2, NN_G1, 'BT08-058', 'BT08-014']],
    ['BT08-089', AF_G3, [AF_G2, AF_G1, 'BT08-086', 'BT08-038']],
  ] as const)('%s: hits a vanguard with four other rear-guards: draw', (card, vanguard, o) => {
    const s = scene({
      attacker: {
        circles: {
          vanguard,
          front_left: card,
          front_right: o[0],
          back_left: o[1],
          back_center: o[2],
          back_right: o[3],
        },
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    expect(hand(drain(passGuard(attackFrom(s, 'front_left', 'back_left'))))).toBe(1);
  });

  it('BT08-060 Exploding Tomato / BT08-061 World Bearing Turtle, Ahkbara: hits a vanguard: a Neo Nectar +3000', () => {
    for (const [card, on] of [
      ['BT08-060', 'vanguard'],
      ['BT08-061', 'front_left'],
    ] as const) {
      const { r } = attackWith(card, { on, vanguard: NN_G2, oppVanguard: OPP_G1, oppHand: [] });
      expect(find(r.events, 'MODIFIER_ADDED').some((e) => e.modifier.amount === 3000)).toBe(true);
    }
  });

  it.each([
    ['BT08-053', DP_G1, DP_G3, 'BT08-001'],
    ['BT08-068', NN_G1, NN_G2, 'BT08-058'],
    ['BT08-081', TK_G1, TK_G3, 'BT08-016'],
    ['BT08-093', AF_G1, AF_G3, 'BT08-005'],
  ] as const)(
    '%s: Forerunner; [CB1 & soul] take a grade 3 from the top five',
    (card, rider, vanguard, g3) => {
      expect(field(rideIt(rider, { vanguard: card }).r.state, 0)).toContain(card);
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard, front_left: card }, damage: vanilla(1), deckTop: [g3] },
        defender: { circles: { vanguard: OPP } },
      });
      const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
      expect(defs(r.state, r.state.players[0].hand)).toContain(g3);
    },
  );
});
