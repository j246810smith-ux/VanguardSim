# Changelog

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
