# UI component system

Started 2026-11-13 from the owner's UI brief (work queue item 5 in docs/NEXT_SESSION.md).
**Status (v0.42.0-alpha): approved by the owner and integrated.** The kit follows the six colour
themes. Main menu, Deck Builder and Card Database, Game Setup and match settings use kit
components; Settings, Profile, Online, Updates and Music get the kit look through a scoped style
bridge on their old classes (end of `app/renderer/styles.css`). The battle screen is unchanged.
The controller and Android back work with kit dropdowns and dialogs.

## 1. Audit (before any change)

**Stack.** React 19 + Vite 8, packaged by Electron 44 (Windows) and Capacitor 8 (Android). The only
UI dependency was `@number-flow/react`. There was no component library, no CSS framework and no
icon set beyond the game's own SVG and PNG icons.

**Styling.** Two plain CSS files: `app/renderer/styles.css` (about 6,200 lines) and
`app/renderer/home/home.css`. Colours are CSS variables on `:root`, re-set per theme on
`.viewport.theme-<id>` (six themes, `app/renderer/themes.ts`). Animation lengths scale with
`--anim`, which reduced motion sets near zero.

**Controls found.**

| Control          | How it is built today                                           | Uses      |
| ---------------- | --------------------------------------------------------------- | --------- |
| Button           | `<button class="btn">` with `primary`, `gold`, `info` modifiers | about 150 |
| Menu button      | `.menu-btn` (big menu items) and home-screen buttons            | about 20  |
| Segmented choice | `.seg` with a hand-set `on` class, or `.btn` + `primary`        | about 30  |
| Dropdown         | native `<select>` (Deck Builder, Profile, Music, Artwork tool)  | 14        |
| Slider           | native range input (music, audio)                               | 2         |
| Checkbox         | native checkbox (music, artwork tool)                           | 3         |
| Text input       | native input (search, names, room codes)                        | about 20  |
| Modal            | hand-written `.modal-backdrop` + `.modal`, plus `ConfirmDialog` | about 19  |
| Tooltip          | `title=` for the mouse, `InfoTip` for touch                     | many      |
| Tabs             | hand-written buttons (Battle info panel, Profile tabs)          | a few     |

**What the audit means.**

- The same control looks different from screen to screen: three ways to show one choice of
  several, two modal styles, native dropdowns that ignore the theme.
- Native `<select>` lists and range sliders look like Windows controls, not the game.
- Hand-written modals each handle Escape, outside clicks and Android's back button on their own.
- Nothing is broken. The gain is one consistent look, plus keyboard and controller access that
  comes for free.

## 2. Library choices

| Need                                                               | Chosen                                          | Why                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------ |
| Behaviour of dropdowns, dialogs, tabs, switches, sliders, tooltips | **Radix UI** (`radix-ui` 1.8)                   | Unstyled, accessible, works with React 19, tree-shaken, no CSS to fight. |
| Icons                                                              | **Lucide** (`lucide-react` 1.72)                | One consistent line-icon set, imported per icon.                         |
| Styling                                                            | **Our own CSS** (`app/renderer/ui/kit/kit.css`) | Fits the existing CSS-variable themes.                                   |

**Left out on purpose.**

- **shadcn/ui** needs Tailwind. Adding Tailwind beside 6,000 lines of plain CSS would give two
  styling systems. The brief says not to add Tailwind just for shadcn. The kit follows shadcn's
  approach anyway: Radix primitives with our own styles, in our own files.
- **React Aria and Base UI** do the same job as Radix. Using more than one would mean competing
  libraries.
- **Motion** was not needed for the showcase. CSS transitions already follow the `--anim` setting
  and reduced motion. It can come later if a screen needs gestures or layout animation.

Both packages are bundled into the app by Vite. Nothing loads from the internet, so offline play
is unaffected.

## 3. Design tokens

All tokens start with `--ui-` and every class with `ui-`. Nothing in the kit changes an existing
screen until a control is deliberately switched over.

