/**
 * BT01 card tests (blueprint: every card with abilities gets at least one test). Real card data
 * from data/cards/BT01.json + src/cards/BT01.ts. `npm run cards:report` counts a card as tested
 * when its ID appears in this file.
 */
import { describe, expect, it } from 'vitest';
import {
  actingPlayer,
  checkZoneInvariant,
  currentCritical,
  currentPower,
  getLegalActions,
  type GameState,
  type LegalAction,
  type PlayerId,
} from '../../src/engine';
import { andThen as then, answer, apply, ctx, find, scene, vanilla } from '../fixtures/bt01';
import { unitAt } from '../fixtures/scenario';

const legal = <T extends LegalAction['type']>(s: GameState, p: PlayerId, type: T) =>
  getLegalActions(s, p, ctx).find((a): a is Extract<LegalAction, { type: T }> => a.type === type);
const inHand = (s: GameState, p: PlayerId, def: string) =>
  s.players[p].hand.find((id) => s.cards[id]!.definitionId === def)!;
const pw = (s: GameState, id: string) => currentPower(s, ctx, id);
const attack = (s: GameState, attacker: string, target: string, booster: string | null = null) =>
  ({ type: 'ATTACK', player: 0, attacker, target, booster }) as const;
const activate = (source: string, abilityId: string, player: PlayerId = 0) =>
  ({ type: 'ACTIVATE', player, source, abilityId }) as const;
const endPhase = (p: PlayerId = 0) => ({ type: 'END_PHASE', player: p }) as const;
/** Move a card from a player's deck into a zone (test setup only). */
function put(s: GameState, p: PlayerId, def: string, zone: 'soul' | 'drop' | 'bind'): string {
  const pl = s.players[p];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl[zone].push(id);
  s.cards[id]!.faceUp = true;
  return id;
}
const soulOf = (s: GameState, p: PlayerId, n: number) => {
  const pl = s.players[p];
  const moved = pl.deck.splice(pl.deck.length - n, n);
  pl.soul.push(...moved);
  for (const id of moved) s.cards[id]!.faceUp = true;
};
/** Answer pending cost choices (e.g. which 8 of 9 soul cards to Soul Blast) with the first options. */
const payCosts = (r: ReturnType<typeof apply>) => {
  while (r.state.pendingChoice?.kind === 'cost') {
    r = answer(r, ...r.state.pendingChoice.options.slice(0, r.state.pendingChoice.min));
  }
  return r;
};
const attackPower = (r: { events: Parameters<typeof find>[0] }) =>
  find(r.events, 'ATTACK_RESOLVED')[0]!.attackPower;

// Vanilla units used as bodies (no abilities)
const RP_G1 = 'BT01-042'; // Little Sage, Marron 8000 (boost)
const RP_G2 = 'BT01-021'; // Knight of Silence, Gallatin 10000
const KAG_G2 = 'BT01-022'; // Dragon Knight, Nehalem 10000
const KAG_G1 = 'BT01-048'; // Embodiment of Armor, Bahr 8000
const OTT_G2 = 'BT01-026'; // Oracle Guardian, Wiseman 10000
const OTT_G1 = 'BT01-054'; // Oracle Guardian, Gemini 8000
const NG_G2 = 'BT01-030'; // King of Sword 10000
const NG_G1 = 'BT01-060'; // Tough Boy 8000
const GB_G2 = 'BT01-038'; // Commodore Blueblood 10000 (Granblue)
const MC_G2 = 'BT01-040'; // Bloody Hercules 10000 (Megacolony)
const OPP_VG = 'BT01-038';

