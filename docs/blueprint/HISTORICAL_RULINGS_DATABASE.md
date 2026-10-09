# Historical Rules & Rulings Database
## VG-BT01 through VG-BT17

The simulator must preserve historical Vanguard behaviour. When card text alone is insufficient, record the ruling explicitly.

Track:
- Rule/ruling ID
- Situation
- Expected result
- Reasoning
- Affected cards/mechanics
- Source(s)
- Verification status
- Engine implementation status
- Regression test

Important areas:
- Ride and superior ride
- Drive checks
- Damage checks
- Trigger resolution
- Sentinel/Perfect Guard
- Intercept
- Boost
- Counter-Blast
- Soul-Blast
- Soul Charge
- Counter Charge
- Limit Break
- Break Ride
- Persona Blast
- Ultimate Break
- Lock
- Unlock
- Legion
- Legion Mate
- Retire timing
- Simultaneous effects
- Cost vs effect
- "When placed"
- "When this unit attacks"
- End-of-turn effects
- Temporary power changes
- Choice effects
- Heal trigger restrictions
- Multiple trigger effects
- Attack timing and priority

Rule:
If a historical interaction is uncertain, mark it `needs_review`; do not invent behaviour.

Every resolved ruling should receive an automated regression test where practical.