| Token                                             | Value                     | Use                            |
| ------------------------------------------------- | ------------------------- | ------------------------------ |
| `--ui-bg`                                         | #070b16                   | page, inputs                   |
| `--ui-surface`, `-2`, `-3`                        | #0d1426, #131c33, #1a2542 | panels, buttons, menus         |
| `--ui-charcoal`                                   | #1b1f29                   | switch and slider tracks       |
| `--ui-accent`                                     | #2f8cff (electric blue)   | primary actions                |
| `--ui-accent-2`                                   | #22d3ee (cyan)            | focus, active tab, glow        |
| `--ui-gold`, `--ui-danger`, `--ui-success`        | #ffcf4d, #ff4d5e, #3ee08f | confirm, delete, status        |
| `--ui-border`, `--ui-border-strong`, `--ui-metal` | translucent steel         | metallic edges                 |
| `--ui-glow`, `--ui-glow-strong`                   | cyan halo                 | hover and keyboard focus       |
| `--ui-radius-*`, `--ui-space-*`                   | 6/10/14 px; 4–24 px       | shape and spacing              |
| `--ui-touch`                                      | 44 px                     | minimum touch target on phones |

Fonts are the game's own (Orbitron for headings, Rajdhani for text).

## 4. Components (`app/renderer/ui/kit/index.tsx`)

Each control takes plain values and callbacks and knows nothing about the game.

- **Button**: variants `primary`, `default`, `secondary`, `ghost`, `gold`, `danger`. Sizes `sm`,
  `md` and `lg`. It takes an optional icon, and `loading` shows a spinner and disables it.
- **IconButton**: a square button whose `label` is read by screen readers and shown as its tooltip.
- **Segmented**: one choice out of a few, all visible, built on Radix ToggleGroup. Clicking the
  chosen item again keeps it chosen.
- **Select**: a themed dropdown, built on Radix Select. It takes plain options or groups with
  headings, and supports disabled options and a placeholder.
- **Tabs**: built on Radix Tabs, with arrow-key navigation and disabled tabs.
- **Switch** and **Checkbox**: labelled, and the checkbox has an indeterminate state.
- **Slider**: built on Radix Slider, with keyboard steps and a larger thumb on touch screens.
- **TextField**: a label, an optional icon, and a hint or error linked to the input.
- **Dialog**: a modal built on Radix Dialog. Escape, an outside click and Android's back button
  close it, and focus stays inside while it is open.
- **Tooltip**: hover and focus only. Text a touch player needs still goes in `InfoTip`.
- **Badge** and **Panel**: a status pill, and a section with a metallic edge.

Every control has a visible cyan focus ring. Touch screens get 44 px targets.

## 5. Showcase

`app/renderer/screens/UiShowcase.tsx`, opened from Settings → "UI Showcase (preview)". It shows
every control in every variant with game-like sample content. All its state is local, so nothing
in it is saved. Screenshots come from `VANGUARD_SHOTS_SCREEN=showcase node scripts/ui-shots.mjs 8`
after a Vite build. Tests are in `app/tests/uiShowcase.test.tsx`.

## 6. Plan once the look is approved

The brief's order is: main menu, deck builder, deck selection, match settings, collection, card
search, settings, profiles, online. Each step:

1. Replace one screen's controls with kit components, keeping every `data-testid`, handler and
   saved value exactly as it is.
2. Run the screen's tests and the full suite, and take before and after screenshots.
3. Commit, one screen per commit.

**Known items for integration.**

- **Themes:** the kit has one palette for now. To follow the six themes, map the `--ui-*` tokens
  onto each theme's variables.
- **Phone scaling:** Radix menus and dialogs render at the end of the page, outside the scaled game
  stage. They should render inside the stage element so they scale with it on phones.
- **The battle screen** keeps its own controls. The brief lists menu screens only.

## 7. Questions for the owner

1. Do you approve the look as it stands, or what should change: colours, glow strength, roundness,
   fonts?
2. Should the kit follow the six colour themes, or stay one fixed navy and cyan look?
3. Is the brief's order of screens still the one you want?
