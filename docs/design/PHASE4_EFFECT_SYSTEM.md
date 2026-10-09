# Phase 4 Design — Generic Effect System

Status: **APPROVED and BUILT** (2026-10-07; Phase 4 complete, see CHANGELOG 0.4.0). Q1 = A, Q2 = C, Q3 = A, Q5 = blueprint split (DECISIONS D-010–D-013).
Q4 was not asked separately; the design assumes B (each player orders their own) and it is logged in
`UNRESOLVED_RULINGS.md`.
Rules source: Comprehensive Rules ver. 1.29 (D-008), cited as `CR x.y`.

---

## 0. Decisions needed from you

Each decision has a recommendation. Answers are recorded in the status line above.

| #      | Question                                                                                                                                          | Options                                                                                                                                                                                                                                            | Recommendation                                                                                                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | How are card abilities written?                                                                                                                   | **A.** TypeScript "builder" functions that produce plain data (type-checked, serializable). **B.** Raw JSON files. **C.** A small hand-written function per card.                                                                                  | **A.** Typos and impossible abilities become compile errors. The output is still plain data, so it can be saved, inspected and validated, and nothing becomes per-card code (blueprint rule).                                                                                         |
| **Q2** | Which version of a card's text do we implement?                                                                                                   | **A.** The official database's current text (shown as "G-Regulation"; it uses later wording and may include errata). **B.** The original printed text. **C.** The text as it stood in Nov 2014 (original printing plus any errata issued by then). | **C.** It matches the rules target (D-008). We store the official text for identity/verification, record the 2014 wording separately when it differs, and log every difference.                                                                                                       |
| **Q3** | When one player has several automatic abilities waiting at once, who orders them?                                                                 | **A.** Always ask the player when there are 2+ (rules: CR 8.6.3.1). **B.** Fixed order (faster, but not rules-accurate).                                                                                                                           | **A.** Rules-accurate. The AI answers these automatically, and the UI can offer an "auto-order" setting later.                                                                                                                                                                        |
| **Q4** | CR 8.4.1.3 says _the turn player_ chooses the order of the **non-turn player's** standby abilities. That looks like a typo for "non-turn player". | **A.** Follow the text literally. **B.** Treat it as a typo: each player orders their own.                                                                                                                                                         | **B**, logged as a discrepancy, unless you know otherwise. I'll check later rule versions to confirm.                                                                                                                                                                                 |
| **Q5** | Phase 4 vs Phase 5 split                                                                                                                          | See §10.                                                                                                                                                                                                                                           | Phase 4 = the generic engine plus everyday keywords (Counter/Soul Blast, Limit Break, Sentinel, Forerunner, Lord, Restraint, superior call/ride). Phase 5 = era mechanics (Break Ride, Persona Blast, Ultimate Break, Lock/Unlock, Legion). This follows the blueprint's build order. |

---

## 1. Goals and constraints

From the blueprint (`MASTER_GUIDE.md` §7–10, 23–24, `CLAUDE_MASTER_INSTRUCTIONS.md`) and the rules:

- **Cards are data plus declarative effects.** No giant switch, no `if (card.name === ...)` anywhere.
- **One mechanic, one implementation.** Every card that "retires an opponent's rear-guard" uses the same primitive.
- **Everything is serializable.** Abilities waiting to resolve, half-paid costs and pending choices all live in `GameState`, so a game can be saved at any point (this already works for battles).
- **Deterministic.** Same seed + same commands = same game. Ordering never depends on object iteration order.
- **The engine can pause** for any decision (we already have `pendingChoice` + `CHOOSE` and the task queue).
- **If an ability can't be expressed with existing primitives**, it is marked `needs_review` and the card is never marked complete (blueprint §55.5). We add a new generic primitive instead of a one-off hack.

---

## 2. What real cards look like

Taken from the official database (G-Regulation wording; see Q2). These six cards cover nearly every
shape the system must handle:

