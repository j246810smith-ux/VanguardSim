/**
 * G-BT01 playtest decks for Original Era — Expanded (OU list v1.1, docs/playtest/GBT01_OG_EXPANDED.md).
 * Our own builds, not official products and not a balance verdict: each is one of our starter decks
 * with some of its cards swapped for the clan's approved G-BT01 cards, so the new cards can be
 * played against the deck they came from. Every swap keeps the deck's counts (16 triggers, at most
 * four heals and four sentinels).
 *
 * Gear Chronicle has no deck: the pool has only its seven G-BT01 cards (28 cards at four copies,
 * no heal, draw or stand trigger and no sentinel), so a legal 50-card deck cannot be built.
 */
import { STARTER_DECKS, type StarterDeck } from './starters';

/** [card to take out, card to put in, copies]. */
type Swap = readonly [out: string, into: string, count: number];

interface PlaytestSpec {
  readonly clan: string;
  readonly base: string;
  readonly name: string;
  readonly swaps: readonly Swap[];
}

export const OG_PLAYTEST_SPECS: readonly PlaytestSpec[] = [
  {
    clan: 'Royal Paladin',
    base: 'Royal Paladin — Seeker, Thing Saver Dragon',
    name: 'G-BT01 Playtest · Royal Paladin Seekers',
    swaps: [
      ['BT16-023', 'G-BT01-048', 3], // Grynngal Seeker → Bravogal Seeker
      ['BT16-046', 'G-BT01-047', 3], // Heaven Arrow Seeker, Lunate → Knight of Shield Bash
      ['BT16-044', 'G-BT01-045', 3], // Heaven Bow Seeker, Morvi → Seeker, Proudroar Lion
      ['BT16-021', 'G-BT01-023', 2], // Great Crossbow Seeker, Gildas → Starlight Violinist
      ['BT16-049', 'G-BT01-050', 2], // Seeker, Hallowed Breath Dragon → Knight of Flash (critical)
    ],
  },
  {
    clan: 'Kagero',
    base: 'Kagero — Dragonic Overlord',
    name: 'G-BT01 Playtest · Kagero "The X"',
    swaps: [
      ['BT01-004', 'G-BT01-006', 4], // Dragonic Overlord → Dragonic Overlord "The X"
      ['BT01-013', 'BT05-005', 2], // Vortex Dragon → Dragonic Overlord the End (The X's Legion mate)
      ['BT01-005', 'BT05-005', 2], // Embodiment of Victory, Aleph → Dragonic Overlord the End
      ['BT01-014', 'G-BT01-069', 3], // Dragon Knight, Aleph → Hulkroar Dragon
      ['BT01-022', 'G-BT01-067', 4], // Dragon Knight, Nehalem → Wyvern Strike, Doha
      ['BT01-049', 'G-BT01-072', 3], // Dragon Monk, Gojo → Wyvern Strike, Garan
      ['BT01-024', 'G-BT01-075', 4], // Embodiment of Spear, Tahr → Dragon Knight, Rashid (critical)
      ['BT01-052', 'G-BT01-076', 4], // Lizard Soldier, Ganlu (stand) → Magnum Shot Dracokid (critical)
      ['BT01-051', 'G-BT01-077', 4], // Dragon Dancer, Monica → Dragon Dancer Ekaterina (draw)
      ['BT01-053', 'G-BT01-078', 4], // Dragon Monk, Genjo → Mother Orb Dragon (heal)
    ],
  },
  {
    clan: 'Oracle Think Tank',
    base: 'Oracle Think Tank — Battle Sister, Fromage',
    name: 'G-BT01 Playtest · Oracle Think Tank Battle Sisters',
    swaps: [
      ['EB05-015', 'G-BT01-059', 3], // Battle Sister, Cocoa → Battle Sister, Lollipop
      ['EB05-025', 'G-BT01-057', 3], // Battle Sister, Vanilla → Imperial Shrine Guard, Tsunagai
      ['EB05-010', 'G-BT01-056', 3], // Battle Sister, Glace → Battle Sister, Marshmallow
      ['EB05-019', 'G-BT01-026', 2], // Battle Sister, Tarte → Obligate Robin
      ['EB05-019', 'G-BT01-053', 2], // Battle Sister, Tarte → Imperial Shrine Guard, Asuha
      ['EB05-029', 'G-BT01-061', 2], // Battle Sister, Ginger → Assault Dive Eagle (critical)
      ['EB05-031', 'G-BT01-062', 2], // Battle Sister, Tiramisu → Windfall, Daikokuten (draw)
      ['EB05-033', 'G-BT01-063', 2], // Battle Sister, Chai → Diviner, Sukunahikona (heal)
    ],
  },
  {
    clan: 'Nova Grappler',
    base: 'Nova Grappler — Ultimate Raizer Mega-flare',
    name: 'G-BT01 Playtest · Nova Grappler Raizers',
    swaps: [
      ['BT16-064', 'G-BT01-087', 3], // Cannonraizer → Katanaraizer
      ['BT16-066', 'G-BT01-088', 3], // Reserveraizer → Beast Deity, Frog Master
      ['BT16-030', 'G-BT01-037', 4], // Phoenixraizer Flame-wing → Masuraoraizer
      ['BT16-062', 'G-BT01-084', 3], // Wingraizer → Starlight Hedgehog
      ['BT16-069', 'G-BT01-092', 2], // Meteoraizer → Extreme Battler, Zanbhara (critical)
      ['BT16-070', 'G-BT01-093', 2], // Raizer Crew → Drone Baron (draw)
      ['BT16-072', 'G-BT01-094', 4], // Subliminal Gray → Mirror Image, Gesolaz (stand)
      ['BT16-071', 'G-BT01-095', 2], // Raizer Girl, Kate → Ring Girl, Ai (heal)
    ],
  },
];

/** The base deck with the swaps made; throws if a swap takes out more copies than the deck has. */
function build(spec: PlaytestSpec): StarterDeck {
  const base = STARTER_DECKS.find((d) => d.name === spec.base);
  if (!base) throw new Error(`G-BT01 playtest: no starter deck "${spec.base}"`);
  const cards = [...base.deck.cards];
  for (const [out, into, count] of spec.swaps)
    for (let i = 0; i < count; i++) {
      const at = cards.lastIndexOf(out);
      if (at < 0 || (out === base.deck.firstVanguard && cards.filter((c) => c === out).length < 2))
        throw new Error(`G-BT01 playtest: ${spec.name} has too few ${out} to swap`);
      cards[at] = into;
    }
  return {
    name: spec.name,
    description: `Playtest deck (${spec.clan}): our "${spec.base.split(' — ')[1]}" starter with G-BT01 cards swapped in. Provisional, not a balance verdict.`,
    deck: { firstVanguard: base.deck.firstVanguard, cards },
    format: 'classic_ou',
  };
}

export const OG_PLAYTEST_DECKS: readonly StarterDeck[] = OG_PLAYTEST_SPECS.map(build);
/** The starter deck each playtest deck was made from, for comparison matches. */
export const ogPlaytestBase = (name: string): StarterDeck | undefined => {
  const spec = OG_PLAYTEST_SPECS.find((s) => s.name === name);
  return spec && STARTER_DECKS.find((d) => d.name === spec.base);
};
