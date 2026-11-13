// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../renderer/App';
import { HomeScreen } from '../renderer/home/HomeScreen';
import { homeArtUrl } from '../renderer/home/art';
import { cleanName, loadProfile, MAX_NAME, NAME_KEY } from '../renderer/home/profile';
import { resetProfileCache } from '../renderer/profile/repository';

describe('home screen (docs/design/HOME_SCREEN_PLAN.md)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('without the Profile screen, the small editor (UI kit dialog) saves a name; Cancel keeps it', () => {
    const noop = () => undefined;
    const actions = {
      newGame: noop,
      demo: noop,
      online: null,
      onlineReady: false,
      decks: noop,
      cards: noop,
      settings: noop,
      updates: null,
      feedback: null,
      quit: null,
    };
    render(<HomeScreen actions={actions} />);
    fireEvent.click(screen.getByTestId('home-profile'));
    expect(screen.getByTestId('profile-editor')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Aichi' } });
    fireEvent.click(screen.getByTestId('profile-save'));
    expect(screen.queryByTestId('profile-editor')).toBeNull();
    expect(screen.getByTestId('profile-name').textContent).toBe('Aichi');
    fireEvent.click(screen.getByTestId('home-profile'));
    fireEvent.change(screen.getByTestId('profile-name-input'), { target: { value: 'Kai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('profile-name').textContent).toBe('Aichi');
  });

  it('START BATTLE opens the game modes, never a match; Back closes them', () => {
    render(<App />);
    expect(screen.queryByTestId('new-game')).toBeNull();
    fireEvent.click(screen.getByTestId('start-battle'));
    expect(screen.getByTestId('mode-select')).toBeTruthy();
    expect(screen.getByTestId('new-game')).toBeTruthy();
    expect(screen.getByTestId('cpu-demo')).toBeTruthy();
    expect(screen.queryByTestId('start')).toBeNull(); // not even Game Setup yet
    fireEvent.click(screen.getByTestId('modes-back'));
    expect(screen.queryByTestId('mode-select')).toBeNull();
    expect(screen.getByTestId('start-battle')).toBeTruthy();
  });

  it('each mode opens the screen it opened before', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-battle'));
    fireEvent.click(screen.getByTestId('new-game'));
    expect(screen.getByTestId('start')).toBeTruthy(); // Game Setup
    cleanup();
    render(<App />);
    fireEvent.click(screen.getByTestId('start-battle'));
    fireEvent.click(screen.getByTestId('cpu-demo'));
    expect(screen.getByTestId('demo-start')).toBeTruthy();
  });

  it('Decks, Card Database and Settings open the existing screens', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('deck-builder'));
    expect(screen.getByTestId('deck-list')).toBeTruthy();
    cleanup();
    render(<App />);
    fireEvent.click(screen.getByTestId('settings'));
    expect(screen.getByTestId('settings-scroll')).toBeTruthy();
  });

  it('the Card Database is the card pool only: a click shows details and adds nothing', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('card-db'));
    expect(screen.getByTestId('card-database')).toBeTruthy();
    expect(screen.getByTestId('card-pool')).toBeTruthy();
    fireEvent.click(screen.getByTestId('pool-BT01-001'));
    expect(screen.getByTestId('details-position')).toBeTruthy();
    expect(screen.queryByTestId('save-deck')?.closest('.dd-deck')).toBeTruthy(); // hidden by CSS
  });

  // 2026-11-11: the profile opens the Player Profile screen (profile/), edited there
  it('the profile shows the Play Online name and saves name and avatar on this device', () => {
    localStorage.setItem(NAME_KEY, 'Aichi Fan');
    resetProfileCache();
    render(<App />);
    expect(screen.getByTestId('profile-name').textContent).toBe('Aichi Fan');
    fireEvent.click(screen.getByTestId('home-profile'));
    expect(screen.getByTestId('player-profile')).toBeTruthy();
    fireEvent.click(screen.getByTestId('profile-edit'));
    fireEvent.change(screen.getByTestId('profile-name-field'), { target: { value: '  Kai  ' } });
    fireEvent.click(screen.getByTestId('profile-avatar-flame'));
    fireEvent.click(screen.getByTestId('profile-save-full'));
    expect(screen.getByTestId('profile-display-name').textContent).toBe('Kai');
    fireEvent.click(screen.getByTestId('profile-back'));
    expect(screen.getByTestId('profile-name').textContent).toBe('Kai');
    expect(loadProfile()).toEqual({ name: 'Kai', avatar: 'flame' });
    expect(localStorage.getItem(NAME_KEY)).toBe('Kai');
  });

  it('Cancel in the profile editor keeps the old name and avatar', () => {
    resetProfileCache();
    render(<App />);
    fireEvent.click(screen.getByTestId('home-profile'));
    fireEvent.click(screen.getByTestId('profile-edit'));
    fireEvent.change(screen.getByTestId('profile-name-field'), { target: { value: 'Other' } });
    fireEvent.click(screen.getByTestId('profile-avatar-crown'));
    fireEvent.click(screen.getByTestId('profile-cancel'));
    expect(screen.queryByTestId('profile-editor-full')).toBeNull();
    expect(loadProfile()).toEqual({ name: 'Player', avatar: 'blue' });
  });

  it('no name saved: a neutral default, never a real name', () => {
    render(<App />);
    expect(screen.getByTestId('profile-name').textContent).toBe('Player');
    expect(cleanName('   ')).toBe('Player');
    expect(cleanName('x'.repeat(40))).toHaveLength(MAX_NAME);
  });

  it('the menu has no messages, notifications, friends or ranked entries', () => {
    render(<App />);
    expect(screen.queryByText(/ranked|friends|notifications|messages/i)).toBeNull();
  });

  it('character art: the file when it is there, the stand-in otherwise', () => {
    expect(homeArtUrl('duelist-blue', {})).toBeNull();
    expect(homeArtUrl('rival-red', { '../assets/home/rival-red.webp': '/r.webp' })).toBe('/r.webp');
    expect(homeArtUrl('mech-red', { '../assets/home/rival-red.png': '/x.png' })).toBeNull();
  });
});
