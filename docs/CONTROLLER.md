# Playing with a controller (Windows)

Since v0.39 the Windows game can be played with a game controller: Xbox, PlayStation and other
pads the browser's Gamepad API recognises (XInput and most DirectInput / Bluetooth pads). Plug the
pad in or pair it, then press any button: the game says "Controller connected" and a gold focus
ring appears on the thing the pad would pick next. The mouse, the keyboard and the touch screen
keep working alongside; moving the mouse hides the ring until the pad is used again.

Android: not yet (the user's decision, 2026-11-12). The phone's touch controls are unchanged.

## Buttons

Xbox names; a PlayStation pad shows ✕ ○ □ △ and L1/R1/L2/R2 instead. The hints at the bottom left
of the screen use the glyphs of the pad in hand.

| Button              | Does                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| D-pad or left stick | Move the focus (up / down / left / right)                                                                 |
| A                   | Select / confirm: what a click does on the focused card or button                                         |
| B                   | Cancel / back: close the open window or selection, else leave the screen (asks before leaving a game)     |
| X                   | Card details of the focused card (hand, field, piles, pool, deck)                                         |
| Y                   | Skills menu (battle: every activated ability available now)                                               |
| LB / RB             | Previous / next area: hand, your field, the opponent's field, piles, actions; filters, deck, G deck, pool |
| LT / RT             | Scroll the list under the focus (Settings, Deck Builder pool, logs)                                       |
| Menu (Start)        | The game menu in a battle; Settings on the home screen                                                    |
| View (Back)         | Battle history                                                                                            |

Every button except the D-pad can be changed in **Settings → Controller**: press Change beside an
action, then the button to use. A button does one thing: giving it to another action takes it away
from the first. **Reset buttons** restores the table above.

## How it fits the game

The controller is an extra input, not a second control system (`app/renderer/input/`):

- `gamepad.ts` polls the Gamepad API and turns it into button presses: one press per push (a held
  A never confirms twice), with key-repeat on the directions. Chromium only shows a pad after its
  first press; that wake-up press is ignored, so connecting cannot confirm anything by accident.
- `focus.ts` is the focus model: the things a mouse could click (buttons, hand cards, circles,
  piles, pool cards, prompt choices: anything marked `data-nav`) and the geometry that picks the
  neighbour in a direction. An open dialog keeps the focus inside it.
- `ControllerLayer.tsx` (mounted once in `App.tsx`) joins the two: Select **clicks** the focused
  element, so every action goes through the handlers and the engine's legal-action checks the
  mouse uses; Back does what the Android back button does, then Escape, then the screen's own Back.
  Card details and the skills menu reach the screens through small window events and the existing
  buttons.
- `bindings.ts` holds the default map, the rebinding rules and the glyphs; `ControllerSettings.tsx`
  is the Settings section. Saved in the game's settings (`controller`).

Tests: `app/tests/padInput.test.ts` (bindings, geometry, polling) and
`app/tests/controllerLayer.test.tsx` (the layer driving the real screens with a fake pad).
