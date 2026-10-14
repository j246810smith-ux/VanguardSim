/** BT16 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { apply, andThen as then, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import { activate, attack, boosts, call, drain, field, inHand, legal } from '../fixtures/cardTest';
import {
  attackPumps,
  callIt,
  fillSoul,
  legionAttack,
  legionUp,
  OPP,
  OPP_G1,
  pw,
  unitAt,
} from '../fixtures/shapeChecks';

const BBS = 'BT16-009'; // Blaster Blade Seeker
const SEEKER_G1 = 'BT16-022'; // Flail Seeker, Isbuzzard
const RAIZER_VG = 'BT16-005'; // Ultimate Raizer Mega-flare
const METALBORG_VG = 'BT16-073'; // Metalborg, Sandstorm
const BRAWLER_VG = 'BT16-051'; // Brawler, Headband of Greed
const MUSKETEER_VG = 'BT16-095'; // Carnation Musketeer, Rikhard

type Circle = 'front_left' | 'front_right' | 'back_left' | 'back_center' | 'back_right';

/** Put a `mate` from the deck next to your vanguard as a legion (optionally legioned this turn). */
const forceLegion = (s: GameState, mate: string, thisTurn = false) => {
  const pl = s.players[0];
  const leader = pl.circles.vanguard[0]!;
  const id = pl.deck.splice(
    pl.deck.findIndex((x) => s.cards[x]!.definitionId === mate),
    1,
  )[0]!;
  pl.circles.vanguard.unshift(id); // the leader stays the circle's top card
  s.cards[id]!.faceUp = true;
  s.cards[id]!.orientation = s.cards[leader]!.orientation;
  pl.legion = { leader, mate: id };
  s.everInLegion.push(leader, id);
  if (thisTurn) s.turnFlags.legioned = [leader];
  return id;
};
/** `n` cards from the bottom of your deck into a zone, renamed to `def` (face up). */
const stock = (s: GameState, zone: 'damage' | 'drop' | 'hand', def: string, n: number) => {
  const pl = s.players[0];
  for (let i = 0; i < n; i++) {
    const id = pl.deck.pop()!;
    (s.cards[id] as { definitionId: string }).definitionId = def;
    s.cards[id]!.faceUp = true;
    pl[zone].push(id);
  }
};
/** Every card left in your deck becomes `def`. */
const deckAll = (s: GameState, def: string) => {
  for (const id of s.players[0].deck) (s.cards[id] as { definitionId: string }).definitionId = def;
};
const faceDown = (s: GameState) => s.players[0].damage.filter((id) => !s.cards[id]!.faceUp).length;
/** Play out choices (yours with `prefer`, the opponent's with defaults) and guard passes. */
const settle = (r: Run, prefer: readonly string[] = []): Run => {
  for (let i = 0; i < 80; i++) {
    const c = r.state.pendingChoice;
    if (c) {
      r = drain(r, c.player, c.player === 0 ? prefer : []);
      continue;
    }
    if (legal(r.state, 1, 'PASS_GUARD')) {
      r = then(r, { type: 'PASS_GUARD', player: 1 });
      continue;
    }
    break;
  }
  return r;
};
/** Your unit on `from` attacks the opponent's unit on `to` (vanguard by default). */
const strike = (
  s: GameState,
  from: 'vanguard' | 'front_left' | 'front_right',
  opts: { to?: 'vanguard' | 'front_left'; booster?: Circle; prefer?: readonly string[] } = {},
): Run =>
  settle(
    apply(
      s,
      attack(
        from === 'vanguard'
          ? (s.players[0].legion?.leader ?? unitAt(s, 0, from))
          : unitAt(s, 0, from),
        unitAt(s, 1, opts.to ?? 'vanguard'),
        opts.booster ? unitAt(s, 0, opts.booster) : null,
      ),
    ),
    opts.prefer,
  );
const deckIds = (s: GameState) => [...s.players[0].deck];
/** Critical +1 modifiers added to `target` during the run. */
const crits = (r: Run, target: string) =>
  find(r.events, 'MODIFIER_ADDED').filter(
    (e) => e.modifier.target === target && e.modifier.stat === 'critical',
  ).length;
const hand = (r: Run) => r.state.players[0].hand.length;

