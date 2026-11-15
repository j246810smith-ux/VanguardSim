/** Break Ride (CR 10.2.5.3.2, "When a <clan> rides this unit") triggers on any ride, in any phase. */
import { describe, expect, it } from 'vitest';
import { andThen as then, apply, find, scene, vanilla } from '../fixtures/bt01';
import { activate, boosts, drain, inHand } from '../fixtures/cardTest';
import { OPP } from '../fixtures/shapeChecks';

const DAUNTLESS = 'BT11-005'; // Dauntless Drive Dragon: Kagero Break Ride (LB4)
const CRUEL = 'EB09-002'; // Cruel Dragon: rides itself in your main phase
const NOUVELLECRITIC = 'EB09-006'; // retires an opposing rear-guard when placed
const NOUVELLE = 'EB09-001';

/** The ability Dauntless Drive Dragon's Break Ride grants (Cruel Dragon grants one of its own). */
const dauntlessGrants = (r: ReturnType<typeof cruelRidesInMainPhase>['r']) =>
  find(r.events, 'ABILITY_GRANTED').filter((e) => e.grant.ability.id === 'dauntless').length;

/** Cruel Dragon superior rides onto Dauntless Drive Dragon during the main phase. */
function cruelRidesInMainPhase(damage: number) {
  const s = scene({
    at: 'main',
    attacker: {
      circles: { vanguard: DAUNTLESS },
      hand: [CRUEL, NOUVELLECRITIC],
      damage: vanilla(damage),
    },
    defender: { circles: { vanguard: OPP, front_left: OPP } },
    extra: [[NOUVELLE], []],
  });
  let r = drain(apply(s, activate(inHand(s, 0, CRUEL), '2')));
  const nv = r.state.players[0].deck.find((x) => r.state.cards[x]!.definitionId === NOUVELLE)!;
  r.state.players[0].deck.splice(r.state.players[0].deck.indexOf(nv), 1);
  r.state.players[0].hand.push(nv);
  r = drain(
    then(r, {
      type: 'CALL',
      player: 0,
      cardId: inHand(r.state, 0, NOUVELLECRITIC),
      circle: 'front_left',
    }),
  );
  const vg = r.state.players[0].circles.vanguard[0]!;
  expect(r.state.cards[vg]!.definitionId).toBe(CRUEL);
  expect(r.state.phase).toBe('main');
  return { r, vg };
}

describe('Break Ride outside the ride phase', () => {
  it('a superior ride in the main phase triggers Break Ride (+10000 and the granted ability)', () => {
    const { r, vg } = cruelRidesInMainPhase(4);
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(dauntlessGrants(r)).toBe(1);
  });

  it('still needs Limit Break 4 at that moment', () => {
    const { r, vg } = cruelRidesInMainPhase(3);
    expect(boosts(r, vg, 10000)).toBe(0);
    expect(dauntlessGrants(r)).toBe(0);
  });
});

/**
 * Prompt pack 2026-11-15, 3.1: "[CONT](RC):Your vanguard's [Limit-Break 4] is active even when you
 * have three or less damage" (BT17 Jewel Knight, Sabremy) also covers a Break Ride, which triggers
 * as the ridden unit leaves (VC) for the soul (look-back, UNRESOLVED_RULINGS "Limit Break enablers").
 */
describe('Break Ride with a Limit Break enabler', () => {
  const ASHLEI = 'BT10-001'; // Royal Paladin Break Ride: +10000/[Critical] +1
  const SABREMY = 'BT17-044';
  function rideOntoAshlei(rearGuard: string | null, damage: number) {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: ASHLEI, ...(rearGuard ? { front_left: rearGuard } : {}) },
        hand: [ASHLEI],
        damage: vanilla(damage),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, ASHLEI) }));
    return { r, vg: r.state.players[0].circles.vanguard.at(-1)! };
  }

  it('the Break Ride resolves with two damage when the enabler is on (RC)', () => {
    const { r, vg } = rideOntoAshlei(SABREMY, 2);
    expect(boosts(r, vg, 10000)).toBe(1);
  });

  it('without the enabler it still needs four damage', () => {
    expect(boosts(rideOntoAshlei(null, 2).r, rideOntoAshlei(null, 2).vg, 10000)).toBe(0);
    const { r, vg } = rideOntoAshlei(null, 4);
    expect(boosts(r, vg, 10000)).toBe(1);
  });
});
