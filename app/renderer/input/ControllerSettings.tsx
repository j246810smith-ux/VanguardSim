/**
 * Settings → Controller (docs/CONTROLLER.md): on/off, which pads are connected, and the button
 * each action uses, changed by pressing the wanted button. Windows only: on Android the section
 * is not shown (controller support is not built for the phone yet, user's decision 2026-11-12).
 */
import { useEffect, useState } from 'react';
import type { Settings } from '../settings';
import {
  ACTIONS,
  glyph,
  padKind,
  padName,
  resolveBindings,
  rebind,
  type PadAction,
} from './bindings';
import { padCapture, pollOptions } from './ControllerLayer';
import { readPads, startPolling } from './gamepad';

export function ControllerSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const { controller } = settings;
  const [pads, setPads] = useState<string[]>(() =>
    readPads(pollOptions.current.getPads).map((p) => p.id),
  );
  const [arming, setArming] = useState<PadAction | null>(null);
  const set = (patch: Partial<typeof controller>) =>
    onChange({ ...settings, controller: { ...controller, ...patch } });

  // which pads are plugged in, refreshed while the section is shown
  useEffect(() => {
    const t = setInterval(
      () => setPads(readPads(pollOptions.current.getPads).map((p) => p.id)),
      1000,
    );
    return () => clearInterval(t);
  }, []);

  // waiting for a button: the next press binds it; Escape (or Change again) gives up
  useEffect(() => {
    if (!arming) return;
    padCapture.active = true;
    const poller = startPolling((e) => {
      if (e.type !== 'press' || e.repeat) return;
      set({ bindings: rebind(controller.bindings, arming, e.button) });
      setArming(null);
    }, pollOptions.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setArming(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      padCapture.active = false;
      poller.stop();
      window.removeEventListener('keydown', onKey, true);
    };
  }, [arming]);

  const kind = pads[0] ? padKind(pads[0]) : 'xbox';
  const bound = resolveBindings(controller.bindings);
  const changed = Object.keys(controller.bindings).length > 0;
  return (
    <>
      <div className="row">
        <span style={{ width: 300 }}>
          Controller
          <div className="hint">
            Xbox, PlayStation and other pads: D-pad or stick moves, then Select
          </div>
        </span>
        <span className="seg">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              className={controller.enabled === v ? 'on' : ''}
              onClick={() => set({ enabled: v })}
              data-testid={`controller-${v ? 'on' : 'off'}`}
            >
              {v ? 'On' : 'Off'}
            </button>
          ))}
        </span>
      </div>
      {controller.enabled && (
        <>
          <div className="row">
            <span style={{ width: 300 }}>Connected</span>
            <span className="hint" data-testid="controller-pads">
              {pads.length
                ? pads.map(padName).join(', ')
                : 'None found: press any button on the pad'}
            </span>
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span style={{ width: 300 }}>
              Buttons
              <div className="hint">
                Change, then press the button to use. The D-pad always moves.
              </div>
            </span>
            <div className="pad-bindings" data-testid="controller-bindings">
              {ACTIONS.map((a) => (
                <div key={a.id} className="pad-binding">
                  <span className="pad-binding-label">{a.label}</span>
                  <kbd className={`pad-glyph ${kind}`} data-testid={`glyph-${a.id}`}>
                    {bound[a.id] ? glyph(bound[a.id]!, kind) : '—'}
                  </kbd>
                  <button
                    className={`btn ${arming === a.id ? 'primary' : ''}`}
                    onClick={() => setArming(arming === a.id ? null : a.id)}
                    data-testid={`bind-${a.id}`}
                  >
                    {arming === a.id ? 'Press a button…' : 'Change'}
                  </button>
                </div>
              ))}
              {changed && (
                <button
                  className="btn"
                  onClick={() => set({ bindings: {} })}
                  data-testid="reset-bindings"
                >
                  Reset buttons
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
