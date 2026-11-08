/**
 * The audio system (docs/audio/AUDIO_PLAN.md): the catalogue's samples exist, the event mapping,
 * volume categories, variations, cooldowns, landing timing, the voice limit, missing files,
 * settings migration and online de-duplication. Web Audio is replaced by a small fake that
 * records what would be played.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { GameEvent, GameState } from '../../src/engine';
import {
  audio,
  categoryLevel,
  DEFAULT_AUDIO,
  MAX_VOICES,
  pickVariation,
  type AudioSettings,
} from '../renderer/audio/audio';
import { CUE_SOUNDS, PRELOAD, UI_SOUNDS } from '../renderer/audio/catalog';
import { cuesFor } from '../renderer/audio/cues';
import { groupFiles, variationsOf } from '../renderer/audio/samples';
import { ME } from '../renderer/engine';
import { GuestSession } from '../renderer/game/session';
import { DEFAULT_SETTINGS, migrateAudio } from '../renderer/settings';

const ev = (e: object) => e as GameEvent;

/** A fake Web Audio context: every node accepts anything; started buffer sources are recorded. */
const started: { at: number; rate: number }[] = [];
const node = (): Record<string, unknown> =>
  new Proxy(
    {},
    {
      get(target: Record<string, unknown>, key: string) {
        if (key in target) return target[key];
        if (key === 'connect') return (x: unknown) => x;
        if (key === 'then') return undefined;
        if (key === 'start')
          return (at: number) =>
            started.push({
              at,
              rate: (target.playbackRate as { value: number } | undefined)?.value ?? 1,
            });
        const value = /gain|threshold|ratio|frequency|Q|playbackRate|detune|offset/.test(key)
          ? {
              value: 1,
              setTargetAtTime() {},
              setValueAtTime() {},
              linearRampToValueAtTime() {},
              exponentialRampToValueAtTime() {},
              cancelScheduledValues() {},
            }
          : () => node();
        target[key] = value;
        return value;
      },
      set(target, key: string, value) {
        target[key] = value;
        return true;
      },
    },
  );
class FakeContext {
  currentTime = 0;
  sampleRate = 44100;
  destination = node();
  state = 'running';
  createGain = () => node();
  createDynamicsCompressor = () => node();
  createBufferSource = () => node();
  createOscillator = () => node();
  createBiquadFilter = () => node();
  createBuffer = () => ({ getChannelData: () => new Float32Array(16) });
  decodeAudioData = (b: ArrayBuffer) => Promise.resolve({ duration: 0.2, length: b.byteLength });
  resume = () => Promise.resolve();
  suspend = () => Promise.resolve();
}

/** Settings with the music off (no sequencer) and everything else on. */
const ON: AudioSettings = { ...DEFAULT_AUDIO, musicVolume: 0 };
const settle = () => new Promise((r) => setTimeout(r, 30));

beforeAll(() => {
  (globalThis as { AudioContext?: unknown }).AudioContext = FakeContext;
});
afterEach(async () => {
  await settle();
  started.length = 0;
});

describe('the sound catalogue', () => {
  it('every layer of every sound has at least one recorded file', () => {
    const groups = [...Object.values(CUE_SOUNDS), ...Object.values(UI_SOUNDS)].flatMap((d) =>
      d.layers.map((l) => l.sample),
    );
    for (const g of [...groups, ...PRELOAD]) expect(variationsOf(g), g).toBeGreaterThan(0);
  });

  it('groups files into variations by name; a missing group has none', () => {
    const g = groupFiles(['../a/sfx/card/place_02.ogg', '../a/sfx/card/place_01.ogg', 'x.ogg']);
    expect(g.get('card/place')).toEqual([
      '../a/sfx/card/place_01.ogg',
      '../a/sfx/card/place_02.ogg',
    ]);
    expect(variationsOf('card/nothing')).toBe(0);
    expect(variationsOf('card/place')).toBe(3);
  });

  it('routine sounds are subtle: no layer above 0.65, routine card layers well under it', () => {
    for (const d of Object.values(CUE_SOUNDS))
      for (const l of d.layers) expect(l.gain).toBeLessThanOrEqual(0.65);
    expect(Math.max(...CUE_SOUNDS.draw.layers.map((l) => l.gain))).toBeLessThan(0.4);
  });
});

