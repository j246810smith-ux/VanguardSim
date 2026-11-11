// @vitest-environment jsdom
// The Music manager (six-workstream brief W5): playlists, menu and battle assignment, shuffle and
// repeat, and importing music into the phone's app folder.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  freeName,
  importMusic,
  MAX_MUSIC_BYTES,
  removeMusic,
  safeMusicName,
  type PickedFile,
} from '../renderer/android/musicImport';
import type { FilesystemPlugin } from '../renderer/android/native';
import {
  createPlaylist,
  deletePlaylist,
  firstTrack,
  forgetTrack,
  loadMusicPrefs,
  nextTrack,
  NO_MUSIC_PREFS,
  parseMusicPrefs,
  playableOf,
  renamePlaylist,
  toggleTrack,
} from '../renderer/audio/musicLibrary';
import type { MusicTrack } from '../renderer/audio/playlist';
import { MusicManager } from '../renderer/screens/MusicManager';
import { DEFAULT_SETTINGS } from '../renderer/settings';

afterEach(cleanup);

const track = (id: string): MusicTrack => ({
  id,
  title: id,
  url: `u/${id}`,
  playlist: 'standard',
  own: true,
});
const T = ['a', 'b', 'c'].map(track);

describe('playlists', () => {
  it('create, rename, add and remove tracks, delete (assignments follow)', () => {
    let p = createPlaylist(NO_MUSIC_PREFS, 'Battle mix');
    const id = p.playlists[0]!.id;
    p = toggleTrack(toggleTrack(p, id, 'a'), id, 'b');
    expect(p.playlists[0]!.tracks).toEqual(['a', 'b']);
    p = toggleTrack(p, id, 'a');
    expect(p.playlists[0]!.tracks).toEqual(['b']);
    p = renamePlaylist(p, id, '  Finals  ');
    expect(p.playlists[0]!.name).toBe('Finals');
    expect(renamePlaylist(p, id, '   ').playlists[0]!.name).toBe('Finals');
    p = { ...p, menu: id, battle: id };
    const gone = deletePlaylist(p, id);
    expect(gone).toMatchObject({ playlists: [], menu: null, battle: null });
  });

  it('skips missing files and forgets a removed file everywhere', () => {
    let p = createPlaylist(NO_MUSIC_PREFS);
    const id = p.playlists[0]!.id;
    p = toggleTrack(toggleTrack(toggleTrack(p, id, 'a'), id, 'gone'), id, 'c');
    expect(playableOf(p, id, T).map((t) => t.id)).toEqual(['a', 'c']);
    expect(forgetTrack(p, 'a').playlists[0]!.tracks).toEqual(['gone', 'c']);
    expect(playableOf(p, null, T)).toEqual([]);
  });

  it('plays in order and round again, repeats one track, or shuffles without repeating', () => {
    expect(nextTrack(T, 'a', { shuffle: false, repeat: 'playlist' })!.id).toBe('b');
    expect(nextTrack(T, 'c', { shuffle: false, repeat: 'playlist' })!.id).toBe('a');
    expect(nextTrack(T, 'b', { shuffle: false, repeat: 'track' })!.id).toBe('b');
    for (const r of [0, 0.4, 0.99])
      expect(nextTrack(T, 'b', { shuffle: true, repeat: 'playlist' }, () => r)!.id).not.toBe('b');
    expect(nextTrack([], 'a', { shuffle: false, repeat: 'playlist' })).toBeNull();
    expect(firstTrack(T, { shuffle: false })!.id).toBe('a');
  });

  it('reads saved prefs safely and keeps them after a restart', () => {
    expect(parseMusicPrefs({ playlists: [{ id: 'x' }, 5], menu: 'nope', repeat: 'x' })).toEqual({
      playlists: [{ id: 'x', name: 'Playlist', tracks: [] }],
      menu: null,
      battle: null,
      shuffle: false,
      repeat: 'playlist',
    });
    localStorage.setItem(
      'vanguard-sim.music.v1',
      JSON.stringify({
        playlists: [{ id: 'p', name: 'Mine', tracks: ['a'] }],
        battle: 'p',
        shuffle: true,
      }),
    );
    expect(loadMusicPrefs()).toMatchObject({ battle: 'p', shuffle: true });
    localStorage.clear();
  });
});

