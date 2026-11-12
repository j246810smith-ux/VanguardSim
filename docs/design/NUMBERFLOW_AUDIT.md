# Audit and plan: NumberFlow animated numbers

Date: 2026-11-12. Base: master at 678f8ba (after the controller / Seeker / G zone work). Phases 1
and 2 of the user's "NumberFlow Animated Number Integration" brief: audit (read-only, no package
installed, no code changed) and the proposed implementation. Implementation waits for approval.

## 1. Architecture (what the numbers run on)

- **Desktop:** Electron 44.7 (Chromium, current), React 19.3, TypeScript 6, Vite 8. One renderer
  bundle in `app/renderer/`.
- **Android:** Capacitor 8 WebView running the **same React bundle** (`vite build --mode android`).
  There is no React Native, so `number-flow-react-native` is not relevant: whatever works in the
  desktop renderer works on the phone, subject to the WebView's Chromium version.
- **Animation today:** CSS keyframes (35 in `styles.css`), the card-flight ghosts
  (`board/motion.ts`), cut-ins (`combat/Combat.tsx` FxLayer), the step-by-step presentation queue
  (`presentation/queue.ts`). All presentation-only: the engine state changes at once and the
  animations run after React has drawn it. Reduced motion exists twice over: Settings → Reduced
  motion (`.reduce-motion` on the viewport, `--anim` multiplier) and the system
  `prefers-reduced-motion` query (`useBattleController.tsx systemReducedMotion`), plus Speed =
  Instant.
- **Numbers change at once:** every numeric display reads the engine (`currentPower`,
  `currentCritical`, `currentShield`, zone lengths) on each render. Nothing to fix there; NumberFlow
  only wraps the display.

## 2. Numeric displays found

| Target in the brief         | In this game                                                                                                                                                                                               | File                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Vanguard / rear-guard power | `power-plate` under every unit (desktop **and** phone: the phone reuses `Field`). Re-mounted with `key={power}` so a change "pops" (`power-pop` keyframe) and turns gold (up) or red (down).               | `board/Field.tsx:92`, `styles.css:539-585`                   |
| Battle attack / defence     | `vs-plate .val` ATTACK and DEFENCE totals, the boost / shield / "needs" sub-line, the guardian shield badges                                                                                               | `combat/Combat.tsx` `BattleHud`                              |
| Attack preview              | per-column totals and "vs VG" power                                                                                                                                                                        | `combat/Combat.tsx` `AttackPreviewPanel`                     |
| Damage counters             | `counters` DAMAGE n/6, DECK, HAND (desktop); damage pips on the fighter plates (not digits); phone damage tile                                                                                             | `screens/BattleScreen.tsx`, `board/Panels.tsx` `PlayerPlate` |
| Grade                       | Card Details GRADE / POWER / SHIELD / CRITICAL "printed → current"                                                                                                                                         | `prompts/CardDetails.tsx`                                    |
| Energy                      | **None.** The Original Era and G era have no energy (that is the V/overDress rules). Nothing to animate.                                                                                                   |                                                              |
| Player profile statistics   | Tiles (games, wins, losses, win rate, per mode and format), the level bar `Lv. n` and `into / 100 EXP`, "+25 EXP" per match row. They change on arrival at the screen and after a sync, not while watched. | `profile/ProfileScreen.tsx`                                  |
| ELO / ranked                | **None.** No ratings or seasons exist (ranked needs a server; `docs/design/SERVER_IDEAS.md`).                                                                                                              |                                                              |
| Match timers                | **None.** No turn or match clock exists.                                                                                                                                                                   |                                                              |

Other digits that change in play: hand shield tags (`🛡 5000`), the crit badge `★2`, legion power
`⚔ 20000`, the Deck Builder counts (deck size, G deck n/16, pool count), the Game Over summary.

## 3. NumberFlow compatibility

