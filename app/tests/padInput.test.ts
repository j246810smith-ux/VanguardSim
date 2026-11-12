// Controller support (docs/CONTROLLER.md): the pure parts. Bindings, the focus geometry and the
// pad polling that turns Gamepad API state into presses.
import { describe, expect, it, vi } from 'vitest';
import {
  actionFor,
  DEFAULT_BINDINGS,
  glyph,
  padKind,
  padName,
  rebind,
  resolveBindings,
} from '../renderer/input/bindings';
import { firstOf, nearestTo, nextInDirection, type Box } from '../renderer/input/focus';
import {
  readPad,
  REPEAT_DELAY,
  REPEAT_RATE,
  startPolling,
  type PadEvent,
  type PadLike,
} from '../renderer/input/gamepad';

const box = (left: number, top: number, w = 100, h = 40): Box => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
});

describe('bindings', () => {
  it('the default map: A selects, B backs, X inspects, Y skills, bumpers switch areas', () => {
    expect(actionFor('a', undefined)).toBe('confirm');
    expect(actionFor('b', {})).toBe('cancel');
    expect(actionFor('x', {})).toBe('inspect');
    expect(actionFor('y', {})).toBe('skills');
    expect(actionFor('lb', {})).toBe('prevGroup');
    expect(actionFor('rb', {})).toBe('nextGroup');
    expect(actionFor('start', {})).toBe('menu');
    expect(actionFor('up', {})).toBe('up');
    expect(actionFor('guide', {})).toBeNull();
  });

  it('rebinding gives a button to one action only; the D-pad cannot be taken', () => {
    const b = rebind({}, 'inspect', 'y');
    expect(actionFor('y', b)).toBe('inspect');
    expect(actionFor('x', b)).toBeNull();
    expect(resolveBindings(b).skills).toBeNull();
    // back to the default: nothing left to save
    const back = rebind(rebind(b, 'inspect', 'x'), 'skills', 'y');
    expect(back).toEqual({});
    expect(rebind({}, 'confirm', 'up')).toEqual({});
    expect(rebind({}, 'up', 'a')).toEqual({});
    expect(DEFAULT_BINDINGS.confirm).toBe('a');
  });

  it('shows the glyphs of the pad in hand', () => {
    expect(
      padKind('Xbox 360 Controller (XInput STANDARD GAMEPAD Vendor: 045e Product: 028e)'),
    ).toBe('xbox');
    expect(padKind('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)')).toBe(
      'playstation',
    );
    expect(padKind('USB Gamepad (Vendor: 0079 Product: 0011)')).toBe('generic');
    expect(glyph('a', 'xbox')).toBe('A');
    expect(glyph('a', 'playstation')).toBe('✕');
    expect(glyph('b', 'playstation')).toBe('○');
    expect(glyph('lb', 'generic')).toBe('L1');
    expect(
      padName('Xbox 360 Controller (XInput STANDARD GAMEPAD Vendor: 045e Product: 028e)'),
    ).toBe('Xbox 360 Controller');
  });
});

describe('focus geometry', () => {
  // a 2x2 grid plus a far button
  const grid = [
    { box: box(0, 0), item: 'tl' },
    { box: box(200, 0), item: 'tr' },
    { box: box(0, 100), item: 'bl' },
    { box: box(200, 100), item: 'br' },
    { box: box(600, 50), item: 'far' },
  ];
  it('moves to the neighbour in the pressed direction, same row or column first', () => {
    expect(nextInDirection(box(0, 0), grid, 'right')).toBe('tr');
    expect(nextInDirection(box(0, 0), grid, 'down')).toBe('bl');
    expect(nextInDirection(box(200, 100), grid, 'left')).toBe('bl');
    expect(nextInDirection(box(200, 100), grid, 'up')).toBe('tr');
    expect(nextInDirection(box(200, 0), grid, 'right')).toBe('far');
    expect(nextInDirection(box(0, 0), grid, 'up')).toBeNull();
    expect(nextInDirection(box(0, 0), grid, 'left')).toBeNull();
  });

  it('a diagonal neighbour is taken only when nothing lies straight that way', () => {
    const only = [
      { box: box(0, 0), item: 'a' },
      { box: box(300, 150), item: 'diag' },
    ];
    expect(nextInDirection(box(0, 0), only, 'right')).toBe('diag');
    expect(nextInDirection(box(0, 0), only, 'down')).toBe('diag');
  });

  it('first in reading order, and nearest to a point', () => {
    expect(firstOf(grid)).toBe('tl');
    expect(firstOf([...grid].reverse())).toBe('tl');
    expect(nearestTo({ x: 650, y: 70 }, grid)).toBe('far');
    expect(nearestTo({ x: 10, y: 110 }, grid)).toBe('bl');
    expect(firstOf([])).toBeNull();
  });
});

