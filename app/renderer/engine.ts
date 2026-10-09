/** The renderer's single connection to the rules engine and card database. */
import { cardRegistry, SETS } from '../../src/cards';
import {
  EARLY_BT01_BT17_FORMAT,
  EARLY_VANGUARD_RULES,
  HIDDEN,
  type CardDefinition,
  type EngineContext,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../../src/engine';

export const ctx: EngineContext = {
  registry: cardRegistry(),
  ruleset: EARLY_VANGUARD_RULES,
  format: EARLY_BT01_BT17_FORMAT,
};

/** The human always plays seat 0 and is drawn at the bottom; the AI is seat 1, on top. */
export const ME: PlayerId = 0;
export const AI: PlayerId = 1;

export interface CardMeta {
  readonly number: string;
  readonly rarity: string;
}
const META = new Map<string, CardMeta>();
for (const { file } of SETS) {
  for (const c of file.cards)
    META.set(c.id, { number: c.en?.number ?? c.jp?.number ?? c.id, rarity: c.rarity });
}
export const metaOf = (definitionId: string): CardMeta | null => META.get(definitionId) ?? null;

/** The card's definition, or null when the viewer cannot see it (or it is locked face down). */
export function defOf(s: GameState, id: InstanceId): CardDefinition | null {
  const card = s.cards[id];
  if (!card || card.definitionId === HIDDEN) return null;
  return ctx.registry.get(card.definitionId);
}

/** Local art path (assets/cards, personal use only: D-018). */
export const artUrl = (definitionId: string, ext = 'png') => {
  const path = `${definitionId.slice(0, 4)}/${definitionId}.${ext}`;
  // the desktop app serves optional art from a folder outside the build (app/main/main.cjs);
  // the Vite dev server and tests serve it from assets/ as `cards/…`
  return globalThis.location?.protocol === 'file:' ? `vgart://cards/${path}` : `cards/${path}`;
};
/** Card art comes as .png (older sets) or .jpg (BT09 on, TD08 on): tried in this order. */
export const ART_EXTENSIONS = ['png', 'jpg'] as const;

export const CLAN_COLORS: Record<string, string> = {
  'Royal Paladin': '#4fb3ff',
  Kagero: '#ff5a3c',
  'Oracle Think Tank': '#f2d15c',
  'Nova Grappler': '#ffa53a',
  'Dark Irregulars': '#a466ff',
  Granblue: '#43d9b8',
  Megacolony: '#9fe04a',
  Nubatama: '#7c7cff',
  'Spike Brothers': '#ff7a2f',
  Tachikaze: '#c9a26b',
  'Bermuda Triangle': '#ff7ad1',
  'Great Nature': '#6bdc6b',
  'Shadow Paladin': '#c03a5c',
  'Gold Paladin': '#ffc94a',
  'Angel Feather': '#ff9fc4',
  Genesis: '#ffe08a',
  'Aqua Force': '#3fa0ff',
  Narukami: '#ffd23a',
  'Pale Moon': '#b07aff',
  Murakumo: '#7aa0c0',
  'Dimension Police': '#5ad0ff',
  'Neo Nectar': '#9be36b',
  'Link Joker': '#ff3a6a',
};
export const clanColor = (clan: string | undefined) => (clan && CLAN_COLORS[clan]) || '#8aa4c8';
