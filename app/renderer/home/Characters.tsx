/**
 * The two fighters and their mechs at the sides of the home screen. Each uses its own picture from
 * assets/home/ when there is one (art.ts), and a drawn silhouette until then. The pictures are
 * separate layers, so they can be swapped later (a character choice) without touching the screen.
 */
import { homeArtUrl, type HomeArt } from './art';

type Side = 'player' | 'rival';

const ART: Record<Side, { readonly person: HomeArt; readonly mech: HomeArt }> = {
  player: { person: 'duelist-blue', mech: 'mech-blue' },
  rival: { person: 'rival-red', mech: 'mech-red' },
};

/** Stand-in duelist: head, hair, high-collared coat, a card held up (faces right; mirrored for the rival). */
function FigureStandIn({ side }: { side: Side }) {
  const id = `fig-${side}`;
  const hair =
    side === 'player'
      ? 'M222 120 L238 52 L262 104 L290 34 L304 100 L340 42 L338 112 L380 80 L360 150 L392 160 L356 186 L226 190 L196 170 Z'
      : 'M222 128 C210 70 260 40 304 44 C352 48 384 82 380 140 C392 220 404 330 420 420 L380 400 C376 320 362 250 352 200 L250 200 C240 260 232 330 216 400 L186 410 C204 320 212 220 222 128 Z';
  return (
    <svg viewBox="0 0 600 1000" className="home-standin" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={side === 'player' ? '#1d4fa8' : '#a8163c'} />
          <stop offset="100%" stopColor="#070c20" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`} className="home-standin-shape">
        <path d={hair} />
        <ellipse cx="300" cy="190" rx="70" ry="86" />
        <path d="M262 262 L338 262 L346 312 L254 312 Z" />
        <path d="M120 1000 L140 470 C150 380 196 330 254 306 L300 360 L346 306 C404 330 450 380 460 470 L480 1000 Z" />
        <path d="M206 300 L254 306 L228 430 L170 380 Z M394 300 L346 306 L372 430 L430 380 Z" />
        <path d="M430 470 C470 520 486 560 470 600 L430 620 L404 560 Z" />
        <rect x="430" y="440" width="86" height="124" rx="8" transform="rotate(14 473 502)" />
      </g>
    </svg>
  );
}

/** Stand-in mech companion: an angular head and wings behind the fighter. */
function MechStandIn({ side }: { side: Side }) {
  return (
    <svg viewBox="0 0 600 600" className="home-standin mech" aria-hidden>
      <g className="home-standin-shape">
        <path d="M300 60 L360 170 L340 260 L300 300 L260 260 L240 170 Z" />
        <path d="M260 170 L120 80 L170 220 L40 210 L190 320 L250 260 Z" />
        <path d="M340 170 L480 80 L430 220 L560 210 L410 320 L350 260 Z" />
        <path d="M300 300 L350 420 L300 540 L250 420 Z" />
        <path
          d="M278 190 L298 200 L278 206 Z M322 190 L302 200 L322 206 Z"
          className={side === 'player' ? 'mech-eye blue' : 'mech-eye red'}
        />
      </g>
    </svg>
  );
}

export function SideCharacter({ side }: { side: Side }) {
  const person = homeArtUrl(ART[side].person);
  const mech = homeArtUrl(ART[side].mech);
  // the mech is its own layer behind the field; the fighter stands in front of it
  return (
    <>
      <div className={`home-side home-mech-layer home-side-${side}`} aria-hidden>
        <div className="home-mech">
          {mech ? <img src={mech} alt="" draggable={false} /> : <MechStandIn side={side} />}
        </div>
      </div>
      <div className={`home-side home-side-${side}`} aria-hidden>
        <div className="home-person">
          {person ? <img src={person} alt="" draggable={false} /> : <FigureStandIn side={side} />}
        </div>
      </div>
    </>
  );
}
