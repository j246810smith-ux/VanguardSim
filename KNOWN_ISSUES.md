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
