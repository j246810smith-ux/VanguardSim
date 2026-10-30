/** EB11 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/engine';
import { andThen as then, apply, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, field, inHand } from '../fixtures/cardTest';
import { faceDown, settle, stock } from '../fixtures/setHelpers';
import { attackPumps, fillSoul, OPP, OPP_G1, pw, unitAt } from '../fixtures/shapeChecks';

const TAHR = 'BT01-024'; // Embodiment of Spear, Tahr: grade 0 (critical trigger, no abilities)
const WITCH_G3 = 'EB11-017'; // Witch of Comets, Manisa
const FEMME = 'EB11-011'; // Witch of Reality, Femme (Fianna's mate)
const REDMYU = 'EB11-022'; // Redmyu Revenger
const ABYSS_G2 = 'EB11-003'; // Blaster Dark Revenger "Abyss"
const FATALITA = 'EB11-021'; // Demon World Castle, Fatalita (reprint of BT04-042)

const defs = (s: GameState, ids: readonly string[]) => ids.map((x) => s.cards[x]!.definitionId);
const top = (s: GameState, p: 0 | 1, c: 'front_left' | 'front_right' | 'back_left') =>
  s.cards[s.players[p].circles[c].at(-1)!]?.definitionId;

/** `n` cards from the bottom of the opponent's deck into their drop zone, renamed to `def`. */
const oppDrop = (s: GameState, def: string, n = 1) => {
  const pl = s.players[1];
  for (let i = 0; i < n; i++) {
    const id = pl.deck.pop()!;
    (s.cards[id] as { definitionId: string }).definitionId = def;
    s.cards[id]!.faceUp = true;
    pl.drop.push(id);
  }
};

/** Your vanguard (`leader`) in legion with a copy of `mate` from the deck. */
const legionUp = (s: GameState, mate: string) => {
  const pl = s.players[0];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === mate)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl.circles.vanguard.unshift(id);
  s.cards[id]!.faceUp = true;
  pl.legion = { leader: pl.circles.vanguard[1]!, mate: id };
};

