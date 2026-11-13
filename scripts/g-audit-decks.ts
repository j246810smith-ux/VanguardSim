/**
 * G Era audit decks for the AI tools (`ai:watch --g`, `ai:bench --g`): one legal deck per clan
 * built from the newest G-era cards, with a playable grade spread and a G deck whose G units have
 * a matching heart card in the deck. Our own builds for measuring the AI, not real decklists.
 */
import { SETS } from '../src/cards';
import { validateDeck, type DeckList, type EngineContext } from '../src/engine';

/**
 * A 50-card deck of one clan with a playable grade spread: a grade 0 starter, 16 triggers (at most
 * 4 heals), 14 grade 1 (at most 4 sentinels), 11 grade 2 and 8 grade 3, newest G-era cards first,
 * `include` first among them, 4 copies of each name. Null if the clan lacks the cards.
 */
function gradedDeck(ctx: EngineContext, clan: string, include: string[], gDeck: string[]) {
  const legal = new Set(ctx.format.legalSets);
  const pool = [
    ...include.map((id) => ctx.registry.get(id)),
    ...SETS.slice()
      .reverse()
      .flatMap((x) => x.file.cards)
      .filter(
        (c) =>
          c.en?.clan === clan &&
          c.cardType !== 'g_unit' &&
          legal.has(c.set) &&
          ctx.registry.has(c.id),
      )
      .map((c) => ctx.registry.get(c.id)),
  ];
  const cards: string[] = [];
  const names = new Set<string>();
  const take = (
    want: (d: (typeof pool)[0]) => boolean,
    n: number,
    limit?: (d: (typeof pool)[0]) => boolean,
    max = 99,
  ) => {
    let got = 0;
    let limited = 0;
    for (const d of pool) {
      if (got >= n) break;
      if (names.has(d.name) || !want(d)) continue;
      const copies = Math.min(4, n - got);
      if (limit?.(d)) {
        if (limited + copies > max) continue;
        limited += copies;
      }
      names.add(d.name);
      for (let i = 0; i < copies; i++) cards.push(d.id);
      got += copies;
    }
    return got === n;
  };
  const starter = pool.find((d) => d.grade === 0 && d.trigger === null);
  if (!starter) return null;
  names.add(starter.name);
  const ok =
    take(
      (d) => d.grade === 0 && d.trigger !== null,
      16,
      (d) => d.trigger === 'heal',
      4,
    ) &&
    take(
      (d) => d.grade === 1 && d.trigger === null,
      14,
      (d) => d.sentinel,
      4,
    ) &&
    take((d) => d.grade === 2 && d.trigger === null, 11) &&
    take((d) => d.grade === 3 && d.trigger === null, 8);
  if (!ok) return null;
  const deck = {
    firstVanguard: starter.id,
    cards: [starter.id, ...cards],
    gDeck: gDeck.flatMap((id) => [id, id, id, id]).slice(0, 16),
  };
  return validateDeck(deck, ctx.registry, ctx.format).length === 0 ? deck : null;
}

export function gAuditDecks(ctx: EngineContext): { name: string; deck: DeckList }[] {
  const legal = new Set(ctx.format.legalSets);
  const gUnits = SETS.slice()
    .reverse()
    .flatMap((x) => x.file.cards)
    .filter((c) => c.cardType === 'g_unit' && legal.has(c.set) && ctx.registry.has(c.id));
  const clans = [...new Set(gUnits.map((c) => c.en?.clan).filter((c): c is string => !!c))];
  const out: { name: string; deck: DeckList }[] = [];
  for (const clan of clans) {
    const mine = gUnits.filter((c) => c.en?.clan === clan);
    const names = new Set<string>();
    const pick = (guardian: boolean, n: number) =>
      mine
        .filter((c) => (ctx.registry.get(c.id).gGuardian === true) === guardian)
        .filter((c) => !names.has(c.en!.name) && (names.add(c.en!.name), true))
        .slice(0, n)
        .map((c) => c.id);
    // a G unit whose "heart card with X" condition a grade 3 of the deck meets, and that grade 3
    const grade3 = SETS.flatMap((x) => x.file.cards).filter(
      (c) =>
        c.en?.clan === clan &&
        c.grade === 3 &&
        c.cardType !== 'g_unit' &&
        legal.has(c.set) &&
        ctx.registry.has(c.id),
    );
    const include: string[] = [];
    const keyed: string[] = [];
    for (const c of mine) {
      if (keyed.length >= 2 || ctx.registry.get(c.id).gGuardian) continue;
      const part = /heart card with "([^"]+)"/.exec(c.en?.text ?? '')?.[1];
      const match = part && grade3.find((x) => x.en!.name.includes(part));
      if (!match || names.has(c.en!.name)) continue;
      names.add(c.en!.name);
      keyed.push(c.id);
      if (!include.includes(match.id)) include.push(match.id);
    }
    const g = [...pick(true, 2), ...keyed, ...pick(false, 4)].slice(0, 4);
    const deck = gradedDeck(ctx, clan, include, g);
    if (deck) out.push({ name: `G audit · ${clan}`, deck });
  }
  return out;
}
