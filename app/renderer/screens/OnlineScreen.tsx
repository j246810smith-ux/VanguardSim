/**
 * Play Online, stage 1 (D-032): host a game for a friend, or join a friend's game by address.
 * The connection itself lives in the main process; this screen only starts it.
 */
import { useState } from 'react';
import {
  DEFAULT_PORT,
  onlineBridge,
  OnlineController,
  type OnlineCallbacks,
} from '../online/controller';
import { deckEntries, DeckList } from './deckChoice';

const remembered = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(`online.${key}`) ?? fallback;
  } catch {
    return fallback;
  }
};
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(`online.${key}`, value);
  } catch {
    // private mode: not remembered
  }
};

export function OnlineScreen({
  notice,
  onBack,
  onConnected,
  callbacks,
}: {
  /** Why the last online game ended, if it did. */
  notice: string | null;
  onBack: () => void;
  /** The controller is live (hosting or joined): the app keeps it for the battles. */
  onConnected: (controller: OnlineController) => void;
  callbacks: Omit<OnlineCallbacks, 'status'>;
}) {
  const bridge = onlineBridge();
  const [entries] = useState(deckEntries);
  const [deck, setDeck] = useState(0);
  const [name, setName] = useState(() => remembered('name', 'Player'));
  const [address, setAddress] = useState(() => remembered('address', ''));
  const [port, setPort] = useState(() => remembered('port', String(DEFAULT_PORT)));
  const [delayedLegion, setDelayedLegion] = useState(false);
  const [status, setStatus] = useState<string | null>(notice);
  const [hosting, setHosting] = useState<{ address: string; name: string }[] | null>(null);
  const [controller, setController] = useState<OnlineController | null>(null);
  const [busy, setBusy] = useState(false);

  if (!bridge) {
    return (
      <div className="menu">
        <h1 className="title" style={{ fontSize: 52 }}>
          PLAY ONLINE
        </h1>
        <div className="hint">Online play needs the desktop app.</div>
        <button className="menu-btn" onClick={onBack}>
          BACK
        </button>
      </div>
    );
  }

  const portNumber = Number(port);
  const portOk = Number.isInteger(portNumber) && portNumber > 0 && portNumber < 65536;
  const me = () => {
    const e = entries[deck]!;
    remember('name', name);
    remember('port', port);
    return { name: name.trim().slice(0, 40) || 'Player', deckName: e.name, deck: e.deck };
  };
  const make = () =>
    new OnlineController(bridge, me(), { ...callbacks, status: (t) => setStatus(t) });

  const host = async () => {
    const c = make();
    setBusy(true);
    try {
      const addresses = await c.startHosting(portNumber, { delayedLegion });
      setHosting(addresses);
      setController(c);
      setStatus('Waiting for a friend to join…');
      onConnected(c);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    remember('address', address);
    const c = make();
    setBusy(true);
    setStatus(`Connecting to ${address}:${port}…`);
    try {
      await c.join(address.trim(), portNumber);
      setController(c);
      setStatus('Connected. Waiting for the host…');
      onConnected(c);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    controller?.stop();
    setController(null);
    setHosting(null);
    setStatus(null);
  };

  return (
    <div className="menu" style={{ justifyContent: 'flex-start', paddingTop: 40 }}>
      <h1 className="title" style={{ fontSize: 52 }}>
        PLAY ONLINE
      </h1>
      <div className="setup online-setup">
        <div>
          <h2 style={{ color: 'var(--me)' }}>YOUR DECK</h2>
          <DeckList entries={entries} selected={deck} onSelect={setDeck} />
        </div>
        <div className="online-panel">
          <label className="row">
            Your name
            <input
              className="text"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              data-testid="online-name"
            />
          </label>
          <label className="row">
            Port
            <input
              className="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              style={{ width: 110 }}
            />
          </label>

          <h2>HOST A GAME</h2>
          <div className="row">
            <span className="seg">
              <button
                className={delayedLegion ? 'on' : ''}
                onClick={() => setDelayedLegion((v) => !v)}
                disabled={!!controller}
              >
                Delayed Legion: {delayedLegion ? 'ON' : 'OFF'}
              </button>
            </span>
            <button
              className="btn primary"
              disabled={busy || !!controller || !portOk}
              onClick={() => void host()}
              data-testid="online-host"
            >
              Host
            </button>
          </div>
          {hosting && (
            <div className="online-addresses" data-testid="online-addresses">
              Your friend joins with one of these addresses and port {port}:
              {hosting.length === 0 && <div>(no network found)</div>}
              {hosting.map((a) => (
                <div key={a.address}>
                  <b>{a.address}</b> <span className="dim">{a.name}</span>
                </div>
              ))}
              <div className="dim">
                Same home network: use the local address. Elsewhere: forward the port on your
                router, or both install Tailscale or ZeroTier and use that address. If Windows asks
                whether to allow Vanguard Sim on networks, allow it, or your friend cannot connect.
              </div>
            </div>
          )}

          <h2>JOIN A GAME</h2>
          <div className="row">
            <input
              className="text"
              placeholder="Host's address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!!controller}
              data-testid="online-address"
            />
            <button
              className="btn primary"
              disabled={busy || !!controller || !portOk || address.trim() === ''}
              onClick={() => void join()}
              data-testid="online-join"
            >
              Join
            </button>
          </div>

          {status && (
            <div className="online-status" data-testid="online-status">
              {status}
            </div>
          )}
        </div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {controller ? (
          <button className="menu-btn" style={{ width: 300 }} onClick={cancel}>
            CANCEL
          </button>
        ) : (
          <button className="menu-btn" style={{ width: 300 }} onClick={onBack}>
            BACK
          </button>
        )}
      </div>
    </div>
  );
}
