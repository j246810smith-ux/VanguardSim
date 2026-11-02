/**
 * Card movement animation (roadmap phase 2). Presentation only: it runs after React has drawn the
 * new state and animates the cards from where they were, so the rules never wait for it and an
 * interrupted or skipped animation changes nothing. Off at "Instant" speed and with reduced motion.
 *
 * Cards on screen carry `data-iid` (their instance), zone tiles `data-zone` ("<player>-<zone>").
 *   - A card still on screen but elsewhere flies from its old place (hand → circle, circle swaps).
 *   - A card that appears flies in from the tile of the zone it came from (deck → hand, drop → RC).
 *   - A card that leaves the screen flies into the tile of its new zone (RC → drop, VC → soul).
 *
 * Since the tilted table (D-035) a moving card is drawn by a flat copy (a "ghost") in a layer over
 * the stage, flying between the on-screen boxes of its old and new places, while the real card is
 * hidden until it lands. Translating the real card cannot work on the table: its own coordinates
 * are those of the tilted plane, not of the screen.
 */
import { useLayoutEffect, useRef } from 'react';
import type { GameEvent } from '../../../src/engine';

/** Where a card moved in the latest events: zone keys like "0-drop", or null for a circle. */
export interface Move {
  readonly from: string | null;
  readonly to: string | null;
}

const zoneKey = (ref: { player: number; zone: string }): string | null =>
  ref.zone === 'circle' || ref.zone === 'guardian' ? null : `${ref.player}-${ref.zone}`;

/** The moves of a batch of events (the last move of each card wins). */
export function movesOf(events: readonly GameEvent[], into: Map<string, Move> = new Map()) {
  for (const e of events) {
    if (e.type !== 'CARD_MOVED') continue;
    const before = into.get(e.instanceId);
    into.set(e.instanceId, { from: before ? before.from : zoneKey(e.from), to: zoneKey(e.to) });
  }
  return into;
}

/** A card's place on screen: centre and drawn scale (stage px). */
interface Spot {
  readonly cx: number;
  readonly cy: number;
  readonly s: number;
}
interface Placed extends Spot {
  readonly el: HTMLElement;
  /** its own (layout) size */
  readonly lw: number;
  readonly lh: number;
  /** whose sleeve its back shows */
  readonly side: 'me' | 'opp' | null;
}
interface Flight {
  readonly ghost: HTMLElement;
  readonly runs: Animation[];
}

const SLEEVE_VARS = ['--sl-bg', '--sl-border', '--sl-emblem', '--sl-radius', '--sl-rotate'];
const MINE = '.side-me, .panel.me, .hand';
const THEIRS = '.side-opp, .panel.opp, .opp-hand';

/**
 * Animates card movement inside the `.stage` after a render that shows a new game view (`view`
 * changed). `takeMoves` returns (and clears) the moves since then; `ms` is the base duration
 * (0 = no animation).
 *
 * Positions are always the cards' resting places: renders for other reasons (hover, menus, the
 * log) are not measured, and a flight still running is ended before measuring and continued from
 * where it was drawn. Measuring cards mid-flight or mid-hover made the next render start a new
 * slide, which moved cards under the mouse, which re-rendered … (v0.19 hand jitter).
 */
