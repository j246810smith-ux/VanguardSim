import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SLEEVE,
  fileId,
  ownImageName,
  playmatOf,
  PLAYMATS,
  shareableSleeve,
  SLEEVES,
  sleeveLook,
} from '../renderer/cosmetics';

// Sleeves and playmats (D-033): built-in designs plus the player's own images.
describe('sleeves and playmats', () => {
  it('built-in ids are unique and the default comes first', () => {
    expect(new Set(SLEEVES.map((s) => s.id)).size).toBe(SLEEVES.length);
    expect(new Set(PLAYMATS.map((m) => m.id)).size).toBe(PLAYMATS.length);
    expect(SLEEVES[0]!.id).toBe(DEFAULT_SLEEVE);
  });

  it('an own image is drawn from its file, named after it', () => {
    const id = fileId('Official sleeve.png');
    expect(ownImageName(id)).toBe('Official sleeve');
    expect(sleeveLook(id).background).toContain('sleeves/Official%20sleeve.png');
    expect(playmatOf(fileId('Mat.jpg')).background).toContain('playmats/Mat.jpg');
  });

  it('unknown ids fall back to the defaults', () => {
    expect(sleeveLook('no-such-sleeve').id).toBe(DEFAULT_SLEEVE);
    expect(playmatOf(undefined).id).toBe(PLAYMATS[0]!.id);
  });

  it('online, only built-in sleeves are shared; own images stay on this PC', () => {
    expect(shareableSleeve('crimson')).toBe('crimson');
    expect(shareableSleeve(fileId('mine.png'))).toBe(DEFAULT_SLEEVE);
    expect(shareableSleeve('made-up')).toBe(DEFAULT_SLEEVE);
    expect(shareableSleeve(undefined)).toBe(DEFAULT_SLEEVE);
  });
});
