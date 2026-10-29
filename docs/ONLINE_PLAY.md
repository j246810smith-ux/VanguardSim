# Online play: options and plan (2026-10-28)

**Status:** the user approved stage 1, host-and-join (D-032), and it is built: see "Stage 1 as
built" at the end. **Switched off in v0.25.0-alpha** at the user's request (not ready for players):
the menu button is disabled by `ONLINE_READY` in `app/renderer/App.tsx`; set it to true to use it or
to run `npm run online:probe`. The research and options below are kept for stage 2.

The user asked how to get online play going. This is the research and the proposed plan. Going online reverses D-004 ("Version 1 is offline only") and the
blueprint's stage order (local → browser → browser + private online matches), so the user has to
approve it first (it would become D-032).

## What we already have

- **Commands**: every action is a validated `Command` through `applyCommand`; the AI and the UI
  already play through the same legal-action list. A remote player is "just another controller".
- **Determinism**: the RNG lives in the state (`src/engine/rng.ts`); replays are exact
  (`replayMatch`), so a server can keep a match as `seed + decks + command list`.
- **Hidden information**: `viewFor(state, player)` (`src/engine/view.ts`) hides the decks, the
  opponent's hand, face-down bound cards and the RNG.
- **No UI dependencies in the engine**: a plain Node process can run it unchanged.

## What is missing

1. **Redacted events.** Events name instance ids and sometimes card identities of hidden moves
   (draws, searches, cards looked at). Each player must get their own filtered event stream, the
   same way `viewFor` filters the state.
2. **Deck order leaks.** `viewFor` hides card identities, but the deck is still an ordered list of
   stable instance ids. Once a card has been seen (searched, returned to the deck), its position
   after a shuffle can be read off. Fix: send the opponent only the deck size, and your own deck as
   a size too (you never see your own deck order either).
3. **A network `GameSession`.** `app/renderer/game/session.ts` assumes seat 0 is the human and
   seat 1 the AI (`ME`/`AI`, ~11 files). It needs a "local seat" and a variant that sends commands
   and receives `{ view, events }` instead of applying commands itself.
4. **Match handshake.** Both sides must run the same game and card-data version
   (`CARD_DATA_VERSION`, app version); the guest sends a deck list, which the host validates with
   `validateDeck`.
5. **Match lifecycle.** Reconnects (the server replays the command log), a turn timer or AFK rule,
   concede, rematch, and a few preset messages (no free chat to moderate).
6. **The network block.** `app/main/main.cjs` blocks every http(s) request (D-004). Online play
   would open exactly one connection, only when the player chooses Play Online.

## Options

| Option                                         | How it works                                                                                                                                                 | Cheating                                                                    | Cost / hosting                                                             | Effort                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| **A. Host-and-join (host is authoritative)**   | One player clicks Host; their app runs the engine in the Electron main process and a WebSocket server. The friend clicks Join and enters an address or code. | The host's machine knows everything (fine between friends).                 | None. Needs a reachable host: LAN, port forwarding, or Tailscale/ZeroTier. | Medium                   |
| **B. Small relay server + host-authoritative** | As A, but both connect out to a tiny relay with room codes, so no port forwarding.                                                                           | Same as A.                                                                  | A small always-on Node host (free tiers exist, a few $/month otherwise).   | Medium                   |
| **C. Dedicated match server**                  | The server runs the engine for both players; the apps are thin clients.                                                                                      | Neither player can see hidden cards.                                        | A small always-on Node host.                                               | Medium-high              |
| D. Lockstep peer-to-peer                       | Both apps run the engine and exchange commands.                                                                                                              | Each app holds the whole state (both decks, both hands): trivially cheated. | None.                                                                      | Low, but not recommended |

A, B and C share one piece: a **match host module** (engine + per-player views and events +
command validation + handshake) written for Node. In A it runs inside the host's app; in C it runs
on a server. So the plan builds that module once and moves it later.

