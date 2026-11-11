/**
 * Battle music (docs/audio/AUDIO_PLAN.md): the bundled tracks, the player's own folder, the pick
 * for a new battle, and the looping track player (fades, gapless crossfade loop, no restarts).
 */
import { describe, expect, it } from 'vitest';
import {
  bundledTracks,
  ownTracks,
  pickTrack,
  RANDOM,
  type MusicTrack,
} from '../renderer/audio/playlist';
import { CROSSFADE_S, ramp, TrackPlayer } from '../renderer/audio/trackPlayer';
import { DEFAULT_SETTINGS } from '../renderer/settings';

describe('the battle playlist', () => {
  it('ships both 8-bit battle themes in the Standard playlist', () => {
    const tracks = bundledTracks();
    expect(tracks.map((t) => t.title)).toEqual([
      'Vanguard 8-Bit Battle Theme',
      'Vanguard 8-Bit Battle Theme (1)',
    ]);
    expect(tracks.every((t) => t.playlist === 'standard' && !t.own && t.url)).toBe(true);
  });

  it('reads the playlist from the folder a track is in', () => {
    const t = bundledTracks({
      '../assets/audio/music/boss/big.mp3': 'u1',
      '../assets/audio/music/elsewhere/x.mp3': 'u2',
    });
    expect(t).toEqual([{ id: 'big', title: 'big', url: 'u1', playlist: 'boss', own: false }]);
  });

  it("the player's own files join Standard, titled by file name", () => {
    const [t] = ownTracks(['My Theme.mp3']);
    expect(t).toMatchObject({ id: 'own:My Theme.mp3', title: 'My Theme', own: true });
    expect(t!.url).toBe('vgart://own/music/My%20Theme.mp3');
  });
});

describe('picking the track for a new battle', () => {
  const tracks: MusicTrack[] = [
    { id: 'a', title: 'A', url: 'a', playlist: 'standard', own: false },
    { id: 'b', title: 'B', url: 'b', playlist: 'standard', own: false },
  ];

  it('Random is the default and never repeats the last battle when there is another', () => {
    expect(DEFAULT_SETTINGS.battleMusic).toBe(RANDOM);
    for (const r of [0, 0.5, 0.99]) {
      expect(pickTrack(tracks, RANDOM, 'a', 'standard', () => r)!.id).toBe('b');
      expect(pickTrack(tracks, RANDOM, 'b', 'standard', () => r)!.id).toBe('a');
    }
    // both are picked over many battles
    const seen = new Set(
      Array.from(
        { length: 20 },
        (_, i) => pickTrack(tracks, RANDOM, null, 'standard', () => i / 20)!.id,
      ),
    );
    expect(seen).toEqual(new Set(['a', 'b']));
  });

  it('a chosen track always plays; a chosen track that is gone falls back to Random', () => {
    expect(pickTrack(tracks, 'b', 'b')!.id).toBe('b');
    expect(['a', 'b']).toContain(pickTrack(tracks, 'own:deleted.mp3', null)!.id);
  });

  it('an empty playlist falls back to Standard; no tracks at all is no music', () => {
    expect(pickTrack(tracks, RANDOM, null, 'boss')).not.toBeNull();
    expect(pickTrack([], RANDOM, null)).toBeNull();
  });
});

/** A fake audio element and clock for the track player. */
function rig() {
  let clock = 0;
  const made: {
    src: string;
    volume: number;
    currentTime: number;
    duration: number;
    paused: boolean;
    preload: string;
    play: () => Promise<void>;
    pause: () => void;
  }[] = [];
  const player = new TrackPlayer(
    () => {
      const el = {
        src: '',
        volume: 0,
        currentTime: 0,
        duration: 170,
        paused: true,
        preload: '',
        play() {
          el.paused = false;
          return Promise.resolve();
        },
        pause() {
          el.paused = true;
        },
      };
      made.push(el);
      return el as unknown as HTMLAudioElement;
    },
    () => clock,
  );
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 50) {
      clock += 50;
      player.tick();
    }
  };
  return { player, made, advance, live: () => made.filter((e) => e.src !== '') };
}

describe('the track player', () => {
  it('ramps volumes linearly', () => {
    expect(ramp(0, 1, 0, 1000)).toBe(0);
    expect(ramp(0, 1, 500, 1000)).toBeCloseTo(0.5);
    expect(ramp(1, 0, 2000, 1000)).toBe(0);
  });

  it('fades a track in to the music level', () => {
    const { player, made, advance } = rig();
    player.setLevel(0.5);
    player.play('battle.mp3', 1000);
    expect(made[0]!.paused).toBe(false);
    expect(made[0]!.volume).toBe(0);
    advance(500);
    expect(made[0]!.volume).toBeGreaterThan(0.2);
    advance(600);
    expect(made[0]!.volume).toBeCloseTo(0.5);
  });

  it('the same track again does not restart (phases, card actions, a reconnect)', () => {
    const { player, made, advance } = rig();
    player.play('battle.mp3');
    advance(2000);
    player.play('battle.mp3');
    expect(made.length).toBe(1);
  });

  it('loops by starting the next pass before the end and crossfading', () => {
    const { player, made, advance, live } = rig();
    player.setLevel(1);
    player.play('battle.mp3', 200);
    advance(400);
    made[0]!.currentTime = 170 - CROSSFADE_S + 0.1;
    advance(50);
    expect(made.length).toBe(2);
    expect(made[1]!.src).toBe('battle.mp3');
    expect(made[1]!.paused).toBe(false);
    advance(CROSSFADE_S * 1000 + 200);
    // the old pass faded out and was let go; the new one plays on at full level
    expect(live().length).toBe(1);
    expect(made[1]!.volume).toBeCloseTo(1);
  });

  // six-workstream brief W5: a playlist moves on to its next track instead of looping
  it('a playlist plays its next track, crossfading, when the current one ends', () => {
    const { player, made, advance } = rig();
    const queue = ['two.mp3', 'three.mp3'];
    player.play('one.mp3', 200, () => queue.shift() ?? null);
    advance(400);
    made[0]!.currentTime = 170 - CROSSFADE_S + 0.1;
    advance(50);
    expect(made[1]!.src).toBe('two.mp3');
    expect(player.playing).toBe('two.mp3');
  });

  it('stopping fades out, then lets the track go', () => {
    const { player, made, advance, live } = rig();
    player.play('battle.mp3', 100);
    advance(200);
    player.stop(500);
    expect(player.playing).toBeNull();
    advance(250);
    expect(made[0]!.volume).toBeGreaterThan(0);
    advance(400);
    expect(live().length).toBe(0);
    expect(made[0]!.paused).toBe(true);
  });
});
