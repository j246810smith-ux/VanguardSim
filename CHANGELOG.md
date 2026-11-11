# Changelog

## 0.36.0-alpha — 2026-11-11

### Battlefield 2.0

A new battle presentation over the same rules engine (docs/design/BATTLEFIELD_2_AUDIT.md). Two
**presentation profiles**: **Desktop** (Windows, the spacious stage) and **Mobile** (Android, the
compact landscape layout). Automatic picks Mobile on Android; Settings → Battle layout picks either.
Each profile keeps its own battle view, playmat and animated background (Settings → Profile settings).

- **Step-by-step battles** (on by default; Settings → Step-by-step battles): an attack's moments are
  shown in order on the board — the drive check card waits in the trigger zone before it reaches the
  hand, the damage check before the damage zone. Instant speed jumps straight to the result.
- **Battles on the field:** only Ride, Legion and (new) **Stride** take the whole screen. An attack
  lights the attacker, pulses the target's ring red, and ATTACK! appears between the power plates;
  drive and damage checks rise out of the trigger zone with the trigger's name and effect.
- **Guarding:** the cards you mark to guard are previewed on the defence plate ("marked +10000 ·
  GUARDED") before you press Guard.
- **Drag and drop with a finger** (and a mouse or pen): drag a hand card onto a glowing circle. A
  circle it cannot go to says so, with a red shake, and the card stays selected.
- **Desktop:** the tilted view is now a real 45°; a fixed panel on the left shows the battle history
  or the card you look at (the Card tab keeps it); attack and defence are one compact row beside VS,
  no longer over the damage zones; the hand moved left so a full action bar fits.
- **Mobile:** larger buttons for fingers, larger power numbers, the opponent's damage tile label
  fits, the Tilted (45°) view works on the phone, and the phone now shows your **playmat and
  sleeves** (it never did).
- **Backgrounds:** playmats in two groups, **Themed** (each with a gentle moving layer) and
  **Classic** (two new plain mats: Tournament Blue, Slate Felt), with a preview in Settings.
  Moving backgrounds are on for Desktop, off for Mobile, and never with Reduced motion or Low graphics.

### New cards

**Expanded Era: G-BT06 "Transcension of Blade & Blossom"** (104 cards) — Royal Paladin, Shadow Paladin, Nova Grappler, Pale Moon, Granblue and Neo Nectar, with **Brave**, **Bloom**, **Rush**, grades that change in the deck, units moving to the guardian circle and Air Elemental, Twitterun.

**G Trial Decks G-TD06, G-TD07 and G-TD08** (57 cards) — Gear Chronicle, Pale Moon and Granblue, each ready to play exactly as sold, with the new **Hollow** ability (Granblue).

## 0.35.0-alpha — 2026-11-09

- **Play Online on Android** (in testing): host or join a friend's game by **room code**, phone
  against phone or phone against PC: START BATTLE → Play Online. Connecting by address stays on
  Windows. The online battle uses the phone layout.
- **Update the Android app from inside it:** Settings → Updates → **Check for updates**, then
  **Download and install**. The game downloads the new version from GitHub, checks it, and Android
  asks you to confirm the update (the first time, allow Vanguard Sim to install apps). Your decks,
  settings and card art are kept.

## 0.34.0-alpha — 2026-11-09

- **Android: download card art in the app.** Settings → Card artwork → **Download card art**: all
  cards, the Original Era or the G era, straight from the official card list to your phone, with
  progress and Cancel; Download again carries on where it stopped. Same checks as the Windows
  Artwork Manager (docs/INSTALL_ANDROID.md).

## 0.33.0-alpha — 2026-11-08

**Now on Android:** a signed APK on the release page — how to install it:
[docs/INSTALL_ANDROID.md](docs/INSTALL_ANDROID.md).

**New home screen** (docs/design/HOME_SCREEN_PLAN.md) — a blue fighter and a red rival at the
sides, a holographic field in the middle, **START BATTLE** (opens New Game, Play Online and CPU
Demonstration) and **Decks / Card Database / Settings** along the bottom. The art is cropped from
the owner's own art pack. Quiet animations (moving sparks, the field's energy line), off with
Reduced motion or Low graphics and paused while the game is in the background.

- **Your profile** (top left): a name and an avatar, kept on this device. The name is the one Play
  Online shows your opponent. Six portraits and six emblems to choose from.
- **Card Database:** every card with the Deck Builder's search and filters; tap a card for its details.
- **Menu** (top right): Updates, Report a Problem / Suggest Something, Quit.
- **Phone, card details:** the text is about twice the size, easier to read.
- **Phone, battle screen:** the Card Info panel and its buttons are gone (tap or hold a card for its
  details), the left side is narrower with a smaller log and menu, and the field is up to 10% larger.
- **Phone, battle screen (2):** your soul, drop and deck are larger, and the hand at rest is larger and
  fully on the screen.
- **Game Setup scrolls** when it is taller than the screen, so every button can be reached on a phone.

## 0.32.0-alpha — 2026-11-08

