/**
 * Turns a player's view (hidden cards redacted) into a complete state the engine can simulate,
 * without using any hidden information (blueprint AI_DECISION_ARCHITECTURE: "respect hidden
 * information"):
 *
 * - the AI's own hidden cards (its deck) get definitions drawn from its own deck list, minus the
 *   cards it can already see — it knows what it put in its deck, just not the order;
 * - the opponent's hidden cards (hand and deck) are dealt from a deck inferred from public
 *   information (./sampler.ts: their clan, a typical deck shape, minus cards already seen), or
 *   plain vanilla stand-ins when nothing can be inferred (`realisticOpponent` false).
 *
 * The result is only ever used for lookahead; it is never sent to the engine as the real game.
 */
import {
  HIDDEN,
  other,
  seedRng,
  nextInt,
  type CardDefinition,
  type DeckList,
  type EngineContext,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../engine';
import { sampleOpponentHidden } from './sampler';

/** A vanilla normal unit (no abilities, no trigger) — of `clan` if possible, grade 1 if possible. */
function standIn(ctx: EngineContext, clan: string | null): string {
  const vanilla = ctx.registry
    .all()
    .filter((d: CardDefinition) => d.cardType === 'normal_unit' && d.abilities.length === 0);
  const pick =
    vanilla.find((d) => d.clan === clan && d.grade === 1) ??
    vanilla.find((d) => d.grade === 1) ??
    vanilla[0]!;
  return pick.id;
}

export function determinize(
  view: GameState,
  me: PlayerId,
  myDeck: DeckList | null,
  ctx: EngineContext,
  seed: number,
  realisticOpponent = true,
): GameState {
  const s = structuredClone(view);
  const rng = seedRng(seed);
  const opp = other(me);
  const oppHidden = Object.keys(s.cards).filter(
    (id) => s.cards[id]!.owner === opp && s.cards[id]!.definitionId === HIDDEN,
  );
  const oppSample = realisticOpponent
    ? sampleOpponentHidden(view, ctx, opp, oppHidden.length, rng)
    : [];

  // my deck: what I put in, minus the cards of mine I can see
  const pool: string[] = [...(myDeck?.cards ?? [])];
  for (const card of Object.values(s.cards)) {
    if (card.owner !== me || card.definitionId === HIDDEN) continue;
    const i = pool.indexOf(card.definitionId);
    if (i >= 0) pool.splice(i, 1);
  }
  const myVg = s.players[me].circles.vanguard[0];
  const oppVg = s.players[other(me)].circles.vanguard[0];
  const clanOf = (id: InstanceId | undefined) =>
    id && s.cards[id]!.definitionId !== HIDDEN
      ? ctx.registry.get(s.cards[id]!.definitionId).clan
      : null;
  const myFiller = standIn(ctx, clanOf(myVg));
  const oppFiller = standIn(ctx, clanOf(oppVg));

  for (const id of Object.keys(s.cards)) {
    const card = s.cards[id]!;
    if (card.definitionId !== HIDDEN) continue;
    let def: string;
    if (card.owner === me && pool.length > 0) def = pool.splice(nextInt(rng, pool.length), 1)[0]!;
    else if (card.owner === me) def = myFiller;
    else def = oppSample[oppHidden.indexOf(id)] ?? oppFiller;
    s.cards[id] = { ...card, definitionId: def };
  }
  const has = (kind: 'AUTO' | 'ACT' | 'CONT') =>
    Object.keys(s.cards).filter((id) => ctx.registry.hasAbility(s.cards[id]!.definitionId, kind));
  return { ...s, rng, abilityHolders: { AUTO: has('AUTO'), ACT: has('ACT'), CONT: has('CONT') } };
}
