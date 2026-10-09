# Phase 7 — Battle UI (design proposal)

Sources: `VANGUARD_BT01_BT17_UI_REFERENCE_SPEC.md` + `VANGUARD_BT01_BT17_BATTLE_UI_REFERENCE.png`
(desktop project folder), `docs/blueprint/Implementation_Pack/GAME_UI_SPEC.md`,
`Vanguard_BT01_BT17_CURRENT_SCOPE.md`.

The reference image is a visual north star. We build our own original look (CSS/SVG circuitry,
glows, panels); nothing from it (characters, logos, sleeves, textures) is copied. Card art comes
from the git-ignored `assets/cards/` folder (D-018, personal use only).

## 1. Stack and structure

```text
app/                      React 19 + Vite + TypeScript (strict), same repo
  main/                   Electron main process (window, local file access, no network)
  renderer/
    game/                 GameController: owns GameState, runs engine + AI, emits events
    board/                Board, Circle, CardView, HandFan, ZonePanel, PhaseRail, GuardCircle
    combat/               AttackLine, BattleHud (attack vs. defence power), CheckStage
    prompts/              ChoicePrompt (every PendingChoice kind), ActionBar, CardDetails
    log/                  EventLog (engine events → text)
    anim/                 event → animation queue (skippable, reduced-motion aware)
```

- **The UI never mutates state.** It renders `viewFor(state, human)`, lists
  `getLegalActions`, and sends `Command`s via `applyCommand`, the same path the AI uses.
- **The AI runs in the same controller** (`BasicController`, with a short think delay).
- **Animations are driven by the event list** returned from each command. They play from a
  queue, and the board snaps to the final state when skipped. Animations never affect results.
- **Development:** `npm run ui:dev` (Vite in a browser, fastest iteration).
  **App:** `npm run app` (Electron window; Desktop shortcut switches to this).
  Packaging (installer) is left for a later phase.

## 2. Battle screen layout (1920×1080 baseline, scales down to 1366×768)

Matches the reference composition:

- **Centre:** two mirrored fields. Each has 3 back-row circles and a front row of RC–VC–RC.
  The VC is larger, with an emblem and a stronger glow. The opponent's field is on top in
  red/orange, the player's below in cyan/blue. The guardian circle and attack HUD sit on the
  centre divider.
- **Left:** opponent deck, drop and damage stacks (top). TURN N plus a phase rail
  STAND / DRAW / RIDE / MAIN / BATTLE / END; the battle sub-step (ATTACK, GUARD, DRIVE CHECK,
  DAMAGE CHECK, CLOSE) appears under BATTLE.
- **Right:** opponent soul, hand count and trigger zone (top), and the player's trigger zone,
  hand, soul, deck and drop (bottom).
- **Top bar:** opponent name/clan, face-down hand backs, damage x/6, deck count, settings.
- **Bottom:** player name/clan, fanned hand (lifts and enlarges on hover), and an action bar
  with only the legal buttons (Ride, Call, Attack, Guard, Intercept, Activate, End Phase,
  Pass, Card Details).
- **Event log:** a collapsible drawer on the right edge.
- **Card under every unit:** a large power plate (e.g. `13000`), shown gold/green when
  modified. Rested units rotate 90°. Locked units are face-down with a padlock band.
  Legion shows the mate tucked beside the vanguard with a linking bracket.

Clicking any card (field, hand, drop list, soul list, damage) opens **Card Details**:
full art, name, grade, clan/race, power/shield/critical (base → current), trigger, skill text,
card number, rarity, active temporary modifiers, and current zone.

## 3. Interaction model

| Engine state            | UI                                                                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main phase              | Click a hand card → legal circles glow → click a circle = CALL. Drag-and-drop does the same. Ride via the hand card's "Ride" button during the ride phase. ACT abilities show as buttons on the card.                                         |
| Battle: declare attack  | Click your standing unit → legal targets glow red → click a target. If a boost is possible, the back-row unit offers a "Boost?" toggle with a line drawn to the boosted unit.                                                                 |
| Guard step (you defend) | Hand cards that may guard glow; click to add to GC. Interceptors glow on the field. "Done" = PASS_GUARD.                                                                                                                                      |
| `pendingChoice`         | ChoicePrompt panel: card choices highlight the cards in place (or open a picker for deck/drop/soul/damage); yes/no, number, top/bottom and ability-order get dedicated widgets. Min/max are enforced, and confirm stays disabled until valid. |
| Drive / damage check    | CheckStage: the revealed card flies to the trigger zone and enlarges, a trigger banner (CRITICAL / DRAW / STAND / HEAL + power/critical gains) appears, then a target picker for the trigger's effects.                                       |
| Opponent / AI turn      | Inputs disabled; actions animate with a short delay; speed setting 1× / 2× / instant.                                                                                                                                                         |

## 4. Screens in this phase

1. **Main menu:** New Game, Deck Builder (placeholder), Settings, Quit.
2. **Game setup:** pick your deck and the AI deck from the starter decks, choose AI level
   (Random / Basic), seed (optional).
3. **Battle screen** (sections 2–3), including mulligan, first-player display, and a
   win/loss screen.
4. **Settings:** animation speed, reduced motion, show event log, card-art on/off.

The deck builder, save/load and replay viewer come in later phases. The UI is structured so
they plug in.

## 5. Milestones

1. Scaffolding: Vite + React + Electron, the controller wired to the engine, a static board
   rendering a real `GameState`.
2. A playable game with plain styling (click-to-act, every choice kind, guard/intercept,
   checks, end screen) against the Basic AI.
3. Visual pass to the reference: circuitry circles, glows, phase rail, panels, hand fan,
   power plates.
4. Animations and the event log, with skip and reduced motion.
5. Electron window plus a Desktop shortcut; playtest handoff.

Tests: component tests for ChoicePrompt/legal highlighting (Vitest + Testing Library) and one
scripted end-to-end game driven through the controller.

## 6. Decisions for the user

1. **Window size:** 16:9 fixed-aspect stage scaled to fit (recommended), or a fluid layout?
2. **Player identity:** the reference shows character portraits. We can't use anime
   characters, so the proposal is a clan emblem/name plate. Alternatively, an optional
   user-chosen image.
3. **Input:** click-to-select plus drag-and-drop for calls (recommended), or click only?
4. **Font:** a bundled free futuristic font (e.g. Rajdhani/Orbitron, OFL-licensed, shipped
   locally for offline use), or the system font?
