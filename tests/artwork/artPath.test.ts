import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { isArtPath, isCosmeticPath, isMusicName, isMusicPath } =
  require('../../app/main/artPath.cjs') as {
    isArtPath: (rel: string) => boolean;
    isCosmeticPath: (rel: string) => boolean;
    isMusicName: (name: string) => boolean;
    isMusicPath: (rel: string) => boolean;
  };

// The user's report (2026-10-30): the installed game showed placeholders for the English-only
// BT16/BT17 cards (ids `BT17-001EN`): the desktop app refused to serve their art files.
describe('desktop art paths', () => {
  it('serves normal and English-only card ids', () => {
    expect(isArtPath('BT17/BT17-001.jpg')).toBe(true);
    expect(isArtPath('BT17/BT17-001EN.jpg')).toBe(true);
    expect(isArtPath('PR11/PR11-0003.png')).toBe(true);
    expect(isArtPath('PR14/PR14-0160A.png')).toBe(true);
    expect(isArtPath('PR11/PR12-0003.png')).toBe(false);
    expect(isArtPath('PR11/PR11-003.png')).toBe(true); // the same shape as every other set
    expect(isArtPath('BT16/BT16-059EN.png')).toBe(true);
    // three-letter side sets and the G era (D-034)
    expect(isArtPath('MBT01/MBT01-001.png')).toBe(true);
    expect(isArtPath('G-TD01/G-TD01-001.png')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isArtPath('BT17/../secret.jpg')).toBe(false);
    expect(isArtPath('BT17/BT17-001.gif')).toBe(false);
    expect(isArtPath('BT17-001EN.jpg')).toBe(false);
    expect(isArtPath('BT01/BT02-001.jpg')).toBe(false);
  });
});

// Sleeves and playmats from the player's own images (D-033)
describe('desktop sleeve and playmat paths', () => {
  it('serves image files directly in sleeves/ or playmats/', () => {
    expect(isCosmeticPath('sleeves/My sleeve (2).png')).toBe(true);
    expect(isCosmeticPath('playmats/Mat.jpeg')).toBe(true);
    expect(isCosmeticPath('playmats/mat.webp')).toBe(true);
  });

  it('refuses other folders, sub-folders, parent paths and other file types', () => {
    expect(isCosmeticPath('cards/BT01/BT01-001.png')).toBe(false);
    expect(isCosmeticPath('sleeves/sub/x.png')).toBe(false);
    expect(isCosmeticPath('sleeves/..png')).toBe(false);
    expect(isCosmeticPath('sleeves/../secret.png')).toBe(false);
    expect(isCosmeticPath('sleeves/x.gif')).toBe(false);
    expect(isCosmeticPath('sleeves/a"b.png')).toBe(false);
  });
});

// Battle music (docs/audio/AUDIO_PLAN.md): only plain music files in music\ are served.
describe('desktop music paths', () => {
  it('serves music/<file> for mp3, ogg, m4a and wav, nothing else and no sub-folders', () => {
    expect(isMusicPath('music/My theme (1).mp3')).toBe(true);
    expect(isMusicPath('music/track.ogg')).toBe(true);
    expect(isMusicPath('music/../secret.mp3')).toBe(false);
    expect(isMusicPath('music/sub/x.mp3')).toBe(false);
    expect(isMusicPath('cards/x.mp3')).toBe(false);
    expect(isMusicName('notes.txt')).toBe(false);
  });
});
