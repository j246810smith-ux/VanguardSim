/**
 * Settings → Card artwork → Download (Android): choose which cards, then watch the download with a
 * Cancel button (android/artDownload.ts). Pressing Download again carries on where it stopped.
 */
import { useEffect, useRef, useState } from 'react';
import { useBackHandler } from './back';
import {
  downloadPhoneArt,
  entriesFor,
  type ArtChoice,
  type DownloadProgress,
  type DownloadResult,
} from './artDownload';
import { DEFAULT_SOURCES } from '../../../src/artwork/sources';

const CHOICES: { id: ArtChoice; label: string }[] = [
  { id: 'all', label: 'All cards' },
  { id: 'classic', label: 'Original Era' },
  { id: 'g', label: 'G era' },
];
/** About 430 KB a picture (the whole collection is about 1.4 GB). */
const MB_PER_CARD = 0.43;

/** The reason most failed cards share, so a problem with the phone or the network shows. */
function commonReason(r: DownloadResult): string {
  const counts = new Map<string, number>();
  for (const p of r.problems) counts.set(p.reason, (counts.get(p.reason) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'no reason given';
}

export function PhoneArtDownload({ onClose }: { onClose: (changed: boolean) => void }) {
  const [choice, setChoice] = useState<ArtChoice>('all');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const running = progress !== null && result === null && error === null;
  const count = entriesFor(choice).length;
  const close = () => {
    abort.current?.abort();
    onClose(result !== null || progress !== null);
  };
  useBackHandler(() => (close(), true));
  useEffect(() => () => abort.current?.abort(), []);

  const start = () => {
    const controller = new AbortController();
    abort.current = controller;
    setResult(null);
    setError(null);
    setProgress({ total: count, done: 0, downloaded: 0, skipped: 0, failed: 0 });
    downloadPhoneArt({ choice, signal: controller.signal, onProgress: setProgress })
      .then(setResult)
      .catch((e: Error) => setError(e.message));
  };
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="modal-backdrop" onClick={running ? undefined : close}>
      <div
        className="modal phone-art"
        onClick={(e) => e.stopPropagation()}
        data-testid="phone-art-download"
      >
        <h2>Download card art</h2>
        <div className="hint">{DEFAULT_SOURCES[0]!.attribution}</div>
        {!running && !result && (
          <>
            <div className="seg" style={{ margin: '14px 0' }}>
              {CHOICES.map((c) => (
                <button
                  key={c.id}
                  className={choice === c.id ? 'on' : ''}
                  onClick={() => setChoice(c.id)}
                  data-testid={`art-choice-${c.id}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p>
              {count} cards, up to about {Math.round((count * MB_PER_CARD) / 10) * 10} MB. Use Wi-Fi
              and keep the game open: it takes a while. Cards already on the phone are skipped, so you
              can stop and carry on later.
            </p>
          </>
        )}
        {progress && (
          <div className="phone-art-progress" data-testid="phone-art-progress">
            <div className="phone-art-bar">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div>
              {progress.done} of {progress.total} · {progress.downloaded} downloaded
              {progress.skipped ? ` · ${progress.skipped} already here` : ''}
              {progress.failed ? ` · ${progress.failed} not available` : ''}
            </div>
            {running && progress.current && <div className="hint">{progress.current}</div>}
          </div>
        )}
        {result && (
          <p data-testid="phone-art-result">
            {result.cancelled
              ? 'Stopped. Press Download to carry on.'
              : result.failed
                ? `Done. ${result.failed} cards have no picture on the official list or could not be fetched (${commonReason(result)}); try again later.`
                : 'Done: every chosen card has its picture.'}
          </p>
        )}
        {error && <p className="bad">{error}</p>}
        <div className="buttons">
          {running ? (
            <button className="btn" onClick={() => abort.current?.abort()} data-testid="art-cancel">
              Cancel
            </button>
          ) : (
            <>
              <button className="btn" onClick={close}>
                Close
              </button>
              <button className="btn gold" onClick={start} data-testid="art-start">
                {result?.cancelled ? 'Carry on' : 'Download'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