describe('BT16 Legion leaders', () => {
  it('BT16-001 Thing Saver Dragon: after attacking a vanguard in legion, rides a new Thing Saver and legions with Blaster Blade Seeker from the soul', () => {
    const { s, r: legion } = legionUp('BT16-001', BBS, {
      extra: ['BT16-001'],
      before: (st) => {
        stock(st, 'damage', OPP, 2);
        stock(st, 'hand', OPP, 2);
        fillSoul(st, 0, 3);
      },
    });
    const oldLeader = unitAt(s, 0, 'vanguard');
    expect(legion.state.players[0].legion).not.toBeNull();
    const r = strike(then(legion, { type: 'END_PHASE', player: 0 }).state, 'vanguard');
    const pl = r.state.players[0];
    expect(pl.legion).not.toBeNull();
    expect(pl.legion!.leader).not.toBe(oldLeader);
    expect(r.state.cards[pl.legion!.leader]!.definitionId).toBe('BT16-001');
    expect(r.state.cards[pl.legion!.mate]!.definitionId).toBe(BBS);
    expect(r.state.cards[pl.legion!.leader]!.orientation).toBe('stand');
    expect(pl.soul).toContain(oldLeader);
  });

  it('BT16-002 Egbert: [CB2 Seekers] +5000/critical +1 in legion with four other Seekers', () => {
    const run = (others: Partial<Record<'front_left' | 'back_left' | 'back_center', string>>) => {
      const { s, r } = legionUp('BT16-002', 'TD14-006', {
        others,
        before: (st) => stock(st, 'damage', SEEKER_G1, 2),
      });
      const vg = unitAt(s, 0, 'vanguard');
      const after = drain(then(r, activate(vg, '2')));
      return { pumped: boosts(after, vg, 5000), crit: currentCritical(after.state, ctx, vg) };
    };
    expect(run({ front_left: SEEKER_G1, back_left: SEEKER_G1, back_center: SEEKER_G1 })).toEqual({
      pumped: 1,
      crit: 2,
    });
    expect(run({ front_left: SEEKER_G1 })).toEqual({ pumped: 0, crit: 1 });
  });

  it('BT16-003 Big Bang Knuckle Dragon: [CB2 Brawlers] in legion +5000 and attacks the whole front row', () => {
    const { s, r } = legionUp('BT16-003', 'BT16-011', {
      oppField: { front_left: OPP_G1, front_right: OPP_G1 },
      before: (st) => stock(st, 'damage', BRAWLER_VG, 2),
    });
    const vg = unitAt(s, 0, 'vanguard');
    let b = drain(then(r, activate(vg, '2'), { type: 'END_PHASE', player: 0 }));
    expect(boosts(b, vg, 5000)).toBe(1);
    b = then(b, attack(vg, unitAt(s, 1, 'vanguard')));
    expect(b.state.battle!.extraTargets).toHaveLength(2);
  });

  it('BT16-003 Big Bang Knuckle Dragon: [SB1] +3000 attacking a vanguard', () => {
    expect(attackPumps('BT16-003', 3000, { soul: 2 })).toBe(1);
  });

  it('BT16-004 Wild Rush Dragon: a drive check with its own name gives +10000/critical +1 in legion; on a hit the opponent retires a rear-guard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT16-004', front_left: OPP },
        damage: vanilla(1),
        deckTop: ['BT16-004', 'BT16-004'],
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['BT16-011'], []],
    });
    forceLegion(s, 'BT16-011'); // stand-in mate: Wildfist Dragon is not in the BT01–BT17 pool
    const vg = unitAt(s, 0, 'vanguard');
    const r = strike(s, 'vanguard');
    expect(boosts(r, vg, 10000)).toBeGreaterThanOrEqual(1);
    expect(r.state.players[0].circles.front_left).toHaveLength(0); // the retire cost
    expect(r.state.players[1].circles.front_left).toHaveLength(0); // the opponent's retire
  });

  it('BT16-005 Mega-flare: critical +1 with four rested units in legion; on a hit stands a rear-guard (a Raizer in the middle column)', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: RAIZER_VG, front_left: OPP, front_right: OPP, back_center: OPP_G1 },
        rested: ['front_left', 'front_right'],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-029'], []],
    });
    forceLegion(s, 'BT16-029');
    const vg = unitAt(s, 0, 'vanguard');
    const r = strike(s, 'vanguard', {
      booster: 'back_center',
      prefer: [unitAt(s, 0, 'front_left')],
    });
    expect(crits(r, vg)).toBe(1);
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
  });

  it('BT16-006 Sin Buster: at 30000+ in legion the opponent cannot guard with grade 1+; at 20000+ a hit draws', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT16-006' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      extra: [['BT16-033'], []],
    });
    forceLegion(s, 'BT16-033');
    const vg = unitAt(s, 0, 'vanguard');
    s.modifiers.push({ target: vg, stat: 'power', amount: 10000, until: 'end_of_turn' });
    const control = structuredClone(s);
    control.modifiers = [];
    const c = drain(apply(control, attack(vg, unitAt(control, 1, 'vanguard'))));
    expect(legal(c.state, 1, 'GUARD')?.cardIds).toHaveLength(1);
    const before = s.players[0].hand.length;
    let r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(legal(r.state, 1, 'GUARD')?.cardIds ?? []).toHaveLength(0);
    r = settle(r);
    expect(hand(r)).toBeGreaterThanOrEqual(before + 1 + 2); // hit draw + twin drive
  });

  it('BT16-007 Emerald Blaze: [CB3 & a same-name card to soul] calls from the deck in legion; [SB2] +2000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT16-007' },
        hand: ['BT16-007'],
        damage: vanilla(3),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-037'], []],
    });
    forceLegion(s, 'BT16-037');
    const before = field(s, 0).length;
    const r = strike(s, 'vanguard');
    expect(field(r.state, 0).length).toBeGreaterThan(before);
    expect(
      r.state.players[0].soul.some((id) => r.state.cards[id]!.definitionId === 'BT16-007'),
    ).toBe(true);

    const m = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT16-007' } },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(m, 0, 2);
    const vg = unitAt(m, 0, 'vanguard');
    expect(boosts(drain(apply(m, activate(vg, '3'))), vg, 2000)).toBe(1);
  });

  it('BT16-008 Martina: [CB1 & five normal Musketeers] calls two Musketeers from the top four in legion; +3000 with a booster', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT16-008' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT16-040'], []],
    });
    forceLegion(s, 'BT16-040');
    stock(s, 'drop', 'BT16-041', 5);
    deckAll(s, 'BT16-099');
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')), deckIds(s));
    expect(field(r.state, 0).filter((d) => d === 'BT16-099')).toHaveLength(2);
    expect(r.state.players[0].drop).toHaveLength(0);
    expect(attackPumps('BT16-008', 3000, { booster: OPP_G1 })).toBe(1);
    expect(attackPumps('BT16-008', 3000)).toBe(0);
  });

  it('BT16-013 Drill-wing: [CB2] in legion stands front-row rear-guards with a unit behind them; +3000 with a booster', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT16-013', front_left: OPP, back_left: OPP_G1, front_right: OPP },
        rested: ['front_left', 'front_right'],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-030'], []],
    });
    forceLegion(s, 'BT16-030');
    const r = strike(s, 'vanguard', {
      prefer: [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'front_right')],
    });
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.orientation).toBe('rest');
    expect(attackPumps('BT16-013', 3000, { booster: OPP_G1 })).toBe(1);
  });

  it('BT16-015 Drion: critical +1 at 30000+ in legion; +3000 with a booster', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT16-015' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-034'], []],
    });
    forceLegion(s, 'BT16-034');
    const vg = unitAt(s, 0, 'vanguard');
    s.modifiers.push({ target: vg, stat: 'power', amount: 10000, until: 'end_of_turn' });
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(crits(r, vg)).toBe(1);
    expect(attackPumps('BT16-015', 3000, { booster: OPP_G1 })).toBe(1);
  });

  it('BT16-017 Bloody Ogle: in the turn it legioned, attacking rear-guards get +5000 and go to the bottom of the deck', () => {
    const run = (thisTurn: boolean) => {
      const s = scene({
        attacker: { circles: { vanguard: 'BT16-017', front_left: OPP }, deckTop: vanilla(2) },
        defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
        extra: [['BT16-038'], []],
      });
      forceLegion(s, 'BT16-038', thisTurn);
      const rg = unitAt(s, 0, 'front_left');
      const r = strike(s, 'front_left');
      return { pump: boosts(r, rg, 5000), bottom: r.state.players[0].deck.at(-1) === rg };
    };
    expect(run(true)).toEqual({ pump: 1, bottom: true });
    expect(run(false)).toEqual({ pump: 0, bottom: false });
  });

  it('BT16-017 Bloody Ogle: [CB2 & a hand card to soul] calls a card from the deck when attacking a vanguard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT16-017' },
        hand: [OPP_G1],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const r = strike(s, 'vanguard');
    expect(field(r.state, 0)).toHaveLength(2);
  });

  it('BT16-019 Vera: in the turn it legioned your Musketeers get +3000; [retire a Musketeer] calls one from the top five', () => {
    const run = (thisTurn: boolean) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: 'BT16-019', front_left: 'BT16-040' } },
        defender: { circles: { vanguard: OPP } },
        extra: [['BT16-041'], []],
      });
      forceLegion(s, 'BT16-041', thisTurn);
      return pw(s, unitAt(s, 0, 'front_left'));
    };
    expect(run(true) - run(false)).toBe(3000);

    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT16-019', front_left: 'BT16-040' } },
      defender: { circles: { vanguard: OPP } },
    });
    deckAll(s, 'BT16-099');
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '3')), deckIds(s));
    expect(field(r.state, 0)).toContain('BT16-099');
    expect(field(r.state, 0)).not.toContain('BT16-040');
  });
});

