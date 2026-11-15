# Prompt pack 2026-11-15 — tracker

Source: OneDrive Desktop `Cardfight_Simulator_Last_5_Claude_Prompts.docx` (five prompts). The owner
asked (2026-11-15) to work through it alongside the remaining card sets, skip anything already fixed,
and publish once at the end. Status per item; root causes and tests are noted as each item lands.

| #        | Item                                    | Status                                                                                                                                                                       |
| -------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Grade 2 guarding from hand              | **Already done in v0.43.0** (96eef7d): grade 2 cards guard from the hand once the vanguard is grade 2+ (CR 8.5.2.1.1.2); a hint explains a too-high card. Nothing to change. |
| 2A       | Doom Bringer High Flame free stride     | **Fixed.** See below.                                                                                                                                                        |
| 2B       | Legion Leader/Mate positioning          | **Done** (mate behind the leader; screenshots for review).                                                                                                                   |
| 2C       | Golden combined-power box               | **Redesigned** as a small chip (not redundant outside battles).                                                                                                              |
| 2D       | Android portrait mode                   | to do                                                                                                                                                                        |
| 3.1      | Limit Break enabler + Break Ride        | **Fixed.** See below.                                                                                                                                                        |
| 3.2      | Final Turn once per game + animation    | Once per game **done**; animation: proposal + screenshots for approval.                                                                                                      |
| 3.3      | Negromarl Custom Rule                   | **Done** (+2000/+3000, (VC) and (RC), Original era formats).                                                                                                                 |
| 3.4      | PR14 Generation Break cards             | **Done** (collection G-PR).                                                                                                                                                  |
| 3.5      | Monthly PR cards, Special Half Decks    | to do (with the card sets)                                                                                                                                                   |
| 3.6      | Several locked-unit prompts             | **Done.** See below.                                                                                                                                                         |
| 3.7      | Ready-built deck inspection and copying | **Done.** See below.                                                                                                                                                         |
| 3.8      | Card artwork clarity                    | **Investigated; enlarged views fixed.** See below.                                                                                                                           |
| 3.9      | Attack-hit shake on the vanguard        | **Done.**                                                                                                                                                                    |
| 3.10 / 4 | Guardian Circle centring                | **Done** (screenshots for review).                                                                                                                                           |
| 5        | OG-assist Custom Rule                   | **Done.**                                                                                                                                                                    |

## 2A — Doom Bringer High Flame (G-BT13-073)

The prompt names it as a Legend Deck 02 card; it is G-BT13-073 (Kagero, "Overlord" support).
**Root cause:** the engine allowed the free stride (`freeStride` with the G unit), but the STRIDE
offer only marked `free` when _every_ G unit was free. With any non-"Overlord" G unit in the G zone
the prompt kept a suggested discard and its Stride button needed grades 3+, so the player was asked
to pay. **Fix:** the offer's `discardFor` now holds an empty discard for each G unit that is free
for this player (legalActions.ts); the stride prompt treats a unit's own `discardFor` entry as paid
and says the stride is free (GPrompts.tsx); the AIs already used `discardFor`. The once-only use is
unchanged (the flag goes with the next cost-free stride of an "Overlord" G unit).
Tests: tests/engine/namedFreeStride.test.ts.

## OG-assist decisions (owner, 2026-11-15)

Locked rules as in the prompt, plus: an unsuccessful attempt uses the once-per-game allowance;
unchosen revealed cards go to the bottom of the deck in their original order; it is used at the
start of the Ride Phase (before riding) and the card must be ridden in the next Ride Phase; if that
ride becomes impossible (the card is moved by a forced effect, riding is prevented) the requirement
lapses with no penalty and no replacement; it is a Custom Rule, off by default, available in the
Original era and the OG Expanded era; a grade 4 card never qualifies.

## 3.1 — Limit Break enabler + Break Ride

