/** Sound cues (roadmap phase 2): which engine events make which sounds, and that sound is optional. */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { STARTER_DECKS } from '../../src/decks/starters';
import type { GameEvent } from '../../src/engine';
import { audio } from '../renderer/audio/audio';
import { cuesFor, MAX_CUES } from '../renderer/audio/cues';
import { movesOf } from '../renderer/board/motion';
import { AI, ctx, ME } from '../renderer/engine';
import { GameSession } from '../renderer/game/session';

const ev = (e: object) => e as GameEvent;
const zone = (z: string) => ({ player: 0, zone: z });

describe('cuesFor', () => {
  it('maps resolved events to cues', () => {
    expect(cuesFor([ev({ type: 'UNIT_RIDDEN', player: 0, instanceId: 'a' })], ME)).toEqual([
      'ride',
    ]);
    expect(
      cuesFor(
        [ev({ type: 'ATTACK_DECLARED', player: 0, attacker: 'a', target: 'b', booster: 'c' })],
        ME,
      ),
    ).toEqual(['attack', 'boost']);
    expect(
      cuesFor(
        [
          ev({
            type: 'RESTRICTION_ADDED',
            restriction: { target: 'a', restriction: 'cannot_be_hit', until: 'end_of_battle' },
          }),
        ],
        ME,
      ),
    ).toEqual(['perfectGuard']);
    expect(
      cuesFor(
        [
          ev({
            type: 'CHECK_REVEALED',
            check: 'drive',
            player: 0,
            instanceId: 'a',
            trigger: 'critical',
            active: true,
          }),
        ],
        ME,
      ),
    ).toEqual(['trigger', 'driveCheck']);
    expect(
      cuesFor(
        [
          ev({
            type: 'CHECK_REVEALED',
            check: 'damage',
            player: 1,
            instanceId: 'a',
            trigger: 'heal',
            active: true,
          }),
        ],
        ME,
      ),
    ).toEqual(['heal', 'damageCheck']);
    expect(
      cuesFor(
        [
          ev({
            type: 'CARD_MOVED',
            instanceId: 'a',
            from: { player: 0, zone: 'circle', circle: 'front_left' },
            to: zone('drop'),
            reason: 'retire',
          }),
        ],
        ME,
      ),
    ).toEqual(['retire']);
    expect(
      cuesFor(
        [
          ev({
            type: 'CARD_MOVED',
            instanceId: 'a',
            from: zone('deck'),
            to: zone('hand'),
            reason: 'draw',
          }),
        ],
        ME,
      ),
    ).toEqual(['draw']);
    // setup and unrelated events make no sound
    expect(
      cuesFor(
        [
          ev({
            type: 'CARD_MOVED',
            instanceId: 'a',
            from: zone('deck'),
            to: zone('hand'),
            reason: 'setup',
          }),
        ],
        ME,
      ),
    ).toEqual([]);
    expect(cuesFor([ev({ type: 'MODIFIER_ADDED' })], ME)).toEqual([]);
  });

  it('plays each cue once per batch, at most a few, most important first; the result replaces the rest', () => {
    const draws = Array.from({ length: 5 }, (_, i) =>
      ev({
        type: 'CARD_MOVED',
        instanceId: `d${i}`,
        from: zone('deck'),
        to: zone('hand'),
        reason: 'draw',
      }),
    );
    expect(cuesFor(draws, ME)).toEqual(['draw']);
    const busy = [
      ...draws,
      ev({ type: 'UNIT_CALLED', player: 0, instanceId: 'x', circle: 'front_left', superior: true }),
      ev({ type: 'UNIT_RIDDEN', player: 0, instanceId: 'y' }),
      ev({ type: 'ABILITY_RESOLVING' }),
      ev({ type: 'TURN_STARTED', turn: 2, player: 0 }),
    ];
    expect(cuesFor(busy, ME)).toEqual(['ride', 'call', 'ability']);
    expect(cuesFor([...busy, ev({ type: 'GAME_ENDED', winner: ME, losses: {} })], ME)).toEqual([
      'victory',
    ]);
    expect(cuesFor([ev({ type: 'GAME_ENDED', winner: AI, losses: {} })], ME)).toEqual(['defeat']);
  });
});

describe('sound in a whole game', () => {
  const play = (collect: boolean) => {
    const session = new GameSession({
      seed: 77,
      myDeck: STARTER_DECKS[0]!.deck,
      myDeckName: 'a',
      aiDeck: STARTER_DECKS[1]!.deck,
      aiDeckName: 'b',
      aiLevel: 'basic',
    });
    const me = new BasicController(ctx);
    const batches: string[][] = [];
    if (collect) batches.push(session.takeCues());
    for (let i = 0; i < 5000 && session.view.status !== 'finished'; i++) {
      if (session.acting === AI) session.stepAi();
      else session.send(me.chooseCommand(session.view, ME, session.actions));
      if (collect) batches.push(session.takeCues());
    }
    return { session, batches };
  };

  it('gives every batch at most a few distinct cues, ends with the result, and never changes the game', () => {
    const { session, batches } = play(true);
    expect(session.view.status).toBe('finished');
    // the result screen knows how it ended
    expect(session.ending?.winner).toBe(session.view.winner);
    expect(['damage', 'deck_out']).toContain(session.ending?.reason);
    expect(batches[0]).toEqual([]); // dealing the opening hands is silent
    for (const b of batches) {
      expect(b.length).toBeLessThanOrEqual(MAX_CUES);
      expect(new Set(b).size).toBe(b.length);
    }
    const all = batches.flat();
    for (const cue of ['ride', 'attack', 'driveCheck', 'damageCheck', 'turn'])
      expect(all).toContain(cue);
    expect(['victory', 'defeat']).toContain(batches.filter((b) => b.length).at(-1)![0]);
    // taking the cues (playing sounds) leaves the game exactly as it would be without
    expect(play(false).session.state).toEqual(session.state);
  });

  it('without Web Audio the sound manager does nothing and never throws', () => {
    expect(() => {
      audio.configure({ musicVolume: 50, sfxVolume: 70, muted: false });
      audio.setMusic('battle');
      audio.play(['ride', 'hit', 'victory']);
      audio.configure({ musicVolume: 0, sfxVolume: 0, muted: true });
    }).not.toThrow();
  });
});

describe('card movement tracking (board/motion.ts)', () => {
  it('records where each card came from and went, first origin and last destination', () => {
    const moves = movesOf([
      ev({
        type: 'CARD_MOVED',
        instanceId: 'a',
        from: zone('deck'),
        to: zone('hand'),
        reason: 'draw',
      }),
      ev({
        type: 'CARD_MOVED',
        instanceId: 'b',
        from: { player: 1, zone: 'circle', circle: 'front_left' },
        to: { player: 1, zone: 'drop' },
        reason: 'retire',
      }),
      ev({
        type: 'CARD_MOVED',
        instanceId: 'c',
        from: zone('deck'),
        to: zone('trigger'),
        reason: 'check',
      }),
      ev({
        type: 'CARD_MOVED',
        instanceId: 'c',
        from: zone('trigger'),
        to: zone('hand'),
        reason: 'check',
      }),
      ev({ type: 'UNIT_RIDDEN', player: 0, instanceId: 'd' }),
    ]);
    expect(Object.fromEntries(moves)).toEqual({
      a: { from: '0-deck', to: '0-hand' },
      b: { from: null, to: '1-drop' },
      c: { from: '0-deck', to: '0-hand' },
    });
  });
});
