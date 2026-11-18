// @vitest-environment jsdom
// Portrait battles (docs/android/PORTRAIT_PLAN.md, prompt pack 2026-11-15 item 2D).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { AI, ME } from '../renderer/engine';
import { PORTRAIT_GEOMETRY, P_FIELD_W, P_ROWS } from '../renderer/board/portraitLayout';
import type { SessionConfig } from '../renderer/game/session';
import { Battle } from '../renderer/screens/Battle';
import { bandY, handScale, PortraitBattleScreen } from '../renderer/screens/PortraitBattleScreen';
import { DEFAULT_SETTINGS, SettingsContext } from '../renderer/settings';
import {
  PORTRAIT_MIN_H,
  PORTRAIT_W,
  PortraitAllowed,
  StageInfo,
  stageLayout,
  type StageLayout,
} from '../renderer/stageFit';

const config: SessionConfig = {
  seed: 7,
  myDeck: STARTER_DECKS[0]!.deck,
  myDeckName: STARTER_DECKS[0]!.name,
  aiDeck: STARTER_DECKS[1]!.deck,
  aiDeckName: STARTER_DECKS[1]!.name,
  aiLevel: 'basic',
};

afterEach(cleanup);

describe('the portrait stage', () => {
  it('turns portrait only when a battle allows it and the screen is clearly taller than wide', () => {
    expect(stageLayout(412, 915).portrait).toBeUndefined(); // not allowed: the menus stay landscape
    const p = stageLayout(412, 915, true);
    expect(p).toMatchObject({ portrait: true, edge: 0, phone: true });
    expect(p.height).toBe(Math.round((PORTRAIT_W * 915) / 412)); // as tall as the phone's shape
    expect(p.scale).toBeCloseTo(412 / PORTRAIT_W);
    // a landscape phone, or a nearly square tablet window, keeps the landscape stage
    expect(stageLayout(915, 412, true).portrait).toBeUndefined();
    expect(stageLayout(800, 880, true).portrait).toBeUndefined();
    // a 4:3 tablet held upright: at least the minimum height, scaled to fit both ways
    const tab = stageLayout(768, 1024, true);
    expect(tab.height).toBe(PORTRAIT_MIN_H);
    expect(tab.scale * PORTRAIT_MIN_H).toBeLessThanOrEqual(1024);
  });

  it('the band line follows the field row: centred in the spare height of a tall phone', () => {
    expect(bandY(1924)).toBe(150 + P_ROWS.band);
    expect(bandY(2400)).toBe(Math.round(150 + ((2400 - 1924) * 0.25) / 2 + P_ROWS.band));
    // the hand grows into the rest: the minimum size on a short screen, bigger on a tall phone
    expect(handScale(1924)).toBe(1.45);
    expect(handScale(2400)).toBeGreaterThan(1.45);
    expect(handScale(4000)).toBe(2);
  });
});

describe('the portrait field (mirror, both sides the same size)', () => {
  it('puts the opponent across the table from you, same size, inside the canvas', () => {
    const g = PORTRAIT_GEOMETRY;
    expect(g.pos(AI, 'vanguard').y).toBeLessThan(g.pos(ME, 'vanguard').y);
    expect(g.pos(AI, 'front_left').y).toBeGreaterThan(g.pos(AI, 'back_left').y);
    expect(g.pos(ME, 'front_left').y).toBeLessThan(g.pos(ME, 'back_left').y);
    expect(g.pos(AI, 'front_left').x).toBeGreaterThan(g.pos(ME, 'front_left').x);
    expect(g.size(AI, 'front_left')).toEqual(g.size(ME, 'front_left'));
    // rings clear the 150 px side columns
    for (const p of [AI, ME])
      for (const c of ['front_left', 'front_right'] as const) {
        const r = g.ring!(p, c) / 2;
        expect(g.pos(p, c).x - r).toBeGreaterThan(150);
        expect(g.pos(p, c).x + r).toBeLessThan(P_FIELD_W - 150);
      }
  });
});

const portraitStage: StageLayout = {
  scale: 0.38,
  phone: true,
  edge: 0,
  portrait: true,
  height: 2398,
};
const landscapeStage: StageLayout = { scale: 0.21, phone: true, edge: 0 };

function At({ stage, allow }: { stage: StageLayout; allow?: (on: boolean) => void }) {
  return (
    <PortraitAllowed.Provider value={allow ?? (() => {})}>
      <StageInfo.Provider value={stage}>
        <SettingsContext.Provider value={{ ...DEFAULT_SETTINGS, battleLayout: 'phone' }}>
          <Battle config={config} onRematch={() => {}} onExit={() => {}} />
        </SettingsContext.Provider>
      </StageInfo.Provider>
    </PortraitAllowed.Provider>
  );
}

describe('PortraitBattleScreen', () => {
  it('shows the opponent bar, both fields, the damage columns, your hand and the phase bar', () => {
    render(<PortraitBattleScreen config={config} onRematch={() => {}} onExit={() => {}} />);
    expect(screen.getByTestId('p-top').textContent).toContain('CPU (Normal)');
    expect(screen.getByTestId('plate-me').textContent).toContain('You');
    for (const p of [AI, ME])
      for (const c of ['vanguard', 'front_left', 'back_right'])
        expect(screen.getByTestId(`circle-${p}-${c}`)).toBeTruthy();
    expect(screen.getByTestId('p-damage-me').textContent).toContain('0/6');
    expect(screen.getByTestId('p-damage-opp')).toBeTruthy();
    expect(screen.getByTestId('hand-0')).toBeTruthy();
    expect(screen.getByTestId('phase-bar')).toBeTruthy();
    expect(screen.getByTestId('mulligan')).toBeTruthy(); // the shared prompts work here too
  });

  it('a battle allows portrait while it is open, and gives it back when it closes', () => {
    const allow = vi.fn();
    const { unmount } = render(<At stage={landscapeStage} allow={allow} />);
    expect(allow).toHaveBeenLastCalledWith(true);
    unmount();
    expect(allow).toHaveBeenLastCalledWith(false);
  });

  it('turning the phone mid-game swaps the layout and keeps the game', () => {
    const { rerender } = render(<At stage={landscapeStage} />);
    expect(screen.queryByTestId('p-top')).toBeNull(); // the landscape phone layout
    // keep the opening hand, so the game has moved on from its first state
    act(() => {
      fireEvent.click(screen.getByText('Keep hand'));
    });
    const handBefore = [...document.querySelectorAll('[data-testid^="hand-"]')].map(
      (el) => (el as HTMLElement).dataset.iid ?? el.getAttribute('data-iid'),
    );
    rerender(<At stage={portraitStage} />);
    expect(screen.getByTestId('p-top')).toBeTruthy(); // now the portrait layout
    expect(screen.queryByTestId('mulligan')).toBeNull(); // the mulligan stays done
    const handAfter = [...document.querySelectorAll('[data-testid^="hand-"]')].map(
      (el) => (el as HTMLElement).dataset.iid ?? el.getAttribute('data-iid'),
    );
    expect(handBefore.length).toBeGreaterThan(0);
    expect(handAfter).toEqual(handBefore);
    rerender(<At stage={landscapeStage} />);
    expect(screen.queryByTestId('p-top')).toBeNull();
    expect(screen.queryByTestId('mulligan')).toBeNull();
  });
});