Package: `@number-flow/react` 0.6.2 (MIT), depends on `number-flow` 0.6.2 and `esm-env`;
peer dependencies `react ^18 || ^19`, `react-dom ^18 || ^19` → **compatible with React 19.3**.
Unpacked sizes 25 KB + 60 KB (a few KB gzipped in the bundle). Dependency-free otherwise.

How it works (docs read 2026-11-12): a custom element (`<number-flow-react>`) with a declarative
shadow DOM, digits spun with the Web Animations API, edge fades with `mask-image`, layout with the
CSS `mod()` function (the docs' feature check links caniuse "css types mod"). `useCanAnimate()`
tells whether the browser can animate and the user allows motion; when it cannot, the value still
renders as plain text. Props that matter here: `value`, `format` (Intl.NumberFormatOptions),
`trend`, `animated`, `respectMotionPreference` (default true), `transformTiming` / `spinTiming` /
`opacityTiming`, `isolate`, `willChange`, `<NumberFlowGroup>` to synchronise several, `nonce` for
a CSP. Limits: no non-Latin digits, backgrounds and borders on the element itself do not scale
smoothly (put them on a wrapper), digit font size is hard to change mid-flight.

- **Windows (Electron 44):** Chromium far beyond `mod()` (125+), WAAPI, mask-image, DSD: works.
- **Android (Capacitor WebView):** the system WebView is Chromium and updates through Play; the
  user's Pixel is current. Older phones with a WebView under 125 fall back to plain numbers through
  `useCanAnimate()` / the component's own feature check: no breakage. The component injects a
  `<style>` into its shadow root; the Android CSP (`vite.config.ts ANDROID_CSP`) already has
  `style-src 'self' 'unsafe-inline'`, so no CSP change is needed.
- **Locale:** `Intl.NumberFormat` groups digits by default ("10,000"). The game prints `10000`;
  pass `format={{ useGrouping: false }}` everywhere so nothing changes but the motion.
- **Fonts:** the power plate uses Rajdhani (`--font-body`), whose digits are not tabular; the
  docs recommend `font-variant-numeric: tabular-nums` so digits do not shift width while spinning.
  Rajdhani has tabular figures; add the property on the plates.
- **No alternative library needed**: React on both platforms, so the original package fits. If
  it were refused, the fallback is a 40-line in-house digit roller (CSS transforms, no deps); not
  recommended while the real thing works.

## 4. Proposed implementation

Principle: a wrapper `app/renderer/ui/Num.tsx` and nothing else knows NumberFlow exists.

```tsx
<Num value={power} />                 // digits spin on change
<Num value={n} className="val" />     // same, with the old class on a wrapper
```

- `Num` renders `<NumberFlow value format={{ useGrouping: false }} trend=... />` with the game's
  timings (`spinTiming` ≈ 450 ms ease-out, `opacityTiming` 200 ms), and renders a plain
  `<span>{value}</span>` when: Settings → **Animated numbers** is Off (new toggle, default On),
  Reduced motion is on (Settings or system), Speed is Instant, Graphics is Low, or
  `useCanAnimate()` is false. So the existing reduced-motion and performance switches all apply.
- Number only: labels, "needs 5000" sentences, "+25 EXP" strings keep their text; the number
  inside them is a `Num` where it changes while on screen.
- `willChange` stays off (the docs warn about memory); `isolate` off; related plates in a
  `<NumberFlowGroup>` (ATTACK / DEFENCE together).

Steps, each a commit with tests:

1. **Install and wrapper.** `npm i @number-flow/react` (dependency, not dev: it ships in the
   renderer bundle on both platforms). `ui/Num.tsx`, the Settings toggle (`settings.tsx`
   `animatedNumbers`, default true; `effectiveSettings` turns it off at Low graphics). Test: `Num` renders the plain span under each off-condition and the component
   otherwise; the displayed text is the exact integer.
2. **Power plates** (`Field.tsx`): the number becomes `<Num>`; the `key={power}` re-mount goes
   (it would restart the component and kill the transition) and the pop/colour flash is kept by
   toggling a `changed` class for 350 ms from a `useEffect` on `power`. Phone layout gets it for
   free. Test: power up and down change the text at once, the classes `up`/`down` still apply,
   and under reduced motion the plain span renders.
3. **Battle HUD and attack preview** (`Combat.tsx`): ATTACK / DEFENCE values in one
   `NumberFlowGroup`; shield badges; preview totals and "vs VG".
4. **Counters and Card Details**: DAMAGE / DECK / HAND, the phone damage tile, Card Details
   current stats, hand shield tags, crit badge, legion total.
5. **Profile**: tiles and the level bar animate when the values change on screen (after a sync;
   on the way in they render settled, `animated` false for the first paint).
6. **Deck Builder counts** (deck n/50, G deck n/16, pool count) — cheap, nice.
7. Windows build, Android build (`npm run dist:android` from the android worktree), a look on the
   phone; `npm run check`; CHANGELOG, `docs/design/NUMBERFLOW_AUDIT.md` updated with results.

Out of scope because the game has none: energy, ELO, ranked seasons, timers. When ranked or
timers arrive, the same `Num` covers them.

## 5. Risks

- **Re-renders:** `Num` is a leaf; the parents already re-render on every state change. The
  component animates only when `value` differs, so no extra work in the common case. Dozens of
  instances in a battle (up to 12 plates + HUD + counters) are within what the docs' examples run.
- **Rapid consecutive updates** (several power modifiers resolving in one step): the component
  retargets a running transition to the new value; the text is right at every frame's end. Covered
  by a test that changes `value` three times in one act.
- **The power plate's clip-path hexagon** stays on the wrapper (the brief: backgrounds on the
  component itself do not scale smoothly).
