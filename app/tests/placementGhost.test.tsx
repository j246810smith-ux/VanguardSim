// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ghostSpot, usePlacementGhost } from '../renderer/board/placementGhost';

// owner's request 2026-11-18 (after fight-club.dev): a selected hand card follows the mouse
describe('placement ghost', () => {
  let fine = true;
  let under: Element | null = null;
  beforeEach(() => {
    fine = true;
    under = null;
    window.matchMedia = ((q: string) => ({ matches: q === '(pointer: fine)' && fine })) as never;
    document.elementFromPoint = () => under;
    document.elementsFromPoint = () => (under ? [under] : []);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('snaps onto a glowing circle and is sized to it; elsewhere it sits on the pointer', () => {
    expect(ghostSpot({ x: 5, y: 6 }, { w: 100, h: 150 }, null)).toEqual({
      x: 5,
      y: 6,
      s: 0.8,
      snap: false,
    });
    const on = ghostSpot({ x: 5, y: 6 }, { w: 100, h: 150 }, { cx: 400, cy: 300, h: 300 });
    expect(on).toMatchObject({ x: 400, y: 300, snap: true });
    expect(on.s).toBeCloseTo(1.72);
  });

  function Screen({ selected, glow }: { selected: string | null; glow: string }) {
    usePlacementGhost(selected);
    return (
      <div className="stage">
        <div className="table-wrap">
          <div className={`circle ${glow}`} data-testid="circle-0-front_left">
            <div className="ring" />
          </div>
          <div className="circle" data-testid="circle-0-back_left">
            <div className="ring" />
          </div>
        </div>
        <div className="hand">
          <div className="hand-card selected" data-iid="h1">
            <div className="card" />
          </div>
        </div>
      </div>
    );
  }
  const move = () =>
    document.dispatchEvent(
      Object.assign(new Event('pointermove'), { pointerType: 'mouse', clientX: 10, clientY: 10 }),
    );
  const ghost = () => document.getElementById('place-ghost');

  it('follows the mouse over the table while a hand card is selected, and goes away after', () => {
    const { rerender } = render(<Screen selected="h1" glow="hl hl-call" />);
    under = document.querySelector('[data-testid="circle-0-front_left"] .ring');
    move();
    expect(ghost()).not.toBeNull();
    expect(ghost()!.hidden).toBe(false);
    expect(ghost()!.classList.contains('snap')).toBe(true);
    expect(ghost()!.style.pointerEvents).toBe('none'); // the click still reaches the circle
    under = document.querySelector('[data-testid="circle-0-back_left"] .ring');
    move();
    expect(ghost()!.classList.contains('snap')).toBe(false); // not a circle it can go to
    under = document.querySelector('.hand-card');
    move();
    expect(ghost()!.hidden).toBe(true); // off the table (over the hand)
    rerender(<Screen selected={null} glow="hl hl-call" />);
    expect(ghost()).toBeNull();
  });

  it('is not shown on a touch screen or while the card is dragged', () => {
    fine = false;
    render(<Screen selected="h1" glow="hl hl-call" />);
    under = document.querySelector('.ring');
    move();
    expect(ghost()).toBeNull();
    cleanup();
    fine = true;
    render(<Screen selected="h1" glow="hl hl-call" />);
    document.querySelector('.hand-card')!.classList.add('dragging');
    under = document.querySelector('.ring');
    move();
    expect(ghost()?.hidden ?? true).toBe(true);
  });
});