| Card                                   | Text (abridged)                                                                                                                                                                                                                                                 | What it needs                                                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Blaster Blade** BT01/002             | [AUTO]:[CB2] When this unit is placed on (VC), you may pay the cost. If you do, choose an opponent's rear-guard, and retire it. / (RC) version: if you have a <Royal Paladin> vanguard … grade 2 or greater rear-guard.                                         | Zone-entry trigger, optional cost, condition, targeted choice, retire                                                    |
| **Wingal** BT01/044                    | [AUTO](RC): When this unit boosts a card named "Blaster Blade", the boosted unit gets +4000 until end of that battle.                                                                                                                                           | Battle trigger, name filter, "end of battle" duration                                                                    |
| **Solitary Knight, Gancelot** BT01/010 | [ACT](VC):[CB2] If you have a "Blaster Blade" in your soul, +5000/+1 critical until end of turn. / [ACT](Hand):[Reveal this card and put it on top of your deck] Search your deck for up to one "Blaster Blade", reveal it, put it into your hand, and shuffle. | Activated abilities from VC **and from hand**, "if" checked on **resolution** (CR 8.1.1.1.2), unusual costs, deck search |
| **King of Knights, Alfred** BT01/001   | [CONT](VC): Your units cannot boost this unit. / [CONT](VC): During your turn, +2000 for each of your <Royal Paladin> rear-guards. / [ACT](VC/RC):[CB3] Search for up to one grade 2 or less <Royal Paladin>, call it to (RC), shuffle.                         | Rule-changing continuous effect, scaling power, superior call from deck                                                  |
| **Flash Shield, Iseult** BT01/011      | [CONT]:Sentinel. [AUTO]:[Discard a <Royal Paladin>] When placed on (GC), you may pay the cost. If you do, choose one of your <Royal Paladin> being attacked; it cannot be hit until end of that battle.                                                         | Perfect guard = ordinary ability + "cannot be hit" restriction                                                           |
| **Mandala Lord** BT05/001              | [CONT](VC/RC): If you have a non-<Murakumo> vanguard or rear-guard, −2000. / [AUTO](VC):[CB1 & discard a same-name card] At the beginning of the guard step of a battle this unit is attacked, … the attacking unit gets −10000 until end of that battle.       | Negative modifiers, step-start timing, compound cost (`&`), battle-role selectors                                        |

---

## 3. The ability model

Every ability on a card becomes one `AbilityDefinition` (plain data):

```ts
type AbilityDefinition = {
  id: string; // "BT01-002/1"
  kind: 'CONT' | 'AUTO' | 'ACT'; // CR 8.1.1
  zones: ActiveZone[]; // CR 3.1.1.3: 'VC' | 'RC' | 'GC' | 'hand' | 'soul' | 'drop' | 'damage' | 'any'
  limitBreak?: number; // CR 10.2.5: active only with ≥ n damage
  oncePerTurn?: boolean;
  text: string; // the exact text this definition implements (audit trail)
} & (
  | {
      kind: 'AUTO';
      trigger: TriggerCondition;
      condition?: Condition;
      cost?: Cost[];
      optional?: boolean;
      effect: Step[];
    }
  | { kind: 'ACT'; cost: Cost[]; effect: Step[] }
  | { kind: 'CONT'; condition?: Condition; grants: Continuous[] }
);
```

Card definitions gain `abilities: AbilityDefinition[]`. Stats/text stay where they are. Abilities
are written per set (`src/cards/BT01/abilities.ts`) with builder functions (Q1-A), e.g. Blaster Blade:

```ts
card('BT01-002', [
  auto({
    zones: ['any'], // "When this unit is placed" triggers from its own move
    trigger: placedOn('VC', self()),
    cost: [counterBlast(2)],
    optional: true, // "you may pay the cost. If you do, …"
    effect: [choose('target', units({ owner: 'opponent', circle: 'RC' })), retire('target')],
    text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), …',
  }),
  auto({
    zones: ['any'],
    trigger: placedOn('RC', self()),
    condition: exists(units({ owner: 'you', circle: 'VC', clan: 'Royal Paladin' })),
    cost: [counterBlast(2)],
    optional: true,
    effect: [
      choose('target', units({ owner: 'opponent', circle: 'RC', grade: { min: 2 } })),
      retire('target'),
    ],
    text: '…',
  }),
]);
```

Builders return plain objects (`{ op: 'retire', target: 'target' }`), so the definitions are JSON and can be validated by a schema check.

---

## 4. The effect language

Effects are a **sequence of steps** that read and write **named bindings** (results of earlier
choices). The interpreter runs them as tasks on the existing queue, so any step can pause for a
choice.

### 4.1 Selectors: "which cards?"

