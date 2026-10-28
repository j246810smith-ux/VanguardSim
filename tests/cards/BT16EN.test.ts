/**
 * English-only cards of English BT16 (DECISIONS D-031) and the Delete rule they bring (CR 1.36
 * 10.1.25). Every card with abilities is named here at least once (cards:report).
 */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState, type PlayerId } from '../../src/engine';
import { abilitiesOf } from '../../src/engine/abilities/catalog';
import { andThen as then, apply, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import { activate, attack, boosts, drain, field, inHand, legal } from '../fixtures/cardTest';
import {
  attackPumps,
  callIt,
  deckOf,
  interceptShieldOf,
  legionAttack,
  legionUp,
  OPP,
  OPP_G1,
  OPP_G3,
  pw,
  unitAt,
} from '../fixtures/shapeChecks';
import { faceDown, pull, settle, stock } from '../fixtures/setHelpers';

const ZAELE = 'BT16-008EN'; // Juxtapose Deletor, Zaele: when it legions, [CB2 & discard] delete
const GAELE = 'BT16-046EN'; // its mate
const OKSIZZ = 'BT16-009EN';
const RP_G1 = 'BT01-042'; // vanilla Royal Paladin grade 1

/** Zaele legions with Gaele and pays to delete the opponent's vanguard (King of Knights, Alfred). */
function deleteAlfred(
  opts: { oppField?: NonNullable<Parameters<typeof legionUp>[2]>['oppField'] } = {},
) {
  const { s, r } = legionUp(ZAELE, GAELE, {
    ...(opts.oppField ? { oppField: opts.oppField } : {}),
    before: (st) => {
      stock(st, 'damage', OPP, 2);
      stock(st, 'hand', OPP, 1);
    },
  });
  return { s, r, alfred: unitAt(s, 1, 'vanguard') };
}

/** End phases until it is `player`'s `phase` (the other player's turn passes with no actions). */
function advanceTo(r: Run, player: PlayerId, phase: GameState['phase']): Run {
  for (let i = 0; i < 30; i++) {
    if (r.state.pendingChoice?.player === 0) r = drain(r);
    if (legal(r.state, 1, 'PASS_GUARD')) r = then(r, { type: 'PASS_GUARD', player: 1 });
    if (r.state.activePlayer === player && r.state.phase === phase) return r;
    if (r.state.pendingChoice) return r;
    r = then(r, { type: 'END_PHASE', player: r.state.activePlayer });
  }
  throw new Error(`advanceTo: never reached ${player} ${phase}`);
}

describe('Delete (CR 10.1.25)', () => {
  it('a deleted vanguard keeps its name and critical, has power 0 and no printed text', () => {
    const { r, alfred } = deleteAlfred({ oppField: { front_left: RP_G1, front_right: RP_G1 } });
    const s = r.state;
    expect(s.cards[alfred]!.deleted).toBe(true);
    expect(find(r.events, 'CARD_DELETED').map((e) => e.instanceId)).toEqual([alfred]);
    expect(pw(s, alfred)).toBe(0);
    expect(currentCritical(s, ctx, alfred)).toBe(1);
    expect(abilitiesOf(s, ctx, alfred)).toEqual([]);
  });

  it('effects on the unit still apply (10.1.25.8): Alfred with +2000 from an effect has 2000', () => {
    const { r, alfred } = deleteAlfred();
    const s = structuredClone(r.state);
    s.modifiers.push({
      id: 9999,
      target: alfred,
      stat: 'power',
      amount: 2000,
      until: 'end_of_turn',
    } as never);
    expect(pw(s, alfred)).toBe(2000);
  });

  it("returns to normal in its owner's end phase, not in the deleting player's", () => {
    const { r, alfred } = deleteAlfred();
    const afterMine = advanceTo(r, 1, 'main');
    expect(afterMine.state.cards[alfred]!.deleted).toBe(true);
    const afterTheirs = advanceTo(afterMine, 0, 'main');
    expect(afterTheirs.state.cards[alfred]!.deleted).toBeUndefined();
    expect(find(afterTheirs.events, 'CARD_UNDELETED').map((e) => e.instanceId)).toEqual([alfred]);
    expect(pw(afterTheirs.state, alfred)).toBe(10000);
  });

  it('a deleted vanguard that is ridden goes to the soul as a normal card (10.1.25.11)', () => {
    const { r, alfred } = deleteAlfred();
    let t = advanceTo(r, 1, 'ride');
    const g3 = t.state.players[1].hand.find((id) => t.state.cards[id]!.definitionId === OPP_G3);
    if (!g3) {
      // give the opponent a grade 3 to ride with
      const id = t.state.players[1].deck.find((x) => t.state.cards[x]!.definitionId === OPP_G3)!;
      t.state.players[1].deck.splice(t.state.players[1].deck.indexOf(id), 1);
      t.state.players[1].hand.push(id);
    }
    const rider = t.state.players[1].hand.find((id) => t.state.cards[id]!.definitionId === OPP_G3)!;
    t = settle(then(t, { type: 'RIDE', player: 1, cardId: rider }));
    expect(t.state.players[1].soul).toContain(alfred);
    expect(t.state.cards[alfred]!.deleted).toBeUndefined();
  });

  it('a deleted unit can still attack and guard, as a 0-power unit (10.1.25.4)', () => {
    const { r, alfred } = deleteAlfred();
    const t = advanceTo(r, 1, 'battle');
    const atk = legal(t.state, 1, 'ATTACK');
    expect(atk?.options.some((o) => o.attacker === alfred)).toBe(true);
  });
});

describe('BT16 English-only: Link Joker (Deletors)', () => {
  it('BT16-008EN Zaele: when it legions, [CB2 & discard] deletes all of the opponent’s vanguards; +2000 attacking a vanguard', () => {
    const { r, alfred } = deleteAlfred();
    expect(r.state.cards[alfred]!.deleted).toBe(true);
    expect(faceDown(r.state)).toBe(2);
    expect(attackPumps(ZAELE, 2000)).toBe(1);
  });

  it('BT16-009EN Oksizz: [CB3 Deletor & a rear-guard to soul] deletes and gets +10000; the opponent must discard or skip the normal ride', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OKSIZZ, front_left: OPP } },
      defender: { circles: { vanguard: OPP_G3 }, hand: [OPP_G1, OPP_G3] },
    });
    stock(s, 'damage', OKSIZZ, 3); // "Deletor" in the name, for the Counter-Blast
    const vg = unitAt(s, 0, 'vanguard');
    const alfred = unitAt(s, 1, 'vanguard');
    let r = drain(apply(s, activate(vg, '1')));
    expect(r.state.cards[alfred]!.deleted).toBe(true);
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(r.state.players[0].soul.length).toBe(2);
    // the opponent's ride phase: they decline to discard, so they cannot normal ride
    r = advanceTo(r, 1, 'ride');
    const c = r.state.pendingChoice!;
    expect(c.player).toBe(1);
    r = then(r, { type: 'CHOOSE', player: 1, choiceId: c.id, selection: [] });
    expect(legal(r.state, 1, 'RIDE')).toBeUndefined();
  });

  it('BT16-009EN Oksizz: discarding a card keeps the normal ride', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OKSIZZ, front_left: OPP } },
      defender: { circles: { vanguard: OPP_G3 }, hand: [OPP_G1, OPP_G3] },
    });
    stock(s, 'damage', OKSIZZ, 3);
    let r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')));
    r = advanceTo(r, 1, 'ride');
    expect(r.state.pendingChoice?.player).toBe(1);
    r = drain(r, 1);
    expect(legal(r.state, 1, 'RIDE')).toBeDefined();
  });

  it('BT16-046EN Gaele: placed on (RC) while the opponent’s vanguard is deleted, locks a front-row rear-guard', () => {
    const run = (deleted: boolean) =>
      callIt(GAELE, {
        vanguard: ZAELE,
        oppField: { front_left: OPP },
        before: (st) => {
          if (deleted) st.cards[unitAt(st, 1, 'vanguard')]!.deleted = true;
        },
      }).r.state;
    const locked = (st: GameState) => st.cards[unitAt(st, 1, 'front_left')]!.locked;
    expect(locked(run(true))).toBe(true);
    expect(locked(run(false))).toBe(false);
  });

  it('BT16-048EN Guim / BT16-116EN Iggy: a hit on a deleted vanguard locks a front-row rear-guard', () => {
    for (const [card, on] of [
      ['BT16-048EN', 'booster'],
      ['BT16-116EN', 'front_left'],
    ] as const) {
      const s = scene({
        attacker: {
          circles: {
            vanguard: ZAELE,
            front_left: on === 'booster' ? OPP : card,
            ...(on === 'booster' ? { back_left: card } : {}),
          },
        },
        defender: { circles: { vanguard: OPP_G3, front_right: OPP }, deckTop: vanilla(2) },
      });
      s.cards[unitAt(s, 1, 'vanguard')]!.deleted = true;
      const booster = on === 'booster' ? unitAt(s, 0, 'back_left') : null;
      const r = settle(
        apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), booster)),
      );
      expect(r.state.cards[unitAt(s, 1, 'front_right')]!.locked).toBe(true);
    }
  });

  it('BT16-049EN Gunec: placed on (RC), [SB2] draws a card', () => {
    const { s, r } = callIt('BT16-049EN', { vanguard: ZAELE, soul: 2 });
    expect(r.state.players[0].hand.length).toBe(s.players[0].hand.length);
    expect(r.state.players[0].soul.length).toBe(s.players[0].soul.length - 2);
  });

  it('BT16-050EN Igor / BT16-120EN Progue: react to the opponent’s vanguard being deleted', () => {
    const { r } = legionUp(ZAELE, GAELE, {
      others: { back_left: 'BT16-050EN', back_right: 'BT16-120EN' },
      before: (st) => {
        stock(st, 'damage', OPP, 2);
        stock(st, 'hand', OPP, 1);
      },
    });
    const s = r.state;
    // Igor went to the soul, drew and counter-charged; Progue got +2000
    expect(field(s, 0)).not.toContain('BT16-050EN');
    expect(s.players[0].soul.some((id) => s.cards[id]!.definitionId === 'BT16-050EN')).toBe(true);
    expect(faceDown(s)).toBe(1);
    const progue = Object.values(s.players[0].circles)
      .flat()
      .find((id) => s.cards[id]!.definitionId === 'BT16-120EN')!;
    expect(boosts(r, progue, 2000)).toBe(1);
  });

  it('BT16-113EN Lourelou: a grade 3 drive check gives an end-of-battle [retire a grade 3 Deletor] delete', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT16-113EN', front_left: 'BT16-117EN' },
        deckTop: [OPP_G3, OPP],
      },
      defender: { circles: { vanguard: OPP_G3 }, deckTop: vanilla(2) },
    });
    const alfred = unitAt(s, 1, 'vanguard');
    const r = settle(apply(s, attack(unitAt(s, 0, 'vanguard'), alfred)));
    expect(r.state.cards[alfred]!.deleted).toBe(true);
    expect(
      r.state.players[0].drop.some((id) => r.state.cards[id]!.definitionId === 'BT16-117EN'),
    ).toBe(true);
    expect(attackPumps('BT16-113EN', 3000)).toBe(1);
  });

  it('BT16-117EN Gaon: +10000 on (VC) against 12000 or more; +2000 on (RC) attacking a vanguard', () => {
    expect(
      attackPumps('BT16-117EN', 10000, {
        oppVanguard: OPP_G3,
        before: (st) =>
          st.modifiers.push({
            id: 9998,
            target: unitAt(st, 1, 'vanguard'),
            stat: 'power',
            amount: 2000,
            until: 'end_of_turn',
          } as never),
      }),
    ).toBe(1);
    expect(attackPumps('BT16-117EN', 10000, { oppVanguard: OPP_G3 })).toBe(0);
    expect(attackPumps('BT16-117EN', 2000, { on: 'front_left' })).toBe(1);
  });

  it('BT16-124EN Boroh: boosting Oksizz against a deleted vanguard gives +5000', () => {
    const run = (deleted: boolean) => {
      const { r, unit } = (() => {
        const s = scene({
          attacker: { circles: { vanguard: OKSIZZ, back_center: 'BT16-124EN' } },
          defender: { circles: { vanguard: OPP_G3 }, deckTop: vanilla(2) },
        });
        if (deleted) s.cards[unitAt(s, 1, 'vanguard')]!.deleted = true;
        const vg = unitAt(s, 0, 'vanguard');
        return {
          r: drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')))),
          unit: vg,
        };
      })();
      return boosts(r, unit, 5000);
    };
    expect(run(true)).toBe(1);
    expect(run(false)).toBe(0);
  });

  it('BT16-047EN Egotte / BT16-123EN Gatario: +3000 attacking with a Deletor vanguard', () => {
    for (const card of ['BT16-047EN', 'BT16-123EN']) {
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: ZAELE })).toBe(1);
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: OPP })).toBe(0);
    }
  });

  it('BT16-114EN Newark: a hit on a vanguard gives another unit +3000', () => {
    const { r } = attackWithHit('BT16-114EN');
    expect(find(r.events, 'MODIFIER_ADDED').some((e) => e.modifier.amount === 3000)).toBe(true);
  });

  it('BT16-115EN Fruet: [CB1] +3000 when it attacks', () => {
    expect(attackPumps('BT16-115EN', 3000, { damage: 1 })).toBe(1);
  });

  it('BT16-119EN Jail: a hit on a vanguard counter-charges', () => {
    const { r } = attackWithHit('BT16-119EN', 1);
    expect(faceDown(r.state)).toBe(0);
  });

  it('BT16-121EN Izret: placed on (RC), another unit gets +2000', () => {
    const { s, r } = callIt('BT16-121EN', { vanguard: ZAELE });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 2000)).toBe(1);
  });

  it('BT16-125EN Vuera: [Rest] another unit gets +2000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: ZAELE, back_left: 'BT16-125EN' } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))));
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 2000)).toBe(1);
  });

  it('BT16-126EN Nie: [CB1 & to soul] takes a grade 3 from the top five', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: ZAELE, back_left: 'BT16-126EN' } },
      defender: { circles: { vanguard: OPP } },
      extra: [[OPP_G3], []],
    });
    stock(s, 'damage', OPP, 1);
    pull(s, OPP_G3, 'top');
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'), '2')));
    expect(r.state.players[0].hand.some((id) => r.state.cards[id]!.definitionId === OPP_G3)).toBe(
      true,
    );
  });

  it('BT16-022EN Evil: [discard] a unit being attacked cannot be hit', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, hand: ['BT16-022EN', OPP_G1], deckTop: vanilla(2) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT16-022EN') }), 1);
    r = settle(r);
    expect(r.state.players[1].damage).toHaveLength(0);
  });
});

