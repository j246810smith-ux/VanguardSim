# CARD DATA SOURCE & VERIFICATION POLICY
## Cardfight!! Vanguard — VG-BT01 through VG-BT17

### Purpose

This document tells Claude Code exactly where to obtain Cardfight!! Vanguard card information for the BT01–BT17 simulator and how every card must be verified before being accepted into the project database.

The project may use BOTH:
1. Vanguard Wiki / established Vanguard community databases for discovery and cross-reference.
2. The official Bushiroad Cardfight!! Vanguard card database as the authoritative verification source.

Do not treat a community database as sufficient by itself.

---

## 1. CANONICAL CARD POOL

The target card pool is:

- VG-BT01
- VG-BT02
- VG-BT03
- VG-BT04
- VG-BT05
- VG-BT06
- VG-BT07
- VG-BT08
- VG-BT09
- VG-BT10
- VG-BT11
- VG-BT12
- VG-BT13
- VG-BT14
- VG-BT15
- VG-BT16
- VG-BT17

For historical accuracy, treat the Japanese-original VG-BT01–VG-BT17 set identities as the canonical set structure unless the project configuration explicitly says otherwise.

English/localized information may be stored as additional metadata.

IMPORTANT:
The English BT17 product is not necessarily a one-to-one reproduction of Japanese VG-BT17. The official English product/card list can contain a different localized set composition. Do not silently merge Japanese and English set contents.

---

## 2. PRIMARY SOURCE — OFFICIAL BUSHIROAD DATABASE

Official English card database:

https://en.cf-vanguard.com/cardlist/

Official Japanese card database:

https://cf-vanguard.com/cardlist/

Use the official database to VERIFY:

- Card number
- Card name
- Grade
- Clan
- Card type
- Power
- Shield
- Trigger type
- Skill/effect text
- Race where relevant
- Rarity
- Product/set association
- Historical card wording where available
- Official localized wording where applicable

The official database is the final verification authority for card facts.

When a community source and the official source disagree, the official source wins for factual card data unless a historical-format issue is explicitly documented.

---

## 3. SECONDARY SOURCE — VANGUARD WIKI

Use Vanguard Wiki as a major research and discovery source.

Useful pages include:

- List of Vanguard cards
- List of Cardfight!! Vanguard Booster Sets
- Individual booster-set pages
- Set galleries
- Individual card pages
- Historical mechanic/ruling pages

Vanguard Wiki is particularly useful for:

- Finding every card belonging to a historical set
- Discovering card relationships
- Historical terminology
- Japanese/English name relationships
- Card image references
- Clan/mechanic context
- Identifying cards that may be difficult to locate in the official database
- Cross-checking card effects
- Finding related cards and rulings

However:

> NEVER mark a card VERIFIED using Vanguard Wiki alone.

Every card should be checked against the official Bushiroad database whenever an official record is available.

---

## 4. SOURCE PRIORITY

Use this order:

### Priority 1 — Official Bushiroad
For factual card data.

### Priority 2 — Vanguard Wiki / established card databases
For discovery, historical context, relationships, images and cross-checking.

### Priority 3 — Other community sources
Use only when needed to resolve missing information, historical wording, rulings or image references.

### Priority 4 — Search-engine snippets/forums/social posts
Discovery only. Never use these as the final authority for card data.

---

## 5. REQUIRED CARD IMPORT WORKFLOW

For EVERY card:

### Step 1 — Discover
Find the card through the Vanguard Wiki/set gallery or another reliable database.

Record:

- Set
- Card number
- Name
- Grade
- Clan
- Type
- Rarity
- Trigger
- Power
- Shield
- Skill text
- Image/reference if available

### Step 2 — Official verification
Search the official Bushiroad database using:

- Card number first
- Exact card name second
- Set/product third

Compare every field.

### Step 3 — Resolve differences
If the sources disagree:

1. Check official Bushiroad.
2. Check Japanese official data if the card is from a Japanese-original set.
3. Check Vanguard Wiki historical information.
4. Check another established database if necessary.
5. Record the disagreement in the research log.
6. Do NOT silently guess.

### Step 4 — Store provenance
Every imported card should contain source metadata.

