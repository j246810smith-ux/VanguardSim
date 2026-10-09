import type { GameState, PlayerState, RuntimeCard } from './types';

const clonePlayer = (p: PlayerState): PlayerState => ({
  ...p,
  deck: [...p.deck],
  hand: [...p.hand],
  soul: [...p.soul],
  drop: [...p.drop],
  damage: [...p.damage],
  guardian: [...p.guardian],
  trigger: [...p.trigger],
  bind: [...p.bind],
  circles: {
    vanguard: [...p.circles.vanguard],
    front_left: [...p.circles.front_left],
    back_left: [...p.circles.back_left],
    back_center: [...p.circles.back_center],
    front_right: [...p.circles.front_right],
    back_right: [...p.circles.back_right],
  },
});

/**
 * Deep copy of GameState (immutable leaf objects such as Modifier and PendingChoice are shared). Hand-written because it runs once per command and is ~10x faster
 * than structuredClone. When GameState gains a nested field, copy it here too; the
 * "clone is independent" test in tests/engine/clone.test.ts guards this.
 */
export function cloneState(s: GameState): GameState {
  const cards: Record<string, RuntimeCard> = {};
  for (const id in s.cards) cards[id] = { ...(s.cards[id] as RuntimeCard) };
  return {
    ...s,
    rng: [...s.rng],
    turnFlags: {
      ...s.turnFlags,
      ...(s.turnFlags.called ? { called: [...s.turnFlags.called] } : {}),
      ...(s.turnFlags.droppedFromRC ? { droppedFromRC: [...s.turnFlags.droppedFromRC] } : {}),
      ...(s.turnFlags.stood ? { stood: [...s.turnFlags.stood] } : {}),
    },
    battle:
      s.battle === null
        ? null
        : {
            ...s.battle,
            extraTargets: [...s.battle.extraTargets],
            guarding: { ...s.battle.guarding },
            hits: [...s.battle.hits],
          },
    // Tasks are replaced, not mutated, except `selection`/`picks`, which get new arrays.
    tasks: s.tasks.map((t) => ({ ...t })),
    pendingChoice: s.pendingChoice,
    modifiers: [...s.modifiers],
    restrictions: [...s.restrictions],
    standby: [...s.standby],
    frames: s.frames.map((f) => ({ ...f, bindings: { ...f.bindings } })),
    usedThisTurn: [...s.usedThisTurn],
    usedThisGame: [...s.usedThisGame],
    everInLegion: [...s.everInLegion],
    grants: [...s.grants],
    suppressions: [...s.suppressions],
    players: [clonePlayer(s.players[0]), clonePlayer(s.players[1])],
    cards,
    losses: { ...s.losses },
  };
}
