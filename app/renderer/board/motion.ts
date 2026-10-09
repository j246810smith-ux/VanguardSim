/**
 * Card movement animation (roadmap phase 2). Presentation only: it runs after React has drawn the
 * new state and animates the cards from where they were, so the rules never wait for it and an
 * interrupted or skipped animation changes nothing. Off at "Instant" speed and with reduced motion.
 *
 * Cards on screen carry `data-iid` (their instance), zone tiles `data-zone` ("<player>-<zone>").
 *   - A card still on screen but elsewhere slides from its old place (hand → circle, circle swaps).
 *   - A card that appears flies in from the tile of the zone it came from (deck → hand, drop → RC).
 *   - A card that leaves the screen flies into the tile of its new zone (RC → drop, VC → soul).
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

interface Placed {
  readonly el: HTMLElement;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Animates card movement inside the `.stage` after every render. `takeMoves` returns (and clears)
 * the moves since the last render; `ms` is the base duration (0 = no animation).
 */
export function useCardMotion(takeMoves: () => Map<string, Move>, ms: number): void {
  const prev = useRef<Map<string, Placed>>(new Map());
  useLayoutEffect(() => {
    const stage = document.querySelector<HTMLElement>('.stage');
    const moves = takeMoves();
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    const scale = stage.offsetWidth ? box.width / stage.offsetWidth : 1;
    const place = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {
        x: (r.left - box.left) / scale,
        y: (r.top - box.top) / scale,
        w: r.width / scale,
        h: r.height / scale,
      };
    };
    const now = new Map<string, Placed>();
    for (const el of stage.querySelectorAll<HTMLElement>('[data-iid]')) {
      const iid = el.dataset.iid!;
      if (!now.has(iid)) now.set(iid, { el, ...place(el) });
    }
    const animate = ms > 0 && typeof Element.prototype.animate === 'function';
    if (animate) {
      const tile = (key: string | null) =>
        key ? stage.querySelector<HTMLElement>(`[data-zone="${key}"]`) : null;
      const easing = 'cubic-bezier(.2,.8,.2,1)';
      for (const [iid, cur] of now) {
        const before = prev.current.get(iid);
        if (before) {
          const dx = before.x - cur.x;
          const dy = before.y - cur.y;
          if (Math.hypot(dx, dy) < 6) continue;
          cur.el.animate(
            [
              { translate: `${dx}px ${dy}px`, zIndex: 50 },
              { translate: '0 0', zIndex: 50 },
            ],
            { duration: ms, easing },
          );
          continue;
        }
        const from = tile(moves.get(iid)?.from ?? null);
        if (!from) continue;
        const f = place(from);
        const dx = f.x + f.w / 2 - (cur.x + cur.w / 2);
        const dy = f.y + f.h / 2 - (cur.y + cur.h / 2);
        cur.el.animate(
          [
            { translate: `${dx}px ${dy}px`, scale: '0.5', opacity: 0.4 },
            { translate: '0 0', scale: '1', opacity: 1 },
          ],
          { duration: ms, easing },
        );
      }
      // cards that left the screen fly into the tile of their new zone
      let layer = stage.querySelector<HTMLElement>('.motion-layer');
      for (const [iid, gone] of prev.current) {
        if (now.has(iid)) continue;
        const to = tile(moves.get(iid)?.to ?? null);
        if (!to) continue;
        if (!layer) {
          layer = document.createElement('div');
          layer.className = 'motion-layer';
          stage.appendChild(layer);
        }
        const ghost = gone.el.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('data-iid');
        Object.assign(ghost.style, {
          position: 'absolute',
          left: `${gone.x}px`,
          top: `${gone.y}px`,
          width: `${gone.w}px`,
          height: `${gone.h}px`,
          margin: '0',
          transform: 'none',
        });
        layer.appendChild(ghost);
        const t = place(to);
        const dx = t.x + t.w / 2 - (gone.x + gone.w / 2);
        const dy = t.y + t.h / 2 - (gone.y + gone.h / 2);
        const run = ghost.animate(
          [
            { translate: '0 0', scale: '1', opacity: 1 },
            { translate: `${dx}px ${dy}px`, scale: '0.4', opacity: 0 },
          ],
          { duration: ms * 1.1, easing: 'ease-in' },
        );
        const remove = () => ghost.remove();
        run.onfinish = remove;
        run.oncancel = remove;
      }
    }
    prev.current = now;
  });
}
