/**
 * What the guest is sent. On top of `viewFor`:
 *
 * - **Aliases.** Instance ids are numbered in deck-list order at setup (`p1-05`), so a raw id
 *   says which card a hidden card is. Every id the guest sees is replaced by a random alias,
 *   fixed for the game, and translated back when the guest sends a command.
 * - **Deck order.** Each deck is sent sorted by alias, so its order is not revealed (cards seen
 *   earlier, e.g. returned to the deck, cannot be followed through shuffles).
 * - **Events.** The opponent's choices (what they were offered, what they picked) are dropped.
 */
import { viewFor, type GameEvent, type GameState, type PlayerId } from '../engine';

const INSTANCE_ID = /p[01]-\d{2,3}/g;
const ALIAS = /c[0-9a-f]{8}/g;

/** Maps instance ids to random aliases and back, for one guest and one game. */
export class Aliases {
  private readonly toAlias = new Map<string, string>();
  private readonly toId = new Map<string, string>();

  /** `random` returns a uniform 32-bit unsigned integer (crypto in the app, seeded in tests). */
  constructor(private readonly random: () => number) {}

  alias(id: string): string {
    let a = this.toAlias.get(id);
    if (a === undefined) {
      do a = `c${this.random().toString(16).padStart(8, '0')}`;
      while (this.toId.has(a));
      this.toAlias.set(id, a);
      this.toId.set(a, id);
    }
    return a;
  }

  /** Replaces every instance id inside `value` (strings and object keys) by its alias. */
  out<T>(value: T): T {
    return mapStrings(value, (s) => s.replace(INSTANCE_ID, (id) => this.alias(id))) as T;
  }

  /** Replaces every alias inside `value` by its instance id; unknown aliases are an error. */
  in<T>(value: T): T {
    return mapStrings(value, (s) =>
      s.replace(ALIAS, (a) => {
        const id = this.toId.get(a);
        if (id === undefined) throw new Error(`unknown card ${a}`);
        return id;
      }),
    ) as T;
  }
}

function mapStrings(value: unknown, f: (s: string) => string): unknown {
  if (typeof value === 'string') return f(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, f));
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[f(k)] = mapStrings(v, f);
    return out;
  }
  return value;
}

/** The guest's view of `state`: `viewFor`, aliased, decks in alias order. */
export function guestView(state: GameState, seat: PlayerId, aliases: Aliases): GameState {
  const view = aliases.out(viewFor(state, seat));
  return {
    ...view,
    players: [0, 1].map((p) => ({
      ...view.players[p]!,
      deck: [...view.players[p]!.deck].sort(),
    })) as unknown as GameState['players'],
  };
}

/** The guest's events: the opponent's choices dropped, the rest aliased. */
export function guestEvents(
  events: readonly GameEvent[],
  seat: PlayerId,
  aliases: Aliases,
): GameEvent[] {
  return aliases.out(
    events.filter(
      (e) =>
        !(e.type === 'CHOICE_REQUESTED' && e.choice.player !== seat) &&
        !(e.type === 'CHOICE_MADE' && e.player !== seat),
    ),
  );
}
