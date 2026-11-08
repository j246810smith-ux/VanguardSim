/**
 * The sound manager (docs/audio/AUDIO_PLAN.md): one per app, outside React, so music never restarts
 * when the UI re-renders. Every sound in the game goes through it: engine cues (./cues.ts) and
 * interface sounds are played from recorded samples (./catalog.ts, ./samples.ts) on their own
 * category buses (card actions, battle, interface, music, ambient) under a master volume. Without
 * Web Audio (tests, odd systems) or when muted it does nothing; the game never depends on it.
 */
import {
  CUE_SOUNDS,
  PRELOAD,
  UI_SOUNDS,
  type AudioCategory,
  type Layer,
  type SoundDef,
  type UiSound,
} from './catalog';
import type { Cue } from './cues';
import { Music, type Track } from './music';
import { bundledTracks, pickTrack, RANDOM, type MusicTrack } from './playlist';
import { SampleBank, variationsOf } from './samples';
import { Synth } from './synth';
import { TrackPlayer } from './trackPlayer';

export interface AudioSettings {
  /** 0–100 each */
  readonly masterVolume: number;
  readonly cardVolume: number;
  readonly battleVolume: number;
  readonly uiVolume: number;
  readonly musicVolume: number;
  readonly ambientVolume: number;
  readonly muted: boolean;
  /** Categories switched off on their own (Settings → Audio). */
  readonly mutedCategories: readonly AudioCategory[];
  /** Battle music: 'random', or a track id (audio/playlist.ts). */
  readonly battleMusic: string;
}

export const DEFAULT_AUDIO: AudioSettings = {
  masterVolume: 80,
  cardVolume: 80,
  battleVolume: 80,
  uiVolume: 60,
  musicVolume: 50,
  ambientVolume: 50,
  muted: false,
  mutedCategories: [],
  battleMusic: RANDOM,
};

const VOLUME_KEY: Record<AudioCategory, keyof AudioSettings> = {
  card: 'cardVolume',
  battle: 'battleVolume',
  ui: 'uiVolume',
  music: 'musicVolume',
  ambient: 'ambientVolume',
};

/** The level (0–1) a category plays at: master × its own volume, 0 when muted. */
export function categoryLevel(s: AudioSettings, category: AudioCategory): number {
  if (s.muted || s.mutedCategories.includes(category)) return 0;
  const v = (n: number) => Math.max(0, Math.min(100, n)) / 100;
  return v(s.masterVolume) * v(s[VOLUME_KEY[category]] as number);
}

/**
 * Silence while the game is not on screen (U17, Android: another app or the home screen in front;
 * Windows: the window minimised), and carry on where it was when it comes back. Returns a
 * function that stops following.
 */
export function pauseWhenHidden(
  doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  ctx: Pick<AudioContext, 'suspend' | 'resume'>,
): () => void {
  const follow = () => void (doc.hidden ? ctx.suspend() : ctx.resume()).catch(() => undefined);
  doc.addEventListener('visibilitychange', follow);
  return () => doc.removeEventListener('visibilitychange', follow);
}

/**
 * Picks a variation, never the one played last when there are others (randomness here is only
 * for sound: the game's own random numbers are the engine's seeded RNG).
 */
export function pickVariation(count: number, last: number | undefined, rnd = Math.random): number {
  if (count <= 1) return 0;
  const i = Math.floor(rnd() * (count - 1));
  return last !== undefined && i >= last ? i + 1 : i;
}

/** Spacing between the sounds of one batch of events. */
const STAGGER_S = 0.07;
/** At most this many samples sound at once; more are skipped (a burst of effects). */
export const MAX_VOICES = 10;

export interface PlayOptions {
  /**
   * When the moved cards land, in ms (board/motion.ts's slide time; 0 when motion is off): the
   * `land` layers of calls, rides and guards wait for it.
   */
  readonly landMs?: number;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private buses: Partial<Record<AudioCategory, GainNode>> = {};
  private bank: SampleBank | null = null;
  private music: Music | null = null;
  private settings: AudioSettings = DEFAULT_AUDIO;
  private wanted: Track | null = null;
  private lastPlayed = new Map<SoundDef, number>();
  private lastVariation = new Map<string, number>();
  private voices = 0;
  private player: TrackPlayer | null = null;
  private tracks: readonly MusicTrack[] = bundledTracks();
  private lastTrack: string | null = null;