## Recommendation

1. **Stage 1, host-and-join (option A).** Match host module in the Electron main process, the
   network `GameSession`, the per-player event redaction and deck-order fix, a Play Online screen
   (Host / Join, deck choice, version check), concede and reconnect. Playable with a friend over LAN,
   Tailscale or ZeroTier (free, no port forwarding). About two to three sessions of work.
2. **Stage 2, room codes (option B or C).** Put the same module on a small server so friends join
   with a code. Moving straight to C (the server runs the match) costs little more than a relay
   and removes the host's advantage, so C is the better stage 2.
3. Later, if wanted: the browser client (the blueprint's version 2), which would talk to the same
   server.

Kept unchanged: card art is never sent over the network (each player uses their own downloaded
art, D-018); the offline game works exactly as now, and the network stays blocked unless the
player opens Play Online.

## Risks

- **Visibility / IP.** An unofficial game with public servers is more visible to Bushiroad than a
  personal offline simulator. Private matches only (room codes, no public lobby, no accounts)
  keep the footprint small. Stage 1 needs no server at all.
- **Security.** The host must treat every incoming message as untrusted: commands go through
  `applyCommand` (already validated), messages are size-limited, and nothing from the network is
  ever evaluated as code or used as a file path.
- **Rules disputes.** Online, an engine bug decides a real game. The unresolved rulings
  (`docs/UNRESOLVED_RULINGS.md`) and the custom rules (Delayed Legion) would be agreed in the
  match settings, which the host shows to the guest.

## Questions for the user

1. Approve online play (reverses D-004)?
2. Start with stage 1 (host-and-join, no server), or go straight to a server with room codes?
3. Turn timer: none, or a chess-clock style limit per player?

## Stage 1 as built (2026-10-28)

**How to play:** Main menu → Play Online. Both players pick a deck and a name. One clicks
**Host** (optionally with Delayed Legion on) and reads out an address; the other types it and
clicks **Join**. Same home network: the local address. Elsewhere: port forwarding (TCP 47820 by
default), or both install Tailscale/ZeroTier and use that address. Windows may ask to allow the
app on networks the first time you host. After a game either player can press Rematch; Leave
closes the connection.

| Piece                                                                                         | Where                                                                    |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Messages, version check, untrusted-input parsing                                              | `src/net/protocol.ts`                                                    |
| Guest view: random card aliases, decks in alias order, opponent's choices removed             | `src/net/guestView.ts`                                                   |
| TCP transport, one JSON message per line, size limits, one guest at a time                    | `app/main/online.cjs` (IPC `online:*`, preload `vanguardDesktop.online`) |
| Host and guest sides of a match                                                               | `app/renderer/online/link.ts` (`HostLink`, `GuestLink`)                  |
| Connection kept across lobby → battles → rematches                                            | `app/renderer/online/controller.ts`                                      |
| Sessions: shared base, host (`GameSession` with `opponent: 'remote'`), guest (`GuestSession`) | `app/renderer/game/session.ts`                                           |
| Lobby                                                                                         | `app/renderer/screens/OnlineScreen.tsx`                                  |
| Local seat (guest plays seat 1, still drawn at the bottom)                                    | `setLocalSeat` in `app/renderer/engine.ts`                               |

**Tests:** `tests/net/guestView.test.ts` (a whole game played by the guest through aliases; no raw
id, RNG or hidden card ever sent), `tests/net/transport.test.ts` (real sockets on this machine),
`app/tests/online.test.ts` (HostLink ↔ GuestLink: whole match, rematch, refused versions/decks,
out-of-turn and wrong-seat commands). `npm run online:probe` runs two copies of the real app,
host and guest, into turn 1.

**Not in stage 1:** reconnecting (a dropped connection ends the game), a turn timer, chat or
emotes, spectators. The host's machine runs the game, so a host could cheat; the guest cannot.
