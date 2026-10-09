/**
 * BT03 "Demonic Lord Invasion": ability scripts (DECISIONS D-010/D-011).
 * Each ability's `text` is the official English text it implements. Cards not listed are vanilla.
 * Card IDs follow the Japanese set (the English product numbers some cards differently).
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  boostHitChargeReturn,
  clanCalledCharge,
  drawThenBottom,
  fallenAllyPower,
  handToSoul,
  hitCharge,
  lineageWeakness,
  mainPhaseCharge,
  namedInSoulPower,
  onSoulIn,
  opponentFewRearGuards,
  perfectGuard,
  placedCharge,
  raptorRecall,
  riddenCharge,
  searchToHand,
  soulSixPower,
  soulSwap,
  stepRide,
  twoGradeThrees,
} from './shapes';

const DI = 'Dark Irregulars';
const PM = 'Pale Moon';
const TK = 'Tachikaze';
const RP = 'Royal Paladin';
const OTT = 'Oracle Think Tank';
const NG = 'Nova Grappler';
const KAGERO = 'Kagero';
const DP = 'Dimension Police';

const FULL_MOON = 'Goddess of the Full Moon, Tsukuyomi';
const HALF_MOON = 'Goddess of the Half Moon, Tsukuyomi';
const CRESCENT_MOON = 'Goddess of the Crescent Moon, Tsukuyomi';
const ICHIBYOSHI = 'Godhawk, Ichibyoshi';
const GODLY_SPEED = 'Knight of Godly Speed, Galahad';
const TRIBULATIONS = 'Knight of Tribulations, Galahad';
const QUESTS = 'Knight of Quests, Galahad';
const DRANGAL = 'Drangal';
const CRIMSON = 'Crimson Beast Tamer';

const { auto, act, cont, self, bound, units, cards } = ab;

const rideChainText = (name: string) =>
  `[AUTO](VC):At the beginning of your ride phase, look at five cards from the top of your deck, search for up to one card named "${name}" from among them, ride it, and put the rest on the bottom of your deck in any order. If you rode, you cannot normal ride during that ride phase.`;
const sentinelText = (clan: string) =>
  `[AUTO]:[Choose a <${clan}> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <${clan}> that is being attacked, and that unit cannot be hit until end of that battle.`;
const fallenAllyText =
  '[AUTO](VC/RC):During your turn, when another of your <Tachikaze> rear-guards is put into the drop zone, this unit gets [Power] +1000 until end of turn.';
const soulSixText = (clan: string) =>
  `[CONT](VC/RC):During your turn, if the number of <${clan}> in your soul is six or more, this unit gets [Power] +3000.`;
const boostReturnText =
  '[AUTO](RC):When an attack hits during the battle that this unit boosted ([Boost]), you may [Soul-Charge] 1. If you do, return this unit to your deck, and shuffle your deck.';
const palamedesText =
  '[AUTO](VC/RC):When this unit attacks, if the number of grade 3 <Royal Paladin> vanguards and/or rear-guards you have is two or more, this unit gets [Power] +3000 until end of that battle.';
const fewRearGuardsText =
  '[AUTO](VC/RC):When this unit attacks, if the number of rear-guards your opponent has is two or less, this unit gets [Power] +3000 until end of that battle.';
const ottDrawText = (trigger: string, zones: string) =>
  `[AUTO](${zones}):When this unit ${trigger}, if the number of <Oracle Think Tank> in your soul is six or more, draw a card, choose a card from your hand, and put it on the bottom of your deck.`;
const deathArmyText =
  "[AUTO](RC):When your vanguard's drive check reveals a grade 3 <Nova Grappler>, [Stand] this unit.";

const deathArmy = auto({
  id: '1',
  zones: ['RC'],
  trigger: ab.driveCheckReveals(
    { clan: NG, grade: { min: 3, max: 3 } },
    { owner: 'you', filter: { isVanguard: true } },
  ),
  effect: [ab.stand(self())],
  text: deathArmyText,
});

export const BT03: SetAbilities = {
  // Stil Vampir
  'BT03-001': [
    mainPhaseCharge(
      '[AUTO](VC):At the beginning of your main phase, [Soul-Charge] 1, and this unit gets [Power] +2000 until end of turn.',
    ),
    act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      effect: [
        ab.choose('t', units('opponent', ['RC'])),
        ab.putOnVC(bound('t')),
        // a delayed effect on the new vanguard: its master (the opponent) rides from the soul
        ab.atNextOn(
          bound('t'),
          'end_phase',
          [
            ab.choose('r', cards('you', ['soul']), 1, {
              prompt: 'Choose a card from your soul to ride',
            }),
            ab.superiorRide(bound('r')),
          ],
          'end_of_turn',
          'Choose a card from your soul, and ride it.',
        ),
      ],
      text: "[ACT](VC/RC):[Soul-Blast 8 & Counter-Blast 5] Choose one of your opponent's rear-guards, and put that unit on your opponent's (VC), and at the beginning of the end phase of that turn, your opponent chooses a card from his or her soul, and rides it.",
    }),
  ],
  // Demon World Marquis, Amon
  'BT03-002': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(self(), 'power', 1000, cards('you', ['soul'], { clan: DI }))],
      text: '[CONT](VC):During your turn, this unit gets [Power] +1000 for each <Dark Irregulars> in your soul.',
    }),
    act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1), ab.moveChosenCost(units('you', ['RC'], { clan: DI }), 'soul')],
      effect: [
        ab.choose('t', units('opponent', ['RC']), 1, {
          chooser: 'opponent',
          prompt: 'Choose one of your rear-guards to retire',
        }),
        ab.retire(bound('t')),
      ],
      text: '[ACT](VC):[Counter-Blast 1 & Choose one of your <Dark Irregulars> rear-guards, and put it into your soul] Your opponent chooses one of his or her rear-guards, and retires it.',
    }),
  ],
  // Nightmare Doll, Alice
  'BT03-003': [
    soulSwap(
      PM,
      'Nightmare Doll, Alice',
      ab.attackHits(),
      `[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When this unit's attack hits, if you have a <Pale Moon> vanguard, you may pay the cost. If you do, choose a <Pale Moon> other than a card named "Nightmare Doll, Alice" from your soul, and call it to (RC).`,
    ),
  ],
  // Ravenous Dragon, Gigarex
  'BT03-004': [fallenAllyPower(TK, fallenAllyText)],
  // Swordsman of the Explosive Flames, Palamedes
  'BT03-005': [attackBonus(twoGradeThrees(RP), palamedesText)],
  // Goddess of the Full Moon, Tsukuyomi
  'BT03-006': [
    lineageWeakness(
      [HALF_MOON, CRESCENT_MOON, ICHIBYOSHI],
      '[CONT](VC/RC):If you do not have a card named "Goddess of the Half Moon, Tsukuyomi", a card named "Goddess of the Crescent Moon, Tsukuyomi", and a card named "Godhawk, Ichibyoshi" in your soul, this unit gets [Power] -2000.',
    ),
    act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [ab.if_(ab.soulCountAtLeast(6, { clan: OTT }), [ab.draw(2), ...handToSoul()])],
      text: '[ACT](VC):[Counter-Blast 2] If the number of <Oracle Think Tank> in your soul is six or more, draw two cards, choose a card from your hand, and put it into your soul.',
    }),
  ],
  // Goddess of the Half Moon, Tsukuyomi
  'BT03-007': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: ab.all(ab.inSoul(CRESCENT_MOON), ab.inSoul(ICHIBYOSHI)),
      effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])],
      text: '[AUTO]:When this unit is placed on (VC), if you have a card named "Goddess of the Crescent Moon, Tsukuyomi" and a card named "Godhawk, Ichibyoshi" in your soul, you may [Soul-Charge] 2.',
    }),
    stepRide(FULL_MOON, rideChainText(FULL_MOON), '2'),
  ],
  // Ultimate Lifeform, Cosmo Lord
  'BT03-008': [
    act({
      id: '1',
      zones: ['VC'],
      cost: [ab.restChosenCost(units('you', ['RC'], { clan: NG }))],
      effect: [ab.power(self(), 3000)],
      text: '[ACT](VC):[Choose one of your <Nova Grappler> rear-guards, and [Rest] it] This unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Edel Rose
  'BT03-009': [
    act({
      id: '1',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [
        ab.if_(ab.inSoul('Werwolf Sieger'), [ab.power(self(), 5000), ab.critical(self(), 1)]),
      ],
      text: '[ACT](VC):[Counter-Blast 2] If you have a card named "Werwolf Sieger" in your soul, this unit gets [Power] +5000/[Critical] +1 until end of turn.',
    }),
    act({
      id: '2',
      zones: ['hand'],
      cost: [ab.revealCost(self()), ab.moveCost(self(), 'deck_top')],
      effect: searchToHand('w', { name: 'Werwolf Sieger' }),
      text: '[ACT](Hand):[Reveal this card to your opponent, and put it on top of your deck] Search your deck for up to one card named "Werwolf Sieger", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Gwynn the Ripper
  'BT03-010': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: DI }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', units('opponent', ['RC'], { grade: { max: 2 } })),
        ab.retire(bound('t')),
      ],
      text: "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a <Dark Irregulars> vanguard, you may pay the cost. If you do, choose one of your opponent's grade 2 or less rear-guards, and retire it.",
    }),
  ],
  // March Rabbit of Nightmareland
  'BT03-011': [perfectGuard(DI, sentinelText(DI))],
  // Doreen the Thruster
  'BT03-012': [
    onSoulIn(
      DI,
      '[AUTO](RC):During your main phase, when a card is put into your soul, if you have a <Dark Irregulars> vanguard, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Dusk Illusionist, Robert
  'BT03-013': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('main_phase'),
      effect: [ab.soulCharge(1), ab.lookTopPlace()],
      text: '[AUTO](VC):At the beginning of your main phase, [Soul-Charge] 1, look at the top card of your deck, and put that card on the top or the bottom of your deck.',
    }),
    act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      effect: [ab.moveTo(units('opponent', ['RC'], { grade: { max: 1 } }), 'soul')],
      text: "[ACT](VC/RC):[Soul-Blast 8 & Counter-Blast 5] Put all of your opponent's grade 1 or less rear-guards into his or her soul.",
    }),
  ],
  // Crimson Beast Tamer
  'BT03-014': [
    namedInSoulPower(
      CRIMSON,
      '[CONT](VC/RC):During your turn, if you have a card named "Crimson Beast Tamer" in your soul, this unit gets [Power] +3000.',
    ),
  ],
  // Mirror Demon
  'BT03-015': [
    soulSwap(
      PM,
      'Mirror Demon',
      ab.attackHits(),
      `[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When this unit's attack hits, if you have a <Pale Moon> vanguard, you may pay the cost. If you do, choose a <Pale Moon> other than a card named "Mirror Demon" from your soul, and call it to (RC).`,
    ),
  ],
  // Hades Hypnotist
  'BT03-016': [perfectGuard(PM, sentinelText(PM))],
  // Archbird
  'BT03-017': [perfectGuard(TK, sentinelText(TK))],
  // Knight of Godly Speed, Galahad
  'BT03-018': [
    lineageWeakness(
      [TRIBULATIONS, QUESTS, DRANGAL],
      '[CONT](VC/RC):If you do not have a card named "Knight of Tribulations, Galahad", a card named "Knight of Quests, Galahad", and a card named "Drangal" in your soul, this unit gets [Power] -2000.',
    ),
    act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [
        ab.if_(ab.soulCountAtLeast(6, { clan: RP }), [
          ab.power(self(), 3000),
          ab.critical(self(), 1),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 2] If the number of <Royal Paladin> in your soul is six or more, this unit gets [Power] +3000/[Critical] +1 until end of turn.',
    }),
  ],
  // Dual Axe Archdragon
  'BT03-019': [attackBonus(opponentFewRearGuards(), fewRearGuardsText)],
  // Super Dimensional Robo, Daiyusha
  'BT03-020': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: ab.powerAtLeast(14000),
      effect: [ab.critical(self(), 1, 'end_of_battle')],
      text: "[AUTO](VC):At the beginning of your attack step, if this unit's [Power]  is 14000 or greater, this unit gets [Critical] +1 until end of that battle.",
    }),
  ],
  // Imprisoned Fallen Angel, Saraqael
  'BT03-021': [
    {
      ...ab.restraint('restraint'),
      zones: ['VC', 'RC'],
      text: '[CONT](VC/RC):Restraint (This unit cannot attack.)',
    },
    act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [ab.soulBlast(3)],
      effect: [ab.lose(self(), { ability: 'restraint' })],
      text: '[ACT](VC/RC):[Soul-Blast 3] This unit loses "Restraint" until end of turn.',
    }),
    auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.boostedBy({ clan: DI }),
      effect: [ab.power(self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit is boosted ([Boost]) by a <Dark Irregulars>, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // Demon of Aspiration, Amon
  'BT03-023': [soulSixPower(DI, soulSixText(DI))],
  // Alluring Succubus
  'BT03-024': [
    placedCharge(
      DI,
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Dark Irregulars> vanguard, you may [Soul-Charge] 1.',
    ),
  ],
  // Vermillion Gatekeeper
  'BT03-025': [
    riddenCharge(
      DI,
      '[AUTO](VC):When another <Dark Irregulars> rides this unit, you may [Soul-Charge] 1.',
    ),
  ],
  // Barking Manticore
  'BT03-026': [
    namedInSoulPower(
      CRIMSON,
      '[CONT](VC):During your turn, if you have a card named "Crimson Beast Tamer" in your soul, this unit gets [Power] +3000.',
      ['VC'],
    ),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.draw(1), ...handToSoul()],
      text: '[AUTO]:When this unit is placed on (VC), draw a card, choose a card from your hand, and put it into your soul.',
    }),
  ],
  // Skull Juggler
  'BT03-028': [
    placedCharge(
      PM,
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Pale Moon> vanguard, you may [Soul-Charge] 1.',
    ),
  ],
  // Midnight Bunny
  'BT03-029': [
    soulSwap(
      PM,
      'Midnight Bunny',
      ab.boostedAttackHits(),
      '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits during the battle that this unit boosted ([Boost]), if you have a <Pale Moon> vanguard, you may pay the cost. If you do, choose a <Pale Moon> other than a card named "Midnight Bunny" from your soul, and call it to (RC).',
    ),
  ],
  // Turquoise Beast Tamer
  'BT03-030': [
    namedInSoulPower(
      CRIMSON,
      '[CONT](VC/RC):During your turn, if you have a card named "Crimson Beast Tamer" in your soul, this unit gets [Power] +3000.',
    ),
  ],
  // Hades Ringmaster
  'BT03-031': [
    riddenCharge(
      PM,
      '[AUTO](VC):When another <Pale Moon> rides this unit, you may [Soul-Charge] 1.',
    ),
  ],
  // Raging Dragon, Blastsaurus
  'BT03-032': [
    raptorRecall(
      'Raging Dragon, Blastsaurus',
      '[AUTO]:[Choose a card from your hand, and discard it] When this unit is put into the drop zone from (RC), you may pay the cost. If you do, search your deck for up to one card named "Raging Dragon, Blastsaurus", call it to (RC), and shuffle your deck.',
    ),
  ],
  // Savage Warrior
  'BT03-034': [fallenAllyPower(TK, fallenAllyText)],
  // Toypugal
  'BT03-035': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.boosts(),
      condition: twoGradeThrees(RP),
      effect: [ab.power(self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC/RC):When this unit boosts ([Boost]), if the number of grade 3 <Royal Paladin> vanguards and/or rear-guards you have is two or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Drangal
  'BT03-036': [stepRide(QUESTS, rideChainText(QUESTS))],
  // Oracle Guardian, Blue Eye
  'BT03-037': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts(),
      condition: ab.soulCountAtLeast(6, { clan: OTT }),
      effect: drawThenBottom(),
      text: ottDrawText('boosts ([Boost])', 'RC'),
    }),
  ],
  // Godhawk, Ichibyoshi
  'BT03-038': [stepRide(CRESCENT_MOON, rideChainText(CRESCENT_MOON))],
  // Death Army Lady
  'BT03-039': [deathArmy],
  // Death Army Guy
  'BT03-040': [deathArmy],
  // Decadent Succubus
  'BT03-041': [
    clanCalledCharge(
      DI,
      '[AUTO](VC):When another of your <Dark Irregulars> is placed on (RC), you may [Soul-Charge] 1.',
    ),
  ],
  // Poet of Darkness, Amon
  'BT03-043': [soulSixPower(DI, soulSixText(DI))],
  // Cursed Doctor (heal trigger reminder text only)
  'BT03-046': [],
  // Dark Queen of Nightmareland
  'BT03-047': [boostHitChargeReturn(boostReturnText)],
  // Elephant Juggler
  'BT03-048': [
    clanCalledCharge(
      PM,
      '[AUTO](VC):When another of your <Pale Moon> is placed on (RC), you may [Soul-Charge] 1.',
    ),
  ],
  // Hungry Clown
  'BT03-049': [
    hitCharge(
      PM,
      "[AUTO](VC/RC): When this unit's attack hits, if you have a <Pale Moon> vanguard, you may [Soul-Charge] 1.",
    ),
  ],
  // Candy Clown (heal trigger reminder text only)
  'BT03-053': [],
  // Rainbow Magician
  'BT03-054': [boostHitChargeReturn(boostReturnText)],
  // Vacuum Mammoth
  'BT03-055': [
    clanCalledCharge(
      TK,
      '[AUTO](VC):When another of your <Tachikaze> is placed on (RC), you may [Soul-Charge] 1.',
    ),
  ],
  // Savage Destroyer
  'BT03-056': [fallenAllyPower(TK, fallenAllyText)],
  // Raging Dragon, Sparksaurus
  'BT03-057': [
    raptorRecall(
      'Raging Dragon, Sparksaurus',
      '[AUTO]:[Choose a card from your hand, and discard it] When this unit is put into the drop zone from (RC), you may pay the cost. If you do, search your deck for up to one card named "Raging Dragon, Sparksaurus", call it to (RC), and shuffle your deck.',
    ),
  ],
  // Savage Shaman (heal trigger reminder text only)
  'BT03-060': [],
  // Black Cannon Tiger
  'BT03-061': [boostHitChargeReturn(boostReturnText)],
  // Knight of Tribulations, Galahad
  'BT03-062': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden({ name: GODLY_SPEED }),
      effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])],
      text: '[AUTO]:When a card named "Knight of Godly Speed, Galahad" rides this unit, you may [Soul-Charge] 2.',
    }),
    stepRide(GODLY_SPEED, rideChainText(GODLY_SPEED), '2'),
  ],
  // Gigantech Dozer
  'BT03-063': [soulSixPower(RP, soulSixText(RP))],
  // Swordsman of the Blaze, Palamedes
  'BT03-064': [attackBonus(twoGradeThrees(RP), palamedesText)],
  // Knight of Quests, Galahad
  'BT03-065': [stepRide(TRIBULATIONS, rideChainText(TRIBULATIONS))],
  // Borgal
  'BT03-066': [soulSixPower(RP, soulSixText(RP))],
  // Secretary Angel
  'BT03-068': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: ab.soulCountAtLeast(6, { clan: OTT }),
      effect: drawThenBottom(),
      text: ottDrawText('attacks', 'VC/RC'),
    }),
  ],
  // Oracle Guardian, Red Eye
  'BT03-069': [
    hitCharge(
      OTT,
      "[AUTO](VC/RC): When this unit's attack hits, if you have an <Oracle Think Tank> vanguard, you may [Soul-Charge] 1.",
    ),
  ],
  // Faithful Angel
  'BT03-070': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: ab.soulCountAtLeast(6, { clan: OTT }),
      effect: drawThenBottom(),
      text: ottDrawText('attacks', 'VC/RC'),
    }),
  ],
  // Goddess of the Crescent Moon, Tsukuyomi
  'BT03-071': [stepRide(HALF_MOON, rideChainText(HALF_MOON))],
  // Battle Sister, Vanilla
  'BT03-072': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.soulCountAtLeast(6, { clan: OTT }),
      effect: [ab.shield(self(), 5000, 'end_of_battle')],
      text: '[AUTO]:When this unit is placed on (GC), if the number of <Oracle Think Tank> in your soul is six or more, this unit gets [Shield] +5000 until end of that battle.',
    }),
  ],
  // Flame Edge Dragon
  'BT03-074': [
    hitCharge(
      KAGERO,
      "[AUTO](VC/RC): When this unit's attack hits, if you have a <Kagero> vanguard, you may [Soul-Charge] 1.",
    ),
  ],
  // Dragon Dancer, Lourdes
  'BT03-075': [attackBonus(opponentFewRearGuards(), fewRearGuardsText)],
  // Masked Police, Grander
  'BT03-078': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: ab.vanguardIs({ clan: DP }),
      effect: [ab.power(units('you', ['VC']), 2000)],
      text: '[AUTO](RC):When this unit attacks, if you have a <Dimension Police> vanguard, your vanguard gets [Power] +2000 until end of turn.',
    }),
  ],
};
