# Audio system: audit, plan and status (2026-11-08)

Source: the user's brief "Vanguard Simulator — Complete Audio System Implementation" (pasted
2026-11-08): a subtle mix of Vanguard ZERO's clean digital sounds and Master Duel's impactful card
placement, every sound through one manager, six volume categories, sounds synchronised with the
card animations, online de-duplication, licensed assets only. The user said the old sounds and
music were not to their liking.

## Audit (before)

- **Engine:** TypeScript, framework-free (`src/engine`); every change is a `GameEvent`. The UI turns
  the events of each command into sound cues in `app/renderer/audio/cues.ts` (already the single
  mapping point, pure, never ahead of the rules).
- **Playback:** `app/renderer/audio/audio.ts`, one manager outside React. Sound effects were
  **synthesised** in code (`synth.ts`, oscillators and noise), music is a **procedural sequencer**
  (`music.ts`). No recordings existed. Two volumes (music, effects) and Mute.
- **Animations:** `board/motion.ts` slides moved cards from their old place to the new one in
  360 ms at Normal speed (0 at Instant or with reduced motion). Sounds played when the engine
  resolved, i.e. at the start of the slide.
- **Online:** the host sends the guest `update` messages with the view and the events that led to it;
  a reconnect sends the current view with **no events**, so history never replays.
- **Platforms:** Electron (Windows, pages loaded from files) and Capacitor (Android WebView, strict
  CSP). Web Audio works on both; `fetch` of `file://` does not, so samples are bundled inline.

## What was built

| Brief item                 | Implementation                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Central manager            | `audio/audio.ts` `AudioManager`: the only code that plays sound. Components call `audio.play(cues)` or `audio.ui(name)`.                                          |
| Loading and caching        | `audio/samples.ts`: each file is an inline chunk, decoded once, cached; common ones preloaded at start.                                                           |
| Variations                 | Several files per sound (`place_01..03`), picked at random, never the one played last.                                                                            |
| Categories                 | Master × Card actions, Battle effects, Interface, Music, Ambient; each with a volume and its own mute.                                                            |
| Priority and per-batch cap | `cues.ts` `PRIORITY`, at most 4 sounds per batch, most important first, 70 ms apart.                                                                              |
| Duplicates and cooldowns   | One sound per kind per batch; each sound has a cooldown (`catalog.ts` `cooldownMs`).                                                                              |
| Voice limit                | At most 10 samples at once (`MAX_VOICES`).                                                                                                                        |
| Missing files              | A missing or undecodable file is silence, never an error.                                                                                                         |
| Animation sync             | Layers marked `land` wait for the card's slide (`landMs` from the controller); others start at once.                                                              |
| Settings                   | Settings → Audio: six sliders, a Mute per category, Mute all, Test sounds, Reset to defaults. Saved with the other settings; old saves keep their effects volume. |
| Online                     | Sounds come only from confirmed events; a repeated update (same view and events) is not played or logged twice; a reconnect has no events.                        |
| Assets and licences        | 89 files from five Kenney CC0 packs, `tools/audio/prepare_sfx.py`, manifest and `docs/audio-licenses/`.                                                           |

## Event → sound map (`audio/catalog.ts`)

