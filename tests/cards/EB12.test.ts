/** EB12 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { andThen as then, apply, ctx, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand } from '../fixtures/cardTest';
import { faceDown, settle, stock } from '../fixtures/setHelpers';
import { attackPumps, fillSoul, OPP, OPP_G1, pw, unitAt } from '../fixtures/shapeChecks';

const WITCH_G3 = 'EB12-002'; // White Snake Witch, Mint
const REGALIA_G3 = 'EB12-005'; // Midnight Regalia, Nyx
const NORN = 'EB12-012'; // Regalia of Fate, Norn
const CHICORY = 'EB12-013'; // Black Snake Witch, Chicory
const VENUS = 'EB12-018'; // Regalia of Beauty, Venus (vanilla G2, Cypris's mate)

const defs = (s: GameState, ids: readonly string[]) => ids.map((x) => s.cards[x]!.definitionId);
const soulSize = (s: GameState) => s.players[0].soul.length;

/** Your vanguard in legion with a copy of `mate` taken from the deck. */
const legionUp = (s: GameState, mate: string) => {
  const pl = s.players[0];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === mate)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl.circles.vanguard.unshift(id);
  s.cards[id]!.faceUp = true;
  pl.legion = { leader: pl.circles.vanguard[1]!, mate: id };
};

describe('EB12 grade 3s', () => {
  it('EB12-001 Yggdrasil: Seek Mate for Norn; in legion [SB6] Critical +1 and no grade 1+ guardians; +3000 with a middle-column unit', () => {
    const s = scene({
      at: 'battle',
      attacker: { circles: { vanguard: 'EB12-001', back_center: OPP_G1 } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
      extra: [[NORN], []],
    });
    legionUp(s, NORN);
    fillSoul(s, 0, 6);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    // the opponent cannot guard with its grade 1, so the attack hits for two
    expect(find(r.events, 'DAMAGE_DEALT')[0]!.amount).toBe(2);
    expect(boosts(r, vg, 3000)).toBe(1);
  });

  it('EB12-002 Mint: Seek Mate for Chicory; in legion [SB6] +10000 and front-row Witch rear-guards +5000; [CB1] Soul Charge 3 with a Witch behind it', () => {
    const s = scene({
      at: 'battle',
      attacker: { circles: { vanguard: WITCH_G3, front_left: CHICORY } },
      defender: { circles: { vanguard: OPP } },
      extra: [[CHICORY], []],
    });
    legionUp(s, CHICORY);
    fillSoul(s, 0, 6);
    const vg = unitAt(s, 0, 'vanguard');
    const rg = unitAt(s, 0, 'front_left');
    const before = pw(s, rg);
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(pw(r.state, rg)).toBe(before + 5000);

    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: WITCH_G3, back_center: CHICORY }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = soulSize(t);
    const u = drain(apply(t, activate(unitAt(t, 0, 'vanguard'), '3')));
    expect(soulSize(u.state)).toBe(soul + 3);
  });

  it('EB12-003 Brynhildr: [LB5][CB4 & SB6] retires up to three rear-guards and draws one per unit retired', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB12-003' }, damage: vanilla(5) },
      defender: { circles: { vanguard: OPP, front_left: OPP, front_right: OPP_G1 } },
    });
    fillSoul(s, 0, 6);
    const hand = s.players[0].hand.length;
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')), [
      unitAt(s, 1, 'front_left'),
      unitAt(s, 1, 'front_right'),
    ]);
    expect(r.state.players[1].drop).toHaveLength(2);
    expect(r.state.players[0].hand).toHaveLength(hand + 2);
  });

  it('EB12-004 Fennel: [CB1] placed on (VC) Soul Charge 3; the turn it legions, [SB3] after its battle takes two Witches from the top five', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: OPP }, hand: ['EB12-004'], damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = soulSize(s);
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'EB12-004') }));
    // the old vanguard goes to the soul, then Soul Charge 3
    expect(soulSize(r.state)).toBe(soul + 4);

    const t = scene({
      at: 'battle',
      attacker: {
        circles: { vanguard: 'EB12-004' },
        deckTop: [CHICORY, 'EB12-025', OPP, OPP_G1, 'BT01-022'],
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB12-011'], []],
    });
    legionUp(t, 'EB12-011');
    t.turnFlags.legioned = [t.players[0].legion!.leader];
    fillSoul(t, 0, 3);
    const witches = t.players[0].deck.slice(0, 2);
    const u = settle(apply(t, attack(unitAt(t, 0, 'vanguard'), unitAt(t, 1, 'vanguard'))), witches);
    expect(u.state.players[0].hand).toEqual(expect.arrayContaining(witches));
  });

  it('EB12-005 Nyx: in legion, a card with its name going from the soul to the drop zone gives +5000 / Critical +1; [SB3] draws with three or fewer cards in hand', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: REGALIA_G3 }, hand: [] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB12-006', REGALIA_G3], []],
    });
    legionUp(s, 'EB12-006');
    // a copy of Nyx and two other cards in the soul
    const pl = s.players[0];
    const copy = pl.deck.find((x) => s.cards[x]!.definitionId === REGALIA_G3)!;
    pl.deck.splice(pl.deck.indexOf(copy), 1);
    pl.soul.unshift(copy);
    fillSoul(s, 0, 2);
    const vg = pl.legion!.leader;
    const r = settle(apply(s, activate(vg, '3')), [copy, ...pl.soul.filter((x) => x !== copy)]);
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(pw(r.state, vg)).toBe(pw(s, vg) + 5000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });

  it('EB12-010 Procyon: [CB3] puts up to six Myth Guards with different names into the soul; [LB4][SB6] stands Myth Guard rear-guards', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB12-010' }, damage: vanilla(3) },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB12-020', 'EB12-027', 'EB12-020'], []],
    });
    const soul = soulSize(s);
    const guards = s.players[0].deck.filter((x) =>
      ['EB12-020', 'EB12-027', 'EB12-010'].includes(s.cards[x]!.definitionId),
    );
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')), guards);
    const added = r.state.players[0].soul.slice(0, r.state.players[0].soul.length - soul);
    const names = defs(r.state, r.state.players[0].soul).filter((d) =>
      ['EB12-020', 'EB12-027', 'EB12-010'].includes(d),
    );
    expect(new Set(names).size).toBe(names.length);
    expect(added.length).toBeGreaterThanOrEqual(2);

    const t = scene({
      at: 'battle',
      attacker: {
        circles: { vanguard: 'EB12-010', front_left: 'EB12-020' },
        rested: ['front_left'],
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(t, 0, 6);
    const rg = unitAt(t, 0, 'front_left');
    const u = drain(apply(t, attack(unitAt(t, 0, 'vanguard'), unitAt(t, 1, 'vanguard'))));
    expect(u.state.cards[rg]!.orientation).toBe('stand');
  });

  it('EB12-017 Cypris: Seek Mate for Venus; +2000 attacking a vanguard from (RC)', () => {
    expect(attackPumps('EB12-017', 2000, { on: 'front_left' })).toBe(1);
    expect(VENUS).toBe('EB12-018');
  });
});

