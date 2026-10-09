/**
 * BT02 card tests: every card with abilities is named here at least once (cards:report).
 */
import { describe, expect, it } from 'vitest';
import {
  currentPower,
  getLegalActions,
  type Command,
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
): Command => ({
  type: 'CALL',
  player: 0,
  cardId,
  circle,
});
const endPhase = (p: PlayerId = 0): Command => ({ type: 'END_PHASE', player: p });
const defOf = (s: GameState, id: string) => s.cards[id]!.definitionId;
function put(s: GameState, p: PlayerId, def: string, zone: 'soul' | 'drop'): string {
  const pl = s.players[p];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl[zone].push(id);
  s.cards[id]!.faceUp = true;
  return id;
}
const fillSoul = (s: GameState, p: PlayerId, n: number) => {
  const pl = s.players[p];
  const moved = pl.deck.splice(pl.deck.length - n, n);
  pl.soul.push(...moved);
};
const attackPower = (r: { events: Parameters<typeof find>[0] }) =>
  find(r.events, 'ATTACK_RESOLVED')[0]!.attackPower;
const payCosts = (r: ReturnType<typeof apply>) => {
  while (r.state.pendingChoice?.kind === 'cost') {
    r = answer(r, ...r.state.pendingChoice.options.slice(0, r.state.pendingChoice.min));
  }
  return r;
};

// bodies (vanilla units)
const RP_G1 = 'BT01-042';
const RP_G2 = 'BT01-021';
const KAG_G2 = 'BT01-022';
const OTT_G2 = 'BT01-026';
const NG_G2 = 'BT01-030';
const GB_G2 = 'BT01-038';
const MC_G2 = 'BT01-040';
const TK_G1 = 'BT01-066';
const SB_G2 = 'BT02-022';
const BT_G2 = 'BT02-036';
const GN_G2 = 'BT02-040';
const GN_G1 = 'BT02-079';
const MC_G1 = 'BT02-077';
const OPP = 'BT01-038';

