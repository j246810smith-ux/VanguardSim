/** Online play (D-032): what the guest is sent hides what it must not know. */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { STARTER_DECKS } from '../../src/decks/starters';
import {
  actingPlayer,
  applyCommand,
  createGame,
  getLegalActions,
  HIDDEN,
  type GameEvent,
  type GameState,
} from '../../src/engine';
import { Aliases, guestEvents, guestView } from '../../src/net/guestView';
import { parseGuestMessage, versionMismatch } from '../../src/net/protocol';
import { ctx } from '../fixtures/bt01';

const GUEST = 1;
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed;
};
const RAW_ID = /p[01]-\d{2}/;

/** A game between two basic AIs, the guest playing through aliases and its own view only. */
function playOnline(seed: number, maxCommands = 4000) {
  const decks = [STARTER_DECKS[0]!.deck, STARTER_DECKS[1]!.deck] as const;
  let { state, events } = createGame({ seed, decks }, ctx);
  const aliases = new Aliases(seeded(seed));
  const host = new BasicController(ctx);
  const guest = new BasicController(ctx);
  const sent: { view: GameState; events: GameEvent[] }[] = [];
  const send = () =>
    sent.push({
      view: guestView(state, GUEST, aliases),
      events: guestEvents(events, GUEST, aliases),
    });
  send();
  for (let i = 0; i < maxCommands && state.status !== 'finished'; i++) {
    const p = actingPlayer(state);
    if (p === null) break;
    let command;
    if (p === GUEST) {
      // the guest decides from what it was sent, and its command comes back aliased
      const view = sent.at(-1)!.view;
      const actions = aliases.out(getLegalActions(state, GUEST, ctx));
      command = aliases.in(guest.chooseCommand(view, GUEST, actions));
    } else {
      command = host.chooseCommand(state, p, getLegalActions(state, p, ctx));
    }
    ({ state, events } = applyCommand(state, command, ctx));
    send();
  }
  return { state, sent };
}

describe('guest view', () => {
  it('a whole game can be played by the guest through aliases', () => {
    const { state } = playOnline(7);
    expect(state.status).toBe('finished');
  });

  it('never contains a raw instance id, the RNG, or a hidden card identity', () => {
    const { sent } = playOnline(11, 600);
    for (const { view, events } of sent) {
      expect(JSON.stringify(view)).not.toMatch(RAW_ID);
      expect(JSON.stringify(events)).not.toMatch(RAW_ID);
      expect(view.rng).toEqual([0, 0, 0, 0]);
      const host = view.players[0];
      for (const id of [...host.hand, ...host.deck, ...view.players[GUEST].deck])
        expect(view.cards[id]!.definitionId).toBe(HIDDEN);
    }
  });

  it('decks are sent in alias order, not in deck order', () => {
    const { sent } = playOnline(13, 300);
    for (const { view } of sent)
      for (const p of view.players) expect(p.deck).toEqual([...p.deck].sort());
  });

  it("the opponent's choices are not sent", () => {
    const { sent } = playOnline(17, 1500);
    for (const { events } of sent)
      for (const e of events) {
        if (e.type === 'CHOICE_REQUESTED') expect(e.choice.player).toBe(GUEST);
        if (e.type === 'CHOICE_MADE') expect(e.player).toBe(GUEST);
      }
  });

  it('an unknown alias in a command is rejected', () => {
    const aliases = new Aliases(seeded(1));
    aliases.alias('p1-01');
    expect(() => aliases.in({ type: 'CALL', cardId: 'c00000000' })).toThrow(/unknown card/);
  });
});

describe('guest messages', () => {
  const version = { protocol: 1, app: '0.25.0', cardData: 'x' };
  it('accepts well-formed messages and rejects junk', () => {
    const hello = { t: 'hello', version, name: 'Sam', deckName: 'D', deck: STARTER_DECKS[0]!.deck };
    expect(parseGuestMessage(JSON.stringify(hello))?.t).toBe('hello');
    expect(parseGuestMessage('{"t":"command","command":{"type":"PASS_GUARD","player":1}}')?.t).toBe(
      'command',
    );
    expect(parseGuestMessage('not json')).toBeNull();
    expect(parseGuestMessage('{"t":"eval","code":"x"}')).toBeNull();
    expect(parseGuestMessage(JSON.stringify({ ...hello, name: 'x'.repeat(500) }))).toBeNull();
    expect(parseGuestMessage('x'.repeat(70000))).toBeNull();
  });

  it('different versions cannot play together', () => {
    expect(versionMismatch(version, version)).toBeNull();
    expect(versionMismatch(version, { ...version, cardData: 'y' })).toMatch(/card data/);
    expect(versionMismatch(version, { ...version, app: '0.24.0' })).toMatch(/game version/);
  });
});
