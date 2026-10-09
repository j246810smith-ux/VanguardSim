/**
 * The Artwork Manager window (docs/ARTWORK.md): status of the game's card-art folder, import of the
 * user's own images, optional downloads from a locally configured source, export and a report.
 * Presentation only: every action runs in the main process through window.artworkManager.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Problem, ArtworkReport } from '../../../src/artwork/types';
import type { ArtworkInfo } from '../../../src/artwork/types';
import type { Progress } from './api';

type Busy = null | 'scan' | 'import' | 'download' | 'export' | 'report';

export function ArtworkApp() {
  const api = window.artworkManager;
  const [info, setInfo] = useState<ArtworkInfo | null>(null);
  const [report, setReport] = useState<ArtworkReport | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Busy>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [problems, setProblems] = useState<readonly Problem[]>([]);
  const [message, setMessage] = useState('');
  const [replace, setReplace] = useState(false);
  const [sourceId, setSourceId] = useState('');

  const run = async <T,>(kind: Busy, job: () => Promise<T>): Promise<T | null> => {
    setBusy(kind);
    setProgress(null);
    try {
      return await job();
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
      return null;
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };
  const rescan = async () => {
    if (!api) return;
    const r = await run('scan', () => api.scan());
    if (r) setReport(r);
  };

  useEffect(() => {
    if (!api) return;
    const off = api.onProgress(setProgress);
    void api.info().then((i) => {
      setInfo(i);
      setSourceId(i.sources[0]?.id ?? '');
    });
    void rescan();
    return off;
  }, []);

  const sets = useMemo(() => info?.sets ?? [], [info]);
  if (!api) {
    return <div className="art-page">The Artwork Manager runs inside the desktop app.</div>;
  }

  const toggle = (set: string) => {
    const next = new Set(selected);
    if (next.has(set)) next.delete(set);
    else next.add(set);
    setSelected(next);
  };
  const choose = (pred: (set: string) => boolean) =>
    setSelected(new Set(sets.map((s) => s.set).filter(pred)));

  const importImages = async () => {
    const r = await run('import', () => api.importFolder(replace));
    if (!r) return;
    setProblems(r.problems);
    setMessage(
      `Imported ${r.installed} new image(s)` +
        (r.replaced ? `, replaced ${r.replaced}` : '') +
        (r.keptExisting ? `, kept ${r.keptExisting} already installed` : '') +
        (r.problems.length ? `; ${r.problems.length} file(s) not used (see below)` : '') +
        '.',
    );
    await rescan();
  };
  const download = async () => {
    const r = await run('download', () => api.download([...selected], sourceId));
    if (!r) return;
    setProblems(r.problems);
    setMessage(
      `${r.cancelled ? 'Cancelled. ' : ''}Downloaded ${r.downloaded}, already present ${r.skipped}, failed ${r.failed}.` +
        (r.cancelled ? ' Start again to continue where it stopped.' : ''),
    );
    await rescan();
  };
  const exportAll = async () => {
    const r = await run('export', () => api.exportFolder());
    if (r) setMessage(`Exported ${r.count} image(s) to ${r.folder}.`);
  };
  const saveReport = async () => {
    const file = await run('report', () => api.saveReport());
    if (file) setMessage(`Report saved: ${file}`);
  };

  const t = report?.totals;
  const pct =
    progress && progress.total > 0 ? Math.round((100 * progress.done) / progress.total) : 0;
  const shownProblems = problems.length > 0 ? problems : (report?.problems ?? []);

  return (
    <div className="art-page" data-testid="artwork-manager">
      <h1 className="title" style={{ fontSize: 40, margin: '0 0 6px' }}>
        ARTWORK MANAGER
      </h1>
      <p className="art-note">
        Card art is optional and is never included with Vanguard Sim (it belongs to Bushiroad). Use
        images you are entitled to use, for yourself only. The game reads them from:
        <br />
        <code>{info?.root ?? '…'}</code>{' '}
        <button className="btn" onClick={() => void api.openFolder('cards')}>
          Open folder
        </button>
      </p>

      <section className="art-panel">
        <div className="art-totals">
          <span>
            <b>{t?.installed ?? '–'}</b> of {t?.expected ?? '–'} cards have art
          </span>
          <span>missing {t?.missing ?? '–'}</span>
          <span className={t?.invalid ? 'bad' : ''}>invalid {t?.invalid ?? '–'}</span>
          <span>duplicates {t?.duplicates ?? '–'}</span>
          <span>unmatched files {t?.unmatched ?? '–'}</span>
          <button className="btn" disabled={busy !== null} onClick={() => void rescan()}>
            Check folder
          </button>
        </div>
        <div className="art-select">
          <button className="btn" onClick={() => choose(() => true)}>
            All
          </button>
          <button className="btn" onClick={() => choose((s) => s.startsWith('BT'))}>
            Boosters
          </button>
          <button className="btn" onClick={() => choose((s) => s.startsWith('TD'))}>
            Trial decks
          </button>
          <button className="btn" onClick={() => choose(() => false)}>
            None
          </button>
          <span className="art-dim">{selected.size} selected</span>
        </div>
        <div className="art-sets">
          {sets.map(({ set, expected }) => {
            const have = report?.bySet[set]?.installed ?? 0;
            return (
              <label key={set} className={have === expected ? 'done' : ''}>
                <input type="checkbox" checked={selected.has(set)} onChange={() => toggle(set)} />
                <b>{set}</b> {have}/{expected}
              </label>
            );
          })}
        </div>
      </section>

      <section className="art-panel art-actions">
        <div>
          <h2>Import your own images</h2>
          <p className="art-dim">
            Choose a folder: files named by card number (BT01-001.png, bt01_001EN.png,
            TD03-016.jpg…) are checked and put in the right place. Nothing needs renaming.
          </p>
          <label className="art-dim">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />{' '}
            Replace images already installed
          </label>
          <br />
          <button
            className="btn primary"
            disabled={busy !== null}
            onClick={() => void importImages()}
          >
            Import a folder…
          </button>
        </div>
        <div>
          <h2>Download</h2>
          {info && info.sources.length > 0 ? (
            <>
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                {info.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="art-dim">
                {info.sources.find((s) => s.id === sourceId)?.attribution ??
                  'Images stay on this PC for your own use.'}{' '}
                Only missing or broken images of the selected sets are fetched, two at a time.
              </p>
              {busy === 'download' ? (
                <button className="btn gold" onClick={() => void api.cancel()}>
                  Cancel download
                </button>
              ) : (
                <button
                  className="btn primary"
                  disabled={busy !== null || selected.size === 0}
                  onClick={() => void download()}
                >
                  Download missing images
                </button>
              )}
            </>
          ) : (
            <p className="art-dim">
              No download source is set up (none comes with the game). You can add one for your own
              use in <code>artwork-sources.json</code> in the game's data folder (see the project's
              docs/ARTWORK.md), or import images you already have.{' '}
              <button className="btn" onClick={() => void api.openFolder('sources')}>
                Open data folder
              </button>
            </p>
          )}
          {info?.sourceProblems.map((p) => (
            <div key={p} className="bad">
              {p}
            </div>
          ))}
        </div>
        <div>
          <h2>Export and report</h2>
          <p className="art-dim">
            Copy the verified images (with a manifest) to another folder, or save a report for
            troubleshooting.
          </p>
          <button className="btn" disabled={busy !== null} onClick={() => void exportAll()}>
            Export folder…
          </button>{' '}
          <button className="btn" disabled={busy !== null} onClick={() => void saveReport()}>
            Save report…
          </button>
        </div>
      </section>

      {(busy || message) && (
        <section className="art-panel">
          {busy && (
            <div className="art-progress">
              <div style={{ width: `${pct}%` }} />
              <span>
                {busy === 'download' && progress?.phase === 'download'
                  ? `${progress.done}/${progress.total} · downloaded ${progress.downloaded} · failed ${progress.failed}${progress.current ? ` · ${progress.current}` : ''}`
                  : progress
                    ? `${busy} ${progress.done}/${progress.total}`
                    : `${busy}…`}
              </span>
            </div>
          )}
          {message && <div>{message}</div>}
        </section>
      )}

      {shownProblems.length > 0 && (
        <section className="art-panel">
          <h2>Problems ({shownProblems.length})</h2>
          <div className="art-problems">
            {shownProblems.slice(0, 300).map((p, i) => (
              <div key={i}>
                <b>[{p.kind}]</b> {p.what}: {p.reason}
              </div>
            ))}
            {shownProblems.length > 300 && (
              <div>… and {shownProblems.length - 300} more (see the report)</div>
            )}
          </div>
        </section>
      )}
      <p className="art-dim">Restart the game after changing its artwork.</p>
    </div>
  );
}
