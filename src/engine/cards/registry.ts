import { validateAbilities } from '../abilities/validate';
import { CardDefinitionError } from '../errors';
import type { CardDefinition } from './types';

/** Read-only lookup of card definitions. Not part of GameState; shared by engine, deck builder and UI. */
export class CardRegistry {
  private readonly byId = new Map<string, CardDefinition>();
  /** Card IDs that have at least one ability of each kind (fast skips in hot paths). */
  private readonly withKind = {
    AUTO: new Set<string>(),
    ACT: new Set<string>(),
    CONT: new Set<string>(),
  };

  constructor(
    definitions: Iterable<CardDefinition>,
    /** Card-data version recorded in saves and replays. */
    readonly dataVersion: string,
  ) {
    for (const def of definitions) {
      if (this.byId.has(def.id)) {
        throw new CardDefinitionError(`Duplicate card ID ${def.id}`, { id: def.id });
      }
      const problems = validateAbilities(def.id, def.abilities);
      if (problems.length > 0) {
        throw new CardDefinitionError(`Invalid abilities on ${def.id}`, { id: def.id, problems });
      }
      this.byId.set(def.id, Object.freeze({ ...def }));
      for (const a of def.abilities) this.withKind[a.kind].add(def.id);
    }
  }

  get(id: string): CardDefinition {
    const def = this.byId.get(id);
    if (!def) throw new CardDefinitionError(`Unknown card ID ${id}`, { id });
    return def;
  }

  /** Does card `id` have an ability of this kind? */
  hasAbility(id: string, kind: 'AUTO' | 'ACT' | 'CONT'): boolean {
    return this.withKind[kind].has(id);
  }

  /** Does any card in the registry have an ability of this kind? */
  anyAbility(kind: 'AUTO' | 'ACT' | 'CONT'): boolean {
    return this.withKind[kind].size > 0;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  all(): CardDefinition[] {
    return [...this.byId.values()];
  }
}
