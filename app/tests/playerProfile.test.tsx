// @vitest-environment jsdom
// The Player Profile (the user's profile brief and asset pack, 2026-11-11): local first, persisted,
// recovered when damaged, statistics counted once per finished CPU or online game.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { STARTER_DECKS } from '../../src/decks/starters';
import { getLegalActions } from '../../src/engine';
import { ctx } from '../renderer/engine';
import { GameSession } from '../renderer/game/session';
import { AVATAR_KEY, NAME_KEY } from '../renderer/home/profile';
import { matchRecordOf, type FinishedGame } from '../renderer/profile/matchRecorder';
import {
  favouriteClanOf,
  favouriteFormatOf,
  recordMatch,
  TITLES,
  totalOf,
  validName,
  type MatchRecord,
} from '../renderer/profile/model';
import { ProfileScreen } from '../renderer/profile/ProfileScreen';
import {
  BACKUP_KEY,
  countMatch,
  loadPlayerProfile,
  PROFILE_KEY,
  resetProfileCache,
  savePlayerProfile,
} from '../renderer/profile/repository';

beforeEach(() => {
  localStorage.clear();
  resetProfileCache();
});
afterEach(cleanup);

/** "Close and open the app again": forget everything held in memory. */
const restart = () => resetProfileCache();

const game = (over: Partial<FinishedGame> = {}): FinishedGame => ({
  matchId: 'g1',
  ending: { winner: 0, reason: 'damage' },
  mySeat: 0,
  demo: false,
  online: false,
  format: 'classic',
  clan: 'Royal Paladin',
  deckName: 'Knights',
  opponent: 'CPU (Hard)',
  ...over,
});
const rec = (over: Partial<FinishedGame> = {}) =>
  matchRecordOf(game(over), '2026-11-11T20:00:00Z')!;

describe('the profile on this device', () => {
  it('is made on first launch from the name and avatar the home screen already had', () => {
    localStorage.setItem(NAME_KEY, 'Misaki');
    localStorage.setItem(AVATAR_KEY, 'red');
    const p = loadPlayerProfile();
    expect(p).toMatchObject({
      name: 'Misaki',
      avatar: 'red',
      title: 'No Title',
      banner: 'blue-circuit',
    });
    expect(p.localId).toMatch(/^[0-9a-f-]{36}$/);
    expect(totalOf(p).games).toBe(0); // no invented statistics
    restart();
    expect(loadPlayerProfile().localId).toBe(p.localId); // the id is made once
  });

  it('keeps edits after a restart, and keeps the home screen and Play Online name in step', () => {
    savePlayerProfile((p) => ({
      ...p,
      name: 'Aichi',
      avatar: 'gold',
      title: 'Vanguard Ace',
      banner: 'mat:nebula',
    }));
    restart();
    expect(loadPlayerProfile()).toMatchObject({
      name: 'Aichi',
      avatar: 'gold',
      title: 'Vanguard Ace',
      banner: 'mat:nebula',
    });
    expect(localStorage.getItem(NAME_KEY)).toBe('Aichi');
    expect(localStorage.getItem(AVATAR_KEY)).toBe('gold');
  });

  it('offers exactly the nine titles, all at once', () => {
    expect(TITLES).toEqual([
      'No Title',
      'Cardfighter',
      'Vanguard Ace',
      'Master Tactician',
      'Legendary Fighter',
      'Deck Builder',
      'Rising Star',
      'Veteran Fighter',
      'The Challenger',
    ]);
  });

  it('cleans names: control characters out, at most 20, never empty', () => {
    expect(validName('  Ka\u0007i  ')).toBe('Kai');
    expect(validName('x'.repeat(40))).toHaveLength(20);
    expect(validName('   ')).toBe('Player');
  });

  it('recovers a damaged profile from its backup, else starts fresh, touching nothing else', () => {
    savePlayerProfile((p) => ({ ...p, name: 'First' }));
    savePlayerProfile((p) => ({ ...p, name: 'Second' })); // "First" is now the backup
    localStorage.setItem('vanguard-sim.decks.v1', 'my decks');
    localStorage.setItem(PROFILE_KEY, '{broken');
    restart();
    expect(loadPlayerProfile().name).toBe('First');
    localStorage.setItem(PROFILE_KEY, 'null');
    localStorage.setItem(BACKUP_KEY, '[1,2]');
    restart();
    expect(() => loadPlayerProfile()).not.toThrow();
    expect(localStorage.getItem('vanguard-sim.decks.v1')).toBe('my decks');
  });

  it('replaces a saved title or banner that does not exist with the default', () => {
    savePlayerProfile((p) => p);
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY)!);
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ ...saved, title: 'Emperor', banner: 'gold-dragon' }),
    );
    restart();
    expect(loadPlayerProfile()).toMatchObject({ title: 'No Title', banner: 'blue-circuit' });
  });
});

