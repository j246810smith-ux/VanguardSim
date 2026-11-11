// @vitest-environment jsdom
// Battles on the field (Battlefield 2.0 phase 5): ATTACK! in place of VS as an attack begins, the
// marked guardians previewed on the defence plate, and the attacked unit's ring.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
});
