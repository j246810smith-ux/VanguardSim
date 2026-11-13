# Card motion polish: draw and placement (proposal, 2026-11-13)

The user asked for game polish, "maybe a draw animation and maybe a placement animation", and for
assets to use. **Nothing here is built yet: waiting for the user's approval.**

## What the game does today

| Moment               | Movement (app/renderer/board/motion.ts)                                           | Sound (audio/catalog.ts)                              |
| -------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Draw (since 0.40)    | Lifts off the deck as a sleeve back, turns over mid-flight, settles into the hand | Kenney card slide                                     |
| Call / ride / stride | A flat copy flies from the hand to the circle and fades into the real card        | Kenney card place / heavy place, timed to the landing |
| Retire, soul, drop   | Flies into the zone tile                                                          | Card slide                                            |

Missing: anything that happens **when a card lands**. The card just appears. There is also no
light or depth during flight, so a draw and a call look flat on the tilted table.

## Proposal

All of it follows the existing switches: off with Reduced motion, Instant speed and Low graphics,
plus its own Settings switch, **Card effects**. It is presentation only, so the rules never wait for it.

1. **Placement "slam".** The flying card lands slightly too big and settles: 108% → 97% → 100%,
   in the last fifth of the flight. A soft shadow grows under it as it comes down.
2. **Circle impact.** A ring of light spreads from the circle as the card lands, in the player's
   side colour (blue for you, red for the opponent).
   - A call gets one thin ring.
   - A ride gets a stronger ring plus a few sparks.
   - A stride or legion gets a double ring, sparks and a short flash on the circle.
   - A guardian called to (GC) gets a shield shimmer instead.
3. **Draw, more weight.** The deck's top card rises a little before it leaves. A faint light trail
   follows the card, and a light sweep crosses the face as it turns over.
4. **Leaving the field (optional).** A retired unit sinks and fades with a small dust puff instead
   of only flying to the drop tile.

## Assets

- **Rings, shadow, flash and light sweep:** pure CSS gradients, with no image files. They stay
  sharp at any screen size and add nothing to the download.
- **Sparks and dust:** [Kenney Particle Pack](https://kenney.nl/assets/particle-pack), 80
  sprites, **CC0** (the same author and licence as the game's sound effects, see
  docs/audio-licenses/README.md). About 4–6 sprites would be shrunk to small WebP files, tinted by
  CSS, and listed file by file in a licence manifest like the audio one.
- **Sounds:** already in the game, from [Kenney Casino Audio](https://kenney.nl/assets/casino-audio)
  (CC0). Only the impact for a stride might gain a soft extra layer from the Impact Sounds pack
  already bundled.
- Looked at and not needed: "Ring Explosion" (OpenGameArt, CC0, 56 frames). A sprite sheet is
  heavier than a CSS ring and looks blurry when scaled.

## Phone

The same effects run on Android. Sparks are fewer there (4 instead of 8) and the trail is off on
Low graphics. Each effect is a short Web Animations run on a few elements, like the existing flights.

## Order of work

1. Slam and circle rings: the most visible change.
2. Draw polish.
3. Sparks and dust with the Kenney sprites.
4. Retire puff, if wanted.

Then screenshots, `ui:shots`, a motion test, a check on the phone, and a release.
