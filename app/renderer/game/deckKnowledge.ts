/**
 * Which cards on the top and bottom of each deck this seat knows about, from the events alone, so
 * the table can show their pictures (presentation only). A card is known when `me` put it there
 * or saw it (own deck), or when it came from a public zone or was revealed. An opponent's card
 * from their hand or deck stays unknown, but still counts: it covers what was known below it.
 */
import type { GameEvent, GameState, InstanceId, PlayerId } from '../../../src/engine';
import { HIDDEN } from '../../../src/engine';

interface Placed {
  readonly id: InstanceId;
  /** The card's definition, or null when this seat does not know it. */
  readonly def: string | null;
}

/** The known ends of one player's deck. Index 0 of `top` is the deck's top card. */
export interface DeckEnds {
  readonly top: string | null;
  readonly bottom: string | null;
}

const NONE: DeckEnds = { top: null, bottom: null };

export class DeckKnowledge {
  private readonly tops: [Placed[], Placed[]] = [[], []];
  private readonly bottoms: [Placed[], Placed[]] = [[], []];
  private readonly revealed = new Set<InstanceId>();
  /** Definitions this seat has been shown: an online guest's view hides a card once it is in the deck. */
  private readonly seen = new Map<InstanceId, string>();

  constructor(private readonly me: PlayerId) {}

  /** The pictures to show on `player`'s deck. */
  ends(player: PlayerId): DeckEnds {
    const top = this.tops[player][0]?.def ?? null;
    const bottom = this.bottoms[player].at(-1)?.def ?? null;
    return top || bottom ? { top, bottom } : NONE;
  }

  /** Read one batch of events. `names`: the state after them. */
  update(events: readonly GameEvent[], names: GameState): void {
    for (const [id, card] of Object.entries(names.cards)) {
      if (card.definitionId !== HIDDEN) this.seen.set(id, card.definitionId);
    }
    for (const e of events) {
      switch (e.type) {
        case 'DECK_SHUFFLED':
          this.tops[e.player] = [];
          this.bottoms[e.player] = [];
          break;
        case 'CARDS_REVEALED':
          for (const id of e.instanceIds) this.revealed.add(id);
          break;
        case 'TOP_CARD_KEPT':
          this.place(e.player, e.instanceId, 'top', e.player === this.me);
          break;
        case 'CARD_MOVED': {
          if (e.from.zone === 'deck') this.remove(e.from.player, e.instanceId);
          if (e.to.zone === 'deck' && e.position) {
            const fromHidden = e.from.zone === 'hand' || e.from.zone === 'deck';
            const known = e.to.player === this.me || !fromHidden || this.revealed.has(e.instanceId);
            this.place(e.to.player, e.instanceId, e.position, known);
          }
          this.revealed.delete(e.instanceId);
          break;
        }
        default:
          break;
      }
    }
  }

  private place(player: PlayerId, id: InstanceId, where: 'top' | 'bottom', known: boolean): void {
    this.remove(player, id);
    const placed: Placed = { id, def: known ? (this.seen.get(id) ?? null) : null };
    if (where === 'top') this.tops[player].unshift(placed);
    else this.bottoms[player].push(placed);
  }

  private remove(player: PlayerId, id: InstanceId): void {
    this.tops[player] = this.tops[player].filter((p) => p.id !== id);
    this.bottoms[player] = this.bottoms[player].filter((p) => p.id !== id);
  }
}
