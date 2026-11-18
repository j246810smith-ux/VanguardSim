# Android portrait mode (prompt pack 2026-11-15, item 2D)

Owner's request: "a genuine portrait gameplay layout; do not merely rotate or compress landscape.
Retain landscape mode and support orientation changes without losing match state." Choices made
2026-11-18: **battles only** (menus, deck builder and settings stay landscape), the **mirror**
layout (both fields the same size), and Vanguard ZERO as the layout reference, taking its
conventions only. Its screens, art and logo are not copied (owner's agreement, 2026-11-08 mobile
brief).

## Layout (portrait stage 1080 px wide, as tall as the phone's shape)

```
┌──────────────────────────────┐  safe-area top (status bar, camera cutout)
│ ◉ Opponent   ✋5  deck 31  ≡ │  opponent plate: vanguard-art avatar, hand, deck, menu
│ G  [R]   [R]   [R]   dmg    │  opponent back row  │ piles left, damage right
│ ◫  [R]   [V]   [R]   ▮▮     │  opponent front row │ (a table turned around)
├──────── MAIN · TURN 4 ───[▶]─┤  centre band: phase, turn, the big phase button (right edge)
│ dmg  [R]   [V]   [R]   ◫    │  your front row     │ damage left, piles right
│ ▮▮▮  [R]   [R]   [R]   G    │  your back row
│ ◉ You   (log)  (details)    │  your plate
│    ╭──── hand fan ────╮     │  hand: overlapped fan, tap to open large
│ [Ride] [Call] [Attack]  ... │  action bar (the controller's bar actions)
└──────────────────────────────┘  safe-area bottom (navigation bar)
```

Conventions taken from Vanguard ZERO: both fields mirrored like a real table, damage as a vertical
column at the side of each field, the piles in a column on the other side, one large phase/end
button at the middle right edge, and the hand fanned along the bottom.

## Phases

| #   | Phase                    | What                                                                                                                       | Status |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| P1  | Foundations              | Native orientation control (portrait allowed only during a battle); portrait stage size and scale; `StageInfo.portrait`; Battle picks the portrait screen | done 2026-11-18: OrientationPlugin.java (FULL_USER during a battle, sensorLandscape otherwise), `stageLayout(w, h, portraitAllowed)`, `PortraitAllowed` context, Battle makes the session once so a layout swap keeps the game |
| P2  | Battlefield              | `PORTRAIT_GEOMETRY` (mirror), damage and pile columns, centre band with the phase button, player plates                    | done: `PORTRAIT_GEOMETRY`, damage columns (sideways cards), pile columns, centre band with the phase button |
| P3  | Hand and controls        | Fanned hand, large hand on tap, action bar, long-press inspection                                                          | done: fan scaled to the row, large on tap, phase strip and action buttons; long press as elsewhere |
| P4  | Overlays                 | Prompts as a bottom sheet, card details, zone viewer, log drawer, menus, game over, all inside the portrait stage          | done: docked prompts and the card menu as a bottom sheet (DockedPrompt skips board placement in portrait), log drawer, modals and card details sized to the width |
| P5  | Battle feedback          | Attack lines, VS display, ability callout, guardian circle, card motion in the portrait stage                              | mostly: VS display and ability callout on the band (`--p-band`); attack lines use the portrait geometry; card motion measures the stage, untested on a device |
| P6  | Testing                  | Unit tests (stage maths, geometry, orientation switching keeps the game); screenshots at phone and tablet sizes; device   | partly: app/tests/portrait.test.tsx (stage maths, geometry, layout swap keeps the game); screenshots at 20:9 (`VANGUARD_SHOTS_SIZE=225x500`, battleLayout phone); on the phone still to do |

The engine, card data and game state are shared: the portrait screen is a third view over the same
battle controller (`useBattleController`), like the desktop and landscape phone screens.
