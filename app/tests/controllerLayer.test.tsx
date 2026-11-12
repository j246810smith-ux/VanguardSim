// @vitest-environment jsdom
// Controller support (docs/CONTROLLER.md): the layer in the app. A fake pad drives the home
// screen, the modes panel and the Settings → Controller section through the real components.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../renderer/App';
import { FOCUS_CLASS, pollOptions } from '../renderer/input/ControllerLayer';
import type { PadLike } from '../renderer/input/gamepad';

const NAMES = [
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

/** A fake pad plus the hooks the layer polls with (set before the App mounts). `tap` presses and releases a button. */
function fakePad(id = 'Xbox 360 Controller (XInput STANDARD GAMEPAD Vendor: 045e)') {
  const buttons = NAMES.map(() => ({ pressed: false, value: 0 }));
  const pad: PadLike = { index: 0, id, mapping: 'standard', buttons, axes: [0, 0] };
  const pads: (PadLike | null)[] = [];
  // every poller started with these options (the layer, Settings while it waits for a button)
  const polls = new Set<() => void>();
  let now = 0;
  pollOptions.current = {
    getPads: () => pads,
    now: () => now,
    schedule: (fn) => {
      polls.add(fn);
      return () => polls.delete(fn);
    },
  };
  const poll = () => act(() => [...polls].forEach((fn) => fn()));
  return {
    connect() {
      pads.push(pad);
      poll();
    },
    /** A poll with nothing pressed (a pad at rest between presses). */
    idle: poll,
    tap(name: string) {
      const i = NAMES.indexOf(name);
      buttons[i]!.pressed = true;
      poll();
      buttons[i]!.pressed = false;
      poll();
      now += 1;
    },
  };
}

/** jsdom has no layout: every element gets a row of its own, in the order it is first measured. */
function fakeLayout() {
  let n = 0;
  const rows = new WeakMap<Element, DOMRect>();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    let r = rows.get(this);
    if (!r) {
      const top = n++ * 40;
      r = {
        left: 0,
        top,
        right: 100,
        bottom: top + 30,
        width: 100,
        height: 30,
        x: 0,
        y: top,
        toJSON: () => ({}),
      };
      rows.set(this, r);
    }
    return r;
  });
}

const focusedId = () =>
  document.querySelector(`.${FOCUS_CLASS}`)?.getAttribute('data-testid') ?? null;

describe('controller layer', () => {
  beforeEach(() => {
    localStorage.clear();
    fakeLayout();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    pollOptions.current = {};
  });

  it('moves a focus ring over the home screen, Select opens the modes, Back closes them', () => {
    const pad = fakePad();
    render(<App />);
    expect(screen.queryByTestId('pad-hints')).toBeNull();
    pad.connect();
    expect(screen.getByTestId('pad-toast').textContent).toContain('Xbox 360 Controller');
    expect(screen.queryByTestId('pad-hints')).toBeNull(); // no press yet: nothing active
    pad.tap('down');
    expect(screen.getByTestId('pad-hints')).toBeTruthy();
    expect(screen.getByTestId('pad-hints').textContent).toContain('A');
    // the first press starts on the home screen's natural spot
    expect(focusedId()).toBe('start-battle');
    pad.tap('a');
    expect(screen.getByTestId('mode-select')).toBeTruthy();
    pad.tap('b');
    expect(screen.queryByTestId('mode-select')).toBeNull();
    // the mouse takes over: the ring and the hints go, the pad brings them back
    fireEvent.mouseMove(window);
    expect(focusedId()).toBeNull();
    expect(screen.queryByTestId('pad-hints')).toBeNull();
    pad.tap('down');
    expect(focusedId()).not.toBeNull();
    expect(screen.getByTestId('pad-hints')).toBeTruthy();
  });

  it('Menu opens Settings, Back leaves it; Settings → Controller rebinds a button by pressing it', () => {
    const pad = fakePad('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)');
    render(<App />);
    pad.connect();
    pad.tap('start');
    expect(screen.getByTestId('settings-scroll')).toBeTruthy();
    expect(screen.getByTestId('controller-on').className).toContain('on');
    expect(screen.getByTestId('glyph-inspect').textContent).toBe('□');
    // Change → press △ → Card details is on △ and the skills menu lost its button
    fireEvent.click(screen.getByTestId('bind-inspect'));
    expect(screen.getByTestId('bind-inspect').textContent).toContain('Press');
    pad.idle();
    pad.tap('y');
    expect(screen.getByTestId('glyph-inspect').textContent).toBe('△');
    expect(screen.getByTestId('glyph-skills').textContent).toBe('—');
    fireEvent.click(screen.getByTestId('reset-bindings'));
    expect(screen.getByTestId('glyph-inspect').textContent).toBe('□');
    expect(screen.getByTestId('glyph-skills').textContent).toBe('△');
    // Back (Escape, which Settings listens for) returns to the home screen
    pad.tap('b');
    expect(screen.queryByTestId('settings-scroll')).toBeNull();
    expect(screen.getByTestId('start-battle')).toBeTruthy();
  });

  it('in a battle: areas switch with the bumpers, X opens the focused card, B closes it', () => {
    const pad = fakePad();
    render(<App />);
    fireEvent.click(screen.getByTestId('start-battle'));
    fireEvent.click(screen.getByTestId('new-game'));
    fireEvent.click(screen.getByTestId('start'));
    expect(screen.queryByTestId('start-battle')).toBeNull();
    pad.connect();
    const inHand = () => !!document.querySelector(`.${FOCUS_CLASS}[data-nav-group="hand"]`);
    for (let i = 0; i < 8 && !inHand(); i++) pad.tap('rb');
    expect(inHand()).toBe(true);
    const iid = document.querySelector(`.${FOCUS_CLASS}`)!.getAttribute('data-iid');
    expect(iid).toBeTruthy();
    pad.tap('x');
    expect(screen.getByTestId('card-details')).toBeTruthy();
    // the dialog keeps the focus inside it: Down lands on its button, not on the board
    pad.tap('down');
    expect(screen.getByTestId('card-details').querySelector(`.${FOCUS_CLASS}`)).not.toBeNull();
    pad.tap('b');
    expect(screen.queryByTestId('card-details')).toBeNull();
    // the game's own rules decide what Select does: an illegal click is simply refused
    expect(screen.queryByTestId('start-battle')).toBeNull();
  });

  it('switched off in Settings, the pad does nothing', () => {
    const pad = fakePad();
    render(<App />);
    fireEvent.click(screen.getByTestId('settings'));
    fireEvent.click(screen.getByTestId('controller-off'));
    fireEvent.click(screen.getByTestId('settings-back'));
    pad.connect();
    pad.tap('down');
    pad.tap('a');
    expect(focusedId()).toBeNull();
    expect(screen.queryByTestId('pad-hints')).toBeNull();
    expect(screen.queryByTestId('mode-select')).toBeNull();
  });
});
