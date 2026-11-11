/**
 * Sync devices (user, 2026-11-11): the same profile (games, EXP, level, look) and decks on the
 * phone and the PC. Live with a room code, or with a sync file. No server: see profile/sync.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { nativeFiles } from '../android/native';
import { desktopOnline } from '../online/controller';
import { peerBridge } from '../online/peerBridge';
import { codeProblem, makeCode, normalizeCode } from '../online/roomCode';
import { IS_ANDROID } from '../platform';
import {
  applySync,
  readSync,
  runSync,
  syncFileName,
  syncPayload,
  syncRoomCode,
  type SyncResult,
  type SyncStatus,
} from './sync';

export function describeSync(r: SyncResult): string {
  const parts = [
    `${r.gamesAdded} game${r.gamesAdded === 1 ? '' : 's'} added`,
    `${r.decksAdded} deck${r.decksAdded === 1 ? '' : 's'} added`,
  ];
  if (r.decksUpdated) parts.push(`${r.decksUpdated} updated`);
  return `Synced: ${parts.join(', ')}.`;
}

export function SyncPanel() {
  const desktop = desktopOnline();
  const live = !!desktop || IS_ANDROID;
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => stopRef.current?.(), []);

  const busy = status?.kind === 'waiting' || status?.kind === 'sending';
  const start = async (role: 'host' | 'join', withCode: string) => {
    stopRef.current?.();
    setNote(null);
    const bridge = peerBridge(syncRoomCode(normalizeCode(withCode)), (on) =>
      desktop ? desktop.allowRoomCodes(on) : Promise.resolve(),
    );
    stopRef.current = await runSync(bridge, role, setStatus);
  };
  const host = () => {
    const c = makeCode();
    setCode(c);
    void start('host', c);
  };
  const cancel = () => {
    stopRef.current?.();
    stopRef.current = null;
    setStatus(null);
  };

  const saveFile = async () => {
    const now = new Date();
    const text = JSON.stringify(syncPayload(now));
    const native = nativeFiles();
    if (native) {
      try {
        const { uri } = await native.fs.writeFile({
          path: syncFileName(now),
          data: text,
          directory: 'CACHE',
          encoding: 'utf8',
        });
        await native.share.share({ title: 'Vanguard Sim sync', url: uri });
        setNote('Sync file shared: open it on the other device with "Import a sync file".');
      } catch {
        setNote('The sync file was not shared.');
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = syncFileName(now);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setNote('Sync file saved: open it on the other device with "Import a sync file".');
  };
  const importFile = async (file: File) => {
    const read = readSync(await file.text());
    setNote(read.ok ? describeSync(applySync(read)) : read.problem);
  };

  const shown =
    status?.kind === 'waiting'
      ? 'Waiting for the other device…'
      : status?.kind === 'sending'
        ? 'Connected: syncing…'
        : status?.kind === 'done'
          ? describeSync(status.result)
          : status?.kind === 'failed'
            ? status.problem
            : null;

  return (
    <section className="pp-card pp-sync" data-testid="profile-sync">
      <h3>Sync devices</h3>
      <p>
        Have the same profile and decks on your phone and your PC: every game from both (each
        counted once, so EXP and statistics stay right), the newest look, and every deck (a deck
        saved on both keeps its newest edit). A deck deleted on one device comes back from the
        other; delete it on both.
      </p>
      {live ? (
        <div className="pp-sync-live">
          <h4>With a room code (both devices online)</h4>
          <div className="pp-sync-row">
            <button className="btn primary" disabled={busy} onClick={host} data-testid="sync-host">
              Start sync
            </button>
            <span className="pp-dim">then type the code on the other device:</span>
          </div>
          <div className="pp-sync-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="STORM-4821-RAVEN"
              maxLength={40}
              disabled={busy}
              data-testid="sync-code"
            />
            <button
              className="btn"
              disabled={busy || codeProblem(code) !== null}
              onClick={() => void start('join', code)}
              data-testid="sync-join"
            >
              Join sync
            </button>
            {busy && (
              <button className="btn" onClick={cancel} data-testid="sync-cancel">
                Cancel
              </button>
            )}
          </div>
          {shown && (
            <div className="pp-sync-status" data-testid="sync-status">
              {shown}
            </div>
          )}
        </div>
      ) : (
        <p className="pp-dim">
          Live sync needs the Windows or Android app; a sync file works here.
        </p>
      )}
      <h4>With a sync file</h4>
      <div className="pp-sync-row">
        <button className="btn" onClick={() => void saveFile()} data-testid="sync-save-file">
          Save a sync file
        </button>
        <button
          className="btn"
          onClick={() => fileInput.current?.click()}
          data-testid="sync-import-file"
        >
          Import a sync file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          data-testid="sync-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importFile(file);
          }}
        />
      </div>
      {note && (
        <div className="pp-sync-status" data-testid="sync-note">
          {note}
        </div>
      )}
    </section>
  );
}
