/**
 * The profile avatars: the user's own portraits (assets/home/avatars, cropped from their art pack)
 * and original drawn emblems. No characters from the show.
 */
import { EMBLEM_IDS, type AvatarId } from './profile';

type EmblemId = (typeof EMBLEM_IDS)[number];
const PORTRAIT_FILES = import.meta.glob('../assets/home/avatars/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const portraitUrl = (id: string): string | null =>
  Object.entries(PORTRAIT_FILES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1] ?? null;
const isEmblem = (id: AvatarId): id is EmblemId => (EMBLEM_IDS as readonly string[]).includes(id);

const EMBLEMS: Record<
  EmblemId,
  { readonly label: string; readonly hue: string; readonly d: string }
> = {
  blade: {
    label: 'Blade',
    hue: '#33d1ff',
    d: 'M50 12 L57 24 L57 62 L66 62 L66 68 L56 68 L56 80 L44 80 L44 68 L34 68 L34 62 L43 62 L43 24 Z',
  },
  wing: {
    label: 'Wing',
    hue: '#7ab8ff',
    d: 'M50 74 C40 62 22 60 14 44 C26 48 32 46 38 40 C28 38 22 30 20 22 C32 30 42 30 50 40 C58 30 68 30 80 22 C78 30 72 38 62 40 C68 46 74 48 86 44 C78 60 60 62 50 74 Z',
  },
  star: {
    label: 'Star',
    hue: '#ffd34d',
    d: 'M50 14 L59 40 L86 40 L64 56 L72 82 L50 66 L28 82 L36 56 L14 40 L41 40 Z',
  },
  flame: {
    label: 'Flame',
    hue: '#ff5470',
    d: 'M50 84 C30 84 22 68 26 54 C30 42 40 38 40 24 C50 32 52 40 50 48 C56 44 60 38 60 30 C72 42 78 54 74 66 C70 78 62 84 50 84 Z',
  },
  shield: {
    label: 'Shield',
    hue: '#5ce0b8',
    d: 'M50 14 L80 24 L78 50 C76 66 64 78 50 86 C36 78 24 66 22 50 L20 24 Z M50 26 L50 74 C60 68 68 58 68 48 L68 32 Z',
  },
  crown: {
    label: 'Crown',
    hue: '#c58bff',
    d: 'M18 34 L34 50 L50 24 L66 50 L82 34 L76 72 L24 72 Z M24 76 L76 76 L76 84 L24 84 Z',
  },
};

export function avatarLabel(id: AvatarId): string {
  return isEmblem(id) ? EMBLEMS[id].label : `Portrait (${id})`;
}

const HEX = '50,2 92,26 92,74 50,98 8,74 8,26';

export function Avatar({ id, size = 96 }: { id: AvatarId; size?: number }) {
  if (!isEmblem(id)) {
    const url = portraitUrl(id);
    const clip = `avc-${id}`;
    return (
      <svg className="home-avatar" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <defs>
          <clipPath id={clip}>
            <polygon points={HEX} />
          </clipPath>
        </defs>
        <polygon points={HEX} fill="#0a1434" />
        {url && (
          <image
            href={url}
            x="0"
            y="0"
            width="100"
            height="100"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clip})`}
          />
        )}
        <polygon points={HEX} fill="none" stroke="#ffd34d" strokeWidth="4" />
      </svg>
    );
  }
  const e = EMBLEMS[id];
  const g = `av-${id}`;
  return (
    <svg className="home-avatar" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id={g} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor={e.hue} stopOpacity="0.55" />
          <stop offset="100%" stopColor="#060b1c" />
        </radialGradient>
      </defs>
      <polygon points={HEX} fill={`url(#${g})`} stroke="#ffd34d" strokeWidth="4" />
      <path d={e.d} fill={e.hue} transform="translate(10 8) scale(0.8)" />
    </svg>
  );
}
