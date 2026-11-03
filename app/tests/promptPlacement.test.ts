import { describe, expect, it } from 'vitest';
import { placePanel, type Rect } from '../renderer/prompts/placement';

const box = (left: number, top: number, w: number, h: number): Rect => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
});
const size = { w: 300, h: 110 };
// centre line, opponent's back row, your back row (stage px, overhead view)
const rows = [494, 168, 818];

describe('decision panel placement (v0.28)', () => {
  it('goes to the centre line when nothing is there', () => {
    expect(placePanel(size, [], rows)?.top).toBe(494 - 55);
  });

  it('skips a row with a card or the ability callout, and takes the next free one', () => {
    const yourVanguard = box(848, 534, 224, 224); // reaches up into the centre band
    const r = placePanel(size, [yourVanguard], rows);
    expect(r?.top).toBe(168 - 55);
    const oppBackCentre = box(872, 80, 176, 176);
    const callout = box(560, 760, 320, 140); // e.g. a Forerunner beside the guardian circle
    const backCentre = box(872, 730, 176, 176);
    expect(placePanel(size, [yourVanguard, oppBackCentre, callout, backCentre], rows)).toBeNull();
  });

  it('never covers the top bar or the hand', () => {
    expect(placePanel({ w: 300, h: 200 }, [], [60, 990])).toBeNull();
  });
});