**Root cause:** `limitBreakMet` (continuous.ts) applied the BT17 enablers ("your vanguard's
[Limit-Break 4] is active even when you have three or less damage") only to a source standing on
(VC). A Break Ride triggers when its unit is ridden, i.e. as it moves to the soul, so with fewer than
four damage it never triggered even with an enabler on (RC). **Fix:** the trigger detector passes the
look-back (`sourceZone` = (VC) for "ridden" triggers) into the Limit Break check. Normal rides and
superior rides both go through the same trigger. Without an enabler four damage is still needed.
Ruling noted in UNRESOLVED_RULINGS "Limit Break enablers". Tests: tests/abilities/breakRide.test.ts.

## 2B/2C — Legion layout

The Legion Leader stands on (VC) at full size as the vanguard; the Legion Mate is drawn directly
behind it, offset towards its owner's back row (down for you, up for the opponent) so its lower
edge shows, slightly dimmed. Clicking the mate opens its details (it never selects an attack); the
leader is the circle's unit for attacks and targeting as before. The mate's own power plate is
hidden (it sat under the leader's). **Golden box:** the combined attack power (leader + mate,
CR 10.1.24.6) is shown nowhere else outside a battle, so it stays, redesigned from a wide "LEGION
⚔ n" banner with a gold bracket over the centre line into a small chip "LEGION n" on the leader's
corner. The battle's attack plate still shows the full attack.

## 3.2 — Final Turn

Now once per game for the player (was once per turn); still cosmetic (only the profile's Final
Turn EXP bonus reads it). The CPU already declared at most once a game.

## 3.3 — Negromarl (custom rule)

BT02-012 Witch Doctor of the Abyss, Negromarl is a grade 3 with 8000 printed power (checked in the
card data). Rule: off / +2000 / +3000, Original Era — Strict and — Expanded only, while it is a unit
on (VC) or (RC); added to its original power so every other effect stacks on top; its shield is
unchanged. Picker: Custom rules row 3; in-game: House rules panel. **To confirm with the owner:**
(VC) and (RC) both (the prompt asked which circles).

## 3.4 — PR14 Generation Break cards

PR/0265 Raybird, 0269 Sanctuary Guard Guarantee, 0270 Magical Gambler, 0272 Hydro Lance Tzanis,
0273 Label Pangolin (the five with [Generation Break] in the 2014 PR list). They keep their ids
(card art, saved decks) and scripts; src/cards/collections.ts shows them in the new G era promo
collection **G-PR** (in `G_SETS`), so they are legal in the G era and not in the Original Era
(where their abilities could never work). Original Era decks that held them now show them as not
legal in that format.

## 3.9 — Hit shake

The vanguard card that is hit shakes (its circle and ring stay put); rear-guards keep their retire
animation; off with Reduced motion and at Instant speed; the setting (Settings → "Shake the vanguard
when an attack hits it", off by default) now means this. Presentation only.

## 3.10 / 4 — Guardian Circle

The centre line is a three-column grid: your plate | VS or the guardians | the other plate, so the
guardians are centred on the Guardian Circle whatever the plates' widths (they used to come after
both plates, to the right). Gaps are 10/6/2 px for 1–2/3–4/5+ guardians, and only past five do the
cards shrink. The same row shows the opponent's guardians. Phone layout: the row was already
centred and is unchanged.

## 5 — OG-assist (custom rule)

src/engine/game/ogAssist.ts; tests/engine/ogAssist.test.ts. Offered at the start of the ride phase
(a yes/no prompt) once per game when the vanguard is grade 0–2, no card exactly one grade higher is
in hand and two cards are in hand. **Added condition to confirm:** "no card one grade higher in hand"
(as G Assist), so a player who is not behind is not asked every turn and cannot use it to look at
their deck. The card may be ridden at once; if not, in the next ride phase it is the only ride and
the phase cannot end until it is ridden (unless it can no longer be ridden: then the duty lapses).
Until then it cannot pay its owner's costs or guard. The smart CPU always uses it; the basic CPU
answers yes. Legion stalling: the forced ride only ever raises the grade, so it cannot hold a
player below grade 3 to deny the opponent's Seek Mate.

## 3.6 — Several locked-unit prompts

Every choice made inside an ability now carries `source`, the card whose ability asks
(`PendingChoice.source`, set in `ask` from the resolving frame, choice.ts). The prompt shows
"From <card> (your front-left rear-guard)" and, when it is about one unit (`subject`), that unit's
picture, name and place. Locked cards offered by a prompt are listed as buttons with their picture,
name and circle ("your opponent's front-right rear-guard (locked)"), since face down on the field
they cannot be told apart. Resolution order and lock/unlock timing are unchanged (presentation
only). Tests: tests/engine/negromarl.test.ts (a yes/no cost prompt and Osmium's lock choice carry
their source).

## 3.7 — Ready-built deck inspection

Game Setup's deck lists have a "List" button beside every ready-built deck (library, starter, trial,
G trial and G starter decks; not your own). It opens the full list (grade, count, name; the G deck
apart) and counts with percentages by grade, trigger, clan and card type (main deck), plus the
format check for the format being set up. "Copy to my decks" saves a new deck "<name> (copy)" for
that format with its own id; the original is never changed and each copy saves separately. "Edit
the copy in the Deck Builder" opens it there (`DeckBuilder openDeck`), where the usual construction
and legality checks apply. Files: screens/DeckInspect.tsx, screens/deckChoice.tsx, App.tsx,
screens/DeckBuilder.tsx. Tests: app/tests/deckInspect.test.tsx.

## 3.8 — Card artwork clarity (investigation)

Measured on the installed copy's `cards\` folder: every image from the official card list is
**350 × 511 px** (BT01-001.png 364 KB, G-BT01-001.jpg 95 KB, BT17-034.jpg 668 KB). Both the English
and the Japanese card lists serve this one size; there is no larger official asset.

| Possible cause          | Finding                                                                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Low-resolution source   | **The main cause.** 350 px wide is the largest the official lists provide.                                                                                                                                             |
| Compression             | None added: the Artwork Manager and the phone download save the bytes as served (checked: no canvas, resize or re-encode anywhere in app/).                                                                            |
| Thumbnail reuse         | None: every view loads the same full file (`artUrl`), so the enlarged view already uses the best asset.                                                                                                                |
| Incorrect scaling       | The enlarged views (Card Details, Deck Builder preview) drew the card at 380 × 553, an 8.6 % upscale on a 1080p screen. **Fixed:** they now draw it at 350 × 511, pixel for pixel at stage scale 1. Aspect ratio kept. |
| Texture filtering / DPI | On high-density screens (the Pixel: about 2.6 device pixels per CSS pixel after the stage scale) any 350 px image is upscaled by the browser; that cannot be fixed without a larger source. Upscaling adds no detail.  |

What helps further: the Artwork Manager's "Import a folder" already takes your own higher-resolution
images (PNG or JPEG up to 10 MB, any size) and installs them under the right names; the game shows
them at full quality with no extra memory cost beyond the file itself.
