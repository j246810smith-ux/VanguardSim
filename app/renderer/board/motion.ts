/**
 * Card movement animation (roadmap phase 2). Presentation only: it runs after React has drawn the
 * new state and animates the cards from where they were, so the rules never wait for it and an
 * interrupted or skipped animation changes nothing. Off at "Instant" speed and with reduced motion.
 *
 * Cards on screen carry `data-iid` (their instance), zone tiles `data-zone` ("<player>-<zone>").
 *   - A card still on screen but elsewhere flies from its old place (hand → circle, circle swaps).
 *   - A card that appears flies in from the tile of the zone it came from (deck → hand, drop → RC).
 *   - A card that leaves the screen flies into the tile of its new zone (RC → drop, VC → soul).
 *   - A unit that only stands or rests turns on its circle (a stand with a short glow); a sideways
 *     card that moves turns to its new orientation on the way (owner's request 2026-11-18, after
 *     fight-club.dev): it no longer flies sideways and snaps upright when it lands. A checked
 *     card turns sideways on its way into the damage column the same way.
 *   - A card called from the soul slides out from under its vanguard; several cards from (or into)
 *     the same zone at once leave a moment apart; a checked card lifts out of the trigger zone.
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
  /** drawn sideways ([Rest]) */
  readonly rest: boolean;
  /** the angle its face is drawn at: 90 for [Rest] and for the sideways damage column */
  readonly deg: number;
}

/** The card face of a unit, a hand card or a pile card (the circle element holds the unit). */
const faceOf = (el: HTMLElement, iid: string): HTMLElement | null =>
  el.querySelector<HTMLElement>(`.unit[data-iid="${CSS.escape(iid)}"] > .card`) ??
  (el.classList.contains('card') ? el : el.querySelector<HTMLElement>('.card'));

