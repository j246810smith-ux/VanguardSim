// @vitest-environment jsdom
// Battles on the field (Battlefield 2.0 phase 5): ATTACK! in place of VS as an attack begins, the
// marked guardians previewed on the defence plate, and the attacked unit's ring.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { currentPower, type GameState } from '../../src/engine';
import { Field } from '../renderer/board/Field';
import { BattleHud } from '../renderer/combat/Combat';
import { ctx, ME } from '../renderer/engine';
import { GameSession } from '../renderer/game/session';

afterEach(cleanup);

/** A CPU game played on until the opponent attacks the player (seat 0 defends). */
function battleView(): GameState {
  for (let seed = 1; seed < 40; seed++) {
    const s = new GameSession({
      seed,
      myDeck: STARTER_DECKS[0]!.deck,
      myDeckName: 'A',
      aiDeck: STARTER_DECKS[1]!.deck,
      aiDeckName: 'B',
      aiLevel: 'basic',
      demo: { p1Level: 'basic', speed: 'normal' },
    });
    for (let i = 0; i < 3000 && s.state.status !== 'finished'; i++) {
      s.stepAi();
      const b = s.state.battle;
      if (b && s.state.activePlayer !== ME && s.state.players[ME].hand.length > 0) return s.state;
    }
  }
  throw new Error('no battle found');
}

describe('the battle row', () => {
  const view = battleView();
  const b = view.battle!;
  const atk = currentPower(view, ctx, b.attacker);
  const def = currentPower(view, ctx, b.target);

  it('says ATTACK! instead of VS as an attack begins', () => {
    const { rerender } = render(<BattleHud view={view} attackFresh />);
    expect(screen.getByTestId('vs-mark').textContent).toBe('ATTACK!');
    rerender(<BattleHud view={view} />);
    expect(screen.getByTestId('vs-mark').textContent).toBe('VS');
  });

  it('previews the guardians marked in the hand on the defence plate', () => {
    const enough = Math.max(5000, Math.ceil((atk - def + 1) / 5000) * 5000);
    render(<BattleHud view={view} marked={enough} />);
    const plate = screen.getByTestId('defence-plate');
    expect(plate.textContent).toContain(String(def + enough));
    expect(plate.textContent).toContain(`marked +${enough}`);
    expect(plate.textContent).toContain('GUARDED');
    expect(plate.className).toContain('previewing');
  });

  it('shows the real defence when nothing is marked', () => {
    render(<BattleHud view={view} />);
    const plate = screen.getByTestId('defence-plate');
    expect(plate.textContent).toContain(String(def));
    expect(plate.className).not.toContain('previewing');
  });

  it('marks the attacked unit on the field', () => {
    const target = b.target;
    render(
      <Field
        view={view}
        player={ME}
        stateOf={() => ({ mark: null, selected: null })}
        onCircle={() => {}}
        onDetails={() => {}}
        battleAttacker={b.attacker}
        battleTarget={target}
      />,
    );
    expect(document.querySelectorAll('.in-battle-target')).toHaveLength(1);
  });

  it('power plates show the engine power at once and flash on a change (animated numbers)', () => {
    vi.useFakeTimers();
    try {
      const unit = view.players[ME].circles.vanguard[0]!;
      const field = (v: GameState) => (
        <Field
          view={v}
          player={ME}
          stateOf={() => ({ mark: null, selected: null })}
          onCircle={() => {}}
          onDetails={() => {}}
          battleAttacker={null}
        />
      );
      const { rerender } = render(field(view));
      const plate = () =>
        document.querySelector(`[data-iid="${unit}"] [data-testid="power-plate"]`)!;
      const before = currentPower(view, ctx, unit);
      expect(plate().textContent).toBe(String(before));
      expect(plate().className).not.toContain('changed');
      const up: GameState = {
        ...view,
        modifiers: [
          ...view.modifiers,
          { target: unit, stat: 'power', amount: 5000, until: 'end_of_turn' },
        ],
      };
      rerender(field(up));
      // the new value is there immediately, with the flash; the flash ends by itself
      expect(plate().textContent).toBe(String(currentPower(up, ctx, unit)));
      expect(currentPower(up, ctx, unit)).toBe(before + 5000);
      expect(plate().className).toContain('changed');
      expect(plate().className).toContain('up');
      act(() => vi.advanceTimersByTime(500));
      expect(plate().className).not.toContain('changed');
      // rapid consecutive changes: always the latest value
      for (const amount of [1000, -3000, 2000]) {
        const next: GameState = {
          ...up,
          modifiers: [
            ...up.modifiers,
            { target: unit, stat: 'power', amount, until: 'end_of_turn' },
          ],
        };
        rerender(field(next));
        expect(plate().textContent).toBe(String(currentPower(next, ctx, unit)));
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
