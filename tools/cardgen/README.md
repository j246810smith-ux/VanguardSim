# Card script generator (Python helpers)

Helpers used to add a set quickly. Run from the repo root with `PYTHONIOENCODING=utf-8` (Windows).

| Tool                                         | What it does                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `newtexts.py <repo> <SET>`                   | Prints every card of the set that is not a reprint and has text: stats + English text. Read this first.                                                                                           |
| `gen_set.py <repo> specs/<SET>.py`           | Writes `src/cards/<SET>.ts` from a spec. Reprints (via `npm run cards:reprints`) become `{ sameAs }`; cards with only reminder text become `[]`; any other card without a spec entry is an error. |
| `gen_index.py <repo> <dataVersion>`          | Rewrites `src/cards/index.ts` to register every set that has both `data/cards/<SET>.json` and `src/cards/<SET>.ts`. Bump the version (e.g. `bt08-1.0.0`).                                         |
| `add_decks.py <repo> decks/<set>_decks.json` | Appends starter decks to `src/decks/starters.ts` (asserts 50 cards).                                                                                                                              |

## Spec format (`specs/<SET>.py`)

```python
SET = 'BT07'
DOC = 'BT07 "Rampage of the Beast King"'
PRELUDE = """const GN = 'Great Nature';"""          # TS placed before the scripts
CARDS = {
    'BT07-010': 'hitDrawCB2(GN, {t})',            # {t} = whole English text as a TS string
    'BT07-028': 'riddenCall(GN, {t0}), soulLookFiveGrade3(GN, {t1})',  # {t0},{t1}… = text lines
    'BT07-022': '...hitStandPair(GN, {T})',        # {T} = whole text for shapes that split it
}
# optional: REPRINTS = {'X': 'Y'}, NOT_REPRINTS = ['X'], IMPORTS = [...]
# QUOTE_SPLIT = ['BT08-001']: split {t0},{t1}… also at ' "[' (texts that join abilities with quotes)
```

Imports of `ab`, engine types (`Step`, `CardFilter`, `Cost`, `Condition`) and shapes from
`src/cards/shapes.ts` are added automatically. Shapes have doc comments quoting the card text they
implement; test runners for them are in `tests/fixtures/shapeChecks.ts`.

## Per-set loop

1. `npm run cards:import -- BT08` (pairing overrides / reviewed differences in `scripts/cards/import.ts`)
2. `npm run cards:reprints -- BT08` (check `TEXT DIFFERS: review` lines by eye)
3. `python tools/cardgen/newtexts.py . BT08` → write `specs/BT08.py` (+ new shapes / engine pieces)
4. `python tools/cardgen/gen_set.py . tools/cardgen/specs/BT08.py` and `gen_index.py . bt08-1.0.0`
5. `npm run cards:validate`, `npx vitest run tests/cards/texts.test.ts`
6. `tests/cards/BT08.test.ts` naming every scripted card id in quotes (`npm run cards:report`)
7. Starter decks (`decks/bt08_decks.json` + `add_decks.py`), `npx vitest run tests/sim/setGames.test.ts -t BT08`
8. Docs (CHANGELOG, NEXT_SESSION, CLAUDE.md, UNRESOLVED_RULINGS), `npm run check`, commit.
