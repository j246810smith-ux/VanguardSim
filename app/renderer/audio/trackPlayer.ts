/**
 * Plays a recorded music track (battle music) on a loop: two audio elements take turns, the next
 * starting a little before the current one ends and the two crossfading, so the loop has no gap
 * (an MP3's own looping leaves one). Fades in on start and out on stop. Streams from the file, so
 * a three-minute track never sits decoded in memory (the phone). Pauses while the game is hidden.
 */

/** How long before the end the next pass starts, crossfading (seconds). */
export const CROSSFADE_S = 2;
const TICK_MS = 50;

type Element = Pick<
  HTMLAudioElement,
  'src' | 'volume' | 'currentTime' | 'duration' | 'paused' | 'play' | 'pause' | 'preload'
>;

/** A volume ramp, 0–1, by elapsed time (pure, for tests). */
export function ramp(from: number, to: number, elapsedMs: number, totalMs: number): number {
  if (totalMs <= 0 || elapsedMs >= totalMs) return to;
  return from + (to - from) * (elapsedMs / totalMs);
}

interface Voice {
  readonly el: Element;
  /** this element's own fade (0–1), times the player's level */
  fade: number;
  target: number;
  from: number;
  startedAt: number;
  fadeMs: number;
}

export class TrackPlayer {
  private voices: Voice[] = [];
  private url: string | null = null;
  private level = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private hidden = false;
  private blocked = false;

  constructor(
    private readonly make: () => Element = () => new Audio(),
    private readonly now: () => number = () => performance.now(),
  ) {
    globalThis.document?.addEventListener('visibilitychange', () => {
      this.hidden = !!globalThis.document?.hidden;
      for (const v of this.voices) {
        if (this.hidden) v.el.pause();
        else if (v.target > 0 || v.fade > 0) this.start(v.el);
      }
    });
    // a phone may refuse to start music before a tap: try again on the next one
    globalThis.addEventListener?.('pointerdown', () => {
      if (!this.blocked) return;
      this.blocked = false;
      for (const v of this.voices) if (v.target > 0) this.start(v.el);
    });
  }

  /** The track now playing (null when stopped or fading out). */
  get playing(): string | null {
    return this.url;
  }

  /** What plays now, for diagnostics: each pass's position, volume and whether it is paused. */
  state(): { url: string | null; passes: { at: number; volume: number; paused: boolean }[] } {
    return {
      url: this.url,
      passes: this.voices.map((v) => ({
        at: Math.round(v.el.currentTime * 10) / 10,
        volume: Math.round(v.el.volume * 100) / 100,
        paused: v.el.paused,
      })),
    };
  }

  /** The music volume, 0–1 (master × music, from the settings). */
  setLevel(level: number): void {
    this.level = Math.max(0, Math.min(1, level));
    this.apply();
  }

  /** Starts a track with a fade-in; the same track again carries on. */
  play(url: string, fadeMs = 1200): void {
    if (this.url === url && this.voices.some((v) => v.target > 0)) return;
    this.stop(fadeMs * 0.6);
    this.url = url;
    this.voices.push(this.voice(0, fadeMs));
    this.run();
  }

  /** Fades out whatever plays, then stops it. */
  stop(fadeMs = 800): void {
    this.url = null;
    for (const v of this.voices) this.fadeTo(v, 0, fadeMs);
    this.run();
  }

  private voice(at: number, fadeMs: number): Voice {
    const el = this.make();
    el.preload = 'auto';
    el.src = this.url!;
    el.volume = 0;
    try {
      el.currentTime = at;
    } catch {
      // not seekable yet: starts from the beginning anyway
    }
    const v: Voice = { el, fade: 0, target: 1, from: 0, startedAt: this.now(), fadeMs };
    if (!this.hidden) this.start(el);
    return v;
  }

  private start(el: Element): void {
    void el.play()?.catch(() => {
      this.blocked = true;
    });
  }

  private fadeTo(v: Voice, target: number, ms: number): void {
    v.from = v.fade;
    v.target = target;
    v.startedAt = this.now();
    v.fadeMs = ms;
  }

  private run(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** One step: fades, the crossfade into the next pass, and dropping silent voices. */
  tick(): void {
    const t = this.now();
    for (const v of this.voices) v.fade = ramp(v.from, v.target, t - v.startedAt, v.fadeMs);
    const current = this.voices.at(-1);
    if (
      this.url &&
      current &&
      current.target > 0 &&
      !this.hidden &&
      Number.isFinite(current.el.duration) &&
      current.el.duration > CROSSFADE_S * 3 &&
      current.el.duration - current.el.currentTime <= CROSSFADE_S
    ) {
      // the loop: the next pass fades in while this one fades out
      this.fadeTo(current, 0, CROSSFADE_S * 1000);
      this.voices.push(this.voice(0, CROSSFADE_S * 1000));
    }
    for (const v of this.voices.filter((x) => x.target === 0 && x.fade <= 0.001)) {
      v.el.pause();
      v.el.src = '';
    }
    this.voices = this.voices.filter((x) => !(x.target === 0 && x.fade <= 0.001));
    this.apply();
    if (this.voices.length === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private apply(): void {
    for (const v of this.voices) v.el.volume = Math.max(0, Math.min(1, v.fade * this.level));
  }
}
