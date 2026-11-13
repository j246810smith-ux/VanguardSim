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
/** Flights started: each moving card is drawn by a flat copy over the stage (board/motion.ts). */
const flights = () =>
  animate.mock.contexts.filter((el) => (el as HTMLElement).classList.contains('motion-ghost'))
    .length;

beforeEach(() => {
  boxes.clear();
  cancels = 0;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    // a flying copy (D-035 ghost) is drawn where its card is
    const d = (this as HTMLElement).dataset;
    const b = boxes.get(d?.iid ?? d?.ghostOf ?? '');
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
    expect(flights()).toBe(1);
    rerender(<Board view={next} hovered />);
    expect(flights()).toBe(1);
  });

  it('cancels a slide still running before measuring the next view', () => {
    boxes.set('c1', { x: 0, y: 0 }).set('c2', { x: 110, y: 0 });
    const { rerender } = render(<Board view={{}} />);
    boxes.set('c1', { x: 300, y: 0 });
    rerender(<Board view={{}} />);
    expect(flights()).toBe(1);
    const runs = animate.mock.calls.length; // the copy's flight and the real card's fade-in
    rerender(<Board view={{}} />); // nothing moved: the running flight is cancelled, none restarted
    expect(cancels).toBe(runs);
    expect(flights()).toBe(1);
    expect(document.querySelector('.motion-ghost')).toBeNull();
  });

  // the draw flourish (user's request, 2026-11-13): deck → hand lifts, turns over and lands
  it('a card drawn into the hand turns over on its way; other arrivals just fade in', () => {
    function Table({ view, cards }: { view: object; cards: readonly string[] }) {
      const moves = new Map<string, Move>([
        ['d1', { from: '0-deck', to: null }],
        ['x1', { from: '0-drop', to: null }],
      ]);
      useCardMotion(() => moves, 300, view);
      return (
        <div className="stage">
          <div data-zone="0-deck" />
          <div data-zone="0-drop" />
          <div className="hand">
            {cards.map((id) => (
              <div key={id} className="hand-card" data-iid={id}>
                <div className="card" />
              </div>
            ))}
          </div>
        </div>
      );
    }
    boxes.set('d1', { x: 600, y: 900 }).set('x1', { x: 700, y: 900 });
    const { rerender } = render(<Table view={{}} cards={[]} />);
    rerender(<Table view={{}} cards={['d1', 'x1']} />);
    const ghosts = animate.mock.contexts.filter((el) =>
      (el as HTMLElement).classList.contains('motion-ghost'),
    ) as HTMLElement[];
    expect(ghosts).toHaveLength(2);
    const draw = ghosts.find((g) => g.classList.contains('draw-ghost'))!;
    expect(draw).toBeTruthy();
    expect(draw.querySelector('.draw-back')).not.toBeNull();
    expect(draw.querySelector('.draw-face .card')).not.toBeNull();
    const frames = animate.mock.calls[animate.mock.contexts.indexOf(draw)]![0] as Keyframe[];
    expect(String(frames[0]!.transform)).toContain('rotateY(180deg)');
    expect(String(frames[frames.length - 1]!.transform)).toContain('rotateY(0deg)');
    const plain = ghosts.find((g) => !g.classList.contains('draw-ghost'))!;
    expect(plain.querySelector('.draw-back')).toBeNull();
  });
});
