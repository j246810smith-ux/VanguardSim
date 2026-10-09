import { DeckValidationError } from '../errors';
import { validateDeck, type DeckList } from '../rules/deckValidation';
import { nextInt, seedRng } from '../rng';
import type { GameEvent } from '../state/events';
import {
  other,
  type GameState,
  type InstanceId,
  type PlayerId,
  type PlayerState,
  type RuntimeCard,
  vanguardOf,
} from '../state/types';
import { emit, type Draft, type EngineContext } from './context';
import { drawCard, moveCard, shuffleDeck } from './zones';

export interface GameSetup {
  readonly seed: number;
  readonly decks: readonly [DeckList, DeckList];
  /** Omit to decide randomly from the seed. */
  readonly firstPlayer?: PlayerId;
}

const emptyPlayer = (id: PlayerId): PlayerState => ({
  id,
  deck: [],
  hand: [],
  soul: [],
  drop: [],
  damage: [],
  guardian: [],
  trigger: [],
  bind: [],
  circles: {
    vanguard: [],
    front_left: [],
    back_left: [],
    back_center: [],
    front_right: [],
    back_right: [],
  },
  hasMulliganed: false,
  pendingLoss: null,
  legion: null,
});

/**
 * Creates a game up to the mulligan: first vanguards face down, decks shuffled, opening hands
 * drawn. Throws DeckValidationError if either deck is illegal in the format.
 */
export function createGame(
  setup: GameSetup,
  ctx: EngineContext,
): { state: GameState; events: GameEvent[] } {
  setup.decks.forEach((deck, player) => {
    const issues = validateDeck(deck, ctx.registry, ctx.format);
    if (issues.length > 0) {
      throw new DeckValidationError(`Player ${player}'s deck is illegal`, { player, issues });
    }
  });

  const rng = seedRng(setup.seed);
  const firstPlayer = setup.firstPlayer ?? (nextInt(rng, 2) as PlayerId);
  const players: [PlayerState, PlayerState] = [emptyPlayer(0), emptyPlayer(1)];
  const cards: Record<InstanceId, RuntimeCard> = {};
  setup.decks.forEach((deck, i) => {
    const owner = i as PlayerId;
    deck.cards.forEach((definitionId, n) => {
      const instanceId = `p${owner}-${String(n + 1).padStart(2, '0')}`;
      cards[instanceId] = {
        instanceId,
        definitionId,
        owner,
        faceUp: false,
        orientation: 'stand',
        locked: false,
      };
      players[owner].deck.push(instanceId);
    });
  });

  const state: GameState = {
    schemaVersion: 1,
    rulesetId: ctx.ruleset.id,
    rulesetVersion: ctx.ruleset.version,
    formatId: ctx.format.id,
    cardDataVersion: ctx.registry.dataVersion,
    seed: setup.seed,
    rng,
    status: 'mulligan',
    phase: 'setup',
    turnNumber: 0,
    firstPlayer,
    activePlayer: firstPlayer,
    pendingMulligan: firstPlayer,
    turnFlags: { normalRideUsed: false },
    battle: null,
    tasks: [],
    pendingChoice: null,
    nextChoiceId: 1,
    nextId: 1,
    modifiers: [],
    restrictions: [],
    standby: [],
    frames: [],
    usedThisTurn: [],
    usedThisGame: [],
    everInLegion: [],
    grants: [],
    suppressions: [],
    players,
    cards,
    abilityHolders: {
      AUTO: Object.keys(cards).filter((id) =>
        ctx.registry.hasAbility(cards[id]!.definitionId, 'AUTO'),
      ),
      ACT: Object.keys(cards).filter((id) =>
        ctx.registry.hasAbility(cards[id]!.definitionId, 'ACT'),
      ),
      CONT: Object.keys(cards).filter((id) =>
        ctx.registry.hasAbility(cards[id]!.definitionId, 'CONT'),
      ),
    },
    winner: null,
    losses: {},
  };
  const d: Draft = { state, events: [], ctx };
  emit(d, { type: 'GAME_CREATED', seed: setup.seed, firstPlayer });

  for (const player of [firstPlayer, other(firstPlayer)]) {
    const firstVanguard = setup.decks[player].firstVanguard;
    const vanguardId = players[player].deck.find((id) => cards[id]?.definitionId === firstVanguard);
    if (vanguardId === undefined) {
      throw new DeckValidationError(`First vanguard ${firstVanguard} not found`, { player });
    }
    moveCard(d, vanguardId, { player, zone: 'circle', circle: 'vanguard' }, 'setup', {
      faceUp: false,
    });
    shuffleDeck(d, player);
    for (let i = 0; i < ctx.ruleset.openingHandSize.value; i++) drawCard(d, player);
  }

  return { state: d.state, events: d.events };
}

/** One player's redraw. Once both have decided, vanguards stand up and turn 1 begins. */
export function mulligan(d: Draft, player: PlayerId, cardIds: readonly InstanceId[]): void {
  const s = d.state;
  const procedure = d.ctx.ruleset.mulliganProcedure.value;
  emit(d, { type: 'MULLIGAN', player, count: cardIds.length });

  if (cardIds.length > 0) {
    for (const id of cardIds) {
      moveCard(d, id, { player, zone: 'deck' }, 'mulligan', { position: 'bottom' });
    }
    if (procedure === 'return_shuffle_draw') shuffleDeck(d, player);
    for (let i = 0; i < cardIds.length; i++) drawCard(d, player);
    if (procedure === 'return_draw_shuffle') shuffleDeck(d, player);
  }
  s.players[player].hasMulliganed = true;

  const next = other(player);
  if (!s.players[next].hasMulliganed) {
    s.pendingMulligan = next;
    return;
  }
  s.pendingMulligan = null;
  for (const p of s.players) {
    const id = vanguardOf(p);
    const vanguard = id === null ? undefined : s.cards[id];
    if (vanguard) vanguard.faceUp = true;
  }
  s.status = 'playing';
  emit(d, { type: 'VANGUARDS_STOOD_UP' });
  s.tasks.push({ kind: 'begin_turn', player: s.firstPlayer });
}
