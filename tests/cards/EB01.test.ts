/** EB01 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, currentShield, type GameState } from '../../src/engine';
import { andThen as then, answer, apply, ctx, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand, legal } from '../fixtures/cardTest';
import { faceDown, onField, pull, settle } from '../fixtures/setHelpers';
import {
  attackPumps,
  callIt,
  fillSoul,
  OPP,
  OPP_G1,
  OPP_G3,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const BATTLERAIZER = 'BT01-032';
const NG_G1 = 'BT01-060'; // Tough Boy, vanilla Nova Grappler
const OTT_G2 = 'BT01-026'; // Oracle Guardian, Wiseman
const MURAKUMO_G2 = 'BT05-029'; // Stealth Beast, Bloody Mist
const MEGA_G2 = 'BT01-040'; // Bloody Hercules
const KAGERO_G1 = 'BT01-048'; // Embodiment of Armor, Bahr
const PM_G2 = 'BT12-040'; // Silver Thorn Marionette, Lilian
const CHIMERA = 'BT03-027'; // Barking Cerberus (Pale Moon Chimera)
const SPIKE_G2 = 'BT02-022'; // Treasured, Black Panther
const GIRL = 'BT07-074'; // Girl Who Crossed the Gap: [ACT] calls a Pale Moon from the soul

const attackOptionsOf = (s: GameState, unit: string) => {
  const a = legal(s, 0, 'ATTACK');
  return a?.options.find((o) => o.attacker === unit);
};

describe('EB01 Nova Grappler', () => {
  it('EB01-001 Perfect Raizer: -2000 alone; +3000 per Raizer in the soul and critical +1 with four; placed on (VC), Raizer rear-guards go to the soul', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB01-001' } },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB01-017', 'EB01-017', 'EB01-017', 'EB01-017'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(9000);
    const raizers = s.players[0].deck.filter((x) => s.cards[x]!.definitionId === 'EB01-017');
    for (const id of raizers.slice(0, 4)) {
      s.players[0].deck.splice(s.players[0].deck.indexOf(id), 1);
      s.players[0].soul.push(id);
    }
    // four Raizers in the soul: +12000, critical +1 (still alone: -2000)
    expect(pw(s, vg)).toBe(9000 + 12000);
    expect(currentCritical(s, ctx, vg)).toBe(2);
    const { r } = rideIt('EB01-001', {
      vanguard: 'EB01-003',
      others: { front_left: 'EB01-017', back_left: NG_G1 },
    });
    expect(r.state.players[0].circles.front_left).toHaveLength(0);
    expect(r.state.players[0].circles.back_left).toHaveLength(1);
  });

  it.each([
    ['EB01-003', 8000],
    ['EB01-017', 6000],
  ] as const)(
    '%s Raizer Custom: +%i during your turn with Battleraizer behind it',
    (card, bonus) => {
      const run = (behind: string) => {
        const s = scene({
          attacker: { circles: { vanguard: NG_G1, front_left: card, back_left: behind } },
          defender: { circles: { vanguard: OPP } },
        });
        return pw(s, unitAt(s, 0, 'front_left')) - ctx.registry.get(card).power;
      };
      expect(run(BATTLERAIZER)).toBe(bonus);
      expect(run(NG_G1)).toBe(0);
    },
  );

  it('EB01-008 Miss Splendor: when it attacks, the opponent cannot intercept', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB01-008' } },
      defender: { circles: { vanguard: OPP, front_left: OPP }, hand: [OPP_G1] },
    });
    const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(legal(r.state, 1, 'GUARD')).toBeDefined();
    expect(legal(r.state, 1, 'INTERCEPT')).toBeUndefined();
  });

  it('EB01-009 Rocket Hammer Man: [Rest] another Nova Grappler gets +2000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB01-003', back_left: 'EB01-009' } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))));
    expect(boosts(r, vg, 2000)).toBe(1);
    expect(r.state.cards[unitAt(s, 0, 'back_left')]!.orientation).toBe('rest');
  });

  it('EB01-016 Boomerang Thrower: riding a Nova Grappler, it may attack the back row', () => {
    const { s, r } = rideIt('EB01-016', { vanguard: NG_G1, oppField: { back_left: OPP_G1 } });
    let b = then(r, { type: 'END_PHASE', player: 0 });
    b = then(b, { type: 'END_PHASE', player: 0 });
    const option = attackOptionsOf(b.state, unitAt(b.state, 0, 'vanguard'));
    expect(option?.targets.some((t) => t.id === unitAt(s, 1, 'back_left'))).toBe(true);
  });

  it('EB01-019 Cat Butler: [retire it] when your grade 2 or less vanguard misses, it stands', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB01-003', back_left: 'EB01-019' } },
      defender: { circles: { vanguard: OPP_G3 }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = settle(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(r.state.players[0].drop).toContain(unitAt(s, 0, 'back_left'));
  });
});

describe('EB01 Murakumo', () => {
  it('EB01-002 ZANBAKU: -2000 with a non-Murakumo unit; the opponent must discard or cannot normal ride', () => {
    const run = (discard: boolean) => {
      const s = scene({
        attacker: { circles: { vanguard: 'EB01-002' } },
        defender: { circles: { vanguard: OPP_G3 }, hand: [OPP_G3, OPP_G3, OPP_G1] },
      });
      let r = apply(s, { type: 'END_PHASE', player: 0 });
      const c = r.state.pendingChoice!;
      expect(c.player).toBe(1);
      expect(c.min).toBe(0);
      const g1 = c.options.find((o) => r.state.cards[o]!.definitionId === OPP_G1)!;
      r = discard ? answer(r, g1) : answer(r);
      return legal(r.state, 1, 'RIDE');
    };
    expect(run(true)).toBeDefined();
    expect(run(false)).toBeUndefined();
    const s = scene({
      attacker: { circles: { vanguard: 'EB01-002', front_left: OPP } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(9000);
  });

  it('EB01-010 MUSASHI: +3000 attacking with more rear-guards than the opponent', () => {
    const more = (s: GameState) => {
      const id = s.players[0].deck.pop()!;
      s.cards[id]!.faceUp = true;
      s.players[0].circles.back_right.push(id);
    };
    expect(attackPumps('EB01-010', 3000, { before: more })).toBe(1);
    expect(attackPumps('EB01-010', 3000)).toBe(0);
  });

  it('EB01-026 Fushimi: riding a Murakumo, it may attack the back row', () => {
    const { s, r } = rideIt('EB01-026', { vanguard: 'BT05-055', oppField: { back_left: OPP_G1 } });
    let b = then(r, { type: 'END_PHASE', player: 0 });
    b = then(b, { type: 'END_PHASE', player: 0 });
    const option = attackOptionsOf(b.state, unitAt(b.state, 0, 'vanguard'));
    expect(option?.targets.some((t) => t.id === unitAt(s, 1, 'back_left'))).toBe(true);
  });

  it('EB01-027 Left Arrester / EB01-028 Right Arrester: +3000 each when side by side in the front row', () => {
    const run = (left: string, right: string) => {
      const s = scene({
        attacker: { circles: { vanguard: MURAKUMO_G2, front_left: left, front_right: right } },
        defender: { circles: { vanguard: OPP } },
      });
      return [pw(s, unitAt(s, 0, 'front_left')), pw(s, unitAt(s, 0, 'front_right'))];
    };
    expect(run('EB01-027', 'EB01-028')).toEqual([11000, 11000]);
    expect(run('EB01-028', 'EB01-027')).toEqual([8000, 8000]);
  });
});

describe('EB01 Oracle Think Tank', () => {
  it('EB01-006 Imperial Daughter: Restraint, except on (VC) in your turn with no rear-guards, where it gets +10000/critical +1', () => {
    const alone = scene({
      attacker: { circles: { vanguard: 'EB01-006' } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(alone, 0, 'vanguard');
    expect(attackOptionsOf(alone, vg)).toBeDefined();
    expect(pw(alone, vg)).toBe(21000);
    expect(currentCritical(alone, ctx, vg)).toBe(2);
    const crowded = scene({
      attacker: { circles: { vanguard: 'EB01-006', front_left: OPP, back_left: OTT_G2 } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(attackOptionsOf(crowded, unitAt(crowded, 0, 'vanguard'))).toBeUndefined();
    // [CB1 & an Oracle Think Tank rear-guard to the soul]: loses Restraint
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'EB01-006', front_left: OPP, back_left: OTT_G2 },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    let r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(r.state.players[0].soul).toContain(unitAt(s, 0, 'back_left'));
    r = then(r, { type: 'END_PHASE', player: 0 });
    expect(attackOptionsOf(r.state, unitAt(s, 0, 'vanguard'))).toBeDefined();
  });

  it('EB01-007 Miss Mist: guarding against a grade 2 or less vanguard, your Oracle Think Tank cannot be hit', () => {
    const run = (attacker: string) => {
      const s = scene({
        attacker: { circles: { vanguard: attacker }, deckTop: vanilla(2) },
        defender: {
          circles: { vanguard: OTT_G2 },
          hand: ['EB01-007', OPP_G1],
          deckTop: vanilla(2),
        },
      });
      let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
      r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'EB01-007') }), 1);
      return find(r.events, 'RESTRICTION_ADDED').filter(
        (e) => e.restriction.restriction === 'cannot_be_hit',
      ).length;
    };
    expect(run(OPP)).toBe(1);
    expect(run(OPP_G3)).toBe(0);
  });

  it('EB01-011 Promise Daughter: [discard an Oracle Think Tank] +5000 attacking', () => {
    expect(attackPumps('EB01-011', 5000, { hand: [OTT_G2] })).toBe(1);
    expect(attackPumps('EB01-011', 5000, { hand: [OPP_G1] })).toBe(0);
  });
});

describe('EB01 Pale Moon', () => {
  it('EB01-004 Golden Beast Tamer: Restraint (lost with its [ACT]); front-row Pale Moon rear-guards +3000; placed on (VC), calls a Chimera from the soul', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB01-004', front_left: PM_G2 } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(13000);
    let r = drain(apply(s, { type: 'END_PHASE', player: 0 }));
    expect(attackOptionsOf(r.state, vg)).toBeUndefined();
    r = drain(apply(s, activate(vg, '2')));
    r = then(r, { type: 'END_PHASE', player: 0 });
    expect(attackOptionsOf(r.state, vg)).toBeDefined();
    const ride = scene({
      at: 'ride',
      attacker: { circles: { vanguard: PM_G2 }, hand: ['EB01-004'] },
      defender: { circles: { vanguard: OPP } },
      extra: [[CHIMERA], []],
    });
    const [chimera] = pull(ride, CHIMERA, 'drop');
    ride.players[0].drop.splice(ride.players[0].drop.indexOf(chimera!), 1);
    ride.players[0].soul.push(chimera!);
    const rr = drain(apply(ride, { type: 'RIDE', player: 0, cardId: inHand(ride, 0, 'EB01-004') }));
    expect(onField(rr.state, 0)).toContain(chimera);
  });

  it('EB01-021 Jumping Jill: +3000 when called from the soul', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: PM_G2, front_left: GIRL }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB01-021'], []],
    });
    const [jill] = pull(s, 'EB01-021', 'drop');
    s.players[0].drop.splice(s.players[0].drop.indexOf(jill!), 1);
    s.players[0].soul.push(jill!);
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')), 0, [jill!]);
    expect(onField(r.state, 0)).toContain(jill);
    expect(boosts(r, jill!, 3000)).toBe(1);
  });

  it('EB01-022 Nitro Juggler: placed with a Pale Moon vanguard, Soul-Charge 1', () => {
    const { s, r } = callIt('EB01-022', { vanguard: PM_G2 });
    expect(r.state.players[0].soul.length).toBe(s.players[0].soul.length + 1);
  });

  it('EB01-023 Starting Presenter: when a Pale Moon rides it, Soul-Charge 2', () => {
    const { r } = rideIt(PM_G2, { vanguard: 'EB01-023' });
    // the ridden Presenter itself goes to the soul too
    expect(r.state.players[0].soul.length).toBeGreaterThanOrEqual(4);
  });

  it('EB01-025 Lark Pigeon: from the soul, guards when your hand is empty', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: PM_G2 } },
      extra: [[], ['EB01-025']],
    });
    const pl = s.players[1];
    const pigeon = pl.deck.find((x) => s.cards[x]!.definitionId === 'EB01-025')!;
    pl.deck.splice(pl.deck.indexOf(pigeon), 1);
    pl.soul.push(pigeon);
    s.cards[pigeon]!.faceUp = true;
    const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), 1);
    // the defender cannot do anything else, so the battle ends at once (the guardian then leaves)
    expect(
      find(r.events, 'CARD_MOVED').some((e) => e.instanceId === pigeon && e.to.zone === 'guardian'),
    ).toBe(true);
    expect(r.state.players[1].damage).toHaveLength(0);
  });
});

describe('EB01 Megacolony', () => {
  it('EB01-005 Machining Stag Beetle: placed on (VC), calls two Machining units from the soul at [Rest] and adds their original power', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: MEGA_G2 }, hand: ['EB01-005'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB01-029', 'EB01-030'], []],
    });
    const ids = [...pull(s, 'EB01-029', 'drop'), ...pull(s, 'EB01-030', 'drop')];
    for (const id of ids) {
      s.players[0].drop.splice(s.players[0].drop.indexOf(id), 1);
      s.players[0].soul.push(id);
    }
    const beetle = inHand(s, 0, 'EB01-005');
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: beetle }), 0, ids);
    for (const id of ids) {
      expect(onField(r.state, 0)).toContain(id);
      expect(r.state.cards[id]!.orientation).toBe('rest');
    }
    expect(boosts(r, beetle, 9000 + 7000)).toBe(1);
  });

  it.each(['EB01-029', 'EB01-030'])(
    '%s: +3000 when placed with a Machining unit in the soul',
    (card) => {
      const run = (machining: boolean) =>
        callIt(card, {
          vanguard: MEGA_G2,
          hand: machining ? ['EB01-031'] : [],
          before: (s) => {
            if (!machining) return;
            const id = inHand(s, 0, 'EB01-031');
            s.players[0].hand.splice(s.players[0].hand.indexOf(id), 1);
            s.players[0].soul.push(id);
          },
        });
      const yes = run(true);
      expect(boosts(yes.r, unitAt(yes.r.state, 0, 'front_left'), 3000)).toBe(1);
      const no = run(false);
      expect(boosts(no.r, unitAt(no.r.state, 0, 'front_left'), 3000)).toBe(0);
    },
  );

  it('EB01-031 Machining Worker Ant: placed, stands a Machining rear-guard', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: MEGA_G2, back_left: 'EB01-030' }, hand: ['EB01-031'] },
      defender: { circles: { vanguard: OPP } },
    });
    const hornet = unitAt(s, 0, 'back_left');
    s.cards[hornet]!.orientation = 'rest';
    const r = drain(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, 'EB01-031'), circle: 'front_left' }),
      0,
      [hornet],
    );
    expect(r.state.cards[hornet]!.orientation).toBe('stand');
  });
});

describe('EB01 Kagero, Royal Paladin, Tachikaze, Spike Brothers', () => {
  it('EB01-012 Bellicosity Dragon: its hit turns a damage card face up with a Kagero vanguard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: KAGERO_G1, front_left: 'EB01-012', back_left: KAGERO_G1 },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    s.cards[s.players[0].damage[0]!]!.faceUp = false;
    const r = settle(
      apply(
        s,
        attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
      ),
    );
    expect(faceDown(r.state)).toBe(0);
  });

  it('EB01-013 Guard Griffin: [CB1] +5000 shield guarding with a Kagero vanguard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: {
        circles: { vanguard: KAGERO_G1 },
        hand: ['EB01-013', OPP_G1],
        damage: vanilla(1),
      },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    const griffin = inHand(r.state, 1, 'EB01-013');
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: griffin }), 1);
    expect(currentShield(r.state, ctx, griffin)).toBe(10000);
  });

  it("EB01-014 Zenon: placed, rides the top card if it is a Royal Paladin of your vanguard's grade, otherwise drops it", () => {
    const run = (top: string) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: OPP }, hand: ['EB01-014'], deckTop: [top] },
        defender: { circles: { vanguard: OPP } },
      });
      const vg = unitAt(s, 0, 'vanguard');
      const r = drain(
        apply(s, {
          type: 'CALL',
          player: 0,
          cardId: inHand(s, 0, 'EB01-014'),
          circle: 'front_left',
        }),
      );
      return {
        rode: r.state.players[0].soul.includes(vg),
        dropped: r.state.players[0].drop.length,
      };
    };
    expect(run(OPP)).toEqual({ rode: true, dropped: 0 });
    expect(run(OPP_G1)).toEqual({ rode: false, dropped: 1 });
  });

  it('EB01-015 Savage King: [SB1 & retire another Tachikaze rear-guard] +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB01-015', front_left: 'BT17-072' } },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 1);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg)));
    expect(boosts(r, vg, 3000)).toBe(1);
    expect(r.state.players[0].circles.front_left).toHaveLength(0);
  });

  it('EB01-034 Striken: Restraint on (VC); +5000 when attacked without a booster; a Kagero riding it gives the vanguard +5000/critical +1', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB01-034' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(attackOptionsOf(s, unitAt(s, 0, 'vanguard'))).toBeUndefined();
    const d = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: 'EB01-034' }, hand: [OPP_G1] },
    });
    const dv = unitAt(d, 1, 'vanguard');
    const r = drain(apply(d, attack(unitAt(d, 0, 'vanguard'), dv)));
    expect(boosts(r, dv, 5000)).toBe(1);
    const { r: ride } = rideIt('BT17-026', { vanguard: 'EB01-034' });
    const vg = ride.state.players[0].circles.vanguard[0]!;
    expect(boosts(ride, vg, 5000)).toBe(1);
    expect(currentCritical(ride.state, ctx, vg)).toBe(2);
  });

  it('EB01-035 Spike Bouncer: +3000 when another Spike Brothers attack hits a vanguard', () => {
    const s = scene({
      attacker: { circles: { vanguard: SPIKE_G2, back_left: 'EB01-035' } },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = settle(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, unitAt(s, 0, 'back_left'), 3000)).toBe(1);
  });
});
