# Cardfight!! Vanguard VG-BT01 → VG-BT17
# CLAUDE CODE MASTER BUILD PACK

This folder contains the complete planning/specification material for building the historical Cardfight!! Vanguard simulator.

## IMPORTANT SOURCE POLICY

Use both:
- Vanguard Wiki / established Vanguard databases for discovery and historical cross-checking.
- Official Bushiroad Cardfight!! Vanguard database for verification.

Official Bushiroad is the authoritative source for factual card data when an official record is available.

## CANONICAL POOL

The intended canonical historical pool is Japanese-original:
VG-BT01 through VG-BT17.

English/localized data can be stored alongside it.

BT17 requires special care because English BT17 product composition is not necessarily identical to Japanese VG-BT17.

## HOW CLAUDE SHOULD WORK

1. Read all specifications before major implementation.
2. Inspect the existing repository.
3. Identify dependencies and conflicts.
4. Build and validate the engine before mass card import.
5. Build generic mechanics rather than one-off card hacks.
6. Use the card source/verification pipeline.
7. Test every implemented mechanic and card interaction.
8. Keep UI, AI and persistence separate from the rules engine.
9. Use deterministic seeded RNG.
10. Never silently guess historical rulings.
11. Maintain implementation and verification reports.
12. Run the final audit before declaring completion.

## SOURCE RULE

Find it → record it → verify it against Bushiroad → cross-check Vanguard Wiki → resolve differences → preserve provenance → implement → test → mark complete.

No guessing.
No silent corrections.
No unverified mass imports.
