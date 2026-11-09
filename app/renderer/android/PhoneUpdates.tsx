/**
 * Settings → Updates on Android: check GitHub for a newer release, download its APK and open
 * Android's installer (android/apkUpdate.ts, ApkUpdatePlugin.java). Decks, settings and card art
 * stay: the new version installs over this one.
 */
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../settings';
import { megabytes, parseNotes, plainInline } from '../updates';
import { useBackHandler } from './back';
import { APP_VERSION, checkApkUpdate, type ApkCheck } from './apkUpdate';
import { nativeApkUpdate, nativeHttp, type PluginListener } from './native';

type Step =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'checked'; check: ApkCheck }
  | { kind: 'downloading'; done: number; total: number }
  | { kind: 'allow' }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string };

export function PhoneUpdates({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const listener = useRef<PluginListener | null>(null);
  useBackHandler(() => (step.kind === 'downloading' ? true : (onClose(), true)));
  useEffect(() => () => void listener.current?.remove(), []);

  const check = async () => {
    const http = nativeHttp();
    if (!http) return setStep({ kind: 'error', message: 'Updating needs the Android app.' });
    setStep({ kind: 'checking' });
    setStep({ kind: 'checked', check: await checkApkUpdate(http, settings.updateChannel) });
  };

  const openInstaller = async () => {
    const plugin = nativeApkUpdate();
    if (!plugin) return;
    if (!(await plugin.canInstall()).allowed) return setStep({ kind: 'allow' });
    await plugin.install();
  };

  const download = async (url: string, sha256: string, size: number) => {
    const plugin = nativeApkUpdate();
    if (!plugin) return setStep({ kind: 'error', message: 'Updating needs the Android app.' });
    setStep({ kind: 'downloading', done: 0, total: size });
    listener.current = await plugin.addListener('progress', (p) =>
      setStep({ kind: 'downloading', done: p.done, total: p.total > 0 ? p.total : size }),
    );
    try {
      const r = await plugin.download({ url, ...(sha256 ? { sha256 } : {}) });
      setStep({ kind: 'ready', version: r.version });
      await openInstaller();
    } catch (e) {
      setStep({ kind: 'error', message: `The update could not be downloaded: ${(e as Error).message}` });
    } finally {
      void listener.current?.remove();
      listener.current = null;
    }
  };

  const busy = step.kind === 'checking' || step.kind === 'downloading';
  const result = step.kind === 'checked' ? step.check : null;
  const latest = result?.ok ? result.latest : null;
  const notes = latest ? parseNotes(latest.notes).slice(0, 12) : [];

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal phone-updates" onClick={(e) => e.stopPropagation()} data-testid="phone-updates">
        <h2>Updates</h2>
        <div>
          This copy: <b>v{APP_VERSION}</b>
          {settings.updateChannel === 'preview' ? ' · Preview channel' : ''}
        </div>
        {step.kind === 'checking' && <p>Looking for a new version…</p>}
        {result && !result.ok && <p className="bad">{result.error}</p>}
        {result?.ok && !result.available && (
          <p data-testid="phone-update-none">You have the newest version (v{result.latest.version}).</p>
        )}
        {result?.ok && result.available && latest && (
          <div data-testid="phone-update-available">
            <p>
              <b>v{latest.version}</b> is available
              {latest.apk ? ` (${megabytes(latest.apk.size)})` : ''}. Your decks, settings and card
              art are kept.
            </p>
            <div className="phone-update-notes">
              {notes.map((n, i) => (
                <div key={i} className={n.kind === 'heading' ? 'h' : ''}>
                  {n.kind === 'item' ? '• ' : ''}
                  {plainInline(n.text)}
                </div>
              ))}
            </div>
            {!latest.apk && (
              <p className="bad">This release has no Android app attached yet. Try again later.</p>
            )}
          </div>
        )}
        {step.kind === 'downloading' && (
          <div className="phone-art-progress" data-testid="phone-update-progress">
            <div className="phone-art-bar">
              <span style={{ width: `${step.total ? Math.round((step.done / step.total) * 100) : 0}%` }} />
            </div>
            <div>
              {megabytes(step.done)}
              {step.total ? ` of ${megabytes(step.total)}` : ''}
            </div>
          </div>
        )}
        {step.kind === 'allow' && (
          <p>
            Android asks you to allow Vanguard Sim to install updates once: tap <b>Allow installs</b>,
            turn on <b>Allow from this source</b>, come back and tap <b>Install</b>.
          </p>
        )}
        {step.kind === 'ready' && (
          <p>v{step.version} is downloaded. Android shows its installer: tap <b>Update</b> there.</p>
        )}
        {step.kind === 'error' && <p className="bad">{step.message}</p>}
        <div className="buttons">
          {!busy && (
            <button className="btn" onClick={onClose}>
              Close
            </button>
          )}
          {(step.kind === 'idle' || step.kind === 'error' || (result && !(result.ok && result.available))) && (
            <button className="btn gold" onClick={() => void check()} data-testid="phone-update-check">
              Check for updates
            </button>
          )}
          {result?.ok && result.available && latest?.apk && (
            <button
              className="btn gold"
              onClick={() => void download(latest.apk!.url, latest.apk!.sha256, latest.apk!.size)}
              data-testid="phone-update-download"
            >
              Download and install
            </button>
          )}
          {step.kind === 'allow' && (
            <>
              <button className="btn" onClick={() => void nativeApkUpdate()?.openInstallSettings()}>
                Allow installs
              </button>
              <button className="btn gold" onClick={() => void openInstaller()}>
                Install
              </button>
            </>
          )}
          {step.kind === 'ready' && (
            <button className="btn gold" onClick={() => void openInstaller()}>
              Open the installer again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
