// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCardMotion, type Move } from '../renderer/board/motion';

// jsdom has no layout: each card's on-screen box comes from `boxes` (stage coordinates).
const boxes = new Map<string, { x: number; y: number }>();
const rect = (x: number, y: number) =>
  ({ left: x, top: y, width: 100, height: 150, right: x + 100, bottom: y + 150 }) as DOMRect;

let animate: ReturnType<typeof vi.fn>;
let cancels: number;

beforeEach(() => {
  boxes.clear();
  cancels = 0;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const b = boxes.get((this as HTMLElement).dataset?.iid ?? '');
    return b ? rect(b.x, b.y) : rect(0, 0);
  });
  animate = vi.fn(() => {
    const run = { cancel: () => cancels++, onfinish: null, oncancel: null };
    return run as unknown as Animation;
  });
  Element.prototype.animate = animate as unknown as Element['animate'];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (Element.prototype as Partial<Element>).animate;
});

function Board({ view, hovered }: { view: object; hovered?: boolean }) {
  useCardMotion(() => new Map<string, Move>(), 300, view);
  return (
    <div className="stage">
      <div className={hovered ? 'hand-card hover' : 'hand-card'} data-iid="c1" />
      <div className="hand-card" data-iid="c2" />
    </div>
  );
}

describe('card movement animation', () => {
  // Regression (v0.19): every render measured the cards, so a render while a card was lifted by
  // hover or still sliding started a new slide; slides moved cards under the mouse, which
  // re-rendered, and the hand jittered until something (opening the log) gave a still render.
  it('starts no slide on renders that show the same game view', () => {
    const view = {};
    boxes.set('c1', { x: 0, y: 0 }).set('c2', { x: 110, y: 0 });
    const { rerender } = render(<Board view={view} />);
    boxes.set('c1', { x: 0, y: -70 }); // drawn mid-hover / mid-slide
    rerender(<Board view={view} hovered />);
    boxes.set('c1', { x: 0, y: 0 });
    rerender(<Board view={view} />);
    expect(animate).not.toHaveBeenCalled();
  });

  it('slides a card that moved in a new game view, once', () => {
    boxes.set('c1', { x: 0, y: 0 }).set('c2', { x: 110, y: 0 });
    const { rerender } = render(<Board view={{}} />);
    boxes.set('c1', { x: 300, y: 0 });
    const next = {};
    rerender(<Board view={next} />);
    expect(animate).toHaveBeenCalledTimes(1);
    rerender(<Board view={next} hovered />);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('cancels a slide still running before measuring the next view', () => {
    boxes.set('c1', { x: 0, y: 0 }).set('c2', { x: 110, y: 0 });
    const { rerender } = render(<Board view={{}} />);
    boxes.set('c1', { x: 300, y: 0 });
    rerender(<Board view={{}} />);
    expect(animate).toHaveBeenCalledTimes(1);
    rerender(<Board view={{}} />); // nothing moved: the running slide is cancelled, none restarted
    expect(cancels).toBe(1);
    expect(animate).toHaveBeenCalledTimes(1);
  });
});
