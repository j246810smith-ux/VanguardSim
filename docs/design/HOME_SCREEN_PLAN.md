# Home screen redesign: audit and plan (2026-11-08)

The user's brief "Premium Anime Home Screen Redesign" and two mock-ups
(`01_Hybrid_Home_Screen_Character_Focus.png`, `02_Hybrid_Home_Screen_Battlefield_Focus.png`, OneDrive
Desktop). Presentation only: no engine, rules, card data, online protocol or settings format
changes. Branch `home-redesign`.

## 1. Audit (phase 1)

| Area                             | What the app has                                                                                                          | Effect on the brief                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Architecture                     | React renderer `app/renderer/`, shared by Electron (Windows) and Capacitor (Android)                                      | One home screen for both                                                                                  |
| Layout                           | Every screen is drawn on a fixed 1920×1080 stage scaled to fit (`stageFit.ts`); `--edge` on phones wider than 16:9        | Build once at 1920×1080; the fighters use `--edge`                                                        |
| Android orientation              | Locked to landscape (`android:screenOrientation="sensorLandscape"`)                                                       | No portrait version needed; nothing changed there                                                         |
| Navigation                       | One `Screen` state in `App.tsx`; Android back via `android/back.ts`                                                       | Home uses the same `go(...)`; one new screen name `cards`; back closes the home panels first              |
| Game modes                       | New Game (vs CPU), Play Online (Windows, "in testing"), CPU Demonstration                                                 | START BATTLE opens these three; it never starts a match itself                                            |
| Online                           | Host/join a friend by room code or address (`OnlineScreen`, `online/`); remembers a name in `online.name`                 | Untouched; the profile name is that same stored name                                                      |
| Ranked / ELO                     | **None** (no matchmaking server, accounts or ratings)                                                                     | Nothing to preserve; no ranked button (user's choice)                                                     |
| Accounts, profile                | **None**                                                                                                                  | Local profile: name + drawn avatar, this device only (user's choice)                                      |
| Messages, notifications, friends | **None**                                                                                                                  | Not shown (user's choice); top right is a menu: Updates, Report a Problem, Quit                           |
| Deck builder                     | `screens/DeckBuilder.tsx`, both formats                                                                                   | DECKS opens it unchanged                                                                                  |
| Card database                    | **No separate screen**; the deck builder's pool has search, filters and card details                                      | CARD DATABASE opens the deck builder in a browse mode (pool only, tap = details): no second search system |
| Formats                          | Classic and G era (`PLAY_FORMATS`)                                                                                        | Untouched                                                                                                 |
| Audio                            | One `AudioManager` (`audio/`); menu music outside battles; one click listener plays button sounds                         | Home uses plain `<button>`s, so it gets the sounds; no audio code changed                                 |
| Settings                         | `settings.tsx`, localStorage                                                                                              | Unchanged; reduced motion and Graphics level are respected                                                |
| Automation                       | `main.cjs` screenshot/probe scripts and app tests click `new-game`, `play-online`, `cpu-demo`, `deck-builder`, `settings` | Test ids kept on the new buttons; scripts click `start-battle` first                                      |

Risks: the many tests that start from the menu (kept working by keeping the test ids); the Android
back button (handled); performance on phones (CSS animations only, few elements, paused when the
app is hidden, off with reduced motion or Low graphics, fewer sparks with Reduced).

## 2. Artwork (phase 2)

The four character/mech pictures are made by the user as separate see-through PNGs
(`app/renderer/assets/home/README.md`, the asset manifest). Until then drawn silhouettes stand in.
Everything else (field, buttons, icons, logo, avatars, sparks) is SVG/CSS in code.

## 3. Components (phases 3-4)

`app/renderer/home/`: `HomeScreen.tsx` (layout, START BATTLE + mode panel, nav, menu, profile
editor), `Battlefield.tsx` (the picture-only field), `Characters.tsx` (side layers, art or stand-in),
`Avatars.tsx`, `profile.ts`, `art.ts`, `home.css`.

## 4. Progress

- 2026-11-08: phases 1, 3, 4 built; phase 2 waiting for the user's four pictures. Phases 5-6: see
  the progress notes below as they happen.
- 2026-11-08 (later): the user added an art pack (OneDrive Desktop `Vanguard_Art_Assets`, generated
  reference sheets). Cropped from it, with faded edges: both fighters, both mechs, a skyline and six
  portrait avatars (assets/home/README.md). The drawn stand-ins remain for any missing file.
- Same day, user's phone feedback (outside this brief): card details have about twice the text size
  on a phone (`.stage.phone .details`); the phone battle screen lost its Card Info column, Hide Card
  Info and Card Details rail buttons (a tap or hold opens the details), the rail is narrower and the
  field up to 10% larger (`MobileBattleScreen` `--m-scale`).