- **Android CSP**: already allows inline styles (checked); nothing to do.
- **Tabular digits:** without `tabular-nums` the plate width can jitter while spinning; added in
  step 2.

## 6. Polish candidates noticed during the audits (not started; for the user to pick)

1. Controller hint bar placement on the battle screen (bottom left) once seen on a real pad; a
   first-focus choice per screen (e.g. START BATTLE on the home screen, the hand in a battle).
2. The phone's art download skips files that exist by name, so a placeholder like the old
   Blaster Blade Seeker image would survive on the phone; a size/fingerprint check would catch it.
3. The opponent's G zone viewer title could say how many G units are still face down.
4. Card Details' modifiers list prints raw JSON for restrictions (`CardDetails.tsx` `mods`).
5. Deck Builder: filters have no `data-nav-group`, so LB/RB skips them (they are still reachable
   with the D-pad).

## 7. Results (2026-11-12, approved "yes to all")

Built on master after merging the card-sets branch (04de148). `@number-flow/react` 0.6.2 installed
as a dependency. One wrapper, `app/renderer/ui/Num.tsx` (`Num`, `NumGroup`, `numbersAnimate`), and
the Settings toggle **Animated numbers** (`animatedNumbers`, default on; Low graphics turns it off
through `effectiveSettings`). Where it is used: power plates (`board/Field.tsx`, with a `changed`
class for the flash instead of the old re-mount, so the digits can roll), ATTACK / DEFENCE in one
`NumGroup`, guardian shields, attack preview totals and "vs VG" (`combat/Combat.tsx`), the
DAMAGE / DECK / HAND counters (`screens/BattleScreen.tsx`), Card Details' current stats, the crit
badge and legion total, profile tiles and level bar, Deck Builder counts.

Finding worth keeping: NumberFlow reads `matchMedia` when its module loads, so it cannot mount in
jsdom; `canAnimate` is false there, which is the same path an old Android WebView takes, and `Num`
renders a plain `<span>` in both. Tests therefore always see plain, exact numbers; the animated
path is checked by eye in the app. Tests: `app/tests/num.test.tsx` (the gate and the plain
rendering), `app/tests/battleRow.test.tsx` (plate value at once, flash on change, rapid changes).

Polish items 1–5 of section 6: all done in the same change (first focus per screen, phone art
stand-in check by file size, opponent's G zone face-down count, restrictions in words, Deck
Builder filters area).