export function useCardMotion(takeMoves: () => Map<string, Move>, ms: number, view: unknown): void {
  const prev = useRef<Map<string, Placed>>(new Map());
  const flying = useRef<Map<string, Flight>>(new Map());
  useLayoutEffect(() => {
    const stage = document.querySelector<HTMLElement>('.stage');
    const moves = takeMoves();
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    const scale = stage.offsetWidth ? box.width / stage.offsetWidth : 1;
    const spot = (el: HTMLElement): Spot => {
      const r = el.getBoundingClientRect();
      return {
        cx: (r.left + r.width / 2 - box.left) / scale,
        cy: (r.top + r.height / 2 - box.top) / scale,
        s: r.width / scale / (el.offsetWidth || 1),
      };
    };
    // where running flights draw their cards: they continue from there
    const drawn = new Map<string, Spot>();
    for (const [iid, f] of flying.current) {
      if (f.ghost.isConnected) drawn.set(iid, spot(f.ghost));
      for (const run of f.runs) run.cancel();
      f.ghost.remove();
    }
    flying.current.clear();

    const now = new Map<string, Placed>();
    for (const el of stage.querySelectorAll<HTMLElement>('[data-iid]')) {
      const iid = el.dataset.iid!;
      if (now.has(iid) || el.closest('.motion-layer')) continue;
      const side = el.closest(MINE) ? 'me' : el.closest(THEIRS) ? 'opp' : null;
      now.set(iid, { el, lw: el.offsetWidth, lh: el.offsetHeight, side, ...spot(el) });
    }

    if (ms > 0 && typeof Element.prototype.animate === 'function') {
      // a card shrinks into (or grows out of) a pile: drawn at about half the tile's width
      const tile = (key: string | null, card: Placed): Spot | null => {
        const el = key ? stage.querySelector<HTMLElement>(`[data-zone="${key}"]`) : null;
        if (!el) return null;
        const t = spot(el);
        return { ...t, s: (0.6 * t.s * el.offsetWidth) / (card.lw || 1) };
      };
      let layer = stage.querySelector<HTMLElement>('.motion-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'motion-layer';
        stage.appendChild(layer);
      }
      const sleeveSource = {
        me: stage.querySelector<HTMLElement>('.hand'),
        opp: stage.querySelector<HTMLElement>('.opp-hand'),
      };
      const fly = (
        iid: string,
        card: Placed,
        from: Spot,
        to: Spot,
        opts: { real?: HTMLElement; fadeIn?: boolean; duration: number },
      ) => {
        const ghost = card.el.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('data-iid');
        ghost.removeAttribute('data-testid');
        ghost.dataset.ghostOf = iid;
        ghost.classList.add('motion-ghost');
        const src = card.side ? sleeveSource[card.side] : null;
        if (src) {
          const cs = getComputedStyle(src);
          for (const v of SLEEVE_VARS) ghost.style.setProperty(v, cs.getPropertyValue(v));
        }
        Object.assign(ghost.style, {
          position: 'absolute',
          left: `${to.cx - card.lw / 2}px`,
          top: `${to.cy - card.lh / 2}px`,
          bottom: 'auto',
          width: `${card.lw}px`,
          height: `${card.lh}px`,
          margin: '0',
          transform: 'none',
          translate: 'none',
          rotate: 'none',
          scale: 'none',
        });
        layer!.appendChild(ghost);
        const runs: Animation[] = [
          ghost.animate(
            [
              {
                transform: `translate(${from.cx - to.cx}px, ${from.cy - to.cy}px) scale(${from.s})`,
                opacity: opts.fadeIn ? 0.4 : 1,
              },
              { transform: `scale(${to.s})`, opacity: 1, offset: 0.85 },
              { transform: `scale(${to.s})`, opacity: 0 },
            ],
            { duration: opts.duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
          ),
        ];
        // the real card waits under the ghost and fades in as it lands
        if (opts.real)
          runs.push(
            opts.real.animate(
              [{ opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }],
              opts.duration,
            ),
          );
        const flight = { ghost, runs };
        flying.current.set(iid, flight);
        runs[0]!.onfinish = () => {
          ghost.remove();
          if (flying.current.get(iid) === flight) flying.current.delete(iid);
        };
      };

      for (const [iid, cur] of now) {
        const was = drawn.get(iid) ?? prev.current.get(iid);
        if (was) {
          if (Math.hypot(was.cx - cur.cx, was.cy - cur.cy) < 6 && Math.abs(was.s - cur.s) < 0.05)
            continue;
          fly(iid, cur, was, cur, { real: cur.el, duration: ms });
          continue;
        }
        const from = tile(moves.get(iid)?.from ?? null, cur);
        if (from) fly(iid, cur, from, cur, { real: cur.el, fadeIn: true, duration: ms });
      }
      // cards that left the screen fly into the tile of their new zone
      for (const [iid, gone] of prev.current) {
        if (now.has(iid)) continue;
        const to = tile(moves.get(iid)?.to ?? null, gone);
        if (to) fly(iid, gone, drawn.get(iid) ?? gone, to, { duration: ms * 1.1 });
      }
    }
    prev.current = now;
    // takeMoves and ms are read when the view changes; a render for anything else measures nothing
  }, [view]);
}
