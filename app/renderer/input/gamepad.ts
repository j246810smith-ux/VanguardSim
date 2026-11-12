/**
 * Controller support (docs/CONTROLLER.md): reading pads through the browser Gamepad API. The API
 * has no button events, only a state to poll, so this module polls and turns the state into
 * events: one `press` per button press (a held button never fires twice, so an action cannot run
 * by accident), with a key-repeat for the directions so a held D-pad or stick keeps moving.
 *
 * Pure except for the timer and the `getGamepads` it is given: the tests feed it fake pads.
 */
import { STANDARD_BUTTONS, type PadButton } from './bindings';

export interface PadSnapshot {
  /** The pad's index in navigator.getGamepads(), its identity while connected. */
  readonly index: number;
  readonly id: string;
  /** Buttons held now; the left stick counts as the D-pad past the dead zone. */
  readonly pressed: ReadonlySet<PadButton>;
}

export type PadEvent =
  | {
      readonly type: 'press';
      readonly button: PadButton;
      readonly repeat: boolean;
      readonly id: string;
    }
  | { readonly type: 'connected'; readonly id: string }
  | { readonly type: 'disconnected'; readonly id: string };

/** The shape of navigator.getGamepads() this module reads (a subset of the DOM type). */
export interface PadLike {
  readonly index: number;
  readonly id: string;
  readonly mapping?: string;
  readonly buttons: readonly { readonly pressed: boolean; readonly value?: number }[];
  readonly axes: readonly number[];
}
export type GetPads = () => readonly (PadLike | null)[];

/** Stick deflection that counts as a direction. */
export const DEAD_ZONE = 0.5;
/** Repeat for held directions: first after REPEAT_DELAY ms, then every REPEAT_RATE ms. */
export const REPEAT_DELAY = 350;
export const REPEAT_RATE = 110;
/** How often the pads are read. */
export const POLL_MS = 16;

const REPEATING: ReadonlySet<PadButton> = new Set(['up', 'down', 'left', 'right']);

export const defaultGetPads: GetPads = () => {
  try {
    return (globalThis.navigator?.getGamepads?.() ?? []) as readonly (PadLike | null)[];
  } catch {
    return [];
  }
};

/** What is held on one pad. Triggers count as pressed past half travel. */
export function readPad(pad: PadLike): PadSnapshot {
  const pressed = new Set<PadButton>();
  pad.buttons.forEach((b, i) => {
    const name = STANDARD_BUTTONS[i];
    if (!name) return;
    if (b.pressed || (b.value ?? 0) > 0.5) pressed.add(name);
  });
  const [x = 0, y = 0] = pad.axes;
  if (x <= -DEAD_ZONE) pressed.add('left');
  if (x >= DEAD_ZONE) pressed.add('right');
  if (y <= -DEAD_ZONE) pressed.add('up');
  if (y >= DEAD_ZONE) pressed.add('down');
  return { index: pad.index, id: pad.id, pressed };
}

export const readPads = (get: GetPads = defaultGetPads): PadSnapshot[] =>
  get()
    .filter((p): p is PadLike => !!p)
    .map(readPad);

interface Held {
  readonly id: string;
  pressed: Set<PadButton>;
  /** When each held button fires next (repeat), by name. */
  nextRepeat: Map<PadButton, number>;
}

export interface PollOptions {
  readonly getPads?: GetPads;
  readonly now?: () => number;
  /** Runs `fn` every POLL_MS; returns a function that stops it (injected by the tests). */
  readonly schedule?: (fn: () => void) => () => void;
}

export interface PadPoller {
  /** Reads the pads now (e.g. right after a gamepadconnected event). */
  poll(): void;
  stop(): void;
  /** The pads seen at the last poll. */
  connected(): readonly { index: number; id: string }[];
}

/**
 * Polls the pads and reports presses and (dis)connections. A pad that appears already holding a
 * button (Chromium only shows a pad after its first press) does not fire that press: the
 * "wake-up" press is swallowed, so connecting never confirms something by accident.
 */
export function startPolling(onEvent: (e: PadEvent) => void, opts: PollOptions = {}): PadPoller {
  const getPads = opts.getPads ?? defaultGetPads;
  const now = opts.now ?? (() => performance.now());
  const held = new Map<number, Held>();
  const poll = () => {
    const t = now();
    const seen = new Set<number>();
    for (const snap of readPads(getPads)) {
      seen.add(snap.index);
      let h = held.get(snap.index);
      if (!h) {
        h = { id: snap.id, pressed: new Set(snap.pressed), nextRepeat: new Map() };
        held.set(snap.index, h);
        onEvent({ type: 'connected', id: snap.id });
        continue; // the wake-up press is not an action
      }
      for (const b of snap.pressed) {
        if (!h.pressed.has(b)) {
          onEvent({ type: 'press', button: b, repeat: false, id: snap.id });
          if (REPEATING.has(b)) h.nextRepeat.set(b, t + REPEAT_DELAY);
        } else if (REPEATING.has(b)) {
          const due = h.nextRepeat.get(b);
          if (due !== undefined && t >= due) {
            onEvent({ type: 'press', button: b, repeat: true, id: snap.id });
            h.nextRepeat.set(b, t + REPEAT_RATE);
          }
        }
      }
      for (const b of h.pressed) if (!snap.pressed.has(b)) h.nextRepeat.delete(b);
      h.pressed = new Set(snap.pressed);
    }
    for (const [index, h] of [...held]) {
      if (!seen.has(index)) {
        held.delete(index);
        onEvent({ type: 'disconnected', id: h.id });
      }
    }
  };
  const schedule =
    opts.schedule ??
    ((fn: () => void) => {
      const timer = setInterval(fn, POLL_MS);
      return () => clearInterval(timer);
    });
  const stopTimer = schedule(poll);
  // a connection event means new state is worth reading at once
  const onConnect = () => poll();
  globalThis.addEventListener?.('gamepadconnected', onConnect);
  globalThis.addEventListener?.('gamepaddisconnected', onConnect);
  return {
    poll,
    stop: () => {
      stopTimer();
      globalThis.removeEventListener?.('gamepadconnected', onConnect);
      globalThis.removeEventListener?.('gamepaddisconnected', onConnect);
    },
    connected: () => [...held].map(([index, h]) => ({ index, id: h.id })),
  };
}
