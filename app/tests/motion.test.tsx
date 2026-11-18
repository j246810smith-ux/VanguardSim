// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { landKindOf, useCardMotion, type Move } from '../renderer/board/motion';
import type { FxLevel } from '../renderer/board/cardFx';

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

  // card effects (docs/design/CARD_MOTION_POLISH.md, user-approved 2026-11-13)
  describe('card effects', () => {
    function Field({
      view,
      onCircle,
      inDrop,
      moves,
      fx,
    }: {
      view: object;
      onCircle: boolean;
      inDrop?: boolean;
      moves: Map<string, Move>;
      fx: FxLevel;
    }) {
      useCardMotion(() => moves, 300, view, fx);
      return (
        <div className="stage">
          <div data-zone="0-drop" />
          <div className="side-me">
            {onCircle ? (
              <div className="circle" data-iid="u1">
                <div className="card" />
              </div>
            ) : (
              !inDrop && (
                <div className="hand-card" data-iid="u1">
                  <div className="card" />
                </div>
              )
            )}
          </div>
        </div>
      );
    }
    const count = (sel: string) => document.querySelectorAll(`.motion-layer ${sel}`).length;

    it('maps move reasons to landings', () => {
      expect(landKindOf('ride')).toBe('ride');
      expect(landKindOf('stride')).toBe('stride');
      expect(landKindOf('legion')).toBe('stride');
      expect(landKindOf('guard')).toBe('guard');
      expect(landKindOf('call')).toBe('call');
      expect(landKindOf('swap')).toBeNull();
      expect(landKindOf(undefined)).toBeNull();
    });

    it('a ride lands with a slam, two rings and sparks; with effects off only the flight runs', () => {
      for (const fx of ['full', 'off'] as const) {
        cleanup();
        animate.mockClear();
        const moves = new Map<string, Move>([['u1', { from: '0-hand', to: null, reason: 'ride' }]]);
        boxes.set('u1', { x: 100, y: 900 });
        const { rerender } = render(<Field view={{}} onCircle={false} moves={moves} fx={fx} />);
        boxes.set('u1', { x: 500, y: 400 });
        rerender(<Field view={{}} onCircle moves={moves} fx={fx} />);
        if (fx === 'full') {
          expect(document.querySelector('.land-ghost')).not.toBeNull();
          expect(count('.fx-ring')).toBe(2);
          expect(count('.fx-spark')).toBe(12);
          expect(count('.fx-glint')).toBe(1);
        } else {
          expect(document.querySelector('.land-ghost')).toBeNull();
          expect(count('.fx')).toBe(0);
        }
      }
    });

    it('a stride gets three rings, more sparks and a flash; a call one ring and a few sparks', () => {
      const land = (reason: string, fx: FxLevel = 'full') => {
        cleanup();
        const moves = new Map<string, Move>([['u1', { from: '0-hand', to: null, reason }]]);
        boxes.set('u1', { x: 100, y: 900 });
        const { rerender } = render(<Field view={{}} onCircle={false} moves={moves} fx={fx} />);
        boxes.set('u1', { x: 500, y: 400 });
        rerender(<Field view={{}} onCircle moves={moves} fx={fx} />);
        return {
          rings: count('.fx-ring'),
          sparks: count('.fx-spark'),
          flash: count('.fx-flash'),
        };
      };
      expect(land('stride')).toEqual({ rings: 3, sparks: 18, flash: 1 });
      expect(land('stride', 'reduced')).toEqual({ rings: 3, sparks: 9, flash: 0 });
      expect(land('call')).toEqual({ rings: 1, sparks: 6, flash: 0 });
    });

    it('a retired unit leaves a dust puff', () => {
      const moves = new Map<string, Move>([['u1', { from: null, to: '0-drop', reason: 'retire' }]]);
      boxes.set('u1', { x: 500, y: 400 });
      const { rerender } = render(<Field view={{}} onCircle moves={moves} fx="full" />);
      rerender(<Field view={{}} onCircle={false} inDrop moves={moves} fx="full" />);
      expect(count('.fx-dust')).toBe(6);
      expect(count('.fx-debris')).toBe(8);
    });
  });

  // owner's request 2026-11-18: cards move "along the lines of" fight-club.dev
  describe('turning, staggering and the soul', () => {
    const framesOf = (el: Element) =>
      animate.mock.calls[animate.mock.contexts.indexOf(el)]![0] as Keyframe[];
    const rot = (f: Keyframe | undefined) => String(f?.transform);

    function Units({
      view,
      units,
      moves = new Map(),
    }: {
      view: object;
      units: readonly { id: string; rest?: boolean; circle?: string }[];
      moves?: Map<string, Move>;
    }) {
      useCardMotion(() => moves, 300, view, 'full');
      return (
        <div className="stage">
          <div data-zone="0-drop" />
          <div data-zone="0-soul" />
          <div data-zone="0-bind" />
          <div className="side-me">
            <div className="circle" data-testid="circle-0-vanguard" data-iid="vc">
              <div className="unit" data-iid="vc">
                {/* data-iid: the mocked layout measures it (jsdom has none) */}
                <div className="card" data-iid="vc" />
              </div>
            </div>
            {units.map((u) => (
              <div key={u.id} className="circle" data-iid={u.id} data-testid={u.circle}>
                <div className="unit" data-iid={u.id}>
                  <div className={u.rest ? 'card rested' : 'card'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    it('a unit that stands up turns on its circle with a glow; one that rests turns too', () => {
      boxes.set('u1', { x: 300, y: 300 });
      const { rerender } = render(<Units view={{}} units={[{ id: 'u1', rest: true }]} />);
      rerender(<Units view={{}} units={[{ id: 'u1' }]} />);
      expect(flights()).toBe(0); // it did not move: no flying copy
      const face = document.querySelector('[data-iid="u1"] > .card')!;
      const stand = framesOf(face);
      expect(rot(stand[0])).toBe('rotate(90deg)');
      expect(rot(stand.at(-1))).toBe('rotate(0deg)');
      expect(String(stand[0]!.filter)).toContain('drop-shadow');
      rerender(<Units view={{}} units={[{ id: 'u1', rest: true }]} />);
      const rest = animate.mock.calls.at(-1)![0] as Keyframe[];
      expect(rot(rest[0])).toBe('rotate(0deg)');
      expect(rot(rest.at(-1))).toBe('rotate(90deg)');
    });

    it('a rested unit leaving for the drop zone turns upright on the way', () => {
      const moves = new Map<string, Move>([['u1', { from: null, to: '0-drop', reason: 'retire' }]]);
      boxes.set('u1', { x: 300, y: 300 });
      const { rerender } = render(
        <Units view={{}} units={[{ id: 'u1', rest: true }]} moves={moves} />,
      );
      rerender(<Units view={{}} units={[]} moves={moves} />);
      const ghost = document.querySelector('.motion-ghost')!;
      const face = ghost.querySelector('.card')!;
      expect(face.classList.contains('rested')).toBe(false);
      const turn = framesOf(face);
      expect(rot(turn[0])).toBe('rotate(90deg)');
      expect(rot(turn.at(-1))).toBe('rotate(0deg)');
    });

    it('cards called from one zone together leave a moment apart', () => {
      const moves = new Map<string, Move>(
        ['a', 'b', 'c'].map((id) => [id, { from: '0-bind', to: null, reason: 'call' }]),
      );
      const { rerender } = render(<Units view={{}} units={[]} moves={moves} />);
      rerender(<Units view={{}} units={[{ id: 'a' }, { id: 'b' }, { id: 'c' }]} moves={moves} />);
      const delays = animate.mock.contexts
        .map((el, i) => [el as HTMLElement, i] as const)
        .filter(([el]) => el.classList.contains('motion-ghost'))
        .map(([, i]) => (animate.mock.calls[i]![1] as KeyframeAnimationOptions).delay);
      expect(delays).toEqual([0, 66, 132]);
    });

    it('a card called from the soul slides out from under the vanguard, not out of the soul pile', () => {
      const moves = new Map<string, Move>([['s1', { from: '0-soul', to: null, reason: 'call' }]]);
      boxes.set('vc', { x: 400, y: 200 }).set('s1', { x: 600, y: 200 });
      const { rerender } = render(<Units view={{}} units={[]} moves={moves} />);
      rerender(<Units view={{}} units={[{ id: 's1' }]} moves={moves} />);
      const ghost = document.querySelector('.motion-ghost')!;
      // the vanguard's face is drawn at (400, 200), the card lands at (600, 200): 200px to its left
      expect(rot(framesOf(ghost)[0])).toContain('translate(-200px, 0px)');
      expect(framesOf(ghost)[0]!.opacity).toBe(1); // not faded in like a card out of a pile
    });
    it('a checked card lifts out of the trigger zone and turns sideways into the damage column', () => {
      // no moves on the first render (the card was already in the trigger zone)
      let moves = new Map<string, Move>();
      function Piles({ view, inDamage }: { view: object; inDamage: boolean }) {
        useCardMotion(() => moves, 300, view, 'full');
        return (
          <div className="stage">
            {inDamage ? (
              <div className="dmg-card" data-iid="t1">
                <div className="card mini" />
              </div>
            ) : (
              <div data-zone="0-trigger">
                <div data-iid="t1">
                  <div className="card" />
                </div>
              </div>
            )}
          </div>
        );
      }
      // jsdom has no CSS `rotate`: the damage column's sideways cards (styles.css) are mocked
      const real = window.getComputedStyle.bind(window);
      vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) =>
        el.classList.contains('mini') && el.closest('.dmg-card')
          ? ({ rotate: '90deg' } as CSSStyleDeclaration)
          : real(el),
      );
      boxes.set('t1', { x: 900, y: 500 });
      const { rerender } = render(<Piles view={{}} inDamage={false} />);
      boxes.set('t1', { x: 1700, y: 700 });
      moves = new Map([['t1', { from: '0-trigger', to: '0-damage' }]]);
      rerender(<Piles view={{}} inDamage />);
      const ghost = animate.mock.contexts.find((e) =>
        (e as Element).classList.contains('motion-ghost'),
      ) as HTMLElement;
      expect(rot(framesOf(ghost)[1])).toContain('translate(-800px, -216px)'); // 16px lift
      const face = ghost.querySelector('.card') as HTMLElement;
      expect(face.style.rotate).toBe('none');
      const turn = framesOf(face);
      expect(rot(turn[0])).toBe('rotate(0deg)');
      expect(rot(turn.at(-1))).toBe('rotate(90deg)');
    });
  });
});
