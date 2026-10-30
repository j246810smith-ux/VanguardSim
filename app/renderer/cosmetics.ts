/**
 * Card sleeves (card backs) and playmats (D-033). Two kinds:
 * - built-in designs drawn with CSS gradients (original, no artwork): ids like `crimson`;
 * - the player's own images, handled like card art: files in `sleeves\` / `playmats\` next to
 *   the program (Artwork Manager → Import), never shipped or sent online: ids `file:<file name>`.
 * Each saved deck chooses a sleeve and a playmat; Settings holds the defaults. Online, only a
 * built-in sleeve is sent to the opponent (an own image shows as the default back there).
 */
import { useEffect, useState, type CSSProperties } from 'react';
import type { OwnCosmetics } from './artwork/api';

const FILE = 'file:';
/** An own image's id, from its file name. */
export const fileId = (name: string) => `${FILE}${name}`;
export const isOwnImage = (id: string | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith(FILE);
/** The name shown for an own image: its file name without the extension. */
export const ownImageName = (id: string) => id.slice(FILE.length).replace(/\.[^.]+$/, '');

/** The address of an own image (desktop app: vgart://cosmetics; dev server: assets/). */
const ownImageUrl = (kind: 'sleeves' | 'playmats', id: string) => {
  const path = `${kind}/${encodeURIComponent(id.slice(FILE.length))}`;
  return globalThis.location?.protocol === 'file:' ? `vgart://cosmetics/${path}` : path;
};

export interface Sleeve {
  readonly id: string;
  readonly name: string;
  /** The back's background (layers of CSS gradients). */
  readonly background: string;
  readonly border: string;
  /** The emblem's outline and glow. */
  readonly emblem: string;
  /** Emblem shape: corner radius and rotation (a diamond, a circle, a square…). */
  readonly shape: { readonly radius: string; readonly rotate: string };
}

const pattern = (angle: number, color: string, gap = 9) =>
  `repeating-linear-gradient(${angle}deg, ${color} 0 2px, transparent 2px ${gap}px)`;
const glow = (color: string, size = 55) =>
  `radial-gradient(circle at 50% 50%, ${color}, transparent ${size}%)`;
const diamond = { radius: '6px', rotate: '45deg' } as const;

export const SLEEVES: readonly Sleeve[] = [
  {
    id: 'classic',
    name: 'Vanguard Blue',
    background: [
      glow('rgba(80, 140, 255, 0.35)'),
      pattern(45, 'rgba(90, 150, 255, 0.08)'),
      'linear-gradient(160deg, #0d1b3a, #060c1c)',
    ].join(', '),
    border: 'rgba(90, 150, 255, 0.45)',
    emblem: 'rgba(120, 180, 255, 0.6)',
    shape: diamond,
  },
  {
    id: 'crimson',
    name: 'Crimson Flame',
    background: [
      glow('rgba(255, 90, 50, 0.4)'),
      pattern(-45, 'rgba(255, 120, 60, 0.09)', 8),
      'linear-gradient(160deg, #3a0d0d, #1a0505)',
    ].join(', '),
    border: 'rgba(255, 100, 60, 0.5)',
    emblem: 'rgba(255, 160, 80, 0.7)',
    shape: diamond,
  },
  {
    id: 'emerald',
    name: 'Emerald Grove',
    background: [
      glow('rgba(60, 220, 140, 0.32)'),
      pattern(90, 'rgba(80, 220, 150, 0.07)', 11),
      pattern(0, 'rgba(80, 220, 150, 0.07)', 11),
      'linear-gradient(160deg, #0b2a1c, #04140c)',
    ].join(', '),
    border: 'rgba(70, 210, 140, 0.45)',
    emblem: 'rgba(120, 240, 170, 0.6)',
    shape: { radius: '50%', rotate: '0deg' },
  },
  {
    id: 'gold',
    name: 'Royal Gold',
    background: [
      glow('rgba(255, 215, 110, 0.38)'),
      'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255, 220, 130, 0.08) 0 10deg, transparent 10deg 20deg)',
      'linear-gradient(160deg, #3a2c0b, #1a1205)',
    ].join(', '),
    border: 'rgba(255, 210, 100, 0.6)',
    emblem: 'rgba(255, 230, 150, 0.75)',
    shape: diamond,
  },
  {
    id: 'violet',
    name: 'Midnight Violet',
    background: [
      glow('rgba(170, 100, 255, 0.36)'),
      pattern(30, 'rgba(180, 120, 255, 0.08)', 10),
      'linear-gradient(160deg, #22103a, #0d051c)',
    ].join(', '),
    border: 'rgba(170, 110, 255, 0.5)',
    emblem: 'rgba(200, 160, 255, 0.65)',
    shape: { radius: '50%', rotate: '0deg' },
  },
  {
    id: 'abyss',
    name: 'Abyssal Tide',
    background: [
      glow('rgba(40, 220, 210, 0.3)', 60),
      'repeating-radial-gradient(circle at 50% 120%, rgba(60, 220, 210, 0.08) 0 2px, transparent 2px 10px)',
      'linear-gradient(170deg, #062a2e, #021214)',
    ].join(', '),
    border: 'rgba(60, 210, 200, 0.45)',
    emblem: 'rgba(110, 240, 230, 0.6)',
    shape: diamond,
  },
  {
    id: 'sakura',
    name: 'Sakura',
    background: [
      glow('rgba(255, 140, 190, 0.38)'),
      'radial-gradient(circle at 20% 25%, rgba(255, 170, 210, 0.18) 0 3px, transparent 4px)',
      'radial-gradient(circle at 75% 70%, rgba(255, 170, 210, 0.18) 0 3px, transparent 4px)',
      pattern(60, 'rgba(255, 160, 200, 0.06)', 12),
      'linear-gradient(160deg, #3a1028, #1c0612)',
    ].join(', '),
    border: 'rgba(255, 150, 200, 0.5)',
    emblem: 'rgba(255, 190, 220, 0.7)',
    shape: { radius: '50% 0', rotate: '45deg' },
  },
  {
    id: 'shadow',
    name: 'Shadow',
    background: [
      glow('rgba(220, 40, 60, 0.25)', 45),
      pattern(45, 'rgba(255, 255, 255, 0.04)', 6),
      pattern(-45, 'rgba(255, 255, 255, 0.04)', 6),
      'linear-gradient(160deg, #18181c, #050507)',
    ].join(', '),
    border: 'rgba(200, 50, 70, 0.5)',
    emblem: 'rgba(230, 70, 90, 0.65)',
    shape: { radius: '2px', rotate: '0deg' },
  },
  {
    id: 'ivory',
    name: 'Holy Ivory',
    background: [
      glow('rgba(255, 255, 255, 0.5)', 50),
      'repeating-conic-gradient(from 45deg at 50% 50%, rgba(200, 180, 120, 0.12) 0 6deg, transparent 6deg 30deg)',
      'linear-gradient(160deg, #d8d2c2, #9c9480)',
    ].join(', '),
    border: 'rgba(230, 200, 120, 0.8)',
    emblem: 'rgba(180, 140, 50, 0.8)',
    shape: diamond,
  },
  {
    id: 'storm',
    name: 'Thunderstorm',
    background: [
      glow('rgba(255, 230, 80, 0.3)', 45),
      'linear-gradient(115deg, transparent 46%, rgba(255, 230, 90, 0.35) 47%, transparent 49%)',
      'linear-gradient(65deg, transparent 55%, rgba(255, 230, 90, 0.2) 56%, transparent 57%)',
      'linear-gradient(160deg, #1a1a40, #08081c)',
    ].join(', '),
    border: 'rgba(250, 220, 80, 0.55)',
    emblem: 'rgba(255, 240, 120, 0.7)',
    shape: diamond,
  },
];

export const DEFAULT_SLEEVE = 'classic';

/** The sleeve with this id, or the default one (unknown ids, e.g. from a newer game version). */
export const sleeveOf = (id: string | null | undefined): Sleeve =>
  SLEEVES.find((s) => s.id === id) ?? SLEEVES[0]!;

/** A sleeve made from an own image: the picture fills the back, no emblem. */
const ownSleeve = (id: string): Sleeve => ({
  id,
  name: ownImageName(id),
  background: `url("${ownImageUrl('sleeves', id)}") center / cover no-repeat, #10131c`,
  border: 'rgba(255, 255, 255, 0.25)',
  emblem: 'transparent',
  shape: diamond,
});

/** The look of a sleeve id: built-in, own image, or the default for unknown ids. */
export const sleeveLook = (id: string | null | undefined): Sleeve =>
  isOwnImage(id) ? ownSleeve(id!) : sleeveOf(id);

/** CSS variables that card backs inside the element use (styles.css `.card.back`). */
export const sleeveVars = (id: string | null | undefined): CSSProperties => {
  const s = sleeveLook(id);
  return {
    '--sl-bg': s.background,
    '--sl-border': s.border,
    '--sl-emblem': s.emblem,
    '--sl-radius': s.shape.radius,
    '--sl-rotate': s.shape.rotate,
  } as CSSProperties;
};

export interface Playmat {
  readonly id: string;
  readonly name: string;
  /** The battle stage background. */
  readonly background: string;
}

export const PLAYMATS: readonly Playmat[] = [
  {
    id: 'classic',
    name: 'Vanguard Night',
    background: [
      'radial-gradient(ellipse 60% 40% at 50% 28%, rgba(255, 60, 40, 0.1), transparent 70%)',
      'radial-gradient(ellipse 60% 40% at 50% 72%, rgba(40, 140, 255, 0.12), transparent 70%)',
      'linear-gradient(180deg, #080b14 0%, #050810 50%, #060a14 100%)',
    ].join(', '),
  },
  {
    id: 'nebula',
    name: 'Nebula',
    background: [
      'radial-gradient(1px 1px at 12% 20%, rgba(255,255,255,0.7), transparent 2px)',
      'radial-gradient(1px 1px at 33% 80%, rgba(255,255,255,0.6), transparent 2px)',
      'radial-gradient(1px 1px at 58% 12%, rgba(255,255,255,0.6), transparent 2px)',
      'radial-gradient(1px 1px at 81% 64%, rgba(255,255,255,0.7), transparent 2px)',
      'radial-gradient(1px 1px at 92% 30%, rgba(255,255,255,0.5), transparent 2px)',
      'radial-gradient(1px 1px at 22% 55%, rgba(255,255,255,0.5), transparent 2px)',
      'radial-gradient(ellipse 50% 35% at 30% 35%, rgba(150, 70, 255, 0.22), transparent 70%)',
      'radial-gradient(ellipse 45% 35% at 70% 70%, rgba(40, 160, 255, 0.2), transparent 70%)',
      'linear-gradient(180deg, #0a0618, #05030e)',
    ].join(', '),
  },
  {
    id: 'inferno',
    name: 'Inferno',
    background: [
      'radial-gradient(ellipse 70% 30% at 50% 100%, rgba(255, 90, 30, 0.28), transparent 70%)',
      'radial-gradient(ellipse 60% 30% at 50% 0%, rgba(255, 50, 30, 0.18), transparent 70%)',
      'repeating-linear-gradient(0deg, rgba(255, 120, 60, 0.03) 0 2px, transparent 2px 14px)',
      'linear-gradient(180deg, #160604, #0a0302)',
    ].join(', '),
  },
  {
    id: 'verdant',
    name: 'Verdant Glade',
    background: [
      'radial-gradient(ellipse 60% 45% at 50% 50%, rgba(80, 220, 140, 0.13), transparent 70%)',
      'repeating-linear-gradient(60deg, rgba(90, 220, 150, 0.035) 0 1px, transparent 1px 28px)',
      'repeating-linear-gradient(-60deg, rgba(90, 220, 150, 0.035) 0 1px, transparent 1px 28px)',
      'linear-gradient(180deg, #06140c, #030a06)',
    ].join(', '),
  },
  {
    id: 'abyss',
    name: 'Abyssal Depths',
    background: [
      'repeating-radial-gradient(ellipse at 50% 140%, rgba(60, 220, 210, 0.05) 0 2px, transparent 2px 36px)',
      'radial-gradient(ellipse 70% 40% at 50% 15%, rgba(80, 200, 255, 0.12), transparent 70%)',
      'linear-gradient(180deg, #041a20, #01080b)',
    ].join(', '),
  },
  {
    id: 'sanctum',
    name: 'Golden Sanctum',
    background: [
      'repeating-conic-gradient(from 0deg at 50% 47%, rgba(255, 215, 120, 0.04) 0 4deg, transparent 4deg 16deg)',
      'radial-gradient(circle at 50% 47%, rgba(255, 215, 120, 0.16), transparent 45%)',
      'linear-gradient(180deg, #14100a, #090704)',
    ].join(', '),
  },
  {
    id: 'void',
    name: 'Void',
    background: 'linear-gradient(180deg, #050506, #020203)',
  },
];

export const DEFAULT_PLAYMAT = 'classic';

export const playmatOf = (id: string | null | undefined): Playmat =>
  isOwnImage(id)
    ? {
        id: id!,
        name: ownImageName(id!),
        background: `url("${ownImageUrl('playmats', id!)}") center / cover no-repeat, #05070c`,
      }
    : (PLAYMATS.find((m) => m.id === id) ?? PLAYMATS[0]!);

/** The id to send online: a built-in sleeve, or the default for an own image (stays on this PC). */
export const shareableSleeve = (id: string | null | undefined): string =>
  !id || isOwnImage(id) || !SLEEVES.some((s) => s.id === id) ? DEFAULT_SLEEVE : id;

/** The player's own sleeve and playmat images (desktop app only; empty elsewhere). */
export function useOwnCosmetics(): OwnCosmetics {
  const [own, setOwn] = useState<OwnCosmetics>({ sleeves: [], playmats: [] });
  useEffect(() => {
    const list = globalThis.window?.vanguardDesktop?.cosmetics ?? window.artworkManager?.cosmetics;
    void list?.()
      .then(setOwn)
      .catch(() => undefined);
  }, []);
  return own;
}