describe('shared shapes', () => {
  it.each([
    ['BT02-010', SB_G2, 'BT02-022'],
    ['BT02-014', GB_G2, 'BT01-038'],
    ['BT02-019', NG_G2, 'BT01-030'],
  ])('perfect guard %s', (pg, vg, discardDef) => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: vg }, hand: [pg, discardDef, discardDef] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, pg) });
    r = answer(r, 'yes');
    r = answer(r, r.state.pendingChoice!.options[0]!);
    r = then(r, { type: 'PASS_GUARD', player: 1 });
    expect(find(r.events, 'ATTACK_RESOLVED')[0]!.hit).toBe(false);
  });

  it.each([
    ['BT02-041', SB_G2],
    ['BT02-049', GB_G2],
    ['BT02-056', RP_G2],
    ['BT02-060', KAG_G2],
    ['BT02-065', OTT_G2],
    ['BT02-071', NG_G2],
  ])('%s intercepts with +5000 shield (clan vanguard)', (card, vg) => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: vg, front_left: card }, hand: [RP_G1] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'INTERCEPT', player: 1, unitId: unitAt(s, 1, 'front_left') });
    r = then(r, { type: 'PASS_GUARD', player: 1 });
    expect(find(r.events, 'ATTACK_RESOLVED')[0]!.defensePower).toBe(10000 + 5000 + 5000);
  });

  it.each([
    ['BT02-025', GB_G2],
    ['BT02-033', OTT_G2],
    ['BT02-037', BT_G2],
  ])('%s: placed on RC with a clan vanguard, SB2 to draw', (card, vg) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg }, hand: [card] },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 1); // starter + 1 = exactly two soul cards
    let r = apply(s, call(inHand(s, 0, card), 'back_left'));
    r = answer(r, 'yes');
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].soul).toHaveLength(0);
  });

  it.each([
    ['BT02-055', GB_G2],
    ['BT02-068', OTT_G2],
  ])('%s: [into soul] draw up to one', (card, vg) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg, back_left: card } },
      defender: { circles: { vanguard: OPP } },
    });
    let r = apply(s, activate(unitAt(s, 0, 'back_left')));
    r = answer(r, '1');
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it.each([
    ['BT02-048', SB_G2],
    ['BT02-074', NG_G2],
  ])('%s: [into soul] turn a damage card face up', (card, vg) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg, back_left: card }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const dmg = s.players[0].damage[0]!;
    s.cards[dmg]!.faceUp = false;
    let r = apply(s, activate(unitAt(s, 0, 'back_left')));
    r = answer(r, dmg);
    expect(r.state.cards[dmg]!.faceUp).toBe(true);
  });

  it.each(['BT02-057', 'BT02-061'])('%s: CB1 for +1000', (card) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: RP_G2, front_left: card }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const r = apply(s, activate(unitAt(s, 0, 'front_left')));
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(8000);
  });

  it.each([
    ['BT02-044', SB_G2],
    ['BT02-072', NG_G2],
  ])('%s: stands again when the boosted attack hits', (card, attackerDef) => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033', front_left: attackerDef, back_left: card } },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    const booster = unitAt(s, 0, 'back_left');
    const r = apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), booster));
    expect(r.state.cards[booster]!.orientation).toBe('stand');
  });

  it("'BT02-018' Magician Girl, Kirara: CB2 draw on hit with a Nova Grappler vanguard", () => {
    const s = scene({
      attacker: { circles: { vanguard: NG_G2, front_left: 'BT02-018' }, damage: vanilla(2) },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    const r = answer(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))), 'yes');
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it("'BT02-005' Blazing Flare Dragon + 'BT02-016' Sutherland: +3000 each when an opponent rear-guard is retired in your main phase", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT02-005', front_left: 'BT02-016' } },
      defender: { circles: { vanguard: OPP, front_left: RP_G1 } },
    });
    fillSoul(s, 0, 4);
    let r = payCosts(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    while (r.state.pendingChoice?.kind === 'order_abilities') {
      r = answer(r, r.state.pendingChoice.options[0]!); // both trigger on the retire
    }
    expect(r.state.players[1].drop).toContain(unitAt(s, 1, 'front_left'));
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(13000);
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(11000);
  });

  it("'BT02-015' Young Pegasus Knight / 'BT02-028' Barron + 'BT02-059' Margal: +3000 when a card goes to the soul", () => {
    for (const card of ['BT02-015', 'BT02-028']) {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: RP_G2, front_left: card, back_left: 'BT02-059' } },
        defender: { circles: { vanguard: OPP } },
      });
      let r = apply(s, activate(unitAt(s, 0, 'back_left')));
      r = answer(r, unitAt(s, 0, 'vanguard')); // Margal: up to one Royal Paladin gets +3000
      expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(ctx.registry.get(card).power + 3000);
    }
  });

  it.each(['BT02-034', 'BT02-035'])(
    '%s: retired from RC with a Tachikaze vanguard → CB1 back to hand',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: TK_G1, front_left: card },
          hand: [TK_G1],
          damage: vanilla(1),
        },
        defender: { circles: { vanguard: OPP } },
      });
      const unit = unitAt(s, 0, 'front_left');
      const r = answer(apply(s, call(inHand(s, 0, TK_G1), 'front_left')), 'yes');
      expect(r.state.players[0].hand).toContain(unit);
    },
  );

  it("'BT02-027' Gigantech Charger / 'BT02-042' Devil Summoner: reveal the top card and call it if it matches", () => {
    for (const [card, vg, top] of [
      ['BT02-027', RP_G2, RP_G1],
      ['BT02-042', SB_G2, 'BT02-043'],
    ] as const) {
      const s = scene({
        at: card === 'BT02-027' ? 'ride' : 'main',
        attacker: { circles: { vanguard: vg }, hand: [card], deckTop: [top] },
        defender: { circles: { vanguard: OPP } },
      });
      const topId = s.players[0].deck[0]!;
      const play: Command =
        card === 'BT02-027'
          ? { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) }
          : call(inHand(s, 0, card), 'front_left');
      let r = apply(s, play);
      r = answer(r, 'back_left');
      expect(r.state.players[0].circles.back_left).toEqual([topId]);
    }
    const miss = scene({
      at: 'ride',
      attacker: { circles: { vanguard: RP_G2 }, hand: ['BT02-027'], deckTop: [KAG_G2] },
      defender: { circles: { vanguard: OPP } },
    });
    const r2 = apply(miss, { type: 'RIDE', player: 0, cardId: inHand(miss, 0, 'BT02-027') });
    expect(find(r2.events, 'DECK_SHUFFLED')).toHaveLength(1);
  });

  it("'BT02-039' Scientist Monkey Rue / 'BT02-080' Intelli-mouse: +4000 now, retired at the end phase", () => {
    for (const card of ['BT02-039', 'BT02-080']) {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: GN_G2, back_left: card, front_right: GN_G1 },
          damage: vanilla(2),
        },
        defender: { circles: { vanguard: OPP } },
      });
      const src = card === 'BT02-039' ? unitAt(s, 0, 'back_left') : unitAt(s, 0, 'back_left');
      const target = unitAt(s, 0, 'front_right');
      let r = apply(s, activate(src));
      if (r.state.pendingChoice) r = answer(r, target);
      expect(pw(r.state, target)).toBe(12000);
      r = then(r, endPhase(), endPhase());
      expect(r.state.players[0].drop).toContain(target);
    }
  });

  it("'BT02-062' Follower, Reas boosts 'BT02-016' Chain-attack Sutherland for +4000", () => {
    const s = scene({
      attacker: { circles: { vanguard: KAG_G2, front_left: 'BT02-016', back_left: 'BT02-062' } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = apply(
      s,
      attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
    );
    expect(attackPower(r)).toBe(8000 + 6000 + 4000);
  });

  it("'BT02-076' Lady Bomb freezes; 'BT02-078' Megacolony Battler A goes to the soul from GC", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: MC_G2 }, hand: ['BT02-076'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: RP_G1 }, rested: ['front_left'] },
    });
    let r = answer(apply(s, call(inHand(s, 0, 'BT02-076'), 'back_center')), 'yes');
    r = then(r, endPhase(), endPhase());
    expect(r.state.cards[unitAt(s, 1, 'front_left')]!.orientation).toBe('rest');

    const g = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: MC_G2 }, hand: ['BT02-078', MC_G1] },
    });
    const guard = inHand(g, 1, 'BT02-078');
    let r2 = apply(g, attack(unitAt(g, 0, 'vanguard'), unitAt(g, 1, 'vanguard')));
    r2 = then(r2, { type: 'GUARD', player: 1, cardId: guard }, { type: 'PASS_GUARD', player: 1 });
    expect(r2.state.players[1].soul).toContain(guard);
  });
});

