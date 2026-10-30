/** Online play (D-032): a whole match between a HostLink and a GuestLink over an in-memory pipe. */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { STARTER_DECKS } from '../../src/decks/starters';
import type { LegalAction } from '../../src/engine';
import { ctx } from '../renderer/engine';
import type { GameSession, GuestSession } from '../renderer/game/session';
import { GuestLink, HostLink, type Player } from '../renderer/online/link';

const version = { protocol: 1, app: 'test', cardData: 'test' };
const host: Player = { name: 'Host', deckName: 'A', deck: STARTER_DECKS[0]!.deck };
const guest: Player = { name: 'Guest', deckName: 'B', deck: STARTER_DECKS[1]!.deck };

function connect(guestPlayer: Player = guest, guestVersion = version) {
  const toHost: string[] = [];
  const toGuest: string[] = [];
  let hostSession: GameSession | null = null;
  let guestSession: GuestSession | null = null;
  const refused: string[] = [];
  const events: string[] = [];
  let n = 0;
  const h = new HostLink(
    (l) => toGuest.push(l),
    host,
    { delayedLegion: false },
    (e) => {
      if (e.kind === 'started') hostSession = e.session;
      else if (e.kind === 'refused') refused.push(e.reason);
      else events.push(`host:${e.kind}`);
    },
    version,
    () => (n = (n * 1103515245 + 12345) >>> 0),
    () => 42,
  );
  const g = new GuestLink(
    (l) => toHost.push(l),
    guestPlayer,
    (e) => {
      if (e.kind === 'started') guestSession = e.session;
      else if (e.kind === 'refused') refused.push(e.reason);
      else events.push(`guest:${e.kind}`);
    },
    guestVersion,
    () => {},
  );
  const pump = () => {
    while (toHost.length || toGuest.length) {
      if (toHost.length) h.receive(toHost.shift()!);
      if (toGuest.length) g.receive(toGuest.shift()!);
    }
  };
  g.hello();
  pump();
  return {
    h,
    g,
    pump,
    refused,
    events,
    toHost,
    toGuest,
    host: () => hostSession,
    guest: () => guestSession,
  };
}

describe('online match', () => {
  it('host and guest play a whole game; both see the same result', () => {
    const c = connect();
    const hostAi = new BasicController(ctx);
    const guestAi = new BasicController(ctx);
    for (let i = 0; i < 5000; i++) {
      const hs = c.host()!;
      if (hs.view.status === 'finished') break;
      const gs = c.guest()!;
      if (hs.myTurnToAct) {
        expect(hs.send(hostAi.chooseCommand(hs.view, 0, hs.actions))).toBe(true);
      } else if (gs.myTurnToAct) {
        const command = guestAi.chooseCommand(gs.view, 1, gs.actions as LegalAction[]);
        expect(gs.send(command)).toBe(true);
      } else {
        throw new Error('nobody can act');
      }
      c.pump();
      expect(c.guest()!.error).toBeNull();
    }
    expect(c.host()!.view.status).toBe('finished');
    expect(c.guest()!.view.status).toBe('finished');
    expect(c.guest()!.ending?.winner).toBe(c.host()!.ending?.winner);
    // a rematch starts a fresh game on both sides
    const first = c.guest();
    c.g.rematch();
    c.pump();
    expect(c.guest()).not.toBe(first);
    expect(c.guest()!.view.status).not.toBe('finished');
  });

  it('a guest with another card-data version or an illegal deck is refused', () => {
    const v = connect(guest, { ...version, cardData: 'other' });
    expect(v.refused[0]).toMatch(/card data/);
    expect(v.guest()).toBeNull();
    const bad = connect({ ...guest, deck: { firstVanguard: 'BT01-001', cards: ['BT01-001'] } });
    expect(bad.refused[0]).toMatch(/not legal/);
  });

  it("the guest cannot act in the host's seat or out of turn", () => {
    const c = connect();
    const hs = c.host()!;
    const before = hs.commands.length;
    c.h.receive(JSON.stringify({ t: 'command', command: { type: 'END_PHASE', player: 0 } }));
    c.h.receive(
      JSON.stringify({
        t: 'command',
        command: { type: 'CALL', player: 1, cardId: 'cdeadbeef', circle: 'front_left' },
      }),
    );
    expect(hs.commands.length).toBe(before);
    const errors = c.toGuest
      .map((l) => JSON.parse(l) as { t: string })
      .filter((m) => m.t === 'error');
    expect(errors).toHaveLength(2);
  });

  it('a dropped guest reconnects with its token and the game carries on', () => {
    const c = connect();
    const hostAi = new BasicController(ctx);
    const guestAi = new BasicController(ctx);
    const step = () => {
      const hs = c.host()!;
      const gs = c.guest()!;
      if (hs.myTurnToAct) hs.send(hostAi.chooseCommand(hs.view, 0, hs.actions));
      else if (gs.myTurnToAct)
        gs.send(guestAi.chooseCommand(gs.view, 1, gs.actions as LegalAction[]));
      c.pump();
    };
    for (let i = 0; i < 40 || !c.host()!.myTurnToAct; i++) step();
    // the connection drops: whatever the host sends meanwhile is lost
    const guestBefore = c.guest();
    let lost = 0;
    for (let i = 0; i < 200 && c.host()!.myTurnToAct; i++) {
      const hs = c.host()!;
      hs.send(hostAi.chooseCommand(hs.view, 0, hs.actions));
      lost += c.toGuest.length;
      c.toGuest.length = 0;
    }
    expect(lost).toBeGreaterThan(0);
    // reconnect: the same GuestLink says hello again, with the token
    c.g.hello();
    c.pump();
    expect(c.refused).toEqual([]);
    expect(c.events).toEqual(['host:resumed', 'guest:resumed']);
    expect(c.guest()).toBe(guestBefore);
    expect(c.guest()!.view.turnNumber).toBe(c.host()!.view.turnNumber);
    // and the game can be played to the end
    for (let i = 0; i < 5000 && c.host()!.view.status !== 'finished'; i++) step();
    expect(c.guest()!.ending?.winner).toBe(c.host()!.ending?.winner);
  });

  it('a stranger or a wrong token cannot take over a running game', () => {
    const c = connect();
    c.h.receive(JSON.stringify({ t: 'hello', version, ...guest, resume: 'not-the-token' }));
    c.h.receive(JSON.stringify({ t: 'hello', version, ...guest }));
    expect(c.refused).toEqual([
      'This game is already in progress.',
      'This game is already in progress.',
    ]);
    // a token for a game this host is not running
    const other = connect();
    other.h.receive(JSON.stringify({ t: 'hello', version, ...guest, resume: 'abc' }));
    expect(other.refused).toEqual(['This game is already in progress.']);
    const fresh = new HostLink(
      () => {},
      host,
      { delayedLegion: false },
      (e) => (e.kind === 'refused' ? other.refused.push(e.reason) : undefined),
      version,
    );
    fresh.receive(JSON.stringify({ t: 'hello', version, ...guest, resume: 'abc' }));
    expect(other.refused.at(-1)).toMatch(/no longer running/);
  });

  it('leaving tells the host; giving up on a dropped guest wins the game', () => {
    const c = connect();
    c.g.leave();
    c.pump();
    expect(c.events).toEqual(['host:left']);
    c.h.forfeitGuest();
    c.pump();
    expect(c.host()!.view.status).toBe('finished');
    expect(c.host()!.ending?.winner).toBe(0);
    expect(c.guest()!.ending?.winner).toBe(0);
  });
});
