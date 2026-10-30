import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { isArtPath, isCosmeticPath } = require('../../app/main/artPath.cjs') as {
  isArtPath: (rel: string) => boolean;
  isCosmeticPath: (rel: string) => boolean;
};

// The user's report (2026-10-30): the installed game showed placeholders for the English-only
// BT16/BT17 cards (ids `BT17-001EN`): the desktop app refused to serve their art files.
describe('desktop art paths', () => {
  it('serves normal and English-only card ids', () => {
    expect(isArtPath('BT17/BT17-001.jpg')).toBe(true);
    expect(isArtPath('BT17/BT17-001EN.jpg')).toBe(true);
    expect(isArtPath('BT16/BT16-059EN.png')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isArtPath('BT17/../secret.jpg')).toBe(false);
    expect(isArtPath('BT17/BT17-001.gif')).toBe(false);
    expect(isArtPath('BT17-001EN.jpg')).toBe(false);
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
