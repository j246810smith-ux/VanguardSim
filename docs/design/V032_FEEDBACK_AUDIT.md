# v0.32 feedback audit and staged plan (2026-11-08)

Source: OneDrive Desktop `Vanguard_Simulator_Consolidated_Feedback.md` (2026-11-08) and
`cardfight_sim_icon_pack/` (five 1024×1024 launcher icons + `README_IMPLEMENTATION.md`).
The brief asks for an audit and a staged plan **before** implementation. Nothing below is built yet.
This file is the persistent checklist (brief G3): update the Status column as stages land.

Baseline: master `d5693d1`, v0.31.0-alpha published. Android: branch `android-port`
(worktree `..\VanguardSim-android`, Capacitor), checkpoint `8dd52f0` + unverified WIP `cb3b05f`.

## Audit, item by item

Legend: **Confirmed** = seen in code; **Likely** = cause found in code, not yet reproduced;
**Done already** = the game has it; **Needs info** = cannot act without the user.

### A. Format and card pool

| Item                            | Finding                                                                                                                                                                                                                                                                                                                                               | Status                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| A1 Era separation               | Already the policy: G-era cards on PR lists are held back (`G_ERA_ON_PR_LIST` in `scripts/cards/import.ts`, e.g. PR/0250, 0258, 0271). Not written down as a rule for future sets.                                                                                                                                                                    | Document only (new decision)                                  |
| A2 Monthly Bushiroad PRs        | PR 2011–2014 are imported from the official yearly PR lists (`PR11`–`PR14`, 292 printings, `ORIGINAL_ERA_ROADMAP.md`). **Kaisergrader, "Twin Gunner" and "His Blast Chain Dragon" are not in the game under any English or Japanese name.** Likely G-era PRs (2015+) or magazine items outside the yearly lists. The fan wiki blocks bots (HTTP 402). | Needs research; "His Blast Chain Dragon" needs the exact name |
| A3 KAD1–5 + Daikengo half-decks | Not tracked. The card model has one printing per card plus `sameAs` reprints; there is no "collection record" for a product whose cards are all reprints.                                                                                                                                                                                             | To build (data only)                                          |
| A4 Identity vs printings        | Partly there: reprints are `{ sameAs }` and `releases.json` records first years. G-BT03 reprints Phantom Blaster Dragon as a separate entry. No single "printings" list per card.                                                                                                                                                                     | Design needed                                                 |

### B. Windows

| Item                           | Finding                                                                                                                                                                                                                                                                                                               | Status                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| B1 More G sets (GFC etc.)      | G-BT01–05, G-TD01–05 in. Next in order: G-TD06, G-TD07, G-BT06… GFC01 not started.                                                                                                                                                                                                                                    | Set work, as before          |
| B2 Clearer confirmations       | General; needs a list of the confusing moments.                                                                                                                                                                                                                                                                       | Fold into each UI fix        |
| B3 Undo a guardian             | **Confirmed:** clicking a hand card sends `GUARD` at once (`app/renderer/game/interaction.ts:174,239`); the card is on (GC) immediately and there is no way back. Fix in the UI: stage guardians locally, show the shield total, then one "Guard" button sends them. No engine change; once sent it is final, as now. | Ready                        |
| B4 Legion side-by-side         | The mate is drawn 68 px to the right of the leader for both players (`styles.css .mate`). On the opponent's (rotated) side this likely reverses the joined art. Needs a screenshot of a real Legion pair to confirm which order each side should show.                                                                | Likely; verify by screenshot |
| B5 Sulfur prompt               | **Likely:** Sulfur (PR14-0215) triggers once per unlocked unit, and the "pay the cost?" prompt does not point at the unit that unlocked (`ab.eventCard()`). With four units unlocking, four identical prompts appear. Fix: highlight the event card in the prompt and name it. Script itself matches the text.        | Ready                        |
| B6 Deck builder prev/next      | Not there.                                                                                                                                                                                                                                                                                                            | Ready                        |
| B7 Demo Back/Start alignment   | Back has its own inline width (`DemoSetup.tsx:158`).                                                                                                                                                                                                                                                                  | Ready (small)                |
| B8 Overhead mat to the corners | Needs a look at the flat view.                                                                                                                                                                                                                                                                                        | Ready                        |
| B9 Superior Call panel         | The visual circle picker exists (`Prompts.tsx` `CALL_MAP`); some effect calls still use the list panel. Need to find which choice kinds route there.                                                                                                                                                                  | Ready                        |
| B10 Panel placement            | Large; view-specific layout rules.                                                                                                                                                                                                                                                                                    | Design pass with screenshots |
| B11 Final Turn                 | Not there; cosmetic only.                                                                                                                                                                                                                                                                                             | Ready                        |
| B12 Custom rules panel         | Only one custom rule exists (Delayed Legion, `CustomRules` in `state/types.ts`). Panel is easy; it grows with C1/C2.                                                                                                                                                                                                  | Ready                        |
| B13 Trigger ratio panel        | The deck builder counts triggers in total only. In-game panel from your own decklist.                                                                                                                                                                                                                                 | Ready                        |

### C. Custom rules

