# Known Issues

- **Online play is in testing** (docs/PLAYING_ONLINE.md): tested on one PC and through the
  room-code service, not yet widely between different homes and networks. Room codes depend on the
  free PeerJS service (use connect by address if it is down); some very strict networks may not
  connect even through its relay; the host's PC runs the game, so a host could cheat; no turn
  timer, chat, emotes or spectators.
- Card pool: the side sets after EB12 ( PR cards, the
  movie booster MBT01 and MTD01) are not in the game yet (D-029). English-only printings of English
  EB03 (Dragonic Executioner, Marhaus, …) are not in the pool unless a Japanese product has them
  (the English-only BT16/BT17 cards are, by the user's choice: D-031).
- Behaviours still to be modelled are listed in docs/UNRESOLVED_RULINGS.md (Legion, loops, simultaneous placement, ...) and the deliberate engine simplifications listed there.

## Intermittent: update chain test, "The update could not be prepared"

`tests/updates/chain.test.ts` failed once in a full `npm run check` (2026-11-04), on the second update
in a row. It did not recur in later full runs or in 8 parallel runs of that file. **The cause is not
confirmed:** two separate reviews suspected a briefly locked `VanguardUpdater.exe`, so v0.29.1 retries
that copy, but the failure was never caught happening. If a player sees it, nothing has changed in their
game and they can press Install again.
