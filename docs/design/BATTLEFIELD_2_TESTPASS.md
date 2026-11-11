# Battlefield 2.0 — Phase 7 test pass (Step-by-step battles)

Written 2026-11-11 by the card-sets session at the Battlefield 2.0 session's request, against branch
`battlefield-2` at 8e83aca. Scope: the presentation queue (`app/renderer/presentation/queue.ts`),
`GameSession` stepping (`app/renderer/game/session.ts`) and the battle controller
(`app/renderer/screens/useBattleController.tsx`). **Report only: nothing was fixed.** No existing
file was edited; the only new files are this document and `app/tests/steppedMatrix.test.ts`.

## A. The matrix test (`app/tests/steppedMatrix.test.ts`)

CPU demonstrations, basic AI in both seats, each played unstepped and stepped:

- **Classic:** five pairs spread over `STARTER_DECKS` (indices 0/1, 5/12, 20/33, 41/58, 64/70), seeds 3–23.
- **G era (`format: 'g'`):** five pairs over `G_TRIAL_DECKS` + `G_STARTER_DECKS`, seeds 5–37.

Per game it asserts: identical final state, commands, ending and log text stepped vs unstepped; the
same number of Stride cut-ins (paced, not lost); unstepped never presents; while presenting
`aiToAct` is false and `actions` is `[]`; after the last beat `view` equals the real state; every
beat's view passes `checkZoneInvariant` (with one exception, F1) and never shows a later turn than
the real game. One more test asserts that at least one G game shows a Stride cut-in
(`fx.kind === 'ride' && fx.stride`), collecting and dismissing effects as the screen does.

Result: **11/11 pass, about 19 s** with `npx vitest run app/tests/steppedMatrix.test.ts
--maxWorkers=2` (node environment).

## B. Findings

### F1 — a rear-guard circle holds two units for one beat (low)

