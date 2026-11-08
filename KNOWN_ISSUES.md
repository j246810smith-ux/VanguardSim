# Known Issues

- **Online play is in testing** (docs/PLAYING_ONLINE.md): tested on one PC and through the
  room-code service, not yet widely between different homes and networks. Room codes depend on the
  free PeerJS service (use connect by address if it is down); some very strict networks may not
  connect even through its relay; the host's PC runs the game, so a host could cheat; no turn
  timer, chat, emotes or spectators.
- **Test suite, one flaky test** (2026-11-08): `tests/artwork/artwork.test.ts` "an empty folder"
  failed once in a full run with 4 workers and passed on its own; it scans a fresh temp folder, which
  antivirus can slow on this PC. Rerun before suspecting a regression.
- Card pool: MTD01 is not in the game yet (D-029). English-only printings of English
  EB03 (Dragonic Executioner, Marhaus, …) are not in the pool unless a Japanese product has them
  (the English-only BT16/BT17 cards are, by the user's choice: D-031).
- Behaviours still to be modelled are listed in docs/UNRESOLVED_RULINGS.md (Legion, loops, simultaneous placement, ...) and the deliberate engine simplifications listed there.

## Android app (in testing)

See docs/android/BUILDING_ANDROID.md.

- **Not yet tried on a phone.** It is built and tested on the PC only.
- **Debug build only.** There is no signed release yet, so it installs from the PC (adb) or as a
  debug APK.
- **No online play.** Play Online is left out on Android for now.
- **No in-game updates.** A new version is a new APK, installed over the old one.
- **No Artwork Manager.** Card art, sleeves and playmats come from the PC with
  `npm run artwork:phone`. The phone cannot download art itself yet.
- Uninstalling the app deletes its saved decks and settings. Use Export all decks first.

## Intermittent: update chain test, "The update could not be prepared"

`tests/updates/chain.test.ts` failed once in a full `npm run check` (2026-11-04), on the second update
in a row. It did not recur in later full runs or in 8 parallel runs of that file. **The cause is not
confirmed:** two separate reviews suspected a briefly locked `VanguardUpdater.exe`, so v0.29.1 retries
that copy, but the failure was never caught happening. If a player sees it, nothing has changed in their
game and they can press Install again.
