/**
 * Controller support (docs/CONTROLLER.md): the buttons a pad has, the actions the game knows, and
 * which button does what. Pure data: no DOM, no Gamepad API (that is gamepad.ts).
 *
 * Buttons are named after the browser's "standard" gamepad layout (W3C Gamepad API), which is what
 * Xbox, PlayStation and most generic pads report in Chromium. The names are Xbox-style; the glyphs
 * shown on screen follow the detected pad (PlayStation shows ✕ ○ □ △).
 */

export type PadButton =
  | 'a'
  | 'b'
  | 'x'
  | 'y'
  | 'lb'
  | 'rb'
  | 'lt'
  | 'rt'
  | 'back'
  | 'start'
  | 'ls'
  | 'rs'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'guide';

/** Button index in the standard layout → name (the order the W3C mapping defines). */
export const STANDARD_BUTTONS: readonly PadButton[] = [
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

export type PadAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'cancel'
  | 'inspect'
  | 'skills'
  | 'prevGroup'
  | 'nextGroup'
  | 'pageUp'
  | 'pageDown'
  | 'menu'
  | 'log';

export const DIRECTIONS: readonly PadAction[] = ['up', 'down', 'left', 'right'];
export const isDirection = (a: PadAction): a is 'up' | 'down' | 'left' | 'right' =>
  DIRECTIONS.includes(a);

/** The actions a player can rebind, with the words the Settings screen uses. */
export const ACTIONS: readonly { readonly id: PadAction; readonly label: string }[] = [
  { id: 'confirm', label: 'Select / confirm' },
  { id: 'cancel', label: 'Cancel / back' },
  { id: 'inspect', label: 'Card details' },
  { id: 'skills', label: 'Skills menu (battle)' },
  { id: 'prevGroup', label: 'Previous area (hand, field, piles…)' },
  { id: 'nextGroup', label: 'Next area' },
  { id: 'pageUp', label: 'Scroll up' },
  { id: 'pageDown', label: 'Scroll down' },
  { id: 'menu', label: 'Game menu / Settings' },
  { id: 'log', label: 'Battle history' },
];

/** The default map (approved 2026-11-12). The D-pad and the left stick always move. */
export const DEFAULT_BINDINGS: Readonly<Record<PadAction, PadButton | null>> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  confirm: 'a',
  cancel: 'b',
  inspect: 'x',
  skills: 'y',
  prevGroup: 'lb',
  nextGroup: 'rb',
  pageUp: 'lt',
  pageDown: 'rt',
  menu: 'start',
  log: 'back',
};

/** Saved bindings: only the actions the player changed (null = unbound). */
export type Bindings = Partial<Record<PadAction, PadButton | null>>;

export const resolveBindings = (
  saved: Bindings | undefined,
): Record<PadAction, PadButton | null> => ({
  ...DEFAULT_BINDINGS,
  ...(saved ?? {}),
});

/** The action a button does, or null. Directions are never rebound away from the D-pad. */
export function actionFor(button: PadButton, bindings: Bindings | undefined): PadAction | null {
  const b = resolveBindings(bindings);
  for (const action of Object.keys(b) as PadAction[]) {
    if (!isDirection(action) && b[action] === button) return action;
  }
  if (DIRECTIONS.includes(button as PadAction)) return button as PadAction;
  return null;
}

/**
 * Binds `button` to `action`. A button does one thing: another action that had it loses it. The
 * D-pad cannot be taken (moving must always work), so such a press changes nothing.
 */
export function rebind(
  saved: Bindings | undefined,
  action: PadAction,
  button: PadButton,
): Bindings {
  if (DIRECTIONS.includes(button as PadAction) || isDirection(action)) return saved ?? {};
  const next: Bindings = { ...(saved ?? {}) };
  const current = resolveBindings(saved);
  for (const other of Object.keys(current) as PadAction[]) {
    if (other !== action && current[other] === button) next[other] = null;
  }
  next[action] = button;
  // entries equal to the default are not worth saving
  for (const key of Object.keys(next) as PadAction[]) {
    if (next[key] === DEFAULT_BINDINGS[key]) delete next[key];
  }
  return next;
}

export type PadKind = 'xbox' | 'playstation' | 'generic';

/** What family a pad belongs to, from the id string the browser gives ("Xbox 360 Controller (XInput…)"). */
export function padKind(id: string): PadKind {
  const s = id.toLowerCase();
  if (/playstation|dualshock|dualsense|sony|054c|wireless controller/.test(s)) return 'playstation';
  if (/xbox|xinput|045e|microsoft/.test(s)) return 'xbox';
  return 'generic';
}

const GLYPHS: Record<PadKind, Record<PadButton, string>> = {
  xbox: {
    a: 'A',
    b: 'B',
    x: 'X',
    y: 'Y',
    lb: 'LB',
    rb: 'RB',
    lt: 'LT',
    rt: 'RT',
    back: 'View',
    start: 'Menu',
    ls: 'LS',
    rs: 'RS',
    up: '▲',
    down: '▼',
    left: '◀',
    right: '▶',
    guide: 'Xbox',
  },
  playstation: {
    a: '✕',
    b: '○',
    x: '□',
    y: '△',
    lb: 'L1',
    rb: 'R1',
    lt: 'L2',
    rt: 'R2',
    back: 'Share',
    start: 'Options',
    ls: 'L3',
    rs: 'R3',
    up: '▲',
    down: '▼',
    left: '◀',
    right: '▶',
    guide: 'PS',
  },
  generic: {
    a: '1',
    b: '2',
    x: '3',
    y: '4',
    lb: 'L1',
    rb: 'R1',
    lt: 'L2',
    rt: 'R2',
    back: 'Select',
    start: 'Start',
    ls: 'L3',
    rs: 'R3',
    up: '▲',
    down: '▼',
    left: '◀',
    right: '▶',
    guide: 'Home',
  },
};

/** The glyph for a button on this kind of pad (face buttons are letters, shapes or numbers). */
export const glyph = (button: PadButton, kind: PadKind): string => GLYPHS[kind][button];

/** The short name of a pad for the screen: its id without the vendor/product noise. */
export function padName(id: string): string {
  const cleaned = id
    .replace(/\(.*?\)/g, '')
    .replace(/vendor:.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Controller';
}
