/**
 * Play Online (D-032): the banner shown over the battle while the connection is down. The guest
 * reconnects by itself; the host waits and, after a while, may end the game as a win.
 */
import { useEffect, useState } from 'react';

export type ConnectionState =
  | { readonly kind: 'ok' }
  /** Host: the guest's connection dropped; `since` is a Date.now() time. */
  | { readonly kind: 'waiting'; readonly since: number }
  /** Guest: trying to get back to the host. */
  | { readonly kind: 'reconnecting'; readonly since: number; readonly attempt: number };

/** The live connection state of an online match, kept by the OnlineController. */
export interface ConnectionWatch {
  readonly state: ConnectionState;
  /** Returns a function that stops listening. */
  subscribe(callback: () => void): () => void;
  /** Host: stop waiting, the guest concedes. Guest: stop reconnecting and leave. */
  giveUp(): void;
}

/** How long the host waits before it may end the game as a win. */
export const CLAIM_AFTER_MS = 60_000;

export function ConnectionBanner({ watch }: { watch: ConnectionWatch }) {
  const [state, setState] = useState(watch.state);
  const [now, setNow] = useState(Date.now);
  useEffect(() => watch.subscribe(() => setState(watch.state)), [watch]);
  useEffect(() => {
    if (state.kind === 'ok') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.kind]);

  if (state.kind === 'ok') return null;
  const seconds = Math.max(0, Math.floor((now - state.since) / 1000));
  const claimIn = Math.ceil((state.since + CLAIM_AFTER_MS - now) / 1000);

  return (
    <div
      className="popover"
      data-testid="connection-banner"
      style={{
        left: '50%',
        top: 70,
        transform: 'translateX(-50%)',
        width: 460,
        textAlign: 'center',
        zIndex: 50,
      }}
    >
      {state.kind === 'waiting' ? (
        <>
          <b style={{ fontSize: 20 }}>Your opponent's connection dropped</b>
          <div className="dim">
            Waiting for them to reconnect… {seconds}s. You can keep playing your own moves.
          </div>
          <button
            className="btn ability-option"
            disabled={claimIn > 0}
            onClick={() => watch.giveUp()}
          >
            {claimIn > 0 ? `End the game as a win (in ${claimIn}s)` : 'End the game as a win'}
          </button>
        </>
      ) : (
        <>
          <b style={{ fontSize: 20 }}>Connection to the host lost</b>
          <div className="dim">
            Reconnecting… attempt {state.attempt}, {seconds}s
          </div>
          <button className="btn ability-option" onClick={() => watch.giveUp()}>
            Stop and leave
          </button>
        </>
      )}
    </div>
  );
}