describe('BT16 grade 3 attackers and Legion pairs', () => {
  it.each([
    ['BT16-060', 'BT16-061'],
    ['BT16-074', 'BT16-075'],
    ['BT16-087', 'BT16-088'],
    ['BT16-095', 'BT16-096'],
  ])('%s: +5000 attacking a vanguard in legion (mate %s)', (leader, mate) => {
    const { r, unit, inLegion } = legionAttack(leader, mate, {}, 'vanguard');
    expect(inLegion).toBe(true);
    expect(boosts(r, unit, 5000)).toBe(1);
  });

  it.each(['BT16-043', 'BT16-051', 'BT16-059', 'BT16-073'])(
    '%s: [SB1] +3000 attacking a vanguard',
    (card) => {
      expect(attackPumps(card, 3000, { soul: 2 })).toBe(1);
      expect(attackPumps(card, 3000, { soul: 2, on: 'front_left' })).toBe(1);
    },
  );
});

describe('BT16 sentinels', () => {
  it('BT16-010 Shiron: [discard] a unit being attacked cannot be hit', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, hand: ['BT16-010', OPP_G1], deckTop: vanilla(2) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT16-010') }), 1);
    r = settle(r);
    expect(r.state.players[1].damage).toHaveLength(0);
  });

  it.each(['BT16-012', 'BT16-014', 'BT16-016', 'BT16-018', 'BT16-020'])(
    '%s: [CB1] calls five cards from the top of the deck to (GC)',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: OPP } },
        defender: { circles: { vanguard: OPP }, hand: [card, OPP_G1], damage: vanilla(1) },
      });
      let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
      r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, card) }), 1);
      expect(r.state.players[1].guardian).toHaveLength(6);
    },
  );
});