**What:** when a unit is called onto an occupied (RC), the engine places it and the rule action
(CR 9.3) retires the old unit in a later step. The step observer snapshots the moment in between,
and `buildBeats` makes it a beat (it has a `CARD_MOVED`). `checkZoneInvariant` reports
`player N front_left holds 2 units`. It happened in 3 of the 10 stepped matrix games (Classic Pale
Moon vs Murakumo #7; G-TD01 vs G-TD02 #5; G-BT04 Angel Feather vs G-TD04 #37).

**What the player sees:** `board/Field.tsx` draws `ids.slice(-1)`, so the old unit simply vanishes
one beat before its retire is shown; on the next beat it "arrives" in the drop zone without a slide
from its circle (its element is already gone). Not a rules error.

**Repro:** Step-by-step on, speed Normal; with a rear-guard on front-left, call another unit from
hand onto front-left. Watch the old unit: it disappears at once, then appears in the drop pile a
beat later.

**Options (not done):** skip a beat whose state has two units on one (RC) (merge it into the next),
or have `Field` keep drawing the old unit until the retire beat.

### F2 — "Guard" with several marked cards drops the rest when the first one has an ability (high)

**What:** the guard queue effect in `useBattleController.tsx` (around lines 199–205) runs on every
render:

```ts
if (guardQueue.current.length === 0 || legal.choose) return;
const [next, ...rest] = stillLegal(guardQueue.current, legal.guard);
guardQueue.current = rest;
if (next) send(guardCommand(next));
```

While a command is being presented, `session.actions` is `[]` (by design), so `legal.guard` is
empty and `legal.choose` is undefined. The effect then filters out **every** remaining marked card
and empties the queue. It waits correctly for a choice (`legal.choose`) only once the presentation
has finished, which is too late: the queue is already gone.

**How often:** measured with the engine and `buildBeats` directly (basic AI, 12 Classic and 12 G
games): 38 of 183 Classic GUARD commands and 24 of 120 G ones produced more than one beat. All of
them were a guardian with an ability that then waits for a choice (a sentinel's "pay the cost?"
yes/no; a few power/critical recipient choices).

**Repro:** Settings → Step-by-step on, speed not Instant. Opponent attacks your vanguard. Mark a
sentinel (e.g. a G-era perfect guard, "[Choose a card from your hand, and discard it] When this
unit is placed on (GC)…") **and** a second guardian, press Guard. The sentinel is called and its
ability asks to pay the cost; after that, the second guardian is never called and the marks are
gone, so the guard total is lower than the player planned. With Step-by-step off, both are called.

**Suggested fix (not done):** skip the guard-queue effect while `session.presenting` (return early,
like the AI effect does). The `staged` cleanup effect just above (`stillLegal(staged, legal.guard)`)
has the same pattern; it is harmless today only because nothing is presented while the player is
marking guardians. A `presenting` early return there too would make it safe.

### F3 — online host steps, the guest does not, and the guest can cut the host's beats short (medium)

**What:** `GameSession.apply` calls `onUpdate(events)` straight after the command, so the guest
receives the final view and its legal actions at once (`GuestSession` has no presentation queue)
while the host's screen is still showing earlier beats. If the guest acts during that time,
`receiveRemote` → `apply` calls `flushPresentation()` first, and the host's remaining beats are
skipped in one jump. `receiveRemote` does not check `presenting`.

**Rules timing:** correct, since both sides act on the real state. Presentation: the host may miss
moments (for example, a damage check cut short by the guest's quick guard), and the two screens are
out of step by design.

**Repro:** host an online game with Step-by-step on (speed Normal or slower). Attack the guest's
vanguard with no guard so drive check → damage check → close step run as several beats. As guest,
act as soon as your buttons appear (the next command in your turn, or a guard on the next attack).
On the host, the remaining beats of the earlier command are skipped.

**Options (not done):** queue remote commands on the host until `presenting` is false, or send the
guest the beats too.

### Checked, no problem found

- **Legal actions and guard restrictions** come only from the real state: `refresh()` runs after the
  last beat; while presenting `actions` is `[]` and `aiToAct` is false (the matrix test asserts both).
  Guard restrictions ("cannot call grade 1 or greater to (GC)", etc.) are evaluated by the engine on
  the real state, so they cannot be shown or offered wrongly mid-sequence.
- **Perfect guard / ability choices mid-sequence:** an engine command stops at a pending choice, so
  a choice always ends a command; its prompt appears only after the last beat, with the right state.
- **G Guardian:** offered from `legal` like any guard (menu `gguard`), so it is never offered on an
  earlier moment. (Same F2 caveat only if it is ever queued.)
- **Multi-attack guards:** `markedShield` previews only when `legal.guardable.length <= 1`; with
  several attacked units the preview is 0. That's a known UI limitation, not a timing error.
- **Hidden information:** in a non-demo game each beat's view is `viewFor(beat.state, ME)`, so the
  opponent's hand stays hidden on every beat; the log and effects are built from the same events as
  without stepping (the matrix test checks the log text is identical).
- **New command during a presentation** (local): `apply` flushes first, so a command always starts
  from the real game on screen.

### Worth a look (not verified)

- The pacing effect waits while `session.fx.length > 0`. Any effect kind that a screen component
  never dismisses would stall the presentation (except at Instant). The matrix test dismisses
  everything itself, so it cannot catch this; a quick manual pass over every `Fx` kind
  (`check`, `result`, `banner`, `ride`/stride, `legion`, `attack`, `ability`) on both profiles is advised.

## C. Screenshots

Not taken: the Battlefield 2.0 session was rebuilding `dist/` and an Android APK at the time, so
shots from `dist/` could have shown a half-built or stale bundle. Command for later:
`VANGUARD_SHOTS=<tmp> VANGUARD_SHOTS_STEPS=30 VANGUARD_SHOTS_FORMAT=g VANGUARD_SHOTS_SIZE=923x411
VANGUARD_SHOTS_VIEW=tilted node_modules/electron/dist/electron.exe . --user-data-dir=<tmp>` (and
`VANGUARD_SHOTS_VIEW=overhead`).