describe('events to sounds', () => {
  it('a normal call, a superior call, a stride and a G guardian each have their own sound', () => {
    const call = (superior: boolean) =>
      ev({ type: 'UNIT_CALLED', player: 0, instanceId: 'a', circle: 'front_left', superior });
    expect(cuesFor([call(false)], ME)).toEqual(['call']);
    expect(cuesFor([call(true)], ME)).toEqual(['superiorCall']);
    expect(
      cuesFor([ev({ type: 'STRIDE', player: 0, gUnit: 'g', hearts: [], discarded: [] })], ME),
    ).toEqual(['stride']);
    expect(cuesFor([ev({ type: 'G_GUARDIAN_CALLED', player: 1, instanceId: 'g' })], ME)).toEqual([
      'gGuard',
    ]);
  });

  it('several cards called at once make one call sound', () => {
    const calls = ['a', 'b', 'c'].map((id) =>
      ev({ type: 'UNIT_CALLED', player: 0, instanceId: id, circle: 'front_left', superior: false }),
    );
    expect(cuesFor(calls, ME)).toEqual(['call']);
  });

  it('a hit for two damage is a critical hit; the damage itself adds no second sound', () => {
    const hit = ev({
      type: 'ATTACK_RESOLVED',
      target: 't',
      hit: true,
      attackPower: 1,
      defensePower: 0,
    });
    expect(cuesFor([hit, ev({ type: 'DAMAGE_DEALT', player: 1, amount: 1 })], ME)).toEqual(['hit']);
    expect(cuesFor([hit, ev({ type: 'DAMAGE_DEALT', player: 1, amount: 2 })], ME)).toEqual([
      'criticalHit',
    ]);
  });

  it('a phase change ticks only when nothing else sounds', () => {
    const phase = ev({ type: 'PHASE_CHANGED', phase: 'main' });
    expect(cuesFor([phase], ME)).toEqual(['phase']);
    expect(cuesFor([phase, ev({ type: 'UNIT_RIDDEN', player: 0, instanceId: 'y' })], ME)).toEqual([
      'ride',
    ]);
  });
});

describe('volume categories', () => {
  it('a category plays at master × its volume, and not at all when it or everything is muted', () => {
    const s: AudioSettings = { ...DEFAULT_AUDIO, masterVolume: 50, cardVolume: 80 };
    expect(categoryLevel(s, 'card')).toBeCloseTo(0.4);
    expect(categoryLevel({ ...s, mutedCategories: ['card'] }, 'card')).toBe(0);
    expect(categoryLevel({ ...s, mutedCategories: ['card'] }, 'battle')).toBeGreaterThan(0);
    expect(categoryLevel({ ...s, muted: true }, 'battle')).toBe(0);
  });

  it('settings saved with one effects volume keep it for cards, battle and interface', () => {
    expect(migrateAudio({ sfxVolume: 30 })).toEqual({
      masterVolume: 100,
      cardVolume: 30,
      battleVolume: 30,
      uiVolume: 30,
    });
    expect(migrateAudio({ sfxVolume: 30, cardVolume: 90 })).toEqual({});
    expect(DEFAULT_SETTINGS.mutedCategories).toEqual([]);
  });
});

describe('the sound manager', () => {
  it('never picks the variation it played last when there are others', () => {
    for (let last = 0; last < 4; last++)
      for (const r of [0, 0.3, 0.6, 0.99]) expect(pickVariation(4, last, () => r)).not.toBe(last);
    expect(pickVariation(1, 0)).toBe(0);
  });

  it("plays a call's layers, the landing ones when the card arrives", async () => {
    audio.configure(ON);
    audio.play(['call'], { landMs: 300 });
    await vi.waitFor(() => expect(started.length).toBe(3), { timeout: 8000 });
    const times = started.map((s) => s.at).sort((a, b) => a - b);
    expect(times[0]).toBeCloseTo(0);
    expect(times[1]).toBeCloseTo(0.3);
    expect(times[2]).toBeCloseTo(0.33);
  });

  it('the same sound again at once (one action, several updates) plays once', async () => {
    audio.configure(ON);
    audio.play(['ride']);
    audio.play(['ride']);
    await vi.waitFor(() => expect(started.length).toBe(CUE_SOUNDS.ride.layers.length), {
      timeout: 8000,
    });
    await settle();
    expect(started.length).toBe(CUE_SOUNDS.ride.layers.length);
  });

  it('a muted category plays nothing; the others still play', async () => {
    audio.configure({ ...ON, mutedCategories: ['battle'] });
    audio.play(['hit']);
    await settle();
    expect(started.length).toBe(0);
    audio.ui('confirm');
    await vi.waitFor(() => expect(started.length).toBe(1), { timeout: 8000 });
  });

  it(`never more than ${MAX_VOICES} samples at once`, async () => {
    audio.configure(ON);
    // nothing ends in the fake context, so every started sample stays a voice
    audio.test();
    audio.play(['stride', 'perfectGuard', 'criticalHit', 'heal', 'legion', 'damageCheck']);
    await settle();
    await settle();
    expect(started.length).toBeLessThanOrEqual(MAX_VOICES);
    expect(started.length).toBeGreaterThan(0);
  });
});

describe('online: a repeated update is not played twice', () => {
  it('the same view with the same events again records nothing new', () => {
    const view = { status: 'playing' } as unknown as GameState;
    const session = new GuestSession(view, () => {});
    const call = ev({
      type: 'UNIT_CALLED',
      player: 1,
      instanceId: 'a',
      circle: 'front_left',
      superior: false,
    });
    const next = { status: 'playing', n: 1 } as unknown as GameState;
    // reading names from the view is not needed for the cue
    vi.spyOn(session as unknown as { record: () => void }, 'record').mockImplementation(() => {});
    session.update(next, [call], []);
    session.update(next, [call], []);
    expect(
      (session as unknown as { record: { mock: { calls: unknown[] } } }).record.mock.calls.length,
    ).toBe(1);
    // a reconnect sends the view with no events: no sounds for history
    session.update(next, [], []);
    expect(session.takeCues()).toEqual([]);
  });
});
