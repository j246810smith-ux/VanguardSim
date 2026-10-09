/**
 * The Trial Decks (TD01–TD17 except TD15) as ready-to-play decks (DECISIONS D-023), built from the
 * fixed contents imported from the official product pages (`SetFile.product`).
 */
import { cardRegistry, SETS } from '../cards';
import type { StarterDeck } from './starters';

const registry = cardRegistry();

export const TRIAL_DECKS: readonly StarterDeck[] = SETS.flatMap(({ file }) => {
  const product = file.product;
  if (!product) return [];
  const cards = product.cards.flatMap(({ id, count }) => Array.from({ length: count }, () => id));
  const def = (id: string) => registry.get(id);
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
      name: product.name.replace(/^Trial Deck Vol\.\d+:\s*/, `${file.set} · `),
      description: `Trial Deck (${clans.join(', ')}), exactly as sold.`,
      deck: { firstVanguard: first, cards },
    },
  ];
});
