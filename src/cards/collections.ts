/**
 * Cards shown in another collection than the product their data file comes from (prompt pack
 * 2026-11-15, 3.4). The card keeps its id (and so its card art and every saved deck entry); only
 * its `set`, which decides format legality and the set filters, changes.
 *
 * G-PR: G era promotional cards. The five 2014 PR cards with [Generation Break] (PR/0265, 0269,
 * 0270, 0272, 0273, checked against the official 【2014年度】 PR list text) were dead cards in the
 * Original Era (no G zone, UNRESOLVED_RULINGS); they belong with the G era.
 */
export const G_PROMO_SET = 'G-PR';

export const COLLECTION_OF: Readonly<Record<string, string>> = {
  'PR14-0265': G_PROMO_SET, // Extreme Leader, Raybird
  'PR14-0269': G_PROMO_SET, // Sanctuary Guard Guarantee
  'PR14-0270': G_PROMO_SET, // Magical Gambler
  'PR14-0272': G_PROMO_SET, // Hydro Lance, Tzanis
  'PR14-0273': G_PROMO_SET, // Label Pangolin
};
