/** Shape checks for G-era cards, played with the G trial decks (DECISIONS D-034). */
import { currentPower, currentShield, type GameState } from '../../src/engine';
import { gActivate, gApply, gAttack, gCtx, gScene, settle, type Run } from './gEra';
import type { SideSpec } from './scenario';

export type Deck = 'G-TD01' | 'G-TD02';
const other = (d: Deck): Deck => (d === 'G-TD01' ? 'G-TD02' : 'G-TD01');
/** A grade 3 and a grade 1 from each deck, for the side that is not being tested. */
const G3: Record<Deck, string> = { 'G-TD01': 'G-TD01-003', 'G-TD02': 'G-TD02-004' };
const G1: Record<Deck, string> = { 'G-TD01': 'G-TD01-009', 'G-TD02': 'G-TD02-009' };
const G2: Record<Deck, string> = { 'G-TD01': 'G-TD01-005', 'G-TD02': 'G-TD02-005' };

const atGuard = (s: GameState) => s.battle?.step === 'guard' && s.pendingChoice === null;
export const pw = (s: GameState, id: string) => currentPower(s, gCtx, id);
const at = (s: GameState, p: 0 | 1, c: keyof GameState['players'][0]['circles']) =>
  s.players[p].circles[c].at(-1)!;

/** Scene where player 0 uses `deck` and player 1 holds a card (so battles wait at the guard step). */
export function sceneFor(
  deck: Deck,
  attacker: SideSpec,
  defender: SideSpec = {},
  extra: { at?: 'ride' | 'main' | 'battle'; faceUpG?: number } = {},
) {
  return gScene({
    attacker,
    defender: {
      circles: { vanguard: G3[other(deck)] },
      hand: [G1[other(deck)]],
      ...defender,
    },
    attackerDeck: deck,
    defenderDeck: other(deck),
    ...extra,
  });
}

/** Power the unit on `circle` gained when it attacked a vanguard (with `faceUpG` face-up G units). */
export function attackGain(
  deck: Deck,
  card: string,
  circle: 'vanguard' | 'front_left',
  opts: { faceUpG?: number; damage?: number; boost?: string } = {},
): number {
  const back = circle === 'vanguard' ? 'back_center' : 'back_left';
  const s = sceneFor(
    deck,
    {
      circles: {
        vanguard: circle === 'vanguard' ? card : G3[deck],
        ...(circle === 'front_left' ? { front_left: card } : {}),
        ...(opts.boost ? { [back]: opts.boost } : {}),
      },
      damage: Array.from({ length: opts.damage ?? 0 }, () => G1[deck]),
    },
    {},
    { faceUpG: opts.faceUpG ?? 0 },
  );
  const unit = at(s, 0, circle);
  const r = settle(gAttack(s, circle, opts.boost !== undefined), { stopWhen: atGuard });
  const boost = opts.boost ? gCtx.registry.get(opts.boost).power : 0;
  return pw(r.state, unit) - gCtx.registry.get(card).power - boost;
}

/** Shield the intercepting unit gains (player 1 intercepts with `card` on front_left). */
export function interceptGain(deck: Deck, card: string): number {
  const s = gScene({
    attacker: { circles: { vanguard: G3[other(deck)] } },
    defender: { circles: { vanguard: G3[deck], front_left: card }, hand: [G1[deck]] },
    attackerDeck: other(deck),
    defenderDeck: deck,
  });
  const unit = at(s, 1, 'front_left');
  let r = gAttack(s);
  r = settle(r, { stopWhen: atGuard });
  r = settle(
    { ...r, ...gApply(r.state, { type: 'INTERCEPT', player: 1, unitId: unit }) },
    {
      stopWhen: atGuard,
    },
  );
  return currentShield(r.state, gCtx, unit) - gCtx.registry.get(card).shield;
}

/** Power the defending `card` gains when attacked (as player 1's vanguard). */
export function attackedGain(deck: Deck, card: string): number {
  const s = gScene({
    attacker: { circles: { vanguard: G3[other(deck)] } },
    defender: { circles: { vanguard: card }, hand: [G1[deck]] },
    attackerDeck: other(deck),
    defenderDeck: deck,
  });
  const unit = at(s, 1, 'vanguard');
  const r = settle(gAttack(s), { stopWhen: atGuard });
  return pw(r.state, unit) - gCtx.registry.get(card).power;
}

/** Player 1 guards with the sentinel `card` (discarding another card): the vanguard cannot be hit. */
export function perfectGuards(deck: Deck, card: string): boolean {
  const s = gScene({
    attacker: { circles: { vanguard: G3[other(deck)] } },
    defender: { circles: { vanguard: G3[deck] }, hand: [card, G1[deck]] },
    attackerDeck: other(deck),
    defenderDeck: deck,
  });
  const vg = at(s, 1, 'vanguard');
  let r = settle(gAttack(s), { stopWhen: atGuard });
  const guardId = r.state.players[1].hand.find((id) => r.state.cards[id]!.definitionId === card)!;
  r = settle(gApply(r.state, { type: 'GUARD', player: 1, cardId: guardId }));
  // the battle may already be over (the restriction lasts until end of battle): read the events
  const guarded = r.events.some(
    (e) =>
      e.type === 'RESTRICTION_ADDED' &&
      e.restriction.target === vg &&
      e.restriction.restriction === 'cannot_be_hit',
  );
  const hit = r.events.some((e) => e.type === 'ATTACK_RESOLVED' && e.target === vg && e.hit);
  return guarded && !hit;
}

/**
 * Forerunner: riding the given grade 1 over the grade 0 `card` (the first vanguard) calls it.
 * Returns the run in the main phase and the circle it went to.
 */
export function forerunnerUp(
  deck: Deck,
  card: string,
  opts: { faceUpG?: number; damage?: number } = {},
): { r: Run; circle: 'front_left' | 'back_left' | 'back_center' | null } {
  const s = sceneFor(
    deck,
    { hand: [G1[deck]], damage: Array.from({ length: opts.damage ?? 0 }, () => G1[deck]) },
    {},
    { at: 'ride', faceUpG: opts.faceUpG ?? 0 },
  );
  const g1 = s.players[0].hand[0]!;
  let r = settle(gApply(s, { type: 'RIDE', player: 0, cardId: g1 }));
  r = settle({ ...r, ...gApply(r.state, { type: 'END_PHASE', player: 0 }) });
  if (r.state.phase === 'stride') r = gApply(r.state, { type: 'END_PHASE', player: 0 });
  const circles = ['front_left', 'back_left', 'back_center'] as const;
  const circle =
    circles.find((c) =>
      r.state.players[0].circles[c].some((id) => r.state.cards[id]!.definitionId === card),
    ) ?? null;
  return { r, circle };
}

/** Activate the ACT ability of the unit on `circle` and settle it. */
export function activateAndSettle(r: Run, circle: 'front_left' | 'back_left' | 'back_center') {
  const a = gActivate(r.state, circle);
  return a ? settle(a) : null;
}

export { G1, G2, G3 };
