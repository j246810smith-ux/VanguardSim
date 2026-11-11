import type { CardRegistry } from '../cards/registry';
import type { CardDefinition } from '../cards/types';
import { cardLegalIn, G_SETS, type FormatDefinition } from './format';

/** A deck stores card IDs only, never copies of card definitions. */
export interface DeckList {
  /** Card ID of the first vanguard; one copy of it must be in `cards`. */
  readonly firstVanguard: string;
  /** Every card in the deck, including the first vanguard. */
  readonly cards: readonly string[];
  /** G era (CR 1.48.1 5.3, DECISIONS D-034): the G deck, G units only. Absent = none. */
  readonly gDeck?: readonly string[];
}

export interface DeckIssue {
  readonly code:
    | 'UNKNOWN_CARD'
    | 'ILLEGAL_SET'
    /** Original Era — Expanded: a G era card that is not approved on the OU list. */
    | 'NOT_ON_OU_LIST'
    | 'DECK_SIZE'
    | 'TOO_MANY_COPIES'
    | 'TRIGGER_COUNT'
    | 'TOO_MANY_HEALS'
    | 'TOO_MANY_SENTINELS'
    | 'FIRST_VANGUARD_MISSING'
    | 'FIRST_VANGUARD_GRADE'
    /** CR 1.48.1 5.2.2.6: a G unit in the main deck. */
    | 'G_UNIT_IN_MAIN_DECK'
    /** CR 1.48.1 5.3.3: a card other than a G unit in the G deck. */
    | 'NOT_A_G_UNIT'
    /** CR 1.48.1 5.3.2: more G units than the format allows (none in Classic). */
    | 'G_DECK_SIZE';
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

  // a format may allow single cards from sets it does not (the OU list); say why a card is out
  const name = format.name ?? format.id;
  const reported = new Set<string>();
  for (const d of defs) {
    if (cardLegalIn(d, format) || reported.has(d.id)) continue;
    reported.add(d.id);
    if (format.extraCards && G_SETS.includes(d.set)) {
      issues.push({
        code: 'NOT_ON_OU_LIST',
        message: `${d.name} (${d.id}) is a G era card that is not approved on the OU list v${format.ouListVersion ?? '?'}, so it is not legal in ${name}`,
      });
    } else if (G_SETS.includes(d.set)) {
      issues.push({
        code: 'ILLEGAL_SET',
        message: `${d.name} (${d.id}) is a G era card: not legal in ${name}${format.id === 'EARLY_BT01_BT17' ? ' (approved OU cards are legal in Original Era — Expanded)' : ''}`,
      });
    } else {
      issues.push({
        code: 'ILLEGAL_SET',
        message: `Set ${d.set} is not legal in ${name}`,
      });
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

  issues.push(...validateGDeck(deck, registry, format, defs));
  return issues;
}

/** CR 1.48.1 5.2.2.6 and 5.3: G units only in the G deck, 0–16 of them, four per name. */
function validateGDeck(
  deck: DeckList,
  registry: CardRegistry,
  format: FormatDefinition,
  mainDefs: readonly CardDefinition[],
): DeckIssue[] {
  const issues: DeckIssue[] = [];
  for (const name of new Set(mainDefs.filter((d) => d.cardType === 'g_unit').map((d) => d.name))) {
    issues.push({
      code: 'G_UNIT_IN_MAIN_DECK',
      message: `"${name}" is a G unit: it goes in the G deck, not the main deck`,
    });
  }
  const gDeck = deck.gDeck ?? [];
  const max = format.maxGDeckSize.value;
  if (gDeck.length > max) {
    issues.push({
      code: 'G_DECK_SIZE',
      message:
        max === 0
          ? `${format.id} has no G deck (${gDeck.length} G units)`
          : `G deck has ${gDeck.length} cards; max ${max}`,
    });
  }
  const unknown = [...new Set(gDeck.filter((id) => !registry.has(id)))];
  for (const id of unknown) issues.push({ code: 'UNKNOWN_CARD', message: `Unknown card ${id}` });
  const defs = gDeck.filter((id) => registry.has(id)).map((id) => registry.get(id));
  // a format may allow single cards from sets it does not (the OU list); say why a card is out
  const name = format.name ?? format.id;
  const reported = new Set<string>();
  for (const d of defs) {
    if (cardLegalIn(d, format) || reported.has(d.id)) continue;
    reported.add(d.id);
    if (format.extraCards && G_SETS.includes(d.set)) {
      issues.push({
        code: 'NOT_ON_OU_LIST',
        message: `${d.name} (${d.id}) is a G era card that is not approved on the OU list v${format.ouListVersion ?? '?'}, so it is not legal in ${name}`,
      });
    } else if (G_SETS.includes(d.set)) {
      issues.push({
        code: 'ILLEGAL_SET',
        message: `${d.name} (${d.id}) is a G era card: not legal in ${name}${format.id === 'EARLY_BT01_BT17' ? ' (approved OU cards are legal in Original Era — Expanded)' : ''}`,
      });
    } else {
      issues.push({
        code: 'ILLEGAL_SET',
        message: `Set ${d.set} is not legal in ${name}`,
      });
    }
  }
  for (const name of new Set(defs.filter((d) => d.cardType !== 'g_unit').map((d) => d.name))) {
    issues.push({ code: 'NOT_A_G_UNIT', message: `"${name}" is not a G unit (G deck)` });
  }
  const copies = new Map<string, number>();
  for (const d of defs) copies.set(d.name, (copies.get(d.name) ?? 0) + 1);
  for (const [name, count] of copies) {
    const limit = maxCopiesOf(
      defs.find((d) => d.name === name)!,
      format,
    );
    if (count > limit) {
      issues.push({
        code: 'TOO_MANY_COPIES',
        message: `${count} copies of "${name}" in the G deck; max ${limit}`,
      });
    }
  }
  return issues;
}