describe('BT16 Seekers', () => {
  it('BT16-021 Gildas: [CB1] when your vanguard legions, calls a Seeker from the deck', () => {
    const { s, r } = legionUp('BT16-001', BBS, {
      others: { front_left: 'BT16-021' },
      extra: [SEEKER_G1],
      before: (st) => stock(st, 'damage', OPP, 1),
    });
    expect(field(r.state, 0).length).toBe(field(s, 0).length + 2);
  });

  it('BT16-022 Isbuzzard: +4000 when placed while your vanguard is in legion', () => {
    const run = (legion: boolean) =>
      callIt(SEEKER_G1, {
        vanguard: 'BT16-001',
        before: (s) => void (legion && forceLegion(s, BBS)),
      });
    const gain = (legion: boolean) => {
      const { s, r } = run(legion);
      return boosts(r, r.state.players[0].circles.front_left[0]!, 4000) + 0 * s.turnNumber;
    };
    expect(gain(true)).toBe(1);
    expect(gain(false)).toBe(0);
  });

  it('BT16-023 Grynngal Seeker: boosting Blaster Blade Seeker, a hit on a vanguard draws and turns a damage face up', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT16-001', front_left: BBS, back_left: 'BT16-023' },
        hand: [OPP_G1],
        damage: vanilla(1),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    s.cards[s.players[0].damage[0]!]!.faceUp = false;
    const r = strike(s, 'front_left', { booster: 'back_left' });
    expect(hand(r)).toBe(1);
    expect(faceDown(r.state)).toBe(0);
  });

  it('BT16-024 File: [to soul] when your vanguard legions, calls Blaster Blade Seeker from the deck', () => {
    const { r } = legionUp('BT16-001', BBS, { others: { back_left: 'BT16-024' } });
    expect(field(r.state, 0).filter((d) => d === BBS)).toHaveLength(2);
    expect(field(r.state, 0)).not.toContain('BT16-024');
  });

  it('BT16-044 Morvi and BT16-046 Lunate: +3000 attacking a vanguard with four other Seekers', () => {
    for (const card of ['BT16-044', 'BT16-046']) {
      const run = (n: number) => {
        const circles: Record<string, string> = { vanguard: card };
        for (const c of ['front_left', 'front_right', 'back_left', 'back_right'].slice(0, n))
          circles[c] = SEEKER_G1;
        const s = scene({
          attacker: { circles },
          defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
        });
        const vg = unitAt(s, 0, 'vanguard');
        return boosts(drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard')))), vg, 3000);
      };
      expect(run(4)).toBe(1);
      expect(run(3)).toBe(0);
    }
  });

  it('BT16-045 Sibergal Seeker and BT16-053 Kadru: a hit on a vanguard draws while in legion', () => {
    for (const card of ['BT16-045', 'BT16-053']) {
      const run = (legion: boolean) => {
        const s = scene({
          attacker: { circles: { vanguard: 'BT16-001', front_left: card } },
          defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
          extra: [[BBS], []],
        });
        if (legion) forceLegion(s, BBS);
        return hand(strike(s, 'front_left'));
      };
      expect(run(true) - run(false)).toBe(1);
    }
  });

  it.each(['BT16-047', 'BT16-055', 'BT16-067', 'BT16-081'])(
    '%s: [SB1] another unit gets +5000 when placed',
    (card) => {
      const { s, r } = callIt(card, { vanguard: OPP, soul: 1 });
      expect(boosts(r, unitAt(s, 0, 'vanguard'), 5000)).toBe(1);
    },
  );

  it.each(['BT16-048', 'BT16-056', 'BT16-068', 'BT16-082'])(
    '%s: +5000 on (RC) when your vanguard legions',
    (card) => {
      const { s, r } = legionUp('BT16-001', BBS, { others: { back_left: card } });
      expect(boosts(r, unitAt(s, 0, 'back_left'), 5000)).toBe(1);
    },
  );

  it('BT16-050 Bouquet Paros: [retire this] a boosted hit on a vanguard calls a grade 1 or less card as [Rest]', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT16-001', front_left: OPP, back_left: 'BT16-050' },
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    deckAll(s, OPP_G1);
    const r = strike(s, 'front_left', { booster: 'back_left' });
    expect(field(r.state, 0)).not.toContain('BT16-050');
    const called =
      r.state.players[0].circles.back_left[0] ?? r.state.players[0].circles.back_center[0];
    expect(called && r.state.cards[called]!.orientation).toBe('rest');
  });
});

