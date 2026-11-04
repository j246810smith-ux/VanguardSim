# Deck Intelligence and AI Training: progress

Tracker across sessions. Design and audit: `AUDIT_AND_ARCHITECTURE.md`.

## The request (user, 2026-11-04), in short

A historically researched deck library for BT01–BT17 and contemporary side sets, trial decks and PR
cards, covering every clan, weak ones too, in the existing simulator and rules engine. Every deck has
exact counts, a cutoff, sources and a confidence label: VERIFIED, PARTIALLY VERIFIED, RECONSTRUCTED or
EXPERIMENTAL. Nothing is invented. Every deck has a strategy profile: win condition, rides, mulligan,
field, resources, combat, defence, recovery, matchups (no invented win rates). The AI uses the profile
in layers (legal actions, deck identity, strategy, evaluation, execution) and logs real decision
reasons. A training arena: single match, series, round robin, clan championship, self-play, deck
testing, spectator controls, fixed seeds, no-animation mode. Metrics, alternative-action analysis,
versioned strategy weights promoted only on statistical evidence, and a matchup database labelled as
simulated. UI: Deck Intelligence and AI Training sections, usable with mouse and controller, browse,
filter, compare, load, copy to the builder, favourites. Validation and a report after every phase.

The user also said: remove the trial and starter decks and replace them with these decks and decks
built by Claude.

## Status

| Stage                                       | Status                             |
| ------------------------------------------- | ---------------------------------- |
| 1 Audit and proposed architecture           | Done, user's answers below         |
| 2 Card pool, release table, research        | **Part done** (below)              |
| 3 Library format and validator              | Done                               |
| 4 First sample of sourced decks             | Done (11 decks)                    |
| 5 Strategy profiles                         | Done (20 decks)                    |
| 6 Deck-aware AI                             | Built, measured 50.0% (n=420), off |
| 7 Spectator arena                           | Not started                        |
| 8 Match batches                             | Not started                        |
| 9 Analytics and matchup database            | Not started                        |
| 10 Strategy optimisation                    | Not started                        |
| 11 All clans; menus switch; presets removed | Not started                        |
| 12 Regression tests and documents           | Not started                        |

## User's answers (2026-11-04, all recommended)

A deck's cutoff uses the release dates of its source's region. The G Trial Decks stay until G decks
get their own research. Controller support comes after the first sample of decks, with the button map
approved by the user first.

## Research status

- **Japanese release dates:** done, official (`data/releases.json`, with every PR card's first year).
- **English release dates:** not done. An English-region deck cannot pass the validator until they
  are, which is why the sample is all Japanese events.
- **Sources extracted:** 545 era posts from the vanguardus blog, 448 complete 50-card lists, 231 with
  every card resolved (`scripts/decks/extractLists.py`, output git-ignored). Names reviewed by eye in
  `data/decks/nameAliases.json`. Unresolved names stop a list.
- **Lists found, by clan:** Kagero 94, Royal Paladin 78, Narukami 52, Gold Paladin 51, Shadow Paladin
  45, Link Joker 26, Nova Grappler 23, Oracle Think Tank 20, Spike Brothers 10, Bermuda Triangle 8,
  Genesis 7, Dimension Police 6, Aqua Force 6, Pale Moon 5, Dark Irregulars 3, Neo Nectar 3, Angel
  Feather 3, Great Nature 2, Megacolony 2, Granblue 2, Tachikaze 1. **None yet:** Murakumo, Nubatama.
- **Name check:** the source's grade section and trigger mark must agree with the card a name resolves
  to, or the list stops. This caught a wrong alias that the 4-copy limit alone only found by luck.
- **Attribution:** always read in context. In results posts, the line directly above a list names who played it.

## Deck coverage

10 of 23 clans. **VERIFIED 19:** Royal Paladin (2), Gold Paladin (2), Spike Brothers, Oracle Think
Tank, Narukami (2), Pale Moon, Dimension Police, Link Joker (3), Kagero (4), Shadow Paladin (2).
**PARTIALLY VERIFIED 1:** Blaster Blade Burst (official cards, our counts). RECONSTRUCTED 0,
EXPERIMENTAL 0. The old presets have no sources and do not count. Add a deck:
`data/decks/selection.json`, then `python scripts/decks/buildLibrary.py`.

**Top meta decks (user, 2026-11-04):** 2013–2014 only for now. By reported lists: 2013 Gauntlet
Buster, Raging Form, Round Table Alfred, Infinite Zero, Overlord the End; 2014 Thing Saver, Phantom
Blaster "Abyss", Dauntless Drive, Dragonic Overlord, Glendios. All are in the library. These counts
show what one blog reported, mostly from Japan, not the whole field. 2015–2017 would be a separate
phase: G-era sets and a new source, since this blog has no lists for 2016–2017.

## Source leads

- `vanguardus.blogspot.com`: full lists with counts, read through Blogger's public feed. A secondary
  source written at the time: record event, date and URL.
- `en.cf-vanguard.com/?p=10638`: official past winners; check how far back it goes.
- The fan wiki refuses automated requests.

## AI

Profiles: `data/decks/profiles.json`, one per deck; each section's `basis` says source, cards or both,
and a null `matchups` means no evidence. The AI reads the `ai` part through `SmartOptions.profile`
(`src/ai/profile.ts`): ride order, break ride at four damage, mulligan, held cards, call order. It is
**off in the game**: it measured 50.0% over 420 games against plain Hard, so no gain yet
(`npm run ai:bench -- 70 --a smart-profile --b smart --decks library`). The library decks are selectable
in Game Setup and CPU Demonstration, under TOURNAMENT DECKS, above the old presets.
Next-turn lookahead was measured and rejected (`docs/ai/AI_AUDIT_AND_PLAN.md`).
