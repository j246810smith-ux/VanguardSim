/** Limit Break (CR 10.2.5) on real cards: [CONT], [AUTO] and [ACT], LB4 and LB5. */
import { describe, expect, it } from 'vitest';
import { andThen as then, apply, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand } from '../fixtures/cardTest';
import { onField } from '../fixtures/setHelpers';
import { OPP, OPP_G1, pw, unitAt } from '../fixtures/shapeChecks';

const ROUND_TABLE = 'BT10-003'; // [CONT](VC) LB4: +2000 per "Liberator" rear-guard on your turn
const LIBERATOR = 'TD08-004'; // Liberator of Silence, Gallatin
const THE_BLOOD = 'BT09-008'; // [ACT](VC) LB5 [CB3]
const LILY = 'EB10-004'; // [AUTO](VC) LB4 [CB2] when it attacks a vanguard
const DUO = 'EB10-010';

describe('Limit Break', () => {
  it('[CONT] LB4 is checked continuously: it turns on and off as the damage zone changes', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: ROUND_TABLE, front_left: LIBERATOR, back_left: LIBERATOR },
        damage: vanilla(3),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    // a fourth damage card (e.g. a damage check) turns it on at once
    s.players[0].damage.push(s.players[0].deck.pop()!);
    expect(pw(s, vg)).toBe(base + 4000);
    // a heal back to three turns it off again
    s.players[0].drop.push(s.players[0].damage.pop()!);
    expect(pw(s, vg)).toBe(base);
  });

  it('[CONT] LB4 counts face-down damage too (it counts cards, not face-up cards)', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: ROUND_TABLE, front_left: LIBERATOR }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const on = pw(s, vg);
    for (const id of s.players[0].damage) s.cards[id]!.faceUp = false;
    expect(pw(s, vg)).toBe(on);
  });

  it("[CONT] LB4 belongs to its master: the opponent's damage does not count", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: ROUND_TABLE, front_left: LIBERATOR }, damage: vanilla(3) },
      defender: { circles: { vanguard: OPP }, damage: vanilla(5) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    s.players[0].damage.push(s.players[0].deck.pop()!);
    expect(pw(s, vg)).toBe(base + 2000);
    s.players[0].drop.push(s.players[0].damage.pop()!);
    expect(pw(s, vg)).toBe(base);
  });

  it('[ACT] LB5 (Ultimate Break) cannot be activated with four damage, can with five', () => {
    const at = (n: number) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: THE_BLOOD }, damage: vanilla(n) },
        defender: { circles: { vanguard: OPP } },
      });
      return () => apply(s, activate(unitAt(s, 0, 'vanguard')));
    };
    expect(at(4)).toThrow(/Limit Break/);
    expect(at(5)).not.toThrow();
  });

  it('[AUTO] LB4 does not trigger with three damage', () => {
    const s = scene({
      attacker: { circles: { vanguard: LILY, front_left: DUO }, damage: vanilla(3) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      extra: [[DUO], []],
    });
    const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(onField(r.state, 0)).toContain(unitAt(s, 0, 'front_left'));
  });

  it('[AUTO] LB4 that triggered still resolves when the damage drops below four before it resolves (CR 10.2.5.3.2.1)', () => {
    const s = scene({
      attacker: { circles: { vanguard: LILY, front_left: DUO }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      extra: [[DUO], []],
    });
    const duo = unitAt(s, 0, 'front_left');
    const r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    // the ability has triggered and waits for "pay the cost?"; a heal now leaves three damage
    expect(r.state.pendingChoice?.kind).toBe('yes_no');
    r.state.players[0].drop.push(r.state.players[0].damage.pop()!);
    const done = drain(r);
    expect(done.state.players[0].hand).toContain(duo);
    expect(boosts(done, duo, 0)).toBe(0);
  });
  it('at three damage, an effect that puts a card from the deck into the damage zone enables Limit Break at once', () => {
    const LEOPALD = 'BT13-019'; // School Punisher, Leo-pald "Яeverse": [ACT](VC) LB4
    const BUNTA = 'BT07-048'; // Explosion Scientist, Bunta: placed, [CB1] top of the deck into the damage zone
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: LEOPALD }, hand: [BUNTA], damage: vanilla(3) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(() => apply(s, activate(vg, '1'))).toThrow(/Limit Break/);
    const r = drain(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, BUNTA), circle: 'front_left' }),
    );
    expect(r.state.players[0].damage).toHaveLength(4);
    expect(() => then(r, activate(vg, '1'))).not.toThrow();
  });
});