**New sounds and battle music** (docs/audio/AUDIO_PLAN.md) — every sound effect is now a real
recording (89 sounds from Kenney's free CC0 packs, docs/audio-licenses/), subtle and short: cards
land with a crisp place and a small shimmer when their slide arrives, rides rise and land heavier,
strides swell, guards pulse, hits punch, checks flip. Two battle themes (the owner's own tracks)
play at random each battle, loop without a gap and fade in and out.

- **Settings → Audio:** Master, Card actions, Battle effects, Interface, Music and Ambient volumes,
  each with its own Mute; Mute all, Test sounds, Reset to defaults. Your old effects volume carries over.
- **Settings → Audio → Battle music:** Random or one track. **Your own music:** put MP3, OGG, M4A or
  WAV files in a `music` folder next to `cards` and they join the list (they stay on your PC).
- Buttons click; refused moves make one soft sound; online, a repeated update never plays twice.

**House rules** (Game Setup, off by default):

- **9K Grade 3** (Original era): a vanguard with printed grade 3 and printed power exactly 9000 gets
  +1000 power on the vanguard circle (press again for +2000). D-040.
- **Mega Blast CB4 & SB6**: an ability costing Counter Blast 5 & Soul Blast 8 may be paid with Counter
  Blast 4 & Soul Blast 6; you choose when you could pay both. D-041.
- **Game menu → House rules** lists the rules of the game you are in, on or off, with their values.

**Your feedback (v0.32 list):**

- **Guarding:** a hand card is marked first (gold outline); click it again or Clear to take it back;
  "Guard +N" places them.
- **"Pay the cost?"** questions say which unit they are about, and that unit glows (four Sulfur
  triggers can be told apart).
- **Superior Calls** from effects use the same circle map as a normal call, showing the card.
- **Game menu → Trigger ratio:** your deck list's triggers and how many are left in your deck now
  (exact; never the opponent's deck). The deck builder shows the trigger share too.
- **Final Turn!** — declare it once per turn in your main or battle phase; the CPU may declare it.
  Cosmetic only.
- **Deck builder:** ◀ Previous / Next ▶ (and the arrow keys) in a card's details, through the search
  results or your deck.
- **Overhead view:** the playmat reaches all four corners.
- **CPU Demonstration:** Back and Start line up.
- **Settings → Theme:** Classic, OverDress Modern, G Era Holo, Royal Futuristic, Anime Cel-Shaded and
  Dark Premium. Only colours change.
- **Settings → App icon:** five icons for the window, the taskbar and a desktop shortcut.
- **Settings → Graphics:** Full, Reduced or Low (Low turns off foil and cut-ins, flat table).
- The deck builder's questions use the game's own dialog. Hover effects only apply to a real mouse.
  Music and sounds stop while the window is minimised.

**Android (in testing, not in this download)** — the same game on phones, built from the same code
(docs/android/BUILDING_ANDROID.md): a landscape phone layout of its own (docs/android/
MOBILE_UI_PLAN.md) with a compact opponent field that opens on a tap, Card Info, a phase bar, a hand
that opens large on a tap, the log as a side drawer; touch controls, long press for details, the back
button, deck backup, card art and music copied from the PC (`npm run artwork:phone`). Settings →
Battle layout chooses Automatic, Desktop or Phone (Windows stays on the desktop table).

## 0.31.0-alpha — 2026-11-06

**G Trial Decks G-TD03, G-TD04 and G-TD05** (57 cards) — Neo Nectar, Aqua Force and Link Joker, each ready to play exactly as sold.

**G starter decks** — eleven ready-to-play decks in the Expanded Era's deck list, one for each clan of G-BT03 to G-BT05 without a G Trial Deck. These are our own builds, not official products.

**Expanded Era: G-BT03, G-BT04 and G-BT05** (312 cards) — with their new mechanics: **Time Leap**, **Oracle**,
**Thunderstrike** and **Magia**; cards returning to the G zone and placed as hearts; healing and calling from
the damage zone; One Strike Two Hits Djinn's attack on a vanguard and a rear-guard; Dogetts' Legion cost.

**Fixed:** cards rewritten after the G era kept their later shield. Bringer of Dreams, Belenus and Heart Thump
Worker (G-BT02) now have shield 10000, as in the G era, and so do the same cards in the new sets.

**PR cards 2014** (66 cards, set `PR14`) — the rest of the Original Era's PR lists: Legion pairs such as
**Seeker, Light Saver Dragon** and **Light Blaze Dragon**, **Goddess of the Treasured Mirror, Ohirume**,
**Machining Tarantula mk II** and **Gust Blaster Dragon**. 22 cards never printed in English carry a marked
unofficial translation. Generation Break abilities on these cards only work in the Expanded Era. Three true
G-era cards on the list (Harmonics Messiah, Heat Elemental Magum, Steam Fighter Mesh-he) wait for the
Expanded Era's own PR cards.

**PR cards 2013** (50 cards, set `PR13`) — every new card from the official 2013 PR list, playable
in both eras: **Sanctuary of Light, Brightness Dragon**, **Goddess of Law, Justitia**, **Seal Dragon,
Georgette**, **Gravity Bolt Dragon**, **Fearless Jewel Knight, Julia**, **Revenger, Deathmaster Dragon**
and more. Eleven cards never printed in English, including the GARO and DAIGO collaboration cards, carry
a marked unofficial translation. New in the engine, for these cards only: a unit that takes on another
card's name until end of turn (Thousand Name Wyvern Knight) and a search for "the same card name as one
of your <clan> units" (Maiden of Venus Trap Muse).

## 0.30.0-alpha — 2026-11-06

**You can now see the card when you look at the top of your deck.** "Look at the top card of your deck,
and put it on the top or the bottom" (CEO Amaterasu, Battle Sister Cocoa and others) used to ask without
showing the card. The prompt now shows it, to you only.

**Pictures on the deck:** a card put on the top or bottom of a deck now shows on the pile, tagged TOP or
BOTTOM, until it leaves the deck or the deck is shuffled. You see your own cards. An opponent's card shows
only if it came from a public zone or was revealed.

**Hard AI, improved by watching it play itself.** It no longer takes a lethal hit with guards in hand: it
would refuse to play its last card able to guard, and would give up when it thought the game was lost. It
also finishes a guard of several cards, stops putting units that cannot boost in the back row, takes early
hits instead of spending guards, spends less guarding rear-guards, always boosts, focuses the vanguard as
you near 6 damage, holds weak attackers until its drive check, prefers its Limit Break grade 3 when riding,
and now works out what your next attack can do. **Measured:** the fixes beat the previous Hard AI 54.8% of
1,260 games (about 52–57.5%) on the tournament decks, a real but modest gain, and work continues. The AI
can also use the card it looks at, which it could not see before.

**Card fix:** Bringer of Dreams, Belenus and Heart Thump Worker (G-BT02) have 10000 shield, as in the G era,
not the later 15000.

**Online:** v0.30 cannot play v0.29 or earlier, because the card data changed.

## 0.29.1-alpha — 2026-11-04

**Tournament decks:** event and placing only. Player names are gone from deck titles and data, and a
deck's source link is now the source's archive for that month. No card or count changed.

**Update Manager:** a download whose connection stalled at exactly the wrong moment could hang instead
of giving up; it now gives up, and carries on next time. Installing retries for a moment if its updater
file is briefly locked.

## 0.29.0-alpha — 2026-11-04

**Tournament decks** (first part of the Deck Intelligence project, `docs/deck-intelligence/`): Game
Setup and CPU Demonstration now offer 20 decks under **TOURNAMENT DECKS**, 19 of them real tournament
lists from 2011–2014 with exact card counts, among them the 2013 national champion's Raging Form and
the top decks of 2013 and 2014. Each shows only what its source states. They cover 10 of the 23 clans;
the starter and trial decks stay until all clans are covered. Each deck also has a written strategy
profile in the project's data; the screens to read them are still to come.

**Hard AI, two experiments, neither switched on:** looking ahead through the next turn won 34.2% of
424 games against the current Hard AI, and using a deck's strategy profile won 50.0% of 420. The Hard
AI in the game is unchanged.

**Update Manager (stage 1, D-037)** — Settings → **Open Update Manager**: your installed version,
the newest release on GitHub with its date and release notes, **Check for Updates**, an **Update
channel** (Stable, or Preview for early builds), **Open Download Page**, and what to do with the
zip or the portable exe. **Check when the game starts** is off by default (the game stays
offline); when on, a notice on the main menu says when a new version is out, never during a match.
Installing from inside the game comes in a later stage.

**Update Manager (stage 2, D-037)** — developer side, nothing changes in the game yet: releases can
now carry a signed list of their files, and the game can check that signature. A normal update will
be a download of about 1.4 MB instead of 154 MB.

**Update Manager (stage 3, D-037)** — **Download Update** fetches a new version in the background of
that screen and checks it against its signed file list, with progress and **Pause**; an interrupted
download carries on where it stopped. It needs a release with a signed list, and installing it from
inside the game comes in stage 4. Your game folder is not changed.

**Update Manager (stage 4, D-037)** — **Install and Restart** closes the game, installs the update
and opens the game again; the main menu says how it went. What it replaces is backed up first, so a
failed or interrupted update puts your previous version back by itself, and **Go Back to This
Version** does the same on request. Your decks, settings, card art, sleeves and playmats are never
touched. It works from the first release that includes the updater: that one is installed by hand.

**Update Manager (stage 5, D-037)** — if an update ever changes how decks and settings are saved, they
are upgraded at start with a copy kept first; a failure changes nothing, and going back a version puts
the old data back. Developer side: tests over several releases in a row, `npm run release:verify`, and
a release guide in `docs/RELEASING.md`.

**PR cards 2012** (38 cards, set `PR12`) — every new card from the official 2012 PR list, playable
in both eras: **Exculpate the Blaster**, **The Dark Dictator**, Knight of Afterglow, Gerard, Turbulence
Dragon and more. Eight cards never printed in English, including the collaboration cards Spider-Man
and Kumamon, carry a marked unofficial translation. New in the engine: an attack on all of the
opponent's units, back row included, and "you cannot normal ride this card". Silvest is always legal
despite its printed deck date, and Baron Kiddani's bonus never applies, because no fighter is him.

**Report a Problem / Suggest Something** — a button on the main menu and in Settings opens GitHub's
new-issue page in your browser with your version filled in. The game sends nothing itself; you write
and post it there. It needs a free GitHub account, and posts are public.

**G era: G-BT02 "Soaring Ascent of Gale and Blossom"** (103 cards, D-034): Royal Paladin, Narukami,
Gear Chronicle, Aqua Force, Great Nature, Neo Nectar and Cray Elemental cards, legal in Expanded Era
games and in the Deck Builder. New in the engine: **Resist** (your opponent's effects cannot choose
the unit), attacking from the back row (Battle Siren, Stacia), an [ACT] that loses its cost once
(Dragonic Kaiser Crimson), "for each open (RC)", and searches for a copy of each chosen unit
(Primavera). Shared G-era ability shapes moved to `src/cards/gShapes.ts`. Test fixtures `unitAt` and
`gAttack` now use the Legion Leader on a legion's (VC).

**The Blaster Blade Burst deck** (user's request): the "Cardfight!! Vanguard 0" Start Set, set `VZ01`.
Two new cards, Blaster Blade Burst and Claudia (marked unofficial translation), plus 17 cards already
in the game, and a new starter deck, **Royal Paladin — Blaster Blade Burst**. The official list gives
no copy counts, so the deck's counts are our own build.

**PR cards, 2011** (39 new cards, set `PR11`, ids like `PR11-0003`; roadmap in
`docs/design/ORIGINAL_ERA_ROADMAP.md`): legal in both eras and in the Deck Builder. Scripted and tested, with
official English text wherever an English printing exists, including those inside English boosters
(Conjurer of Mithril in BT05, Dragon Armored Knight in EB03). Two cards were never printed in English
and carry a marked unofficial translation: Graimu and Blaster Keroro. The 12 reprints in the list are
recorded against the cards already in the game. The Artwork Manager handles PR art and file names.

## 0.28.0-alpha — 2026-11-03

**v0.28: player feedback on v0.27** (user's spec, 2026-11-03; audit in
`docs/design/V028_AUDIT.md`). Also in this release: **G-era card art, G-BT01 and the Dear
Days–style Deck Builder** (below).

**CPU Deck Demonstration** — main menu → **CPU DEMONSTRATION**:

- Pick a deck for CPU 1 and CPU 2 (any starter, trial or saved deck legal in the format; the same
  deck twice is fine; **Swap decks**), the format, each side's AI (Easy / Normal / Hard), a seed
  and the speed, then watch the two CPUs play each other with the normal rules and AIs.
- You only watch: both hands are shown, nothing you click is played. The action bar becomes
  **Pause / Resume**, **speed** (Normal → Fast → Very fast, which skips the cut-ins), **Restart**
  (the same game again), **Decks** (back to the selection) and **History** (the full log). The
  log and banners say CPU 1 / CPU 2, and each CPU's "thinking" badge sits over its own hand.
- At the end: a summary with the winner and loser deck, how it was won, turns, time, seed, both
  sides' damage, cards left in the deck, hand and shield in hand, and the key moments (triggers
  and hits), with **Watch again**, **New seed**, **History** and **Decks**. It says what one game
  can't: which deck is stronger.
- The same seed with the same decks and AIs plays the same game again (tested).

**Formats: Original Era and Expanded Era** — the formats are now called **Original Era**
(BT01–BT17 and the side sets: no G units, Stride or Generation Break) and **Expanded Era**
(Original Era plus the G era, in testing) everywhere: Game Setup, the Deck Builder, the battle
screen (the era is always named under the turn label) and the demonstration. Legality is
enforced by the deck rules, not hidden in the menus. Game Setup remembers the last format.

**The Seed explained** — a **?** next to Seed in Game Setup explains it: the seed decides who
goes first and every shuffle (so also which cards come up in checks); both players share it;
blank = a new random game; the same seed with the same decks and the same choices deals the same
game. Any word now works as a seed (before, text was ignored), and each game's seed is the first
line of its log. An online guest is never sent the seed (it would reveal every shuffle).

**Original Era content roadmap** — `docs/design/ORIGINAL_ERA_ROADMAP.md`: 292 PR printings from
2011–2014 checked against the game: 77 are reprints already in it, 215 new cards to add in four
yearly batches. The "Blaster Blade Burst" deck could not be identified (no product of that name):
waiting for the exact product or list.

**Battle screen layout and settings:**

- **Battle view: Overhead (90°) or Tilted (45°)** — Settings → **Battle view**. Overhead shows
  the board flat from above, like before 0.27, and is now the default; Tilted is the Dear Days
  table. Cut-ins, power plates and flying cards work in both.
- **Screen shake** is its own setting (Settings → Screen shake when an attack hits), **off by
  default**; the hit banner and flash still play.
- **Settings scroll**: the list scrolls, BACK always stays visible, and Esc goes back.
- **Decision panels go in the middle of the board** when that hides nothing that matters (cards,
  glowing circles, the ability box beside the guardian circle, the battle display); otherwise
  they dock on the right as before.
- **Phase action guide** beside the current phase on the left rail (it used to sit bottom right),
  and a tooltip on every phase saying what it is for.
- **"Opponent is thinking"** now sits over the opponent's hand, with three pulsing dots, and
  goes as soon as the AI has acted.
- **Card preview** moved lower left (it was at the top left beside the opponent's piles); the
  turn label and phases moved up into that space.
- **Calling a rear-guard**: the card menu shows your circles laid out like the board (front
  left, VC, front right / back left, centre, right); open circles, occupied ones (the unit there
  is retired) and circles you can't use are told apart.
- Empty rear-guard circles no longer say "REAR-GUARD".

**G era: card art and G-BT01 "Generation Stride"** (user's request, 2026-11-03; D-034).

- **Card art for the G era:** the Artwork Manager's built-in official source downloads G sets
  (checked: all of G-TD01, G-TD02 and G-BT01, no failures); G sets are listed last.
- **G-BT01** (103 cards: Gear Chronicle, Royal Paladin, Oracle Think Tank, Kagero, Nova
  Grappler, Cray Elemental), legal in the G format, every card scripted and tested.
- Engine additions for it: costs that turn a face-down G unit in the G zone face up, "face up
  cards in your G zone" counts, stride fodder (grade +2 while paying a stride cost; the stride
  prompt shows those grades), "[Stand] due to an effect" and "put into the deck" triggers, "from
  one of your other cards", drive -1, "from all clans", "a G unit on your (VC)", "power less than
  or equal to that unit's".
- **MBT01** needs nothing new: its 50 cards are already in the game as the English-only BT16/BT17
  cards. Its G unit insert (Harmonics Messiah) is left out (no verified G-era text).
- **Deck Builder, Dear Days style** (user's request; D-036): the whole deck as cards on the left
  (main deck sorted by grade, starting vanguard marked ★) with a **G deck** row for G-era decks,
  the card pool on the right. **Original Era / Expanded Era** switch per deck (saved with it;
  Expanded Era decks appear in Game Setup's Expanded Era). **Search narrows as you type**: every word must match (name,
  number as printed e.g. `BT01/001`, clan, race, set or text), name matches first; **Enter** adds
  the top card, **Esc** clears; the pool draws 140 cards at a time ("Show more"). Click a deck
  card to remove it. All earlier options kept (filters, save, load, import/export now with the G
  deck, sleeve & mat, test hand, details on right-click).

## 0.27.1-alpha — 2026-11-03

**Fix: the joining player's screen went blank online** (user's report, 2026-11-03). When the
host made a drive check, the checked card had already gone into the host's hand by the time the
guest's game drew it, so the guest's game tried to draw a hidden card and the whole window went
blank. The same bug was in 0.26.0.

- The drive/damage check now carries the revealed card, so the guest sees the host's checks
  properly (both players should update: a 0.27.1 guest playing a 0.27.0 or 0.26.0 host no longer
  goes blank but shows those checks as a card back).
- A hidden or unknown card is drawn as a card back instead of crashing the screen.
- **Crash guard:** if the screen ever hits an error again, it shows a message with **Keep
  playing** (draws the screen again; the game carries on) and **Main menu**, instead of going
  blank.
- `npm run online:probe` can now play whole turns with attacks (`VANGUARD_ONLINE_SECONDS=200`),
  watching both windows for errors and a blank screen.

## 0.27.0-alpha — 2026-11-03

**The G era, part 1: rules engine and the first two G Trial Decks** (D-034, user's request). The
G era is a second format next to Classic; Classic games are unchanged.

- **G era is in testing**: Game Setup → **Format: G era (IN TESTING)** against the AI, with the G
  Trial Decks (or Classic decks, which are legal there too). The board shows each **G zone**, a
  **STRIDE** step on the phase rail and a "G ERA · IN TESTING" tag; **Stride** (choose the G unit
  and the hand cards to discard, the cheapest discard picked for you) and **G Guardian** (choose
  the G guardian and the heal trigger to discard) are buttons in the action bar. Not yet: G decks
  in the Deck Builder, hearts drawn under the G unit, online G games (online stays Classic).

- **G format** (Comprehensive Rules ver. 1.48.1, April 2018): every Classic card plus G cards, a
  G deck of up to 16 G units, the G zone, **G Assist**, the **stride step** (discard grades totalling
  3 or more to stride a G unit over your grade 3; it gains the heart's name and power and has
  Triple Drive), **Generation Break**, **G guardians**, G units back to the G zone at end of turn,
  and "you get an additional turn".
- **G-TD01** (Gear Chronicle, Chronojet Dragon / Mystery-flare Dragon) and **G-TD02** (Royal
  Paladin, Blue Sky Knight, Altmile / Shrouded Divine Knight, Gablade): 38 cards, all scripted and
  tested; both decks as sold (50 cards + 2 G units).
- Cards later rewritten by Bushiroad ("Updated: Text") play with their G-era text, taken from the
  archived official card pages.
- The basic and smart AIs stride, G-guard and use G Assist.

**A Dear Days–style battle screen** (D-035, user's request). Presentation only: rules, cards and
the AI are unchanged.

- **Tilted 3D table**: the field, zones and playmat lie on a table seen at an angle, your side
  near and large, the opponent's far. Zones sit like on a real mat: damage in a column of sideways
  cards on each player's left; trigger, soul, drop and deck on their right. Moving cards fly over
  the table.
- **Cut-ins**: ride and superior ride (a band in your colour with the card sliding in), legion,
  attack (a slash with attacker → target), drive and damage checks large in the middle with a
  trigger burst, a table shake on a hit. **Settings → Battle cut-ins: Full / Short / Off** (Short:
  quick ride/legion cut-ins and the side check panel; Off: only the small banners).
- **Power**: bold power plates that stand up from the cards; an **ATTACK vs DEFENCE** display on
  the centre line during battles (boost, shields, how much shield still stops the hit).
- **Fighter banners** with six damage pips; the hint line moved above the buttons and the attack
  power panel to the top right.
- **Brighter look**: a lit arena instead of a black background, lighter panels, and a new bright
  default playmat **Daybreak Arena** (the old dark one is still there as Vanguard Night).

## 0.26.0-alpha — 2026-10-30

**Play Online is back, in testing.** It now has room codes and reconnecting, and has been tested
on one PC and through the room-code service, but not yet widely between different homes and
networks: please report problems. How it works: [docs/PLAYING_ONLINE.md](docs/PLAYING_ONLINE.md).
Players on v0.25.0 cannot play players on this version.

- **Bigger decks on the battle board** (user's request): both decks show a larger card back
  (64×93, closer to the units) with the card count over its corner; the tiles beside them and the
  zones below moved a little to make room.
- **Card sleeves and playmats** (D-033, user's request): each deck can have its own sleeve
  (card backs) and playmat (battle background), chosen in the Deck Builder (**Sleeve & mat…**);
  Settings holds the defaults. Choose from 10 built-in sleeves and 7 playmats, or add your own
  pictures (for example of official sleeves and mats you own) like card art: Artwork Manager →
  **Sleeves & playmats**, kept in `sleeves\` / `playmats\` next to the game, never shipped or
  sent online. Every card back on the board shows its owner's sleeve. **Download from a link**
  saves a sleeve or mat picture from an image address you paste (e.g. an official product page).
- **Play Online is switched on (in testing)** in the main menu (user's request, 2026-10-30),
  with room codes and reconnecting below. Player guide: `docs/PLAYING_ONLINE.md`.
- **Play Online: room codes** (D-032, user's request): both
  players type the same code (or press **New code**, e.g. STORM-4821-RAVEN) and press Host or
  Join: no addresses, port forwarding or Tailscale needed. The free PeerJS service introduces the
  two games (it only ever sees a hash of the code), then they talk directly (WebRTC), falling back
  to PeerJS's relay when a network blocks direct connections. The game's network block lets the
  PeerJS service through only while hosting or joining by code. Connecting by address is still
  there (**Connect by address instead**). `npm run online:probe -- --code` tests it.
- **Play Online: reconnecting** (D-032): a dropped connection no
  longer ends the game. The guest reconnects by itself for up to 2 minutes (banner with **Stop
  and leave**); the host keeps the game, sees a banner, and after 60 s may **End the game as a
  win**. Rejoining needs the token the host gave at the start, so nobody else can take the seat.
  Leaving on purpose tells the other player straight away. Each player's built-in sleeve is shown
  to the other. Online protocol 2 (both players need this version). `docs/ONLINE_PLAY.md`.
- **EB12 "Waltz of the Goddess"**: all 35 cards (Genesis Regalia, Witches and Myth Guards)
  implemented and tested, with art, and a "Cosmic Regalia, CEO Yggdrasil" starter deck. New:
  searches for "cards with different card names" (Myth Guard, Procyon).
- **Unofficial English for the Japanese-only cards** (user's request): FC01's Mighty Spear
  Liberator, Bleoberis; Eradicator, Electric Shaper Dragon; Story Teller; Peerless Scribe, Ponga;
  and BT11-055 Hazard Bob.
  Name and text follow the official English templates; Card details marks them "Unofficial
  translation". Kept apart from the official data (`data/translations/unofficial.json`), used only
  when a card has no English record (also by the card generator).
- **EB11 "Requiem at Dusk"**: all 35 cards (Shadow Paladin witches and revengers) implemented and
  tested, with art, and a "Mesmerizing Witch, Fianna" starter deck. New: the witches' "your
  opponent calls a grade 0 to the (RC) you chose" (a superior call limited to chosen circles,
  `circlesOf`), counting your opponent's grade 0 rear-guards. The ability callout names the card's
  owner while the opponent makes a choice for your ability.
- **Ability callout beside the G circle** (user's request): whenever an ability is used — yours
  or the opponent's, in the battle phase or when a unit is called or ridden — a box on the centre
  line next to the G circle shows a small picture of the card, its name, what you have to do now
  (the goal) and the ability's text, and the card itself glows gold on the field or in the hand.
  It stays up while the ability waits for a choice (e.g. paying a cost) and shows briefly for
  abilities that need none. The left attack/defence number moved out a little to make room.
- **Clearer cost prompts**: "Pay counter blast 1: choose 1" now reads "Counter Blast 1: choose 1
  face-up damage card to turn face down" (likewise Soul Blast, discard, retire, rest, lock), and
  "Pay the cost?" names the cost: "Pay the cost (Counter Blast 1, Soul Blast 1) to use this
  ability?".
- Fix (user's report): the installed game showed placeholder art for the 85 English-only
  BT16/BT17 cards (Dragonic Overlord the Great, the Deletors, …). Their art files
  (`BT17-001EN.jpg`) were installed, but the desktop app only served file names without the "EN";
  it now serves them (`app/main/artPath.cjs`, test `tests/artwork/artPath.test.ts`).

## 0.25.0-alpha — 2026-10-29

- **FC02 "Fighter's Collection 2014"**: all 29 cards (27 grade 3 vanguards, one per clan, and the
  two Legion mates Locrinus and Lisei) implemented and tested, with art. New engine pieces: "drive
  check+1" (Great Daikaiser), units gaining Boost/Intercept (Halcion), "placed on (RC) due to an
  effect from one of your cards" (Elvira; superior calls now record who called), searching for
  "the same card name as that unit" (Kasumi Rogue). The card generator splits the English FC02
  text, which has no line breaks between abilities. No starter deck: the cards span every clan.
- **Back-centre circle kept clear when calling** (user's report): the selected card's menu (name,
  "Drag to a glowing circle", Ride, Activate, Card details) opened over the back-centre rear-guard
  circle; it now sits in the right column above your trigger check zone, like the other prompts.
  A selected or hovered hand card lifts less (its top edge stays below the circle; the large hover
  preview still shows the card). `npm run ui:shots` now also captures the menu.
- **DG01 "DAIGO Special Set"** (Japanese-only product): all 17 cards, with a Royal Paladin
  "Sanctuary Guard Dragon" deck. 10 are reprints; the 7 new cards (Sanctuary Guard Dragon,
  Constance, Olwen, Urien, Rendgal, Rainbow-calling Bard, Ambrosius) use the official English text
  of English Mega Trial Deck MT01, which printed them under the same numbers.
- Fix (user's report): the Artwork Manager's **Import a folder** read English file names by the
  Japanese number. English BT03–BT06, BT16, BT17 and EB03 number 422 cards differently, so
  `BT16_004EN.jpg` (Prominence Core) went onto Japanese BT16-004 (Wild Rush Dragon). Names ending
  in "EN" are now looked up by their English printing; an English-only card the game does not have
  (`BT03_026EN`, Bloody Calf) is reported instead of guessed. Downloaded art was never affected.
  (`BT17-001` and `BT17-001EN` are two different cards: Japanese BT17 001 and the English-only
  Dragonic Overlord the Great.)
- **Play Online (stage 1, D-032), built but switched off in this release**: the main menu shows
  PLAY ONLINE greyed out ("Coming soon") until it is ready for players (`ONLINE_READY` in
  `app/renderer/App.tsx`). What is built: play a friend over the network. One player hosts from the
  main menu's Play Online screen and reads out an address; the other joins with it. Works on the
  same home network, with port forwarding, or over Tailscale/ZeroTier. Both players need the same
  game version. The host's game runs the rules; the guest is sent only what they may see (card
  ids are random per game, deck order is hidden, the opponent's choices are not sent). Rematch and
  Leave on the result screen. The game window itself stays offline; the connection is opened by
  the desktop app only when you host or join. Not yet: reconnecting, a turn timer, chat.
- **FC01 "Fighter's Collection 2013"** (Japanese-only product): all 26 cards. 18 are reprints
  and show the English text of the original card; Wisdom Keeper Metis, Pretty Celeb Charlotte,
  Dandelion Musketeer Mirkka and Water General Benedict use the official English text of their
  later English printings (EB12, PR cards); Bleoberis, Electric Shaper Dragon, Story Teller and
  Ponga were never printed in English and keep their Japanese name and text (user's choice of the
  recommended option, like Hazard Bob). No starter deck: the new cards are spread over eight clans.
  New engine condition "if your deck had been shuffled by your card's effect this turn".
- Fix: cards printed only in Japanese (Hazard Bob, BT11-055) had their clan and race in Japanese,
  so "Genesis" filters and Lord did not recognise them. They now use the English clan and race.
- **Deck order shown** (user's request): when you put cards on the top or bottom of your deck in
  any order, the prompt shows a numbered strip of the cards placed so far, which card you are
  choosing next, and which end is the top or bottom card. The battle log now has a line for every
  card put on the top or bottom of a deck ("You put … on the bottom of your deck"); the
  opponent's cards from their hand or deck stay unnamed. Engine: `CARD_MOVED.position` and
  `PendingChoice.order`.
- **Limit Break checked** (user's request): a new test checks every card's scripted Limit Break /
  Ultimate Break against its text (no mismatches), and rules tests cover [CONT] (switches on and
  off as damage changes, face-down damage counts), [ACT] (LB5 needs five), [AUTO] (does not
  trigger at three; once triggered it resolves even if the damage drops, CR 10.2.5.3.2.1), and
  an effect that puts a deck card into the damage zone at three damage enabling Limit Break at
  once.
- **Break Ride outside the ride phase** (user's request): confirmed that a ride by an effect in
  the main phase (Cruel Dragon onto Dauntless Drive Dragon) triggers Break Ride; regression test
  added.
- **EB10 "Divas Duet"**: all 35 cards implemented and tested, with a Bermuda Triangle "Duo
  Flower Girl, Lily" deck. The "Duo" cards return to the hand and come back: Lily calls a fresh
  copy of a returned unit from the deck, Iori fetches two, Reit stands again after discarding two
  "Duo" cards of the same name, and Thames, Peace, Cikola and Tangariro turn damage face up when
  you reveal three of their name.
- Card importer: EB10 prints every card twice (black "B" and white "W" art, `EB10/001B`,
  `EB10/001EN-W`); the B printing is the base and the W one an alternate printing. English names
  written with "&hearts;" (PR♥ISM-Duo) are decoded.

## 0.24.0-alpha — 2026-10-28

- **EB09 "Dragonic Overlord The Re-birth"**: all 35 cards implemented and tested (21 reprints),
  with a Kagero "Dragonic Nouvelle Vague" deck. New: the first **grade 4** card (rides onto a
  grade 3; the deck builder lists grade 4), a continuous "your opponent's trigger effects are
  nullified", and the condition "if this unit's [Critical] is two or more".
- **EB08 "Galaxy Fighters"**: all 35 cards implemented and tested (16 are reprints), with a Nova
  Grappler "Galaxy Blaukluger" deck.
- **English-only BT16/BT17 cards (D-031)**: the 85 cards that English "ver.E" BT16/BT17 printed
  but Japanese BT16/BT17 did not are now in the pool, with their English number as id
  (`BT16-001EN`): the Deletors, Brawlers, Seekers, Liberators, Perdition Dragons and Star-vaders,
  including Light Source Seeker, Alfred Exiv and Dragonic Overlord the Great. Brawler, Wild Rush
  Dragon can now Legion with Brawler, Wildfist Dragon. New starter deck: Link Joker "Juxtapose
  Deletor, Zaele".
- **Delete** (CR 1.36 10.1.25): a deleted vanguard has power 0 and no text until its owner's end
  phase; shown face down with a DELETE band, explained in card details and the battle log.
- BT03: Spiral Master, Herbivorous Dragon Brutosaurus and Victory Maker are **draw** triggers
  again, as in Japan (user's choice; they were English critical triggers since D-020).
- Card tools: `tools/cardgen/similar.py` finds the most similar already-scripted card for each new
  card; the importer, validator and status report handle English-only cards; art files named
  `BT16_001EN` go to the English-only card.
- **Foil effect by rarity**: R cards get a passing sheen, RR a faint rainbow as well, RRR moving
  holo bands and a gold edge, and the ЯЯЯ card a red/violet holo; C and TD cards stay plain.
  Stronger on a hovered hand card and in the large previews. Settings → "Foil effect on rare
  cards" turns it off; it nearly stops under Reduced motion.
- Battle screen: your back row sits a little higher and the hand a little lower, so a hovered
  hand card no longer covers the back-centre rear-guard circle.
- Battle screen: nothing pops up over the back-centre rear-guard circle any more. The hint line
  and the yes/no, circle and "choose" prompts sit in the right column just above your trigger
  check zone, and drive/damage check pop-ups appear compact over the checking player's trigger
  check zone.

## 0.23.0-alpha — 2026-10-24

- **Delayed Legion (custom rule, D-030)**: a new toggle on Game Setup, off by default. With it
  on, Seek Mate's cost must be four normal units without Sentinel, the deck is shuffled before
  the search, and at the start of your next stand phase you put the Legion Mate into your soul
  or drop zone (the legion then ends). Saves and replays keep the setting. Standard games are
  unchanged.
- **EB07 "Mystical Magus"**: all 35 cards implemented and tested, with an Oracle Think Tank
  "Hexagonal Magus" deck. New: "declare a card name, and reveal the top card of your deck" (a
  name choice in the UI; the AI declares the name it has seen fewest copies of) and "put the
  rest on the top of your deck in any order". The battle log now shows declared names and
  revealed cards.

## 0.22.0-alpha — 2026-10-14

- **Side sets begin (D-029): EB01 "Comic Style Vol.1"**: all 35 cards implemented and tested,
  with a Nova Grappler "Perfect Raizer" starter deck.
- **EB02 "Dazzling Divas"**: all 35 cards, with a Bermuda Triangle "Top Idol, Riviere" deck. New
  trigger: "when this unit is returned to your hand from (RC)".
- **EB03 "Cavalry of Black Steel"**: all 35 cards, with a Gold Paladin "Spectral Duke Dragon" deck.
- **EB04 "Infinite Phantom Legion"**: all 35 cards (mostly Nova Grappler reprints), with a
  "Death Army Cosmo Lord" deck.
- **EB05 "Celestial Valkyries"**: all 35 cards (mostly Oracle Think Tank reprints), with a
  "Battle Sister, Fromage" deck.
- **EB06 "Dazzling Divas II"**: all 35 cards, with a Bermuda Triangle "PR♥ISM-Promise, Labrador"
  deck.
- Card importer: reads the redesigned official Japanese site through its JSON API (products,
  card list and card details; cached in `data/raw/jp/` like the pages); accepts the side-set
  codes EB, FC, DG, MBT and MTD. Sets imported earlier keep their cached pages. Names with a
  numeric entity missing its semicolon ("PR&#9829ISM") are decoded; a missing English critical
  ("Critical -") becomes a reviewable mismatch.
- Engine: "may attack an opponent's unit in the back row", "with the same grade as your
  vanguard", "(RC) in the left/right column of the front row".
- Artwork Manager: recognises side-set file names and has a "Side sets" selection button.

## 0.21.0-alpha — 2026-10-14

- **BT17 "Blazing Perdition"**: all 102 cards implemented and tested (Liberators, Perdition
  Dragons, Ancient Dragons, Star-vaders, Blue Storm, Seekers, Big Bang Knuckle Buster), with four
  new starter decks (Prominence Core, Vortex Dragonewt, Imaginary Plane Dragon, Tetra-burst
  Dragon). The BT01–BT17 booster card pool is complete.
- Engine: "your vanguard's [Limit-Break 4] is active even when you have three or less damage";
  "choose four of your opponent's units instead, and this unit battles all of them" (an extra
  target choice with the attack); "deal one damage, during that damage check, all trigger effects
  are nullified"; "rear-guards with different card names"; "in the same column as that unit".
- Rules fix: "the same column" now follows CR 4.6.2.1 across players (your left column is your
  opponent's right column). No earlier card compared columns across players.
- Next: the side sets (D-029): Extra Boosters EB01–EB12, Fighter's Collections, PR cards and the
  movie booster.
- **Fix: hand cards jittering during a match** (since 0.19.0-alpha). The card-movement animation
  measured the cards after every render, including renders for hover, so it measured cards that
  were lifted by hover or still sliding and started new slides from those places; the slides
  moved cards under the mouse, which re-rendered, and the hand kept bouncing until a render with
  everything at rest (opening the log covered the hand, so the hover stopped). Now the cards are
  only measured when the game view changes, a slide still running is continued from where it is
  drawn, and hovering or selecting a hand card lifts only its picture, not the card's box (which
  also ends a hover flicker low on a card). Regression tests in `app/tests/motion.test.tsx`;
  `npm run ui:jitter` checks the running app.

## 0.20.0-alpha — 2026-10-10

- **BT16 "Legion of Dragons and Blades"**: all 102 cards implemented and tested (Seekers,
  Brawlers, Raizers, Metalborgs, Musketeers, Spike Brothers), with four new starter decks
  (Thing Saver Dragon, Big Bang Knuckle Dragon, Mega-flare, Sin Buster).
- Card importer: the English "ver.E" BT16/BT17 are numbered differently from the Japanese sets and
  share cards between them; both English sets are searched, "Legend" printings are handled, and
  every pairing was checked by name.
- Engine: "during the turn your vanguard [Legion]", "the column of the (RC) that card was on",
  "rear-guard in the front row is put into the drop zone", "cannot be retired by card effects",
  "ride … and [Legion]" with a card from the soul, "a card that can [Legion] with your
  vanguard", "same card name as a unit on your (VC)", "with a unit behind it"; "X in its card
  name" now ignores case (Cannonraizer counts as a Raizer).
- Legion: the leader and the mate now stand side by side at full size inside the LEGION frame,
  which shows the legion's combined attack power (D-028).
- Attack-power panel (D-028): during your battle phase, a panel on the right shows each
  front-row column's attacker power + booster = total and critical, compared with the
  opponent's vanguard and the shield it needs; the attacker you pick is highlighted and the
  numbers follow the boost toggle. Rested and empty columns are dimmed.

## 0.19.0-alpha — 2026-10-09

- Sound (roadmap phase 2): original synthesised sound effects for drawing, calling, riding,
  retiring, attacking, boosting, guarding, intercepting, perfect guards, drive and damage checks,
  triggers, heals, hits, locks, abilities, new turns, victory and defeat; procedural menu and
  battle music that crossfade. Settings: music volume, sound-effects volume, mute. Sounds follow
  the engine's resolved events only (at most three distinct sounds per action) and never affect
  the game.
- Card movement animation: cards slide to their new place, fly in from the deck or another pile,
  and fly into the drop zone, soul or damage zone when they leave the board; power changes flash.
  Presentation only, never delaying the rules; off at "Instant" speed and with reduced motion.
- Battlefield feedback: the latest game events under the phase rail (click to open the full log),
  and a large preview of the card under the mouse.
- Result screen: how the game ended (sixth damage, no cards left, conceded, a card's effect), the
  turn, both damage counts and both decks, with an entrance animation.
- `npm run ui:shots`: plays the first turns through the app and saves screenshots for reviewing
  UI changes (development aid).

## 0.18.0-alpha — 2026-10-09

- Artwork Manager (docs/ARTWORK.md): Settings → Open Artwork Manager, or `--artwork`. **Download
  missing images** fetches card art from the official card list at the press of a button (D-027);
  it also checks the card-art folder (installed / missing / invalid / duplicate / unmatched per
  set), imports a folder of your own images under the right names, exports, and saves a report.
  Settings shows how many cards have art. The game itself stays offline.
- Hard AI: only true perfect guards count as perfect guards (the BT14/BT15 sentinels that call
  guardians were mistaken for them).

## 0.17.0 — 2026-10-09

- BT15 complete (103 cards, including Star-vader, "Omega" Glendios as BT15-000): Link Joker
  ("Omega" Glendios, "Яeverse" Cradle), Shadow Paladin (Revengers), Gold Paladin (Monarch
  Sanctuary Alfred, Holy Shine Dragon), Kagero (Dragonic Overlord "The Яe-birth"), Pale Moon (Venus
  Luquier), Aqua Force (Maelstrom "Яeverse") and Megacolony (Machining); every effect implemented
  and tested.
- Four BT15 starter decks: Link Joker ("Omega" Glendios), Shadow Paladin (Dragruler Phantom),
  Kagero (Dragonic Overlord "The Яe-birth") and Megacolony (Machining Spark Hercules).
- Engine: "you win the game", locked cards that cannot be unlocked, changing the attacked unit,
  dealing damage by an effect, a locked card from the top of the deck, calls limited by a total of
  grades, "one or more" lock costs, rear-guards that are also another clan while a vanguard says
  so, and "at the end of the battle that this unit attacked a rear-guard" after that rear-guard
  was retired.
- Fixed: a triggered ability whose card was locked before it resolved stopped the game; it is now
  played (CR 8.6.7).
- Card data: BT15-014 Dragonic Burnout and BT15-074 Star-vader, Sparkdoll are paired with their
  English printings; the English database's shield/power typos are recorded and the Japanese
  values are used.

## 0.16.0 — 2026-10-09

- BT14 complete (102 cards): Royal Paladin (Ashlei "Яeverse", Sanctuary of Light), Gold Paladin
  (Gancelot Zenith, Grand Ezel Scissors), Genesis (Yatagarasu, Minerva), Kagero (Dauntless
  "Яeverse"), Narukami (Eradicators), Murakumo (Hyakki Vogue "Яeverse", Kagura Bloome) and Neo
  Nectar (Venus Trap "Яeverse", Master Wisteria); every effect implemented and tested.
- Four BT14 starter decks: Royal Paladin (Ashlei "Яeverse"), Gold Paladin (Grand Ezel Scissors),
  Kagero (Dauntless "Яeverse") and Murakumo (Hyakki Vogue "Яeverse").
- Engine: effects that call cards to (GC) as guardians (the BT14 sentinels), "move this unit to an
  open (RC)", and abilities usable once per battle.

## 0.15.0 — 2026-10-09

- BT13 complete (102 cards): Angel Feather (Ramiel "Яeverse"), Nubatama (Kujikiricongo), Nova
  Grappler (Ethics Buster "Яeverse"), Dimension Police ("Яeverse" Daiyusha, Zero), Link Joker
  (Chaos Breaker), Granblue (Nightmist), Aqua Force and Great Nature; every effect implemented and
  tested.
- Four BT13 starter decks: Nubatama (Kujikiricongo), Nova Grappler (Ethics Buster "Яeverse"),
  Dimension Police ("Яeverse" Daiyusha) and Link Joker (Chaos Breaker Dragon).
- Engine: "when a card is put into your bind zone" triggers, face-down binding (the opponent cannot
  see face-down cards in your bind zone), and exchanging two chosen cards between zones.

## 0.14.0-alpha — 2026-10-09: first public release (D-025)

- Licensed GPL-3.0 (`LICENSE`); `THIRD_PARTY_NOTICES.md` (Bushiroad fan-project notice, bundled
  React and font licences; `node scripts/third-party-notices.mjs`). The main menu shows the
  fan-project notice.
- Windows packaging: `npm run dist:win` builds a zip and a portable .exe with electron-builder
  (release builds never contain card art); `npm run dist:smoke` tests the build from a clean
  temporary folder. Optional card art is read from a `cards\` folder next to the program.
- The card importer downloads images only with `--images`.
- Public documentation: `README.md`, `CONTRIBUTING.md`, `docs/BUILDING.md`, `docs/DEVELOPMENT.md`,
  `docs/RELEASING.md`; GitHub issue/PR templates; CI and draft-release workflows.
- The Comprehensive Rules documents are no longer tracked (kept locally, `docs/research/README.md`).

## 0.14.0 — 2026-10-09

- Hard AI: it now imagines the opponent's hidden hand and deck as a realistic deck of their clan
  (triggers, heals, sentinels, a grade curve, minus cards already seen) instead of plain grade 1
  units. It never looks at the real cards (D-024). Measured: 60% against the previous Hard AI
  over 210 games (95% CI 53–66%).
- AI tooling: `npm run ai:bench` (seeded headless matches, confidence intervals, seat and matchup
  splits, decision times, JSON reports) and `npm run ai:compare`; evaluation weights in
  `src/ai/weights.ts`. Audit, plan and all measurements: `docs/ai/AI_AUDIT_AND_PLAN.md`.
- Fixed: cards from BT09 on and TD08 on showed no art (their images are .jpg; the app only looked
  for .png).

## 0.13.0 — 2026-10-09

- BT12 complete (102 cards): Link Joker (locks), the "Яeverse" units, Shadow Paladin (Revengers),
  Gold Paladin, Narukami, Dark Irregulars and Pale Moon; every effect implemented and tested.
- Four BT12 starter decks: Link Joker (Nebula Lord Dragon), Shadow Paladin (Raging Form Dragon),
  Dark Irregulars (Amon "Яeverse") and Pale Moon (Luquier "Яeverse").
- Engine: "when your opponent's rear-guard is locked due to your effect", effects "from one of your
  cards with X in its card name", "bind one card from the top of your deck" as a cost, "when this
  unit rides a card named X", and binds credited to the card that was given the ability (Dan Dan).

## 0.12.0 — 2026-10-09

- BT11 complete (102 cards): Angel Feather (Celestials), Genesis, Kagero (Seal Dragons), Narukami,
  Aqua Force (Ripples, Brave Shooters) and Tachikaze (Ancient Dragons); every effect implemented
  and tested.
- Four BT11 starter decks: Kagero (Blockade Inferno), Angel Feather (Zerachiel), Tachikaze
  (Tyrannolegend) and Aqua Force (Genovious).
- Engine: additional drive checks (Fortuna), steps the opponent performs ("your opponent looks at
  … and calls …"), "when this card is put into the drop zone from your soul", "if this unit has not
  become [Stand] during that turn", and Mass Production Sailor's sixteen-copy deck rule (also in the
  deck builder).
- Hazard Bob (BT11-055) is only in the Japanese BT11 (English BT11 has a different card there): it
  uses its Japanese name, text and art.

## 0.11.0 — 2026-10-09

- BT10 complete (102 cards): Royal Paladin (Jewel Knights), Gold Paladin (Liberators), Genesis,
  Narukami (Eradicators), Nova Grappler and Spike Brothers; every effect implemented and tested.
- Four BT10 starter decks: Royal Paladin (Ashlei), Gold Paladin (Alfred), Genesis (Himiko) and
  Narukami (Gauntlet Buster Dragon).
- Engine: "a unit with [Limit-Break 4]", "when your opponent's rear-guard is put into the drop zone
  due to an effect from one of your cards" (moves record whose effect caused them), Counter/Soul
  Blasts that must use particular cards.

## 0.10.0 — 2026-10-09

- BT09 complete (102 cards): Murakumo, Aqua Force, Oracle Think Tank, Nova Grappler, Angel
  Feather, Gold Paladin (with the Blaster Spirits), Narukami, Pale Moon and Great Nature; every
  effect implemented and tested.
- Four BT09 starter decks: Murakumo (Magatsu Storm), Gold Paladin (Chromejailer Dragon), Narukami
  (Vermillion "THE BLOOD") and Oracle Think Tank (Amaterasu).
- Engine: cards that are "also a <clan>" (searches, trigger checks, Lord), abilities used from the
  damage zone by turning the card face down, "cannot boost grade 2 or less / a rear-guard", "the
  unit this card boosted", and "at the end of the battle / turn" timings.
- Tests: decks that mix in trial-deck cards are tested with their booster set.

## 0.9.0 — 2026-10-09

- BT08 complete (102 cards): Aqua Force, Dimension Police, Neo Nectar, Tachikaze, Narukami and
  Great Nature; every effect implemented and tested.
- Four BT08 starter decks: Aqua Force (Maelstrom), Dimension Police (Galactic Beast, Zeal), Neo
  Nectar (Cecilia) and Tachikaze (Raptor Colonel).
- Engine: units exchanging positions (Storm Riders), "cards bound with this card's effect"
  (Dungaree), power from the units retired as a cost (Raptor Colonel), abilities in the bind zone
  and hand (Dark Rex), "does not deal damage even if its attack hits" (Fruits Basket Elf), "a unit
  with the same name" (Sephirot), rear-guards "with [Power] 5000 or less", "had been put into the
  drop zone from (RC) this turn", and "choose a [CONT] ability, it is lost" with a new pick-an-ability
  prompt in the app (Koh Koh).
- Fixed: prompts showed "ability" instead of the text of granted abilities.
- Importer: special "S" printings that reprint another set's card are skipped (BT10, BT12);
  reprint detection no longer points at later boosters. BT09–BT15 card data imported.

## 0.8.1 — 2026-10-08

- BT07 complete (102 cards): Great Nature, Pale Moon, Dark Irregulars and more; every effect
  implemented and tested.
- Three BT07 starter decks: Great Nature (Leo-pald), Pale Moon (Luquier), Dark Irregulars
  (Dark Lord of Abyss).
- Engine: "during your end phase, when this unit is put into the drop zone" (also as a granted
  ability: the unit is looked at as it was, CR 8.6.7), "placed on (RC) from your soul/deck",
  "+1000 for each …" on effects, "cards with the same name as that card", calling several
  separately chosen cards at once.
- Fixed: the importer marked cards that only mention a sentinel's name (Lox) as sentinels.
- Trial decks start with their Forerunner where they have no other grade 0 (TD03, TD04).

## 0.8.0 — 2026-10-08

- Trial Decks (D-023): TD01–TD17 (all but the Japanese-only TD15), 16 ready-to-play decks exactly
  as sold, in a new TRIAL DECKS section of New Game (for you or the AI). 272 cards imported and
  verified; reprints share the original's abilities, the 158 trial-exclusive cards with abilities
  are implemented and tested.
- Engine: "when you draw a card", "each player may draw", "this unit cannot attack a rear-guard"
  (the Djinn), "the nth battle of that turn" (Aqua Force), Break Ride with a cost, and
  "that unit's effects with \"cannot be hit\" are nullified" (Daikaiser).
- Fixed: hand abilities that trigger on an opponent's rear-guard retiring (Demonic Dragon
  Berserker, Yaksha) never triggered.
- Importer: Trial Deck products (`npm run cards:import -- TD05`), reprint detection
  (`npm run cards:reprints -- TD05`); official-site slips handled (TD07 Lazarus's missing JP
  shield, a "0002" typo on the TD11 product page).

## 0.7.1 — 2026-10-08

- Fixed (playtest): the AIs could play two perfect guards against one attack, or a perfect guard
  they could not pay for. The Hard AI now also uses a perfect guard when a lethal attack could
  get through on a trigger. Regression test `tests/sim/aiGuarding.test.ts`.

## 0.7.0 — 2026-10-08

- Hard AI (D-021): deck-aware lookahead. It fills hidden cards with plausible stand-ins (never
  the real ones), tries each move with the real engine, plays out the rest of the turn and
  scores the result; guarding compares passing with the cheapest guard combinations and perfect
  guards. It beats the Normal (basic) AI about 60% of the time over the starter decks
  (`npm run ai:bench`). New Game offers Easy / Normal / Hard (default Hard).
- Deck builder (D-022): search and filter all cards (name/text, set, clan, grade, trigger, type,
  power, rarity), build a deck with live legality from the engine, choose the starting
  vanguard, save / load / delete decks (kept in the app), import / export plain text
  (`4x BT01-001 Blaster Blade`, printed numbers accepted), and test opening hands. Saved decks
  appear in New Game for you and the AI.

## 0.6.6 — 2026-10-08

- BT06 complete (102 cards): Limit Break arrives; every effect implemented and tested.
- Engine: attacks on several units at once (Dragonic Kaiser Vermillion): every attacked unit is
  compared and hit on its own, and each guardian guards a unit the defender chooses. In the app,
  when several of your units are attacked, click the guard card (or interceptor) and then the
  unit it should guard.
- New building blocks: "when a card is put into your damage zone", hand → damage zone costs,
  healing a chosen damage card, "for each" amounts and counts, "until end of the game", "the
  original power of" a unit, "placed on (RC) from the drop zone", calls into the column of the
  unit that triggered the ability, "rear-guards you called this turn".
- Two BT06 starter decks: Angel Feather (Kiriel) and Granblue (Cocytus).

## 0.6.5 — 2026-10-08

- BT05 complete: 80 cards verified, every effect implemented and tested.
- Importer: the English site writes quoted names as line breaks from BT05 on
  (`named <br>Blaster Dark<br> in`); they are turned back into quotes.
- Three BT05 starter decks: Murakumo (Mandala Lord), Neo Nectar (Trailing Rose), Royal Paladin
  (Majesty Lord Blaster).
- New building blocks: "a card with X in its card name", "when … becomes [Rest]", calling units
  as [Rest], random choice from the opponent's hand.

## 0.6.4 — 2026-10-08

- BT04 complete: 80 cards verified (English numbering differs again; three ambiguous pairs
  matched by their katakana names), every effect implemented and tested.
- Three BT04 starter decks: Shadow Paladin (Phantom Blaster Dragon), Dimension Police
  (Enigman Storm), Megacolony (Evil Armor General, Giraffa).
- New building blocks: "attacks a vanguard", "an attack hits a vanguard during the battle this
  unit boosted", "when this unit becomes [Stand]", same-column filters and calls.
- Tests: one audit checks every set's ability texts against the official text (tolerating the
  official database's own typos); starter-deck AI games run for every set from BT03 on.

## 0.6.3 — 2026-10-08

- Five BT03 starter decks in the app and the terminal playtest: Dark Irregulars, Pale Moon,
  Royal Paladin (Galahad), Oracle Think Tank (Tsukuyomi), Tachikaze. The setup screen's deck
  lists scroll.
- D-020: where a regional printing changed a card's stats, the English printing is used. BT03
  Spiral Master, Herbivorous Dragon Brutosaurus and Victory Maker are critical triggers.

## 0.6.2 — 2026-10-08

- BT03 complete: 80 cards verified against both official databases, every effect implemented
  and tested (`tests/cards/BT03.test.ts`), plus BT03 deck games for the random and basic AIs.
- Importer: pairs Japanese and English printings by identity, not by number (English BT03
  inserts two English-only cards, shifting its numbering); English-only cards are recorded in
  `enOnly`; art-checked overrides for identical cards; retries transient HTTP errors; decodes
  legacy entities like `&ltClan&gt` (also fixes BT01/BT02 display text); reviewed regional
  differences are recorded with a reason (three BT03 triggers: draw in Japanese, critical in
  English; Japanese stays canonical).
- New building blocks: ride chains (look at five, ride a named card, the rest to the bottom in
  the player's order, no normal ride that phase), "put on (VC)" without riding (Stil Vampir),
  power conditions, "rest one of your rear-guards" costs, "other than a card named" filters,
  rides always go to the card owner's (VC).

- UI: the 16:9 stage is centred and scaled correctly at any window size.
- UI: circle tick rings rotate around their own centre (they drifted off the circles).
- UI: fixed a crash of the battle screen while the battle log is open (Electron 44's
  `scrollIntoView` returns a Promise); regression test in `app/tests/log.test.tsx`.
- UI: the battle log is a pop-up (Log button in the action bar, or the game menu; Esc closes);
  the "log open by default" setting is gone.
- UI tests: board click/highlight logic and scripted full games through `GameSession`.

## 0.6.1 — 2026-10-07

- BT02 complete: 80 cards verified, all effects implemented and tested (BT02 starter decks not yet added).
- Shared card shapes moved to `src/cards/shapes.ts`.
- New building blocks: "put into soul" and "intercepts" triggers, "an open / separate (RC)"
  superior calls, look-at-top, mill-as-cost, delayed effects on other units, filtered bound
  selectors, "during your main phase", and forbidden guards (Silent Tom).
- Test deck builder respects the copy counts a test needs.

## 0.6.0 — 2026-10-07

- Phase 6 (card data): importer for the official JP/EN databases with provenance and JP/EN
  cross-check; art downloaded for personal use only (git-ignored); `cards:import`,
  `cards:validate`, `cards:report`.
- BT01 complete: 80 cards verified, all 55 cards with text implemented and tested.
- New generic building blocks for BT01: top/bottom placement, draw up to N, opponent-chosen
  discard, lose ability/Twin Drive, cannot-stand-next-stand-phase, back-row attacks,
  drive-check-reveal / boosted-by / boosted-attack-hits / put-into-drop triggers, hand-size
  comparisons, "choose a named unit and move it" costs.
- Four BT01 starter decks; basic AI (Level 2); terminal playtest `npm run play` (PLAYTEST.md).
- Player views treat hidden cards as having unknown characteristics.

## 0.5.0 — 2026-10-07

- Phase 5: historical mechanics.
- Granted abilities (CR 10.1.20) with durations; used by Break Ride and Persona Blast cards.
- Bind zone (CR 4.9): bind costs/effects; abilities active in the bind zone (Dark Rex shape).
- Lock / Unlock (CR 10.1.21/10.1.23): lock steps and costs, lock circles, end-phase unlock, "when unlocked".
- Legion / Seek Mate (CR 10.1.24, CR 1.36 10.2.9.2): legion state, combined attacks, ride over legion,
  once-per-game Seek Mate with activation requirements (D-014, D-015).
- Builders: `breakRide`, `seekMate`, `personaBlast`, `grant`, `lock`, `unlock`, `legion`, `lockCost`.
- Performance: card lookup searches the owner's circles first.

## 0.4.0 — 2026-10-07

- Phase 4: generic effect system (design: docs/design/PHASE4_EFFECT_SYSTEM.md).
- Abilities as data with TypeScript builders; validated when cards load.
- Turn and battle flow rebuilt on the task queue with real check timings (rule actions, then
  standby automatic abilities, player-ordered).
- AUTO / ACT / CONT abilities, costs (Counter/Soul Blast, discard, retire, rest, reveal, move),
  Soul/Counter Charge, search, superior call/ride, restrictions, end-of-battle durations,
  Limit Break, Restraint, Lord, Forerunner, perfect guard.
- `ACTIVATE` command; choices generalized (min/max, yes/no, circle, ability order).
- `viewFor(state, player)` hides hidden zones from controllers.
- Fixed: effect restrictions are now also lost when a card changes zone (CR 4.1.4).

## 0.3.0 — 2026-10-07

- Phase 3: combat. Start/attack/guard/drive/damage/close steps, boost, guard from hand, intercept,
  twin drive, damage checks, hit/retire, and critical/draw/stand/heal triggers with the clan condition.
- Task queue (`GameState.tasks`) and pending choices (`CHOOSE` command): procedures can pause for a
  player decision and survive save/load mid-battle.
- Stat modifiers ("until end of turn"), lost on zone change (CR 4.1.4); `currentPower`/`currentCritical`.
- Trigger zone (CR 4.10). `actingPlayer(state)` tells UI/AI whose decision is pending.
- Attacker rests (CR 1.19 / 1.46.4; missing from 1.29, see UNRESOLVED_RULINGS).

## 0.2.0 — 2026-10-07

- Rules verified against Comprehensive Rules ver. 1.29 (2014-11-21); every rule value now cites its CR section. Sources stored in docs/research/sources.
- **Fixed:** mulligan order is return → shuffle → draw (CR 5.2.5). Heal and sentinel limits of 4 are now enforced.
- First turn: the battle phase is entered but no attack is possible (CR 7.2.1.3).
- Phase 2: normal ride, normal call, swapping rear-guards in a column.
- Circles are stacks; overload (CR 9.3) and illegal-guardian (CR 9.4) rule actions.
- `getLegalActions`/`whyIllegal` now take the EngineContext (grade checks need card data).

## 0.1.0 — 2026-10-07

- Phase 1 foundation: TypeScript/Vitest/ESLint/Prettier tooling.
- Engine core: seeded RNG, GameState, zones, deck validation, game setup, mulligan, turn/phase loop, rule actions (damage/deck-out loss), concede.
- Random legal-action AI, match runner and replay.
- Rules values tracked with verified/needs_review status.
