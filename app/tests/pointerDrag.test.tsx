// @vitest-environment jsdom
// Dragging a hand card onto a circle with a mouse or a finger (Battlefield 2.0 phase 4,
// ui/usePointerDrag.ts): picked up after a short move, dropped on the circle under the pointer.
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { Hand } from '../renderer/board/Hand';
import { ME } from '../renderer/engine';
import { legalOf, type Legal } from '../renderer/game/interaction';
import { GameSession } from '../renderer/game/session';
import { circleAt, DRAG_SLOP, goodTarget } from '../renderer/ui/usePointerDrag';

afterEach(cleanup);

const session = () =>
  new GameSession({
    seed: 3,
    myDeck: STARTER_DECKS[0]!.deck,
    myDeckName: 'A',
    aiDeck: STARTER_DECKS[1]!.deck,
    aiDeckName: 'B',
    aiLevel: 'basic',
  });

/** A circle element on the page, glowing (good) or not, that elementsFromPoint reports. */
function circle(good: boolean) {
  const el = document.createElement('div');
  el.dataset.testid = `circle-${ME}-front_left`;
  if (good) el.classList.add('hl-call');
  document.body.appendChild(el);
  return el;
}

let under: Element[] = [];
beforeEach(() => {
  under = [];
  document.body.innerHTML = '<div class="stage"></div>';
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: () => under,
  });
});

function setup() {
  const s = session();
  const id = s.view.players[ME].hand[0]!;
  // pretend that card can be called, so it may be dragged
  const legal: Legal = { ...legalOf([]), call: new Set([id]), callCircles: ['front_left'] };
  const onDragStart = vi.fn();
  const onDrop = vi.fn();
  const onClick = vi.fn();
  const r = render(
    <Hand
      view={s.view}
      legal={legal}
      selection={null}
      marked={[]}
      onClick={onClick}
      onDetails={() => {}}
      onDragStart={onDragStart}
      onDrop={onDrop}
    />,
    { container: document.querySelector('.stage') as HTMLElement },
  );
  const card = r.getByTestId('hand-0');
  return { id, card, onDragStart, onDrop, onClick };
}

const pointer = { pointerId: 1, pointerType: 'touch', button: 0 };

describe('dragging a hand card', () => {
  it('finds the circle under the pointer and whether the card may go there', () => {
    const good = circle(true);
    under = [good];
    const t = circleAt(10, 10)!;
    expect(t).toMatchObject({ player: ME, circle: 'front_left' });
    expect(goodTarget(t)).toBe(true);
    under = [circle(false)];
    expect(goodTarget(circleAt(10, 10))).toBe(false);
    under = [];
    expect(circleAt(10, 10)).toBeNull();
  });

  it('a finger picks the card up after a short move and drops it on a glowing circle', () => {
    const { id, card, onDragStart, onDrop, onClick } = setup();
    expect(card.className).toContain('can-drag');
    fireEvent.pointerDown(card, { ...pointer, clientX: 100, clientY: 500 });
    // a small wobble is still a tap
    fireEvent.pointerMove(card, { ...pointer, clientX: 104, clientY: 497 });
    expect(onDragStart).not.toHaveBeenCalled();
    under = [circle(true)];
    fireEvent.pointerMove(card, { ...pointer, clientX: 100, clientY: 500 - DRAG_SLOP - 30 });
    expect(onDragStart).toHaveBeenCalledWith(id);
    expect(card.className).toContain('dragging');
    expect(document.querySelector('.drag-ghost')).toBeTruthy();
    fireEvent.pointerUp(card, { ...pointer, clientX: 100, clientY: 300 });
    expect(onDrop).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ circle: 'front_left' }),
      true,
    );
    // the click a lifted finger makes is not also a tap on the card
    fireEvent.click(card);
    expect(onClick).not.toHaveBeenCalled();
    expect(document.querySelector('.drag-ghost')).toBeNull();
    expect(card.className).not.toContain('dragging');
  });

  it('reports a drop on a circle the card cannot go to as a bad one', () => {
    const { card, onDrop } = setup();
    fireEvent.pointerDown(card, { ...pointer, clientX: 100, clientY: 500 });
    const bad = circle(false);
    under = [bad];
    fireEvent.pointerMove(card, { ...pointer, clientX: 100, clientY: 400 });
    expect(bad.className).toContain('drop-bad');
    fireEvent.pointerUp(card, { ...pointer, clientX: 100, clientY: 400 });
    expect(onDrop).toHaveBeenCalledWith(expect.anything(), expect.anything(), false);
    expect(bad.className).not.toContain('drop-bad');
  });

  it('a tap without moving is an ordinary tap', () => {
    const { card, onDragStart, onDrop, onClick } = setup();
    fireEvent.pointerDown(card, { ...pointer, clientX: 100, clientY: 500 });
    fireEvent.pointerUp(card, { ...pointer, clientX: 100, clientY: 500 });
    fireEvent.click(card);
    expect(onDragStart).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalled();
  });

  it('works the same with a mouse (left button only)', () => {
    const { card, onDragStart } = setup();
    const mouse = { pointerId: 2, pointerType: 'mouse' };
    fireEvent.pointerDown(card, { ...mouse, button: 2, clientX: 100, clientY: 500 });
    fireEvent.pointerMove(card, { ...mouse, clientX: 100, clientY: 400 });
    expect(onDragStart).not.toHaveBeenCalled();
    fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: 100, clientY: 500 });
    fireEvent.pointerMove(card, { ...mouse, clientX: 100, clientY: 400 });
    expect(onDragStart).toHaveBeenCalled();
  });
});
