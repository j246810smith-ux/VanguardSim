# G-BT01 OG Expanded playtest

Started 2026-11-13 from the brief `Vanguard_OG_Expanded_GBT01_Playtest_and_Claude_Code_Prompt.docx`
(Desktop), which transcribes the workbook _OG expanded list G-Booster.xlsx_, sheet _G BT01_. The
workbook itself is not on this PC; the card list below is taken from the brief.

**Status: provisional playtest.** Nothing here is a balance verdict, and the pool is not labelled
balanced or tournament legal. No card was changed: every card keeps its official text and script.

## How it is wired

- **Format:** the existing _Original Era — Expanded_ (`classic_ou`, Original Era rules CR 1.29).
  The owner chose this over a new format id. _Original Era — Strict_ and the _G Era_ are unchanged.
- **Pool:** the OU list `data/ou/ou-list.json`, now **v1.1**. The 42 "Yes" cards are `approved`.
  The 7 "No" cards have the new status `held`: kept on the list, not legal by default.
- **Comparison toggle:** `ouApproved(list, { includeHeld: true })` gives the pool with the held
  cards, for an A/B test (tests/decks/ogPlaytest.test.ts shows it). There is no in-app switch.
- **Card records:** none copied or duplicated. Each entry names an existing G-BT01 card id.
- **Workbook spellings:** three names differ from the official card data, which is kept:
  Katanaraizer (workbook "Katanarazier"), Extreme Battler Hajimal, Mirror Image, Gesolaz.
- **Blockers:** `npm run ou -- list` finds no card that needs G era rules (no Stride, Generation
  Break, G zone, hearts or G units) among the 42.
- **Deck picker:** in Original Era — Expanded a **G-BT01 PLAYTEST** section comes first.
- **Saved games:** they already record the OU list version (`ouListVersion`).

## The 42 approved cards

| Card       | Name                            | Clan              | Grade | In a playtest deck |
| ---------- | ------------------------------- | ----------------- | ----- | ------------------ |
| G-BT01-006 | Dragonic Overlord "The X"       | Kagero            | 3     | yes                |
| G-BT01-020 | Relic Master Dragon             | Gear Chronicle    | 2     | no                 |
| G-BT01-023 | Starlight Violinist             | Royal Paladin     | 2     | yes                |
| G-BT01-026 | Obligate Robin                  | Oracle Think Tank | 2     | yes                |
| G-BT01-037 | Masuraoraizer                   | Nova Grappler     | 2     | yes                |
| G-BT01-039 | Ruin Disposal Dragon            | Gear Chronicle    | 3     | no                 |
| G-BT01-040 | Steam Knight, Puzur-Ili         | Gear Chronicle    | 2     | no                 |
| G-BT01-042 | Steam Scara, Gigi               | Gear Chronicle    | 1     | no                 |
| G-BT01-045 | Seeker, Proudroar Lion          | Royal Paladin     | 2     | yes                |
| G-BT01-047 | Knight of Shield Bash           | Royal Paladin     | 1     | yes                |
| G-BT01-048 | Bravogal Seeker                 | Royal Paladin     | 1     | yes                |
| G-BT01-049 | Knight of Drawn Sword           | Royal Paladin     | 0     | no                 |
| G-BT01-050 | Knight of Flash                 | Royal Paladin     | 0     | yes                |
| G-BT01-053 | Imperial Shrine Guard, Asuha    | Oracle Think Tank | 2     | yes                |
| G-BT01-056 | Battle Sister, Marshmallow      | Oracle Think Tank | 2     | yes                |
| G-BT01-057 | Imperial Shrine Guard, Tsunagai | Oracle Think Tank | 1     | yes                |
| G-BT01-059 | Battle Sister, Lollipop         | Oracle Think Tank | 1     | yes                |
| G-BT01-061 | Assault Dive Eagle              | Oracle Think Tank | 0     | yes                |
| G-BT01-062 | Windfall, Daikokuten            | Oracle Think Tank | 0     | yes                |
| G-BT01-063 | Diviner, Sukunahikona           | Oracle Think Tank | 0     | yes                |
| G-BT01-064 | Paisley Magus                   | Oracle Think Tank | 0     | no                 |
| G-BT01-067 | Wyvern Strike, Doha             | Kagero            | 2     | yes                |
| G-BT01-069 | Hulkroar Dragon                 | Kagero            | 2     | yes                |
| G-BT01-070 | Perdition Berserker, Preta      | Kagero            | 2     | no                 |
| G-BT01-072 | Wyvern Strike, Garan            | Kagero            | 1     | yes                |
| G-BT01-075 | Dragon Knight, Rashid           | Kagero            | 0     | yes                |
| G-BT01-076 | Magnum Shot Dracokid            | Kagero            | 0     | yes                |
| G-BT01-077 | Dragon Dancer Ekaterina         | Kagero            | 0     | yes                |
| G-BT01-078 | Mother Orb Dragon               | Kagero            | 0     | yes                |
| G-BT01-081 | Extreme Battler, Kenbeam        | Nova Grappler     | 2     | no                 |
| G-BT01-084 | Starlight Hedgehog              | Nova Grappler     | 2     | yes                |
| G-BT01-085 | Extreme Battler, Kendhol        | Nova Grappler     | 1     | no                 |
| G-BT01-087 | Katanaraizer                    | Nova Grappler     | 1     | yes                |
| G-BT01-088 | Beast Deity, Frog Master        | Nova Grappler     | 1     | yes                |
| G-BT01-091 | Extreme Battler Hajimal         | Nova Grappler     | 0     | no                 |
| G-BT01-092 | Extreme Battler, Zanbhara       | Nova Grappler     | 0     | yes                |
| G-BT01-093 | Drone Baron                     | Nova Grappler     | 0     | yes                |
| G-BT01-094 | Mirror Image, Gesolaz           | Nova Grappler     | 0     | yes                |
| G-BT01-095 | Ring Girl, Ai                   | Nova Grappler     | 0     | yes                |
| G-BT01-100 | Steam Rider, Dizkal             | Gear Chronicle    | 1     | no                 |
| G-BT01-101 | Timepiece Dracokid              | Gear Chronicle    | 0     | no                 |
| G-BT01-102 | Steam Battler, Meshda           | Gear Chronicle    | 0     | no                 |

