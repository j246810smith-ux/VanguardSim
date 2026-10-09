# Playtesting (terminal, BT01)

A text version of the game for playtesting until the real UI exists (Phase 7).

## Start

Open a terminal (PowerShell, Command Prompt or Git Bash) and run:

```
cd path\to\VanguardSim
npm run play
```

Pick your deck and the AI's deck. Starter decks (`src/decks/starters.ts`); the same decks are in the app (Vanguard Sim shortcut):

1. **Royal Paladin**: Blaster Blade, Alfred, Gancelot
2. **Kagero**: Dragonic Overlord, Vortex Dragon
3. **Oracle Think Tank**: CEO Amaterasu, Apollon
4. **Nova Grappler**: Asura Kaiser, Mr. Invincible
5. **Dark Irregulars** (BT03): Stil Vampir, Amon, Edel Rose
6. **Pale Moon** (BT03): Dusk Illusionist Robert, Nightmare Doll Alice
7. **Royal Paladin** (BT03): the Galahad ride chain from Drangal
8. **Oracle Think Tank** (BT03): the Tsukuyomi ride chain from Ichibyoshi
9. **Tachikaze** (BT03): Ravenous Dragon Gigarex, Raging Dragons
10. **Shadow Paladin** (BT04): Phantom Blaster Dragon, Blaster Dark
11. **Dimension Police** (BT04): Enigman Storm
12. **Megacolony** (BT04): Evil Armor General, Giraffa
13. **Murakumo** (BT05): Covert Demonic Dragon, Mandala Lord
14. **Neo Nectar** (BT05): Maiden of Trailing Rose, the Gene line
15. **Royal Paladin** (BT05): Majesty Lord Blaster
16. **Angel Feather** (BT06): Circular Saw, Kiriel; Limit Break
17. **Granblue** (BT06): Ice Prison Necromancer, Cocytus; Deadly Swordmaster

The opponent is the basic AI (rides its biggest card, fills its board, attacks with everything,
guards when damage matters).

Your own decks: build them in the app (Main menu → Deck Builder); the terminal playtest uses the
starter decks only.

## Controls

- Type the **number** of an option and press Enter.
- Multi-choices (e.g. "choose up to two"): numbers separated by spaces; blank = none.
- `?3` reads the text of hand card 3. `b` reads the text of every card on the board.
- `q` concedes and quits.
- Mulligan: type the hand numbers to return (e.g. `1 4`), or press Enter to keep.

On the board, `(R)` means rested. The AI's side is drawn mirrored, so the columns line up
(your left column faces the AI's right column).

## Reporting a problem

Every game prints its **seed**. The same seed and the same choices replay the same game:

```
npm run play -- --seed 123456
```

Write down the seed, what happened, and what you expected; Claude can reproduce it exactly.