describe('Royal Paladin', () => {
  it("'BT01-001' King of Knights, Alfred: power per RP rear-guard, no boost, CB3 search+call", () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'BT01-001',
          front_left: RP_G1,
          back_center: RP_G1,
          front_right: KAG_G2,
        },
        damage: vanilla(3),
      },
      defender: { circles: { vanguard: OPP_VG } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(10000 + 2 * 2000); // two RP rear-guards, Nehalem is Kagero
    const battle = apply(s, endPhase()).state;
    const vcAttack = legal(battle, 0, 'ATTACK')!.options.find(
      (o) => o.attackerCircle === 'vanguard',
    )!;
    expect(vcAttack.boosters).toEqual([]);
    let r = apply(s, activate(vg, '3'));
    const options = r.state.pendingChoice!.options;
    expect(
      options.every((id) => ctx.registry.get(r.state.cards[id]!.definitionId).grade <= 2),
    ).toBe(true);
    r = answer(r, options[0]!);
    r = answer(r, 'back_left');
    expect(r.state.players[0].circles.back_left).toEqual([options[0]]);
  });

  it("'BT01-002' Blaster Blade: on ride CB2 retires a rear-guard; on call only grade 2+", () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: RP_G1 }, hand: ['BT01-002'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP_VG, front_left: RP_G1 } },
    });
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT01-002') });
    r = answer(r, 'yes');
    expect(r.state.players[1].circles.front_left).toEqual([]);

    const c = scene({
      at: 'main',
      attacker: { circles: { vanguard: RP_G2 }, hand: ['BT01-002'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP_VG, front_left: RP_G1, front_right: RP_G2 } },
    });
    let r2 = apply(c, {
      type: 'CALL',
      player: 0,
      cardId: inHand(c, 0, 'BT01-002'),
      circle: 'front_left',
    });
    r2 = answer(r2, 'yes'); // only the grade 2 is a legal target: forced
    expect(r2.state.players[1].circles.front_right).toEqual([]);
    expect(r2.state.players[1].circles.front_left).toHaveLength(1);
  });

  it("'BT01-003' Barcgal: forerunner; [Rest] search Llew or Flogal and call it", () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT01-003' }, hand: [RP_G1] },
      defender: { circles: { vanguard: OPP_VG } },
      extra: [['BT01-012', 'BT01-046'], []],
    });
    const barcgal = unitAt(s, 0, 'vanguard');
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, RP_G1) });
    r = answer(r, 'yes');
    r = answer(r, 'back_left');
    expect(r.state.players[0].circles.back_left).toEqual([barcgal]);
    r = then(r, endPhase(), activate(barcgal, '2'));
    const names = r.state.pendingChoice!.options.map(
      (id) => ctx.registry.get(r.state.cards[id]!.definitionId).name,
    );
    expect(new Set(names)).toEqual(new Set(['Future Knight, Llew', 'Flogal']));
    r = answer(r, r.state.pendingChoice!.options[0]!);
    r = answer(r, 'front_left');
    expect(r.state.cards[barcgal]!.orientation).toBe('rest');
    expect(r.state.players[0].circles.front_left).toHaveLength(1);
  });

  it("'BT01-010' Solitary Knight, Gancelot: CB2 +5000/+1 with Blaster Blade in soul; hand search", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT01-010' }, damage: vanilla(2), hand: ['BT01-010'] },
      defender: { circles: { vanguard: OPP_VG } },
      extra: [['BT01-002'], []],
    });
    put(s, 0, 'BT01-002', 'soul');
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, activate(vg, '1'));
    expect(pw(r.state, vg)).toBe(14000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    let h = apply(s, activate(inHand(s, 0, 'BT01-010'), '2'));
    h = answer(h, h.state.pendingChoice!.options[0]!);
    expect(h.state.players[0].hand.map((id) => h.state.cards[id]!.definitionId)).toEqual([
      'BT01-002',
    ]);
  });

  it("'BT01-012' Future Knight, Llew: CB1 + Llew/Barcgal/Flogal to soul, ride Blaster Blade", () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: RP_G1,
          front_left: 'BT01-012',
          back_left: 'BT01-003',
          back_center: 'BT01-046',
        },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_VG } },
      extra: [['BT01-002'], []],
    });
    let r = apply(s, activate(unitAt(s, 0, 'front_left'), '1'));
    r = answer(r, r.state.pendingChoice!.options[0]!); // the search
    expect(r.state.cards[unitAt(r.state, 0, 'vanguard')]!.definitionId).toBe('BT01-002');
    expect(r.state.players[0].soul).toHaveLength(1 + 3 + 1); // starter + 3 costs + old vanguard
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it.each([
    ['BT01-011', RP_G2, RP_G1],
    ['BT01-015', KAG_G2, KAG_G1],
    ['BT01-019', OTT_G2, OTT_G1],
  ])(
    'perfect guard %s: discard a same-clan card, the attacked unit cannot be hit',
    (pg, vgDef, discardDef) => {
      const s = scene({
        attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
        defender: { circles: { vanguard: vgDef }, hand: [pg, discardDef, discardDef] },
      });
      let r = apply(s, attack(s, unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
      r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, pg) });
      r = answer(r, 'yes');
      r = answer(r, r.state.pendingChoice!.options[0]!); // which card to discard
      r = then(r, { type: 'PASS_GUARD', player: 1 });
      expect(find(r.events, 'ATTACK_RESOLVED')[0]!.hit).toBe(false);
    },
  );

  it.each([
    ['BT01-043', RP_G2],
    ['BT01-049', KAG_G2],
    ['BT01-061', NG_G2],
  ])('%s: [Rest this unit & discard] draw a card', (card, vg) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg, front_left: card }, hand: [RP_G1] },
      defender: { circles: { vanguard: OPP_VG } },
    });
    const unit = unitAt(s, 0, 'front_left');
    const r = apply(s, activate(unit, '1'));
    expect(r.state.cards[unit]!.orientation).toBe('rest');
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].drop).toHaveLength(1);
  });

  it.each([
    ['BT01-044', 'BT01-002', 9000 + 6000 + 4000],
    ['BT01-050', 'BT01-023', 8000 + 6000 + 4000],
    ['BT01-031', 'BT01-030', 10000 + 6000 + 4000],
    ['BT01-072', 'BT01-071', 9000 + 6000 + 4000],
  ])('%s boosts the named %s for +4000', (booster, named, total) => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033', front_left: named, back_left: booster } },
      defender: { circles: { vanguard: OPP_VG } },
    });
    const r = apply(
      s,
      attack(s, unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
    );
    expect(attackPower(r)).toBe(total);
  });

  it("'BT01-041' Covenant Knight, Randolf / 'BT01-068' Chigasumi: +3000 with more cards in hand", () => {
    for (const card of ['BT01-041', 'BT01-068']) {
      const s = scene({
        attacker: { circles: { vanguard: 'BT01-033', front_left: card }, hand: [RP_G1, RP_G1] },
        defender: { circles: { vanguard: OPP_VG }, hand: [RP_G1] },
      });
      const r = apply(s, attack(s, unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')));
      expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(8000 + 3000);
    }
  });
});

