/**
 * The sound manager (roadmap phase 2): one per app, outside React, so music never restarts when the
 * UI re-renders. Plays sound-effect cues (./cues.ts → ./synth.ts) and background music
 * (./music.ts) on separate volume buses. Without Web Audio (tests, odd systems) or when muted it
 * does nothing; the game never depends on it.
 */
import type { Cue } from './cues';
import { Music, type Track } from './music';
import { Synth } from './synth';

export interface AudioSettings {
  /** 0–100 */
  readonly musicVolume: number;
  /** 0–100 */
  readonly sfxVolume: number;
  readonly muted: boolean;
}

/** Same cue again within this time is skipped (several quick updates from one action). */
const REPEAT_MS = 90;
/** Spacing between the cues of one batch. */
const STAGGER_S = 0.07;

class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private synth: Synth | null = null;
  private music: Music | null = null;
  private settings: AudioSettings = { musicVolume: 50, sfxVolume: 70, muted: false };
  private wanted: Track | null = null;
  private lastPlayed = new Map<Cue, number>();

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
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(master);
    this.musicBus.connect(master);
    this.synth = new Synth(this.ctx, this.sfxBus);
    this.music = new Music(this.ctx, this.musicBus, () => this.synth!.noise());
    this.applyVolumes();
    // browsers start audio suspended until the user interacts
    const resume = () => void this.ctx?.resume();
    globalThis.addEventListener?.('pointerdown', resume);
    globalThis.addEventListener?.('keydown', resume);
    return true;
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    const level = (v: number) => (this.settings.muted ? 0 : Math.max(0, Math.min(100, v)) / 100);
    // music sits under the effects
    this.musicBus.gain.setTargetAtTime(level(this.settings.musicVolume) * 0.35, t, 0.08);
    this.sfxBus.gain.setTargetAtTime(level(this.settings.sfxVolume) * 0.9, t, 0.03);
  }

  configure(settings: AudioSettings): void {
    this.settings = settings;
    if (!this.ctx && (settings.muted || (settings.musicVolume <= 0 && settings.sfxVolume <= 0)))
      return;
    if (!this.ensure()) return;
    this.applyVolumes();
    // stop the music sequencer entirely while it cannot be heard
    const audible = !settings.muted && settings.musicVolume > 0;
    this.music!.play(audible ? this.wanted : null, 0.6);
  }

  /** The background music for the current screen (null = silence). */
  setMusic(track: Track | null): void {
    this.wanted = track;
    const audible = !this.settings.muted && this.settings.musicVolume > 0;
    if (!audible || !this.ensure()) return;
    this.music!.play(track);
  }

  /** Plays the cues of one batch of events, most important first, slightly staggered. */
  play(cues: readonly Cue[]): void {
    if (cues.length === 0 || this.settings.muted || this.settings.sfxVolume <= 0) return;
    if (!this.ensure()) return;
    const now = performance.now();
    let delay = 0;
    for (const cue of cues) {
      if (now - (this.lastPlayed.get(cue) ?? -Infinity) < REPEAT_MS) continue;
      this.lastPlayed.set(cue, now);
      const synth = this.synth!;
      if (delay === 0) synth.play(cue);
      else setTimeout(() => synth.play(cue), delay * 1000);
      delay += STAGGER_S;
      if (cue === 'victory' || cue === 'defeat') {
        // the result stinger replaces the battle music
        this.wanted = null;
        this.music?.play(null, 0.4);
      }
    }
  }
}

export const audio = new AudioManager();
export type { Cue, Track };