## The 7 held cards

| Card       | Name                      | Clan              |
| ---------- | ------------------------- | ----------------- |
| G-BT01-011 | Holy Knight Guardian      | Royal Paladin     |
| G-BT01-013 | Arbitrator, Ame-no-Sagiri | Oracle Think Tank |
| G-BT01-016 | Protect Orb Dragon        | Kagero            |
| G-BT01-018 | Lady Cyclone              | Nova Grappler     |
| G-BT01-021 | Steam Maiden, Arlim       | Gear Chronicle    |
| G-BT01-031 | Energy Flame, Aethonic    | Kagero            |
| G-BT01-074 | Perdition Dancer, Anna    | Kagero            |

Held for a later comparison test: the five Counter-Charge sentinels, then Aethonic and Perdition
Dancer, Anna (Counter-Charge 2 on a grade 1).

## Playtest decks

Each deck is one of our starter decks with some cards swapped for the clan's G-BT01 cards. The
swaps are listed in `src/decks/ogPlaytest.ts`. Counts stay legal: 16 triggers, at most four heals
and four sentinels, one clan.

| Deck                             | Made from                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Royal Paladin Seekers            | Seeker, Thing Saver Dragon                                                      |
| Kagero "The X"                   | Dragonic Overlord (BT01), with Dragonic Overlord the End as The X's Legion mate |
| Oracle Think Tank Battle Sisters | Battle Sister, Fromage                                                          |
| Nova Grappler Raizers            | Ultimate Raizer Mega-flare                                                      |

**Gear Chronicle has no deck.** The pool holds only its seven G-BT01 cards. At four copies that is
28 cards, with no heal, draw or stand trigger and no sentinel, so a legal 50-card deck cannot be
built. Owner decision needed: approve more Gear Chronicle cards, or leave the clan out.

Approved cards not in any playtest deck (still legal in player decks): the seven Gear Chronicle
cards, Knight of Drawn Sword (the Seeker deck keeps its own forerunner), Paisley Magus (needs a
Magus vanguard), Perdition Berserker, Preta (needs a Perdition vanguard), and the Nova Grappler
vanillas Kenbeam, Kendhol and Hajimal.