describe('importing on the phone', () => {
  const fakeFs = () => {
    const written: string[] = [];
    const deleted: string[] = [];
    const fs = {
      writeFile: vi.fn(async (o: { path: string }) => {
        if (o.path.includes('Broken')) throw new Error('disk full');
        written.push(o.path);
        return { uri: o.path };
      }),
      deleteFile: vi.fn(async (o: { path: string }) => void deleted.push(o.path)),
    } as unknown as FilesystemPlugin;
    return { fs, written, deleted };
  };
  const file = (name: string, size = 1000, type = 'audio/mpeg'): PickedFile => ({
    name,
    size,
    type,
    base64: async () => 'AAAA',
  });

  it('keeps safe file names and never overwrites one already there', () => {
    expect(safeMusicName('My Song?.MP3')).toBe('My Song_.mp3');
    expect(safeMusicName('notes.txt')).toBeNull();
    expect(freeName('a.mp3', new Set(['a.mp3', 'a (2).mp3']))).toBe('a (3).mp3');
  });

  it('copies good files into music/ and reports each bad one with a reason', async () => {
    const { fs, written } = fakeFs();
    const r = await importMusic(
      [
        file('Theme.mp3'),
        file('Theme.mp3'),
        file('cover.png'),
        file('Huge.wav', MAX_MUSIC_BYTES + 1),
        file('Odd.ogg', 10, 'audio/ogg'),
        file('Broken.m4a'),
      ],
      fs,
      [],
      (type) => type !== 'audio/ogg',
    );
    expect(written).toEqual(['music/Theme.mp3', 'music/Theme (2).mp3']);
    expect(r.imported).toEqual(['Theme.mp3', 'Theme (2).mp3']);
    expect(r.failed.map((f) => [f.name, f.reason.split(' (')[0]])).toEqual([
      ['cover.png', 'not a music file the game plays'],
      ['Huge.wav', 'too large'],
      ['Odd.ogg', 'this phone cannot play this kind of file'],
      ['Broken.m4a', 'could not be copied'],
    ]);
  });

  it('removes an imported file, and nothing outside the music folder', async () => {
    const { fs, deleted } = fakeFs();
    expect(await removeMusic('Theme.mp3', fs)).toBe(true);
    expect(await removeMusic('../settings.json', fs)).toBe(false);
    expect(deleted).toEqual(['music/Theme.mp3']);
  });
});

describe('Music manager screen', () => {
  beforeEach(() => localStorage.clear());

  it('makes a playlist, assigns it to the menu and battles, sets shuffle and repeat', () => {
    render(<MusicManager settings={DEFAULT_SETTINGS} onChange={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('playlist-new'));
    fireEvent.change(screen.getByTestId('playlist-name'), { target: { value: 'Mine' } });
    const id = loadMusicPrefs().playlists[0]!.id;
    fireEvent.change(screen.getByTestId('assign-menu'), { target: { value: id } });
    fireEvent.change(screen.getByTestId('assign-battle'), { target: { value: id } });
    fireEvent.click(screen.getByTestId('shuffle-on'));
    fireEvent.click(screen.getByTestId('repeat-track'));
    // saved, so it is the same after the app is closed and opened again
    expect(loadMusicPrefs()).toMatchObject({
      playlists: [{ name: 'Mine' }],
      menu: id,
      battle: id,
      shuffle: true,
      repeat: 'track',
    });
  });

  it('has no Import button where there is no phone (Windows uses the music folder)', () => {
    render(<MusicManager settings={DEFAULT_SETTINGS} onChange={() => {}} onClose={() => {}} />);
    expect(screen.queryByTestId('music-import')).toBeNull();
    expect(screen.getByTestId('music-manager').textContent).toContain('music folder');
  });

  it('the music volume is its own slider; sound effects keep theirs', () => {
    const onChange = vi.fn();
    render(<MusicManager settings={DEFAULT_SETTINGS} onChange={onChange} onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('music-volume'), { target: { value: '30' } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, musicVolume: 30 });
  });
});
