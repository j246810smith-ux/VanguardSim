# Vanguard Sim

An **unofficial** Windows simulator for the original _Cardfight!! Vanguard_ trading card game,
covering the historical **VG-BT01 to VG-BT17** era and its side sets (Japanese-original set
structure, classic pre-G rules, Comprehensive Rules ver. 1.29 as the target). Play against an AI on
your own PC, or a friend online (**in testing**). No account or server of ours is needed: the game
only goes online when you choose Play Online, and the optional Artwork Manager downloads images
only when you ask it to.

> **Fan project.** Not produced, endorsed or supported by Bushiroad, and not affiliated with them.
> Cardfight!! Vanguard, its card names, text, data and artwork belong to Bushiroad. See
> [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). **No card artwork is included in the download**; the
> optional Artwork Manager can fetch it from the official card list for your personal use.

## Status: alpha

| Area         | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules engine | Turn structure, ride/call, battle, triggers, Limit Break, Break Ride, Lock, Legion and the effect system, checked against the official rules (`docs/DECISIONS.md`, `docs/UNRESOLVED_RULINGS.md`)                                                                                                                                                                                                                                                                                                                  |
| Cards        | **Playable: every booster BT01–BT17, Trial Decks TD01–TD17** (except the Japanese-only TD15), **Extra Boosters EB01–EB12, Fighter's Collections FC01 and FC02, the DAIGO set DG01, and the English-only cards of English BT16/BT17** (Deletors and more): 2471 cards, every effect implemented and tested. The five Japanese-only cards carry an unofficial English translation (marked in Card details). Not yet: the movie booster MBT01 and trial deck MTD01, PR cards. Progress: `docs/CARD_STATUS_REPORT.md` |
| Game         | Desktop app with music, sound effects and card animations: main menu, 74 ready-made starter decks plus the 16 trial decks, deck builder, a full battle UI against the AI (an ability box beside the G circle shows which card's ability is resolving and what to do), foil effects on rare cards, card **sleeves and playmats** per deck, an optional **Delayed Legion** house rule, Artwork Manager for optional card art, sleeves and playmats                                                                  |
| AI           | Easy, Normal and Hard. **Experimental**: the Hard AI is being improved (`docs/ai/AI_AUDIT_AND_PLAN.md`)                                                                                                                                                                                                                                                                                                                                                                                                           |
| Online       | **In testing:** Play Online against a friend by room code or by address ([docs/PLAYING_ONLINE.md](docs/PLAYING_ONLINE.md)). Tested on one PC and through the room-code service; not yet tested widely between different homes and networks                                                                                                                                                                                                                                                                        |
| Not included | G-era and later mechanics; card artwork, sleeve and playmat images are not in the download (optional, via the Artwork Manager)                                                                                                                                                                                                                                                                                                                                                                                    |

Known gaps and simplifications are listed in [KNOWN_ISSUES.md](KNOWN_ISSUES.md) and
`docs/UNRESOLVED_RULINGS.md`.

## Custom rules

On the **Game Setup** screen, the _Custom rules_ row turns optional house rules on for that game.
All are off by default; standard games follow the official rules.

- **Delayed Legion**: Seek Mate's cost must be four normal units without Sentinel from your drop
  zone; they go back into the deck, which is shuffled before you search for the Legion Mate. At
  the beginning of your next stand phase you put the Legion Mate into your soul or your drop zone,
  and the legion ends. That vanguard cannot Legion again while it stays on the vanguard circle.

## Play online (in testing)

Main menu → **Play Online**. One player hosts and the other joins, either with a shared **room
code** (easiest) or by **address** (same home network, port forwarding or Tailscale/ZeroTier). Both
players need the same version of the game. The host's PC runs the game; the guest only receives
what they may see. If the connection drops, the guest reconnects by itself for up to two minutes.
Online play is **still being tested**: please report anything that goes wrong. Full guide:
[docs/PLAYING_ONLINE.md](docs/PLAYING_ONLINE.md).

## Sleeves and playmats

Each deck can have its own **sleeve** (card backs) and **playmat** (battle background): Deck
Builder → **Sleeve & mat…**; Settings holds the defaults. Choose from the built-in designs, or add
your own pictures (for example of official sleeves and mats you own) in the Artwork Manager →
**Sleeves & playmats**, by importing files or downloading from an image link. Like card art, they
are for your personal use, never included in the download and never sent online (your opponent
sees your sleeve only if it is a built-in design). Details: [docs/ARTWORK.md](docs/ARTWORK.md).

## Download and play (Windows)

Requirements: Windows 10 or 11, 64-bit. Nothing else needs to be installed.

**Latest version: v0.26.0-alpha** — direct downloads:
[portable .exe](https://github.com/j246810smith-ux/VanguardSim/releases/download/v0.26.0-alpha/VanguardSim-0.26.0-alpha-portable.exe)
·
[zip](https://github.com/j246810smith-ux/VanguardSim/releases/download/v0.26.0-alpha/VanguardSim-0.26.0-alpha-win-x64.zip)

1. Open the [Releases page](https://github.com/j246810smith-ux/VanguardSim/releases).
2. Under **Assets** at the bottom of the release, download either
   - `VanguardSim-<version>-portable.exe` — a single file: run it, or
   - `VanguardSim-<version>-win-x64.zip` — unzip anywhere and run `Vanguard Sim.exe`.
3. Windows SmartScreen may warn that the app is from an unknown publisher (the builds are not
   code-signed). Choose **More info → Run anyway** if you trust the download.

Settings and saved decks are stored in your Windows user profile; deleting the program removes
nothing else.

**Card art:** the download contains no card images (the game is fully playable without them). To
get them, start the game, open **Settings → Open Artwork Manager** (or run
`"Vanguard Sim.exe" --artwork`), press **All**, then **Download missing images**: the images come
from the official Cardfight!! Vanguard card list and are placed and checked automatically. Card
images are © Bushiroad and for your personal use only; please don't share or upload them. Details:
[docs/ARTWORK.md](docs/ARTWORK.md).

### Card art (optional)

The game is fully playable without art: every card is drawn as a text card (name, grade, power,
shield). No card images are included. The **Artwork Manager** (Settings → Open Artwork Manager, or `"Vanguard Sim.exe"
--artwork`) downloads them from the official card list at the press of a button, or imports a
folder of images you already have, puts each under the right name, checks them and reports what is
missing; see [docs/ARTWORK.md](docs/ARTWORK.md). Or add them by hand:

1. **Find the `cards` folder** next to the program:
   - **zip download:** the folder you unzipped contains `Vanguard Sim.exe` and a `cards` folder;
   - **portable .exe:** create a folder named `cards` in the same folder as
     `VanguardSim-<version>-portable.exe`.
2. **Make one sub-folder per set**, named by the set code: `BT01`, `BT02`, …, `TD01`, …, `EB01`, ….
3. **Name each image by its card number**: the set code, a dash and the three-digit number, e.g.
   `BT01-001.png` (or `.jpg`). The game's card details (right-click a card) show the printed
   number, such as `BT01/001EN`: that card's file is `BT01-001.png`.
4. Restart the game. Cards with an image show it; the rest stay text cards.

```
Vanguard Sim\
├─ Vanguard Sim.exe
└─ cards\
   ├─ README.txt
   ├─ BT01\
   │  ├─ BT01-001.png
   │  └─ BT01-002.png
   └─ TD01\
      └─ TD01-001.jpg
```

Images are for your own personal use; please don't share or upload them (card artwork belongs to
Bushiroad). The same instructions are in `cards\README.txt` inside each release.

## Build from source

Requires Node.js 24 and npm 11 (Windows for the packaged app). In short:

```
git clone https://github.com/j246810smith-ux/VanguardSim.git
cd VanguardSim
npm ci
npm run check      # typecheck, lint, format check, all tests
npm run app        # build and start the desktop app
npm run dist:win   # build the Windows release into release/
```

Details: [docs/BUILDING.md](docs/BUILDING.md). Architecture and how to work on cards, effects and
the AI: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Releases: [docs/RELEASING.md](docs/RELEASING.md).

## Report a bug or suggest an improvement

Use [GitHub Issues](https://github.com/j246810smith-ux/VanguardSim/issues). For a wrong card or
rule, say which card (set and number, e.g. `BT08-016`), what happened and what the card text or
rule says should happen; the game's seed (shown in the game menu) lets us replay the game.

## Contribute

Pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md): fork, branch, make one focused
change, run `npm run check`, open a pull request.

## Licence

The source code of this project is licensed under the **GNU General Public License v3.0**
([LICENSE](LICENSE)). You may use, study, change and share it; distributed modified versions must
also be released under the GPL-3.0 with their source. The licence covers only this project's own
code: Bushiroad's card material is not licensed by this project. Bundled third-party software
keeps its own licences ([THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).