describe('statistics', () => {
  it('count a finished game as a win, a loss or a draw, by mode', () => {
    expect(rec()).toMatchObject({ mode: 'cpu', result: 'win' });
    expect(rec({ ending: { winner: 1, reason: 'concede' } }).result).toBe('loss');
    expect(rec({ ending: { winner: null, reason: null } }).result).toBe('draw');
    expect(rec({ online: true }).mode).toBe('online_casual');
    expect(rec({ mySeat: 1, ending: { winner: 1, reason: 'damage' } }).result).toBe('win');
  });

  it('never count CPU demonstrations or a game left before it ended', () => {
    expect(matchRecordOf(game({ demo: true }), 'now')).toBeNull();
    expect(matchRecordOf(game({ ending: null }), 'now')).toBeNull();
  });

  it('count a game once, even when it is reported again or after a restart', () => {
    countMatch(rec());
    countMatch(rec());
    restart();
    countMatch(rec());
    const p = loadPlayerProfile();
    expect(totalOf(p)).toMatchObject({ games: 1, win: 1 });
    expect(p.history).toHaveLength(1);
  });

  it('keep CPU, online casual and combined records apart, with the win rate', () => {
    countMatch(rec({ matchId: 'a' }));
    countMatch(rec({ matchId: 'b', ending: { winner: 1, reason: 'damage' } }));
    countMatch(rec({ matchId: 'c', online: true }));
    const p = loadPlayerProfile();
    expect(totalOf(p, ['cpu'])).toMatchObject({ win: 1, loss: 1, games: 2 });
    expect(totalOf(p, ['online_casual'])).toMatchObject({ win: 1, games: 1 });
    expect(totalOf(p, ['online_ranked']).games).toBe(0);
    expect(totalOf(p).winRate).toBeCloseTo(66.7);
  });

  it('work out the favourite clan and format from counted games, unless the player chose one', () => {
    let p = loadPlayerProfile();
    const m = (id: string, clan: string, format: string): MatchRecord => ({
      ...rec({ matchId: id }),
      clan,
      format,
    });
    p = recordMatch(p, m('1', 'Kagero', 'g'));
    p = recordMatch(p, m('2', 'Kagero', 'g'));
    p = recordMatch(p, m('3', 'Royal Paladin', 'classic'));
    expect(favouriteClanOf(p)).toBe('Kagero');
    expect(favouriteFormatOf(p)).toBe('g');
    expect(favouriteClanOf({ ...p, favouriteClan: 'Granblue' })).toBe('Granblue');
  });

  it('a real CPU game played to its end gives the record the screen counts', () => {
    const s = new GameSession({
      seed: 9,
      myDeck: STARTER_DECKS[0]!.deck,
      myDeckName: 'Knights',
      aiDeck: STARTER_DECKS[1]!.deck,
      aiDeckName: 'B',
      aiLevel: 'basic',
    });
    const me = new BasicController(ctx);
    for (let i = 0; i < 5000 && s.state.status !== 'finished'; i++) {
      if (s.acting === 0) s.send(me.chooseCommand(s.view, 0, getLegalActions(s.state, 0, ctx)));
      else s.stepAi();
    }
    expect(s.ending).not.toBeNull();
    const r = matchRecordOf(game({ matchId: s.matchId, ending: s.ending }), 'now')!;
    countMatch(r);
    expect(totalOf(loadPlayerProfile()).games).toBe(1);
  });
});

describe('Player Profile screen', () => {
  it('shows the profile and edits name, title, avatar and a playmat banner', () => {
    render(<ProfileScreen onBack={() => {}} />);
    expect(screen.getByTestId('stat-games').textContent).toContain('0');
    expect(screen.getByTestId('stat-ranked').textContent).toContain('No ranked play yet');
    fireEvent.click(screen.getByTestId('profile-edit'));
    fireEvent.change(screen.getByTestId('profile-name-field'), { target: { value: 'Kai' } });
    fireEvent.change(screen.getByTestId('profile-title-field'), {
      target: { value: 'Rising Star' },
    });
    fireEvent.click(screen.getByTestId('profile-avatar-green'));
    fireEvent.click(screen.getByTestId('profile-banner-change'));
    fireEvent.click(screen.getByTestId('banner-group-playmats'));
    fireEvent.click(screen.getByTestId('banner-mat:inferno'));
    fireEvent.click(screen.getByTestId('banner-apply'));
    fireEvent.click(screen.getByTestId('profile-save-full'));
    expect(screen.getByTestId('profile-display-name').textContent).toBe('Kai');
    expect(screen.getByTestId('profile-title').textContent).toBe('Rising Star');
    restart();
    expect(loadPlayerProfile()).toMatchObject({
      name: 'Kai',
      avatar: 'green',
      banner: 'mat:inferno',
    });
  });

  it('Restore defaults puts the look back, keeping the statistics', () => {
    countMatch(rec({ matchId: 'kept' }));
    savePlayerProfile((p) => ({ ...p, title: 'The Challenger', banner: 'teal-energy' }));
    render(<ProfileScreen onBack={() => {}} />);
    fireEvent.click(screen.getByTestId('profile-edit'));
    fireEvent.click(screen.getByTestId('profile-restore'));
    fireEvent.click(screen.getByText('Restore', { selector: 'button' }));
    fireEvent.click(screen.getByTestId('profile-save-full'));
    expect(loadPlayerProfile()).toMatchObject({ title: 'No Title', banner: 'blue-circuit' });
    expect(totalOf(loadPlayerProfile()).games).toBe(1);
  });

  it('has statistics per format, match history and an honest Friends page', () => {
    countMatch(rec({ matchId: 'x', format: 'g' }));
    render(<ProfileScreen onBack={() => {}} />);
    fireEvent.click(screen.getByTestId('profile-tab-stats'));
    fireEvent.click(screen.getByTestId('stats-format-classic'));
    expect(screen.getByTestId('stats-row-Overall').textContent).toContain('0');
    fireEvent.click(screen.getByTestId('stats-format-g'));
    expect(screen.getByTestId('stats-row-Overall').textContent).toMatch(/1/);
    fireEvent.click(screen.getByTestId('profile-tab-history'));
    expect(screen.getByTestId('profile-history').textContent).toContain('WIN');
    fireEvent.click(screen.getByTestId('profile-tab-friends'));
    expect(screen.getByTestId('profile-friends').textContent).toContain('no server');
  });
});
