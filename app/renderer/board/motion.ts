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
import { deckLift, dustFx, landingFx, type FxLevel, type LandKind } from './cardFx';

/** Where a card moved in the latest events: zone keys like "0-drop", or null for a circle. */
export interface Move {
  readonly from: string | null;
  readonly to: string | null;
  /** Why it last moved (the engine's MoveReason: 'ride', 'call', 'retire', ...). */
  readonly reason?: string;
}

/** The landing effect of a card that arrived on a circle for this reason (null: none). */
export function landKindOf(reason: string | undefined): LandKind | null {
  switch (reason) {
    case 'ride':
      return 'ride';
    case 'stride':
    case 'legion':
      return 'stride';
    case 'guard':
    case 'intercept':
      return 'guard';
    case 'call':
    case 'effect':
      return 'call';
    default:
      return null;
  }
}

const zoneKey = (ref: { player: number; zone: string }): string | null =>
  ref.zone === 'circle' || ref.zone === 'guardian' ? null : `${ref.player}-${ref.zone}`;

/** The moves of a batch of events (the last move of each card wins). */
export function movesOf(events: readonly GameEvent[], into: Map<string, Move> = new Map()) {
  for (const e of events) {
    if (e.type !== 'CARD_MOVED') continue;
    const before = into.get(e.instanceId);
    into.set(e.instanceId, {
      from: before ? before.from : zoneKey(e.from),
      to: zoneKey(e.to),
      reason: e.reason,
    });
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
  /** Echoes of a drawn card (its light trail), removed with the ghost. */
  readonly extras: HTMLElement[];
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
export function useCardMotion(
  takeMoves: () => Map<string, Move>,
  ms: number,
  view: unknown,
  fx: FxLevel = 'off',
): void {
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
      for (const e of f.extras) e.remove();
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
      /** Takes a card copy out of its layout (hand fan rotation, circle offsets): a flat card. */
      const flatten = (el: HTMLElement, lw: number, lh: number, at?: { x: number; y: number }) =>
        Object.assign(el.style, {
          position: 'absolute',
          left: `${at?.x ?? 0}px`,
          top: `${at?.y ?? 0}px`,
          bottom: 'auto',
          width: `${lw}px`,
          height: `${lh}px`,
          margin: '0',
          transform: 'none',
          translate: 'none',
          rotate: 'none',
          scale: 'none',
        });
      const fly = (
        iid: string,
        card: Placed,
        from: Spot,
        to: Spot,
        opts: {
          real?: HTMLElement;
          fadeIn?: boolean;
          draw?: boolean;
          land?: LandKind | null;
          sink?: boolean;
          duration: number;
        },
      ) => {
        const copy = card.el.cloneNode(true) as HTMLElement;
        copy.removeAttribute('data-iid');
        copy.removeAttribute('data-testid');
        // a draw (user's request, 2026-11-13): the card lifts off the deck as a back, turns over
        // on the way and settles into the hand. The copy rides inside a flipping frame with the
        // sleeve on its reverse; the opponent's draw (a back already) only lifts and arcs.
        const flips = !!opts.draw && !!copy.querySelector('.card:not(.back)');
        const ghost = flips ? document.createElement('div') : copy;
        ghost.dataset.ghostOf = iid;
        ghost.classList.add('motion-ghost');
        if (opts.draw) ghost.classList.add('draw-ghost');
        const src = card.side ? sleeveSource[card.side] : null;
        if (src) {
          const cs = getComputedStyle(src);
          for (const v of SLEEVE_VARS) ghost.style.setProperty(v, cs.getPropertyValue(v));
        }
        flatten(ghost, card.lw, card.lh, { x: to.cx - card.lw / 2, y: to.cy - card.lh / 2 });
        if (flips) {
          copy.classList.add('draw-face');
          flatten(copy, card.lw, card.lh);
          // a light sweep crosses the face as it turns over (card effects)
          if (fx !== 'off') {
            const sheen = document.createElement('div');
            sheen.className = 'draw-sheen';
            copy.appendChild(sheen);
          }
          const back = document.createElement('div');
          back.className = 'card back draw-back';
          ghost.append(copy, back);
        }
        const land = fx !== 'off' ? (opts.land ?? null) : null;
        if (land) ghost.classList.add('land-ghost');
        layer!.appendChild(ghost);
        const dx = from.cx - to.cx;
        const dy = from.cy - to.cy;
        const turn = (deg: number) => (flips ? ` rotateY(${deg}deg)` : '');
        const frames: Keyframe[] = opts.draw
          ? [
              { transform: `translate(${dx}px, ${dy}px) scale(${from.s})${turn(180)}`, opacity: 1 },
              {
                // lifted off the table at mid-flight, turning over
                transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(${((from.s + to.s) / 2) * 1.12})${turn(90)}`,
                opacity: 1,
                offset: 0.5,
              },
              { transform: `scale(${to.s})${turn(0)}`, opacity: 1, offset: 0.85 },
              { transform: `scale(${to.s})${turn(0)}`, opacity: 0 },
            ]
          : land
            ? [
                // the card comes down a little too big and settles: the "slam" (card effects)
                {
                  transform: `translate(${dx}px, ${dy}px) scale(${from.s})`,
                  opacity: opts.fadeIn ? 0.4 : 1,
                  boxShadow: '0 36px 44px rgba(0,0,0,0.45)',
                },
                {
                  transform: `translate(${dx * 0.12}px, ${dy * 0.12 - 18}px) scale(${to.s * 1.1})`,
                  opacity: 1,
                  boxShadow: '0 28px 36px rgba(0,0,0,0.4)',
                  offset: 0.62,
                },
                {
                  transform: `scale(${to.s * 0.96})`,
                  opacity: 1,
                  boxShadow: '0 3px 6px rgba(0,0,0,0.35)',
                  offset: 0.76,
                },
                { transform: `scale(${to.s})`, opacity: 1, offset: 0.88 },
                { transform: `scale(${to.s})`, opacity: 0 },
              ]
            : opts.sink
              ? [
                  // a retired unit sinks into the table before it flies to the drop zone
                  { transform: `translate(${dx}px, ${dy}px) scale(${from.s})`, opacity: 1 },
                  {
                    transform: `translate(${dx}px, ${dy + 10}px) scale(${from.s * 0.9})`,
                    opacity: 0.85,
                    offset: 0.25,
                  },
                  { transform: `scale(${to.s})`, opacity: 1, offset: 0.85 },
                  { transform: `scale(${to.s})`, opacity: 0 },
                ]
              : [
                  {
                    transform: `translate(${dx}px, ${dy}px) scale(${from.s})`,
                    opacity: opts.fadeIn ? 0.4 : 1,
                  },
                  { transform: `scale(${to.s})`, opacity: 1, offset: 0.85 },
                  { transform: `scale(${to.s})`, opacity: 0 },
                ];
        const runs: Animation[] = [
          ghost.animate(frames, {
            duration: opts.duration,
            easing: 'cubic-bezier(.2,.8,.2,1)',
            fill: 'forwards',
          }),
        ];
        // the real card waits under the ghost and fades in as it lands
        if (opts.real)
          runs.push(
            opts.real.animate(
              [{ opacity: 0 }, { opacity: 0, offset: land ? 0.86 : 0.8 }, { opacity: 1 }],
              opts.duration,
            ),
          );
        const extras: HTMLElement[] = [];
        // a drawn card leaves a faint light trail: two fading echoes a moment behind it
        if (opts.draw && fx === 'full') {
          for (const [i, lag] of [55, 110].entries()) {
            const echo = ghost.cloneNode(true) as HTMLElement;
            echo.classList.add('draw-echo');
            echo.style.opacity = '0';
            layer!.insertBefore(echo, ghost);
            extras.push(echo);
            runs.push(
              echo.animate(
                frames.map((f, k) => ({
                  ...f,
                  opacity: k === 0 || k === frames.length - 1 ? 0 : 0.28 - 0.1 * i,
                })),
                {
                  duration: opts.duration,
                  delay: lag,
                  easing: 'cubic-bezier(.2,.8,.2,1)',
                  fill: 'both',
                },
              ),
            );
          }
        }
        if (land) {
          runs.push(
            ...landingFx(
              layer!,
              { cx: to.cx, cy: to.cy, w: card.lw * to.s, h: card.lh * to.s },
              land,
              card.side,
              fx,
              opts.duration * 0.72,
            ),
          );
        }
        const flight = { ghost, runs, extras };
        flying.current.set(iid, flight);
        runs[0]!.onfinish = () => {
          ghost.remove();
          for (const e of extras) e.remove();
          if (flying.current.get(iid) === flight) flying.current.delete(iid);
        };
      };

      for (const [iid, cur] of now) {
        const was = drawn.get(iid) ?? prev.current.get(iid);
        if (was) {
          if (Math.hypot(was.cx - cur.cx, was.cy - cur.cy) < 6 && Math.abs(was.s - cur.s) < 0.05)
            continue;
          const move = moves.get(iid);
          // arrived on a circle (hand to circle): the landing slam and its effects
          const land = move && move.to === null ? landKindOf(move.reason) : null;
          fly(iid, cur, was, cur, { real: cur.el, land, duration: land ? ms * 1.25 : ms });
          continue;
        }
        const move = moves.get(iid);
        const fromKey = move?.from ?? null;
        const from = tile(fromKey, cur);
        if (!from) continue;
        // drawn into a hand: the draw flourish; anything else fades in from its tile
        if (fromKey?.endsWith('-deck') && cur.el.classList.contains('hand-card')) {
          if (fx !== 'off') deckLift(stage.querySelector<HTMLElement>(`[data-zone="${fromKey}"]`));
          fly(iid, cur, from, cur, { real: cur.el, draw: true, duration: ms * 1.35 });
        } else {
          // called from the deck, drop zone, soul or G zone onto a circle: it lands as well
          const land = move?.to === null ? landKindOf(move.reason) : null;
          fly(iid, cur, from, cur, {
            real: cur.el,
            fadeIn: true,
            land,
            duration: land ? ms * 1.25 : ms,
          });
        }
      }
      // cards that left the screen fly into the tile of their new zone
      for (const [iid, gone] of prev.current) {
        if (now.has(iid)) continue;
        const move = moves.get(iid);
        const to = tile(move?.to ?? null, gone);
        if (!to) continue;
        // a unit retired from the field: it sinks with a dust puff, then flies to the drop zone
        const retired =
          fx !== 'off' && move?.reason === 'retire' && !!move.to?.endsWith('-drop') && !move.from;
        const at = drawn.get(iid) ?? gone;
        if (retired)
          dustFx(layer, { cx: at.cx, cy: at.cy, w: gone.lw * at.s, h: gone.lh * at.s }, fx);
        fly(iid, gone, at, to, { sink: retired, duration: ms * (retired ? 1.3 : 1.1) });
      }
    }
    prev.current = now;
    // takeMoves and ms are read when the view changes; a render for anything else measures nothing
  }, [view]);
}
