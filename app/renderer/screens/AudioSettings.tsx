/** Settings → Audio (docs/audio/AUDIO_PLAN.md): a volume and a mute for each sound category. */
import { audio, DEFAULT_AUDIO } from '../audio/audio';
import type { AudioCategory } from '../audio/catalog';
import { RANDOM, useBattleTracks } from '../audio/playlist';
import { IS_ANDROID } from '../platform';
import type { Settings } from '../settings';

type VolumeKey =
  'masterVolume' | 'cardVolume' | 'battleVolume' | 'uiVolume' | 'musicVolume' | 'ambientVolume';

const ROWS: readonly (readonly [VolumeKey, string, string, AudioCategory | null])[] = [
  ['masterVolume', 'Master volume', 'Everything below', null],
  ['cardVolume', 'Card actions', 'Drawing, calling, riding, striding', 'card'],
  ['battleVolume', 'Battle effects', 'Attacks, guards, checks, triggers', 'battle'],
  ['uiVolume', 'Interface', 'Buttons, phases, turns, results', 'ui'],
  ['musicVolume', 'Music', 'Menu and battle music', 'music'],
  ['ambientVolume', 'Ambient effects', 'No ambient sounds yet', 'ambient'],
];

/** What a volume change sounds like, so the player hears the new level. */
const PREVIEW: Partial<Record<VolumeKey, () => void>> = {
  masterVolume: () => audio.play(['call']),
  cardVolume: () => audio.play(['call']),
  battleVolume: () => audio.play(['hit']),
  uiVolume: () => audio.ui('confirm'),
};

export function AudioSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const muted = (c: AudioCategory) => settings.mutedCategories.includes(c);
  const setMuted = (c: AudioCategory, on: boolean) =>
    onChange({
      ...settings,
      mutedCategories: on
        ? [...settings.mutedCategories.filter((x) => x !== c), c]
        : settings.mutedCategories.filter((x) => x !== c),
    });
  return (
    <div className="audio-settings" data-testid="audio-settings">
      <div className="row">
        <span style={{ width: 300 }}>
          <b>Audio</b>
          <div className="hint">Sounds: Kenney (CC0)</div>
        </span>
        <span className="seg">
          <button
            className={settings.muted ? 'on' : ''}
            onClick={() => onChange({ ...settings, muted: !settings.muted })}
            data-testid="mute-all"
          >
            {settings.muted ? 'Muted: unmute' : 'Mute all'}
          </button>
          <button onClick={() => audio.test()} data-testid="test-sounds">
            Test sounds
          </button>
          <button
            onClick={() => onChange({ ...settings, ...DEFAULT_AUDIO })}
            data-testid="audio-reset"
          >
            Reset to defaults
          </button>
        </span>
      </div>
      <BattleMusic settings={settings} onChange={onChange} />
      {ROWS.map(([key, label, hint, category]) => (
        <div className="row" key={key}>
          <span style={{ width: 300 }}>
            {label}
            <div className="hint">{hint}</div>
          </span>
          <input
            type="range"
            className="volume-slider"
            min={0}
            max={100}
            step={5}
            value={settings[key]}
            aria-label={label}
            disabled={settings.muted || (category !== null && muted(category))}
            onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value) })}
            onPointerUp={() => setTimeout(() => PREVIEW[key]?.(), 30)}
            data-testid={`volume-${key}`}
          />
          <span className="volume-value">{settings[key]}%</span>
          {category && (
            <span className="seg">
              <button
                className={muted(category) ? 'on' : ''}
                onClick={() => setMuted(category, !muted(category))}
                data-testid={`mute-${category}`}
              >
                {muted(category) ? 'Muted' : 'Mute'}
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Settings → Audio → Battle music: Random, or one track; the player's own music folder. */
function BattleMusic({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const tracks = useBattleTracks();
  const own = tracks.filter((t) => t.own).length;
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <span style={{ width: 300 }}>
        Battle music
        <div className="hint">
          {IS_ANDROID
            ? 'Your own: put music files in the app folder music (npm run artwork:phone copies it)'
            : 'Your own: put MP3, OGG, M4A or WAV files in the music folder next to cards'}
          {own > 0 ? ` (${own} found)` : ''}
        </div>
      </span>
      <span className="seg battle-music" data-testid="battle-music">
        {[{ id: RANDOM, title: 'Random' }, ...tracks].map((t) => (
          <button
            key={t.id}
            className={settings.battleMusic === t.id ? 'on' : ''}
            onClick={() => onChange({ ...settings, battleMusic: t.id })}
            data-testid={`battle-music-${t.id}`}
          >
            {t.title}
          </button>
        ))}
      </span>
    </div>
  );
}