describe('BT16 Brawlers', () => {
  it('BT16-011 Big Bang Slash Dragon: +3000 when your Brawler vanguard hits', () => {
    const s = scene({
      attacker: { circles: { vanguard: BRAWLER_VG, front_left: 'BT16-011' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = strike(s, 'vanguard');
    expect(boosts(r, unitAt(s, 0, 'front_left'), 3000)).toBe(1);
  });

  it('BT16-025 Yojin: when your vanguard legions, retires an opponent front-row rear-guard', () => {
    const { r } = legionUp('BT16-001', BBS, {
      others: { front_left: 'BT16-025' },
      oppField: { front_left: OPP_G1 },
    });
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
  });

  it('BT16-026 Kohmei: [discard] draws when the opponent has one or no front-row rear-guards', () => {
    const run = (opp: Partial<Record<'front_left' | 'front_right', string>>) => {
      const { s, r } = callIt('BT16-026', { vanguard: OPP, hand: [OPP_G1], oppField: opp });
      return {
        hand: r.state.players[0].hand.length,
        drop: r.state.players[0].drop.length - s.players[0].drop.length,
      };
    };
    expect(run({ front_left: OPP_G1 })).toEqual({ hand: 1, drop: 1 });
    expect(run({ front_left: OPP_G1, front_right: OPP_G1 })).toEqual({ hand: 1, drop: 0 });
  });

  it("BT16-027 Arc: +3000 when an opponent's rear-guard is retired during your turn while in legion", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT16-001', front_left: 'BT16-027' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 }, deckTop: vanilla(2) },
      extra: [[BBS], []],
    });
    forceLegion(s, BBS);
    const r = strike(s, 'vanguard', { to: 'front_left' });
    expect(boosts(r, unitAt(s, 0, 'front_left'), 3000)).toBe(1);
  });

  it('BT16-028 Fighting Dracokid: [to soul] gives your vanguard "retire the rear-guard behind a dropped front-row rear-guard"', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT16-001', back_left: 'BT16-028' },
        damage: vanilla(1),
        deckTop: vanilla(2),
      },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, back_left: OPP, back_right: OPP },
        deckTop: vanilla(2),
      },
      extra: [[BBS], []],
    });
    forceLegion(s, BBS);
    let r = settle(apply(s, activate(unitAt(s, 0, 'back_left'))));
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = strike(r.state, 'vanguard', { to: 'front_left' });
    expect(r.state.players[1].circles.back_left).toHaveLength(0);
    expect(r.state.players[1].circles.back_right).toHaveLength(1);
  });

  it('BT16-058 Haoka: [retire this] retires the rear-guard in the same column as a dropped front-row rear-guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP, back_left: 'BT16-058' }, deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, back_left: OPP, back_right: OPP },
        deckTop: vanilla(2),
      },
    });
    const r = strike(s, 'vanguard', { to: 'front_left' });
    expect(r.state.players[1].circles.back_left).toHaveLength(0);
    expect(r.state.players[1].circles.back_right).toHaveLength(1);
    expect(field(r.state, 0)).not.toContain('BT16-058');
  });

  it('BT16-052 Shuki: when placed in legion, up to two opponent rear-guards cannot intercept', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT16-001' }, hand: ['BT16-052'] },
      defender: { circles: { vanguard: OPP, front_left: OPP, front_right: OPP } },
      extra: [[BBS], []],
    });
    forceLegion(s, BBS);
    const r = settle(apply(s, call(inHand(s, 0, 'BT16-052'), 'front_left')), [
      unitAt(s, 1, 'front_left'),
      unitAt(s, 1, 'front_right'),
    ]);
    expect(r.state.restrictions.filter((x) => x.restriction === 'cannot_intercept')).toHaveLength(
      2,
    );
  });

  it('BT16-054 Igo: +4000 boosting Big Bang Knuckle Dragon in its column', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT16-003', back_center: 'BT16-054' } },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(
      boosts(
        drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')))),
        vg,
        4000,
      ),
    ).toBe(1);
    const t = scene({
      attacker: { circles: { vanguard: BRAWLER_VG, back_center: 'BT16-054' } },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const tv = unitAt(t, 0, 'vanguard');
    expect(
      boosts(
        drain(apply(t, attack(tv, unitAt(t, 1, 'vanguard'), unitAt(t, 0, 'back_center')))),
        tv,
        4000,
      ),
    ).toBe(0);
  });
});

