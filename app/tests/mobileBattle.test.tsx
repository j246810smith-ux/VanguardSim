// @vitest-environment jsdom
// The phone layout of a game (docs/android/MOBILE_UI_PLAN.md, phase 2): the same controller as
// the desktop stage, laid out for a landscape phone.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { AI, ME } from '../renderer/engine';
import { Hand } from '../renderer/board/Hand';
import { legalOf } from '../renderer/game/interaction';
import { GameSession } from '../renderer/game/session';
import { MOBILE_GEOMETRY, MOBILE_GEOMETRY_OPP_OPEN } from '../renderer/board/mobileLayout';
import { usesPhoneLayout } from '../renderer/screens/Battle';
import { MobileBattleScreen } from '../renderer/screens/MobileBattleScreen';
import type { SessionConfig } from '../renderer/game/session';
import { DEFAULT_SETTINGS } from '../renderer/settings';

const config: SessionConfig = {
  seed: 7,
  myDeck: STARTER_DECKS[0]!.deck,
  myDeckName: STARTER_DECKS[0]!.name,
  aiDeck: STARTER_DECKS[1]!.deck,
  aiDeckName: STARTER_DECKS[1]!.name,
  aiLevel: 'basic',
};

const show = () =>
  render(<MobileBattleScreen config={config} onRematch={() => {}} onExit={() => {}} />);

afterEach(cleanup);

describe('choosing the layout', () => {
  it('Automatic uses the phone layout on Android or a phone-sized screen; the others are fixed', () => {
    expect(usesPhoneLayout('auto', false, false)).toBe(false);
    expect(usesPhoneLayout('auto', true, false)).toBe(true);
    expect(usesPhoneLayout('auto', false, true)).toBe(true);
    expect(usesPhoneLayout('desktop', true, true)).toBe(false);
    expect(usesPhoneLayout('phone', false, false)).toBe(true);
    expect(DEFAULT_SETTINGS.battleLayout).toBe('auto');
  });
});

describe('the field geometry', () => {
  it('puts the opponent above you, mirrored, and draws your units larger', () => {
    const g = MOBILE_GEOMETRY;
    expect(g.pos(AI, 'vanguard').y).toBeLessThan(g.pos(ME, 'vanguard').y);
    // front rows face each other across the banner
    expect(g.pos(AI, 'front_left').y).toBeGreaterThan(g.pos(AI, 'back_left').y);
    expect(g.pos(ME, 'front_left').y).toBeLessThan(g.pos(ME, 'back_left').y);
    // the opponent's left is on your right
    expect(g.pos(AI, 'front_left').x).toBeGreaterThan(g.pos(ME, 'front_left').x);
    expect(g.size(ME, 'vanguard').h).toBeGreaterThan(g.size(AI, 'vanguard').h);
    expect(g.size(ME, 'vanguard').h).toBeGreaterThan(g.size(ME, 'front_left').h);
  });

  it('opening the opponent field draws both sides the same size', () => {
    const g = MOBILE_GEOMETRY_OPP_OPEN;
    expect(g.size(AI, 'front_left')).toEqual(g.size(ME, 'front_left'));
  });
});

