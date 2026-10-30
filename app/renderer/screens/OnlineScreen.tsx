/**
 * Play Online (D-032): host a game for a friend, or join a friend's game, by room code (both
 * type the same code) or by address and port. This screen only starts the connection.
 */
import { useState } from 'react';
import {
  DEFAULT_PORT,
  desktopOnline,
  OnlineController,
  tcpBridge,
  type OnlineBridge,
  type OnlineCallbacks,
} from '../online/controller';
import { peerBridge } from '../online/peerBridge';
import { codeProblem, makeCode } from '../online/roomCode';
import { useSettings } from '../settings';
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
  const desktop = desktopOnline();
  const settings = useSettings();
  const [entries] = useState(deckEntries);
  const [deck, setDeck] = useState(0);
  const [name, setName] = useState(() => remembered('name', 'Player'));
  const [code, setCode] = useState(() => remembered('code', ''));
  const [byAddress, setByAddress] = useState(false);
  const [address, setAddress] = useState(() => remembered('address', ''));
  const [port, setPort] = useState(() => remembered('port', String(DEFAULT_PORT)));
  const [delayedLegion, setDelayedLegion] = useState(false);
  const [status, setStatus] = useState<string | null>(notice);
  const [hosting, setHosting] = useState<{ address: string; name: string }[] | null>(null);
  const [hostingCode, setHostingCode] = useState<string | null>(null);
  const [controller, setController] = useState<OnlineController | null>(null);
  const [busy, setBusy] = useState(false);

  if (!desktop) {
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
  const codeError = codeProblem(code);
  const me = () => {
    const e = entries[deck]!;
    remember('name', name);
    remember('port', port);
    return {
      name: name.trim().slice(0, 40) || 'Player',
      deckName: e.name,
      deck: e.deck,
      sleeve: e.sleeve ?? settings.defaultSleeve,
      playmat: e.playmat ?? settings.playmat,
    };
  };
  const bridgeFor = (withCode: boolean): OnlineBridge => {
    if (!withCode) return tcpBridge(desktop, portNumber, address.trim());
    remember('code', code);
    return peerBridge(code, (on) => desktop.allowRoomCodes(on));
  };
  const make = (withCode: boolean) =>
    new OnlineController(bridgeFor(withCode), me(), {
      ...callbacks,
      status: (t) => setStatus(t),
    });

  const host = async (withCode: boolean) => {
    const c = make(withCode);
    setBusy(true);
    setStatus(withCode ? 'Opening the room…' : null);
    try {
      const addresses = await c.startHosting({ delayedLegion });
      if (withCode) setHostingCode(code.trim());
      else setHosting(addresses);
      setController(c);
      setStatus('Waiting for your friend to join…');
      onConnected(c);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const join = async (withCode: boolean) => {
    if (!withCode) remember('address', address);
    const c = make(withCode);
    setBusy(true);
    setStatus(
      withCode ? 'Looking for the game with that code…' : `Connecting to ${address}:${port}…`,
    );
    try {
      await c.join();
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
    setHostingCode(null);
    setStatus(null);
  };

  return (
    <div className="menu" style={{ justifyContent: 'flex-start', paddingTop: 40 }}>
      <h1 className="title" style={{ fontSize: 52 }}>
        PLAY ONLINE
      </h1>
      <div className="hint" data-testid="online-testing" style={{ marginBottom: 10 }}>
        In testing: online play has not been tried widely yet. Both players need the same game
        version. If something goes wrong, please report it on GitHub.
      </div>
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
          <div className="row">
            <span className="seg">
              <button
                className={delayedLegion ? 'on' : ''}
                onClick={() => setDelayedLegion((v) => !v)}
                disabled={!!controller}
                title="House rule: when you host, your choice applies to both players"
              >
                Delayed Legion: {delayedLegion ? 'ON' : 'OFF'}
              </button>
            </span>
          </div>

          <h2>ROOM CODE</h2>
          <div className="dim">
            One player makes a code and presses Host; the other types the same code and presses
            Join. No addresses or router settings needed. Keep the code between the two of you: it
            works like a password.
          </div>
          <div className="row">
            <input
              className="text"
              placeholder="e.g. STORM-4821-RAVEN"
              value={code}
              maxLength={40}
              onChange={(e) => setCode(e.target.value)}
              disabled={!!controller}
              data-testid="online-code"
            />
            <button
              className="btn"
              onClick={() => setCode(makeCode())}
              disabled={!!controller}
              data-testid="online-new-code"
            >
              New code
            </button>
          </div>
          {code.trim() !== '' && codeError && <div className="dim">{codeError}</div>}
          <div className="row">
            <button
              className="btn primary"
              disabled={busy || !!controller || !!codeError}
              onClick={() => void host(true)}
              data-testid="online-host-code"
            >
              Host
            </button>
            <button
              className="btn primary"
              disabled={busy || !!controller || !!codeError}
              onClick={() => void join(true)}
              data-testid="online-join-code"
            >
              Join
            </button>
          </div>
          {hostingCode && (
            <div className="online-addresses" data-testid="online-hosting-code">
              Tell your friend the code: <b>{hostingCode}</b>
            </div>
          )}

          <button
            className="btn"
            style={{ marginTop: 14 }}
            onClick={() => setByAddress((v) => !v)}
            data-testid="online-by-address"
          >
            {byAddress ? 'Hide address options' : 'Connect by address instead'}
          </button>
          {byAddress && (
            <>
              <div className="dim">
                For players on the same home network, or using Tailscale or ZeroTier.
              </div>
              <label className="row">
                Port
                <input
                  className="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  style={{ width: 110 }}
                />
                <button
                  className="btn primary"
                  disabled={busy || !!controller || !portOk}
                  onClick={() => void host(false)}
                  data-testid="online-host"
                >
                  Host by address
                </button>
              </label>
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
                    router, or both install Tailscale or ZeroTier and use that address. If Windows
                    asks whether to allow Vanguard Sim on networks, allow it, or your friend cannot
                    connect.
                  </div>
                </div>
              )}
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
                  onClick={() => void join(false)}
                  data-testid="online-join"
                >
                  Join by address
                </button>
              </div>
            </>
          )}

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