describe('Kagero', () => {
  it("'BT01-004' Dragonic Overlord: -2000 alone; CB3 +5000, stands on rear-guard hit, loses Twin Drive", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT01-004' }, damage: vanilla(3), deckTop: vanilla(3) },
      defender: { circles: { vanguard: OPP_VG, front_left: RP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(9000);
    let r = apply(s, activate(vg, '2'), endPhase());
    r = then(r, attack(r.state, vg, unitAt(r.state, 1, 'front_left')));
    expect(find(r.events, 'CHECK_REVEALED').filter((e) => e.check === 'drive')).toHaveLength(1);
    expect(r.state.cards[vg]!.orientation).toBe('stand');
  });

  it("'BT01-005' Embodiment of Victory, Aleph: CB4 +3000/+1; soul cost flips all damage", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT01-005' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP_VG } },
      extra: [['BT01-014', 'BT01-048', 'BT01-024'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    for (const def of ['BT01-014', 'BT01-048', 'BT01-024']) put(s, 0, def, 'soul');
    let r = apply(s, activate(vg, '1'));
    expect(pw(r.state, vg)).toBe(13000);
    expect(r.state.players[0].damage.every((id) => !r.state.cards[id]!.faceUp)).toBe(true);
    r = then(r, activate(vg, '2'));
    expect(r.state.players[0].damage.every((id) => r.state.cards[id]!.faceUp)).toBe(true);
  });

  it("'BT01-013' Vortex Dragon: main phase SC1/+2000; SB8&CB5 retire up to three", () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT01-013' }, damage: vanilla(5) },
      defender: {
        circles: { vanguard: OPP_VG, front_left: RP_G1, back_left: RP_G1, front_right: RP_G2 },
      },
    });
    soulOf(s, 0, 7);
    const vg = unitAt(s, 0, 'vanguard');
    let r = apply(s, endPhase()); // to main: the AUTO resolves
    expect(r.state.players[0].soul).toHaveLength(9);
    expect(pw(r.state, vg)).toBe(12000);
    r = payCosts(then(r, activate(vg, '2')));
    r = answer(r, ...r.state.pendingChoice!.options.slice(0, 2));
    expect(r.state.players[1].drop).toHaveLength(2);
  });

  it("'BT01-014' Dragon Knight, Aleph: CB1 + Bahr and Tahr to soul, ride Embodiment of Victory", () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT01-014', front_left: 'BT01-048', back_left: 'BT01-024' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_VG } },
      extra: [['BT01-005'], []],
    });
    let r = apply(s, activate(unitAt(s, 0, 'vanguard'), '1'));
    r = answer(r, r.state.pendingChoice!.options[0]!);
    expect(r.state.cards[unitAt(r.state, 0, 'vanguard')]!.definitionId).toBe('BT01-005');
  });

  it("'BT01-016' Lizard Soldier, Conroe: [CB1 & retire] search a grade 1 or less Kagero", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: KAG_G2, front_left: 'BT01-016' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP_VG } },
    });
    let r = apply(s, activate(unitAt(s, 0, 'front_left'), '2'));
    const found = r.state.pendingChoice!.options[0]!;
    expect(ctx.registry.get(r.state.cards[found]!.definitionId).clan).toBe('Kagero');
    r = answer(r, found);
    expect(r.state.players[0].hand).toEqual([found]);
  });

  it("'BT01-023' Wyvern Strike, Tejas: may attack the back-row unit in the same column", () => {
    const s = scene({
      attacker: { circles: { vanguard: KAG_G2, front_left: 'BT01-023' } },
      defender: { circles: { vanguard: OPP_VG, back_right: RP_G1, back_left: RP_G1 } },
    });
    const option = legal(s, 0, 'ATTACK')!.options.find((o) => o.attackerCircle === 'front_left')!;
    // my left column faces the opponent's right column (CR 4.6.2.1)
    expect(option.targets.map((t) => t.circle)).toEqual(['vanguard', 'back_right']);
    const r = apply(s, attack(s, unitAt(s, 0, 'front_left'), unitAt(s, 1, 'back_right')));
    expect(r.state.players[1].circles.back_right).toEqual([]);
  });
});

