// Vanguard Update Manager (D-037): installed version, newest release on the chosen channel, its
// release notes, a way to the download page, downloading and verifying an update, installing it
// through the updater program, and going back to the version kept from the last update.
import { useEffect, useState } from 'react';
import type { Settings } from '../settings';
import {
  desktopUpdates,
  megabytes,
  parseNotes,
  progressText,
  releaseDate,
  type InstallInfo,
  type UpdateCheck,
  type UpdateDownload,
  type UpdateAction,
  type UpdateProgress,
} from '../updates';

export function UpdateManager({
  settings,
  onChange,
  onBack,
  initial,
  onChecked,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
  /** A result already fetched this run (start-up check), shown without asking GitHub again. */
  initial: UpdateCheck | null;
  onChecked: (r: UpdateCheck) => void;
}) {
  const updates = desktopUpdates();
  const [info, setInfo] = useState<InstallInfo | null>(null);
  const [result, setResult] = useState<UpdateCheck | null>(
    initial && (!initial.ok || initial.channel === settings.updateChannel) ? initial : null,
  );
  const [checking, setChecking] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [download, setDownload] = useState<UpdateDownload | null>(null);
  /** Set once the updater is running: the game is about to close. */
  const [closing, setClosing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rollback, setRollback] = useState<{ readonly version: string } | null>(null);
  const [confirmRollback, setConfirmRollback] = useState(false);

  useEffect(() => {
    void updates?.info().then(setInfo);
    void updates?.rollbackInfo().then(setRollback);
  }, [updates]);
  // leaving the screen pauses a running download: the next start carries on from the same byte
  useEffect(() => {
    if (!updates) return;
    const stop = updates.onProgress(setProgress);
    return () => {
      stop();
      void updates.cancelDownload();
    };
  }, [updates]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const check = async (channel = settings.updateChannel) => {
    if (!updates) return;
    setChecking(true);
    try {
      const r = await updates.check(channel);
      setResult(r);
      onChecked(r);
    } catch {
      setResult({ ok: false, error: 'The update check failed. Try again.' });
    } finally {
      setChecking(false);
    }
  };

  const setChannel = (updateChannel: Settings['updateChannel']) => {
    if (updateChannel === settings.updateChannel) return;
    onChange({ ...settings, updateChannel });
    setResult(null);
    setShowNotes(false);
    setDownload(null);
  };

  const startDownload = async (version: string) => {
    if (!updates) return;
    setDownload(null);
    setProgress({ phase: 'checking' });
    try {
      setDownload(await updates.download(version));
    } catch {
      setDownload({ ok: false, error: 'The download failed. Try again.' });
    } finally {
      setProgress(null);
    }
  };

  const runAction = async (action: () => Promise<UpdateAction>, closingText: string) => {
    setActionError(null);
    setClosing(closingText);
    let r: UpdateAction;
    try {
      r = await action();
    } catch {
      r = { ok: false, error: 'The updater could not start. Your game was not changed.' };
    }
    if (!r.ok) {
      setClosing(null);
      setActionError(r.error);
    }
  };

  const latest = result?.ok ? result.latest : null;
  const canDownload =
    Boolean(updates) &&
    Boolean(info?.packaged) &&
    !info?.portable &&
    Boolean(result?.ok && result.available);
  const handInstallOnly = download && !download.ok && download.code === 'no-manifest';
  const status = !updates
    ? 'Updates can only be checked in the desktop app.'
    : checking
      ? 'Checking GitHub…'
      : !result
        ? 'Not checked yet.'
        : !result.ok
          ? result.error
          : result.available
            ? `Version ${result.latest.version} is available.`
            : 'You have the newest version.';

  return (
    <div className="menu settings-screen" data-testid="update-manager">
      <h1 className="title" style={{ fontSize: 52 }}>
        UPDATES
      </h1>
      <div className="settings-scroll">
        <div className="row">
          <span style={{ width: 300 }}>Installed version</span>
          <span style={{ width: 360 }} data-testid="update-current">
            {info ? info.version : '…'}
            {info && !info.packaged ? ' (development build)' : ''}
          </span>
        </div>
        <div className="row">
          <span style={{ width: 300 }}>
            Update channel
            <div className="hint">
              Preview builds come first and may be unstable. Your decks and settings are kept either
              way.
            </div>
          </span>
          <span className="seg">
            {(
              [
                ['stable', 'Stable'],
                ['preview', 'Preview (unstable)'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                className={settings.updateChannel === v ? 'on' : ''}
                onClick={() => setChannel(v)}
                data-testid={`channel-${v}`}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        <div className="row">
          <span style={{ width: 300 }}>
            Check when the game starts
            <div className="hint">Asks GitHub once per start; nothing else goes online</div>
          </span>
          <span className="seg">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                className={settings.checkUpdatesAtStart === v ? 'on' : ''}
                onClick={() => onChange({ ...settings, checkUpdatesAtStart: v })}
                data-testid={`check-at-start-${v ? 'on' : 'off'}`}
              >
                {v ? 'On' : 'Off'}
              </button>
            ))}
          </span>
        </div>
        <div className="row">
          <span style={{ width: 300 }}>Latest version</span>
          <span style={{ width: 360 }} data-testid="update-latest">
            {latest
              ? `${latest.version}${latest.date ? ` · ${releaseDate(latest.date)}` : ''}`
              : '—'}
          </span>
          <button
            className="btn"
            disabled={!updates || checking}
            onClick={() => void check()}
            data-testid="check-updates"
          >
            Check for Updates
          </button>
        </div>
        <div
          className="row"
          data-testid="update-status"
          style={{ color: result?.ok && result.available ? '#ffd166' : undefined }}
        >
          {status}
        </div>
        {latest && (
          <div className="row" style={{ gap: 12 }}>
            <button
              className="btn"
              onClick={() => setShowNotes((s) => !s)}
              data-testid="toggle-notes"
            >
              {showNotes ? 'Hide Release Notes' : 'View Release Notes'}
            </button>
            {canDownload && !progress && !download?.ok && !handInstallOnly && (
              <button
                className="btn"
                onClick={() => void startDownload(latest.version)}
                data-testid="download-update"
              >
                {download ? 'Continue Download' : 'Download Update'}
              </button>
            )}
            {progress && (
              <button
                className="btn"
                onClick={() => void updates?.cancelDownload()}
                data-testid="cancel-download"
              >
                Pause
              </button>
            )}
            {result?.ok && result.available && (
              <button
                className="btn"
                onClick={() => void updates?.openPage(latest.page)}
                data-testid="open-download"
              >
                Open Download Page
              </button>
            )}
          </div>
        )}
        {progress && (
          <div className="row" style={{ flexDirection: 'column', gap: 6 }}>
            <span data-testid="download-progress">{progressText(progress)}</span>
            {progress.phase === 'downloading' && (
              <progress
                style={{ width: 420 }}
                max={progress.total ?? 1}
                value={progress.received ?? 0}
              />
            )}
            <span className="hint">Leaving this screen pauses the download.</span>
          </div>
        )}
        {download && (
          <div
            className="row"
            data-testid="download-result"
            style={{ color: download.ok ? '#7bd88f' : undefined, maxWidth: 760 }}
          >
            {download.ok
              ? `Version ${download.version} is downloaded and verified (${megabytes(download.size)}). Installing closes the game and opens it again. Your decks, settings and card art are kept.`
              : download.error}
          </div>
        )}
        {download?.ok && !closing && (
          <div className="row">
            <button
              className="btn"
              style={{ borderColor: '#7bd88f' }}
              onClick={() =>
                void runAction(
                  () => updates!.install(download.version),
                  `Installing version ${download.version}. The game will close and open again…`,
                )
              }
              data-testid="install-update"
            >
              Install and Restart
            </button>
          </div>
        )}
        {closing && (
          <div className="row" data-testid="update-closing">
            {closing}
          </div>
        )}
        {actionError && (
          <div className="row" data-testid="update-action-error" style={{ maxWidth: 760 }}>
            {actionError}
          </div>
        )}
        {rollback && !closing && (
          <div className="row">
            <span style={{ width: 300 }}>
              Previous version
              <div className="hint">
                Kept from your last update. Decks made with newer cards may not load in it.
              </div>
            </span>
            <span style={{ width: 200 }} data-testid="rollback-version">
              {rollback.version}
            </span>
            {confirmRollback ? (
              <button
                className="btn"
                style={{ borderColor: '#ffd166' }}
                onClick={() =>
                  void runAction(
                    () => updates!.rollback(),
                    `Going back to version ${rollback.version}. The game will close and open again…`,
                  )
                }
                data-testid="rollback-confirm"
              >
                Really go back to {rollback.version}?
              </button>
            ) : (
              <button
                className="btn"
                onClick={() => setConfirmRollback(true)}
                data-testid="rollback"
              >
                Go Back to This Version
              </button>
            )}
          </div>
        )}
        {latest && result?.ok && result.available && (
          <div className="hint" style={{ maxWidth: 760, textAlign: 'left' }}>
            {info?.portable
              ? 'You are using the single-file version: download the new VanguardSim-…-portable.exe and use it instead of this one.'
              : 'Or by hand: download the new VanguardSim-…-win-x64.zip, close the game and unzip it over this folder. Your decks, settings and card art are kept.'}
          </div>
        )}
        {latest && showNotes && <ReleaseNotes title={latest.name} markdown={latest.notes} />}
      </div>
      <button
        className="menu-btn"
        style={{ width: 300 }}
        onClick={onBack}
        data-testid="updates-back"
      >
        BACK
      </button>
    </div>
  );
}

function ReleaseNotes({ title, markdown }: { title: string; markdown: string }) {
  const all = parseNotes(markdown);
  // notes usually start with the release name as a heading: do not show it twice
  const blocks = all[0]?.kind === 'heading' && all[0].text === title ? all.slice(1) : all;
  return (
    <div
      className="release-notes"
      data-testid="release-notes"
      style={{
        maxWidth: 820,
        width: '100%',
        textAlign: 'left',
        padding: '12px 20px',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.25)',
        lineHeight: 1.45,
      }}
    >
      <h2 style={{ margin: '4px 0 10px', fontSize: 24 }}>{title}</h2>
      {blocks.length === 0 && <p>This release has no notes.</p>}
      {blocks.map((b, i) =>
        b.kind === 'heading' ? (
          <h3 key={i} style={{ margin: '14px 0 6px', fontSize: b.level <= 2 ? 21 : 18 }}>
            {b.text}
          </h3>
        ) : b.kind === 'item' ? (
          <div key={i} style={{ paddingLeft: 18 + b.level * 18, textIndent: -14 }}>
            • {b.text}
          </div>
        ) : (
          <p key={i} style={{ margin: '6px 0' }}>
            {b.text}
          </p>
        ),
      )}
    </div>
  );
}