`self()`, `units({...})`, `cards({ zone, ... })`, plus battle roles: `attackingUnit()`,
`attackedUnits()`, `boostedUnit()`, `boostingUnit()`, `triggeringCard()` (the card from the event).

Filter fields: `owner` (you/opponent/any), `circle` (VC/RC/GC/front/back/column…), `zone`, `name`,
`clan`, `notClan`, `race`, `grade {min,max}`, `trigger`, `orientation`, `faceUp`, `sentinel`,
`beingAttacked`, `excludeSelf`.

### 4.2 Conditions: "is it true?"

`exists(sel)`, `count(sel) >= n`, `damage(owner) >= n`, `soulCount >= n`, `isTurnOf('you')`,
`inBattle`, `vanguardIs(filter)`, `not / all / any`. Used by CONT abilities, AUTO "if" clauses and
`if_(cond, steps)` inside effects. Per CR 8.1.1.1.2 / 8.1.1.2.3, an "if" in the text is a
condition checked **on resolution**, not a precondition for activating or triggering.

### 4.3 Steps: "do this"

| Group        | Steps                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choosing     | `choose(as, sel, {count, upTo})` (CR 8.5.3), `chooseYesNo` ("you may"), `chooseCircle`                                                                                    |
| Moving cards | `retire`, `call(to)` (superior call, CR 10.1.6.1.3), `ride` (superior ride, CR 10.1.5), `toHand`, `toSoul`, `toDrop`, `toDeck(top/bottom)`, `toDamage`, `bind`, `discard` |
| Deck         | `draw(n)`, `search(as, filter, upTo)` (CR 10.1.9; hidden zone, so you may fail to find), `lookTop(n)`, `revealTop(n)`, `shuffle`, `soulCharge(n)` (CR 10.1.17)            |
| Damage zone  | `counterCharge(n)`, `heal`                                                                                                                                                |
| State        | `stand`, `rest`, `turnFaceUp`/`Down`, `lock`/`unlock` (Phase 5)                                                                                                           |
| Stats        | `modify(target, stat, amount, duration)` with stat ∈ power/critical/shield/grade and duration ∈ end-of-turn / end-of-battle / game                                        |
| Restrictions | `restrict(target, restriction, duration)`: cannot be hit (perfect guard), cannot boost, cannot attack, cannot intercept, cannot guard with grade ≥ n, …                   |
| Control      | `if_(cond, steps, else?)`, `forEach(sel, steps)`, `repeat(n, steps)`, `delayed(timing, steps)` (timed triggers, CR 8.6.5)                                                 |

This list is the starting set, taken from the blueprint's `EFFECT_KEYWORD_DICTIONARY` and Master Guide §7. It will grow as BT01–BT17 cards need it, always as generic steps.

---

## 5. Costs (CR 8.5.2.3, 10.1.15–10.1.17)

```ts
type Cost =
  | { op: 'counterBlast'; n: number; filter?: Filter } // flip n face-up damage face down
  | { op: 'soulBlast'; n: number; filter?: Filter } // n soul cards → drop
  | { op: 'discard'; n: number; filter?: Filter } // e.g. Persona Blast: same name
  | { op: 'retire'; target: Selector }
  | { op: 'rest'; target: Selector } // usually self
  | { op: 'reveal' | 'putOnTopOfDeck'; target: Selector };
```

- **Payability** is a pure function used by the legal-action generator: an ACT ability is only
  offered if its whole cost can be paid (CR 8.5.2.3: you may not start paying and then fail).
- All costs joined by `&` are **decided first, then paid simultaneously** (CR 3.1.1.5.3, 10.1.8.1.1).
  The player picks which damage/soul/hand cards to use through normal choices. The payment is
  applied only once every choice is made, so a cancelled or impossible payment never half-happens.
- AUTO costs are paid **on resolution** (CR 8.1.1.2.2), and "you may pay the cost" becomes a yes/no
  choice.
- Soul Charge and Counter Charge are **effects**, not costs.

---

## 6. Activated abilities [ACT]

- A new legal action `ACTIVATE { source, abilityId }` is offered when: the player has a play timing
  that allows it (in this era, effectively the turn player's **main phase**; the guard step only
  allows call / intercept / pass, CR 7.4.1.2), the source is in an active zone, the Limit Break
  count is met, the once-per-turn flag is not used, and the cost is payable.