describe('BT16 Raizers', () => {
  it('BT16-029 Dual-flare: in the turn your vanguard legioned, stands and gets +5000 when your vanguard attacks (once)', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: RAIZER_VG, front_left: 'BT16-029' },
        rested: ['front_left'],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-029'], []],
    });
    forceLegion(s, 'BT16-029', true);
    const r = strike(s, 'vanguard');
    const rg = unitAt(s, 0, 'front_left');
    expect(r.state.cards[rg]!.orientation).toBe('stand');
    expect(boosts(r, rg, 5000)).toBe(1);
  });

  it.each([
    ['BT16-030', RAIZER_VG],
    ['BT16-064', RAIZER_VG],
    ['BT16-034', METALBORG_VG],
    ['BT16-078', METALBORG_VG],
  ])('%s: +3000 attacking with a matching vanguard (%s)', (card, vanguard) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: OPP })).toBe(0);
  });

  it('BT16-031 Tankraizer: cannot be retired by card effects with another Raizer in its column', () => {
    const run = (behind: boolean) => {
      const { r } = legionUp(RAIZER_VG, 'BT16-029', {
        others: { front_left: 'BT16-025' },
        oppField: behind
          ? { front_left: 'BT16-031', back_left: 'BT16-064' }
          : { front_left: 'BT16-031' },
      });
      return r.state.players[1].circles.front_left.length;
    };
    expect(run(true)).toBe(1);
    expect(run(false)).toBe(0);
  });

  it('BT16-032 Energyraizer: [CB1 & to soul] a boosted hit in legion stands up to two Raizer rear-guards', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: RAIZER_VG,
          front_left: 'BT16-064',
          back_left: 'BT16-032',
          front_right: 'BT16-063',
        },
        rested: ['front_right'],
        damage: vanilla(1),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['BT16-029'], []],
    });
    forceLegion(s, 'BT16-029');
    const r = strike(s, 'front_left', {
      booster: 'back_left',
      prefer: [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'front_right')],
    });
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.orientation).toBe('stand');
    expect(field(r.state, 0)).not.toContain('BT16-032');
  });

  it('BT16-062 Wingraizer and BT16-065 Carvingraizer: +2000 during your turn with Raizers in the same column', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: OPP,
          front_left: 'BT16-062',
          back_left: 'BT16-064',
          front_right: 'BT16-063',
          back_right: 'BT16-065',
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(9000 + 2000);
    expect(pw(s, unitAt(s, 0, 'front_right'))).toBe(8000 + 2000);
    expect(pw(s, unitAt(s, 0, 'back_right'))).toBe(6000);
  });

  it.each(['BT16-063', 'BT16-077', 'BT16-090', 'BT16-098'])(
    '%s: +4000 attacking while your vanguard is in legion',
    (card) => {
      const run = (legion: boolean) =>
        attackPumps(card, 4000, {
          on: 'front_left',
          vanguard: 'BT16-001',
          before: (s) => void (legion && forceLegion(s, BBS)),
        });
      expect(run(true)).toBe(1);
      expect(run(false)).toBe(0);
    },
  );

  it.each(['BT16-066', 'BT16-080', 'BT16-091', 'BT16-099'])(
    '%s: boosting a vanguard in legion gives +4000',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: 'BT16-001', back_center: card } },
        defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
        extra: [[BBS], []],
      });
      forceLegion(s, BBS);
      const vg = unitAt(s, 0, 'vanguard');
      expect(
        boosts(
          drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')))),
          vg,
          4000,
        ),
      ).toBe(1);
    },
  );

  it('BT16-072 Subliminal Gray: [SB1 & to the bottom of the deck] draws', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP, front_left: 'BT16-072' } },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 1);
    const gray = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, activate(gray)));
    expect(hand(r)).toBe(1);
    expect(r.state.players[0].deck).toContain(gray);
  });
});

