# Playing online (in testing)

> **Play Online is still being tested.** It works between two copies of the game on one PC and
> through the real room-code service, but it has **not yet been tried by enough players on
> different computers and networks**. Expect rough edges: if a game drops or will not connect,
> please [report it](https://github.com/j246810smith-ux/VanguardSim/issues) with what you saw.

You can play a friend over the internet or your home network. There are no accounts and no
Vanguard Sim server: one player **hosts** the game on their PC and the other **joins** it.

## Before you start

- **Both players need the same version** of Vanguard Sim (same release). The game checks this and
  explains if they differ. Players on v0.25.0 or earlier cannot play players on v0.26.0 or later.
- Pick your deck and your name on the Play Online screen. Your deck must be legal.
- The first time you host, **Windows may ask whether to allow Vanguard Sim on networks**: click
  **Allow**, or nobody can reach your game.
- Card art is never sent: each player sees the art they have installed. Your sleeve is shown to
  your opponent if it is one of the built-in designs; your own sleeve pictures stay on your PC
  (your opponent sees the default sleeve).

## Two ways to connect

### 1. Room code (easiest)

1. Main menu → **Play Online** → **ROOM CODE**.
2. One player clicks **New code** (you get something like `STORM-4821-RAVEN`), tells the other
   player the code, and clicks **Host**.
3. The other player types the same code and clicks **Join**.

Capital letters, spaces and dashes in the code do not matter. Anyone who knows the code can join,
so share it only with your opponent. If you see "No game is being hosted with that code", the host
has not clicked Host yet (or typed a different code).

Room codes use a free public matchmaking service (PeerJS) only to find each other; the game itself
then runs directly between your two PCs (or through a relay if your networks need one). If that
service is down, use connect by address instead.

### 2. Connect by address

1. One player clicks **Host** on the ADDRESS tab and reads out the address shown.
2. The other player types it and clicks **Join**.

- **Same home network:** use the local address shown (it usually starts with `192.168.`).
- **Different places:** the host needs port forwarding on their router (TCP port **47820**), or
  both players install a private-network app such as Tailscale or ZeroTier and use the address it
  gives.

## During the game

- The **host's PC runs the game**; the guest's PC shows it and sends the guest's moves. The guest
  only ever receives what they are allowed to see (your hand and deck order stay hidden).
- **House rules** such as Delayed Legion are chosen by the host before hosting.
- **If the connection drops**, the game is kept. The guest's game reconnects by itself for up to
  2 minutes (a banner shows "Connection to the host lost", with **Stop and leave**). The host can
  keep playing its own moves, and after 60 seconds may **end the game as a win**.
- **Leaving** on purpose tells the other player straight away.
- After a game, either player can choose **Rematch**; **Leave** ends the connection.

## Known limits while testing

- Not yet tested much between different homes, networks and Windows set-ups.
- Room codes depend on a free third-party service with no guarantee.
- A few very strict networks (some schools, offices, mobile hotspots) may still fail to connect.
- The host's PC runs the game, so play online only with people you trust as host.
- No turn timer, chat, emotes or spectators yet.

Developers: the design, protocol and tests are in [ONLINE_PLAY.md](ONLINE_PLAY.md).
