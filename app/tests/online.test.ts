/** Online play (D-032): a whole match between a HostLink and a GuestLink over an in-memory pipe. */
import { afterEach, describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { STARTER_DECKS } from '../../src/decks/starters';
import type { LegalAction } from '../../src/engine';
import { ctx, playFormat, setPlayFormat } from '../renderer/engine';
import { OU_LIST } from '../../src/engine';
import type { GameSession, GuestSession } from '../renderer/game/session';
import { GuestLink, HostLink, type Player } from '../renderer/online/link';
import type { MatchRules } from '../../src/net/protocol';

const version = { protocol: 1, app: 'test', cardData: 'test' };
const host: Player = { name: 'Host', deckName: 'A', deck: STARTER_DECKS[0]!.deck };
const guest: Player = { name: 'Guest', deckName: 'B', deck: STARTER_DECKS[1]!.deck };

function connect(
  guestPlayer: Player = guest,
  guestVersion = version,
  rules: MatchRules = { delayedLegion: false },
) {
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
    rules,
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
    const checks: [number, number] = [0, 0];
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
      // Regression (2026-11-03): the host's drive checks reached the guest as HIDDEN (the card
      // was already in the host's hand), which blanked the guest's screen
      for (const fx of c.guest()!.fx) {
        if (fx.kind === 'check') {
          checks[fx.player]++;
          expect(ctx.registry.has(fx.definitionId)).toBe(true);
        }
      }
      c.guest()!.fx = [];
    }
    expect(checks[0]).toBeGreaterThan(0); // the host's checks were seen by the guest
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

  // six-workstream brief W4: every house rule reaches an online game, not only Delayed Legion
  it("the host's house rules apply to the online game for both players", () => {
    const c = connect(guest, version, {
      delayedLegion: true,
      nineKGrade3: 2000,
      megaBlastCheap: true,
    });
    const s = c.host()!;
    expect(s.state.customRules).toEqual({
      delayedLegion: true,
      nineKGrade3: 2000,
      megaBlastCheap: true,
    });
  });

  // six-workstream brief W3: the room's format is the host's, checked by the host
  describe('room format', () => {
    const gCard = ctx.registry
      .all()
      .find((d) => d.set === 'G-BT01' && d.cardType === 'normal_unit')!;
    const withG: Player = {
      ...guest,
      deck: (() => {
        const d = STARTER_DECKS[1]!.deck;
        const i = d.cards.findIndex(
          (c) => c !== d.firstVanguard && ctx.registry.get(c).trigger === null,
        );
        const cards = [...d.cards];
        cards[i] = gCard.id;
        return { ...d, cards };
      })(),
    };
    afterEach(() => setPlayFormat('classic'));

    it('Original Era — Strict refuses a G era card and says why', () => {
      const c = connect(withG, version, { delayedLegion: false, format: 'classic' });
      expect(c.refused[0]).toMatch(/not legal in Original Era — Strict/);
      expect(c.host()).toBeNull();
    });

    it('Original Era — Expanded refuses a G card that is not approved on the OU list', () => {
      const c = connect(withG, version, {
        delayedLegion: false,
        format: 'classic_ou',
        ouListVersion: OU_LIST.version,
      });
      expect(c.refused[0]).toMatch(/not legal in Original Era — Expanded/);
      expect(c.refused[0]).toMatch(/OU list/);
    });

    it('a guest with another OU list version cannot join an Expanded room', () => {
      const c = connect(guest, version, {
        delayedLegion: false,
        format: 'classic_ou',
        ouListVersion: '9.9',
      });
      expect(c.refused[0]).toMatch(/OU list v9\.9, you have v/);
    });

    it('an Expanded room plays the Expanded format for both players', () => {
      const c = connect(guest, version, {
        delayedLegion: false,
        format: 'classic_ou',
        ouListVersion: OU_LIST.version,
      });
      expect(c.refused).toEqual([]);
      expect(c.host()!.config.format).toBe('classic_ou');
      expect(playFormat).toBe('classic_ou'); // the guest switched to the room's format
    });
  });
});