describe('BT16 Metalborgs', () => {
  it('BT16-033 Ur Buster: when your vanguard legions, it gets +4000 and "a hit on a vanguard retires a rear-guard"', () => {
    const { s, r } = legionUp('BT16-074', 'BT16-075', {
      others: { front_left: 'BT16-033' },
      oppField: { front_left: OPP_G1 },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(boosts(r, vg, 4000)).toBe(1);
    const hit = strike(then(r, { type: 'END_PHASE', player: 0 }).state, 'vanguard');
    expect(hit.state.players[1].circles.front_left).toHaveLength(0);
  });

  it('BT16-035 Yunbot: [CB1] gives your vanguard "a hit on a vanguard draws, and in legion turns a damage face up"', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: METALBORG_VG },
        hand: ['BT16-035'],
        damage: vanilla(1),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-075'], []],
    });
    forceLegion(s, 'BT16-075');
    const r = settle(apply(s, call(inHand(s, 0, 'BT16-035'), 'front_left')), [
      s.players[0].legion!.leader,
    ]);
    expect(faceDown(r.state)).toBe(1);
    const before = r.state.players[0].hand.length;
    let b = then(r, { type: 'END_PHASE', player: 0 });
    b = strike(b.state, 'vanguard');
    expect(b.state.players[0].hand.length).toBeGreaterThanOrEqual(before + 1);
    expect(faceDown(b.state)).toBe(0);
    expect(s.players[0].legion).not.toBeNull();
  });

  it('BT16-036 Blackboi: [CB2 & four Metalborgs to soul] rides a grade 3 that legions with your grade 2 vanguard, then legions', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'BT16-034',
          front_left: 'BT16-036',
          back_left: 'BT16-078',
          back_center: 'BT16-079',
          front_right: 'BT16-080',
        },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT16-015'], []],
    });
    const r = settle(apply(s, activate(unitAt(s, 0, 'front_left'))));
    const legion = r.state.players[0].legion!;
    expect(legion).not.toBeNull();
    expect(r.state.cards[legion.leader]!.definitionId).toBe('BT16-015');
    expect(r.state.cards[legion.mate]!.definitionId).toBe('BT16-034');
  });

  it('BT16-076 Russell Blizzard, BT16-079 Mist Ghost, BT16-086 Kilika: units on your (VC) get power', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: METALBORG_VG, front_left: 'BT16-076' },
        damage: vanilla(1),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-075'], []],
    });
    const mate = forceLegion(s, 'BT16-075');
    const vg = unitAt(s, 0, 'vanguard');
    const r = strike(s, 'front_left', { prefer: [vg, mate] });
    expect(boosts(r, vg, 3000) + boosts(r, mate, 3000)).toBe(2);

    const m = callIt('BT16-079', { vanguard: METALBORG_VG, damage: 1 });
    expect(boosts(m.r, unitAt(m.s, 0, 'vanguard'), 4000)).toBe(1);

    const k = scene({
      at: 'main',
      attacker: { circles: { vanguard: METALBORG_VG, front_left: 'BT16-086' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      boosts(drain(apply(k, activate(unitAt(k, 0, 'front_left')))), unitAt(k, 0, 'vanguard'), 3000),
    ).toBe(1);
  });
});

describe('BT16 Spike Brothers', () => {
  it('BT16-037 Silver Blaze: [SB1] in legion +10000 attacking a vanguard, then returns to the deck', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT16-007', front_left: 'BT16-037' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-037'], []],
    });
    forceLegion(s, 'BT16-037');
    fillSoul(s, 0, 1);
    const rg = unitAt(s, 0, 'front_left');
    const r = strike(s, 'front_left');
    expect(boosts(r, rg, 10000)).toBe(1);
    expect(r.state.players[0].deck).toContain(rg);
  });

  it('BT16-038 Frozen Ogle: [CB1 & to soul] after attacking a vanguard in the turn of a legion, calls a card from the deck', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT16-007', front_left: 'BT16-038' },
        damage: vanilla(1),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-037'], []],
    });
    // Emerald Blaze, not Bloody Ogle: Bloody Ogle would send the attacker to the deck first
    forceLegion(s, 'BT16-037', true);
    const rg = unitAt(s, 0, 'front_left');
    const r = strike(s, 'front_left');
    expect(r.state.players[0].soul).toContain(rg);
    expect(field(r.state, 0).length).toBeGreaterThanOrEqual(3);
  });

  it('BT16-039 Machine Gun Gloria: [CB1] after boosting a grade 1+ rear-guard, draws and puts that unit on the bottom of the deck', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: OPP, front_left: OPP, back_left: 'BT16-039' },
        damage: vanilla(1),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const rg = unitAt(s, 0, 'front_left');
    const r = strike(s, 'front_left', { booster: 'back_left' });
    expect(hand(r)).toBe(1);
    expect(r.state.players[0].deck.at(-1)).toBe(rg);
  });

  it('BT16-089 Jumbo the Stungun: placed during your battle phase, soul charges and turns a damage face up', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT16-017' },
        hand: [OPP_G1],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-089'], []],
    });
    const jumbo = s.players[0].deck.filter((id) => s.cards[id]!.definitionId === 'BT16-089');
    const r = strike(s, 'vanguard', { prefer: jumbo });
    expect(field(r.state, 0)).toContain('BT16-089');
    expect(faceDown(r.state)).toBe(1); // CB2 paid, one turned back up
    const main = callIt('BT16-089', { vanguard: OPP });
    expect(main.r.state.players[0].soul.length).toBe(main.s.players[0].soul.length);
  });

  it('BT16-092 Cyclone Johnny: boosting a grade 1+ rear-guard in legion may give +5000, and that unit goes to the bottom of the deck', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT16-007', front_left: OPP, back_left: 'BT16-092' },
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-037'], []],
    });
    forceLegion(s, 'BT16-037');
    const rg = unitAt(s, 0, 'front_left');
    const r = strike(s, 'front_left', { booster: 'back_left' });
    expect(boosts(r, rg, 5000)).toBe(1);
    expect(r.state.players[0].deck.at(-1)).toBe(rg);
  });
});

