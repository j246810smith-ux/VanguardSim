# Six workstreams — architecture audit and plan (2026-11-11)

The user's brief "Vanguard Simulator — major development update": (1) OU, Original Era Usable G
cards; (2) Original Era Strict / Expanded and G Era formats; (3) online format and deck validation;
(4) consistent house rules; (5) Android custom music manager; (6) the 8000-power Granblue grade 3.
Audit of master after v0.36.0-alpha. The user asked to carry on with the recommendations unattended;
the two decisions the brief reserves (which cards are OU, the Granblue change) stay proposals.

## 1. Existing architecture (findings)

| Area                         | Today                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card database                | One record per card in `data/cards/<SET>.json` (id, set, jp/en text and clan, stats, printings, sources), scripts in `src/cards/<SET>.ts`, loaded into the `CardRegistry`. Art is looked up by id; nothing is duplicated per format.                                                                                                         |
| Formats                      | `src/engine/rules/formats.ts`: `classic` (label **"Original Era"**: BT01–BT17, TD01–TD17, side sets, PR11–PR14; CR 1.29) and `g` (label **"Expanded Era"**: every Classic set + G sets; CR 1.48.1). A format is `legalSets` + deck limits (`FormatDefinition`) + a `Ruleset`.                                                                |
| Deck validation              | `validateDeck(deck, registry, format)` (engine): set legality, size, copies, triggers, heals, sentinels, first vanguard, G deck. Messages per issue.                                                                                                                                                                                         |
| Saved decks                  | `SavedDeck.format?: 'classic' \| 'g'` (absent: Classic, or G if it has a G deck).                                                                                                                                                                                                                                                            |
| House rules                  | `CustomRules` in the engine: `delayedLegion`, `nineKGrade3` (+1000/+2000, Original Era only, C1), `megaBlastCheap` (CB4 & SB6 for Mega Blast, "Vanguard ZERO style", C2).                                                                                                                                                                    |
| Where house rules can be set | New Game: all three. **CPU demonstration: none.** **Online hosting: Delayed Legion only** (the protocol carries only that).                                                                                                                                                                                                                  |
| Online                       | Peer-to-peer (PeerJS room codes / direct address). The **host runs the engine** and is authoritative: it checks versions and the guest's deck (`validateDeck` against the host's format) and applies the guest's commands through `applyCommand`. Online is Original Era only. **There is no server, no ranked mode and no matchmaking.**    |
| Music                        | Menu and battle themes are synthesised (`audio/music.ts`). Battle music: bundled MP3s + the player's own folder (`music\` beside the game on Windows; the app folder on Android, filled from the PC by `npm run artwork:phone`). Settings → Audio → Battle music picks a track or Random. No in-app import, no playlists, no own menu music. |
| Android files                | Capacitor 8 with `@capacitor/filesystem`; the app reads its own folder without permissions. The WebView's file chooser (Capacitor's bridge) opens Android's system picker for `<input type="file">`.                                                                                                                                         |
| Card Database screen         | Read-only browser with the Deck Builder's search; card details.                                                                                                                                                                                                                                                                              |

## 2. Reusable

- Card records and the registry: OU is metadata **about** a card id, kept apart from the card.
- `FormatDefinition`: a format can take an explicit card allow-list besides `legalSets`.
- `validateDeck` and its per-issue messages; the Deck Builder's format switch and legality display.
- `CustomRules` and the Game Setup's house-rule buttons; the house rules panel in battle (B12).
- The online hello/welcome handshake and `versionMismatch`; the host's deck check.
- The audio manager's categories, volumes and `trackPlayer`; `phoneMusic()` listing the app folder.

## 3. Database changes (proposed)

**No change to card records.** A new versioned file `data/ou/ou-list.json`:

```json
{ "version": "1.0", "date": "2026-11-11",
  "cards": [ { "id": "G-BT04-020", "status": "approved" | "proposed" | "rejected",
               "since": "1.0", "notes": "why it is safe without G rules" } ] }
```

- Original era of a card = its set (G sets are G era): derived, not stored.
- Only `approved` entries are legal in Original Era — Expanded. `proposed` are visible in the Card
  Database for review. `since` shows which list version added a card ("added through updates").
- "Authorised users": the game has no accounts and no server. The list is edited in the repository
  (a `npm run ou` script) and shipped with releases; players can view it, never change it. A
  developer-only toggle in the Card Database (dev builds) can write the file.
- PR collections stay as they are (PR11–PR14 in Original Era; G-era PR cards stay out of the pool).

