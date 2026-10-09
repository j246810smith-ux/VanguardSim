/**
 * Starter decks built from the implemented sets (legal 50-card decks: 16 triggers, max 4 heals
 * and 4 sentinels, grade 0 first vanguard). For playtesting until the deck builder exists.
 */
import type { DeckList } from '../engine';

export interface StarterDeck {
  readonly name: string;
  readonly description: string;
  readonly deck: DeckList;
}

const n = (count: number, id: string): string[] => Array.from({ length: count }, () => id);

export const STARTER_DECKS: readonly StarterDeck[] = [
  {
    name: 'Royal Paladin — Knights of the King',
    description: 'Blaster Blade, Alfred and Gancelot. Swarm the field and power up your vanguard.',
    deck: {
      firstVanguard: 'BT01-003', // Barcgal
      cards: [
        ...n(1, 'BT01-003'), // Barcgal (G0, forerunner)
        ...n(4, 'BT01-012'), // Future Knight, Llew (critical)
        ...n(4, 'BT01-045'), // Weapons Dealer, Govannon (draw)
        ...n(4, 'BT01-046'), // Flogal (stand)
        ...n(4, 'BT01-047'), // Yggdrasil Maiden, Elaine (heal)
        ...n(4, 'BT01-011'), // Flash Shield, Iseult (G1 sentinel)
        ...n(3, 'BT01-042'), // Little Sage, Marron
        ...n(3, 'BT01-043'), // Lake Maiden, Lien
        ...n(4, 'BT01-044'), // Wingal
        ...n(4, 'BT01-002'), // Blaster Blade (G2)
        ...n(4, 'BT01-021'), // Knight of Silence, Gallatin
        ...n(3, 'BT01-041'), // Covenant Knight, Randolf
        ...n(4, 'BT01-001'), // King of Knights, Alfred (G3)
        ...n(2, 'BT01-010'), // Solitary Knight, Gancelot
        ...n(2, 'BT01-009'), // Demon Slaying Knight, Lohengrin
      ],
    },
  },
  {
    name: 'Kagero — Dragonic Overlord',
    description: 'Burn down rear-guards with Dragonic Overlord and Vortex Dragon.',
    deck: {
      firstVanguard: 'BT01-016', // Lizard Soldier, Conroe
      cards: [
        ...n(1, 'BT01-016'),
        ...n(4, 'BT01-024'), // Embodiment of Spear, Tahr (critical)
        ...n(4, 'BT01-051'), // Dragon Dancer, Monica (draw)
        ...n(4, 'BT01-052'), // Lizard Soldier, Ganlu (stand)
        ...n(4, 'BT01-053'), // Dragon Monk, Genjo (heal)
        ...n(4, 'BT01-015'), // Wyvern Guard, Barri (G1 sentinel)
        ...n(3, 'BT01-048'), // Embodiment of Armor, Bahr
        ...n(3, 'BT01-049'), // Dragon Monk, Gojo
        ...n(4, 'BT01-050'), // Wyvern Strike, Jarran
        ...n(3, 'BT01-014'), // Dragon Knight, Aleph (G2)
        ...n(4, 'BT01-022'), // Dragon Knight, Nehalem
        ...n(4, 'BT01-023'), // Wyvern Strike, Tejas
        ...n(4, 'BT01-004'), // Dragonic Overlord (G3)
        ...n(2, 'BT01-013'), // Vortex Dragon
        ...n(2, 'BT01-005'), // Embodiment of Victory, Aleph
      ],
    },
  },
  {
    name: 'Oracle Think Tank — CEO Amaterasu',
    description: 'Keep a big hand, control your deck top and out-draw your opponent.',
    deck: {
      firstVanguard: 'BT01-058', // Miracle Kid (a draw trigger as first vanguard)
      cards: [
        ...n(4, 'BT01-056'), // Oracle Guardian, Nike (critical)
        ...n(4, 'BT01-057'), // Dream Eater (draw)
        ...n(4, 'BT01-058'), // Miracle Kid (draw)
        ...n(4, 'BT01-027'), // Lozenge Magus (heal)
        ...n(4, 'BT01-007'), // Battle Sister, Cocoa
        ...n(4, 'BT01-019'), // Battle Sister, Chocolat (G1 sentinel)
        ...n(4, 'BT01-055'), // Weather Girl, Milk
        ...n(2, 'BT01-054'), // Oracle Guardian, Gemini
        ...n(4, 'BT01-017'), // Maiden of Libra (G2)
        ...n(4, 'BT01-018'), // Battle Sister, Mocha
        ...n(4, 'BT01-026'), // Oracle Guardian, Wiseman
        ...n(4, 'BT01-006'), // CEO Amaterasu (G3)
        ...n(4, 'BT01-025'), // Oracle Guardian, Apollon
      ],
    },
  },
  {
    name: 'Nova Grappler — Asura Kaiser',
    description: 'Stand your rear-guards and attack again and again.',
    deck: {
      firstVanguard: 'BT01-032', // Battleraizer
      cards: [
        ...n(4, 'BT01-032'), // Battleraizer (stand, forerunner)
        ...n(4, 'BT01-063'), // Shining Lady (critical)
        ...n(4, 'BT01-064'), // Lucky Girl (stand)
        ...n(4, 'BT01-065'), // Ring Girl, Clara (heal)
        ...n(4, 'BT01-031'), // Queen of Heart
        ...n(4, 'BT01-061'), // Screamin' and Dancin' Announcer, Shout
        ...n(4, 'BT01-062'), // Clay-doll Mechanic
        ...n(2, 'BT01-060'), // Tough Boy
        ...n(4, 'BT01-029'), // Brutal Jack (G2)
        ...n(4, 'BT01-030'), // King of Sword
        ...n(4, 'BT01-059'), // Hungry Dumpty
        ...n(4, 'BT01-008'), // Asura Kaiser (G3)
        ...n(4, 'BT01-028'), // Mr. Invincible
      ],
    },
  },
  // ---- BT03 -----------------------------------------------------------------------------------
  {
    name: 'Dark Irregulars — Stil Vampir',
    description: 'Fill your soul, then crush with Amon, Edel Rose and Stil Vampir.',
    deck: {
      firstVanguard: 'BT03-025', // Vermillion Gatekeeper
      cards: [
        ...n(1, 'BT03-025'), // Vermillion Gatekeeper (G0)
        ...n(4, 'BT03-044'), // Blitzritter (critical)
        ...n(4, 'BT03-045'), // Hades Puppet Master (stand)
        ...n(4, 'BT03-046'), // Cursed Doctor (heal)
        ...n(4, 'BT03-047'), // Dark Queen of Nightmareland (stand)
        ...n(4, 'BT03-011'), // March Rabbit of Nightmareland (G1 sentinel)
        ...n(3, 'BT03-012'), // Doreen the Thruster
        ...n(4, 'BT03-024'), // Alluring Succubus
        ...n(3, 'BT03-043'), // Poet of Darkness, Amon
        ...n(3, 'BT03-010'), // Gwynn the Ripper (G2)
        ...n(2, 'BT03-021'), // Imprisoned Fallen Angel, Saraqael
        ...n(2, 'BT03-022'), // Werwolf Sieger
        ...n(3, 'BT03-023'), // Demon of Aspiration, Amon
        ...n(2, 'BT03-041'), // Decadent Succubus
        ...n(2, 'BT03-001'), // Stil Vampir (G3)
        ...n(3, 'BT03-002'), // Demon World Marquis, Amon
        ...n(2, 'BT03-009'), // Edel Rose
      ],
    },
  },
  {
    name: 'Pale Moon — Dusk Illusionist, Robert',
    description: 'Swap units in and out of the soul to attack again and again.',
    deck: {
      firstVanguard: 'BT03-031', // Hades Ringmaster
      cards: [
        ...n(1, 'BT03-031'), // Hades Ringmaster (G0)
        ...n(4, 'BT03-051'), // Dynamite Juggler (critical)
        ...n(4, 'BT03-052'), // Spiral Master (critical)
        ...n(4, 'BT03-053'), // Candy Clown (heal)
        ...n(4, 'BT03-054'), // Rainbow Magician (draw)
        ...n(4, 'BT03-016'), // Hades Hypnotist (G1 sentinel)
        ...n(4, 'BT03-028'), // Skull Juggler
        ...n(3, 'BT03-029'), // Midnight Bunny
        ...n(3, 'BT03-030'), // Turquoise Beast Tamer
        ...n(4, 'BT03-014'), // Crimson Beast Tamer (G2)
        ...n(3, 'BT03-015'), // Mirror Demon
        ...n(2, 'BT03-048'), // Elephant Juggler
        ...n(3, 'BT03-049'), // Hungry Clown
        ...n(2, 'BT03-003'), // Nightmare Doll, Alice (G3)
        ...n(3, 'BT03-013'), // Dusk Illusionist, Robert
        ...n(2, 'BT03-026'), // Barking Manticore
      ],
    },
  },
  {
    name: 'Royal Paladin — Knight of Godly Speed, Galahad',
    description: 'Ride up the Galahad line from Drangal, then strike with Godly Speed.',
    deck: {
      firstVanguard: 'BT03-036', // Drangal
      cards: [
        ...n(1, 'BT03-036'), // Drangal (G0, rides Knight of Quests)
        ...n(4, 'BT03-067'), // Alabaster Owl (critical)
        ...n(4, 'BT01-045'), // Weapons Dealer, Govannon (draw)
        ...n(4, 'BT01-046'), // Flogal (stand)
        ...n(4, 'BT01-047'), // Yggdrasil Maiden, Elaine (heal)
        ...n(4, 'BT03-065'), // Knight of Quests, Galahad (G1)
        ...n(3, 'BT03-035'), // Toypugal
        ...n(3, 'BT03-066'), // Borgal
        ...n(4, 'BT01-011'), // Flash Shield, Iseult (G1 sentinel)
        ...n(4, 'BT03-062'), // Knight of Tribulations, Galahad (G2)
        ...n(3, 'BT03-063'), // Gigantech Dozer
        ...n(3, 'BT03-064'), // Swordsman of the Blaze, Palamedes
        ...n(2, 'BT01-021'), // Knight of Silence, Gallatin
        ...n(4, 'BT03-018'), // Knight of Godly Speed, Galahad (G3)
        ...n(3, 'BT03-005'), // Swordsman of the Explosive Flames, Palamedes
      ],
    },
  },
  {
    name: 'Oracle Think Tank — Goddess of the Full Moon, Tsukuyomi',
    description: 'Ride up the Tsukuyomi line from Ichibyoshi and draw with a full soul.',
    deck: {
      firstVanguard: 'BT03-038', // Godhawk, Ichibyoshi
      cards: [
        ...n(1, 'BT03-038'), // Godhawk, Ichibyoshi (G0, rides Crescent Moon)
        ...n(4, 'BT03-073'), // Victory Maker (critical)
        ...n(4, 'BT01-027'), // heal
        ...n(4, 'BT01-056'), // critical
        ...n(4, 'BT02-067'), // stand
        ...n(4, 'BT03-071'), // Goddess of the Crescent Moon, Tsukuyomi (G1)
        ...n(4, 'BT03-037'), // Oracle Guardian, Blue Eye
        ...n(4, 'BT03-072'), // Battle Sister, Vanilla
        ...n(2, 'BT01-054'), // Oracle Guardian, Gemini
        ...n(4, 'BT03-007'), // Goddess of the Half Moon, Tsukuyomi (G2)
        ...n(4, 'BT03-069'), // Oracle Guardian, Red Eye
        ...n(4, 'BT03-070'), // Faithful Angel
        ...n(4, 'BT03-006'), // Goddess of the Full Moon, Tsukuyomi (G3)
        ...n(3, 'BT03-068'), // Secretary Angel
      ],
    },
  },
  {
    name: 'Tachikaze — Ravenous Dragon, Gigarex',
    description: 'Sacrifice your rear-guards to power up the Ravenous Dragons.',
    deck: {
      firstVanguard: 'BT01-067', // Ironclad Dragon, Shieldon
      cards: [
        ...n(1, 'BT01-067'), // Ironclad Dragon, Shieldon (G0)
        ...n(4, 'BT03-058'), // Herbivorous Dragon, Brutosaurus (critical)
        ...n(4, 'BT03-059'), // Pack Dragon, Tinyrex (stand)
        ...n(4, 'BT03-060'), // Savage Shaman (heal)
        ...n(4, 'BT03-061'), // Black Cannon Tiger (critical)
        ...n(4, 'BT03-017'), // Archbird (G1 sentinel)
        ...n(4, 'BT03-034'), // Savage Warrior
        ...n(4, 'BT03-057'), // Raging Dragon, Sparksaurus
        ...n(2, 'BT01-066'), // Sonic Noa
        ...n(4, 'BT03-033'), // Ravenous Dragon, Megarex (G2)
        ...n(4, 'BT03-055'), // Vacuum Mammoth
        ...n(4, 'BT03-056'), // Savage Destroyer
        ...n(4, 'BT03-004'), // Ravenous Dragon, Gigarex (G3)
        ...n(3, 'BT03-032'), // Raging Dragon, Blastsaurus
      ],
    },
  },
  // ---- BT04 ---------------------------------------------------------------------------------------
  {
    name: 'Shadow Paladin — Phantom Blaster Dragon',
    description:
      'Blaster Javelin into Blaster Dark, then sacrifice three rear-guards for a 20000 Phantom Blaster.',
    deck: {
      firstVanguard: 'BT04-025',
      cards: [
        ...n(1, 'BT04-025'),
        ...n(4, 'BT04-048'), // Grim Reaper (critical)
        ...n(4, 'BT04-049'), // Abyss Freezer (draw)
        ...n(4, 'BT04-050'), // Darkside Trumpeter (stand)
        ...n(4, 'BT04-051'), // Abyss Healer (heal)
        ...n(4, 'BT04-011'), // Dark Shield, Mac Lir (G1 sentinel)
        ...n(4, 'BT04-046'), // Blaster Javelin
        ...n(3, 'BT04-045'), // Doranbau
        ...n(3, 'BT04-044'), // Witch of Nostrum, Arianrhod
        ...n(4, 'BT04-024'), // Blaster Dark (G2)
        ...n(3, 'BT04-002'), // Darkness Maiden, Macha
        ...n(3, 'BT04-041'), // Demon World Castle, DonnerSchlag
        ...n(2, 'BT04-042'), // Demon World Castle, Fatalita
        ...n(4, 'BT04-001'), // Phantom Blaster Dragon (G3)
        ...n(3, 'BT04-022'), // Dark Mage, Badhabh Caar
      ],
    },
  },
  {
    name: 'Dimension Police — Enigman Storm',
    description:
      'Ride Ripple, Wave and Storm, and pump your vanguard past 15000 for an extra critical.',
    deck: {
      firstVanguard: 'BT04-030',
      cards: [
        ...n(1, 'BT04-030'),
        ...n(4, 'BT04-056'), // Justice Cobalt (critical)
        ...n(4, 'BT04-057'), // Army Penguin (draw)
        ...n(4, 'BT04-058'), // Cosmo Fang (stand)
        ...n(4, 'BT04-059'), // Justice Rose (heal)
        ...n(4, 'BT04-014'), // Diamond Ace (G1 sentinel)
        ...n(4, 'BT04-054'), // Enigman Ripple
        ...n(4, 'BT04-055'), // Glory Maker
        ...n(2, 'BT04-029'), // Cosmo Roar
        ...n(4, 'BT04-012'), // Enigman Wave (G2)
        ...n(3, 'BT04-053'), // Enigroid Comrade
        ...n(3, 'BT04-013'), // Cosmo Beak
        ...n(2, 'BT04-028'), // Platinum Ace
        ...n(4, 'BT04-004'), // Enigman Storm (G3)
        ...n(3, 'BT04-026'), // Enigman Rain
      ],
    },
  },
  {
    name: 'Megacolony — Evil Armor General, Giraffa',
    description:
      'Lock your opponent down so their units cannot stand, then clean up their rear-guards.',
    deck: {
      firstVanguard: 'BT04-035',
      cards: [
        ...n(1, 'BT04-035'),
        ...n(4, 'BT04-064'), // Sharp Nail Scorpio (critical)
        ...n(4, 'BT04-065'), // Raider Mantis (draw)
        ...n(4, 'BT04-066'), // Sonic Cicada (stand)
        ...n(4, 'BT04-067'), // Medical Battler, Ranpli (heal)
        ...n(4, 'BT04-017'), // Paralyze Madonna (G1 sentinel)
        ...n(4, 'BT04-062'), // Pupa Mutant, Giraffa
        ...n(3, 'BT04-063'), // Stealth Millipede
        ...n(3, 'BT04-034'), // Gloom Flyman
        ...n(4, 'BT04-016'), // Elite Mutant, Giraffa (G2)
        ...n(3, 'BT04-060'), // Ironcutter Beetle
        ...n(3, 'BT04-061'), // Tail Joe
        ...n(2, 'BT04-033'), // Water Gang
        ...n(4, 'BT04-005'), // Evil Armor General, Giraffa (G3)
        ...n(3, 'BT04-031'), // Death Warden Ant Lion
      ],
    },
  },
  // ---- BT05 ---------------------------------------------------------------------------------------
  {
    name: 'Murakumo — Covert Demonic Dragon, Mandala Lord',
    description: 'Copy your units with the Stealth line, then shut down attacks with Mandala Lord.',
    deck: {
      firstVanguard: 'BT05-034',
      cards: [
        ...n(1, 'BT05-034'),
        ...n(4, 'BT05-057'), // Stealth Beast, Moon Edge (critical)
        ...n(4, 'BT05-058'), // Stealth Beast, Cat Rouge (draw)
        ...n(4, 'BT05-059'), // Stealth Fiend, Yukihime (heal)
        ...n(4, 'BT05-060'), // Stealth Fiend, Dart Spider (stand)
        ...n(4, 'BT05-013'), // Stealth Beast, Leaves Mirage (G1 sentinel)
        ...n(4, 'BT05-032'), // Stealth Dragon, Turbulent Edge
        ...n(3, 'BT05-033'), // Stealth Beast, Million Rat
        ...n(3, 'BT05-056'), // Stealth Beast, Leaf Raccoon
        ...n(4, 'BT05-012'), // Stealth Fiend, Midnight Crow (G2)
        ...n(3, 'BT05-031'), // Stealth Dragon, Cursed Breath
        ...n(3, 'BT05-054'), // Stealth Beast, White Mane
        ...n(2, 'BT05-030'), // Caped Stealth Rogue, Shanaou
        ...n(4, 'BT05-001'), // Covert Demonic Dragon, Mandala Lord (G3)
        ...n(3, 'BT05-027'), // Stealth Fiend, Kurama Lord
      ],
    },
  },
  {
    name: 'Neo Nectar — Maiden of Trailing Rose',
    description:
      'Hit vanguards to call more units from your deck with the Gene line and Trailing Rose.',
    deck: {
      firstVanguard: 'BT05-026',
      cards: [
        ...n(1, 'BT05-026'),
        ...n(4, 'BT05-050'), // Chestnut Bullet (critical)
        ...n(4, 'BT05-051'), // Dancing Sunflower (draw)
        ...n(4, 'BT05-052'), // Sweet Honey (heal)
        ...n(4, 'BT05-053'), // Watering Elf (stand)
        ...n(4, 'BT05-011'), // Maiden of Blossom Rain (G1 sentinel)
        ...n(4, 'BT05-047'), // Blade Seed Squire
        ...n(3, 'BT05-045'), // Caramel Popcorn
        ...n(3, 'BT05-048'), // Lily Knight of the Valley
        ...n(4, 'BT05-041'), // Knight of Verdure, Gene (G2)
        ...n(3, 'BT05-024'), // Iris Knight
        ...n(3, 'BT05-043'), // Spiritual Tree Sage, Irminsul
        ...n(2, 'BT05-042'), // Colossal Wings, Simurgh
        ...n(3, 'BT05-009'), // Maiden of Trailing Rose (G3)
        ...n(2, 'BT05-022'), // Knight of Harvest, Gene
        ...n(2, 'BT05-023'), // Avatar of the Plains, Behemoth
      ],
    },
  },
  {
    name: 'Royal Paladin — Majesty Lord Blaster',
    description:
      'Put Blaster Blade and Blaster Dark into the soul for a huge Majesty Lord Blaster.',
    deck: {
      firstVanguard: 'BT05-016',
      cards: [
        ...n(1, 'BT05-016'),
        ...n(4, 'BT01-012'), // Future Knight, Llew (critical)
        ...n(4, 'BT01-045'), // Weapons Dealer, Govannon (draw)
        ...n(4, 'BT05-063'), // Silent Sage, Sharon (stand)
        ...n(4, 'BT01-047'), // Yggdrasil Maiden, Elaine (heal)
        ...n(4, 'BT01-011'), // Flash Shield, Iseult (G1 sentinel)
        ...n(4, 'BT05-015'), // Knight of Friendship, Kay
        ...n(3, 'BT05-062'), // Dream Painter
        ...n(3, 'BT01-044'), // Wingal
        ...n(4, 'BT01-002'), // Blaster Blade (G2)
        ...n(3, 'BT04-024'), // Blaster Dark (Shadow Paladin)
        ...n(3, 'BT05-003'), // Star Call Trumpeter
        ...n(2, 'BT05-014'), // Knight of Loyalty, Bedivere
        ...n(4, 'BT05-002'), // Majesty Lord Blaster (G3)
        ...n(3, 'BT05-061'), // Powerful Sage, Bairon
      ],
    },
  },
  // ---- BT06 ---------------------------------------------------------------------------------------
  {
    name: 'Angel Feather — Circular Saw, Kiriel',
    description:
      'Swap cards between your hand and damage zone, then break through with Limit Break.',
    deck: {
      firstVanguard: 'BT06-054',
      cards: [
        ...n(1, 'BT06-054'),
        ...n(4, 'BT06-055'), // Rocket Dash Unicorn (critical)
        ...n(4, 'BT06-056'), // Bouquet Toss Messenger (draw)
        ...n(4, 'BT06-057'), // Aurora Ribbon Pigeon (stand)
        ...n(4, 'BT06-060'), // Sunny Smile Angel (heal)
        ...n(4, 'BT06-012'), // Pure Keeper, Requiel (G1 sentinel)
        ...n(4, 'BT06-048'), // Thousand Ray Pegasus
        ...n(3, 'BT06-052'), // Clutch Rifle Angel
        ...n(3, 'BT06-049'), // Heavenly Injector
        ...n(3, 'BT06-025'), // Fate Healer, Ergodiel (G2)
        ...n(3, 'BT06-044'), // Million Ray Pegasus
        ...n(3, 'BT06-046'), // Holy Zone, Penemue
        ...n(3, 'BT06-011'), // Love Machine Gun, Nociel
        ...n(4, 'BT06-001'), // Circular Saw, Kiriel (G3)
        ...n(3, 'BT06-009'), // Cosmo Healer, Ergodiel
      ],
    },
  },
  {
    name: 'Granblue — Ice Prison Necromancer, Cocytus',
    description:
      'Bring your crew back from the drop zone, and ride Cocytus or Deadly Swordmaster from it.',
    deck: {
      firstVanguard: 'BT06-072',
      cards: [
        ...n(1, 'BT06-072'),
        ...n(4, 'BT06-073'), // Ghoul Cannonball (critical)
        ...n(4, 'BT06-074'), // Hook-wielding Zombie (draw)
        ...n(4, 'BT06-075'), // Doctor Rouge (heal)
        ...n(4, 'BT06-076'), // Hades Steersman (stand)
        ...n(4, 'BT02-014'), // Granblue perfect guard (G1 sentinel)
        ...n(3, 'BT06-031'), // Deadly Nightmare
        ...n(3, 'BT06-065'), // Skeleton Colossus
        ...n(4, 'BT06-069'), // Dragon Spirit
        ...n(3, 'BT06-029'), // Deadly Spirit (G2)
        ...n(3, 'BT06-028'), // Skeleton Demon World Knight
        ...n(2, 'BT06-062'), // Stormride Ghost Ship
        ...n(4, 'BT06-064'), // Sea Navigator, Silver
        ...n(4, 'BT06-003'), // Ice Prison Necromancer, Cocytus (G3)
        ...n(3, 'BT06-013'), // Deadly Swordmaster
      ],
    },
  },
  // ---- BT07 ---------------------------------------------------------------------------------------
  {
    name: 'Great Nature — School Hunter, Leo-pald',
    description:
      'Pump your rear-guards, retire them at the end phase, and turn every retirement into cards and calls.',
    deck: {
      firstVanguard: 'BT07-058',
      cards: [
        ...n(1, 'BT07-058'),
        ...n(4, 'BT07-060'), // Triangle Cobra (critical)
        ...n(4, 'BT07-061'), // Fortune-bringing Cat (draw)
        ...n(4, 'BT07-062'), // Alarm Chicken (stand)
        ...n(4, 'BT07-064'), // Dictionary Goat (heal)
        ...n(4, 'BT07-012'), // Cable Sheep (G1 sentinel)
        ...n(4, 'BT07-027'), // Tank Mouse
        ...n(3, 'BT07-052'), // Tick Tock Flamingo
        ...n(3, 'BT07-057'), // Hula Hoop Capybara
        ...n(4, 'BT07-003'), // Binoculus Tiger (G2)
        ...n(3, 'BT07-048'), // Explosion Scientist, Bunta
        ...n(4, 'BT07-046'), // Pencil Knight, Hammsuke
        ...n(4, 'BT07-001'), // School Hunter, Leo-pald (G3)
        ...n(4, 'BT07-021'), // Pencil Hero, Hammsuke
      ],
    },
  },
  {
    name: 'Pale Moon — Silver Thorn Dragon Tamer, Luquier',
    description:
      'Fill your soul, then pour it back onto the field with Luquier and the Silver Thorn circus.',
    deck: {
      firstVanguard: 'BT07-074',
      cards: [
        ...n(1, 'BT07-074'),
        ...n(4, 'BT07-076'), // Flyer Flyer (draw)
        ...n(4, 'BT07-077'), // Cracker Musician (stand)
        ...n(4, 'BT07-078'), // Popcorn Boy (heal)
        ...n(4, 'BT07-079'), // Poison Juggler (critical)
        ...n(4, 'BT07-070'), // Jumping Glenn (G1)
        ...n(4, 'BT07-032'), // Purple Trapezist
        ...n(3, 'BT07-016'), // Magician of Quantum Mechanics
        ...n(3, 'BT07-031'), // Bull's Eye, Mia
        ...n(4, 'BT07-030'), // Dancing Princess of the Night Sky (G2)
        ...n(4, 'BT07-067'), // Dreamy Fortress
        ...n(3, 'BT07-015'), // Peek-a-boo
        ...n(4, 'BT07-004'), // Silver Thorn Dragon Tamer, Luquier (G3)
        ...n(4, 'BT07-013'), // Sword Magician, Sarah
      ],
    },
  },
  {
    name: 'Dark Irregulars — Dark Lord of Abyss',
    description:
      'Pack the soul with Witching Hour copies and Dark Irregulars, then power up with Dark Lord of Abyss.',
    deck: {
      firstVanguard: 'BT07-087',
      cards: [
        ...n(1, 'BT07-087'),
        ...n(4, 'BT07-089'), // Mad Hatter of Nightmareland (draw)
        ...n(4, 'BT07-090'), // Hungry Egg of Nightmareland (stand)
        ...n(4, 'BT07-091'), // Cheshire Cat of Nightmareland (heal)
        ...n(4, 'BT07-092'), // Dark Knight of Nightmareland (critical)
        ...n(4, 'BT07-083'), // Demon Bike of the Witching Hour (G1)
        ...n(4, 'BT07-086'), // Rune Weaver
        ...n(3, 'BT07-036'), // Courting Succubus
        ...n(3, 'BT07-019'), // Yellow Bolt
        ...n(4, 'BT07-034'), // Hades Carriage of the Witching Hour (G2)
        ...n(4, 'BT07-035'), // Free Traveler
        ...n(3, 'BT07-018'), // Emblem Master
        ...n(4, 'BT07-005'), // Dark Lord of Abyss (G3)
        ...n(4, 'BT07-080'), // Demon Chariot of the Witching Hour
      ],
    },
  },
  // ---- BT08 ---------------------------------------------------------------------------------------
  {
    name: 'Aqua Force — Blue Storm Dragon, Maelstrom',
    description:
      'Chain many attacks a turn: Storm Riders swap forward after the first battle, and the fourth battle onward retires, draws and pumps.',
    deck: {
      firstVanguard: 'BT08-039',
      cards: [
        ...n(1, 'BT08-039'),
        ...n(4, 'BT08-094'), // Mothership Intelligence (critical)
        ...n(4, 'BT08-095'), // Enemy Seeking Seagull Soldier (stand)
        ...n(4, 'TD07-016'), // Pyroxene Communications Sea Otter Soldier (draw)
        ...n(4, 'TD07-018'), // Medical Officer of the Rainbow Elixir (heal)
        ...n(4, 'BT08-019'), // Emerald Shield, Paschal (G1 sentinel)
        ...n(4, 'BT08-037'), // Storm Rider, Eugen
        ...n(3, 'BT08-038'), // Torpedo Rush Dragon
        ...n(3, 'BT08-092'), // Reliable Strategic Commander
        ...n(4, 'BT08-007'), // Storm Rider, Basil (G2)
        ...n(4, 'BT08-018'), // Tear Knight, Valeria
        ...n(3, 'BT08-089'), // Whale Supply Fleet, Kairin Maru
        ...n(4, 'BT08-005'), // Blue Storm Dragon, Maelstrom (G3)
        ...n(2, 'BT08-035'), // Storm Rider, Diamantes
        ...n(2, 'BT08-086'), // Titan of the Pyroxene Mine
      ],
    },
  },
  {
    name: 'Dimension Police — Galactic Beast, Zeal',
    description:
      'Ride the Zeal line to shrink the opposing vanguard, then punish anything at 8000 power or less.',
    deck: {
      firstVanguard: 'BT08-027',
      cards: [
        ...n(1, 'BT08-027'),
        ...n(4, 'BT04-056'), // Justice Cobalt (critical)
        ...n(4, 'BT08-054'), // Gem Monster, Jewelmine (draw)
        ...n(4, 'BT08-055'), // Noise Monster, Decibelon (stand)
        ...n(4, 'BT08-056'), // Dissection Monster, Kaizon (heal)
        ...n(4, 'BT08-047'), // Eye of Destruction, Zeal
        ...n(4, 'BT04-014'), // Diamond Ace (G1 sentinel)
        ...n(3, 'BT08-050'), // Psychic Grey
        ...n(3, 'BT08-051'), // Speedster
        ...n(4, 'BT08-024'), // Devourer of Planets, Zeal (G2)
        ...n(4, 'BT08-046'), // Assault Monster, Gunrock
        ...n(3, 'BT08-045'), // Cosmic Rider
        ...n(4, 'BT08-002'), // Galactic Beast, Zeal (G3)
        ...n(2, 'BT08-043'), // Interdimensional Ninja, Tsukikage
        ...n(2, 'BT08-022'), // Lady Justice
      ],
    },
  },
  {
    name: 'Neo Nectar — White Lily Musketeer, Cecilia',
    description:
      'Musketeers call Musketeers: trade rear-guards for fresh ones from the deck, then fill the field with Cecilias.',
    deck: {
      firstVanguard: 'BT08-068',
      cards: [
        ...n(1, 'BT08-068'),
        ...n(4, 'BT08-069'), // Night Queen Musketeer, Daniel (critical)
        ...n(4, 'BT08-070'), // Four Leaf Fairy (draw)
        ...n(4, 'BT08-071'), // Maiden of Morning Glory (stand)
        ...n(4, 'BT08-072'), // Hibiscus Musketeer, Hanah (heal)
        ...n(4, 'BT08-014'), // Water Lily Musketeer, Ruth
        ...n(4, 'BT08-015'), // Lily of the Valley Musketeer, Rebecca
        ...n(4, 'BT05-011'), // Maiden of Blossom Rain (G1 sentinel)
        ...n(2, 'BT08-065'), // Tulip Musketeer, Mina
        ...n(4, 'BT08-011'), // Cherry Blossom Musketeer, Augusto (G2)
        ...n(4, 'BT08-012'), // Lily of the Valley Musketeer, Kaivant
        ...n(3, 'BT08-062'), // Tulip Musketeer, Almira
        ...n(4, 'BT08-004'), // White Lily Musketeer, Cecilia (G3)
        ...n(4, 'BT08-058'), // Black Lily Musketeer, Hermann
      ],
    },
  },
  {
    name: 'Tachikaze — Military Dragon, Raptor Colonel',
    description:
      'Feed rear-guards to Raptor Colonel for power; every retired dinosaur pumps, calls a replacement or wakes Dark Rex.',
    deck: {
      firstVanguard: 'BT08-034',
      cards: [
        ...n(1, 'BT08-034'),
        ...n(4, 'BT08-082'), // Dragon Bird, Firepteryx (critical)
        ...n(4, 'BT08-083'), // Carry Trilobite (draw)
        ...n(4, 'BT08-084'), // Matriarch's Bombardment Beast (stand)
        ...n(4, 'BT08-085'), // Ironclad Dragon, Steelsaurus (heal)
        ...n(4, 'BT08-077'), // Military Dragon, Raptor Sergeant
        ...n(4, 'BT03-017'), // Archbird (G1 sentinel)
        ...n(3, 'BT08-033'), // Winged Dragon, Beamptero
        ...n(3, 'BT08-080'), // Transport Dragon, Brachioporter
        ...n(4, 'BT08-030'), // Military Dragon, Raptor Captain (G2)
        ...n(2, 'BT08-076'), // Carrier Dragon, Brachiocarrier
        ...n(3, 'BT08-031'), // Winged Dragon, Slashptero
        ...n(2, 'BT08-032'), // Assault Dragon, Pachyphalos
        ...n(4, 'BT08-016'), // Military Dragon, Raptor Colonel (G3)
        ...n(2, 'BT08-017'), // Destruction Dragon, Dark Rex
        ...n(2, 'BT08-074'), // Citadel Dragon, Brachiocastle
      ],
    },
  },
  // ---- BT09 ---------------------------------------------------------------------------------------
  {
    name: 'Murakumo — Covert Demonic Dragon, Magatsu Storm',
    description:
      'Ride the Magatsu line and flood the field with copies that attack this turn and vanish at its end.',
    deck: {
      firstVanguard: 'BT09-023',
      cards: [
        ...n(1, 'BT09-023'),
        ...n(4, 'BT09-052'), // Fox Tamer, Izuna (critical)
        ...n(4, 'BT09-053'), // Stealth Fiend, Monster Lantern (draw)
        ...n(4, 'BT09-055'), // Stealth Fiend, Karakasa Spirit (stand)
        ...n(4, 'BT09-056'), // Stealth Fiend, River Child (heal)
        ...n(4, 'BT09-048'), // Stealth Dragon, Magatsu Breath
        ...n(4, 'BT05-013'), // Stealth Beast, Leaves Mirage (G1 sentinel)
        ...n(4, 'BT09-022'), // Stealth Fiend, Oboro Cart
        ...n(2, 'BT09-049'), // Stealth Beast, Night Panther
        ...n(4, 'BT09-021'), // Stealth Dragon, Magatsu Gale (G2)
        ...n(4, 'BT09-045'), // Stealth Dragon, Royale Nova
        ...n(3, 'BT09-046'), // Stealth Beast, Spell Hound
        ...n(4, 'BT09-001'), // Covert Demonic Dragon, Magatsu Storm (G3)
        ...n(2, 'BT09-044'), // Stealth Beast, Gigantoad
        ...n(2, 'BT09-043'), // Spiked Club Stealth Rogue, Arahabaki
      ],
    },
  },
  {
    name: 'Gold Paladin — Conviction Dragon, Chromejailer Dragon',
    description:
      'Call from the deck every turn — the Blaster Spirits join in as Gold Paladins — then power up the whole row.',
    deck: {
      firstVanguard: 'BT09-094',
      cards: [
        ...n(1, 'BT09-094'),
        ...n(4, 'BT09-095'), // Dantegal (critical)
        ...n(4, 'TD08-015'), // Armed Liberator, Gwydion (draw)
        ...n(4, 'BT09-096'), // Runebau (stand)
        ...n(4, 'TD08-017'), // Elixir Liberator (heal)
        ...n(4, 'BT09-014'), // Halo Shield, Mark (G1 sentinel)
        ...n(4, 'BT09-037'), // Advance of the Black Chains, Kahedin
        ...n(3, 'BT09-093'), // Holy Mage of the Gale
        ...n(3, 'TD08-009'), // Knight of Elegant Skills, Gareth
        ...n(4, 'BT09-019'), // Blaster Blade Spirit (G2)
        ...n(4, 'BT09-036'), // Knight of Passion, Bagdemagus
        ...n(3, 'BT09-020'), // Blaster Dark Spirit
        ...n(4, 'BT09-007'), // Conviction Dragon, Chromejailer Dragon (G3)
        ...n(4, 'BT09-006'), // Blazing Lion, Platina Ezel
      ],
    },
  },
  {
    name: 'Narukami — Dragonic Kaiser Vermillion "THE BLOOD"',
    description:
      "Strip the drawbacks off your exorcist knights, then swing THE BLOOD through the opponent's whole front row.",
    deck: {
      firstVanguard: 'BT09-098',
      cards: [
        ...n(1, 'BT09-098'),
        ...n(4, 'BT09-099'), // Spark Edge Dracokid (critical)
        ...n(4, 'BT08-101'), // Mischievous Girl, Kyon-she (draw)
        ...n(4, 'BT09-100'), // Exorcist Mage, Lin Lin (stand)
        ...n(4, 'TD06-018'), // Demonic Dragon Nymph, Seiobo (heal)
        ...n(4, 'BT09-016'), // Wyvern Guard, Guld (G1 sentinel)
        ...n(4, 'BT09-040'), // Exorcist Demonic Dragon, Indigo
        ...n(4, 'BT09-097'), // Exorcist Mage, Roh Roh
        ...n(2, 'BT08-098'), // Lightning Sword Wielding Exorcist Knight
        ...n(4, 'BT09-039'), // Dusty Plasma Dragon (G2)
        ...n(4, 'BT08-040'), // Thunder Spear Wielding Exorcist Knight
        ...n(3, 'BT08-097'), // Dragon Monk, Kinkaku
        ...n(4, 'BT09-008'), // Dragonic Kaiser Vermillion "THE BLOOD" (G3)
        ...n(2, 'BT06-006'), // Dragonic Kaiser Vermillion
        ...n(2, 'BT09-015'), // Lord of the Demonic Winds, Vayu
      ],
    },
  },
  {
    name: 'Oracle Think Tank — Goddess of the Sun, Amaterasu',
    description:
      "Amaterasu's hits fetch whatever you need, while Susanoo and Sayorihime hit harder beside her.",
    deck: {
      firstVanguard: 'BT09-069',
      cards: [
        ...n(1, 'BT09-069'),
        ...n(4, 'BT01-056'), // Oracle Guardian, Nike (critical)
        ...n(4, 'BT01-058'), // Miracle Kid (draw)
        ...n(4, 'BT02-067'), // Emergency Alarmer (stand)
        ...n(4, 'BT01-027'), // Lozenge Magus (heal)
        ...n(4, 'BT01-019'), // Battle Sister, Chocolat (G1 sentinel)
        ...n(4, 'BT09-030'), // Battle Maiden, Sayorihime
        ...n(3, 'BT09-066'), // Battle Sister, Cream
        ...n(3, 'BT09-067'), // Machine-gun Talk Ryan
        ...n(4, 'BT09-029'), // Battle Deity, Susanoo (G2)
        ...n(4, 'BT09-064'), // Oracle Guardian, Sphinx
        ...n(3, 'BT01-026'), // Oracle Guardian, Wiseman
        ...n(4, 'BT09-003'), // Goddess of the Sun, Amaterasu (G3)
        ...n(2, 'BT09-012'), // Battle Sister, Cookie
        ...n(2, 'BT01-006'), // CEO Amaterasu
      ],
    },
  },
  // ---- BT10 ---------------------------------------------------------------------------------------
  {
    name: 'Royal Paladin — Pure Heart Jewel Knight, Ashlei',
    description:
      'Fill the field with Jewel Knights for bonuses all round, then Break Ride Ashlei for a +10000/+1 finish.',
    deck: {
      firstVanguard: 'BT10-024',
      cards: [
        ...n(1, 'BT10-024'),
        ...n(4, 'BT10-049'), // Blazing Jewel Knight, Rachelle (critical)
        ...n(4, 'BT10-051'), // Devoting Jewel Knight, Tabitha (draw)
        ...n(4, 'BT10-048'), // Jewel Knight, Glitmy (stand)
        ...n(4, 'BT10-052'), // Ardent Jewel Knight, Polli (heal)
        ...n(4, 'BT10-010'), // Flashing Jewel Knight, Iseult (G1 sentinel)
        ...n(4, 'BT10-023'), // Jewel Knight, Prizmy
        ...n(4, 'BT10-046'), // Stinging Jewel Knight, Shellie
        ...n(2, 'BT10-047'), // Rushhgal
        ...n(4, 'BT10-009'), // Dogmatize Jewel Knight, Sybill (G2)
        ...n(4, 'BT10-022'), // Fellowship Jewel Knight, Tracie
        ...n(3, 'BT10-045'), // Knight of Details, Claudin
        ...n(4, 'BT10-001'), // Pure Heart Jewel Knight, Ashlei (G3)
        ...n(4, 'BT10-002'), // Leading Jewel Knight, Salome
      ],
    },
  },
  {
    name: 'Gold Paladin — Liberator of the Round Table, Alfred',
    description:
      'Call Liberators straight from the deck; Alfred grows +2000 for every Liberator beside him.',
    deck: {
      firstVanguard: 'BT10-026',
      cards: [
        ...n(1, 'BT10-026'),
        ...n(4, 'TD08-014'), // Strike Liberator (critical)
        ...n(4, 'TD08-015'), // Armed Liberator, Gwydion (draw)
        ...n(4, 'BT10-060'), // Flogal Liberator (stand)
        ...n(4, 'TD08-017'), // Elixir Liberator (heal)
        ...n(4, 'BT10-011'), // Halo Liberator, Mark (G1 sentinel)
        ...n(4, 'BT10-025'), // Fast Chase Liberator, Josephus
        ...n(3, 'BT10-057'), // Liberator, Flare Mane Stallion
        ...n(3, 'TD08-011'), // Pomerugal Liberator
        ...n(4, 'BT10-012'), // Liberator of the Flute, Escrad (G2)
        ...n(4, 'TD08-006'), // Blaster Blade Liberator
        ...n(3, 'TD08-004'), // Liberator of Silence, Gallatin
        ...n(4, 'BT10-003'), // Liberator of the Round Table, Alfred (G3)
        ...n(4, 'TD08-001'), // Solitary Liberator, Gancelot
      ],
    },
  },
  {
    name: 'Genesis — Oracle Queen, Himiko',
    description:
      "Charge the soul with every hit, then spend it: Himiko's Break Ride and Iwanagahime's front-row wipe.",
    deck: {
      firstVanguard: 'BT10-032',
      cards: [
        ...n(1, 'BT10-032'),
        ...n(4, 'BT10-072'), // Cyber Tiger (critical)
        ...n(4, 'BT10-074'), // Bandit Danny (draw)
        ...n(4, 'BT10-076'), // Spark Cockerel (stand)
        ...n(4, 'BT10-078'), // Witch of Big Pots, Laurier (heal)
        ...n(4, 'BT10-015'), // Goddess of Self-sacrifice, Kushinada (G1 sentinel)
        ...n(4, 'BT10-031'), // Battle Maiden, Tatsutahime
        ...n(3, 'BT10-069'), // Snipe Snake
        ...n(3, 'BT10-066'), // Battle Maiden, Mihikarihime
        ...n(4, 'BT10-029'), // Battle Maiden, Sahohime (G2)
        ...n(4, 'BT10-064'), // Witch of Owls, Paprika
        ...n(3, 'BT10-014'), // Broom Witch, Callaway
        ...n(4, 'BT10-004'), // Oracle Queen, Himiko (G3)
        ...n(4, 'BT10-005'), // Eternal Goddess, Iwanagahime
      ],
    },
  },
  {
    name: 'Narukami — Eradicator, Gauntlet Buster Dragon',
    description:
      'Every rear-guard your effects retire powers up Gauntlet Buster; Dragonic Descendant stands again after a miss.',
    deck: {
      firstVanguard: 'BT10-038',
      cards: [
        ...n(1, 'BT10-038'),
        ...n(4, 'BT10-087'), // Sacred Spear Eradicator, Pollux (critical)
        ...n(4, 'TD09-015'), // Eradicator, Dragon Mage (draw)
        ...n(4, 'BT10-088'), // Eradicator, Spy-eye Wyvern (stand)
        ...n(4, 'TD09-017'), // Worm Toxin Eradicator, Seiobo (heal)
        ...n(4, 'BT10-017'), // Eradicator Wyvern Guard, Guld (G1 sentinel)
        ...n(4, 'BT10-037'), // Ceremonial Bonfire Eradicator, Castor
        ...n(3, 'BT10-082'), // Sword Dance Eradicator, Hisen
        ...n(3, 'BT10-084'), // Lightning Fist Eradicator, Dui
        ...n(4, 'BT10-016'), // Supreme Army Eradicator, Zuitan (G2)
        ...n(4, 'BT10-036'), // Eradicator, Saucer Cannon Wyvern
        ...n(3, 'BT10-035'), // Double Gun Eradicator, Hakusho
        ...n(4, 'BT10-007'), // Eradicator, Gauntlet Buster Dragon (G3)
        ...n(4, 'BT10-006'), // Eradicator, Dragonic Descendant
      ],
    },
  },
  // ---- BT11 ---------------------------------------------------------------------------------------
  {
    name: 'Kagero — Hellfire Seal Dragon, Blockade Inferno',
    description:
      "Swap the opponent's rear-guards for grade 2s, then burn every grade 2 away with Blockade Inferno.",
    deck: {
      firstVanguard: 'BT11-068',
      cards: [
        ...n(1, 'BT11-068'),
        ...n(4, 'BT11-071'), // Seal Dragon, Biella (critical)
        ...n(4, 'BT11-074'), // Seal Dragon, Artpique (draw)
        ...n(4, 'BT11-072'), // Seal Dragon, Dobby (stand)
        ...n(4, 'BT11-073'), // Seal Dragon, Shirting (heal)
        ...n(4, 'BT11-011'), // Seal Dragon, Rinocross (G1 sentinel)
        ...n(4, 'BT11-064'), // Seal Dragon, Flannel
        ...n(3, 'BT11-033'), // Seal Dragon, Chambray
        ...n(3, 'BT11-065'), // Seal Dragon, Kersey
        ...n(4, 'BT11-060'), // Seal Dragon, Corduroy (G2)
        ...n(4, 'BT11-032'), // Seal Dragon, Jacquard
        ...n(3, 'BT11-031'), // Seal Dragon, Hunger Hell Dragon
        ...n(4, 'BT11-004'), // Hellfire Seal Dragon, Blockade Inferno (G3)
        ...n(2, 'BT11-010'), // Seal Dragon, Blockade
        ...n(2, 'BT11-059'), // Seal Dragon, Spike Hell Dragon
      ],
    },
  },
  {
    name: 'Angel Feather — Solidify Celestial, Zerachiel',
    description:
      'Keep a face-up Zerachiel in the damage zone and every Celestial on the field hits 3000 harder.',
    deck: {
      firstVanguard: 'BT11-049',
      cards: [
        ...n(1, 'BT11-049'),
        ...n(4, 'BT11-051'), // Hot Shot Celestial, Samyaza (critical)
        ...n(4, 'BT11-052'), // Celestial, Landing Pegasus (draw)
        ...n(4, 'BT11-053'), // Encourage Celestial, Tamiel (stand)
        ...n(4, 'BT11-054'), // Recovery Celestial, Ramuel (heal)
        ...n(4, 'BT11-009'), // Adamantine Celestial, Aniel (G1 sentinel)
        ...n(4, 'BT11-046'), // Marking Celestial, Arabhaki
        ...n(3, 'BT11-047'), // Order Celestial, Yeqon
        ...n(3, 'BT11-026'), // Underlay Celestial, Hesediel
        ...n(4, 'BT11-024'), // Wild Shot Celestial, Raguel (G2)
        ...n(4, 'BT11-025'), // Candle Celestial, Sariel
        ...n(3, 'BT11-045'), // Doctroid Argus
        ...n(4, 'BT11-002'), // Solidify Celestial, Zerachiel (G3)
        ...n(4, 'BT11-001'), // Prophecy Celestial, Ramiel
      ],
    },
  },
  {
    name: 'Tachikaze — Ancient Dragon, Tyrannolegend',
    description:
      'Ancient Dragons trade themselves away for power; Tyrannolegend eats three for +10000/+1.',
    deck: {
      firstVanguard: 'BT11-082',
      cards: [
        ...n(1, 'BT11-082'),
        ...n(4, 'BT11-084'), // Ancient Dragon, Dinodile (critical)
        ...n(4, 'BT11-085'), // Ancient Dragon, Titanocargo (draw)
        ...n(4, 'BT11-086'), // Ancient Dragon, Caudinoise (stand)
        ...n(4, 'BT11-087'), // Ancient Dragon, Ornithhealer (heal)
        ...n(4, 'BT11-015'), // Ancient Dragon, Paraswall (G1 sentinel)
        ...n(4, 'BT11-079'), // Ancient Dragon, Triplasma
        ...n(3, 'BT11-037'), // Ancient Dragon, Iguanogorg
        ...n(3, 'BT11-080'), // Ancient Dragon, Gattlingaro
        ...n(4, 'BT11-036'), // Ancient Dragon, Beamankylo (G2)
        ...n(4, 'BT11-076'), // Ancient Dragon, Dinocrowd
        ...n(3, 'BT11-077'), // Launcher Mammoth
        ...n(4, 'BT11-013'), // Ancient Dragon, Tyrannolegend (G3)
        ...n(4, 'BT11-012'), // Ancient Dragon, Spinodriver
      ],
    },
  },
  {
    name: 'Aqua Force — Thundering Ripple, Genovious',
    description:
      'Ride the Ripple line, attack with three rested front-row units, then Genovious stands the whole team again.',
    deck: {
      firstVanguard: 'BT11-042',
      cards: [
        ...n(1, 'BT11-042'),
        ...n(4, 'BT11-100'), // Jet-ski Rider (critical)
        ...n(4, 'TD07-016'), // Pyroxene Communications Sea Otter Soldier (draw)
        ...n(4, 'BT11-102'), // Mass Production Sailor (stand)
        ...n(4, 'BT11-101'), // Ice Floe Angel (heal)
        ...n(4, 'BT11-095'), // Silent Ripple, Sotirio
        ...n(4, 'BT08-019'), // Emerald Shield, Paschal (G1 sentinel)
        ...n(3, 'BT11-096'), // Mercenary Brave Shooter
        ...n(3, 'BT11-097'), // Battle Siren, Euphenia
        ...n(4, 'BT11-041'), // Rising Ripple, Pavroth (G2)
        ...n(4, 'BT11-093'), // Twin Strike Brave Shooter
        ...n(3, 'BT11-094'), // Titan of the Beam Rifle
        ...n(4, 'BT11-018'), // Thundering Ripple, Genovious (G3)
        ...n(4, 'BT11-007'), // Blue Flight Dragon, Trans-core Dragon
      ],
    },
  },
  // ---- BT12 ---------------------------------------------------------------------------------------
  {
    name: 'Link Joker — Star-vader, Nebula Lord Dragon',
    description:
      "Lock the opponent's rear-guards; every locked card powers up your whole front row.",
    deck: {
      firstVanguard: 'BT12-033',
      cards: [
        ...n(1, 'BT12-033'),
        ...n(4, 'BT12-072'), // Star-vader, Weiss Soldat (critical)
        ...n(4, 'BT12-073'), // Star-vader, Scounting Ferris (draw)
        ...n(4, 'BT12-074'), // Star-vader, Moon Commander (stand)
        ...n(4, 'TD11-017'), // Star-vader, Stellar Garage (heal)
        ...n(4, 'BT12-014'), // Barrier Star-vader, Promethium (G1 sentinel)
        ...n(4, 'BT12-068'), // Demon Claw Star-vader, Lanthanum
        ...n(3, 'BT12-069'), // Strafing Star-vader, Ruthenium
        ...n(3, 'BT12-070'), // Paradox Nail Fenrir
        ...n(4, 'BT12-063'), // Furious Claw Star-vader, Niobium (G2)
        ...n(4, 'BT12-065'), // Singularity Sniper
        ...n(3, 'BT12-066'), // Le Maul
        ...n(4, 'BT12-005'), // Star-vader, Nebula Lord Dragon (G3)
        ...n(4, 'BT12-062'), // Innocent Blade, Heartless
      ],
    },
  },
  {
    name: 'Shadow Paladin — Revenger, Raging Form Dragon',
    description:
      'Revengers call Revengers; after an attack, Raging Form Dragon rides itself again, standing, for a second swing.',
    deck: {
      firstVanguard: 'BT12-023',
      cards: [
        ...n(1, 'BT12-023'),
        ...n(4, 'BT12-049'), // Revenger, Air Raid Dragon (critical)
        ...n(4, 'TD10-015'), // Freezing Revenger (draw)
        ...n(4, 'BT12-050'), // Revenger, Waking Angel (stand)
        ...n(4, 'TD10-017'), // Healing Revenger (heal)
        ...n(4, 'BT12-011'), // Dark Revenger, Mac Lir (G1 sentinel)
        ...n(4, 'BT12-022'), // Revenger, Dark Bond Trumpeter
        ...n(3, 'BT12-046'), // Malice Revenger, Dylan
        ...n(3, 'BT12-021'), // Barrier Troop Revenger, Dorint
        ...n(4, 'BT12-010'), // Dark Cloak Revenger, Tartu (G2)
        ...n(4, 'TD10-006'), // Blaster Dark Revenger
        ...n(3, 'BT12-044'), // Jacbau Revenger
        ...n(4, 'BT12-001'), // Revenger, Raging Form Dragon (G3)
        ...n(4, 'BT12-009'), // Witch of Cursed Talisman, Etain
      ],
    },
  },
  {
    name: 'Dark Irregulars — Demon Marquis, Amon "Яeverse"',
    description:
      "Pack the soul with Amon's Followers, then lock a rear-guard to turn Amon into a soul-powered finisher.",
    deck: {
      firstVanguard: 'BT12-083',
      cards: [
        ...n(1, 'BT12-083'),
        ...n(4, 'BT12-085'), // Amon's Follower, Cruel Hand (critical)
        ...n(4, 'BT12-086'), // Amon's Follower, Psychic Waitress (draw)
        ...n(4, 'BT12-087'), // Amon's Follower, Meteor Cracker (stand)
        ...n(4, 'BT12-088'), // Amon's Follower, Hell's Trick (heal)
        ...n(4, 'BT12-017'), // Amon's Follower, Vlad Specula (G1 sentinel)
        ...n(4, 'BT12-079'), // Amon's Follower, Hell's Deal
        ...n(3, 'BT12-080'), // Amon's Follower, Phu Geenlin
        ...n(3, 'BT12-038'), // Amon's Follower, Fools Palm
        ...n(4, 'BT12-076'), // Amon's Follower, Hell's Draw (G2)
        ...n(4, 'BT12-037'), // Amon's Follower, Ron Geenlin
        ...n(3, 'BT12-036'), // Amon's Follower, Psycho Grave
        ...n(4, 'BT12-007'), // Demon Marquis, Amon "Яeverse" (G3)
        ...n(4, 'BT12-015'), // King of Masks, Dantarian
      ],
    },
  },
  {
    name: 'Pale Moon — Silver Thorn Dragon Queen, Luquier "Яeverse"',
    description:
      'Silver Thorns slip in and out of the soul; Luquier Яeverse locks one to call a +5000 attacker.',
    deck: {
      firstVanguard: 'BT12-097',
      cards: [
        ...n(1, 'BT12-097'),
        ...n(4, 'BT12-099'), // Silver Thorn, Barking Dragon (critical)
        ...n(4, 'BT12-100'), // Silver Thorn Marionette, Natasha (draw)
        ...n(4, 'BT12-101'), // Silver Thorn Beast Tamer, Serge (stand)
        ...n(4, 'BT12-102'), // Silver Thorn Juggler, Nadia (heal)
        ...n(4, 'BT12-020'), // Silver Thorn Hypnos, Lydia (G1 sentinel)
        ...n(4, 'BT12-092'), // Silver Thorn Assistant, Irina
        ...n(3, 'BT12-093'), // Silver Thorn Beast Tamer, Ana
        ...n(3, 'BT12-094'), // Silver Thorn, Breathing Dragon
        ...n(4, 'BT12-041'), // Silver Thorn Beast Tamer, Maricica (G2)
        ...n(4, 'BT12-042'), // Silver Thorn, Rising Dragon
        ...n(3, 'BT12-091'), // Flying Hippogriff
        ...n(4, 'BT12-008'), // Silver Thorn Dragon Queen, Luquier "Яeverse" (G3)
        ...n(4, 'BT12-018'), // Miracle Pop, Eva
      ],
    },
  },
  // ---- BT13 ---------------------------------------------------------------------------------------
  {
    name: 'Nubatama — Shura Stealth Dragon, Kujikiricongo',
    description:
      "Bind the opponent's hand and rear-guards until the end of the turn so they can't guard or fight back.",
    deck: {
      firstVanguard: 'BT13-025',
      cards: [
        ...n(1, 'BT13-025'),
        ...n(4, 'BT13-057'), // Stealth Dragon, Kurogane (critical)
        ...n(4, 'BT13-058'), // Stealth Fiend, Ohtsuzura (draw)
        ...n(4, 'BT13-060'), // Stealth Fiend, Mashiromomen (stand)
        ...n(4, 'BT13-059'), // Stealth Fiend, Zashikihime (heal)
        ...n(4, 'BT13-011'), // Stealth Beast, Mijingakure (G1 sentinel)
        ...n(4, 'BT13-053'), // Tempest Stealth Rogue, Fuuki
        ...n(3, 'BT13-054'), // Stealth Dragon, Kodachifubuki
        ...n(3, 'BT13-055'), // Stealth Fiend, Mezuou
        ...n(4, 'BT13-024'), // Stealth Beast, Tamahagane (G2)
        ...n(4, 'BT13-050'), // Stealth Dragon, Kokujyo
        ...n(3, 'BT13-051'), // Stealth Fiend, Gozuou
        ...n(4, 'BT13-002'), // Shura Stealth Dragon, Kujikiricongo (G3)
        ...n(4, 'BT13-010'), // Shura Stealth Dragon, Kabukicongo
      ],
    },
  },
  {
    name: 'Nova Grappler — Deadliest Beast Deity, Ethics Buster "Яeverse"',
    description:
      'Beast Deities stand back up again and again; Ethics Buster Яeverse attacks twice.',
    deck: {
      firstVanguard: 'BT13-065',
      cards: [
        ...n(1, 'BT13-065'),
        ...n(4, 'BT13-066'), // Beast Deity, Death Stinger (critical)
        ...n(4, 'BT13-067'), // Beast Deity, Van Paurus (draw)
        ...n(4, 'BT13-068'), // Beast Deity, Bright Cobra (stand)
        ...n(4, 'BT13-069'), // Beast Deity, Rescue Bunny (heal)
        ...n(4, 'BT13-013'), // Beast Deity, Solar Falcon (G1 sentinel)
        ...n(4, 'BT13-026'), // Beast Deity, Max Beat
        ...n(3, 'BT13-064'), // Beast Deity, Desert Gator
        ...n(3, 'BT13-027'), // Energy Charger
        ...n(4, 'BT13-012'), // Beast Deity, Brainy Papio (G2)
        ...n(4, 'BT10-040'), // Beast Deity, Hatred Chaos
        ...n(3, 'BT13-063'), // Gattlingraizer
        ...n(4, 'BT13-004'), // Deadliest Beast Deity, Ethics Buster "Яeverse" (G3)
        ...n(2, 'BT13-003'), // Strongest Beast Deity, Ethics Buster Extreme
        ...n(2, 'BT10-008'), // Beast Deity, Ethics Buster
      ],
    },
  },
  {
    name: 'Dimension Police — Dark Dimensional Robo, "Яeverse" Daiyusha',
    description:
      "Dimensional Robos lock themselves to crush the opposing vanguard's power by 10000.",
    deck: {
      firstVanguard: 'BT13-032',
      cards: [
        ...n(1, 'BT13-032'),
        ...n(4, 'BT13-075'), // Demon-eye Monster, Gorgon (critical)
        ...n(4, 'BT13-076'), // Dimensional Robo, Daicrane (draw)
        ...n(4, 'BT13-077'), // Dimensional Robo, Goflight (stand)
        ...n(4, 'BT13-078'), // Dimensional Robo, Gorescue (heal)
        ...n(4, 'BT13-014'), // Dimensional Robo, Daishield (G1 sentinel)
        ...n(4, 'TD12-012'), // Dimensional Robo, Daimariner
        ...n(3, 'BT13-031'), // Dimensional Robo, Gocannon
        ...n(3, 'TD12-011'), // Dimensional Robo, Daibrave
        ...n(4, 'TD12-004'), // Dimensional Robo, Daifighter (G2)
        ...n(4, 'BT13-029'), // Dimensional Robo, Daiheart
        ...n(3, 'TD12-005'), // Dimensional Robo, Daidragon
        ...n(4, 'BT13-005'), // Dark Dimensional Robo, "Яeverse" Daiyusha (G3)
        ...n(2, 'BT03-020'), // Super Dimensional Robo, Daiyusha
        ...n(2, 'BT13-006'), // Original Saver, Zero
      ],
    },
  },
  {
    name: 'Link Joker — Star-vader, Chaos Breaker Dragon',
    description:
      "Lock rear-guards, and when they unlock at the end of the opponent's turn, Chaos Breaker retires them.",
    deck: {
      firstVanguard: 'BT13-084',
      cards: [
        ...n(1, 'BT13-084'),
        ...n(4, 'BT12-072'), // Star-vader, Weiss Soldat (critical)
        ...n(4, 'BT12-073'), // Star-vader, Scounting Ferris (draw)
        ...n(4, 'BT12-074'), // Star-vader, Moon Commander (stand)
        ...n(4, 'TD11-017'), // Star-vader, Stellar Garage (heal)
        ...n(4, 'BT12-014'), // Barrier Star-vader, Promethium (G1 sentinel)
        ...n(4, 'BT13-081'), // Prison Gate Star-vader, Palladium
        ...n(3, 'BT13-083'), // Star-vader, Chaos Beat Dragon
        ...n(3, 'BT12-068'), // Demon Claw Star-vader, Lanthanum
        ...n(4, 'BT13-015'), // Star-vader, Colony Maker (G2)
        ...n(4, 'BT13-080'), // Devastation Star-vader, Tungsten
        ...n(3, 'BT12-063'), // Furious Claw Star-vader, Niobium
        ...n(4, 'BT13-007'), // Star-vader, Chaos Breaker Dragon (G3)
        ...n(4, 'BT13-033'), // Knight of Entropy
      ],
    },
  },
  // ---- BT14 ---------------------------------------------------------------------------------------
  {
    name: 'Royal Paladin — Broken Heart Jewel Knight, Ashlei "Яeverse"',
    description:
      "Jewel Knights lock themselves to retire the opponent's front row and call more Jewel Knights.",
    deck: {
      firstVanguard: 'BT14-049',
      cards: [
        ...n(1, 'BT14-049'),
        ...n(4, 'BT14-050'), // Jewel Knight, Noble Stinger (critical)
        ...n(4, 'BT14-051'), // Jewel Knight, Sacred Unicorn (draw)
        ...n(4, 'BT14-052'), // Jewel Knight, Opt Harpist (stand)
        ...n(4, 'BT14-053'), // Jewel Knight, Hilmy (heal)
        ...n(4, 'BT14-011'), // Summoning Jewel Knight, Gloria (G1 sentinel)
        ...n(4, 'BT14-047'), // Jewel Knight, Melmy
        ...n(4, 'BT14-048'), // Security Jewel Knight, Alwain
        ...n(4, 'BT14-022'), // Linking Jewel Knight, Tilda (G2)
        ...n(4, 'BT14-010'), // Banding Jewel Knight, Miranda
        ...n(4, 'BT14-045'), // Jewel Knight, Tranmy
        ...n(4, 'BT14-001'), // Broken Heart Jewel Knight, Ashlei "Яeverse" (G3)
        ...n(3, 'BT10-001'), // Pure Heart Jewel Knight, Ashlei
        ...n(2, 'BT14-043'), // Knight of Frevor, Hector
      ],
    },
  },
  {
    name: 'Gold Paladin — Salvation Lion, Grand Ezel Scissors',
    description:
      'Fill all five rear-guard circles with Gold Paladins, then Grand Ezel swings for +10000 and an extra critical.',
    deck: {
      firstVanguard: 'BT14-063',
      cards: [
        ...n(1, 'BT14-063'),
        ...n(4, 'TD08-014'), // critical
        ...n(4, 'TD08-015'), // draw
        ...n(4, 'BT14-064'), // Liberator, Ground Crack (stand)
        ...n(4, 'BT14-065'), // Naapgal Liberator (heal)
        ...n(4, 'BT14-012'), // Sword Formation Liberator, Igraine (G1 sentinel)
        ...n(4, 'BT14-060'), // Sacred Twin Beast, White Lion
        ...n(4, 'BT14-059'), // Knight of Passion, Torre
        ...n(4, 'BT14-026'), // Burning Scale Knight, Eliwood (G2)
        ...n(4, 'BT14-057'), // Sacred Twin Beast, Black Lion
        ...n(4, 'BT14-058'), // Blue Axe Knight, Taliesin
        ...n(4, 'BT14-003'), // Salvation Lion, Grand Ezel Scissors (G3)
        ...n(3, 'BT14-055'), // Liberator, Burning Blow
        ...n(2, 'BT14-054'), // Sacred Guardian Beast, Ceryneia
      ],
    },
  },
  {
    name: 'Kagero — Dauntless Dominate Dragon "Яeverse"',
    description:
      "Lock a rear-guard so every Kagero drive check retires one of the opponent's small rear-guards.",
    deck: {
      firstVanguard: 'BT14-034',
      cards: [
        ...n(1, 'BT14-034'),
        ...n(4, 'BT14-084'), // Lizard Soldier, Goraha (critical)
        ...n(4, 'BT14-085'), // Flame of Rest, Geara (draw)
        ...n(4, 'BT14-086'), // Wyvern Strike, Flee (stand)
        ...n(4, 'BT14-087'), // Dragon Dancer, Barbara (heal)
        ...n(4, 'BT11-011'), // G1 sentinel
        ...n(4, 'BT14-033'), // Dragon Knight, Akram
        ...n(4, 'BT14-080'), // Diable Drive Dragon
        ...n(4, 'BT14-032'), // Dominate Drive Dragon (G2)
        ...n(4, 'BT14-078'), // Dragon Knight, Razer
        ...n(4, 'BT14-079'), // Demonic Dragon Mage, Taksaka
        ...n(4, 'BT14-006'), // Dauntless Dominate Dragon "Яeverse" (G3)
        ...n(3, 'BT11-005'), // Dauntless Drive Dragon
        ...n(2, 'BT14-030'), // Vorpal Cannon Dragon
      ],
    },
  },
  {
    name: 'Murakumo — Covert Demonic Dragon, Hyakki Vogue "Яeverse"',
    description:
      'Copies of Hyakki Vogue "Яeverse" flood the field, and locking two rear-guards gives each of them +10000.',
    deck: {
      firstVanguard: 'BT14-090',
      cards: [
        ...n(1, 'BT14-090'),
        ...n(4, 'BT14-091'), // Dirk Stealth Rogue, Yaiba (critical)
        ...n(4, 'BT09-053'), // draw
        ...n(4, 'BT14-092'), // Dark Knight Stealth Rogue, Clogg (stand)
        ...n(4, 'BT09-056'), // heal
        ...n(4, 'BT14-016'), // Silver Snow, Sasame (G1 sentinel)
        ...n(4, 'BT14-089'), // Stealth Beast, Deathly Dagger
        ...n(4, 'BT14-037'), // Bangasa Stealth Rogue, Sukerock
        ...n(4, 'BT14-036'), // Demonic Hair Stealth Rogue, Grenjin (G2)
        ...n(4, 'BT14-088'), // Stealth Beast, Chain Geek
        ...n(4, 'BT05-029'), // Murakumo grade 2
        ...n(4, 'BT14-015'), // Covert Demonic Dragon, Hyakki Vogue "Яeverse" (G3)
        ...n(3, 'BT14-014'), // Covert Demonic Dragon, Kagura Bloome
        ...n(2, 'BT14-035'), // Truth Seeking Stealth Rogue, Amakusa
      ],
    },
  },
  // ---- BT15 ---------------------------------------------------------------------------------------
  {
    name: 'Link Joker — Star-vader, "Omega" Glendios',
    description:
      "Lock the opponent's whole field; with five locked cards at Limit Break 5, Glendios wins the game.",
    deck: {
      firstVanguard: 'BT15-073',
      cards: [
        ...n(1, 'BT15-073'),
        ...n(4, 'BT15-074'), // Star-vader, Sparkdoll (critical)
        ...n(4, 'BT15-075'), // Star-vader, Jeiratail (draw)
        ...n(4, 'BT15-076'), // Star-vader, Brushcloud (stand)
        ...n(4, 'BT15-077'), // Recollection Star-vader, Tellurium (heal)
        ...n(4, 'BT12-014'), // Barrier Star-vader, Promethium (G1 sentinel)
        ...n(4, 'BT15-070'), // Planet Collapse Star-vader, Erbium
        ...n(4, 'BT15-072'), // Engraving Star-vader, Praseodymium
        ...n(4, 'BT15-030'), // Star-vader, Magnet Hollow (G2)
        ...n(4, 'BT15-031'), // Star-vader, Cold Death Dragon
        ...n(4, 'BT15-069'), // Negligible Hydra
        ...n(4, 'BT15-000'), // Star-vader, "Omega" Glendios (G3)
        ...n(4, 'BT15-006'), // Star-vader, "Яeverse" Cradle
        ...n(1, 'BT15-068'), // Soundless Archer, Conductance
      ],
    },
  },
  {
    name: 'Shadow Paladin — Revenger, Dragruler Phantom',
    description:
      'Revengers retire themselves to power up the vanguard and deal the opponent an extra damage.',
    deck: {
      firstVanguard: 'BT15-024',
      cards: [
        ...n(1, 'BT15-024'),
        ...n(4, 'TD10-014'), // Grim Revenger (critical)
        ...n(4, 'TD10-015'), // Freezing Revenger (draw)
        ...n(4, 'TD10-016'), // Awaking Revenger (stand)
        ...n(4, 'TD10-017'), // Healing Revenger (heal)
        ...n(4, 'BT15-010'), // Hellrage Revenger, Quesal (G1 sentinel)
        ...n(4, 'BT15-048'), // Eloquence Revenger, Glonn
        ...n(4, 'BT15-047'), // Self-Control Revenger, Rakia
        ...n(4, 'BT15-023'), // Wily Revenger, Mana (G2)
        ...n(4, 'BT15-044'), // Overcoming Revenger, Rukea
        ...n(4, 'BT15-045'), // Demon World Castle, Sturmangriff
        ...n(4, 'BT15-002'), // Revenger, Dragruler Phantom (G3)
        ...n(3, 'TD10-001'), // Illusionary Revenger, Mordred Phantom
        ...n(2, 'BT15-001'), // Revenger, Desperate Dragon
      ],
    },
  },
  {
    name: 'Kagero — Dragonic Overlord "The Яe-birth"',
    description:
      'Lock the whole back field and Overlord "The Яe-birth" stands up again after every attack on the vanguard.',
    deck: {
      firstVanguard: 'BT15-029',
      cards: [
        ...n(1, 'BT15-029'),
        ...n(4, 'BT15-064'), // Demonic Dragon Mage, Apalala (critical)
        ...n(4, 'BT15-065'), // Treasure Hunt Dracokid (draw)
        ...n(4, 'BT15-066'), // Flame of Determination, Puralis (stand)
        ...n(4, 'BT15-067'), // Dragon Dancer, Therese (heal)
        ...n(4, 'BT15-015'), // Dragon Knight, Gimel (G1 sentinel)
        ...n(4, 'BT15-060'), // Eternal Bringer Griffin
        ...n(4, 'BT15-061'), // Violence Horn Dragon
        ...n(4, 'BT15-014'), // Dragonic Burnout (G2)
        ...n(4, 'BT15-059'), // Wyvern Strike, Jiet
        ...n(4, 'BT15-058'), // Dragon Knight, Dalette
        ...n(4, 'BT15-005'), // Dragonic Overlord "The Яe-birth" (G3)
        ...n(4, 'BT15-004'), // Dragonic Overlord
        ...n(1, 'BT15-057'), // Demonic Dragon Berserker, Houkenyasha
      ],
    },
  },
  {
    name: 'Megacolony — Machining Spark Hercules',
    description:
      "Rest the opponent's whole field and keep it from standing; Spark Hercules then attacks for +10000 and an extra critical.",
    deck: {
      firstVanguard: 'BT15-099',
      cards: [
        ...n(1, 'BT15-099'),
        ...n(4, 'BT15-100'), // Machining Scorpion (critical)
        ...n(4, 'BT04-065'), // Raider Mantis (draw)
        ...n(4, 'BT15-102'), // Machining Cicada (stand)
        ...n(4, 'BT15-101'), // Machining Bombyx (heal)
        ...n(4, 'BT15-020'), // Machining Ladybug (G1 sentinel)
        ...n(4, 'BT15-097'), // Machining Black Soldier
        ...n(4, 'BT15-098'), // Machining Caucasus
        ...n(1, 'BT15-042'), // Machining Locust
        ...n(4, 'BT15-095'), // Machining Tarantula (G2)
        ...n(4, 'BT15-096'), // Machining Papilio
        ...n(4, 'BT15-041'), // Machining Red Soldier
        ...n(4, 'BT15-018'), // Machining Spark Hercules (G3)
        ...n(4, 'BT15-019'), // Unrivaled Blade Rogue, Cyclomatooth
      ],
    },
  },
];