Recommended structure:

```json
{
  "sources": {
    "discovery": {
      "provider": "Vanguard Wiki",
      "url": "",
      "checkedAt": ""
    },
    "officialVerification": {
      "provider": "Bushiroad",
      "url": "",
      "checkedAt": ""
    }
  },
  "verificationStatus": "verified"
}
```

### Step 5 — Only then mark the card complete

Recommended statuses:

- `discovered`
- `imported`
- `officially_verified`
- `effect_implemented`
- `image_verified`
- `tested`
- `complete`
- `needs_review`

A card is NOT complete merely because its JSON exists.

---

## 6. WHAT CLAUDE MUST DOUBLE-CHECK

Claude must compare at minimum:

| Field | Wiki / Database | Official |
|---|---|---|
| Card number | ✓ | ✓ |
| Card name | ✓ | ✓ |
| Grade | ✓ | ✓ |
| Clan | ✓ | ✓ |
| Type | ✓ | ✓ |
| Power | ✓ | ✓ |
| Shield | ✓ | ✓ |
| Trigger | ✓ | ✓ |
| Rarity | ✓ | ✓ |
| Skill text | ✓ | ✓ |
| Set membership | ✓ | ✓ |
| Image/reference | ✓ | when available |

Do not assume that because two sources show the same card name, all other fields are correct.

---

## 7. JAPANESE VS ENGLISH DATA

The engine should separate:

### Canonical card identity
The historical card/set identity.

### Localization
Language-specific:

- Japanese name
- English name
- Japanese skill text
- English skill text

Do not create two different gameplay cards simply because Japanese and English names differ.

Recommended:

```json
{
  "cardId": "BT01-001",
  "set": "VG-BT01",
  "localization": {
    "ja": {
      "name": "",
      "text": ""
    },
    "en": {
      "name": "",
      "text": ""
    }
  }
}
```

The simulator's rules engine should operate on normalized effect definitions, not raw printed language.

---

## 8. IMPORTANT BT17 WARNING

BT17 requires special handling.

Japanese VG-BT17 and English BT17/Blazing Perdition ver.E are not guaranteed to contain identical card pools.

Claude MUST:

1. Keep Japanese VG-BT17 set membership separate.
2. Keep English BT17 localized product membership separate.
3. Never assume `BT17/001` means the same card in every regional database.
4. Preserve regional card-number metadata.
5. Record localization/product differences explicitly.

If the project is configured for the Japanese-original VG-BT01–VG-BT17 pool, Japanese set membership is canonical.

---

## 9. EFFECT TEXT IS NOT THE ENGINE

Raw card text must NOT directly control UI or game state.

Pipeline:

```text
Source Card Text
       ↓
Normalized Card Data
       ↓
Effect Parser / Manual Mapping
       ↓
Generic Effect Definitions
       ↓
Rules Engine
       ↓
Game State
       ↓
Events
       ↓
UI
```

If an effect cannot safely be translated into the engine:

- mark it `needs_review`
- document the problem
- do not invent a mechanic
- do not approximate silently
- do not mark the card complete

---

## 10. HISTORICAL WORDING

Historical Vanguard wording matters.

Do not automatically replace old wording with modern Vanguard terminology.

Preserve:

- Historical card text
- Historical timing
- Historical costs
- Historical restrictions
- Historical terminology

Then map that text to the normalized engine effect model.

The engine must reproduce the target historical ruleset, not modern Vanguard rules.

---

## 11. CARD IMAGES / ARTWORK

Artwork should be sourced separately from gameplay data.

Preferred process:

1. Identify the correct card through Vanguard Wiki/set gallery or official card database.
2. Verify the card identity.
3. Obtain the correct card image/reference.
4. Match image to card number.
5. Store the asset using the canonical card ID.
6. Validate that the artwork belongs to the correct card/version.

Do not use an image simply because the card name matches.

Pay attention to:

- Japanese vs English print
- Reprints
- SP versions
- Alternate artwork
- Different card numbers
- Errata/reprints

If the image source is uncertain, mark:

`imageStatus: "needs_review"`

Do not fabricate official artwork.

---

## 12. AUTOMATED VALIDATION

