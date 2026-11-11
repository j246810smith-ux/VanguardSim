/**
 * The Music manager (six-workstream brief W5; docs/design/SIX_WORKSTREAMS_AUDIT.md section 7):
 * import music on Android (system picker, copied into the app's music folder), preview and remove
 * tracks, make playlists, choose the menu and battle playlists, shuffle, repeat and the music
 * volume. On Windows the tracks come from the music folder beside the game, as before.
 */
import { useEffect, useRef, useState } from 'react';
import {
  fromBrowserFile,
  importMusic,
  removeMusic,
  type ImportResult,
} from '../android/musicImport';
import { nativeFilesystem } from '../android/native';
import {
  createPlaylist,
  deletePlaylist,
  forgetTrack,
  renamePlaylist,
  toggleTrack,
  updateMusicPrefs,
  useMusicPrefs,
  type Repeat,
} from '../audio/musicLibrary';
import { reloadTracks, useBattleTracks } from '../audio/playlist';
import { IS_ANDROID } from '../platform';
import type { Settings } from '../settings';
import { useConfirm } from '../ui/ConfirmDialog';

export function MusicManager({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}) {
  const prefs = useMusicPrefs();
  const tracks = useBattleTracks();
  const [selected, setSelected] = useState<string | null>(prefs.playlists[0]?.id ?? null);
  const [report, setReport] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const { ask, dialog } = useConfirm();
  const fs = IS_ANDROID ? nativeFilesystem() : null;
  const playlist = prefs.playlists.find((p) => p.id === selected) ?? null;

  // the preview stops when the manager closes
  useEffect(
    () => () => {
      player.current?.pause();
      player.current = null;
    },
    [],
  );
  const togglePreview = (id: string, url: string) => {
    player.current?.pause();
    if (preview === id) return setPreview(null);
    const el = new Audio(url);
    el.volume = Math.min(1, settings.musicVolume / 100);
    el.onended = () => setPreview(null);
    el.onerror = () => {
      setPreview(null);
      setReport({
        imported: [],
        failed: [{ name: id, reason: 'could not be played (missing or damaged)' }],
      });
    };
    void el.play().catch(() => setPreview(null));
    player.current = el;
    setPreview(id);
  };

  const onPicked = async (files: FileList | null) => {
    if (!fs || !files?.length) return;
    setBusy(true);
    const own = tracks.filter((t) => t.own).map((t) => t.id.replace(/^own:/, ''));
    const r = await importMusic([...files].map(fromBrowserFile), fs, own);
    await reloadTracks();
    setReport(r);
    setBusy(false);
    if (picker.current) picker.current.value = '';
  };

  const remove = (id: string, title: string) =>
    ask(`Remove "${title}" from this phone?`, 'Remove', async () => {
      if (!fs) return;
      const ok = await removeMusic(id.replace(/^own:/, ''), fs);
      updateMusicPrefs((p) => forgetTrack(p, id));
      await reloadTracks();
      if (!ok)
        setReport({ imported: [], failed: [{ name: title, reason: 'could not be removed' }] });
    });

  const assign = (which: 'menu' | 'battle', value: string) =>
    updateMusicPrefs((p) => ({ ...p, [which]: value || null }));
  const missing = playlist ? playlist.tracks.filter((id) => !tracks.some((t) => t.id === id)) : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal music-manager"
        onClick={(e) => e.stopPropagation()}
        data-testid="music-manager"
      >
        <h2>MUSIC</h2>

        <section>
          <div className="mm-head">
            <b>Tracks</b>
            {fs ? (
              <>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => picker.current?.click()}
                  data-testid="music-import"
                >
                  {busy ? 'Importing…' : 'Import music'}
                </button>
                <input
                  ref={picker}
                  type="file"
                  accept="audio/*,.mp3,.ogg,.wav,.m4a"
                  multiple
                  hidden
                  onChange={(e) => void onPicked(e.target.files)}
                  data-testid="music-file"
                />
              </>
            ) : (
              <span className="hint">
                Your own tracks: put MP3, OGG, WAV or M4A files in the music folder beside the game.
              </span>
            )}
          </div>
          {report && (
            <div className="mm-report" data-testid="music-report">
              {report.imported.length > 0 && <div>Imported: {report.imported.join(', ')}</div>}
              {report.failed.map((f) => (
                <div key={f.name} className="bad">
                  {f.name}: {f.reason}
                </div>
              ))}
            </div>
          )}
          <ul className="mm-tracks">
            {tracks.map((t) => (
              <li key={t.id} data-testid={`track-${t.id}`}>
                <button
                  className="btn"
                  onClick={() => togglePreview(t.id, t.url)}
                  aria-label={`Preview ${t.title}`}
                >
                  {preview === t.id ? '■' : '▶'}
                </button>
                <span className="mm-title">
                  {t.title}
                  {!t.own && <small> · the game's</small>}
                </span>
                {playlist && (
                  <label className="mm-in">
                    <input
                      type="checkbox"
                      checked={playlist.tracks.includes(t.id)}
                      onChange={() => updateMusicPrefs((p) => toggleTrack(p, playlist.id, t.id))}
                      data-testid={`in-playlist-${t.id}`}
                    />
                    in {playlist.name}
                  </label>
                )}
                {t.own && fs && (
                  <button
                    className="btn"
                    onClick={() => remove(t.id, t.title)}
                    data-testid={`remove-${t.id}`}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mm-head">
            <b>Playlists</b>
            <button
              className="btn"
              onClick={() =>
                updateMusicPrefs((p) => {
                  const next = createPlaylist(p);
                  setSelected(next.playlists.at(-1)!.id);
                  return next;
                })
              }
              data-testid="playlist-new"
            >
              New playlist
            </button>
          </div>
          <div className="seg mm-lists">
            {prefs.playlists.map((p) => (
              <button
                key={p.id}
                className={p.id === selected ? 'on' : ''}
                onClick={() => setSelected(p.id)}
                data-testid={`playlist-${p.id}`}
              >
                {p.name} ({p.tracks.length})
              </button>
            ))}
          </div>
          {playlist && (
            <div className="row">
              <input
                className="text"
                value={playlist.name}
                maxLength={60}
                onChange={(e) =>
                  updateMusicPrefs((p) => renamePlaylist(p, playlist.id, e.target.value))
                }
                data-testid="playlist-name"
              />
              <button
                className="btn"
                onClick={() => {
                  updateMusicPrefs((p) => deletePlaylist(p, playlist.id));
                  setSelected(null);
                }}
                data-testid="playlist-delete"
              >
                Delete playlist
              </button>
              {missing.length > 0 && (
                <span className="hint bad">{missing.length} missing file(s) are skipped</span>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="row">
            <span style={{ width: 160 }}>Menu music</span>
            <select
              value={prefs.menu ?? ''}
              onChange={(e) => assign('menu', e.target.value)}
              data-testid="assign-menu"
            >
              <option value="">The game's theme</option>
              {prefs.playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <span style={{ width: 160 }}>Battle music</span>
            <select
              value={prefs.battle ?? ''}
              onChange={(e) => assign('battle', e.target.value)}
              data-testid="assign-battle"
            >
              <option value="">As in Settings → Battle music</option>
              {prefs.playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <span style={{ width: 160 }}>Shuffle</span>
            <span className="seg">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  className={prefs.shuffle === v ? 'on' : ''}
                  onClick={() => updateMusicPrefs((p) => ({ ...p, shuffle: v }))}
                  data-testid={`shuffle-${v ? 'on' : 'off'}`}
                >
                  {v ? 'On' : 'Off'}
                </button>
              ))}
            </span>
            <span style={{ width: 100, marginLeft: 24 }}>Repeat</span>
            <span className="seg">
              {(
                [
                  ['playlist', 'Playlist'],
                  ['track', 'Track'],
                ] as const satisfies readonly (readonly [Repeat, string])[]
              ).map(([v, label]) => (
                <button
                  key={v}
                  className={prefs.repeat === v ? 'on' : ''}
                  onClick={() => updateMusicPrefs((p) => ({ ...p, repeat: v }))}
                  data-testid={`repeat-${v}`}
                >
                  {label}
                </button>
              ))}
            </span>
          </div>
          <div className="row">
            <span style={{ width: 160 }}>Music volume</span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.musicVolume}
              onChange={(e) => onChange({ ...settings, musicVolume: Number(e.target.value) })}
              data-testid="music-volume"
            />
            <span className="hint">Sound effects keep their own volumes</span>
          </div>
        </section>

        <div className="buttons">
          <button className="btn" onClick={onClose} data-testid="music-close">
            Close
          </button>
        </div>
        {dialog}
      </div>
    </div>
  );
}
