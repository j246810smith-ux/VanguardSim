// @vitest-environment jsdom
// Backgrounds (Battlefield 2.0 phase 6): themed and classic playmats, the optional moving layer,
// the preview in Settings, and the phone layout showing its profile's playmat.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { BattleCosmetics } from '../renderer/board/Cosmetics';
import { PLAYMATS } from '../renderer/cosmetics';
import { MobileBattleScreen } from '../renderer/screens/MobileBattleScreen';
import { DEFAULT_SETTINGS, SettingsContext, type Settings } from '../renderer/settings';
import { PlaymatPicker, PlaymatPreview } from '../renderer/ui/CosmeticPickers';

afterEach(cleanup);

const withSettings = (s: Partial<Settings>, node: React.ReactNode) => (
  <SettingsContext.Provider value={{ ...DEFAULT_SETTINGS, ...s }}>{node}</SettingsContext.Provider>
);

describe('playmats', () => {
  it('are grouped Themed and Classic, every themed scene can move', () => {
    const classic = PLAYMATS.filter((m) => m.style === 'classic').map((m) => m.id);
    expect(classic).toEqual(expect.arrayContaining(['classic', 'void', 'tournament', 'slate']));
    for (const m of PLAYMATS.filter((p) => p.style === 'themed')) expect(m.animation).toBeTruthy();
    render(<PlaymatPicker value="daybreak" onChange={() => {}} />);
    const picker = screen.getByTestId('playmat-picker').textContent!;
    expect(picker.indexOf('THEMED')).toBeLessThan(picker.indexOf('CLASSIC'));
  });

  it('a themed mat moves when the profile wants it, never with Reduced motion or Instant', () => {
    const mat = (s: Partial<Settings>) =>
      render(
        withSettings(
          s,
          <BattleCosmetics mySleeve="classic" opponentSleeve="classic" playmat="nebula" />,
        ),
      );
    mat({ animatedBackground: true });
    expect(screen.queryByTestId('playmat-anim')).toBeTruthy();
    cleanup();
    mat({ animatedBackground: false });
    expect(screen.queryByTestId('playmat-anim')).toBeNull();
    cleanup();
    mat({ animatedBackground: true, reducedMotion: true });
    expect(screen.queryByTestId('playmat-anim')).toBeNull();
    cleanup();
    mat({ animatedBackground: true, speed: 'instant' });
    expect(screen.queryByTestId('playmat-anim')).toBeNull();
  });

  it('a classic mat never moves', () => {
    render(
      withSettings(
        { animatedBackground: true },
        <BattleCosmetics mySleeve="classic" opponentSleeve="classic" playmat="slate" />,
      ),
    );
    expect(screen.queryByTestId('playmat-anim')).toBeNull();
  });

  it('the preview names the mat and its group', () => {
    render(<PlaymatPreview id="tournament" animated={false} />);
    expect(screen.getByTestId('playmat-preview').textContent).toContain(
      'Tournament Blue · Classic',
    );
  });

  it('the phone layout paints its playmat on its own grid (it had none)', () => {
    render(
      withSettings(
        { playmat: 'inferno' },
        <MobileBattleScreen
          config={{
            seed: 1,
            myDeck: STARTER_DECKS[0]!.deck,
            myDeckName: 'A',
            aiDeck: STARTER_DECKS[1]!.deck,
            aiDeckName: 'B',
            aiLevel: 'basic',
          }}
          onRematch={() => {}}
          onExit={() => {}}
        />,
      ),
    );
    const mat = screen.getByTestId('playmat');
    expect(mat.getAttribute('style')).toContain('rgb(22, 6, 4)');
    // regression (user's Pixel 10, 2026-11-11): the mat is the grid's own background, never a
    // separate layer behind it (that made Android drop layers and draw black boxes)
    expect(mat.className).toContain('m-battle');
    expect(document.querySelector('.playmat')).toBeNull();
    expect(document.querySelector('.playmat-anim')).toBeNull();
  });
});
