/**
 * Original procedural background music (Web Audio, no recordings): a small step sequencer playing a
 * calm menu theme and a driving battle theme. Notes are scheduled slightly ahead of time, so the
 * loop is seamless and does not restart when the UI re-renders. Changing themes crossfades.
 */
export type Track = 'menu' | 'battle';

interface Theme {
  readonly bpm: number;
  /** Chord roots (MIDI) per bar, and whether each chord is minor. */
  readonly chords: readonly (readonly [number, boolean])[];
  readonly bass: boolean;
  readonly drums: boolean;
  /** Arpeggio note every n sixteenths (0 = none). */
  readonly arpEvery: number;
}

const THEMES: Record<Track, Theme> = {
  // A minor – F – C – G, slow, pads and a gentle arpeggio
  menu: {
    bpm: 84,
    chords: [
      [57, true],
      [53, false],
      [48, false],
      [55, false],
    ],
    bass: false,
    drums: false,
    arpEvery: 2,
  },
  // E minor – C – G – D, driving bass, arpeggio and light drums
  battle: {
    bpm: 116,
    chords: [
      [52, true],
      [48, false],
      [55, false],
      [50, false],
    ],
    bass: true,
    drums: true,
    arpEvery: 1,
  },
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const LOOKAHEAD = 0.15; // seconds scheduled ahead
const TICK_MS = 40;

class Player {
  readonly gain: GainNode;
  private step = 0;
  private nextTime: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly ctx: AudioContext,
    out: AudioNode,
    private readonly theme: Theme,
    private readonly noise: () => AudioBuffer,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.gain.connect(out);
    this.nextTime = ctx.currentTime + 0.05;
  }

  start(): void {
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop(at: number): void {
    setTimeout(
      () => {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.gain.disconnect();
      },
      Math.max(0, (at - this.ctx.currentTime) * 1000) + 200,
    );
  }

  private schedule(): void {
    const sixteenth = 60 / this.theme.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % (16 * this.theme.chords.length);
    }
  }

  private note(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    attack = 0.01,
  ) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.gain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private hat(t: number, peak: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(peak, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(filter).connect(env).connect(this.gain);
    src.start(t, (t * 7.3) % 0.8);
    src.stop(t + 0.06);
  }

  private kick(t: number) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(env).connect(this.gain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  private playStep(step: number, t: number, sixteenth: number): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const [root, minor] = this.theme.chords[bar]!;
    const chord = [root, root + (minor ? 3 : 4), root + 7];
    const barLength = sixteenth * 16;
    // pad: a soft chord across the bar
    if (s === 0) {
      for (const n of chord) this.note(hz(n), t, barLength * 0.98, 'triangle', 0.035, 0.4);
      this.note(hz(root - 12), t, barLength * 0.98, 'sine', 0.05, 0.3);
    }
    // arpeggio over two octaves
    if (this.theme.arpEvery > 0 && s % this.theme.arpEvery === 0) {
      const pattern = [0, 1, 2, 1, 2, 3, 2, 1];
      const idx = pattern[(s / this.theme.arpEvery) % pattern.length]!;
      const n = idx === 3 ? root + 12 : chord[idx]! + 12;
      this.note(hz(n), t, sixteenth * 1.8, 'square', this.theme.drums ? 0.018 : 0.014);
    }
    if (this.theme.bass && s % 2 === 0) {
      this.note(hz(root - 24 + (s % 8 === 6 ? 7 : 0)), t, sixteenth * 1.6, 'sawtooth', 0.045);
    }
    if (this.theme.drums) {
      if (s % 4 === 0) this.kick(t);
      if (s % 4 === 2) this.hat(t, 0.06);
      if (s === 12) this.hat(t, 0.1);
    }
  }
}

export class Music {
  private current: { track: Track; player: Player } | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noise: () => AudioBuffer,
  ) {}

  get track(): Track | null {
    return this.current?.track ?? null;
  }

  /** Crossfade to `track` (null = fade out). The same track keeps playing untouched. */
  play(track: Track | null, fade = 1.5): void {
    if (this.current?.track === track) return;
    const t = this.ctx.currentTime;
    if (this.current) {
      const g = this.current.player.gain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(g.value, 0.0001), t);
      g.exponentialRampToValueAtTime(0.0001, t + fade);
      this.current.player.stop(t + fade);
      this.current = null;
    }
    if (!track) return;
    const player = new Player(this.ctx, this.out, THEMES[track], this.noise);
    player.gain.gain.setValueAtTime(0.0001, t);
    player.gain.gain.exponentialRampToValueAtTime(1, t + fade);
    player.start();
    this.current = { track, player };
  }
}