- Flow: command → cost choices → pay → effect steps (may pause) → check timing → play timing again.
- Gancelot's `[ACT](Hand)` works naturally: the hand is just another active zone.

---

## 7. Automatic abilities [AUTO] and check timing

This is the heart of Phase 4 (CR 3.5, 8.4, 8.6).

1. **Trigger detection.** Every engine event (`CARD_MOVED`, `UNIT_RIDDEN`, `ATTACK_DECLARED`,
   `ATTACK_RESOLVED` with a hit, `PHASE_CHANGED`, step starts…) is matched against the AUTO
   abilities of cards in their active zones. Each match creates a **standby** entry in `GameState`:
   `{ ability, source, master, eventSnapshot }`. Abilities are indexed by event type, so matching is cheap.
2. **Last-known information** (CR 8.6.4.1, 8.8.1). Movement events carry a snapshot of the card as
   it was on the field ("when this unit is retired" still knows its old grade and power).
3. **Check timing** replaces today's `runRuleActions` call, at the same places plus before every
   play timing (CR 3.6.2):
   - a. Rule actions, repeated until none apply (CR 8.4.1.1).
   - b. If the turn player has standby abilities: they choose one (pendingChoice `order_abilities` when
     2+, Q3) → it is paid and resolved → back to a.
   - c. The same for the non-turn player (Q4).
   - d. End.
4. **Mandatory vs optional.** Standby abilities must be played (CR 8.6.3.1), but "you may" text
   becomes a yes/no choice inside the effect.
5. **Moved before resolving** (CR 8.6.7): still played; steps that need the card where it was simply fail.
6. **Battle timings** are wired into the battle steps we already have: start/attack/guard/drive/damage/
   close step starts, "when this unit attacks/boosts" (CR 7.3.1.8), "when attack hits" (7.6.1.9,
   _after_ retirement), "at the end of battle" (7.7.1.1), end-of-turn (6.8.1.3).
7. **Situation triggers** (CR 8.6.6, e.g. "when you have no cards in hand") are checked at each check timing.

---

## 8. Continuous abilities [CONT], durations and restrictions

- **Computed, never stored.** `currentPower(...)` (already the single stat entry point) gains a layer
  pass, applied in the order CR 8.7.1 requires: printed value → non-numeric changes (clan/name/abilities) → numeric
  changes (CONT abilities + modifiers). Ties are ordered by timestamp (CR 8.7.2.1). So Alfred's
  "+2000 for each <Royal Paladin> rear-guard" is always up to date and needs no bookkeeping.
- **Restrictions** are queried by the rules code through one function, `isRestricted(state, card,
'cannot_be_hit')`, which combines CONT abilities and effect-created restrictions. The battle code
  then calls `canBeHit`, `canBoost`, `canAttack`… Perfect guard is just
  `restrict(chosen, 'cannot_be_hit', 'end_of_battle')`; no special sentinel code beyond the deck limit.
- **Durations**: `end_of_turn` (expires in CR 6.8.1.4, done), `end_of_battle` (expires in the close
  step, CR 7.7.1.2), `game`. Effect-created modifiers still vanish when the card changes zone (CR 4.1.4,
  already done).
- **Performance**: continuous effects are evaluated on every stat read. If profiling shows a problem, we
  cache per state version. Correctness first (performance spec).

---

## 9. Choices, generalized

`PendingChoice` grows from "pick one unit" to:

| Kind                              | Used for                                                 |
| --------------------------------- | -------------------------------------------------------- |
| `select` with `min`/`max`, `from` | targets, cost payment, search results ("up to" allows 0) |
| `yes_no`                          | "you may pay the cost", "you may" effects                |
| `order`                           | ordering standby abilities (Q3)                          |
| `circle`                          | where to superior call a unit                            |

Forced choices (exactly one legal answer) stay automatic, as now. **Hidden information**: choices
from a hidden zone (deck search) show the options only to that player. This phase also adds
the `PlayerView` redaction from TODO.md, so the AI only ever sees what that player could see.

---

## 10. Keywords: Phase 4 vs Phase 5 (Q5)

