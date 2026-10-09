import {
  nextInt,
  seedRng,
  type Command,
  type GameState,
  type LegalAction,
  type PlayerId,
  type RngState,
} from '../engine';
import type { PlayerController } from './controller';

/**
 * Level 1 AI: picks a uniformly random legal action. Exists to exercise the engine.
 * Uses its own seeded RNG so it never consumes the game's random stream.
 */
export class RandomController implements PlayerController {
  private readonly rng: RngState;

  constructor(
    seed: number,
    private readonly allowConcede = false,
  ) {
    this.rng = seedRng(seed);
  }

  private pick<T>(items: readonly T[]): T {
    const item = items[nextInt(this.rng, items.length)];
    if (item === undefined) throw new Error('RandomController: empty option list');
    return item;
  }

  chooseCommand(_state: GameState, player: PlayerId, actions: readonly LegalAction[]): Command {
    const options = actions.filter((a) => this.allowConcede || a.type !== 'CONCEDE');
    const action = options[nextInt(this.rng, options.length)];
    if (!action) throw new Error(`RandomController: no actions available for player ${player}`);
    switch (action.type) {
      case 'MULLIGAN':
        return {
          type: 'MULLIGAN',
          player,
          cardIds: action.selectable.filter(() => nextInt(this.rng, 2) === 1),
        };
      case 'RIDE':
        return { type: 'RIDE', player, cardId: this.pick(action.cardIds) };
      case 'CALL':
        return {
          type: 'CALL',
          player,
          cardId: this.pick(action.cardIds),
          circle: this.pick(action.circles),
        };
      case 'SWAP_REAR_GUARDS':
        return { type: 'SWAP_REAR_GUARDS', player, column: this.pick(action.columns) };
      case 'ATTACK': {
        const option = this.pick(action.options);
        const boosters = [null, ...option.boosters.map((b) => b.id)];
        return {
          type: 'ATTACK',
          player,
          attacker: option.attacker,
          target: this.pick(option.targets).id,
          booster: this.pick(boosters),
        };
      }
      case 'GUARD':
        return { type: 'GUARD', player, cardId: this.pick(action.cardIds) };
      case 'INTERCEPT':
        return { type: 'INTERCEPT', player, unitId: this.pick(action.unitIds) };
      case 'PASS_GUARD':
        return { type: 'PASS_GUARD', player };
      case 'CHOOSE': {
        const pool = [...action.options];
        const n = action.min + nextInt(this.rng, action.max - action.min + 1);
        const selection = Array.from(
          { length: n },
          () => pool.splice(nextInt(this.rng, pool.length), 1)[0]!,
        );
        return { type: 'CHOOSE', player, choiceId: action.choiceId, selection };
      }
      case 'ACTIVATE': {
        const { source, abilityId } = this.pick(action.options);
        return { type: 'ACTIVATE', player, source, abilityId };
      }
      case 'END_PHASE':
        return { type: 'END_PHASE', player };
      case 'CONCEDE':
        return { type: 'CONCEDE', player };
    }
  }
}
