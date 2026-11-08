/**
 * What each sound is made of (docs/audio/AUDIO_PLAN.md): layers of recorded samples (Kenney, CC0:
 * assets/audio/manifest/audio_assets.json), each with its own level and timing. Subtle by design
 * (the user's brief): a crisp card, a small digital accent, nothing long in routine play.
 *
 * `land` layers wait for the card's slide animation to arrive (board/motion.ts), so a call or a
 * ride sounds when the card lands, not when the button is pressed; the other layers start at once
 * (a whoosh, a rising energy). `at` is a further delay in seconds.
 */
import type { Cue } from './cues';

export type AudioCategory = 'card' | 'battle' | 'ui' | 'music' | 'ambient';
export const SFX_CATEGORIES = ['card', 'battle', 'ui'] as const;

/** Interface sounds (not engine events): buttons, selecting a card, a refused action. */
export type UiSound = 'press' | 'confirm' | 'cancel' | 'invalid' | 'select' | 'deselect';

export interface Layer {
  /** sample group: `assets/audio/sfx/<group>_NN.ogg`, one variation picked at random */
  readonly sample: string;
  /** 0–1 */
  readonly gain: number;
  readonly at?: number;
  readonly land?: boolean;
  /** playback rate range, a little pitch variety for repeated sounds */
  readonly rate?: readonly [number, number];
}

export interface SoundDef {
  readonly category: Exclude<AudioCategory, 'music' | 'ambient'>;
  readonly layers: readonly Layer[];
  /** the same sound again within this time is skipped (one action, several updates) */
  readonly cooldownMs: number;
}

const VARY: readonly [number, number] = [0.94, 1.06];