/** `card` on front-left attacks the vanguard and hits (the defender has no guard). */
function attackWithHit(card: string, damage = 0, before?: (s: GameState) => void) {
  const s = scene({
    attacker: { circles: { vanguard: ZAELE, front_left: card }, damage: [] },
    defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
  });
  stock(s, 'damage', OPP, damage);
  for (const id of s.players[0].damage) s.cards[id]!.faceUp = false;
  before?.(s);
  const r = settle(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))));
  return { s, r };
}

describe('BT16 English-only: Royal Paladin (Seekers)', () => {
  const EXIV = 'BT16-001EN';

  it('BT16-001EN Alfred Exiv: legions with "Blaster Blade" or "Blaster Blade Seeker"', () => {
    expect(legionUp(EXIV, 'BT01-002').r.state.players[0].legion).not.toBeNull();
    expect(legionUp(EXIV, 'BT16-009').r.state.players[0].legion).not.toBeNull();
  });

  it('BT16-001EN Alfred Exiv: in legion, +1000 per other Seeker, and critical +1 with five rear-guards', () => {
    const SEEKER_RG = 'BT16-063EN';
    const others = {
      front_left: SEEKER_RG,
      front_right: SEEKER_RG,
      back_left: SEEKER_RG,
      back_right: SEEKER_RG,
    } as const;
    const { s, r } = legionUp(EXIV, 'BT16-009', { others });
    const vg = unitAt(s, 0, 'vanguard');
    // leader 11000 + 1000 for each of the mate and four Seeker rear-guards
    expect(pw(r.state, vg)).toBe(11000 + 5000);
    expect(currentCritical(r.state, ctx, vg)).toBe(1);
    const five = structuredClone(r.state);
    const extra = five.players[0].deck.pop()!;
    five.players[0].circles.back_center.push(extra);
    expect(currentCritical(five, ctx, vg)).toBe(2);
  });

  it('BT16-001EN Alfred Exiv: [CB2 Seeker] calls a Seeker from the deck', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: EXIV } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT16-063EN'], []],
    });
    stock(s, 'damage', 'BT16-063EN', 2);
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '3')));
    expect(field(r.state, 0)).toContain('BT16-063EN');
  });

  it('BT16-013EN Maddan: [CB1] +1000 per other Seeker attacking with Blaster Blade Seeker on (VC)', () => {
    const { r, unit } = (() => {
      const s = scene({
        attacker: {
          circles: { vanguard: 'BT16-009', front_left: 'BT16-013EN', back_left: 'BT16-063EN' },
        },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      });
      stock(s, 'damage', OPP, 1);
      const u = unitAt(s, 0, 'front_left');
      return { r: drain(apply(s, attack(u, unitAt(s, 1, 'vanguard')))), unit: u };
    })();
    // Blaster Blade Seeker and Aremil: two other Seekers
    expect(boosts(r, unit, 2000)).toBe(1);
  });

  it('BT16-063EN Aremil: placed with Blaster Blade Seeker on (VC), [SB2] +1000 per other Seeker', () => {
    const { r } = callIt('BT16-063EN', { vanguard: 'BT16-009', soul: 2 });
    expect(boosts(r, unitAt(r.state, 0, 'front_left'), 1000)).toBe(1);
  });

  it.each(['BT16-015EN'])('%s: [CB1] calls five cards from the top of the deck to (GC)', (card) => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: OPP }, hand: [card, OPP_G1], damage: vanilla(1) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, card) }), 1);
    expect(r.state.players[1].guardian).toHaveLength(6);
  });

  it('BT16-027EN Menprius: a hit on a vanguard, [CB1] takes a grade 3 from the top five', () => {
    const { s, r } = attackWithHit('BT16-027EN', 1, (st) => {
      for (const id of st.players[0].damage) st.cards[id]!.faceUp = true;
      deckOf(st, OPP_G3);
    });
    expect(r.state.players[0].hand.length).toBe(s.players[0].hand.length + 1);
    expect(faceDown(r.state)).toBe(1);
  });
});