## AI metrics

`npm run og:playtest -- <games> --ai smart|basic`: each playtest deck plays the starter deck it was
made from, seats alternating. Win rate is the playtest deck's. Ability counts are resolutions per
game, both decks; [CONT] abilities (Lollipop, Frog Master) are not counted.

### Basic AI, 100 games per pairing (seed 2000)

| Playtest deck                    | Wins | 95% interval | Turns |
| -------------------------------- | ---- | ------------ | ----- |
| Royal Paladin Seekers            | 44%  | 35–54%       | 13.7  |
| Kagero "The X"                   | 55%  | 45–64%       | 12.3  |
| Oracle Think Tank Battle Sisters | 51%  | 41–61%       | 13.4  |
| Nova Grappler Raizers            | 42%  | 33–52%       | 12.7  |

Per game: Starlight Violinist 0.41, Proudroar Lion 0.50, Knight of Shield Bash 0.77, Bravogal
Seeker 0.33, The X 0.69, Hulkroar Dragon 0.04, Obligate Robin 0.33, Marshmallow 0.43, Starlight
Hedgehog 0.83, Katanaraizer 0.48, Masuraoraizer 0.

### Hard AI, 20 games per pairing (seed 2000)

| Playtest deck                    | Wins | 95% interval | Turns |
| -------------------------------- | ---- | ------------ | ----- |
| Royal Paladin Seekers            | 55%  | 34–74%       | 11.6  |
| Kagero "The X"                   | 50%  | 30–70%       | 12.4  |
| Oracle Think Tank Battle Sisters | 50%  | 30–70%       | 12.7  |
| Nova Grappler Raizers            | 65%  | 43–82%       | 9.6   |

Per game: Starlight Violinist 0.45, Proudroar Lion 0.35, Knight of Shield Bash 0.60, Bravogal
Seeker 0.10, The X 1.30, Obligate Robin 0.75, Marshmallow 0.65, Masuraoraizer 0.05, Starlight
Hedgehog 0.55, Katanaraizer 0.45. The Hard AI uses The X and Obligate Robin about twice as often as
the Basic AI, and does stand Masuraoraizer now and then.

### Held Counter-Charge sentinels, Basic AI, 100 games per pairing (seed 2000)

`npm run og:playtest -- 100 --ai basic --held`: each playtest deck with its four sentinels swapped
for its clan's held sentinel, against the unchanged playtest deck, in the pool with held cards.

| Deck with the held sentinel                  | Wins | 95% interval | Sentinel resolutions per game |
| -------------------------------------------- | ---- | ------------ | ----------------------------- |
| Royal Paladin, Holy Knight Guardian          | 50%  | 40–60%       | 1.13                          |
| Kagero, Protect Orb Dragon                   | 46%  | 37–56%       | 0.86                          |
| Oracle Think Tank, Arbitrator, Ame-no-Sagiri | 57%  | 47–66%       | 1.31                          |
| Nova Grappler, Lady Cyclone                  | 49%  | 39–59%       | 1.19                          |

No clear effect at this sample size. The Basic AI uses about one perfect guard a game, so the
Counter-Charge bonus (a second copy in the drop zone) rarely matters yet. A larger Hard AI run would
say more.

## Observations

- Every interval contains 50%: at this sample size no playtest deck is clearly stronger or weaker
  than the deck it came from.
- **Masuraoraizer almost never resolves** (Basic AI 0, Hard AI 0.05 a game). The rules work (tests/cards/G-BT01.test.ts, and a stand
  trigger counts as an effect of your card). In 100 games the Basic AI called it 47 times but chose
  other rear-guards for all 143 of its effect stands. This is an AI choice to look at, not a card
  change.
- **Hulkroar Dragon** rarely fires: the BT01 Kagero list retires few rear-guards by effect.
- No game was truncated and no zone invariant broke (tests/decks/ogPlaytest.test.ts).

## Not done yet

- No rebalancing: none is planned without the owner's say-so.
- The workbook's Decision column is still blank; fill it only after playtesting.
- Held-card comparison: only the Basic AI sentinel run above. Aethonic and Perdition Dancer, Anna
  are not compared yet: Anna needs a Perdition vanguard; Aethonic could go in the Kagero deck.