describe('individual cards', () => {
  it("'BT02-001' Sky Diver: hit → into soul, call a Spike Brothers from hand", () => {
    const s = scene({
      attacker: { circles: { vanguard: SB_G2, front_left: 'BT02-001' }, hand: [SB_G2] },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    let r = answer(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))), 'yes');
    r = answer(r, inHand(r.state, 0, SB_G2));
    r = answer(r, 'front_left');
    expect(defOf(r.state, unitAt(r.state, 0, 'front_left'))).toBe(SB_G2);
  });

  it("'BT02-002' Spirit Exceed: from the drop zone, ride by putting the two Spirits into the soul", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GB_G2, front_left: 'BT02-050', back_left: 'BT02-052' } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT02-002'], []],
    });
    const exceed = put(s, 0, 'BT02-002', 'drop');
    const r = apply(s, activate(exceed));
    expect(unitAt(r.state, 0, 'vanguard')).toBe(exceed);
  });

  it("'BT02-003' Ruin Shade: mill two for +2000 when attacking", () => {
    const s = scene({
      attacker: { circles: { vanguard: GB_G2, front_left: 'BT02-003' } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = answer(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))), 'yes');
    expect(attackPower(r)).toBe(11000);
    expect(r.state.players[0].drop).toHaveLength(2);
  });

  it("'BT02-004' Soul Saver Dragon: SB5 on ride, up to three RP rear-guards +5000; +3000 attacking a vanguard", () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: RP_G2, front_left: RP_G1 },
        hand: ['BT02-004'],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 4);
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT02-004') });
    r = payCosts(answer(r, 'yes'));
    r = answer(r, unitAt(s, 0, 'front_left'));
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(13000);
    r = then(
      r,
      endPhase(),
      endPhase(),
      attack(unitAt(r.state, 0, 'vanguard'), unitAt(r.state, 1, 'vanguard')),
    );
    expect(attackPower(r)).toBe(13000);
  });

  it("'BT02-006' Seal Dragon, Blockade: the opponent cannot intercept during your turn", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT02-006' } },
      defender: { circles: { vanguard: OPP, front_left: RP_G2 }, hand: [RP_G1] },
    });
    const r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    expect(legal(r.state, 1, 'INTERCEPT')).toBeUndefined();
  });

  it("'BT02-007' Scarlet Witch, CoCo: CB2 draw up to two with ≤1 soul; +3000 with an empty soul", () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: OTT_G2 }, hand: ['BT02-007'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    s.players[0].drop.push(...s.players[0].soul.splice(0)); // after the ride: soul = OTT_G2 only
    let r = answer(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT02-007') }), 'yes');
    r = answer(r, '2');
    expect(r.state.players[0].hand).toHaveLength(2);
    const empty = structuredClone(r.state);
    empty.players[0].drop.push(...empty.players[0].soul.splice(0));
    expect(pw(empty, unitAt(empty, 0, 'vanguard'))).toBe(13000);
  });

  it("'BT02-008' Lion Heat: hitting a vanguard, CB2 stands a Nova Grappler rear-guard", () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT02-008', front_left: NG_G2 },
        rested: ['front_left'],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    const r = answer(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), 'yes');
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
  });

  it("'BT02-009' General Seifried: a grade 3 Spike Brothers drive check may be called to an open RC", () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT02-009', front_left: SB_G2 },
        deckTop: ['BT02-001', ...vanilla(1)],
      },
      defender: { circles: { vanguard: OPP } },
    });
    let r = answer(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), 'yes');
    expect(r.state.pendingChoice?.options).not.toContain('front_left');
    r = answer(r, 'back_left');
    expect(defOf(r.state, unitAt(r.state, 0, 'back_left'))).toBe('BT02-001');
  });

  it("'BT02-011' Basskirk: SB8&CB5 call up to five Granblue from the drop zone to separate circles", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT02-011' }, damage: vanilla(5) },
      defender: { circles: { vanguard: OPP } },
      extra: [[GB_G2], []],
    });
    fillSoul(s, 0, 7);
    const a = put(s, 0, GB_G2, 'drop');
    const b = put(s, 0, GB_G2, 'drop');
    let r = payCosts(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    r = answer(r, a, b);
    r = answer(r, 'front_left');
    expect(r.state.pendingChoice!.options).not.toContain('front_left');
    r = answer(r, 'front_right');
    expect(r.state.players[0].circles.front_left).toEqual([a]);
    expect(r.state.players[0].circles.front_right).toEqual([b]);
  });

  it("'BT02-012' Negromarl: CB2 call a card from the drop zone", () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: GB_G2 }, hand: ['BT02-012'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT01-042'], []],
    });
    const target = put(s, 0, 'BT01-042', 'drop');
    let r = answer(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT02-012') }), 'yes');
    r = answer(r, 'back_left');
    expect(r.state.players[0].circles.back_left).toEqual([target]);
  });

  it("'BT02-013' Captain Nightmist / 'BT02-050' Samurai Spirit: call themselves back from the drop zone", () => {
    for (const card of ['BT02-013', 'BT02-050']) {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: GB_G2, front_left: 'BT01-077' }, damage: vanilla(1) },
        defender: { circles: { vanguard: OPP } },
        extra: [[card], []],
      });
      const id = put(s, 0, card, 'drop');
      let r = apply(s, activate(id, card === 'BT02-013' ? '2' : '1'));
      r = answer(r, 'back_left');
      expect(r.state.players[0].circles.back_left).toEqual([id]);
    }
    const vc = scene({
      attacker: { circles: { vanguard: 'BT02-013' } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT02-013'], []],
    });
    put(vc, 0, 'BT02-013', 'drop');
    expect(pw(vc, unitAt(vc, 0, 'vanguard'))).toBe(11000);
  });

  it("'BT02-017' Silent Tom: while it attacks, the opponent cannot guard with grade 0", () => {
    const s = scene({
      attacker: { circles: { vanguard: OTT_G2, front_left: 'BT02-017' } },
      defender: { circles: { vanguard: OPP }, hand: ['BT01-045', RP_G1] },
    });
    const r = apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')));
    expect(legal(r.state, 1, 'GUARD')!.cardIds.map((id) => defOf(r.state, id))).toEqual([RP_G1]);
  });

  it("'BT02-020' Top Idol, Flores: SB2 on hit, return a Bermuda Triangle rear-guard to hand", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT02-020', back_left: BT_G2 }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    fillSoul(s, 0, 1);
    const r = answer(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), 'yes');
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'back_left'));
  });

  it("'BT02-021' Unite Attacker: SB8&CB5 on hit, call Spike Brothers from the top five", () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT02-021' },
        damage: vanilla(5),
        deckTop: [...vanilla(2), SB_G2, KAG_G2, SB_G2],
      },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    fillSoul(s, 0, 7);
    let r = payCosts(
      answer(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), 'yes'),
    );
    const options = r.state.pendingChoice!.options;
    expect(options.map((id) => defOf(r.state, id))).toEqual([SB_G2, SB_G2]);
    r = answer(r, ...options);
    r = answer(r, 'front_left');
    r = answer(r, 'front_right');
    expect(r.state.players[0].circles.front_right).toHaveLength(1);
  });

  it("'BT02-023' Dudley Dan: boosting the vanguard, CB2 + a card to soul → call a Spike Brothers to an open RC", () => {
    const s = scene({
      attacker: {
        circles: { vanguard: SB_G2, back_center: 'BT02-023' },
        hand: [SB_G2],
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, hand: [RP_G1] },
    });
    let r = answer(
      apply(
        s,
        attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
      ),
      'yes',
    );
    r = answer(r, r.state.pendingChoice!.options[0]!);
    r = answer(r, 'front_left');
    expect(r.state.players[0].circles.front_left).toHaveLength(1);
  });

  it("'BT02-024' Mecha Trainer: forerunner and [CB1 & retire] search", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: SB_G2, front_left: 'BT02-024' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    let r = apply(s, activate(unitAt(s, 0, 'front_left'), '2'));
    r = answer(r, r.state.pendingChoice!.options[0]!);
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it("'BT02-026' Chappie the Ghostie: placed on GC → a Granblue from the deck into the drop zone", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: GB_G2 }, hand: ['BT02-026', RP_G1] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT02-026') });
    r = answer(r, r.state.pendingChoice!.options[0]!);
    expect(
      r.state.players[1].drop.map((id) => ctx.registry.get(defOf(r.state, id)).clan),
    ).toContain('Granblue');
  });

  it("'BT02-029' High Dog Breeder, Akane: CB2 call a Royal Paladin High Beast from the deck", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: RP_G2 }, hand: ['BT02-029'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT01-044'], []],
    });
    let r = answer(apply(s, call(inHand(s, 0, 'BT02-029'), 'front_left')), 'yes');
    expect(
      r.state.pendingChoice!.options.every(
        (id) => ctx.registry.get(defOf(r.state, id)).race === 'High Beast',
      ),
    ).toBe(true);
    r = answer(r, r.state.pendingChoice!.options[0]!);
    r = answer(r, 'back_left');
    expect(r.state.players[0].circles.back_left).toHaveLength(1);
  });

  it("'BT02-030' Pongal: [CB1 & into soul] search Soul Saver Dragon", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: RP_G2, back_left: 'BT02-030' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT02-004'], []],
    });
    let r = apply(s, activate(unitAt(s, 0, 'back_left')));
    r = answer(r, r.state.pendingChoice!.options[0]!);
    expect(r.state.players[0].hand.map((id) => defOf(r.state, id))).toEqual(['BT02-004']);
  });

  it("'BT02-031' Blazing Core Dragon: Iron Tail + Gattling Claw into the soul → ride Blazing Flare", () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT02-031', front_left: 'BT02-061', back_left: 'BT02-064' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT02-005'], []],
    });
    let r = apply(s, activate(unitAt(s, 0, 'vanguard')));
    r = answer(r, r.state.pendingChoice!.options[0]!);
    expect(defOf(r.state, unitAt(r.state, 0, 'vanguard'))).toBe('BT02-005');
  });

  it("'BT02-032' Kimnara / 'BT02-064' Gattling Claw: retire an opponent grade 1 / grade 0 rear-guard", () => {
    for (const [card, victim] of [
      ['BT02-032', RP_G1],
      ['BT02-064', 'BT01-067'],
    ] as const) {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: KAG_G2, back_left: card }, damage: vanilla(1) },
        defender: { circles: { vanguard: OPP, front_left: victim } },
      });
      let r = apply(s, activate(unitAt(s, 0, 'back_left')));
      if (r.state.pendingChoice) r = answer(r, r.state.pendingChoice.options[0]!);
      expect(r.state.players[1].drop).toContain(unitAt(s, 1, 'front_left'));
    }
  });

  it("'BT02-038' Master Fraude: +3000 boosted by a Megacolony; SB3 draw on hit", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT02-038', back_center: MC_G1 }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: 'BT01-080' } },
    });
    fillSoul(s, 0, 2);
    let r = apply(
      s,
      attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
    );
    expect(attackPower(r)).toBe(10000 + 8000 + 3000);
    r = answer(r, 'yes');
    expect(r.state.players[0].hand).toHaveLength(3);
  });

  it("'BT02-043' Cyclone Blitz / 'BT02-066' One Who Gazes: SB1 +3000 when attacking", () => {
    for (const [card, vg] of [
      ['BT02-043', SB_G2],
      ['BT02-066', OTT_G2],
    ] as const) {
      const s = scene({
        attacker: { circles: { vanguard: vg, front_left: card } },
        defender: { circles: { vanguard: OPP } },
      });
      const r = answer(
        apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))),
        'yes',
      );
      expect(attackPower(r)).toBe(9000);
    }
  });

  it("'BT02-051' Evil Shade: mill two, the boosted Granblue vanguard gets +4000", () => {
    const s = scene({
      attacker: { circles: { vanguard: GB_G2, back_center: 'BT02-051' } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = answer(
      apply(
        s,
        attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
      ),
      'yes',
    );
    expect(attackPower(r)).toBe(10000 + 6000 + 4000);
  });

  it("'BT02-069' Chaos Dragon, Dinochaos: retire two Tachikaze rear-guards, ride from hand", () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT01-034', front_left: TK_G1, back_left: TK_G1 },
        hand: ['BT02-069'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const dino = inHand(s, 0, 'BT02-069');
    let r = apply(s, activate(dino));
    while (r.state.pendingChoice)
      r = answer(
        r,
        r.state.pendingChoice.kind === 'yes_no' ? 'yes' : r.state.pendingChoice.options[0]!,
      );
    expect(unitAt(r.state, 0, 'vanguard')).toBe(dino);
  });

  it("'BT02-070' Cannon Gear: placed → retire one of your rear-guards; +2000 boosted by Tachikaze", () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: TK_G1, front_left: TK_G1, back_center: TK_G1 },
        hand: ['BT02-070'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT02-070') });
    r = answer(r, unitAt(s, 0, 'front_left'));
    expect(r.state.players[0].drop).toContain(unitAt(s, 0, 'front_left'));
    r = then(
      r,
      endPhase(),
      endPhase(),
      attack(
        unitAt(r.state, 0, 'vanguard'),
        unitAt(r.state, 1, 'vanguard'),
        unitAt(r.state, 0, 'back_center'),
      ),
    );
    expect(attackPower(r)).toBe(11000 + 8000 + 2000);
  });

  it("'BT02-075' Blazer Idols: placed → another Bermuda Triangle gets +2000", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: BT_G2 }, hand: ['BT02-075'] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = apply(s, call(inHand(s, 0, 'BT02-075'), 'back_left'));
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(12000);
  });
});
