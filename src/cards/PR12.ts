/**
 * PR12: the official 【2012年度】PRカード list (docs/design/ORIGINAL_ERA_ROADMAP.md); ids use the Japanese PR number.
 * Reprints in the list are not repeated: they are recorded as `reprints` in the data file.
 * Silvest's deck date is not enforced and no fighter is ever Baron Kiddani (D-039). (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackPower,
  boostHitDiscardDraw,
  boostedByClan,
  cb1Plus1000,
  discardPump,
  drawThenBottom,
  guardShield,
  guardToSoul,
  lbAttackVanguard,
  lookCallOpen,
  placedCharge,
  placedPump2000,
  placedPumpGrade3,
  placedRetireFront,
  placedVCCB2,
  vanguardArrivesPump,
} from './shapes';

const NK = 'Narukami';
const GP = 'Gold Paladin';
const DI = 'Dark Irregulars';
const SP = 'Shadow Paladin';
const PM = 'Pale Moon';
const GN = 'Great Nature';
const AF = 'Angel Feather';
const ET = 'Etranger';
const RP = 'Royal Paladin';
const BLADE = 'Blaster Blade';
const grade3 = { min: 3, max: 3 };
/** "When another of your grade 3 <clan> is placed on (RC), this unit gets +3000 until end of turn." */
const grade3ArrivesPump = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.placedOn('RC', {
      owner: 'you',
      filter: { clan, grade: grade3, excludeSelf: true },
    }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });
/** "[CONT](VC):During your turn, if you have a grade 3 <clan> rear-guard, this unit gets +3000." */
const grade3RearGuardPower = (clan: string, text: string) =>
  ab.cont({
    id: 'g3',
    zones: ['VC'],
    condition: ab.all(ab.yourTurn(), ab.exists(ab.units('you', ['RC'], { clan, grade: grade3 }))),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });
/** D-039: nobody plays as Baron Kiddani in this game, so "if either fighter is …" is never true. */
const noFighterIsKiddani = ab.not(ab.all());