## 4. Formats (workstream 2)

| Key                       | Label                                     | Pool                             | Rules     |
| ------------------------- | ----------------------------------------- | -------------------------------- | --------- |
| `classic` (unchanged key) | **Original Era — Strict**                 | as today                         | CR 1.29   |
| `classic_ou` (new)        | **Original Era — Expanded**               | Original Era + approved OU cards | CR 1.29   |
| `g` (unchanged key)       | **G Era** (today labelled "Expanded Era") | as today                         | CR 1.48.1 |

The current label "Expanded Era" for the G era clashes with the brief's "Original Era — Expanded"; the
label changes to **G Era** (keys and saved decks unchanged, so nothing is converted). OU cards run
under the Original Era ruleset: only cards whose scripts need no G rule may be approved (no Stride,
Generation Break, G zone, G Guardian, heart, G units). A test runs every approved card's script under
CR 1.29 to prove it.

## 5. Online changes (workstream 3)

- The host is the authority (there is no server): the room carries the **format**, the **OU list
  version** and the **house rules**; the guest sees them before joining; the host validates the
  guest's deck against that format with the same `validateDeck`, and refuses with the reason.
- A guest with a different OU list version cannot join an Expanded room ("update to play").
- The guest never sends rules; a changed client cannot widen the format, because the host rejects the
  deck. The host could still cheat on its own deck (documented, as today).
- **Ranked / matchmaking:** not present; not built in this round. If it comes, it needs a server that
  owns format definitions; recorded as a future item.

## 6. House rules (workstream 4)

- One `HouseRulesPicker` component and one `houseRulesFor(format, choice)` used by New Game, CPU
  demonstration and online hosting; the session already applies `CustomRules` for every seat, so the
  CPU follows them too.
- Online: the welcome message carries all three rules; older guests that cannot show them are refused
  by the version check.
- Defaults unchanged (all off). 9K Grade 3 stays Original Era only (both Original Era formats).
- "Zero Megablast cost" in the brief is the existing **Mega Blast (Vanguard ZERO style)** rule
  (CB4 & SB6 instead of CB5 & SB8), not a free Mega Blast.

## 7. Android music (workstream 5)

- Import through the system picker (`<input type="file" accept="audio/*" multiple>`, SAF; no storage
  permission), copied into the app's `music/` folder with `@capacitor/filesystem` (no new dependency).
  MP3, OGG, WAV, M4A/AAC where the WebView plays them; unplayable files are reported by name.
- A Music screen (Settings → Music): tracks with play/preview and remove; playlists (create, rename,
  add/remove tracks); assign a playlist to **Menu** and to **Battle**; shuffle; repeat track / playlist;
  music volume (sound-effect volumes untouched). Saved in localStorage; a missing file is skipped and
  shown as missing.
