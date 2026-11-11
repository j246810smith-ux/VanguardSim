# Hybrid Player Profile — phase 0 audit (2026-11-11)

The user's brief: "Vanguard_Hybrid_Player_Profile_System_Architecture_and_Claude_Code_Prompt (1).docx"
(OneDrive Desktop). Local-first player profile on Windows and Android; online linking only prepared
(no server: docs/design/SERVER_IDEAS.md). Read-only audit of master b721b3e (v0.37.0-alpha).

## 1. The real stack

| Area                | Finding                                                                                                                                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language / UI       | TypeScript, React 19, Vite; one renderer for Windows (Electron 44) and Android (Capacitor 8).                                                                                                                                                                                                                                          |
| Navigation          | `App.tsx` screen state (`menu`/home, battle, decks, settings, online…); the home screen is `home/HomeScreen.tsx`.                                                                                                                                                                                                                      |
| Persistence         | `localStorage` on both platforms (Electron keeps it in the app's user-data folder; Android in the WebView's app storage). Keys `vanguard-sim.*` and `online.*`. Decks: `decks/storage.ts`; settings: `settings.tsx`; music: `audio/musicLibrary.ts`.                                                                                   |
| Migrations / backup | `migrations.ts`: `DATA_VERSION`, ordered `MIGRATIONS`, a snapshot of all player data before an upgrade, put back when going back to an older version, a failed upgrade leaves data untouched. Decks also export to a file (`decks/backup.ts`).                                                                                         |
| Existing profile    | `home/profile.ts`: **name** (shared with Play Online, `online.name`, max 20) and **avatar** (6 portraits in `assets/home/avatars`, 6 drawn emblems in `home/Avatars.tsx`); edited in `HomeScreen` `ProfileEditor`. No id, version, stats or other fields.                                                                              |
| Card / clan ids     | `ctx.registry` (every card by id, `clan`); clan names from the card data.                                                                                                                                                                                                                                                              |
| Cosmetic catalogue  | `cosmetics.ts`: sleeves and playmats with stable ids (and the player's own images by file id); avatars as above. **No banners, no titles, no achievements.**                                                                                                                                                                           |
| Match completion    | The engine's `GAME_ENDED` event (winner or draw, loss reasons) → `session.ending`. A local game has `config.seed` and `GameSession.startedAt` (a stable id per game; a rematch is a new session). CPU demonstrations are marked (`config.demo`). Online: the host's `GameSession`, the guest's `GuestSession` (both see `GAME_ENDED`). |
| Tests               | Vitest + jsdom (`app/tests`), e.g. `homeScreen.test.tsx` for the profile editor.                                                                                                                                                                                                                                                       |
| Builds              | `npm run dist:win`, `npm run dist:android -- --release` (VanguardSim-android worktree).                                                                                                                                                                                                                                                |

## 2. Recommendation

- **Model** (`app/renderer/profile/model.ts`, pure): `localProfileId` (crypto random UUID, made once),
  `schemaVersion`, `displayName` (the existing rules: trimmed, 1–20, control characters removed),
  `avatar` (existing ids), `banner` (id), `title` (id, optional), `favouriteClan` (validated against
  the card data), `signatureCard` (card id, validated), `createdAt`, `updatedAt`, `stats` (local:
  matches, wins, losses, draws; plus the last counted game ids), `onlineLink` (absent; the type only).
- **Storage** (`profile/repository.ts`): one key `vanguard-sim.profile.v1` plus a last-known-good copy;
  the first read builds the profile from the existing name and avatar keys (nothing lost), and keeps
  writing `online.name` so Play Online is unchanged. Corrupt data → the last good copy → a default.
  Stays inside the existing migration snapshots (its key starts with `vanguard-sim.`).
- **UI:** the home screen's profile plate opens **Player Profile** (overview + local stats); **Edit**
  extends the existing editor (name, avatar, banner, title, favourite clan, signature card, preview,
  save/cancel). Phone layout: the same screens, large touch targets.
- **Local stats:** counted once per finished game from `GAME_ENDED`, keyed by a game id
  (seed + start time; online: the room's game), never on leaving a screen. Labelled "on this device".
- **Online seam:** an `AccountLink` interface (link, unlink, status) with no implementation; nothing
  online is shown.

## 3. Risks

Name sharing with Play Online (keep `online.name` in step); a phone clearing app data (exports: add the
profile to the deck backup file); duplicate counting on rematch / reconnect (game ids); no art for
banners or titles yet (see questions).

## 4. Questions for the user (before phase 4)

1. **Titles:** none exist and the brief says not to invent achievements. Leave the title empty for now,
   or make a small fixed list of titles to choose from (no unlocking)?
2. **Banners:** no banner art exists. Use the playmat designs as banners, or wait for art?
3. **Which games count** towards local stats: suggested **games against the CPU and online games**,
   not CPU demonstrations.

## 5. Phases

0 audit (this) · 1 model + repository + migration from the old keys + recovery · 2 Profile and Edit
screens · 3 local stats · 4 cosmetics (banners, titles: after the answers) · 5 account-link interface
only · 6 tests, both builds, phone check.

## 6. Built (2026-11-11, branch `player-profile`)

The user's second brief and asset pack (`cardfight_sim_profile_assets`) answered the questions:
the nine fixed titles, the five banners (plus playmats), and CPU + online games count (not CPU
demonstrations, tutorials or showcases).

- `profile/model.ts` (titles, banners, validation, match records, totals, favourites),
  `profile/repository.ts` (`vanguard-sim.profile.v1` + backup, made from the old name/avatar keys,
  keeps `online.name` in step), `profile/matchRecorder.ts` + the battle controller (a finished game
  counted once by `session.matchId`), `profile/account.ts` (interface only), `profile/ProfileScreen.tsx`
  (Profile, Statistics with format filter, Match History, Friends; Edit profile; banner picker with
  Banners / Playmats; Restore defaults). Home → profile plate opens it.
- Shown honestly: Local ID (not an online id); friend code "when online accounts exist"; Ranked "No
  ranked play yet"; online games are casual. Left out on purpose: the mockups' level / EXP bar
  (progression), privacy settings (nothing online), custom banner upload (later).
- Tests `app/tests/playerProfile.test.tsx` (15), `app/tests/homeScreen.test.tsx` updated.
- Not yet: a phone check on the device, and a release.

## Update 2026-11-11: EXP, levels and Sync devices (user's decisions)

- **EXP**: every counted game (CPU or online; never demos or unfinished games) gives 25 EXP; a win
  on a turn the player declared "Final Turn!" gives 50 more (75). 100 EXP a level, level 1 to 50.
  Worked out from the match history, so games counted before EXP existed count too (without the
  Final Turn bonus, which was not recorded then). `profile/model.ts` (`expFor`, `expOf`, `levelOf`).
- **History is the single source**: statistics, EXP and level all come from `history` (each game
  once, by id; at most 10,000 kept). The old `totals`/`counted` fields are gone.
- **Sync devices** (Profile → Sync devices, `profile/sync.ts`, `profile/SyncPanel.tsx`): no server.
  - Live: "Start sync" makes a room code; the other device types it and presses "Join sync". Uses
    the free PeerJS room-code service Play Online uses (room id `SYNC` + code, so it never meets a
    game room). Payload sent in 32 KB chunks (guest→host limit 64 KB); each side merges, replies
    `sync-done`; finished when both have merged.
  - File: "Save a sync file" (share sheet on Android, download on Windows) / "Import a sync file".
  - Merge: union of games by id (sorted by time), newest look (`lookUpdatedAt`), older local id and
    creation date; decks: union by id, newer `updated` wins. Ties broken the same way on both sides,
    so both devices end identical.
  - Known limit: deletions are not recorded, so a deck deleted on one device returns from the other
    (the page says so: delete it on both).