/** Gap between cards leaving one zone together (several retired, five called from the bind zone). */
export const staggerMs = (n: number, ms: number): number => Math.min(n, 6) * Math.round(ms * 0.22);
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
      const face = faceOf(el, iid);
      const rest = face?.classList.contains('rested') ?? false;
      // the damage column turns its cards with the CSS `rotate` property (styles.css .damage-col)
      const turned = face ? parseFloat(getComputedStyle(face).rotate) || 0 : 0;
      const deg = rest ? 90 : turned;
      now.set(iid, { el, lw: el.offsetWidth, lh: el.offsetHeight, side, rest, deg, ...spot(el) });
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
          /** lifts a little before it flies (a checked card leaving the trigger zone) */
          lift?: boolean;
          /** turns from one orientation to the other on the way (degrees: 0 stand, 90 rest) */
          turn?: { from: number; to: number } | undefined;
          /** waits this long first (cards leaving one zone together) */
          delay?: number;
          duration: number;
        },
      ) => {
        const delay = opts.delay ?? 0;
        const copy = card.el.cloneNode(true) as HTMLElement;
        copy.removeAttribute('data-iid');
        copy.removeAttribute('data-testid');
        // the copy's face turns by itself (its [Rest] rotation would otherwise ride along unchanged)
        const turnFace =
          opts.turn && opts.turn.from !== opts.turn.to && !opts.draw ? faceOf(copy, iid) : null;
        turnFace?.classList.remove('rested');
        if (turnFace) turnFace.style.rotate = 'none';
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
              : opts.lift
                ? [
                    // a checked card rises off the trigger zone, then heads for the hand or damage
                    { transform: `translate(${dx}px, ${dy}px) scale(${from.s})`, opacity: 1 },
                    {
                      transform: `translate(${dx}px, ${dy - 16}px) scale(${from.s * 1.05})`,
                      opacity: 1,
                      offset: 0.16,
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
            delay,
            easing: 'cubic-bezier(.2,.8,.2,1)',
            fill: 'both',
          }),
        ];
        if (turnFace && opts.turn)
          runs.push(
            turnFace.animate(
              [
                { transform: `rotate(${opts.turn.from}deg)` },
                { transform: `rotate(${opts.turn.to}deg)`, offset: 0.8 },
                { transform: `rotate(${opts.turn.to}deg)` },
              ],
              { duration: opts.duration, delay, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' },
            ),
          );
        // the real card waits under the ghost and fades in as it lands
        if (opts.real)
          runs.push(
            opts.real.animate(
              [{ opacity: 0 }, { opacity: 0, offset: land ? 0.86 : 0.8 }, { opacity: 1 }],
              { duration: opts.duration, delay, fill: 'backwards' },
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
                  delay: lag + delay,
                  easing: 'cubic-bezier(.2,.8,.2,1)',
                  fill: 'both',
                },
              ),
            );
          }
        }
        if (land) {
          const fxRuns = landingFx(
            layer!,
            { cx: to.cx, cy: to.cy, w: card.lw * to.s, h: card.lh * to.s },
            land,
            card.side,
            fx,
            opts.duration * 0.72,
          );
          // a delayed card's rings wait for it (a negative time seeks to before the start)
          if (delay) for (const a of fxRuns) a.currentTime = -delay;
          runs.push(...fxRuns);
        }
        const flight = { ghost, runs, extras };
        flying.current.set(iid, flight);
        runs[0]!.onfinish = () => {
          ghost.remove();
          for (const e of extras) e.remove();
          if (flying.current.get(iid) === flight) flying.current.delete(iid);
        };
      };

      // how many cards have already left each zone in this batch (they go a moment apart)
      const queued = new Map<string, number>();
      const nextDelay = (key: string | null) => {
        if (!key) return 0;
        const n = queued.get(key) ?? 0;
        queued.set(key, n + 1);
        return staggerMs(n, ms);
      };
      for (const [iid, cur] of now) {
        const before = prev.current.get(iid);
        const was = drawn.get(iid) ?? before;
        if (was) {
          if (Math.hypot(was.cx - cur.cx, was.cy - cur.cy) < 6 && Math.abs(was.s - cur.s) < 0.05) {
            // stayed on its circle but stood up or rested: it turns there
            if (before && before.rest !== cur.rest) {
              const face = faceOf(cur.el, iid);
              face?.animate(
                cur.rest
                  ? [
                      { transform: 'rotate(0deg)' },
                      { transform: 'rotate(96deg)', offset: 0.7 },
                      { transform: 'rotate(90deg)' },
                    ]
                  : [
                      {
                        transform: 'rotate(90deg)',
                        filter:
                          fx !== 'off' ? 'brightness(1.5) drop-shadow(0 0 10px #ffd27a)' : 'none',
                      },
                      {
                        transform: 'rotate(-6deg)',
                        filter:
                          fx !== 'off' ? 'brightness(1.25) drop-shadow(0 0 8px #ffd27a)' : 'none',
                        offset: 0.7,
                      },
                      { transform: 'rotate(0deg)', filter: 'none' },
                    ],
                { duration: ms * 1.1, easing: 'cubic-bezier(.3,.8,.3,1)' },
              );
            }
            continue;
          }
          const move = moves.get(iid);
          // arrived on a circle (hand to circle): the landing slam and its effects
          const land = move && move.to === null ? landKindOf(move.reason) : null;
          const lift = !!move?.from?.endsWith('-trigger');
          fly(iid, cur, was, cur, {
            real: cur.el,
            land,
            lift,
            // a checked card turns sideways into the damage column; a rested unit stands on the way
            turn: before ? { from: before.deg, to: cur.deg } : undefined,
            duration: land ? ms * 1.25 : lift ? ms * 1.2 : ms,
          });
          continue;
        }
        const move = moves.get(iid);
        const fromKey = move?.from ?? null;
        // called out of the soul: it slides out from under its vanguard (not the soul pile)
        const vcFace =
          fromKey?.endsWith('-soul') && move?.to === null
            ? stage.querySelector<HTMLElement>(
                `[data-testid="circle-${fromKey.split('-')[0]}-vanguard"] > .unit:last-of-type > .card`,
              )
            : null;
        const from = vcFace
          ? (() => {
              const r = vcFace.getBoundingClientRect();
              return {
                cx: (r.left + r.width / 2 - box.left) / scale,
                cy: (r.top + r.height / 2 - box.top) / scale,
                s: r.width / scale / (cur.lw || 1),
              };
            })()
          : tile(fromKey, cur);
        if (!from) continue;
        // drawn into a hand: the draw flourish; anything else fades in from its tile
        if (fromKey?.endsWith('-deck') && cur.el.classList.contains('hand-card')) {
          if (fx !== 'off') deckLift(stage.querySelector<HTMLElement>(`[data-zone="${fromKey}"]`));
          fly(iid, cur, from, cur, {
            real: cur.el,
            draw: true,
            delay: nextDelay(fromKey),
            duration: ms * 1.35,
          });
        } else {
          // called from the deck, drop zone, soul or G zone onto a circle: it lands as well
          const land = move?.to === null ? landKindOf(move.reason) : null;
          fly(iid, cur, from, cur, {
            real: cur.el,
            fadeIn: !vcFace,
            land,
            delay: nextDelay(fromKey),
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
        fly(iid, gone, at, to, {
          sink: retired,
          // a rested unit (retired, or a guardian) turns upright on its way to the pile
          turn: { from: gone.deg, to: 0 },
          delay: nextDelay(move?.to ? `to:${move.to}` : null),
          duration: ms * (retired ? 1.3 : 1.1),
        });
      }
    }
    prev.current = now;
    // takeMoves and ms are read when the view changes; a render for anything else measures nothing
  }, [view]);
}
