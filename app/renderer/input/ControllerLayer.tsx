/**
 * Controller support (docs/CONTROLLER.md): one layer for the whole app. It reads the pads
 * (gamepad.ts), keeps a focus cursor over what a mouse could click (focus.ts) and turns the
 * buttons into the clicks the screens already handle. Nothing is re-wired: mouse, keyboard and
 * touch work as before, and every game action still goes through the engine's validation
 * because the controller only ever clicks what the screen offers.
 *
 * Windows only for now (the user's decision, 2026-11-12): on Android the layer renders nothing.
 */
import { useEffect, useRef, useState } from 'react';
import { handleBack } from '../android/back';
import { IS_ANDROID } from '../platform';
import type { Settings } from '../settings';
import {
  actionFor,
  glyph,
  padKind,
  padName,
  resolveBindings,
  type PadAction,
  type PadButton,
} from './bindings';
import {
  collectCandidates,
  firstOf,
  groupOf,
  groupsOf,
  nearestTo,
  nextInDirection,
  type Candidate,
} from './focus';
import { startPolling, type PadEvent, type PollOptions } from './gamepad';

/** The class the focused element carries (styles.css draws the ring). */
export const FOCUS_CLASS = 'nav-focus';

/**
 * Sent on `window` when the player asks for the details of the focused card: `iid` for a card in
 * a game (the battle screen opens Card Details), `defId` for a card definition (the Deck Builder
 * and Card Database open theirs).
 */
export const PAD_INSPECT_EVENT = 'vanguard-pad-inspect';
export interface PadInspectDetail {
  readonly iid?: string;
  readonly defId?: string;
}

/** While the Settings screen waits for a button to bind, the layer leaves presses alone. */
export const padCapture = { active: false };

/** Test seam: how the layer reads pads and times repeats. */
export const pollOptions: { current: PollOptions } = { current: {} };

let synthesizing = false;
const CLOSERS = /^(back|close|cancel|✕|×|done|ok)$/i;

const box = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};
const isFormControl = (el: HTMLElement) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLSelectElement ||
  el instanceof HTMLTextAreaElement;

const hintsFor = (screen: string): readonly { action: PadAction; label: string }[] => {
  const base: { action: PadAction; label: string }[] = [
    { action: 'confirm', label: 'Select' },
    { action: 'cancel', label: 'Back' },
  ];
  if (screen === 'battle' || screen === 'online-battle')
    return [
      ...base,
      { action: 'inspect', label: 'Card details' },
      { action: 'skills', label: 'Skills' },
      { action: 'nextGroup', label: 'Next area' },
      { action: 'log', label: 'History' },
      { action: 'menu', label: 'Menu' },
    ];
  if (screen === 'decks' || screen === 'cards')
    return [
      ...base,
      { action: 'inspect', label: 'Card details' },
      { action: 'nextGroup', label: 'Next area' },
      { action: 'pageDown', label: 'Scroll' },
    ];
  if (screen === 'menu') return [...base, { action: 'menu', label: 'Settings' }];
  return [...base, { action: 'pageDown', label: 'Scroll' }];
};