describe('Oracle Think Tank', () => {
  it("'BT01-006' CEO Amaterasu: +4000 with 4+ in hand; main-phase SC1 and top/bottom; draw up to five", () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'BT01-006' },
        hand: vanilla(4),
        damage: vanilla(5),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_VG } },
    });
    soulOf(s, 0, 7);
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(14000);
    let r = apply(s, endPhase());
    expect(r.state.pendingChoice).toMatchObject({ kind: 'top_or_bottom' });
    r = answer(r, 'bottom');
    r = then(r, endPhase(), attack(r.state, vg, unitAt(r.state, 1, 'vanguard')));
    r = payCosts(answer(r, 'yes'));
    expect(r.state.pendingChoice).toMatchObject({ kind: 'number' });
    const hand = r.state.players[0].hand.length;
    r = answer(r, '3');
    expect(r.state.players[0].hand.length).toBe(hand + 3);
  });

  it("'BT01-007' Battle Sister, Cocoa: when placed with an OTT vanguard, top or bottom", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OTT_G2 }, hand: ['BT01-007'] },
      defender: { circles: { vanguard: OPP_VG } },
    });
    const top = s.players[0].deck[0]!;
    let r = apply(s, {
      type: 'CALL',
      player: 0,
      cardId: inHand(s, 0, 'BT01-007'),
      circle: 'back_left',
    });
    r = answer(r, 'bottom');
    expect(r.state.players[0].deck.at(-1)).toBe(top);
  });

  it("'BT01-017' Maiden of Libra: CB2 draw on hit with an OTT vanguard", () => {
    const s = scene({
      attacker: { circles: { vanguard: OTT_G2, front_left: 'BT01-017' }, damage: vanilla(2) },
      defender: { circles: { vanguard: 'BT01-080' } },
      extra: [[], []],
    });
    let r = apply(s, attack(s, unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')));
    r = answer(r, 'yes');
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it("'BT01-018' Battle Sister, Mocha: +3000 when attacking with 4+ cards in hand", () => {
    const s = scene({
      attacker: { circles: { vanguard: OTT_G2, front_left: 'BT01-018' }, hand: vanilla(4) },
      defender: { circles: { vanguard: OPP_VG } },
    });
    const r = apply(s, attack(s, unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')));
    expect(attackPower(r)).toBe(11000);
  });

  it("'BT01-025' Oracle Guardian, Apollon: VC hit CB2 draw 2 return 1; RC hit CB2 draw 1", () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT01-025', front_left: 'BT01-025' },
        damage: vanilla(4),
        deckTop: vanilla(4),
      },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    let r = apply(s, attack(s, unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = answer(r, 'yes');
    r = answer(r, ...r.state.pendingChoice!.options.slice(0, 2)); // CB2 from 4: choose which two
    r = answer(r, r.state.pendingChoice!.options[0]!); // card to return
    expect(r.state.players[0].hand).toHaveLength(2 + 2 - 1); // two drive checks + 2 drawn - 1
    r = then(r, attack(r.state, unitAt(r.state, 0, 'front_left'), unitAt(r.state, 1, 'vanguard')));
    r = answer(r, 'yes'); // the remaining two face-up damage are forced
    expect(r.state.players[0].hand).toHaveLength(4);
  });

  it("'BT01-055' Weather Girl, Milk: boosting an OTT vanguard with 4+ in hand gives +4000", () => {
    for (const [hand, total] of [
      [4, 10000 + 6000 + 4000],
      [3, 10000 + 6000],
    ] as const) {
      const s = scene({
        attacker: { circles: { vanguard: OTT_G2, back_center: 'BT01-055' }, hand: vanilla(hand) },
        defender: { circles: { vanguard: OPP_VG } },
      });
      const r = apply(
        s,
        attack(s, unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
      );
      expect(attackPower(r)).toBe(total);
    }
  });

  it("'BT01-027' Lozenge Magus / 'BT01-032' Battleraizer: +3000 boost, back to the deck at end phase", () => {
    for (const [card, vg] of [
      ['BT01-027', OTT_G2],
      ['BT01-032', NG_G2],
    ] as const) {
      const s = scene({
        attacker: { circles: { vanguard: vg, back_center: card }, deckTop: vanilla(2) },
        defender: { circles: { vanguard: OPP_VG }, hand: [RP_G1] },
      });
      const booster = unitAt(s, 0, 'back_center');
      let r = apply(s, attack(s, unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), booster));
      expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(10000 + 3000 + 3000);
      r = then(r, { type: 'PASS_GUARD', player: 1 });
      expect(r.state.activePlayer).toBe(1); // no more attackers: the turn ended
      expect(r.state.players[0].deck).toContain(booster);
    }
  });

  it("forerunners 'BT01-016' 'BT01-027' 'BT01-032' 'BT01-078': ridden by the same clan, may call", () => {
    for (const [card, rider] of [
      ['BT01-016', KAG_G1],
      ['BT01-027', OTT_G1],
      ['BT01-032', NG_G1],
      ['BT01-078', 'BT01-077'],
    ] as const) {
      const s = scene({
        at: 'ride',
        attacker: { circles: { vanguard: card }, hand: [rider] },
        defender: { circles: { vanguard: OPP_VG } },
      });
      let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, rider) });
      r = answer(r, 'yes');
      r = answer(r, 'back_left');
      expect(r.state.cards[r.state.players[0].circles.back_left[0]!]!.definitionId).toBe(card);
    }
  });
});

describe('Nova Grappler', () => {
  it("'BT01-008' Asura Kaiser: -2000 alone; a grade 3 Nova Grappler drive check stands a rear-guard", () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT01-008', front_left: NG_G1 },
        rested: ['front_left'],
        deckTop: ['BT01-028', ...vanilla(1)],
      },
      defender: { circles: { vanguard: OPP_VG } },
    });
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(11000); // Tough Boy is another Nova Grappler
    const r = apply(s, attack(s, unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
  });

  it("'BT01-028' Mr. Invincible: main phase SC1 and flip a damage card; SB8&CB5 stand all units on hit", () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'BT01-028', front_left: NG_G1 },
        damage: vanilla(5),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    soulOf(s, 0, 7);
    const flipped = s.players[0].damage[0]!;
    s.cards[flipped]!.faceUp = false;
    let r = apply(s, endPhase());
    r = answer(r, flipped);
    expect(r.state.cards[flipped]!.faceUp).toBe(true);
    const fl = unitAt(r.state, 0, 'front_left');
    r = then(r, endPhase(), attack(r.state, fl, unitAt(r.state, 1, 'vanguard')));
    r = then(r, attack(r.state, unitAt(r.state, 0, 'vanguard'), unitAt(r.state, 1, 'vanguard')));
    r = payCosts(answer(r, 'yes'));
    expect(r.state.cards[fl]!.orientation).toBe('stand');
    expect(r.state.cards[unitAt(r.state, 0, 'vanguard')]!.orientation).toBe('stand');
  });

  it("'BT01-029' Brutal Jack: Restraint until CB1; +5000 when boosted by a Nova Grappler", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT01-029', back_center: NG_G1 }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP_VG } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(legal(apply(s, endPhase()).state, 0, 'ATTACK')).toBeUndefined();
    let r = apply(s, activate(vg, '2'), endPhase());
    r = then(
      r,
      attack(r.state, vg, unitAt(r.state, 1, 'vanguard'), unitAt(r.state, 0, 'back_center')),
    );
    expect(attackPower(r)).toBe(11000 + 8000 + 5000);
  });

  it.each(['BT01-059', 'BT01-062'])(
    '%s: placed with a Nova Grappler vanguard, flip a damage card face up',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: NG_G2 }, hand: [card], damage: vanilla(2) },
        defender: { circles: { vanguard: OPP_VG } },
      });
      for (const id of s.players[0].damage) s.cards[id]!.faceUp = false;
      let r = apply(s, {
        type: 'CALL',
        player: 0,
        cardId: inHand(s, 0, card),
        circle: 'front_left',
      });
      r = answer(r, r.state.players[0].damage[0]!);
      expect(r.state.players[0].damage.filter((id) => r.state.cards[id]!.faceUp)).toHaveLength(1);
    },
  );
});

