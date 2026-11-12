// @vitest-environment jsdom
// The G zone viewer (feedback 2026-11-12): a player's own G zone shows its cards face up, face-down
// ones with a FACE DOWN tag (CR 1.48.1 4.11.2); the opponent's face-down G units stay hidden.
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { viewFor } from '../../src/engine';
import { gScene } from '../../tests/fixtures/gEra';
import { gZoneTitle } from '../renderer/board/Panels';
import { restrictionText, ZoneViewer } from '../renderer/prompts/CardDetails';

const scene = () =>
  gScene({
    attacker: { circles: { vanguard: 'G-TD01-002' } },
    defender: { circles: { vanguard: 'G-TD02-004' } },
    at: 'main',
    faceUpG: 1,
  });

describe('G zone viewer', () => {
  afterEach(cleanup);

  it('shows every card of your own G zone face up, tagging the face-down ones', () => {
    const s = scene();
    const view = viewFor(s, 0);
    const ids = view.players[0].gzone;
    expect(ids.length).toBeGreaterThan(1);
    const { container, getByTestId } = render(
      <ZoneViewer
        view={view}
        title="Your G zone"
        ids={ids}
        revealFaceDown
        onPick={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.querySelectorAll('.zone-grid .card').length).toBe(ids.length);
    expect(container.querySelector('.zone-grid .card.back')).toBeNull();
    const tags = container.querySelectorAll('.zone-face-tag');
    const down = ids.filter((id) => !view.cards[id]!.faceUp);
    expect(tags.length).toBe(down.length);
    expect(down.length).toBe(ids.length - 1);
    const faceUp = ids.find((id) => view.cards[id]!.faceUp)!;
    expect(getByTestId(`zone-card-${faceUp}`).querySelector('.zone-face-tag')).toBeNull();
    // the game state is not touched by looking
    expect(s.players[0].gzone.filter((id) => s.cards[id]!.faceUp)).toHaveLength(1);
  });

  it('a face-down card can be picked for Card Details', () => {
    const view = viewFor(scene(), 0);
    const ids = view.players[0].gzone;
    const onPick = vi.fn();
    const { getByTestId } = render(
      <ZoneViewer
        view={view}
        title="Your G zone"
        ids={ids}
        revealFaceDown
        onPick={onPick}
        onClose={() => {}}
      />,
    );
    const down = ids.find((id) => !view.cards[id]!.faceUp)!;
    fireEvent.click(getByTestId(`zone-card-${down}`));
    expect(onPick).toHaveBeenCalledWith(down);
  });

  it("the opponent's face-down G units stay backs even when asked to reveal", () => {
    // player 1 looks at player 0's G zone: the engine hides the face-down ones
    const view = viewFor(scene(), 1);
    const ids = view.players[0].gzone;
    const { container } = render(
      <ZoneViewer
        view={view}
        title="Opponent's G zone"
        ids={ids}
        revealFaceDown
        onPick={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.querySelectorAll('.zone-grid .card.back').length).toBe(ids.length - 1);
    expect(container.querySelectorAll('.zone-face-tag').length).toBe(0);
  });

  it('without reveal, face-down cards are backs (damage, soul, drop as before)', () => {
    const view = viewFor(scene(), 0);
    const ids = view.players[0].gzone;
    const { container } = render(
      <ZoneViewer view={view} title="Your G zone" ids={ids} onPick={() => {}} onClose={() => {}} />,
    );
    expect(container.querySelectorAll('.zone-grid .card.back').length).toBe(ids.length - 1);
  });

  it("the opponent's G zone title counts the face-down cards it does not show", () => {
    const view = viewFor(scene(), 1);
    const n = view.players[0].gzone.length;
    expect(gZoneTitle(view, view.players[0].gzone)).toBe(`Opponent's G zone · ${n - 1} face down`);
    expect(gZoneTitle(view, [])).toBe("Opponent's G zone");
  });

  it('Card Details describes restrictions in words, not raw data', () => {
    expect(restrictionText('cannot_intercept')).toBe('cannot intercept');
    expect(restrictionText('resist')).toContain('Resist');
    expect(restrictionText('cannot_attack_vanguard')).toBe('cannot attack a vanguard');
  });
});