describe('BT16 English-only: Gold Paladin (Liberators)', () => {
  const GLARE = 'BT16-003EN';
  const AGLOVALE = 'BT16-016EN';

  it('BT16-003EN Prominence Glare: legions with Regulation Liberator, Aglovale; [CB1 & retire] calls a Liberator from the top four', () => {
    const { s, r: legion } = legionUp(GLARE, AGLOVALE, {
      others: { front_left: OPP },
      before: (st) => stock(st, 'damage', OPP, 1),
    });
    expect(legion.state.players[0].legion).not.toBeNull();
    deckOf(legion.state, 'BT16-076EN');
    const r = drain(then(legion, activate(unitAt(s, 0, 'vanguard'), '3')));
    expect(field(r.state, 0)).toContain('BT16-076EN');
  });

  it('BT16-003EN Prominence Glare: a unit called from the deck, [CB1 & discard Bluish Flame] critical +1 and no grade 1+ guardians', () => {
    const { s, r: legion } = legionUp(GLARE, AGLOVALE, {
      others: { front_left: OPP },
      before: (st) => {
        stock(st, 'damage', OPP, 2);
        stock(st, 'hand', GLARE, 1);
      },
    });
    deckOf(legion.state, 'BT16-076EN');
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(then(legion, activate(vg, '3')));
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = then(r, attack(vg, unitAt(s, 1, 'vanguard')));
    const g1 = r.state.players[1].hand.find((id) => r.state.cards[id]!.definitionId === OPP_G1);
    expect(g1).toBeDefined();
    expect(legal(r.state, 1, 'GUARD')?.cardIds ?? []).not.toContain(g1);
    // without the effect the same grade 1 could guard
    const plain = then(
      then(legion, { type: 'END_PHASE', player: 0 }),
      attack(vg, unitAt(s, 1, 'vanguard')),
    );
    expect(legal(plain.state, 1, 'GUARD')?.cardIds).toContain(g1);
  });

  it('BT16-016EN Aglovale: +2000 attacking with a Bluish Flame vanguard; placed from the deck, [SB1] takes a Bluish Flame', () => {
    expect(attackPumps(AGLOVALE, 2000, { on: 'front_left', vanguard: GLARE })).toBe(1);
    expect(attackPumps(AGLOVALE, 2000, { on: 'front_left', vanguard: OPP })).toBe(0);
  });

  it('BT16-035EN Heli / BT16-077EN Rud: a hit calls one of the top three to an open (RC)', () => {
    for (const [card, boost] of [
      ['BT16-035EN', false],
      ['BT16-077EN', true],
    ] as const) {
      const s = scene({
        attacker: {
          circles: boost
            ? { vanguard: GLARE, front_left: OPP, back_left: card }
            : { vanguard: GLARE, front_left: card },
        },
        defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
      });
      stock(s, 'damage', OPP, 1);
      deckOf(s, OPP_G1);
      const r = settle(
        apply(
          s,
          attack(
            unitAt(s, 0, 'front_left'),
            unitAt(s, 1, 'vanguard'),
            boost ? unitAt(s, 0, 'back_left') : null,
          ),
        ),
      );
      expect(r.state.players[0].soul.some((id) => r.state.cards[id]!.definitionId === card)).toBe(
        true,
      );
      expect(field(r.state, 0)).toContain(OPP_G1);
    }
  });

  it('BT16-039EN Guido: [to soul] in legion calls a Liberator from the top three', () => {
    const { s, r: legion } = legionUp(GLARE, AGLOVALE, { others: { back_left: 'BT16-039EN' } });
    deckOf(legion.state, 'BT16-076EN');
    const r = drain(then(legion, activate(unitAt(s, 0, 'back_left'), '2')));
    expect(field(r.state, 0)).toContain('BT16-076EN');
  });

  it('BT16-072EN Gigantech Anger: [CB1 & SB1] +5000 when it attacks', () => {
    expect(attackPumps('BT16-072EN', 5000, { damage: 1, soul: 1 })).toBe(1);
  });

  it('BT16-076EN Mertgal: +10000 when your vanguard legions', () => {
    const { s, r } = legionUp(GLARE, AGLOVALE, { others: { front_left: 'BT16-076EN' } });
    expect(boosts(r, unitAt(s, 0, 'front_left'), 10000)).toBe(1);
  });

  it('BT16-081EN Chikgal: [SB1] +3000 attacking a vanguard', () => {
    expect(attackPumps('BT16-081EN', 3000, { soul: 1 })).toBe(1);
  });

  it('BT16-082EN Dulcet Archer: a Liberator called from the deck, [discard] draws (once per turn)', () => {
    const { s, r: legion } = legionUp(GLARE, AGLOVALE, {
      others: { front_left: OPP, back_left: 'BT16-082EN' },
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        stock(st, 'hand', OPP, 1);
      },
    });
    deckOf(legion.state, 'BT16-076EN');
    const hand = legion.state.players[0].hand.length;
    const r = drain(then(legion, activate(unitAt(s, 0, 'vanguard'), '3')));
    // discarded one, drew one
    expect(r.state.players[0].hand.length).toBe(hand);
  });
});

