/**
 * Original synthesised sound effects (Web Audio; no recorded or third-party audio). Each cue is a
 * short recipe of tones and filtered noise. Routine actions are quiet and short; important ones
 * (ride, perfect guard, triggers, hits) are fuller and more distinctive.
 */
import type { Cue } from './cues';

interface ToneOptions {
  readonly type?: OscillatorType;
  readonly gain?: number;
  readonly attack?: number;
  /** Frequency at the end (a glide). */
  readonly to?: number;
  readonly delay?: number;
}

export class Synth {
  private noiseBuffer: AudioBuffer | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
  ) {}

  noise(): AudioBuffer {
    if (!this.noiseBuffer) {
      const length = this.ctx.sampleRate; // one second, shared with the music
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      // deterministic noise (a small LCG), so every run sounds the same
      let x = 12345;
      for (let i = 0; i < length; i++) {
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (x / 0x3fffffff - 1) * 0.9;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  /** A tone with a fast attack and an exponential release. */
  tone(freq: number, duration: number, o: ToneOptions = {}): void {
    const t = this.ctx.currentTime + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + duration);
    const peak = o.gain ?? 0.2;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.005));
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env).connect(this.out);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** A burst of filtered noise; `to` sweeps the filter. */
  hiss(
    duration: number,
    o: {
      filter?: BiquadFilterType;
      freq?: number;
      to?: number;
      q?: number;
      gain?: number;
      delay?: number;
    } = {},
  ): void {
    const t = this.ctx.currentTime + (o.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise();
    const filter = this.ctx.createBiquadFilter();
    filter.type = o.filter ?? 'bandpass';
    filter.frequency.setValueAtTime(o.freq ?? 2000, t);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + duration);
    filter.Q.value = o.q ?? 1;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(env).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.02);
  }

  play(cue: Cue): void {
    switch (cue) {
      case 'draw':
        this.hiss(0.09, { filter: 'highpass', freq: 3000, to: 6000, gain: 0.07 });
        break;
      case 'discard':
        this.hiss(0.12, { filter: 'lowpass', freq: 2500, to: 600, gain: 0.08 });
        break;
      case 'shuffle':
        for (let i = 0; i < 3; i++)
          this.hiss(0.05, { filter: 'highpass', freq: 2500, gain: 0.06, delay: i * 0.06 });
        break;
      case 'call':
        this.tone(240, 0.14, { to: 150, gain: 0.22 });
        this.hiss(0.04, { filter: 'highpass', freq: 4000, gain: 0.05 });
        break;
      case 'ride':
        this.tone(160, 0.38, { type: 'sawtooth', to: 520, gain: 0.07 });
        this.tone(130, 0.5, { to: 260, gain: 0.18 });
        for (const [f, d] of [
          [659, 0.18],
          [988, 0.24],
          [1319, 0.3],
        ] as const)
          this.tone(f, 0.5, { type: 'triangle', gain: 0.06, delay: d });
        break;
      case 'legion':
        this.tone(200, 0.3, { type: 'sawtooth', to: 600, gain: 0.06 });
        this.tone(300, 0.3, { type: 'sawtooth', to: 900, gain: 0.05, delay: 0.12 });
        this.tone(784, 0.6, { type: 'triangle', gain: 0.08, delay: 0.3 });
        break;
      case 'retire':
        this.tone(320, 0.26, { to: 70, gain: 0.18 });
        this.hiss(0.25, { filter: 'lowpass', freq: 1800, to: 200, gain: 0.08 });
        break;
      case 'attack':
        this.hiss(0.26, { filter: 'bandpass', freq: 600, to: 4000, q: 2, gain: 0.16 });
        this.tone(110, 0.22, { type: 'sawtooth', to: 220, gain: 0.06 });
        break;
      case 'boost':
        this.tone(420, 0.13, { type: 'triangle', to: 840, gain: 0.08, delay: 0.04 });
        break;
      case 'guard':
        this.tone(660, 0.22, { type: 'square', gain: 0.04 });
        this.tone(990, 0.18, { type: 'triangle', gain: 0.06 });
        break;
      case 'intercept':
        this.tone(440, 0.22, { type: 'square', gain: 0.04 });
        this.tone(660, 0.18, { type: 'triangle', gain: 0.06 });
        break;
      case 'perfectGuard':
        this.hiss(0.4, { filter: 'bandpass', freq: 5000, to: 1500, q: 3, gain: 0.08 });
        for (const f of [880, 1320, 1760]) this.tone(f, 0.7, { type: 'triangle', gain: 0.06 });
        this.tone(220, 0.5, { gain: 0.15 });
        break;
      case 'driveCheck':
        this.hiss(0.05, { filter: 'highpass', freq: 3500, gain: 0.07 });
        this.tone(600, 0.1, { type: 'triangle', gain: 0.08, delay: 0.03 });
        break;
      case 'damageCheck':
        this.tone(140, 0.24, { to: 90, gain: 0.2 });
        this.hiss(0.15, { filter: 'lowpass', freq: 900, gain: 0.08 });
        break;
      case 'trigger':
        [880, 1175, 1568, 2093].forEach((f, i) =>
          this.tone(f, 0.25, { type: 'triangle', gain: 0.07, delay: i * 0.05 }),
        );
        break;
      case 'heal':
        for (const f of [523, 659, 784]) this.tone(f, 0.7, { gain: 0.07, attack: 0.05 });
        break;
      case 'hit':
        this.hiss(0.3, { filter: 'lowpass', freq: 1200, to: 150, gain: 0.22 });
        this.tone(95, 0.38, { to: 45, gain: 0.3 });
        break;
      case 'noHit':
        this.tone(300, 0.12, { type: 'square', to: 200, gain: 0.04 });
        this.tone(1400, 0.2, { type: 'triangle', gain: 0.05, delay: 0.05 });
        break;
      case 'lock':
        this.tone(1200, 0.22, { type: 'square', to: 380, gain: 0.04 });
        this.tone(190, 0.25, { type: 'triangle', gain: 0.08, delay: 0.05 });
        break;
      case 'ability':
        this.tone(1046, 0.14, { type: 'triangle', gain: 0.04 });
        break;
      case 'turn':
        this.tone(660, 0.16, { type: 'triangle', gain: 0.06 });
        this.tone(990, 0.24, { type: 'triangle', gain: 0.06, delay: 0.12 });
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone(f, 0.5, { type: 'triangle', gain: 0.09, delay: i * 0.12 }),
        );
        for (const f of [523, 659, 784, 1047])
          this.tone(f, 1.6, { type: 'sawtooth', gain: 0.025, attack: 0.1, delay: 0.5 });
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) =>
          this.tone(f, 0.6, { type: 'triangle', gain: 0.09, delay: i * 0.2 }),
        );
        this.tone(131, 1.6, { type: 'sawtooth', gain: 0.03, attack: 0.1, delay: 0.8 });
        break;
    }
  }
}