Claude should build validation tools that can detect:

- Duplicate card IDs
- Missing card numbers
- Missing names
- Missing grade
- Missing clan
- Missing power
- Missing shield where applicable
- Missing trigger metadata
- Missing effect definition
- Missing source URL
- Missing official verification
- Missing image
- Invalid set membership
- English/Japanese identity collisions
- Cards marked complete without tests
- Cards marked complete without official verification

Recommended command examples:

```bash
npm run cards:validate
npm run cards:report
npm run cards:missing
npm run cards:unverified
npm run cards:images
npm run cards:tests
```

Adapt commands to the actual project tooling.

---

## 13. RESEARCH LOG

Create:

`data/research/source_verification_log.json`

Each unresolved issue should record:

```json
{
  "cardId": "BTxx-xxx",
  "issue": "",
  "sourcesChecked": [],
  "officialResult": "",
  "wikiResult": "",
  "decision": "",
  "status": "resolved"
}
```

Never hide a source conflict.

---

## 14. CARD COMPLETION GATE

A card may only be marked `complete` when:

- [ ] Identity verified
- [ ] Set verified
- [ ] Card data imported
- [ ] Official Bushiroad source checked
- [ ] Skill text checked
- [ ] Effect implemented
- [ ] Historical timing verified
- [ ] Image matched or explicitly marked unavailable
- [ ] Unit/effect tests pass
- [ ] Edge cases tested
- [ ] No unresolved source conflict

---

## 15. CLAUDE CODE OPERATING RULE

Claude must follow this rule:

> Discover broadly, verify officially, normalize carefully, implement generically, test mechanically, and document every uncertainty.

Claude should never mass-import hundreds of cards and assume the data is correct.

Instead:

1. Build the schema.
2. Import a small representative sample.
3. Verify the pipeline.
4. Validate the sample.
5. Then process the remaining sets in batches.
6. Run automated validation after every batch.
7. Reconcile all source conflicts before release.

---

## 16. EXPECTED SET-BY-SET PROCESS

Process:

```text
VG-BT01
  ↓
verify
  ↓
test
  ↓
VG-BT02
  ↓
verify
  ↓
test
  ↓
...
  ↓
VG-BT17
  ↓
final audit
```

Do not skip verification because a set has a large number of cards.

---

## 17. FINAL CARD DATABASE REQUIREMENT

Before the simulator is declared content-complete, Claude must produce:

- Total cards discovered
- Total cards imported
- Total officially verified
- Total effects implemented
- Total images matched
- Total cards tested
- Total complete
- Total needing review
- List of unresolved source conflicts
- List of missing images
- List of missing effects
- List of cards with special historical rulings

Example report:

```text
BT01–BT17 CARD CONTENT AUDIT

Discovered:             XXXX
Imported:               XXXX
Officially Verified:    XXXX
Effects Implemented:    XXXX
Images Matched:         XXXX
Tests Passed:           XXXX
Complete:               XXXX
Needs Review:           XX

UNRESOLVED:
- BTxx/xxx — reason

MISSING IMAGES:
- BTxx/xxx

MISSING EFFECTS:
- BTxx/xxx
```

The project is NOT content-complete while important cards remain unverified or unresolved.

---

## 18. SOURCE LINKS

Official English Card Database:
https://en.cf-vanguard.com/cardlist/

Official Japanese Card Database:
https://cf-vanguard.com/cardlist/

Vanguard Wiki — Card List:
https://cardfightvanguard.fandom.com/wiki/List_of_Vanguard_cards

Vanguard Wiki — Booster Sets:
https://cardfight.fandom.com/wiki/List_of_Cardfight!!_Vanguard_Booster_Sets

Use the current official Bushiroad database and relevant historical Wiki set pages rather than relying on search snippets alone.

---

## FINAL INSTRUCTION TO CLAUDE

For every card in VG-BT01 through VG-BT17:

**Find it → record it → verify it against Bushiroad → cross-check Vanguard Wiki → resolve differences → preserve provenance → implement → test → only then mark complete.**

No guessing.
No silent corrections.
No unverified mass imports.
No mixing regional set lists without explicit configuration.
