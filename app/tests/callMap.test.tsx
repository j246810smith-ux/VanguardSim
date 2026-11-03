// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { createGame } from '../../src/engine';
import { ctx } from '../renderer/engine';
import { CallMap } from '../renderer/prompts/Prompts';

describe('call map (v0.28)', () => {
  afterEach(cleanup);

  it('lays the circles out like the board; only legal circles can be picked', () => {
    const { state } = createGame(
      { seed: 1, decks: [STARTER_DECKS[0]!.deck, STARTER_DECKS[1]!.deck] },
      ctx,
    );
    const onCall = vi.fn();
    const { getByTestId } = render(
      <CallMap view={state} open={['front_left', 'back_center']} onCall={onCall} />,
    );
    const rows = getByTestId('call-map').querySelectorAll('.call-row');
    expect(rows).toHaveLength(2);
    // front row: left, VC, right — back row: left, centre, right
    expect(rows[0]!.textContent).toMatch(/FRONT.*VC.*FRONT/);
    expect(rows[1]!.querySelectorAll('button')).toHaveLength(3);
    expect((getByTestId('call-front_right') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(getByTestId('call-back_center'));
    expect(onCall).toHaveBeenCalledWith('back_center');
  });
});
