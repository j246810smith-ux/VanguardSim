// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Command } from '../../src/engine';
import { setPlayFormat } from '../renderer/engine';
import { GameSession } from '../renderer/game/session';
import { legalOf } from '../renderer/game/interaction';
import { StridePrompt } from '../renderer/prompts/GPrompts';
import { deckEntries } from '../renderer/screens/deckChoice';
import { gApply, gLegal, gScene } from '../../tests/fixtures/gEra';

// G era in the app (D-034, in testing): the format picker's decks, the session's rules, stride.
describe('G era in the app', () => {
  afterEach(() => {
    cleanup();
    setPlayFormat('classic');
  });

  it('lists the G Trial Decks first in the G era only', () => {
    expect(deckEntries('g')[0]!.section).toBe('gtrial');
    expect(deckEntries('classic').some((d) => d.section === 'gtrial')).toBe(false);
  });

  it('a G-era session plays by the G rules; Classic sessions by Classic', () => {
    const g = deckEntries('g');
    const base = {
      seed: 3,
      myDeck: g[0]!.deck,
      myDeckName: g[0]!.name,
      aiDeck: g[1]!.deck,
      aiDeckName: g[1]!.name,
      aiLevel: 'basic' as const,
    };
    expect(new GameSession({ ...base, format: 'g' }).state.players[0].gzone).toHaveLength(2);
    const classic = deckEntries('classic');
    const c = new GameSession({
      ...base,
      myDeck: classic[0]!.deck,
      aiDeck: classic[1]!.deck,
      format: 'classic',
    });
    expect(c.state.players[0].gzone).toHaveLength(0);
  });

  it('the stride prompt sends a stride the engine accepts (suggested discard by default)', () => {
    const s = gScene({
      attacker: { circles: { vanguard: 'G-TD01-002' }, hand: ['G-TD01-003'] },
      defender: { circles: { vanguard: 'G-TD02-004' } },
      at: 'ride',
    });
    const r = gApply(s, { type: 'END_PHASE', player: 0 }); // ride step → stride step
    const stride = legalOf([gLegal(r.state, 0, 'STRIDE')!]).stride!;
    const sent: Command[] = [];
    const { getByTestId } = render(
      <StridePrompt
        view={r.state}
        stride={stride}
        onSend={(c) => sent.push(c)}
        onClose={() => {}}
      />,
    );
    fireEvent.click(getByTestId('stride-unit-0'));
    fireEvent.click(getByTestId('stride-go'));
    expect(sent).toHaveLength(1);
    const after = gApply(r.state, sent[0]!);
    expect(after.events.some((e) => e.type === 'STRIDE')).toBe(true);
  });
});
