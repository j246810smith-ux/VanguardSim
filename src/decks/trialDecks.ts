/**
 * The Trial Decks (TD01–TD17 except TD15, G-TD01–G-TD15) and G Legend Decks (G-LD01–G-LD03) as ready-to-play decks (DECISIONS D-023), built from the
 * fixed contents imported from the official product pages (`SetFile.product`).
 */
import { cardRegistry, SETS } from '../cards';
import type { StarterDeck } from './starters';

const registry = cardRegistry();

const ALL_TRIAL_DECKS: readonly StarterDeck[] = SETS.flatMap(({ file }) => {
  const product = file.product;
  if (!product) return [];
  // G Trial Decks (D-034): the G units form the G deck, and the deck is for the G format
  const gEra = file.set.startsWith('G-');
  const def = (id: string) => registry.get(id);
  const all = product.cards.flatMap(({ id, count }) => Array.from({ length: count }, () => id));
  const cards = all.filter((id) => def(id).cardType !== 'g_unit');
  const gDeck = all.filter((id) => def(id).cardType === 'g_unit');
  // the starting vanguard: a single grade 0 normal unit (the product's designated one); TD03 and
  // TD04 have none, so their Forerunner trigger starts (Battleraizer, Lozenge Magus)
  const grade0 = product.cards.filter(({ id }) => def(id).grade === 0 && def(id).trigger === null);
  const text = (id: string) => file.cards.find((c) => c.id === id)?.en?.text ?? '';
  const forerunner = product.cards.find(
    ({ id }) => def(id).grade === 0 && /rides this unit, you may call this card/.test(text(id)),
  );
  const first = (grade0.find((c) => c.count === 1) ?? grade0[0] ?? forerunner ?? product.cards[0])!
    .id;
  const clans = [...new Set(cards.map((id) => def(id).clan))];
  return [
    {
      name: product.name.replace(/^.*(?:Trial|Legend) Deck Vol\. ?\d+:\s*/, `${file.set} · `),
      description: `${gEra ? (/-LD\d/.test(file.set) ? 'G Legend Deck' : 'G Trial Deck') : 'Trial Deck'} (${clans.join(', ')}), exactly as sold.`,
      deck: { firstVanguard: first, cards, ...(gDeck.length > 0 ? { gDeck } : {}) },
      ...(gEra ? { format: 'g' as const } : {}),
    },
  ];
});

/** The Classic Trial Decks (TD01–TD17). */
export const TRIAL_DECKS: readonly StarterDeck[] = ALL_TRIAL_DECKS.filter((d) => !d.format);
/** The G Trial Decks (G format, D-034). */
export const G_TRIAL_DECKS: readonly StarterDeck[] = ALL_TRIAL_DECKS.filter(
  (d) => d.format === 'g',
);