| Brief event                               | Engine event                         | Cue                   | Sound (layers)                               |
| ----------------------------------------- | ------------------------------------ | --------------------- | -------------------------------------------- |
| CardDrawn                                 | `CARD_MOVED` reason draw → hand      | `draw`                | card slide                                   |
| NormalCall / RearGuardCalled / CardPlaced | `UNIT_CALLED` (not superior)         | `call`                | slide, then card place + shimmer on landing  |
| SuperiorCall                              | `UNIT_CALLED` superior               | `superiorCall`        | rising chime, then place + shimmer           |
| RideStarted / RideCompleted / GradeUp     | `UNIT_RIDDEN`                        | `ride`                | energy rise, heavy place on landing, shimmer |
| (Legion)                                  | `LEGION`                             | `legion`              | long rise, heavy place, shimmer              |
| StrideStarted / StrideCompleted           | `STRIDE`                             | `stride`              | low swell + energy, heavy place on landing   |
| GuardSelected                             | marking a guardian (selection)       | `select` (UI)         | soft select                                  |
| GuardCalled / GuardianCirclePlacement     | `GUARDIAN_CALLED`                    | `guard`               | place + shield pulse on landing              |
| (G guardian)                              | `G_GUARDIAN_CALLED`                  | `gGuard`              | chime, heavy place, shield                   |
| ShieldActivated                           | `RESTRICTION_ADDED` cannot be hit    | `perfectGuard`        | energy + big shield                          |
| (Intercept)                               | `INTERCEPTED`                        | `intercept`           | card shove                                   |
| AttackDeclared / AttackTargetSelected     | `ATTACK_DECLARED`                    | `attack` (+`boost`)   | small zap + slide                            |
| AttackHit / AttackImpact                  | `ATTACK_RESOLVED` hit                | `hit`                 | punch impact                                 |
| CriticalHit                               | hit with `DAMAGE_DEALT` ≥ 2          | `criticalHit`         | punch + low bell                             |
| AttackGuarded / GuardResolved             | `ATTACK_RESOLVED` no hit             | `noHit`               | light metal                                  |
| DriveCheckStarted / Revealed              | `CHECK_REVEALED` drive               | `driveCheck`          | card fan                                     |
| DamageCheckStarted / Revealed             | `CHECK_REVEALED` damage              | `damageCheck`         | lower slide + soft thud                      |
| TriggerActivated                          | `CHECK_REVEALED` active trigger      | `trigger` / `heal`    | rising chime + shimmer / confirmation        |
| DamageResolved                            | `DAMAGE_DEALT` without a hit sound   | `damage`              | soft thud                                    |
| CardReturned (retire, discard)            | `CARD_MOVED` circle/hand → drop      | `retire` / `discard`  | shove / slide                                |
| CardShuffled                              | `DECK_SHUFFLED`                      | `shuffle`             | short riffle                                 |
| PhaseChanged                              | `PHASE_CHANGED` (alone in its batch) | `phase`               | tick                                         |
| TurnStarted / TurnEnded                   | `TURN_STARTED`                       | `turn`                | soft bong                                    |
| CardSelected / CardDeselected             | the UI selection                     | `select` / `deselect` | not after a committed action                 |
| ButtonPressed / ButtonCancelled           | any button (one listener in App)     | `press` / `cancel`    | click / back                                 |
| ButtonConfirmed                           | Settings preview                     | `confirm`             | confirmation                                 |
| InvalidAction                             | a refused command (the toast)        | `invalid`             | soft error                                   |
| (Result)                                  | `GAME_ENDED`                         | `victory` / `defeat`  | rising / falling steel jingle                |

Cancelled or refused actions never play a committed-action sound: sounds come from engine events,
and a refused command produces none.

## Tests

`app/tests/audioManager.test.ts` (fake Web Audio): every catalogue sample exists; normal and
superior calls, stride and G guardian; several calls at once give one sound; critical hit; phase
tick; category levels and mutes; settings migration; variations never repeat; landing timing; the
same sound twice at once plays once; muted categories; the voice limit; a repeated online update.
`app/tests/audio.test.ts`: the cue mapping and that sound is optional without Web Audio.

## Status and open items

- **Windows:** not yet listened to on real speakers (sounds can only be checked by ear; the tests
  check what plays and when).
- **Android:** not yet tested on the phone.
- **Music:** battle music is the owner's two Suno tracks (`assets/audio/music/battle/`), Random by
  default or one chosen in Settings → Audio → Battle music; the player's own `music` folder adds
  more (Windows: `music\` next to `cards\`, served as `vgart://own/music/…`; Android: the app
  folder's `music`, copied by `npm run artwork:phone`). `audio/playlist.ts` (playlists Standard,
  Ranked, Boss, Tournament; only Standard has tracks) and `audio/trackPlayer.ts` (streams the file,
  1.2 s fade-in, 0.8 s fade-out, a 2 s crossfade into the next pass for a gapless loop, pauses while
  hidden). A battle's track never restarts within it (phases, actions, a reconnect: same screen key);
  a new battle picks again, never the last track when there is another. The menu keeps the
  procedural music. Checked on the Windows build: the track starts, fades in and plays on through
  the phases (screenshot mode `VANGUARD_SHOTS_SOUND=1` writes `music.json`). The loop crossfade is
  covered by tests, not yet heard at a track's real end.
- **Ambient:** the category and its slider exist; no ambient sound is chosen yet.