describe('EB11 witches: your opponent calls grade 0 units', () => {
  it.each(['EB11-006', 'EB11-014'])(
    '%s Deirdre / Dana: [SB1] with a "Witch" vanguard, the opponent calls a grade 0 from their drop zone onto the chosen (RC)',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: WITCH_G3 }, hand: [card] },
        defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
      });
      fillSoul(s, 0, 1);
      oppDrop(s, TAHR);
      const old = unitAt(s, 1, 'front_left');
      const soul = s.players[0].soul.length;
      const r = settle(
        apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, card), circle: 'front_left' }),
      );
      expect(top(r.state, 1, 'front_left')).toBe(TAHR);
      expect(r.state.players[1].drop).toContain(old);
      expect(r.state.players[0].soul).toHaveLength(soul - 1);
    },
  );

  it('EB11-006 Deirdre: nothing happens without a "Witch" vanguard', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: REDMYU }, hand: ['EB11-006'] },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    fillSoul(s, 0, 1);
    oppDrop(s, TAHR);
    const r = settle(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, 'EB11-006'), circle: 'front_left' }),
    );
    expect(top(r.state, 1, 'front_left')).toBe(OPP_G1);
  });

  it('EB11-004 Rias: [CB2] the opponent reveals five and calls a grade 0 from them to the chosen (RC)', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB11-004' }, damage: vanilla(2) },
      defender: {
        circles: { vanguard: OPP, front_right: OPP_G1 },
        deckTop: ['BT01-022', TAHR, 'BT01-026', 'BT01-038', 'BT01-040'],
      },
    });
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '3')));
    expect(top(r.state, 1, 'front_right')).toBe(TAHR);
    expect(find(r.events, 'CARDS_REVEALED').some((e) => e.player === 1)).toBe(true);
    expect(faceDown(r.state)).toBe(2);
  });

  it('EB11-004 Rias: Seek Mate for Deirdre, then the opponent vanguard gets -5000 per grade 0 rear-guard', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB11-004', front_left: FEMME } },
      defender: { circles: { vanguard: 'EB11-004', front_left: TAHR, front_right: TAHR } },
      extra: [['EB11-006'], []],
    });
    stock(s, 'drop', OPP, 4);
    const vg = unitAt(s, 0, 'vanguard');
    const opp = unitAt(s, 1, 'vanguard');
    const r = settle(apply(s, activate(vg, '1')));
    expect(r.state.players[0].legion).not.toBeNull();
    // Femme was retired as the cost; two grade 0 rear-guards: -10000
    expect(top(r.state, 0, 'front_left')).toBeUndefined();
    expect(pw(r.state, opp)).toBe(pw(s, opp) - 10000);
  });

  it('EB11-001 Fianna: Seek Mate for Femme; [CB2] in legion the opponent calls two grade 0s from the top ten onto two chosen (RC)', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB11-001' }, damage: vanilla(2) },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1, back_left: OPP_G1 },
        deckTop: [...vanilla(4), TAHR, ...vanilla(4), TAHR],
      },
      extra: [[FEMME], []],
    });
    legionUp(s, FEMME);
    const vg = unitAt(s, 0, 'vanguard');
    const chosen = [unitAt(s, 1, 'front_left'), unitAt(s, 1, 'back_left')];
    const r = settle(apply(s, activate(vg, '2')), chosen);
    expect(top(r.state, 1, 'front_left')).toBe(TAHR);
    expect(top(r.state, 1, 'back_left')).toBe(TAHR);
    expect(top(r.state, 1, 'front_right')).toBe(OPP_G1);
  });

  it('EB11-001 Fianna: not in legion, [CB2] does nothing', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB11-001' }, damage: vanilla(2) },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1 },
        deckTop: [TAHR],
      },
    });
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(top(r.state, 1, 'front_left')).toBe(OPP_G1);
  });

  it("EB11-001 Fianna: [retire a rear-guard with your vanguard's name] draws two if the opponent has two grade 0 rear-guards (once per turn)", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB11-001', front_left: 'EB11-001' } },
      defender: { circles: { vanguard: OPP, front_left: TAHR, front_right: TAHR } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const handBefore = s.players[0].hand.length;
    const r = settle(apply(s, activate(vg, '3')));
    expect(r.state.players[0].hand).toHaveLength(handBefore + 2);
    expect(() => apply(r.state, activate(vg, '3'))).toThrow();
  });

  it('EB11-026 Securna: [retire another Witch] in a Witch legion with two grade 0s, the opponent vanguard gets -5000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: WITCH_G3, back_left: FEMME }, hand: ['EB11-026'] },
      defender: { circles: { vanguard: OPP, front_left: TAHR, front_right: TAHR } },
      extra: [['EB11-019'], []],
    });
    legionUp(s, 'EB11-019');
    const opp = unitAt(s, 1, 'vanguard');
    const r = settle(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, 'EB11-026'), circle: 'front_left' }),
    );
    expect(pw(r.state, opp)).toBe(pw(s, opp) - 5000);
    expect(defs(r.state, r.state.players[0].drop)).toContain(FEMME);
  });

  it('EB11-035 Medb: with a Witch vanguard and two opponent grade 0s, Soul Charge 1 and Counter Charge 1', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: WITCH_G3 }, hand: ['EB11-035'], damage: vanilla(1) },
      defender: { circles: { vanguard: OPP, front_left: TAHR, front_right: TAHR } },
    });
    s.cards[s.players[0].damage[0]!]!.faceUp = false;
    const r = settle(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, 'EB11-035'), circle: 'back_left' }),
    );
    expect(r.state.players[0].soul).toHaveLength(2); // the first vanguard + Soul Charge
    expect(faceDown(r.state)).toBe(0);
  });

  it('EB11-015 Eriu: [discard] draws when the opponent has two grade 0 rear-guards', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: WITCH_G3 }, hand: ['EB11-015', OPP] },
      defender: { circles: { vanguard: OPP, front_left: TAHR, front_right: TAHR } },
    });
    const r = settle(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, 'EB11-015'), circle: 'back_left' }),
    );
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it('EB11-020 Emel: +3000 attacking when the opponent has two grade 0 rear-guards', () => {
    const pumps = (oppG0: number) =>
      attackPumps('EB11-020', 3000, {
        before: (s) => {
          for (const c of (['front_left', 'front_right'] as const).slice(0, oppG0)) {
            const id = s.players[1].deck.pop()!;
            (s.cards[id] as { definitionId: string }).definitionId = TAHR;
            s.cards[id]!.faceUp = true;
            s.players[1].circles[c].push(id);
          }
        },
      });
    expect(pumps(2)).toBe(1);
    expect(pumps(1)).toBe(0);
  });

  it.each([FEMME, 'EB11-023'])(
    '%s Femme / Scathach: +3000 attacking from (RC) with a "Witch" vanguard',
    (card) => {
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: WITCH_G3 })).toBe(1);
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: REDMYU })).toBe(0);
    },
  );

  it('EB11-017 Manisa: Seek Mate for Serva; +2000 attacking a vanguard from (RC)', () => {
    expect(attackPumps('EB11-017', 2000, { on: 'front_left' })).toBe(1);
  });
});

