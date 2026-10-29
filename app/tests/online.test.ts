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
  let n = 0;
  const h = new HostLink(
    (l) => toGuest.push(l),
    host,
    { delayedLegion: false },
    (e) => (e.kind === 'started' ? (hostSession = e.session) : refused.push(e.reason)),
    version,
    () => (n = (n * 1103515245 + 12345) >>> 0),
    () => 42,
  );
  const g = new GuestLink(
    (l) => toHost.push(l),
    guestPlayer,
    (e) => (e.kind === 'started' ? (guestSession = e.session) : refused.push(e.reason)),
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
});
