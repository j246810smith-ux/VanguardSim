/**
 * Online play (D-032): reconnecting over real sockets on this machine. The guest side is the
 * app's OnlineController; the host side is a HostLink on the same transport (both seats share
 * one process here, so the host's controller, which sets the local seat, is not used).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { createOnline } from '../main/online.cjs';
import { setLocalSeat } from '../renderer/engine';
import { OnlineController, tcpBridge, type DesktopOnline } from '../renderer/online/controller';
import { HostLink, type HostEvent, type Player } from '../renderer/online/link';

const host: Player = { name: 'Host', deckName: 'A', deck: STARTER_DECKS[0]!.deck };
const guest: Player = { name: 'Guest', deckName: 'B', deck: STARTER_DECKS[1]!.deck };

/** The main process's transport behind the renderer's bridge API, without IPC. */
function bridge(port: number) {
  const listeners = new Set<(e: { kind: never; data: unknown }) => void>();
  const t = createOnline((kind, data) => {
    for (const l of listeners) l({ kind: kind as never, data });
  });
  const desktop: DesktopOnline = {
    host: (p) => t.host(p),
    join: (address, p) => t.join(address, p),
    send: async (line) => t.send(line),
    drop: async () => t.drop(),
    stop: async () => t.stop(),
    allowRoomCodes: async () => {},
    onEvent(callback) {
      listeners.add(callback);
      return () => void listeners.delete(callback);
    },
  };
  return { t, b: tcpBridge(desktop, port, '127.0.0.1'), listeners };
}

const until = async (cond: () => boolean, ms = 5000) => {
  for (let i = 0; i < ms / 20 && !cond(); i++) await new Promise((r) => setTimeout(r, 20));
  expect(cond()).toBe(true);
};

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanup.splice(0)) c();
  setLocalSeat(0);
});

async function match(port: number) {
  const h = bridge(port);
  const hostEvents: HostEvent['kind'][] = [];
  const link = new HostLink(
    (line) => void h.t.send(line),
    host,
    { delayedLegion: false },
    (e) => hostEvents.push(e.kind),
  );
  h.listeners.add((e) => {
    if (e.kind === ('message' as never)) link.receive(e.data as string);
  });
  expect((await h.t.host(port)).ok).toBe(true);

  const closed: string[] = [];
  let started = 0;
  const g = bridge(port);
  const controller = new OnlineController(g.b, guest, {
    started: () => started++,
    status: () => {},
    closed: (reason) => closed.push(reason),
  });
  cleanup.push(
    () => h.t.stop(),
    () => g.t.stop(),
  );
  await controller.join();
  await until(() => started === 1);
  return { h, g, link, hostEvents, controller, closed };
}

describe('online reconnect (real sockets)', () => {
  it('the guest reconnects by itself after the connection drops', async () => {
    const m = await match(47911);
    const states: string[] = [];
    m.controller.subscribe(() => states.push(m.controller.state.kind));
    m.h.t.drop(); // the host side loses the connection
    await until(() => m.hostEvents.includes('resumed'));
    await until(() => m.controller.state.kind === 'ok');
    expect(states[0]).toBe('reconnecting');
    expect(m.closed).toEqual([]);
    expect(m.link.session?.view.status).not.toBe('finished');
  });

  it('a guest that leaves tells the host; a host that leaves tells the guest', async () => {
    const m = await match(47912);
    m.controller.stop();
    await until(() => m.hostEvents.includes('left'));

    const n = await match(47913);
    n.h.t.send(JSON.stringify({ t: 'closed', reason: 'The host left the game.' }));
    n.h.t.stop();
    await until(() => n.closed.length > 0);
    expect(n.closed).toEqual(['The host left the game.']);
  });
});