describe('EB11 revengers', () => {
  it('EB11-002 Phantom Blaster "Abyss": the turn it legions, [CB2 & retire three Revengers] at the end of its battle stands your vanguard', () => {
    const s = scene({
      at: 'battle',
      attacker: {
        circles: {
          vanguard: 'EB11-002',
          front_left: REDMYU,
          front_right: REDMYU,
          back_left: ABYSS_G2,
        },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [[ABYSS_G2], []],
    });
    legionUp(s, ABYSS_G2);
    s.turnFlags.legioned = [s.players[0].legion!.leader];
    const vg = unitAt(s, 0, 'vanguard');
    const r = settle(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(field(r.state, 0)).toHaveLength(2); // only the legion is left
    expect(faceDown(r.state)).toBe(2);
    // +2000 attacking a vanguard
    expect(boosts(r, vg, 2000)).toBeGreaterThanOrEqual(1);
  });

  it('EB11-003 Blaster Dark Revenger "Abyss": [CB1] with a Revenger vanguard, retires an opponent grade 1 or less rear-guard', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB11-002' }, hand: [ABYSS_G2], damage: vanilla(1) },
      defender: { circles: { vanguard: OPP, front_left: OPP, front_right: OPP_G1 } },
    });
    const g1 = unitAt(s, 1, 'front_right');
    const r = settle(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, ABYSS_G2), circle: 'front_left' }),
    );
    expect(r.state.players[1].drop).toContain(g1);
    expect(top(r.state, 1, 'front_left')).toBe(OPP);
  });

  it('EB11-005 Cormack: +3000 attacking a vanguard with another unit in the middle column; in legion [retire] Critical +1', () => {
    expect(attackPumps('EB11-005', 3000, { booster: OPP_G1 })).toBe(1);
    expect(attackPumps('EB11-005', 3000)).toBe(0);
    const s = scene({
      at: 'battle',
      attacker: { circles: { vanguard: 'EB11-005', front_left: REDMYU } },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB11-007'], []],
    });
    legionUp(s, 'EB11-007');
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    // the attack hits (no guard): Critical 2 deals two damage
    expect(find(r.events, 'DAMAGE_DEALT')[0]!.amount).toBe(2);
  });

  it('EB11-007 Macart: when your vanguard legions, calls a grade 1 or less Revenger from the deck at [Rest]', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB11-005', front_left: 'EB11-007' } },
      defender: { circles: { vanguard: 'EB11-005' } },
      extra: [['EB11-007', 'EB11-024'], []],
    });
    stock(s, 'drop', OPP, 4);
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')));
    expect(r.state.players[0].legion).not.toBeNull();
    const called = Object.values(r.state.players[0].circles)
      .flat()
      .filter((x) => r.state.cards[x]!.definitionId === 'EB11-024');
    expect(called).toHaveLength(1);
    expect(r.state.cards[called[0]!]!.orientation).toBe('rest');
  });

  it('EB11-010 ToteZiegel: [LB4][CB2 & retire two Demon World Castles] calls three grade 2 or less from the deck', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'EB11-010', front_left: FATALITA, front_right: FATALITA },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    // "up to three": take three
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')), [...s.players[0].deck]);
    expect(field(r.state, 0)).toHaveLength(4);
    expect(defs(r.state, r.state.players[0].drop).filter((d) => d === FATALITA)).toHaveLength(2);
    expect(attackPumps('EB11-010', 3000)).toBe(1);
  });

  it('EB11-022 Redmyu: [CB2] +4000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP, front_left: REDMYU }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    const rg = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, activate(rg, '1')));
    expect(pw(r.state, rg)).toBe(pw(s, rg) + 4000);
  });

  it('EB11-024 Lifecher: +3000 attacking a vanguard when you have fewer units', () => {
    const pumps = (oppUnits: number) =>
      attackPumps('EB11-024', 3000, {
        before: (s) => {
          for (const c of (['front_left', 'front_right'] as const).slice(0, oppUnits)) {
            const id = s.players[1].deck.pop()!;
            (s.cards[id] as { definitionId: string }).definitionId = OPP;
            s.cards[id]!.faceUp = true;
            s.players[1].circles[c].push(id);
          }
        },
      });
    expect(pumps(1)).toBe(1);
    expect(pumps(0)).toBe(0);
  });

  it('EB11-027 Haarbau: boosting with Blaster Dark Revenger "Abyss" in its column, the boosted unit gets +4000', () => {
    expect(
      attackPumps(ABYSS_G2, 4000, { on: 'front_left', vanguard: OPP, booster: 'EB11-027' }),
    ).toBe(1);
    expect(
      attackPumps(REDMYU, 4000, { on: 'front_left', vanguard: OPP, booster: 'EB11-027' }),
    ).toBe(0);
  });
});