| Keyword                                                   | Rule             | How it maps                                                                                               | Phase |
| --------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| Counter Blast / Soul Blast / Soul Charge / Counter Charge | 10.1.15–17       | costs/steps (§5)                                                                                          | 4     |
| Limit Break n                                             | 10.2.5           | `limitBreak: n` on the ability; checked per CR 10.2.5.3 (CONT continuously, AUTO on trigger, ACT on play) | 4     |
| Sentinel                                                  | 10.2.8           | flag (deck limit, done) + ordinary AUTO with `cannot_be_hit`                                              | 4     |
| Restraint                                                 | 10.2.4           | CONT restriction `cannot_attack`                                                                          | 4     |
| Lord                                                      | 10.2.7           | CONT restriction conditional on a non-same-clan unit                                                      | 4     |
| Forerunner                                                | 10.2.6           | AUTO on "same clan rides this unit" → optional superior call                                              | 4     |
| Superior call / ride                                      | 10.1.5–10.1.6    | steps                                                                                                     | 4     |
| Break Ride                                                | (card text)      | AUTO LB4 on "rides this unit" + standard steps                                                            | 5     |
| Persona Blast                                             | (card text)      | cost: discard a same-name card                                                                            | 5     |
| Ultimate Break                                            | (card text)      | `limitBreak: 5`                                                                                           | 5     |
| Lock / Unlock                                             | 10.1.21, 10.1.23 | new card state + lock circle type + end-phase unlock (6.8.1.1)                                            | 5     |
| Legion / Seek Mate                                        | 10.1.24, 10.2.9  | vanguard circle holds two units; battle changes already sketched in CR                                    | 5     |

Break Ride, Persona Blast and Ultimate Break should need **no new engine primitives**, only the Phase 4
building blocks. That is the test of whether Phase 4 is general enough.

---

## 11. Card data implications (for Phase 6)

- The **official database is reachable** (`en.cf-vanguard.com/cardlist/?cardno=BT01/002EN`, plain HTML).
  The **fan wiki blocks automated access** (HTTP 402), so wiki cross-checks must be done by hand or with
  your help.
- The official site shows **G-Regulation wording** (e.g. "Counter-Blast 2", "[Power] +4000"). This is
  why Q2 matters: where the Nov-2014 text differs (errata or renamed terms), we keep both and implement
  the 2014 meaning.
- Card import must parse the raw HTML (not a summarizer) and store provenance per the source policy.

---

## 12. Build plan and tests

Each step ends with `npm run check` green and a commit.

| Step | Deliverable                                                                                      | Key tests                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 4a   | Ability/selector/condition types, builders, schema validation, pure evaluators                   | Selectors on hand-built boards; invalid definitions rejected                                                                      |
| 4b   | Effect interpreter on the task queue; generalized choices; one-shot steps                        | Every step: legal use, edge cases (no targets, "up to 0", empty deck search)                                                      |
| 4c   | Costs + `ACTIVATE`                                                                               | Payability, simultaneous payment, cancel, "if" checked on resolution (Gancelot)                                                   |
| 4d   | AUTO: trigger index, standby, check timing, ordering, battle/phase timings, last-known info      | Blaster Blade on ride and on call; Wingal boost; "when attack hits" after retire; two simultaneous triggers ordered by the player |
| 4e   | CONT layers, restrictions, `end_of_battle`                                                       | Alfred scaling, Mandala Lord −2000, Iseult cannot-be-hit, Lord/Restraint                                                          |
| 4f   | Keywords: Limit Break, Forerunner, superior call/ride                                            | LB 3 vs 4 damage boundaries per ability kind                                                                                      |
| 4g   | PlayerView; random AI uses ACTIVATE/choices; ability-bearing synthetic decks in the 200-game sim | No illegal states; determinism; replay equality                                                                                   |

**Exit gate (blueprint Gate 5, "generic abilities work")**: synthetic test cards that copy the _shape_ of the six cards in §2, each
built only from generic steps, all passing, with no card-specific engine code.

Test cards stay fictional until Phase 6 imports verified real cards.

---

## 13. Risks

| Risk                                                    | Mitigation                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Some later-set card needs a mechanic nobody anticipated | Record it in `UNKNOWN_EFFECTS.md`, add a generic step, never fake it                              |
| Continuous effects that depend on each other (CR 8.7.2) | Implement the dependency/timestamp ordering only when a real card needs it; test with those cards |
| The ability-order choice slows play                     | AI auto-answers; UI auto-order setting later; the rules stay intact                               |
| Text-version mismatches (Q2)                            | Store both texts, log differences, implement the 2014 meaning                                     |
