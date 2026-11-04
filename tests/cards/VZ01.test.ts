/** VZ01 (the "Cardfight!! Vanguard 0" Start Set) card tests: every scripted card is named here. */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { SETS } from '../../src/cards';
import { STARTER_DECKS } from '../../src/decks/starters';
import { checkZoneInvariant, validateDeck } from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';
import { apply, ctx, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, pw } from '../fixtures/cardTest';
import { onField, settle } from '../fixtures/setHelpers';
import { OPP, OPP_G1, rideIt, unitAt } from '../fixtures/shapeChecks';

const BURST = 'VZ01-001';
const CLAUDIA = 'VZ01-015';
const GALLATIN = 'BT01-021'; // Royal Paladin grade 2, 10000
const MARRON = 'BT01-042'; // Royal Paladin grade 1, 8000
const KAGERO = 'PR11-0016'; // Kagero grade 2, printed 10000

/** Burst attacks; `front` are its front-row rear-guards, `back` a back-row one. */
function burstAttacks(
  front: { left?: string; right?: string },
  back?: string,
  damage: readonly string[] = [GALLATIN, MARRON],
) {
  const s = scene({
    attacker: {
      circles: {
        vanguard: BURST,
        ...(front.left ? { front_left: front.left } : {}),
        ...(front.right ? { front_right: front.right } : {}),
        ...(back ? { back_left: back } : {}),
      },
      damage,
    },
    defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
  });
  const unit = unitAt(s, 0, 'vanguard');
  return { s, unit, r: settle(apply(s, attack(unit, unitAt(s, 1, 'vanguard'), null))) };
}

describe('VZ01: the Vanguard 0 Start Set', () => {
  it('holds the two new cards; the other 17 point at the cards already in the game', () => {
    const file = SETS.find((x) => x.file.set === 'VZ01')!.file;
    expect(file.cards.map((c) => c.id)).toEqual([BURST, CLAUDIA]);
    expect(file.reprints).toHaveLength(17);
    for (const r of file.reprints!) expect(ctx.registry.has(r.id), r.number).toBe(true);
    expect(ctx.format.legalSets).toContain('VZ01');
  });

  it('VZ01-001 Blaster Blade Burst has the official English text and is a Royal Paladin', () => {
    const d = ctx.registry.get(BURST);
    expect(d.name).toBe('Blaster Blade Burst');
    expect(d.clan).toBe('Royal Paladin');
    expect(d.unofficialTranslation).toBeUndefined();
  });

  it('VZ01-001: your units cannot boost it', () => {
    const s = scene({
      attacker: { circles: { vanguard: BURST, back_center: MARRON } },
      defender: { circles: { vanguard: OPP } },
    });
    const unit = unitAt(s, 0, 'vanguard');
    expect(() =>
      apply(s, attack(unit, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))),
    ).toThrow();
  });

  it('VZ01-001: attacking a vanguard, +3000', () => {
    const { r, unit } = burstAttacks({}, undefined, []);
    expect(boosts(r, unit, 3000)).toBe(1);
  });

  it('VZ01-001: [CB2 Royal Paladin] + the original power of the front-row Royal Paladin rear-guards', () => {
    const both = burstAttacks({ left: GALLATIN, right: MARRON });
    expect(boosts(both.r, both.unit, 10000 + 8000)).toBe(1);
    // the back row and other clans do not count
    const back = burstAttacks({ left: GALLATIN, right: KAGERO }, MARRON);
    expect(boosts(back.r, back.unit, 10000)).toBe(1);
    const faceDown = (r: typeof both.r) =>
      r.state.players[0].damage.filter((id) => !r.state.cards[id]!.faceUp).length;
    expect(faceDown(both.r)).toBe(2);
    // not enough to pay
    const poor = burstAttacks({ left: GALLATIN }, undefined, [GALLATIN]);
    expect(boosts(poor.r, poor.unit, 10000)).toBe(0);
    // the Counter-Blast must use Royal Paladin cards
    const other = burstAttacks({ left: GALLATIN }, undefined, [GALLATIN, KAGERO]);
    expect(boosts(other.r, other.unit, 10000)).toBe(0);
  });

  it('VZ01-015 Claudia: Forerunner; [ACT] to the soul, a Royal Paladin +3000', () => {
    const ridden = rideIt(MARRON, { vanguard: CLAUDIA });
    expect(
      onField(ridden.r.state, 0).filter((id) => ridden.r.state.cards[id]!.definitionId === CLAUDIA),
    ).toHaveLength(1);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP, front_left: CLAUDIA } },
      defender: { circles: { vanguard: OPP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const claudia = unitAt(s, 0, 'front_left');
    const r = settle(apply(s, activate(claudia, '2')), [vg]);
    expect(r.state.players[0].soul).toContain(claudia);
    expect(pw(r.state, vg)).toBe(10000 + 3000);
    expect(ctx.registry.get(CLAUDIA).unofficialTranslation).toBe(true);
  });

  it("the Blaster Blade Burst starter is legal and uses exactly the product's 19 cards", () => {
    const deck = STARTER_DECKS.find((d) => d.name.includes('Blaster Blade Burst'))!.deck;
    expect(validateDeck(deck, ctx.registry, ctx.format)).toEqual([]);
    expect(deck.cards).toHaveLength(50);
    const file = SETS.find((x) => x.file.set === 'VZ01')!.file;
    const product = new Set([...file.cards.map((c) => c.id), ...file.reprints!.map((r) => r.id)]);
    expect(new Set(deck.cards)).toEqual(product);
  });

  it('the starter plays whole games, and the Burst ability comes up in them', () => {
    const deck = STARTER_DECKS.find((d) => d.name.includes('Blaster Blade Burst'))!.deck;
    let used = 0;
    for (let seed = 0; seed < 6; seed++) {
      const r = runMatch({ seed: seed + 40, decks: [deck, deck] }, ctx, [
        new BasicController(ctx),
        new BasicController(ctx),
      ]);
      expect(r.truncated).toBe(false);
      expect(checkZoneInvariant(r.finalState)).toEqual([]);
      used += r.events.filter(
        (e) =>
          e.type === 'ABILITY_TRIGGERED' &&
          e.abilityId === '2' &&
          r.finalState.cards[e.source]?.definitionId === BURST,
      ).length;
    }
    expect(used).toBeGreaterThan(0);
  }, 120_000);
});
