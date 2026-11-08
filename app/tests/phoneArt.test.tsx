// @vitest-environment jsdom
// Card art and own sleeves/playmats on the Android phone (Phase C), with a fake
// window.Capacitor (Filesystem plugin and convertFileSrc). Windows and tests stay as before.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { phoneFileUrl, resetArtFolder, resolveArtFolder } from '../renderer/android/native';
import { isCosmeticName, phoneCardCount, phoneCosmetics } from '../renderer/android/phoneArt';
import { fileId, playmatOf, sleeveLook, useOwnCosmetics } from '../renderer/cosmetics';
import { artUrl } from '../renderer/engine';

const BASE = 'file:///storage/emulated/0/Android/data/io.github.j246810smith_ux.vanguardsim/files';
const convertFileSrc = (uri: string) =>
  uri.replace('file://', 'https://localhost/_capacitor_file_');

type Entry = { name: string; type: 'file' | 'directory' };
/** A fake phone folder: path → its entries. */
function phone(tree: Record<string, Entry[]>) {
  const readdir = vi.fn(async ({ path }: { path: string }) => {
    const files = tree[path];
    if (!files) throw new Error('Directory does not exist');
    return { files };
  });
  const getUri = vi.fn(async () => ({ uri: `${BASE}/` }));
  (globalThis as { Capacitor?: unknown }).Capacitor = {
    Plugins: { Filesystem: { readdir, getUri, writeFile: vi.fn() } },
    convertFileSrc,
  };
  return { readdir, getUri };
}
const file = (name: string): Entry => ({ name, type: 'file' });
const dir = (name: string): Entry => ({ name, type: 'directory' });

afterEach(() => {
  cleanup();
  resetArtFolder();
  delete (globalThis as { Capacitor?: unknown }).Capacitor;
});

describe('picture addresses', () => {
  it('Windows and tests: unchanged', async () => {
    await resolveArtFolder(); // no Capacitor: does nothing
    expect(phoneFileUrl('cards/BT01/BT01-001.png')).toBeNull();
    expect(artUrl('BT01-001')).toBe('cards/BT01/BT01-001.png');
    expect(artUrl('G-TD01-001', 'jpg')).toBe('cards/G-TD01/G-TD01-001.jpg');
    expect(playmatOf(fileId('My mat.png')).background).toContain('playmats/My%20mat.png');
  });

  it('Android: before the folder is known, as before; then from the app folder on the phone', async () => {
    const { getUri } = phone({});
    expect(artUrl('BT01-001')).toBe('cards/BT01/BT01-001.png');
    await resolveArtFolder();
    expect(getUri).toHaveBeenCalledWith({ directory: 'EXTERNAL', path: '' });
    const web =
      'https://localhost/_capacitor_file_/storage/emulated/0/Android/data/io.github.j246810smith_ux.vanguardsim/files';
    expect(artUrl('BT01-001')).toBe(`${web}/cards/BT01/BT01-001.png`);
    expect(artUrl('PR11-0003', 'jpg')).toBe(`${web}/cards/PR11/PR11-0003.jpg`);
    expect(playmatOf(fileId('My mat.png')).background).toContain(`${web}/playmats/My%20mat.png`);
    expect(sleeveLook(fileId('Back.jpg')).background).toContain(`${web}/sleeves/Back.jpg`);
  });

  it('Android without the folder: cards keep their plain faces, nothing throws', async () => {
    (globalThis as { Capacitor?: unknown }).Capacitor = {
      Plugins: { Filesystem: { getUri: () => Promise.reject(new Error('no')) } },
      convertFileSrc,
    };
    await expect(resolveArtFolder()).resolves.toBeUndefined();
    expect(artUrl('BT01-001')).toBe('cards/BT01/BT01-001.png');
  });
});

describe('own sleeves and playmats on the phone', () => {
  it('lists usable images by name, as Windows does', async () => {
    phone({
      sleeves: [file('b.png'), file('A sleeve.jpg'), file('notes.txt'), dir('old'), file('x..png')],
      playmats: [file('Mat (1).webp')],
    });
    expect(await phoneCosmetics()).toEqual({
      sleeves: ['A sleeve.jpg', 'b.png'],
      playmats: ['Mat (1).webp'],
    });
  });

  it('nothing copied yet: empty lists; no phone: null', async () => {
    expect(await phoneCosmetics()).toBeNull();
    phone({});
    expect(await phoneCosmetics()).toEqual({ sleeves: [], playmats: [] });
  });

  // what app/main/artPath.cjs isCosmeticName answers for these on Windows
  it.each([
    ['Mat.png', true],
    ['My sleeve (2).JPEG', true],
    ["Kai's & co+, v1.webp", true],
    ['a..png', false],
    ['x.gif', false],
    ['bad/name.png', false],
    [`${'n'.repeat(100)}.png`, true],
    [`${'n'.repeat(101)}.png`, false],
    ['', false],
  ])('the same file-name rule as the Windows app: %s', (name, ok) => {
    expect(isCosmeticName(name)).toBe(ok);
  });

  it('the pickers get them through useOwnCosmetics', async () => {
    phone({ sleeves: [file('Mine.png')], playmats: [] });
    function Probe() {
      const own = useOwnCosmetics();
      return <span data-testid="own">{own.sleeves.join(',')}</span>;
    }
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('own').textContent).toBe('Mine.png'));
  });
});

describe('card count on the phone', () => {
  it('counts card pictures in the set folders only', async () => {
    phone({
      cards: [dir('BT01'), dir('G-BT01'), file('README.txt')],
      'cards/BT01': [file('BT01-001.png'), file('BT01-002.jpg'), file('Thumbs.db')],
      'cards/G-BT01': [file('G-BT01-001.png')],
    });
    expect(await phoneCardCount()).toBe(3);
  });

  it('nothing copied yet: 0; no phone: null', async () => {
    expect(await phoneCardCount()).toBeNull();
    phone({});
    expect(await phoneCardCount()).toBe(0);
  });
});