- The synthesised themes stay the default; an empty assignment keeps them. Windows reuses the same
  playlist logic over its `music\` folder (import there = copy into that folder).

## 8. The 8000-power Granblue grade 3 (workstream 6)

Exactly one card in the whole pool has grade 3 and 8000 power: **BT02-012 Witch Doctor of the
Abyss, Negromarl** (Granblue). Its ability: [AUTO] CB2 when placed on (VC) or (RC), with a Granblue
vanguard, call a card from the drop zone. Detailed review (text, script, boost interactions, +2000 vs
+3000): `docs/design/GRANBLUE_8000_G3.md` (being written by the parallel session). **No change is made
until the user decides.** The closest existing pattern is the 9K Grade 3 house rule (C1); an "8K"
variant would be a separate, off-by-default house rule, not a card change.

## 9. Compatibility risks

- G scripts under CR 1.29: a card approved as OU must not rely on G rules: guarded by the test above.
- Renaming "Expanded Era" → "G Era" may confuse players briefly: the changelog explains it.
- Online: older clients (≤ 0.36) cannot carry format or rules: the version check refuses them.
- Android: large music files copied through base64 can be slow; import shows progress and one file at
  a time; very large files are refused with a message.
- Saved decks: keys unchanged; a deck saved as Strict stays Strict.

## 10. Order and size

1. **W4 house rules everywhere** (small): shared picker, CPU demonstration, online protocol.
2. **W1 + W2 OU list and formats** (medium): `data/ou`, `classic_ou`, labels, Deck Builder, Card
   Database view; list v1.0 starts **empty** (proposals from `OU_CANDIDATES.md` for the user).
3. **W3 online format validation** (medium): room format, OU version, rules; host checks.
4. **W5 Android music manager** (large): import, list, playlists, assignment, playback rules.
5. **W6 report** (small, research only).

## 11. Testing

Engine tests for `classic_ou` validation (approved, proposed, rejected, unknown cards, messages);
the OU script check under CR 1.29; house rules in demo and online (protocol tests and an online probe);
saved-deck compatibility; music manager unit tests (playlists, assignment, missing files) and a jsdom
test of the import flow with a fake file system; `npm run check`; Windows build + smoke; Android
build and a run on the phone.

## 12. Progress

- **W4 house rules (done):** `app/renderer/game/houseRules.ts` (one choice, `houseRulesConfig`,
  `matchRulesOf`, `validHouseRules`, the help texts) and `prompts/HouseRulesPicker.tsx` used by New
  Game, the **CPU demonstration** (it had none; remembered with the demo choice) and **online
  hosting** (it had Delayed Legion only). Protocol 3: `MatchRules` carries all three rules; the
  host's game applies them for both seats. Tests `app/tests/sharedHouseRules.test.tsx`, a new case in
  `app/tests/online.test.ts`. Defaults unchanged (all off).
- **W1 + W2 OU list and formats (done):** `data/ou/ou-list.json` (v1.0; the brief's three examples
  are `proposed`, none `approved`), `src/engine/rules/ouList.ts` (`OU_LIST`, `ouApproved`,
  `ouEntryOf`, `ouBlockers`: Stride, Generation Break, G zone, G units, hearts, Hollow, G guardians
  in a card's script or text), `FormatDefinition.extraCards`/`ouListVersion`/`name`, `cardLegalIn`,
  `originalExpandedFormat`; play formats `classic` "Original Era — Strict", **`classic_ou`
  "Original Era — Expanded"** (Original Era rules), `g` "G Era" (was "Expanded Era"). Deck
  validation says why a card is out (`NOT_ON_OU_LIST`, G era card in Strict). Deck Builder / Card
  Database: the Expanded pool includes approved OU cards; set filter "OU list v1.0"; card details
  show a G card's Original Era compatibility (read only). Maintainer tool `npm run ou` (list, check,
  set, remove, version; refuses to approve a card with blockers). Saved decks keep their keys.
  Tests `tests/engine/ou.test.ts` (incl. a whole game with an OU card under CR 1.29).
  **Owner decision pending:** which cards to approve (proposals: docs/design/OU_CANDIDATES.md).
- **W3 online format validation (done):** the room has a format, chosen by the host (Original Era —
  Strict or — Expanded; online has no G Era yet) and, for Expanded, the OU list version
  (`MatchRules.format`, `ouListVersion`; `roomRules`). The guest sends its OU list version in
  `hello`; the host refuses another version (`roomFormatProblem`) and checks the guest's deck against
  the room's format explicitly ("not legal in Original Era — Expanded: … not approved on the OU
  list"), never the guest's own settings. The host's own deck must be legal before it can host. The
  guest's screens switch to the room's format. Ranked play and matchmaking do not exist (no server):
  recorded as future work. Tests: four room-format cases in `app/tests/online.test.ts`.
- **W5 music manager (done, phone test pending):** Settings → Audio → **Music manager**
  (`screens/MusicManager.tsx`). Android: **Import music** opens the system picker (no storage
  permission) and copies MP3/OGG/WAV/M4A into the app's `music/` folder (`android/musicImport.ts`:
  safe names, no overwrite, 60 MB limit, unplayable types refused, one report line per bad file);
  **Remove** deletes the copy and takes it out of every playlist. Both platforms: preview, playlists
  (create, rename, delete, add/remove tracks), **Menu music** and **Battle music** playlists (empty:
  the game's music as before), shuffle, repeat playlist/track, music volume (effects untouched).
  Saved per device (`audio/musicLibrary.ts`, `vanguard-sim.music.v1`). Missing files are skipped.
  The track player gained a "next track" hook (absent: the old loop). Windows lists its `music\`
  folder as before (no in-app import there). Tests `app/tests/musicManager.test.tsx`, a new case in
  `app/tests/battleMusic.test.ts`.
- **W6 Granblue report (done, decision pending):** `docs/design/GRANBLUE_8000_G3.md`. Only BT02-012
  Witch Doctor of the Abyss, Negromarl matches. Recommendation: no card change; if wanted, an
  off-by-default Original Era house rule like 9K Grade 3 giving a printed-8000 grade 3 **+2000 on
  (VC)** (parity at 10000); +3000 and a boost-only bonus not recommended. Nothing implemented.
