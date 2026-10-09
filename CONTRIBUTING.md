# Contributing

Thanks for helping! Bug reports, card fixes, rules corrections, AI improvements and documentation
are all welcome.

## Workflow

1. **Fork** the repository on GitHub and clone your fork.
2. **Create a branch** for one change: `git checkout -b fix/bt08-016-raptor-colonel`.
3. **Make a focused change.** One card, one rule, one feature or one fix per pull request.
4. **Run the checks**: `npm run check` (typecheck, lint, format check, every test). All must pass.
   Format with `npm run format` if the format check fails.
5. **Open a pull request** against `main`, describing what changed and why. For card or rules
   changes, quote the card text or the Comprehensive Rules section you followed.

## Ground rules (from the project's design)

- **Rules first, no guessing.** If the official rules or a card's text are unclear, don't invent a
  ruling: record it in `docs/UNRESOLVED_RULINGS.md` and say so in the pull request.
- **Every bug fix gets a regression test.**
- **The UI and the AI never change the game state directly.** Everything goes through the engine's
  `applyCommand` with a command it validates (`src/engine/engine.ts`).
- **No randomness or clock outside the seeded RNG** in `src/engine` (`src/engine/rng.ts`); ESLint
  enforces it. Games must replay exactly from their seed and commands.
- **Cards are data**, not special cases in the engine: abilities are written with the builders in
  `src/engine/abilities/builders.ts` (see below).
- **Historical format only**: BT01–BT17 era rules and cards. No G-era or later mechanics.
- **No card artwork** in the repository or in pull requests, ever (`THIRD_PARTY_NOTICES.md`).
- Keep `CHANGELOG.md` up to date for user-visible changes.

## Where things live

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the architecture and step-by-step guides:
fixing or adding a card, implementing a new kind of effect, improving the AI, and writing tests.

## Reporting bugs

Open an issue using the bug template. The most useful reports include the version, the steps, what
you expected, what happened, and for in-game problems the **seed** shown in the game menu.

## Licence of contributions

By contributing you agree that your contribution is licensed under the project's licence,
GPL-3.0 (see [LICENSE](LICENSE)). Do not submit material you don't have the right to share.