  /** Creates the audio graph on first use (only where Web Audio exists). */
  private ensure(): boolean {
    if (this.ctx) return true;
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
    } catch {
      return false;
    }
    const master = this.ctx.createGain();
    // a gentle limiter so stacked sounds never clip
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(this.ctx.destination);
    for (const c of ['card', 'battle', 'ui', 'music', 'ambient'] as const) {
      const bus = this.ctx.createGain();
      bus.connect(master);
      this.buses[c] = bus;
    }
    this.bank = new SampleBank(this.ctx);
    this.bank.preload(PRELOAD);
    // the background music is still the original procedural one; its drums use the synth's noise
    const synth = new Synth(this.ctx, this.buses.music!);
    this.music = new Music(this.ctx, this.buses.music!, () => synth.noise());
    // recorded battle music streams from its file (audio/trackPlayer.ts)
    if (typeof Audio !== 'undefined') this.player = new TrackPlayer();
    this.applyVolumes();
    // browsers start audio suspended until the user interacts; not while the game is hidden
    const resume = () => {
      if (!globalThis.document?.hidden) void this.ctx?.resume();
    };
    globalThis.addEventListener?.('pointerdown', resume);
    globalThis.addEventListener?.('keydown', resume);
    if (globalThis.document) pauseWhenHidden(globalThis.document, this.ctx);
    return true;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [c, bus] of Object.entries(this.buses) as [AudioCategory, GainNode][]) {
      // music sits under the effects
      const scale = c === 'music' ? 0.35 : 1;
      bus.gain.setTargetAtTime(categoryLevel(this.settings, c) * scale, t, 0.05);
    }
    this.player?.setLevel(categoryLevel(this.settings, 'music') * 0.7);
  }

  private anyAudible(s: AudioSettings): boolean {
    return (['card', 'battle', 'ui', 'music'] as const).some((c) => categoryLevel(s, c) > 0);
  }

  configure(settings: AudioSettings): void {
    this.settings = settings;
    if (!this.ctx && !this.anyAudible(settings)) return;
    if (!this.ensure()) return;
    this.applyVolumes();
    // stop the music entirely while it cannot be heard; a battle track carries on where it was
    const audible = categoryLevel(settings, 'music') > 0;
    if (!audible) {
      this.music!.play(null, 0.6);
      return;
    }
    if (this.wanted === 'battle' && this.player?.playing) return;
    this.startMusic(this.wanted, 0.6);
  }

  /** The recorded music now playing (diagnostics, the screenshot mode's music.json). */
  musicState() {
    return {
      wanted: this.wanted,
      level: categoryLevel(this.settings, 'music'),
      context: this.ctx?.state ?? null,
      tracks: this.tracks.length,
      track: this.player?.state() ?? null,
    };
  }

  /** The tracks battle music picks from: the game's own and the player's folder. */
  setBattleTracks(tracks: readonly MusicTrack[]): void {
    this.tracks = tracks;
  }

  /**
   * The background music for the current screen (null = silence). A new battle picks its track
   * (Settings → Audio → Battle music); nothing in a battle restarts it.
   */
  setMusic(track: Track | null): void {
    if (track === this.wanted && (track !== 'battle' || this.player?.playing)) return;
    this.wanted = track;
    if (categoryLevel(this.settings, 'music') <= 0 || !this.ensure()) return;
    this.startMusic(track);
  }

  private startMusic(track: Track | null, fade?: number): void {
    const pick =
      track === 'battle' && this.player
        ? pickTrack(this.tracks, this.settings.battleMusic, this.lastTrack)
        : null;
    if (pick) {
      this.lastTrack = pick.id;
      this.music!.play(null, 0.5);
      this.player!.play(pick.url);
      return;
    }
    this.player?.stop(800);
    this.music!.play(track, fade);
  }

  /** Plays the cues of one batch of engine events, most important first, slightly staggered. */
  play(cues: readonly Cue[], options: PlayOptions = {}): void {
    if (cues.length === 0) return;
    let delay = 0;
    for (const cue of cues) {
      if (this.sound(CUE_SOUNDS[cue], delay, (options.landMs ?? 0) / 1000)) delay += STAGGER_S;
      if (cue === 'victory' || cue === 'defeat') {
        // the result stinger replaces the battle music
        this.wanted = null;
        this.music?.play(null, 0.4);
        this.player?.stop(500);
      }
    }
  }

  /** An interface sound (a button, selecting a card, a refused action). */
  ui(name: UiSound): void {
    this.sound(UI_SOUNDS[name], 0, 0);
  }

  /** Settings → Audio → Test sounds: a short sample of each effect category. */
  test(): void {
    const order: readonly [Cue, number][] = [
      ['call', 0],
      ['ride', 0.5],
      ['guard', 1.1],
      ['attack', 1.6],
      ['hit', 1.9],
      ['trigger', 2.4],
    ];
    for (const [cue, at] of order) this.sound(CUE_SOUNDS[cue], at, 0.25, true);
    this.sound(UI_SOUNDS.confirm, 3.0, 0, true);
  }

  /** Plays one sound; false when it was skipped (muted, too soon after the same one, no Web Audio). */
  private sound(def: SoundDef, delay: number, land: number, force = false): boolean {
    if (categoryLevel(this.settings, def.category) <= 0 || !this.ensure()) return false;
    const now = performance.now();
    if (!force && now - (this.lastPlayed.get(def) ?? -Infinity) < def.cooldownMs) return false;
    this.lastPlayed.set(def, now);
    for (const layer of def.layers) this.layer(def, layer, delay + (layer.land ? land : 0));
    return true;
  }

  private layer(def: SoundDef, layer: Layer, delay: number): void {
    const ctx = this.ctx!;
    const count = variationsOf(layer.sample);
    if (count === 0) return; // a missing sample is silence
    const v = pickVariation(count, this.lastVariation.get(layer.sample));
    this.lastVariation.set(layer.sample, v);
    const startAt = ctx.currentTime + delay + (layer.at ?? 0);
    void this.bank!.load(layer.sample, v).then((buffer) => {
      if (!buffer || this.voices >= MAX_VOICES) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      if (layer.rate) {
        const [lo, hi] = layer.rate;
        src.playbackRate.value = lo + Math.random() * (hi - lo);
      }
      const gain = ctx.createGain();
      gain.gain.value = layer.gain;
      src.connect(gain).connect(this.buses[def.category]!);
      this.voices++;
      src.onended = () => {
        this.voices--;
        gain.disconnect();
      };
      // a sample that loaded late starts now rather than not at all
      src.start(Math.max(ctx.currentTime, startAt));
    });
  }
}

export const audio = new AudioManager();
// read-only: lets the development screenshot mode (app/main/main.cjs runShots) see the music
(globalThis as { __vanguardMusic?: () => unknown }).__vanguardMusic = () => audio.musicState();
export type { Cue, Track };