function pad(
  index = 0,
  id = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)',
): PadLike & {
  press(...names: string[]): void;
  stick(x: number, y: number): void;
} {
  const names = [
    'a',
    'b',
    'x',
    'y',
    'lb',
    'rb',
    'lt',
    'rt',
    'back',
    'start',
    'ls',
    'rs',
    'up',
    'down',
    'left',
    'right',
    'guide',
  ];
  const buttons = names.map(() => ({ pressed: false, value: 0 }));
  const axes = [0, 0];
  return {
    index,
    id,
    mapping: 'standard',
    buttons,
    axes,
    press(...held) {
      buttons.forEach((b, i) => {
        b.pressed = held.includes(names[i]!);
        b.value = b.pressed ? 1 : 0;
      });
    },
    stick(x, y) {
      axes[0] = x;
      axes[1] = y;
    },
  };
}

describe('pad polling', () => {
  const setup = () => {
    const pads: (PadLike | null)[] = [];
    let t = 0;
    let tick: () => void = () => {};
    const events: PadEvent[] = [];
    const poller = startPolling((e) => events.push(e), {
      getPads: () => pads,
      now: () => t,
      schedule: (fn) => {
        tick = fn;
        return () => {};
      },
    });
    return { pads, events, poller, tick: () => tick(), advance: (ms: number) => (t += ms) };
  };

  it('reads the standard layout, the left stick as the D-pad past the dead zone', () => {
    const p = pad();
    p.press('a', 'rb');
    p.stick(-0.9, 0.2);
    expect([...readPad(p).pressed].sort()).toEqual(['a', 'left', 'rb']);
    p.press();
    p.stick(0, 0.8);
    expect([...readPad(p).pressed]).toEqual(['down']);
  });

  it('one press per button press: holding A never confirms twice; the wake-up press is swallowed', () => {
    const { pads, events, tick } = setup();
    const p = pad();
    p.press('a'); // Chromium shows a pad only after a press: that press must not act
    pads.push(p);
    tick();
    expect(events).toEqual([{ type: 'connected', id: p.id }]);
    tick();
    tick();
    expect(events.filter((e) => e.type === 'press')).toEqual([]);
    p.press();
    tick();
    p.press('a');
    tick();
    tick();
    tick();
    const presses = events.filter((e) => e.type === 'press');
    expect(presses).toEqual([{ type: 'press', button: 'a', repeat: false, id: p.id }]);
  });

  it('a held direction repeats after the delay, then at the rate; release stops it', () => {
    const { pads, events, tick, advance } = setup();
    const p = pad();
    pads.push(p);
    tick();
    p.press('down');
    tick();
    advance(REPEAT_DELAY - 10);
    tick();
    expect(events.filter((e) => e.type === 'press')).toHaveLength(1);
    advance(10);
    tick();
    expect(events.filter((e) => e.type === 'press')).toHaveLength(2);
    expect(events.at(-1)).toEqual({ type: 'press', button: 'down', repeat: true, id: p.id });
    advance(REPEAT_RATE);
    tick();
    expect(events.filter((e) => e.type === 'press')).toHaveLength(3);
    p.press();
    tick();
    advance(1000);
    tick();
    expect(events.filter((e) => e.type === 'press')).toHaveLength(3);
  });

  it('reports pads coming and going', () => {
    const { pads, events, tick, poller } = setup();
    const p = pad(0, 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c)');
    pads.push(p);
    tick();
    expect(poller.connected()).toEqual([{ index: 0, id: p.id }]);
    pads[0] = null;
    tick();
    expect(events).toEqual([
      { type: 'connected', id: p.id },
      { type: 'disconnected', id: p.id },
    ]);
    expect(poller.connected()).toEqual([]);
    const stop = vi.fn();
    poller.stop();
    expect(stop).not.toHaveBeenCalled(); // stop of the injected schedule is a no-op here
  });
});
