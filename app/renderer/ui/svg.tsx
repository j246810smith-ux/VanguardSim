/** Original vector art for the board: circuit rings, centre emblem, clan badges and icons. */
import { clanColor } from '../engine';

/** A futuristic circuit ring; `strong` = vanguard circle. Colour comes from CSS `currentColor`. */
export function Ring({ strong }: { readonly strong: boolean }) {
  const ticks = Array.from({ length: strong ? 48 : 36 }, (_, i) => i);
  return (
    <svg viewBox="-100 -100 200 200" aria-hidden>
      <defs>
        <radialGradient id={strong ? 'ringFillV' : 'ringFill'}>
          <stop offset="55%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="100%" stopColor="currentColor" stopOpacity={strong ? 0.35 : 0.18} />
        </radialGradient>
      </defs>
      <circle r="96" fill={`url(#${strong ? 'ringFillV' : 'ringFill'})`} />
      <circle r="94" fill="none" stroke="currentColor" strokeWidth={strong ? 3 : 2} />
      <circle r="84" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 5" />
      <g className="spin">
        {ticks.map((i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const long = i % 4 === 0;
          const r1 = long ? 70 : 74;
          return (
            <line
              key={i}
              x1={Math.cos(a) * r1}
              y1={Math.sin(a) * r1}
              x2={Math.cos(a) * 80}
              y2={Math.sin(a) * 80}
              stroke="currentColor"
              strokeWidth={long ? 2.5 : 1}
            />
          );
        })}
        <path
          d="M -60 -40 A 72 72 0 0 1 -40 -60"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
        />
        <path d="M 60 40 A 72 72 0 0 1 40 60" fill="none" stroke="currentColor" strokeWidth="5" />
      </g>
      {strong && (
        <g opacity="0.5">
          <polygon
            points="0,-58 50,-29 50,29 0,58 -50,29 -50,-29"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <polygon
            points="0,-44 38,-22 38,22 0,44 -38,22 -38,-22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </g>
      )}
      {[0, 90, 180, 270].map((deg) => (
        <rect
          key={deg}
          x="-4"
          y="-100"
          width="8"
          height="10"
          fill="currentColor"
          transform={`rotate(${deg + 45})`}
        />
      ))}
    </svg>
  );
}

/** Centre-line emblem: an abstract crossed-blade diamond (original design). */
export function CentreEmblem() {
  return (
    <svg className="emblem" viewBox="-50 -50 100 100" aria-hidden>
      <defs>
        <linearGradient id="emb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5a4a" />
          <stop offset="0.5" stopColor="#b98cff" />
          <stop offset="1" stopColor="#33d1ff" />
        </linearGradient>
      </defs>
      <circle r="44" fill="#0a0f20" stroke="url(#emb)" strokeWidth="3" />
      <circle r="36" fill="none" stroke="url(#emb)" strokeWidth="1" strokeDasharray="3 4" />
      <polygon points="0,-26 26,0 0,26 -26,0" fill="none" stroke="url(#emb)" strokeWidth="4" />
      <path
        d="M -14 -6 L 0 14 L 14 -6"
        fill="none"
        stroke="#ffd34d"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Clan emblem plate (D-019: instead of character portraits): hexagon with the clan's initials. */
export function ClanBadge({ clan }: { readonly clan: string }) {
  const color = clanColor(clan);
  const initials = clan
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return (
    <svg className="emblem-badge" viewBox="-50 -50 100 100" aria-hidden>
      <polygon
        points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23"
        fill="#0a1222"
        stroke={color}
        strokeWidth="4"
      />
      <polygon points="0,-34 29,-17 29,17 0,34 -29,17 -29,-17" fill={color} opacity="0.22" />
      <text
        y="9"
        textAnchor="middle"
        fontFamily="Orbitron, sans-serif"
        fontWeight="800"
        fontSize={initials.length > 2 ? 22 : 28}
        fill={color}
      >
        {initials}
      </text>
    </svg>
  );
}

const ICONS = {
  attack: 'M4 20 L14 10 M14 10 L20 4 M16 4 h4 v4 M6 14 l4 4 M3 21 l3-3',
  call: 'M5 4 h9 v13 h-9 z M10 8 h9 v13 h-9 z',
  ride: 'M12 3 l8 5 v8 l-8 5 l-8-5 v-8 z M12 8 v8 M8 12 h8',
  details: 'M10 4 a6 6 0 1 0 0.01 0 M14.5 14.5 L20 20',
  end: 'M5 4 l8 8 l-8 8 M13 4 l8 8 l-8 8',
  guard: 'M12 3 l8 3 v6 c0 5-4 8-8 9 c-4-1-8-4-8-9 v-6 z',
  skill: 'M13 2 L4 14 h7 l-1 8 l9-12 h-7 z',
  swap: 'M7 4 v16 M4 7 l3-3 l3 3 M17 20 v-16 M14 17 l3 3 l3-3',
  log: 'M5 5 h14 M5 10 h14 M5 15 h10 M5 20 h7',
  gear: 'M12 8 a4 4 0 1 0 0.01 0 M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3 M5 5 l2 2 M17 17 l2 2 M5 19 l2-2 M17 7 l2-2',
  cancel: 'M6 6 L18 18 M18 6 L6 18',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name }: { readonly name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