export const CUE_SOUNDS: Record<Cue, SoundDef> = {
  // ---- card actions
  draw: {
    category: 'card',
    cooldownMs: 90,
    layers: [{ sample: 'card/slide', gain: 0.32, rate: VARY }],
  },
  call: {
    category: 'card',
    cooldownMs: 90,
    layers: [
      { sample: 'card/slide', gain: 0.18, rate: VARY },
      { sample: 'card/place', gain: 0.5, land: true, rate: VARY },
      { sample: 'card/shimmer', gain: 0.1, land: true, at: 0.03 },
    ],
  },
  superiorCall: {
    category: 'card',
    cooldownMs: 90,
    layers: [
      { sample: 'ride/rise', gain: 0.2 },
      { sample: 'card/place', gain: 0.5, land: true, rate: VARY },
      { sample: 'card/shimmer', gain: 0.14, land: true, at: 0.03 },
    ],
  },
  retire: {
    category: 'card',
    cooldownMs: 90,
    layers: [{ sample: 'card/shove', gain: 0.3, rate: VARY }],
  },
  discard: {
    category: 'card',
    cooldownMs: 90,
    layers: [{ sample: 'card/slide', gain: 0.25, rate: VARY }],
  },
  shuffle: { category: 'card', cooldownMs: 400, layers: [{ sample: 'card/shuffle', gain: 0.3 }] },
  ride: {
    category: 'card',
    cooldownMs: 150,
    layers: [
      { sample: 'ride/energy', gain: 0.2 },
      { sample: 'card/place_heavy', gain: 0.62, land: true },
      { sample: 'card/shimmer_long', gain: 0.12, land: true, at: 0.04 },
    ],
  },
  legion: {
    category: 'card',
    cooldownMs: 150,
    layers: [
      { sample: 'ride/rise_long', gain: 0.22 },
      { sample: 'card/place_heavy', gain: 0.55, land: true },
      { sample: 'card/shimmer_long', gain: 0.14, land: true, at: 0.04 },
    ],
  },
  stride: {
    category: 'card',
    cooldownMs: 150,
    layers: [
      { sample: 'stride/swell', gain: 0.3 },
      { sample: 'ride/energy', gain: 0.18, at: 0.05 },
      { sample: 'card/place_heavy', gain: 0.62, land: true },
      { sample: 'card/shimmer_long', gain: 0.14, land: true, at: 0.05 },
    ],
  },
  // ---- guarding
  guard: {
    category: 'battle',
    cooldownMs: 90,
    layers: [
      { sample: 'card/place', gain: 0.42, land: true, rate: VARY },
      { sample: 'guard/shield', gain: 0.22, land: true, at: 0.02 },
    ],
  },
  gGuard: {
    category: 'battle',
    cooldownMs: 120,
    layers: [
      { sample: 'ride/rise', gain: 0.18 },
      { sample: 'card/place_heavy', gain: 0.5, land: true },
      { sample: 'guard/shield', gain: 0.25, land: true, at: 0.02 },
    ],
  },
  intercept: {
    category: 'battle',
    cooldownMs: 90,
    layers: [{ sample: 'card/shove', gain: 0.4, rate: VARY }],
  },
  perfectGuard: {
    category: 'battle',
    cooldownMs: 300,
    layers: [
      { sample: 'ride/energy', gain: 0.22 },
      { sample: 'guard/shield_big', gain: 0.3, at: 0.05 },
    ],
  },
  // ---- battle
  attack: {
    category: 'battle',
    cooldownMs: 120,
    layers: [
      { sample: 'battle/zap', gain: 0.16 },
      { sample: 'card/slide', gain: 0.18, rate: VARY },
    ],
  },
  boost: { category: 'battle', cooldownMs: 120, layers: [{ sample: 'ride/rise', gain: 0.1 }] },
  hit: {
    category: 'battle',
    cooldownMs: 150,
    layers: [{ sample: 'battle/hit', gain: 0.38, rate: VARY }],
  },
  criticalHit: {
    category: 'battle',
    cooldownMs: 150,
    layers: [
      { sample: 'battle/hit', gain: 0.42 },
      { sample: 'battle/bell', gain: 0.12, at: 0.04 },
    ],
  },
  noHit: {
    category: 'battle',
    cooldownMs: 150,
    layers: [{ sample: 'battle/blocked', gain: 0.22, rate: VARY }],
  },
  damage: { category: 'battle', cooldownMs: 150, layers: [{ sample: 'battle/thud', gain: 0.28 }] },
  // ---- checks
  driveCheck: { category: 'battle', cooldownMs: 120, layers: [{ sample: 'card/fan', gain: 0.32 }] },
  damageCheck: {
    category: 'battle',
    cooldownMs: 120,
    layers: [
      { sample: 'card/slide', gain: 0.3, rate: [0.86, 0.92] },
      { sample: 'battle/thud', gain: 0.16, at: 0.08 },
    ],
  },
  trigger: {
    category: 'battle',
    cooldownMs: 150,
    layers: [
      { sample: 'ride/rise_long', gain: 0.2 },
      { sample: 'card/shimmer', gain: 0.14, at: 0.06 },
    ],
  },
  heal: {
    category: 'battle',
    cooldownMs: 150,
    layers: [
      { sample: 'checks/trigger', gain: 0.22 },
      { sample: 'card/shimmer_long', gain: 0.12, at: 0.05 },
    ],
  },
  lock: { category: 'battle', cooldownMs: 150, layers: [{ sample: 'battle/lock', gain: 0.2 }] },
  ability: { category: 'battle', cooldownMs: 200, layers: [{ sample: 'ui/ability', gain: 0.14 }] },
  // ---- turn flow and results (interface)
  phase: { category: 'ui', cooldownMs: 200, layers: [{ sample: 'ui/tick', gain: 0.16 }] },
  finalTurn: {
    category: 'ui',
    cooldownMs: 2000,
    layers: [
      { sample: 'ride/rise_long', gain: 0.3 },
      { sample: 'ui/bong', gain: 0.3, at: 0.2 },
    ],
  },
  turn: { category: 'ui', cooldownMs: 400, layers: [{ sample: 'ui/bong', gain: 0.22 }] },
  victory: { category: 'ui', cooldownMs: 1000, layers: [{ sample: 'result/victory', gain: 0.4 }] },
  defeat: { category: 'ui', cooldownMs: 1000, layers: [{ sample: 'result/defeat', gain: 0.36 }] },
};

export const UI_SOUNDS: Record<UiSound, SoundDef> = {
  press: { category: 'ui', cooldownMs: 50, layers: [{ sample: 'ui/click', gain: 0.22 }] },
  confirm: { category: 'ui', cooldownMs: 80, layers: [{ sample: 'ui/confirm', gain: 0.22 }] },
  cancel: { category: 'ui', cooldownMs: 80, layers: [{ sample: 'ui/back', gain: 0.22 }] },
  invalid: { category: 'ui', cooldownMs: 200, layers: [{ sample: 'ui/error', gain: 0.2 }] },
  select: { category: 'card', cooldownMs: 50, layers: [{ sample: 'card/select', gain: 0.2 }] },
  deselect: { category: 'card', cooldownMs: 50, layers: [{ sample: 'ui/back', gain: 0.14 }] },
};

/** The sounds played at the start of a game, loaded ahead so the first ones are not late. */
export const PRELOAD = [
  'card/slide',
  'card/place',
  'card/place_heavy',
  'card/shimmer',
  'card/shimmer_long',
  'card/fan',
  'ride/energy',
  'battle/zap',
  'battle/hit',
  'guard/shield',
  'ui/click',
  'ui/tick',
  'ui/bong',
] as const;