describe('EB11 support', () => {
  it('EB11-008 Grainne: sentinel; [CB1] placed on (GC) from hand calls five from the deck to (GC)', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: OPP }, hand: ['EB11-008', OPP_G1], damage: vanilla(1) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'EB11-008') }), 1);
    // Grainne and the five cards called from the deck
    expect(r.state.players[1].guardian).toHaveLength(6);
  });

  it('EB11-016 Lir: forerunner; [to soul] when the boosted attack hits a vanguard in legion, calls two grade 0s at [Rest]', () => {
    const s = scene({
      at: 'battle',
      attacker: { circles: { vanguard: WITCH_G3, back_center: 'EB11-016' } },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB11-019', TAHR, TAHR], []],
    });
    legionUp(s, 'EB11-019');
    s.players[1].hand = [];
    const lir = unitAt(s, 0, 'back_center');
    const tahrs = s.players[0].deck.filter((x) => s.cards[x]!.definitionId === TAHR);
    const r = settle(
      apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), lir)),
      tahrs,
    );
    expect(r.state.players[0].soul).toContain(lir);
    const grade0 = Object.values(r.state.players[0].circles)
      .flat()
      .filter((x) => r.state.cards[x]!.definitionId === TAHR);
    expect(grade0).toHaveLength(2);
  });

  it('EB11-028 Creeping Dark Goat: called when ridden; [CB1 & to soul] takes a grade 3 Shadow Paladin from the top five', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: OPP, front_left: 'EB11-028' },
        damage: vanilla(1),
        deckTop: [OPP, OPP, 'EB11-002'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const goat = unitAt(s, 0, 'front_left');
    const r = settle(apply(s, activate(goat, '2')), [s.players[0].deck[2]!]);
    expect(defs(r.state, r.state.players[0].hand)).toContain('EB11-002');
    expect(r.state.players[0].soul).toContain(goat);
  });
});