describe('BT16 English-only: Narukami (Brawlers)', () => {
  it('BT16-018EN Skybeat Dragon: legions with Skyhowl Dragon and retires a front-row rear-guard', () => {
    const { r } = legionUp('BT16-018EN', 'BT16-040EN', { oppField: { front_left: OPP } });
    expect(field(r.state, 1)).toHaveLength(1);
    expect(attackPumps('BT16-018EN', 2000)).toBe(1);
  });

  it('BT16-040EN Skyhowl Dragon: placed with a Brawler vanguard, [CB1] retires a front-row rear-guard', () => {
    const { r } = callIt('BT16-040EN', {
      vanguard: 'BT16-018EN',
      damage: 1,
      oppField: { front_left: OPP },
    });
    expect(field(r.state, 1)).toHaveLength(1);
  });

  it('BT16-004 Wild Rush Dragon can now legion with Brawler, Wildfist Dragon (BT16-042EN)', () => {
    expect(legionUp('BT16-004', 'BT16-042EN').r.state.players[0].legion).not.toBeNull();
  });

  it('BT16-042EN Wildfist / BT16-099EN Wildclock: +3000 attacking with a Brawler vanguard', () => {
    for (const card of ['BT16-042EN', 'BT16-099EN']) {
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: 'BT16-018EN' })).toBe(1);
    }
  });

  it('BT16-086EN Kohiko: [CB1] +3000 when it attacks', () => {
    expect(attackPumps('BT16-086EN', 3000, { damage: 1 })).toBe(1);
  });

  it('BT16-088EN Lightningrod Dragon: legions with Kotenka (BT16-089EN), +5000 attacking in legion', () => {
    const { r, unit, inLegion } = legionAttack('BT16-088EN', 'BT16-089EN', {}, 'vanguard');
    expect(inLegion).toBe(true);
    expect(boosts(r, unit, 5000)).toBe(1);
  });

  it('BT16-093EN Oldhand Dragon: +5000 shield when it intercepts', () => {
    expect(interceptShieldOf('BT16-093EN', 'BT16-018EN')).toBe(10000);
  });

  it('BT16-094EN Lightning Rider: +4000 attacking while your vanguard is in legion', () => {
    const { r, unit } = legionAttack(
      'BT16-088EN',
      'BT16-089EN',
      { front_left: 'BT16-094EN' },
      'front_left',
    );
    expect(boosts(r, unit, 4000)).toBe(1);
  });

  it('BT16-097EN Sogo: [CB1] +1000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT16-018EN', front_left: 'BT16-097EN' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(boosts(r, unitAt(s, 0, 'front_left'), 1000)).toBe(1);
  });

  it('BT16-098EN Teirin: +2000 attacking a vanguard from (RC)', () => {
    expect(attackPumps('BT16-098EN', 2000, { on: 'front_left' })).toBe(1);
  });

  it('BT16-101EN Starring Dracokid: boosting a legion vanguard gives +4000', () => {
    const { r } = legionAttack(
      'BT16-088EN',
      'BT16-089EN',
      { back_center: 'BT16-101EN' },
      'vanguard',
      'back_center',
    );
    expect(find(r.events, 'MODIFIER_ADDED').some((e) => e.modifier.amount === 4000)).toBe(true);
  });
});

describe('BT16 English-only: vanilla and trigger cards', () => {
  it.each([
    'BT16-089EN',
    'BT16-103EN',
    'BT16-107EN',
    'BT16-108EN',
    'BT16-110EN',
    'BT16-111EN',
    'BT16-118EN',
    'BT16-122EN',
    'BT16-127EN',
    'BT16-128EN',
    'BT16-129EN',
    'BT16-130EN',
    'BT16-131EN',
    'BT16-132EN',
  ])('%s is in the pool with no abilities', (id) => {
    expect(ctx.registry.get(id).abilities).toEqual([]);
  });
});