| Item                        | Finding                                                                                                                                                                                                   | Status                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| C1 9K grade 3 +1000 on (VC) | Not there. Fits the house-rule system (`customRules` + `custom_rule` condition). Eligibility from printed power only.                                                                                     | Needs your OK on the defaults |
| C2 Mega Blast CB4 / SB6     | Not there. 22 Mega Blast abilities (SB8 & CB5) in BT01–BT08, BT10, TD03, EB02, EB04, EB05. Offer the cheaper cost as a second payment option.                                                             | Needs your OK on the wording  |
| C3 Silvest                  | **Done already:** PR12-0076 is in the game, scripted, always legal (D-039, your choice on 2026-11-04), grade 4 allowed in Classic decks. If it failed for you, I need to know where (deck builder, game). | Needs info                    |

### D. Break Ride + LB enabler

Break Ride is scripted through the `breakRide` builder; the condition is checked when the ride
happens. The cards in the report are unknown. **Need the two card names** (or a screenshot with
readable names) before changing anything.

### E. Android (branch `android-port`)

The 2026-11-07 handover already plans E1/E2: widen the 16:9 stage to the phone's ~20:9 width and
scale cards up on small screens. Long-press inspect (E3) exists; size on the phone unchecked. E5
(keyboard shrinks the game) is the Capacitor/WebView resize mode: switch to a non-resizing keyboard
mode and lift the search box above the keyboard. E4 last. First: re-run `npm run check` on the
unverified WIP commit.

### F. Deck intelligence

This is the existing initiative (`docs/deck-intelligence/PROGRESS.md`): stages 1–6 done (library,
20 profiles, deck-aware AI measured 50.0%, off). Next per that tracker: stage 7 spectator arena,
8 batches, 9 matchup database, 10 optimisation, 11 all clans. The brief adds nothing new to it.

### Icon pack

- Windows build is **zip + portable exe** (`package.json` `build.win`), no installer. The exe's
  embedded icon cannot change. Doable: switch the window/taskbar icon at runtime
  (`BrowserWindow.setIcon`) and create/update a desktop shortcut with the chosen `.ico`
  (`shell.writeShortcutLink`). Default exe icon becomes Classic.
- Android (Capacitor): five `activity-alias` launcher entries, switched by a small native plugin;
  some launchers take a few seconds to refresh and the switch may close the app once.
- One shared catalogue + setting; Settings → Appearance → App Icon with previews and Restore default.

## Proposed stages

1. **Correctness and clarity** — B3 guard staging, B5 Sulfur target, B9 Superior Call picker,
   B4 Legion order (after a screenshot), B12 custom rules panel, B2 messages along the way.
   D1 once the card names arrive. A1 written as a decision.
2. **House rules** — C1 9K grade 3, C2 Mega Blast cost (after your OK), both in B12's panel.
3. **Windows UI** — B6, B7, B8, B11, B13, then B10 layout pass with screenshots.
   Icon pack (Windows part). Release v0.32.0.
4. **Android** — verify WIP, E1/E2 wide stage + bigger cards, E3 check, E5 keyboard, icon pack
   (Android part), E4.
5. **Collection** — A2 research, A3 half-deck records, A4 printings design, then G sets (B1).
6. **Deck intelligence** — continue `PROGRESS.md` stage 7 onward.

## Decisions waiting for the user

Answered 2026-11-08:

- **Order:** Android (stage 4) first, then the rest in the order above.
- **C1:** toggle off by default; when on, +1000 (optional +2000 setting); Classic era only.
- **C2:** toggle off by default; when on, the player chooses the normal cost or CB4 & SB6.
- **D1:** investigate Break Ride timing generally against the rules for every enabler in the game;
  change nothing unless a rule clearly breaks.

Still open: A2 exact card names/sources, C3 where Silvest failed, B4 screenshot of a Legion.

## Progress (2026-11-08)

| Item                                          | Status                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| E1 whole screen, E2 bigger cards, E5 keyboard | Done on `android-port` (d2a36cc, 588cea8), installed on the phone, awaiting the user's try                                     |
| Icon pack                                     | Done: Windows on master (b87873a), Android on `android-port` (20c7c00)                                                         |
| B3 guardian take-back                         | Done on master (600def5), tests pass, not playtested                                                                           |
| B5 Sulfur prompt                              | Done on master: "you may" prompts name and mark the unit the event happened to; ability-order list names it too                |
| B9 Superior Call picker                       | Done on master: effect calls use the circle map and show the card (not one still in the deck)                                  |
| C1 9K grade 3                                 | Done on `android-port` (D-040): setup toggle Off / +1000 / +2000, Original era only, local games                               |
| C2 Mega Blast CB4 & SB6                       | Done on `android-port` (D-041): setup toggle; the player chooses when both costs are payable                                   |
| B12 house rules panel                         | Done on `android-port`: game menu → House rules, read from the game itself, on/off with values                                 |
| B6 deck builder previous/next                 | Done on `android-port`: ◀ Previous / Next ▶ and the arrow keys, through the search results or the deck; wraps                  |
| B7 demo button alignment                      | Done on `android-port`: same height, START on one line                                                                         |
| B8 overhead playmat to the corners            | Done on `android-port`: overhead view only; the tilted view keeps the mat on the table                                         |
| B11 Final Turn                                | Done on `android-port`: cosmetic, once per turn in your main/battle phase; the CPU once per game at your 5 damage; local games |
| B13 trigger ratio                             | Done on `android-port`: game menu → Trigger ratio (your list and what is left, exact); % in the deck builder                   |
| B10 panel layout                              | Waiting: needs the user's screenshots of panels covering things                                                                |
| Mobile UI brief (PDF, 2026-11-08)             | Approved; built before B12 onward: `docs/android/MOBILE_UI_PLAN.md` on `android-port`                                          |
| Everything else                               | Not started; order as in "Proposed stages"                                                                                     |
