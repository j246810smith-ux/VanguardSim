# TEST PLAN

## Engine smoke tests

- create game
- create two players
- load decks
- shuffle deterministically
- draw opening hands
- perform mulligan
- start turn

## Turn tests

- stand
- draw
- ride
- main phase
- battle phase
- end phase
- next player

## Combat tests

- attack
- boost
- guard
- intercept
- hit
- no hit
- Vanguard drive check
- rear-guard attack
- multiple attackers

## Trigger tests

- critical
- draw
- stand
- heal
- trigger recipient selection
- trigger ordering

## Cost tests

- Counter-Blast
- Soul-Blast
- discard
- retire
- insufficient cost
- optional cost

## Zone tests

Every card movement must be tested.

## Choice tests

- choose one
- choose multiple
- optional choice
- invalid choice
- cancelled choice

## Determinism

Same seed + same commands = identical event stream.

## Regression

Every discovered bug creates a permanent regression test.

## Set completion

A set cannot be marked complete until:

- all card records pass schema validation
- no unknown ability keywords remain
- no missing effect implementations remain
- required images are accounted for
- complex cards have tests