export function ControllerLayer({ settings, screen }: { settings: Settings; screen: string }) {
  const enabled = !IS_ANDROID && settings.controller.enabled;
  const [pad, setPad] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const focused = useRef<HTMLElement | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const bindings = useRef(settings.controller.bindings);
  bindings.current = settings.controller.bindings;
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    if (!enabled) return;

    const setFocus = (el: HTMLElement | null) => {
      if (focused.current && focused.current !== el) focused.current.classList.remove(FOCUS_CLASS);
      focused.current = el;
      if (!el) return;
      el.classList.add(FOCUS_CLASS);
      const b = box(el);
      last.current = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
      el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    };
    const current = (cands: readonly Candidate[]): HTMLElement | null => {
      const el = focused.current;
      return el && document.contains(el) && cands.some((c) => c.el === el) ? el : null;
    };
    /** Something to start from when nothing is focused: where the focus was, else the first. */
    const acquire = (cands: readonly Candidate[]) => {
      const items = cands.map((c) => ({ box: c.box, item: c.el }));
      // a screen's natural starting point (START BATTLE, the hand) when there is no earlier spot
      const first = cands.find((c) => c.el.hasAttribute('data-nav-first'))?.el ?? null;
      return (last.current ? nearestTo(last.current, items) : first) ?? firstOf(items);
    };
    const move = (dir: 'up' | 'down' | 'left' | 'right') => {
      const cands = collectCandidates();
      if (cands.length === 0) return;
      const cur = current(cands);
      if (!cur) {
        setFocus(acquire(cands));
        return;
      }
      const others = cands.filter((c) => c.el !== cur).map((c) => ({ box: c.box, item: c.el }));
      setFocus(nextInDirection(box(cur), others, dir) ?? cur);
    };
    const confirm = () => {
      const cands = collectCandidates();
      const cur = current(cands);
      if (!cur) {
        setFocus(acquire(cands));
        return;
      }
      if (isFormControl(cur)) cur.focus();
      else cur.click();
    };
    const clickFirst = (selector: string): boolean => {
      const el = collectCandidates().find((c) => c.el.matches(selector))?.el;
      if (!el) return false;
      el.click();
      return true;
    };
    const cancel = () => {
      // 1. what the Android back button would do (overlays, confirmations, leaving a screen)
      if (handleBack()) return;
      // 2. Escape, which Settings, Updates and the battle screen already listen for
      const openBefore = document.querySelectorAll('.modal-backdrop, .popover').length;
      synthesizing = true;
      try {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      } finally {
        synthesizing = false;
      }
      if (document.querySelectorAll('.modal-backdrop, .popover').length !== openBefore) return;
      // 3. the screen's own Back / Close button
      if (clickFirst('[data-nav-back]')) return;
      const closer = collectCandidates().find(
        (c) => c.el.tagName === 'BUTTON' && CLOSERS.test((c.el.textContent ?? '').trim()),
      );
      closer?.el.click();
    };
    const inspect = () => {
      const cur = current(collectCandidates());
      if (!cur) return;
      const el = cur.closest<HTMLElement>('[data-iid], [data-nav-inspect]') ?? cur;
      const iid = el.dataset['iid'];
      const defId = el.dataset['navInspect'];
      if (!iid && !defId) return;
      const detail: PadInspectDetail = { ...(iid ? { iid } : {}), ...(defId ? { defId } : {}) };
      window.dispatchEvent(new CustomEvent(PAD_INSPECT_EVENT, { detail }));
    };
    const switchGroup = (by: 1 | -1) => {
      const cands = collectCandidates();
      const groups = groupsOf(cands);
      if (groups.length < 2) return;
      const cur = current(cands);
      const at = cur ? groups.indexOf(groupOf(cur)) : -1;
      const next = groups[(at + by + groups.length) % groups.length]!;
      const inGroup = cands.filter((c) => groupOf(c.el) === next);
      setFocus(firstOf(inGroup.map((c) => ({ box: c.box, item: c.el }))));
    };
    const page = (by: 1 | -1) => {
      const cur = focused.current;
      const scroller =
        cur?.closest<HTMLElement>('.settings-scroll, .builder-pool, .dd-main, .modal, .log-body') ??
        document.querySelector<HTMLElement>('.settings-scroll, .builder-pool, .modal');
      scroller?.scrollBy?.({ top: by * scroller.clientHeight * 0.6, behavior: 'smooth' });
    };
    const act = (action: PadAction) => {
      switch (action) {
        case 'up':
        case 'down':
        case 'left':
        case 'right':
          return move(action);
        case 'confirm':
          return confirm();
        case 'cancel':
          return cancel();
        case 'inspect':
          return inspect();
        case 'skills':
          return void clickFirst('[data-testid="action-skills"]');
        case 'prevGroup':
          return switchGroup(-1);
        case 'nextGroup':
          return switchGroup(1);
        case 'pageUp':
          return page(-1);
        case 'pageDown':
          return page(1);
        case 'menu':
          return void clickFirst('[data-nav-menu]');
        case 'log':
          return void clickFirst('[data-testid="action-log"]');
      }
    };

    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    const say = (text: string) => {
      setToast(text);
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setToast(null), 2600);
    };
    const onEvent = (e: PadEvent) => {
      if (e.type === 'connected') {
        setPad((p) => p ?? e.id);
        say(`Controller connected: ${padName(e.id)}`);
        return;
      }
      if (e.type === 'disconnected') {
        setPad((p) => (p === e.id ? (poller.connected()[0]?.id ?? null) : p));
        say('Controller disconnected');
        return;
      }
      if (padCapture.active) return;
      setActive(true);
      const action = actionFor(e.button as PadButton, bindings.current);
      if (action) act(action);
    };
    const poller = startPolling(onEvent, pollOptions.current);

    // the mouse, a touch or the keyboard takes over: the ring goes until the pad is used again
    const onOther = () => {
      if (synthesizing) return;
      setActive(false);
      focused.current?.classList.remove(FOCUS_CLASS);
    };
    window.addEventListener('mousemove', onOther, true);
    window.addEventListener('pointerdown', onOther, true);
    window.addEventListener('keydown', onOther, true);
    return () => {
      poller.stop();
      if (toastTimer) clearTimeout(toastTimer);
      window.removeEventListener('mousemove', onOther, true);
      window.removeEventListener('pointerdown', onOther, true);
      window.removeEventListener('keydown', onOther, true);
      focused.current?.classList.remove(FOCUS_CLASS);
      focused.current = null;
    };
  }, [enabled]);

  // a new screen: the old focus is gone with it; the next press starts at its natural spot
  useEffect(() => {
    focused.current?.classList.remove(FOCUS_CLASS);
    focused.current = null;
    last.current = null;
  }, [screen]);

  if (!enabled) return null;
  const kind = pad ? padKind(pad) : 'xbox';
  const b = resolveBindings(settings.controller.bindings);
  return (
    <>
      {pad && active && (
        <div className="pad-hints" data-testid="pad-hints" aria-hidden>
          {hintsFor(screen)
            .filter((h) => b[h.action])
            .map((h) => (
              <span key={h.action} className="pad-hint">
                <kbd className={`pad-glyph ${kind}`}>{glyph(b[h.action]!, kind)}</kbd>
                {h.label}
              </span>
            ))}
        </div>
      )}
      {toast && (
        <div className="pad-toast" data-testid="pad-toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
