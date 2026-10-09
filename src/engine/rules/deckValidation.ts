import type { CardRegistry } from '../cards/registry';
import type { CardDefinition } from '../cards/types';
import type { FormatDefinition } from './format';

/** A deck stores card IDs only, never copies of card definitions. */
export interface DeckList {
  /** Card ID of the first vanguard; one copy of it must be in `cards`. */
  readonly firstVanguard: string;
  /** Every card in the deck, including the first vanguard. */
  readonly cards: readonly string[];
}

export interface DeckIssue {
  readonly code:
    | 'UNKNOWN_CARD'
    | 'ILLEGAL_SET'
    | 'DECK_SIZE'
    | 'TOO_MANY_COPIES'
    | 'TRIGGER_COUNT'
    | 'TOO_MANY_HEALS'
    | 'TOO_MANY_SENTINELS'
    | 'FIRST_VANGUARD_MISSING'
    | 'FIRST_VANGUARD_GRADE';
  readonly message: string;
}

/** Returns every problem with the deck; an empty array means the deck is legal. */
/** Copies of a card name allowed in a deck: the format's limit, or the card's own ("up to sixteen"). */
export function maxCopiesOf(def: CardDefinition, format: FormatDefinition): number {
  const own = def.abilities.flatMap((a) =>
    a.kind === 'CONT' ? a.effects.flatMap((e) => (e.ce === 'deck_limit' ? [e.copies] : [])) : [],
  );
  return own[0] ?? format.maxCopiesPerName.value;
}

export function validateDeck(
  deck: DeckList,
  registry: CardRegistry,
  format: FormatDefinition,
): DeckIssue[] {
  const issues: DeckIssue[] = [];

  const unknown = [...new Set(deck.cards.filter((id) => !registry.has(id)))];
  for (const id of unknown) issues.push({ code: 'UNKNOWN_CARD', message: `Unknown card ${id}` });
  const defs = deck.cards.filter((id) => registry.has(id)).map((id) => registry.get(id));

  for (const set of new Set(defs.map((d) => d.set))) {
    if (!format.legalSets.includes(set)) {
      issues.push({ code: 'ILLEGAL_SET', message: `Set ${set} is not legal in ${format.id}` });
    }
  }

  if (deck.cards.length !== format.deckSize.value) {
    issues.push({
      code: 'DECK_SIZE',
      message: `Deck has ${deck.cards.length} cards; must be exactly ${format.deckSize.value}`,
    });
  }

  const copies = new Map<string, number>();
  const limit = new Map<string, number>();
  for (const d of defs) {
    copies.set(d.name, (copies.get(d.name) ?? 0) + 1);
    limit.set(d.name, maxCopiesOf(d, format));
  }
  for (const [name, count] of copies) {
    const max = limit.get(name)!;
    if (count > max) {
      issues.push({
        code: 'TOO_MANY_COPIES',
        message: `${count} copies of "${name}"; max ${max}`,
      });
    }
  }

  const triggers = defs.filter((d) => d.trigger !== null);
  if (triggers.length !== format.triggerCount.value) {
    issues.push({
      code: 'TRIGGER_COUNT',
      message: `Deck has ${triggers.length} triggers; must be exactly ${format.triggerCount.value}`,
    });
  }

  const maxHeals = format.maxHealTriggers.value;
  const heals = triggers.filter((d) => d.trigger === 'heal').length;
  if (maxHeals !== null && heals > maxHeals) {
    issues.push({ code: 'TOO_MANY_HEALS', message: `${heals} heal triggers; max ${maxHeals}` });
  }

  const maxSentinels = format.maxSentinels.value;
  const sentinels = defs.filter((d) => d.sentinel).length;
  if (maxSentinels !== null && sentinels > maxSentinels) {
    issues.push({
      code: 'TOO_MANY_SENTINELS',
      message: `${sentinels} sentinels; max ${maxSentinels}`,
    });
  }

  if (!deck.cards.includes(deck.firstVanguard)) {
    issues.push({
      code: 'FIRST_VANGUARD_MISSING',
      message: `First vanguard ${deck.firstVanguard} is not in the deck`,
    });
  } else if (registry.has(deck.firstVanguard)) {
    const grade = registry.get(deck.firstVanguard).grade;
    if (grade !== format.firstVanguardGrade.value) {
      issues.push({
        code: 'FIRST_VANGUARD_GRADE',
        message: `First vanguard is grade ${grade}; must be grade ${format.firstVanguardGrade.value}`,
      });
    }
  }

  return issues;
}