describe('BT16 Musketeers', () => {
  it('BT16-040 Toure and BT16-101 Raisa: retiring a Musketeer calls from the top four; Raisa then calls another', () => {
    const { s, r } = callIt('BT16-040', {
      vanguard: MUSKETEER_VG,
      others: { back_left: 'BT16-101' },
      damage: 1,
      before: (st) => {
        forceLegion(st, 'BT16-096');
        deckAll(st, 'BT16-099');
      },
    });
    expect(field(r.state, 0)).not.toContain('BT16-101');
    expect(field(r.state, 0).filter((d) => d === 'BT16-099')).toHaveLength(2);
    expect(s.players[0].legion).not.toBeNull();
  });

  it('BT16-041 Saul: [three normal Musketeers to the deck] draws attacking a vanguard in the turn of a legion', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: MUSKETEER_VG, front_left: 'BT16-041' },
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT16-096'], []],
    });
    forceLegion(s, 'BT16-096', true);
    stock(s, 'drop', 'BT16-040', 3);
    const r = strike(s, 'front_left');
    expect(hand(r)).toBe(1);
    expect(r.state.players[0].drop).toHaveLength(0);
  });

  it('BT16-042 Tamara: [CB1 Musketeer] calls a copy of one of your rear-guards from the top four', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: MUSKETEER_VG, back_left: 'BT16-099' }, hand: ['BT16-042'] },
      defender: { circles: { vanguard: OPP } },
    });
    stock(s, 'damage', 'BT16-040', 1);
    deckAll(s, 'BT16-099');
    const r = settle(apply(s, call(inHand(s, 0, 'BT16-042'), 'front_left')), [
      unitAt(s, 0, 'back_left'),
      ...deckIds(s),
    ]);
    expect(field(r.state, 0).filter((d) => d === 'BT16-099')).toHaveLength(2);
  });

  it('BT16-097 Evelina: +3000 attacking with another unit of the same name', () => {
    const run = (twin: boolean) => {
      const s = scene({
        attacker: {
          circles: twin
            ? { vanguard: OPP, front_left: 'BT16-097', front_right: 'BT16-097' }
            : { vanguard: OPP, front_left: 'BT16-097' },
        },
        defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      });
      const rg = unitAt(s, 0, 'front_left');
      return boosts(drain(apply(s, attack(rg, unitAt(s, 1, 'vanguard')))), rg, 3000);
    };
    expect(run(true)).toBe(1);
    expect(run(false)).toBe(0);
  });

  it('BT16-100 Susanna: [SB2] turns up to two damage face up', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP }, hand: ['BT16-100'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 2);
    for (const id of s.players[0].damage) s.cards[id]!.faceUp = false;
    const r = settle(apply(s, call(inHand(s, 0, 'BT16-100'), 'front_left')), [
      ...s.players[0].damage,
    ]);
    expect(faceDown(r.state)).toBe(0);
  });
});

describe('BT16 engine pieces', () => {
  it('a legion records the leader for "during the turn your vanguard legioned"; a new turn clears it', () => {
    const { s, r } = legionUp('BT16-001', BBS);
    expect(r.state.turnFlags.legioned).toEqual([unitAt(s, 0, 'vanguard')]);
    const next = settle(
      then(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 }),
    );
    expect(next.state.turnFlags.legioned ?? []).toEqual([]);
  });

  it('calling to (RC) moves no hand card when the call is to a circle', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP }, hand: [OPP_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = apply(s, call(inHand(s, 0, OPP_G1), 'front_left'));
    expect(r.state.players[0].hand).toHaveLength(0);
  });
});