describe('other clans', () => {
  it("'BT01-009' Lohengrin / 'BT01-036' Demon Eater: SC1 +2000; SB8&CB5 retire all opponent rear-guards", () => {
    for (const card of ['BT01-009', 'BT01-036']) {
      const s = scene({
        at: 'ride',
        attacker: { circles: { vanguard: card }, damage: vanilla(5), deckTop: vanilla(3) },
        defender: { circles: { vanguard: 'BT01-080', front_left: RP_G1, back_left: RP_G1 } },
      });
      soulOf(s, 0, 7);
      const vg = unitAt(s, 0, 'vanguard');
      let r = apply(s, endPhase());
      expect(pw(r.state, vg)).toBe(12000);
      r = then(r, endPhase(), attack(r.state, vg, unitAt(r.state, 1, 'vanguard')));
      r = payCosts(answer(r, 'yes'));
      expect(r.state.players[1].drop).toHaveLength(2);
    }
  });

  it("'BT01-020' Juggernaut Maximum / 'BT01-074' Brakki: SB1 +5000, returned to the deck after the battle", () => {
    for (const card of ['BT01-020', 'BT01-074']) {
      const s = scene({
        attacker: { circles: { vanguard: KAG_G2, front_left: card } },
        defender: { circles: { vanguard: OPP_VG } },
      });
      put(s, 0, 'BT01-042', 'soul');
      const unit = unitAt(s, 0, 'front_left');
      let r = apply(s, attack(s, unit, unitAt(s, 1, 'vanguard')));
      r = answer(r, 'yes');
      r = answer(r, r.state.pendingChoice!.options[0]!); // which soul card
      expect(attackPower(r)).toBe(
        ctx.registry.get(card).power + 5000 - (card === 'BT01-020' ? 2000 : 0),
      );
      expect(r.state.players[0].deck).toContain(unit);
    }
  });

  it("'BT01-033' Tyrant, Deathrex: +5000 when attacking; retire one of your rear-guards on hit", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033', front_left: RP_G1 }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    const r = apply(s, attack(s, unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    expect(find(r.events, 'ATTACK_RESOLVED')[0]!.attackPower).toBe(15000);
    expect(r.state.players[0].drop).toEqual([unitAt(s, 0, 'front_left')]);
  });

  it("'BT01-034' Blightops: put into the drop zone from RC → CB1 search Shieldon", () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: KAG_G2, front_left: 'BT01-034' },
        hand: [RP_G1],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_VG } },
      extra: [['BT01-067'], []],
    });
    let r = apply(s, {
      type: 'CALL',
      player: 0,
      cardId: inHand(s, 0, RP_G1),
      circle: 'front_left',
    });
    r = answer(r, 'yes');
    r = answer(r, r.state.pendingChoice!.options[0]!);
    expect(r.state.players[0].hand.map((id) => r.state.cards[id]!.definitionId)).toEqual([
      'BT01-067',
    ]);
  });

  it("'BT01-035' Stealth Dragon, Voidmaster: +3000 with more cards; opponent discards when you have fewer", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-035' }, damage: vanilla(1), deckTop: vanilla(2) },
      defender: { circles: { vanguard: 'BT01-080' }, hand: [RP_G1, RP_G2, RP_G1] },
    });
    let r = apply(s, attack(s, unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    // the defender's grade 0 vanguard cannot guard with grade 1-2 cards: the guard step passes.
    // Two drive checks put 2 cards in hand, fewer than the opponent's 3: Voidmaster's ability.
    r = answer(r, 'yes');
    expect(actingPlayer(r.state)).toBe(1); // the opponent chooses what to discard
    r = answer(r, r.state.pendingChoice!.options[0]!);
    expect(r.state.players[1].drop).toHaveLength(1);
  });

  it("'BT01-069' Dreadmaster: a boosted Nubatama attack hits → CB1, opponent discards", () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT01-035', back_center: 'BT01-069' },
        damage: vanilla(1),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: 'BT01-080' }, hand: [RP_G2, RP_G2, RP_G2, RP_G2, RP_G1] },
    });
    let r = apply(
      s,
      attack(s, unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
    );
    // two "opponent discards" abilities trigger (Voidmaster and Dreadmaster): order, then pay
    while (r.state.pendingChoice) {
      const c = r.state.pendingChoice;
      r = answer(r, c.kind === 'yes_no' ? 'yes' : c.options[0]!);
    }
    expect(r.state.players[1].drop.length).toBeGreaterThanOrEqual(1);
    expect(
      find(r.events, 'ABILITY_RESOLVING').map((e) => r.state.cards[e.source]!.definitionId),
    ).toContain('BT01-069');
  });

  it("'BT01-070' Stealth Beast, Hagakure: guarding with a Nubatama vanguard and fewer cards → attacker discards", () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT01-033' },
        hand: [RP_G1, RP_G1, RP_G1],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: 'BT01-035' }, hand: ['BT01-070'], damage: vanilla(1) },
    });
    let r = apply(s, attack(s, unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT01-070') });
    r = answer(r, 'yes');
    expect(r.state.pendingChoice?.player).toBe(0); // the attacker chooses their own discard
    r = answer(r, r.state.pendingChoice!.options[0]!);
    expect(r.state.players[0].drop).toHaveLength(1);
  });

  it("'BT01-071' Blue Dust: hit with a Dark Irregulars vanguard → may Soul Charge 1", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-036', front_left: 'BT01-071' } },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    const soul = s.players[0].soul.length;
    let r = apply(s, attack(s, unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')));
    r = answer(r, 'yes');
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
  });

  it.each(['BT01-073', 'BT01-076'])(
    '%s: put into the drop zone from GC → into the soul',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
        defender: { circles: { vanguard: OPP_VG }, hand: [card, RP_G1] },
      });
      const guard = inHand(s, 1, card);
      let r = apply(s, attack(s, unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
      r = then(r, { type: 'GUARD', player: 1, cardId: guard }, { type: 'PASS_GUARD', player: 1 });
      expect(r.state.players[1].soul).toContain(guard);
    },
  );

  it("'BT01-037' Monster Frank: [ACT](Drop) CB3 with a grade 2 vanguard → ride it", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GB_G2 }, damage: vanilla(3) },
      defender: { circles: { vanguard: OPP_VG } },
      extra: [['BT01-037'], []],
    });
    const frank = put(s, 0, 'BT01-037', 'drop');
    const r = apply(s, activate(frank, '1'));
    expect(unitAt(r.state, 0, 'vanguard')).toBe(frank);
  });

  it("'BT01-039' Hell Spider / 'BT01-079' Karma Queen: chosen unit cannot stand next stand phase", () => {
    for (const [card, how] of [
      ['BT01-039', 'ride'],
      ['BT01-079', 'call'],
    ] as const) {
      const s = scene({
        at: how === 'ride' ? 'ride' : 'main',
        attacker: { circles: { vanguard: MC_G2 }, hand: [card], damage: vanilla(2) },
        defender: { circles: { vanguard: OPP_VG, front_left: RP_G1 }, rested: ['front_left'] },
      });
      const frozen = unitAt(s, 1, 'front_left');
      const cardId = inHand(s, 0, card);
      let r = apply(
        s,
        how === 'ride'
          ? { type: 'RIDE', player: 0, cardId }
          : { type: 'CALL', player: 0, cardId, circle: 'back_center' },
      );
      r = answer(r, 'yes');
      // to player 1's stand phase (from ride: ride → main → battle → no attack possible? end)
      while (r.state.activePlayer === 0) r = then(r, endPhase());
      expect(r.state.activePlayer).toBe(1);
      expect(r.state.cards[frozen]!.orientation).toBe('rest');
      expect(r.state.restrictions).toEqual([]);
    }
  });

  it("'BT01-039' Hell Spider: +3000 during your turn while all opponent units are resting", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-039' } },
      defender: {
        circles: { vanguard: OPP_VG, front_left: RP_G1 },
        rested: ['vanguard', 'front_left'],
      },
    });
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(13000);
  });

  it("'BT01-078' Guiding Zombie: [put into soul] the top three cards go to the drop zone", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GB_G2, front_left: 'BT01-078' } },
      defender: { circles: { vanguard: OPP_VG } },
    });
    const top3 = s.players[0].deck.slice(0, 3);
    const r = apply(s, activate(unitAt(s, 0, 'front_left'), '2'));
    expect(r.state.players[0].drop).toEqual(top3);
    expect(r.state.players[0].soul).toContain(unitAt(s, 0, 'front_left'));
  });
});