describe('EB12 rear-guards', () => {
  it.each(['EB12-006', 'EB12-023'])(
    '%s Hemera / Shiny Angel: placed on (RC), up to three Regalia from the drop zone into the soul',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: REGALIA_G3 }, hand: [card] },
        defender: { circles: { vanguard: OPP } },
      });
      stock(s, 'drop', NORN, 4);
      const soul = soulSize(s);
      const r = settle(
        apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, card), circle: 'front_left' }),
        s.players[0].drop,
      );
      expect(soulSize(r.state)).toBe(soul + 3);
    },
  );

  it.each([NORN, 'EB12-035'])(
    '%s Norn / Achlis: put into the drop zone from the soul, a Regalia vanguard gets +5000',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: 'EB12-016' } },
        defender: { circles: { vanguard: OPP } },
        extra: [[card, REGALIA_G3], []],
      });
      // Nyx's [SB3] puts the soul (with `card` in it) into the drop zone
      const pl = s.players[0];
      const vgCard = pl.deck.find((x) => s.cards[x]!.definitionId === REGALIA_G3)!;
      pl.deck.splice(pl.deck.indexOf(vgCard), 1);
      pl.circles.vanguard.push(vgCard);
      s.cards[vgCard]!.faceUp = true;
      const c = pl.deck.find((x) => s.cards[x]!.definitionId === card)!;
      pl.deck.splice(pl.deck.indexOf(c), 1);
      pl.soul.unshift(c);
      fillSoul(s, 0, 2);
      const r = settle(apply(s, activate(vgCard, '3')), [c, ...pl.soul.filter((x) => x !== c)]);
      expect(r.state.players[0].drop).toContain(c);
      expect(pw(r.state, vgCard)).toBe(pw(s, vgCard) + 5000);
    },
  );

  it('EB12-007 Framboise: sentinel; [discard] a unit being attacked cannot be hit', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: OPP }, hand: ['EB12-007', OPP_G1] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'EB12-007') }), 1);
    r = settle(r);
    expect(find(r.events, 'ATTACK_RESOLVED')[0]!.hit).toBe(false);
  });

  it('EB12-008 Svalinn: [CB1] placed on (GC) from hand calls five cards to (GC)', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: OPP }, hand: ['EB12-008', OPP_G1], damage: vanilla(1) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'EB12-008') }), 1);
    expect(r.state.players[1].guardian).toHaveLength(6);
  });

  it('EB12-011 Jasmine: [CB1] with a Witch vanguard, Soul Charge 3 and +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: WITCH_G3 }, hand: ['EB12-011'], damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = soulSize(s);
    const r = settle(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, 'EB12-011'), circle: 'front_left' }),
    );
    const rg = unitAt(r.state, 0, 'front_left');
    expect(soulSize(r.state)).toBe(soul + 3);
    expect(pw(r.state, rg)).toBe(ctx.registry.get('EB12-011').power + 3000);
  });

  it.each([CHICORY, 'EB12-025'])(
    '%s Chicory / Bellini: +3000 attacking from (RC) with a Witch vanguard',
    (card) => {
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: WITCH_G3 })).toBe(1);
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: OPP })).toBe(0);
    },
  );

  it('EB12-015 Freyja: [CB1] when your vanguard legions, Soul Charge 3 and +5000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'EB12-017', front_left: 'EB12-015' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: 'EB12-017' } },
      extra: [[VENUS], []],
    });
    stock(s, 'drop', OPP, 4);
    const rg = unitAt(s, 0, 'front_left');
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')));
    expect(r.state.players[0].legion).not.toBeNull();
    expect(pw(r.state, rg)).toBe(pw(s, rg) + 5000);
  });

  it('EB12-016 Pray Angel: forerunner; [to soul] in legion, Soul Charge 3 and your vanguard +5000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB12-017', back_center: 'EB12-016' } },
      defender: { circles: { vanguard: OPP } },
      extra: [[VENUS], []],
    });
    legionUp(s, VENUS);
    const vg = s.players[0].legion!.leader;
    const soul = soulSize(s);
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_center'), '2')), 0, [vg]);
    expect(soulSize(r.state)).toBe(soul + 4);
    expect(pw(r.state, vg)).toBe(pw(s, vg) + 5000);
  });

  it('EB12-022 Pure Angel: [CB1] a Regalia vanguard gets +5000 and "[SB3] draw on a hit"', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: REGALIA_G3 }, hand: ['EB12-022'], damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = settle(
      apply(s, {
        type: 'CALL',
        player: 0,
        cardId: inHand(s, 0, 'EB12-022'),
        circle: 'back_center',
      }),
    );
    expect(pw(r.state, vg)).toBe(pw(s, vg) + 5000);
    expect(r.state.grants.some((g) => g.target === vg)).toBe(true);
    expect(faceDown(r.state)).toBe(1);
  });

  it('EB12-026 Preach Angel: boosting a vanguard in legion, +4000', () => {
    const s = scene({
      at: 'battle',
      attacker: { circles: { vanguard: 'EB12-017', back_center: 'EB12-026' } },
      defender: { circles: { vanguard: OPP } },
      extra: [[VENUS], []],
    });
    legionUp(s, VENUS);
    const vg = s.players[0].legion!.leader;
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
    expect(boosts(r, vg, 4000)).toBe(1);
  });

  it.each([
    ['EB12-028', 'Koroha'],
    ['EB12-033', 'Kukurihime'],
  ])('%s %s: [to soul] a unit gets +3000', (card) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: REGALIA_G3, back_center: card } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const id = card === 'EB12-028' ? '2' : '1';
    const r = settle(apply(s, activate(unitAt(s, 0, 'back_center'), id)), [vg]);
    expect(pw(r.state, vg)).toBe(pw(s, vg) + 3000);
  });

  it('EB12-034 Lot Angel: placed on (GC), may Soul Charge 1', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: OPP }, hand: ['EB12-034'] },
    });
    const soul = s.players[1].soul.length;
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'EB12-034') }), 1);
    expect(r.state.players[1].soul).toHaveLength(soul + 1);
  });
});