export const PR12: SetAbilities = {
  // Commander, Garry Gannon
  'PR12-0050': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Coongal
  'PR12-0055': [
    {
      ...guardToSoul,
      text: '[AUTO]:When this unit is put into the drop zone from (GC), put this unit into your soul.',
    },
  ],
  // Dreadcharge Dragon
  'PR12-0056': [
    grade3ArrivesPump(
      NK,
      '[AUTO](VC)/(RC):When another of your grade 3 <Narukami> is placed on (RC), this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Brightlance Dragoon
  'PR12-0057': [
    ab.cont({
      id: 'column',
      zones: ['VC', 'RC'],
      condition: ab.not(
        ab.exists(
          ab.units('you', ['VC', 'RC'], { clan: NK, sameColumnAsSource: true, excludeSelf: true }),
        ),
      ),
      effects: [ab.gets(ab.self(), 'power', -2000)],
      text: '[CONT](VC)/(RC):If you do not have another <Narukami> in the same column as this unit, this unit gets [Power] -2000.',
    }),
    {
      ...cb1Plus1000,
      text: '[ACT](VC)/(RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Battle Flag Knight, Laudine
  'PR12-0059': [
    placedPump2000(
      GP,
      '[AUTO]:When this unit is placed on (RC), choose another of your <Gold Paladin>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Red Magma
  'PR12-0061': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: ab.soulCountAtLeast(6, { clan: DI }),
      effect: drawThenBottom(),
      text: '[AUTO](VC/RC):When this unit attacks, if the number of <Dark Irregulars> in your soul is six or more, draw a card, choose a card from your hand, and put it on the bottom of your deck.',
    }),
  ],
  // Greed Shade
  'PR12-0062': [
    attackBonus(
      ab.handComparedToOpponent('>'),
      "[AUTO](VC)/(RC):When this unit attacks, if the number of cards in your hand is greater than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Satellitefall Dragon
  'PR12-0063': [
    grade3ArrivesPump(
      GP,
      '[AUTO](VC)/(RC):When another of your grade 3 <Gold Paladin> is placed on (RC), this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Blaster Mameshiba
  'PR12-0064': [
    {
      ...guardToSoul,
      text: '[AUTO]:When this unit is put into the drop zone from (GC), put this unit into your soul.',
    },
  ],
  // Incandescent Lion, Keroro Ezel
  'PR12-0065': [
    boostedByClan(
      ET,
      2000,
      '[AUTO](VC)/(RC):When this unit is boosted ([Boost]) by an <Etranger>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // The Dark Dictator
  'PR12-0067': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      effects: [ab.cannot(ab.self(), 'cannot_be_boosted')],
      text: '[CONT](VC):Your units cannot boost([Boost] ) this unit.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.self(), 'power', 2000, ab.units('you', ['RC'], { clan: SP }))],
      text: '[CONT](VC):During your turn, this unit gets [Power] +2000 for each of your <<Shadow Paladin>> rear-guards.',
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['front_RC'], { clan: SP }), 2, { upTo: true }),
        ab.power(ab.bound('t'), 5000),
      ],
      text: '[AUTO]:[Soul-Blast 3] When this unit is placed on (VC), you may pay the cost. If you do, choose up to two of your <<Shadow Paladin>> rear-guards in your front row, and those units get [Power] +5000 until end of turn.',
    }),
  ],
  // Dark Lord of Pale Moon
  'PR12-0068': [
    boostedByClan(
      PM,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost] ) by a <Pale Moon>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Blackmane Witch
  'PR12-0070': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.retireCost(ab.units('you', ['RC'], { clan: GP, excludeSelf: true }))],
      optional: true,
      effect: lookCallOpen(1, { clan: GP }),
      text: '[AUTO]:[Choose another of your <Gold Paladin> rear-guards, and retire it] When this unit is placed on (VC) or (RC), if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck.',
    }),
  ],
  // Rumble Gun Dragon
  'PR12-0071': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ clan: NK, grade: grade3 }),
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 1 } })),
        ab.retire(ab.bound('t')),
      ],
      text: "[AUTO](VC):When this unit's drive check reveals a grade 3 <Narukami>, choose one of your opponent's grade 1 or less rear-guards, and retire it.",
    }),
  ],
  // Flirtatious Succubus
  'PR12-0072': [
    placedCharge(
      DI,
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Dark Irregulars> vanguard, you may [Soul-Charge 1].',
    ),
  ],
  // Cycling Actor
  'PR12-0073': [
    placedPump2000(
      PM,
      '[AUTO]:When this unit is placed on (RC), choose another of your <Pale Moon>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Beaker Holstein
  'PR12-0074': [
    placedPump2000(
      GN,
      '[AUTO]:When this unit is placed on (RC), choose another of your <Great Nature>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Epitome of Knowledge, Silvest
  'PR12-0076': [
    ab.cont({
      id: 'deck_date',
      zones: ['any'],
      effects: [],
      text: '[CONT]: This card cannot be put in a deck after February 28, 2013.',
    }),
    attackPower({
      amount: 10000,
      zones: ['VC'],
      vanguardOnly: true,
      condition: ab.count(ab.units('you', ['RC'], { clan: GN }), { min: 3 }),
      text: '[AUTO](VC):When this unit attacks a vanguard, if the number of <Great Nature> rear-guards you have is three or more, this unit gets [Power] +10000 until end of that battle.',
    }),
  ],
  // Stamp Sea Otter
  'PR12-0077': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.vanguardIs({ clan: GN }),
      effects: [ab.cannot(ab.self(), 'cannot_be_retired')],
      text: '[CONT](RC):If you have a <Great Nature> vanguard, this unit cannot be retired by card effects.',
    }),
  ],
  // Spider-Man
  'PR12-0080': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    placedVCCB2(
      [
        ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 2 } })),
        ab.retire(ab.bound('t')),
      ],
      "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, choose one of your opponent's grade 2 or less rear-guards, and retire it.",
    ),
  ],
  // Medical Gunner, Hermieres
  'PR12-0081': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: AF }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'damage')],
      optional: true,
      effect: [
        ab.choose(
          'c',
          ab.cards('you', ['damage'], {
            clan: AF,
            faceUp: true,
            notName: 'Medical Gunner, Hermieres',
          }),
        ),
        ab.superiorCall(ab.bound('c')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your damage zone] When this unit\'s attack hits a vanguard, if you have an <Angel Feather> vanguard, you may pay the cost. If you do, choose a face up <Angel Feather> not named "Medical Gunner, Hermieres" from your damage zone, and call it to (RC).',
    }),
  ],
  // Assault Dragon, Circular Spino
  'PR12-0082': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { clan: 'Tachikaze', excludeSelf: true }))],
      optional: true,
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Choose another of your <Tachikaze> rear-guards, and retire it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Demonic Dragon Berserker, Vasuki
  'PR12-0083': [
    vanguardArrivesPump(
      NK,
      '[AUTO](RC):When your grade 3 <Narukami> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Battle Siren, Neferli
  'PR12-0085': [
    placedPumpGrade3(
      'Aqua Force',
      '[AUTO]:When this unit is placed on (RC), choose another of your grade 3 <Aqua Force>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Ladybug Cavalry
  'PR12-0086': [
    guardShield(
      GP,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC), if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Voltage Claw Dragon
  'PR12-0087': [
    placedRetireFront(
      ab.vanguardIs({ clan: NK }),
      "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, choose one of your opponent's rear-guards in the front row, and retire it.",
    ),
  ],
  // Knight of Afterglow, Gerard
  'PR12-0090': [
    ab.auto({
      id: 'lb',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attackHits('vanguard'),
      effect: lookCallOpen(3, { clan: GP, grade: grade3 }),
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit's attack hits a vanguard, look at up to three cards from the top of your deck, search for up to one grade 3 <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck in any order.",
    }),
    grade3RearGuardPower(
      GP,
      '[CONT](VC):During your turn, if you have a grade 3 <Gold Paladin> rear-guard, this unit gets [Power] +3000.',
    ),
  ],
  // Turbulence Dragon
  'PR12-0091': [
    ab.auto({
      id: 'lb',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.retire(ab.units('opponent', ['RC'], { grade: grade3 }))],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, retire all of your opponent's grade 3 rear-guards.",
    }),
    grade3RearGuardPower(
      NK,
      '[CONT](VC):During your turn, if you have a grade 3 <Narukami> rear-guard, this unit gets [Power] +3000.',
    ),
  ],
  // Exculpate the Blaster
  'PR12-0092': [
    ab.cont({
      id: 'ride',
      zones: ['hand'],
      condition: ab.not(ab.vanguardIs({ clan: RP, grade: grade3 })),
      effects: [ab.cannot(ab.self(), 'cannot_normal_ride')],
      text: '[CONT]Hand:If you do not have a grade 3 <<Royal Paladin>> vanguard, you cannot normal ride this card.',
    }),
    ab.cont({
      id: 'attack',
      zones: ['VC'],
      condition: ab.not(ab.inSoul(BLADE)),
      effects: [ab.cannot(ab.self(), 'cannot_attack')],
      text: '[CONT](VC):If you do not have a card named "Blaster Blade" in your soul, this unit cannot attack.',
    }),
    ab.auto({
      id: 'rc',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [ab.retire(ab.self())],
      text: '[AUTO]:When this unit is placed on (RC), retire this unit.',
    }),
    ab.act({
      id: 'all',
      zones: ['VC'],
      cost: [ab.counterBlast(3)],
      effect: [
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'all_units',
            zones: ['VC'],
            effects: [ab.allow(ab.self(), 'attack_all_units')],
            text: "[CONT](VC):This unit battles all of your opponent's units in one attack.",
          }),
        ),
      ],
      text: "[ACT](VC):[Counter-Blast 3] Until end of turn, this unit battles all of your opponent's units in one attack.",
    }),
    ab.auto({
      id: 'soul',
      zones: ['VC'],
      trigger: ab.attacks(),
      effect: [
        ab.power(ab.self(), 2000, 'end_of_turn', ab.cards('you', ['soul'], { notName: BLADE })),
        ab.moveTo(ab.cards('you', ['soul'], { notName: BLADE }), 'drop'),
      ],
      text: '[AUTO](VC):When this unit attacks, put all cards in your soul not named "Blaster Blade"_into your drop zone, and this unit gets [Power] +2000 until end of turn for each card put into your drop zone this way.',
    }),
    ab.auto({
      id: 'back',
      zones: ['VC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      effect: [
        ab.choose('b', ab.cards('you', ['drop', 'soul'], { name: BLADE })),
        ab.superiorRide(ab.bound('b')),
        ab.rest(ab.units('you', ['VC'])),
        ab.moveTo(ab.cards('you', ['soul']), 'drop'),
      ],
      text: '[AUTO](VC):At the end of the battle that this unit attacked, choose a card named "Blaster Blade" from your drop zone or soul, ride it as [Rest], and put all cards in your soul into your drop zone.',
    }),
  ],
  // Crimson Lightning Dragon
  'PR12-0093': [
    ...discardPump(
      NK,
      '[AUTO](VC):[Choose a <Narukami> from your hand, and diSCard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +6000 until end of that battle.\n[AUTO](RC):[Choose a <Narukami> from your hand, and diSCard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Kumamon
  'PR12-0094': [
    {
      ...guardToSoul,
      text: '[AUTO]:When this unit is put into the drop zone from (GC), put this unit into your soul.',
    },
  ],
  // Princess of Coral, Thetis
  'PR12-0095': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC)/(RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
    ab.alsoClan('Aqua Force', '[CONT]:This card is also an <Aqua Force>.'),
  ],
  // Holy Edge Knight
  'PR12-0096': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: GP }),
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <Gold Paladin> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Dragon Dancer, Stormy
  'PR12-0097': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: { on: 'put_into_drop', who: { owner: 'opponent' }, from: 'RC' },
      triggerIf: ab.duringYourMainPhase(),
      effect: [ab.power(ab.self(), 3000)],
      text: "[AUTO](VC/RC):During your main phase, when an opponent's rear-guard is put into the drop zone, this unit gets [Power] +3000 until end of turn.",
    }),
  ],
  // Stealth Fiend, Gashadokuro
  'PR12-0098': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.restChosenCost(ab.units('you', ['RC'], { clan: 'Murakumo' }))],
      effect: [
        ab.choose('u', ab.units('you', ['RC'], { clan: 'Murakumo' })),
        ab.moveTo(ab.bound('u'), 'deck_bottom'),
        ab.choose('t', ab.units('you', ['VC', 'RC'], { sameNameAsBound: 'u' })),
        ab.power(ab.bound('t'), 5000),
      ],
      text: '[ACT](VC):[Choose one of your <Murakumo> rear-guards, and [Rest] it] Choose one of your <Murakumo> rear-guards, put it on the bottom of your deck, choose one of your units with the same name as that unit, and it gets [Power] +5000 until end of turn.',
    }),
  ],
  // Earth Gunner
  'PR12-0099': [
    boostedByClan(
      DI,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by a <Dark Irregulars>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Soft Tank Sloth
  'PR12-0100': [
    ab.auto({
      id: 'end_drop',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      triggerIf: ab.duringYourEndPhase(),
      condition: ab.vanguardIs({ clan: GN }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: ab.counterCharge(2, true),
      text: '[AUTO]:[Soul-Blast 1] During your end phase, when this unit is put into your drop zone from (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, choose up to two cards from your damage zone, and turn them face up.',
    }),
  ],
  // Baron Kiddani
  'PR12-0101': [
    attackPower({
      id: '1',
      amount: 3000,
      zones: ['VC'],
      condition: noFighterIsKiddani,
      text: '[AUTO](VC):When this unit attacks, if either fighter is "Baron Kiddani", this unit gets [Power] +3000 until end of that battle.',
    }),
    attackPower({
      id: '2',
      amount: 1000,
      zones: ['RC'],
      condition: noFighterIsKiddani,
      text: '[AUTO](RC):When this unit attacks, if either fighter is "Baron Kiddani", this unit gets [Power] +1000 until end of that battle.',
    }),
  ],
};