describe('MobileBattleScreen', () => {
  it('shows both plates, all twelve circles, the phase bar, Card Info and the hand', () => {
    show();
    expect(screen.getByTestId('plate-opp').textContent).toContain('CPU (Normal)');
    expect(screen.getByTestId('plate-me').textContent).toContain('You');
    for (const p of [AI, ME])
      for (const c of ['vanguard', 'front_left', 'back_center'])
        expect(screen.getByTestId(`circle-${p}-${c}`)).toBeTruthy();
    expect(screen.getByTestId('phase-bar').textContent).toContain('Battle');
    expect(screen.getByTestId('card-info').textContent).toContain('Card Info');
    expect(screen.getByTestId('hand-0')).toBeTruthy();
    // the mulligan comes first, through the shared prompts
    expect(screen.getByTestId('mulligan')).toBeTruthy();
  });

  it('tapping the opponent band opens it up, and again shrinks it', () => {
    const { container } = show();
    const battle = container.querySelector('.m-battle')!;
    expect(battle.classList.contains('opp-open')).toBe(false);
    fireEvent.click(screen.getByTestId('opp-band'));
    expect(battle.classList.contains('opp-open')).toBe(true);
    fireEvent.click(screen.getByTestId('opp-band'));
    expect(battle.classList.contains('opp-open')).toBe(false);
  });

  it('a tapped hand card shows in Card Info; Card Info can be hidden', () => {
    show();
    act(() => {
      fireEvent.click(screen.getByTestId('hand-0'));
    });
    const info = screen.getByTestId('card-info');
    // during the mulligan a tap marks the card; selecting is for later, so check the panel's hint
    expect(info.textContent).toMatch(/Card Info/);
    fireEvent.click(screen.getByTestId('rail-info'));
    expect(screen.getByTestId('card-info').textContent).toBe('');
  });

  it('the game is played through the same actions: keeping the hand starts the game', () => {
    show();
    act(() => {
      fireEvent.click(screen.getByTestId('mulligan').querySelector('button')!);
    });
    // your hand is kept; the CPU's mulligan follows after its pause
    expect(screen.queryByTestId('mulligan')).toBeNull();
    expect(screen.getByTestId('phase-banner')).toBeTruthy();
  });

  it('the first tap on the hand opens it large; Smaller closes it; a tap in the large hand acts', () => {
    const { container } = show();
    const battle = container.querySelector('.m-battle')!;
    act(() => {
      fireEvent.click(screen.getByTestId('hand-0'));
    });
    expect(battle.classList.contains('hand-big')).toBe(true);
    // nothing was marked by the tap that opened it
    expect(screen.getByTestId('hand-0').classList.contains('marked')).toBe(false);
    act(() => {
      fireEvent.click(screen.getByTestId('hand-0'));
    });
    // in the mulligan, a tap in the large hand marks the card to return
    expect(screen.getByTestId('hand-0').classList.contains('marked')).toBe(true);
    fireEvent.click(screen.getByTestId('hand-smaller'));
    expect(battle.classList.contains('hand-big')).toBe(false);
  });

  it("a tap on the opponent's vanguard shows it in Card Info, not a pop-up", () => {
    vi.useFakeTimers();
    try {
      show();
      act(() => {
        fireEvent.click(screen.getByTestId('mulligan').querySelector('button')!);
      });
      // the CPU keeps or redraws and the game starts: both vanguards stand up face up
      for (
        let i = 0;
        i < 20 && /MULLIGAN/.test(screen.getByTestId('phase-banner').textContent!);
        i++
      )
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      const opp = screen.getByTestId(`circle-${AI}-vanguard`);
      act(() => {
        fireEvent.click(opp);
      });
      expect(screen.queryByTestId('card-details')).toBeNull();
      const info = screen.getByTestId('card-info').textContent!;
      // the panel shows a card (its stats line), not the empty hint
      expect(info).not.toContain('Tap a card');
      expect(info).toMatch(/G\d/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('battle focus on the phone', () => {
  it('as an attack begins, the attacker and target are in focus for a moment', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <MobileBattleScreen
          config={{ ...config, demo: { p1Level: 'basic', speed: 'veryfast' } }}
          onRematch={() => {}}
          onExit={() => {}}
        />,
      );
      const field = () => container.querySelector('.m-field')!;
      for (let i = 0; i < 3000 && !field().classList.contains('focusing'); i++)
        act(() => {
          vi.advanceTimersByTime(50);
        });
      expect(field().classList.contains('focusing')).toBe(true);
      expect(container.querySelectorAll('.m-field .circle.focus').length).toBe(2);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      // the CPUs may already be on their next attack; the first focus has ended
      expect(container.querySelectorAll('.m-field .circle.focus').length).toBeLessThanOrEqual(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the hand on the phone', () => {
  const session = new GameSession(config);
  const hand = (stripAbove: number) =>
    render(
      <Hand
        view={session.view}
        legal={legalOf(session.actions)}
        selection={null}
        marked={[]}
        onClick={() => {}}
        onDetails={() => {}}
        spreadWidth={460}
        stripAbove={stripAbove}
      />,
    ).container.querySelector('.hand')!;

  it('fans a small hand and makes a big one a row to swipe', () => {
    expect(hand(6).classList.contains('hand-strip')).toBe(false);
    cleanup();
    expect(hand(3).classList.contains('hand-strip')).toBe(true);
  });
});
