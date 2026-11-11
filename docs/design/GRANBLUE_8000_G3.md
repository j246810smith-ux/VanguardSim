# The 8000-power Granblue grade 3 (six-workstream brief, W6) — report, no change made

## The card

A search of every set in `data/cards/` for grade 3 with 8000 base power finds **exactly one card**:

|                      |                                                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card                 | **BT02-012 Witch Doctor of the Abyss, Negromarl** (also BT02/S10; English BT02/012EN)                                                                                                          |
| Clan / grade / power | Granblue, grade 3, **8000**, critical 1, Twin Drive, RR                                                                                                                                        |
| Text                 | [AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a «Granblue» vanguard, you may pay the cost. If you do, choose a card from your drop zone, and call it to (RC). |
| Script               | `src/cards/BT02.ts` `BT02-012`: `placedOn(['VC','RC'])`, condition Granblue vanguard, cost CB2, optional, choose a card in your drop zone, superior call it. Matches the official text.        |

Every other grade 3 in the pool has 9000 or more, so any rule "for 8000-power grade 3s" is in
practice a rule for this one card.

## Why it feels weak

- As the **vanguard**, 8000 is the lowest grade 3 defence in the game: an unboosted 8000 rear-guard
  hits it, where a 10000 vanguard needs 10000 to be hit. Its attacks are also 2000 below a 10000
  vanguard's with the same booster (e.g. 8000 + 8000 boost = 16000 against 18000).
- As a **rear-guard**, 8000 is normal for its job: the card is played for its on-place call (a
  free extra unit from the drop zone), the usual Granblue plan.

## What "+2000 or +3000 when boosted" could mean

1. **A bonus only when it is boosted** (attack only): it fixes half the problem (attack power) and
   none of the other half (defence at 8000). It would also be a new kind of rule, unlike anything
   in the game today.
2. **A permanent change to the card's power**: not allowed by the brief or by the card data policy
   (official data is authoritative; changing it would also change replays and online legality).
3. **A house rule on the vanguard circle**, like the existing **9K Grade 3** rule (C1: a printed
   9000 grade 3 vanguard gets +1000 or +2000 on (VC), Original Era only, off by default). This
   fits the game's existing design and touches no card data.

## +2000 compared with +3000

|       | On (VC) | Compared with                                                                                                                                                                       |
| ----- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| +2000 | 10000   | the same as a vanilla 10000 grade 3; it keeps its CB2 call ability, as many 10000 grade 3s keep theirs                                                                              |
| +3000 | 11000   | above the 10000 grade 3s, level with a 9K unit at the 9K rule's top setting (+2000); with its free call ability it would outclass the vanilla grade 3s it is meant to catch up with |

## Recommendation

- **Do not change the card.** If anything is done, make it a house rule, off by default, Original
  Era only, extending the 9K Grade 3 rule: "a vanguard whose printed grade is 3 and printed power is
  8000 gets **+2000** on (VC)" (brings it to parity, 10000). Keep it on (VC) only: on (RC) its 8000
  is normal for its job.
- **+3000 is not recommended**: it overshoots parity and would make this card stronger than the
  vanilla grade 3s it is meant to catch up with.
- A boost-only bonus is not recommended: it leaves the defence problem and adds a new mechanic.

**Waiting for the owner's decision.** Nothing has been implemented.
