/**
 * EB09 "Dragonic Overlord The Re-birth" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  boostPower,
  boostedByClan,
  discardPump,
  hitDrawCB2,
  perfectGuard,
  vanguardArrivesPump,
} from './shapes';

const KG = 'Kagero';
const NOUVELLE = 'Transcendence Dragon, Dragonic Nouvelle Vague';
const kageroVanguard = ab.vanguardIs({ clan: KG });

export const EB09: SetAbilities = {
  // Transcendence Dragon, Dragonic Nouvelle Vague
  'EB09-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3), ab.soulBlast(3), ab.discard(1, { name: NOUVELLE })],
      effect: [ab.retire(ab.units('opponent', ['RC']))],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 3 & Soul-Blast 3 & Choose a card named "Transcendence Dragon, Dragonic Nouvelle Vague" from your hand, and discard it] Retire all of your opponent\'s rear-guards.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.nullifyTriggers('opponent')],
      text: "[CONT](VC):During your turn, all of your opponent's trigger effects are nullified.",
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.all(ab.is(ab.self(), { attacking: true }), {
        cond: 'battle_target',
        vanguard: true,
      }),
      effects: [ab.forbidGuard('opponent', { grade: { max: 0 } })],
      text: '[CONT](VC):During the battle that this unit attacks a vanguard, your opponent cannot call grade 0 units from hand to (GC).',
    }),
    ab.cont({
      id: '4',
      zones: ['RC'],
      effects: [ab.gets(ab.self(), 'power', -1000)],
      text: '[CONT](RC):This unit gets [Power] -1000.',
    }),
    ab.lord(),
  ],
  // Cruel Dragon
  'EB09-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 2 } })),
        ab.retire(ab.bound('r')),
      ],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Soul-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, choose one of your opponent's grade 2 or less rear-guards, and retire it.",
    }),
    ab.act({
      id: '2',
      zones: ['hand'],
      cost: [
        ab.revealCost(),
        ab.restChosenCost(ab.units('you', ['VC'], { clan: KG, grade: { min: 2 } })),
      ],
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'cruel',
            zones: ['hand'],
            oncePerTurn: true,
            trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
            triggerIf: ab.duringYourMainPhase(),
            effect: [
              ab.superiorRide(ab.self()),
              ab.choose('v', ab.units('you', ['VC'])),
              ab.power(ab.bound('v'), -3000),
            ],
            text: "During the main phase of that turn, if your opponent's rear-guard is put into the drop zone, ride this card as [Stand], choose your vanguard, and that unit gets [Power] -3000 until end of turn.",
          }),
        ),
      ],
      text: "[ACT]{Hand}:[Reveal this card, choose your grade 2 or greater <Kagero> vanguard, and [Rest] it] During the main phase of that turn, if your opponent's rear-guard is put into the drop zone, ride this card as [Stand], choose your vanguard, and that unit gets [Power] -3000 until end of turn.",
    }),
    ab.lord(),
  ],
  // Blast Bulk Dragon
  'EB09-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), ab.discard(1, { clan: KG })],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose a <Kagero> from your hand, and discard it] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +5000/[Critical] +1 until end of that battle.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), { cond: 'critical', of: ab.self(), range: { min: 2 } }),
      effects: [ab.gets(ab.self(), 'power', 5000)],
      text: "[CONT](VC):During your turn, if this unit's [Critical]  is two or more, this unit gets [Power] +5000.",
    }),
    ab.lord(),
  ],
  'EB09-004': { sameAs: 'BT01-004' }, // Dragonic Overlord
  'EB09-005': { sameAs: 'EB03-007' }, // Dragonic Lawkeeper
  // Nouvellecritic Dragon
  'EB09-006': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: kageroVanguard,
      cost: [ab.counterBlast(1), ab.revealCost(ab.cards('you', ['hand'], { name: NOUVELLE }))],
      optional: true,
      effect: [ab.choose('r', ab.units('opponent', ['RC'])), ab.retire(ab.bound('r'))],
      text: '[AUTO]:[Counter-Blast 1 & Choose a card named "Transcendence Dragon, Dragonic Nouvelle Vague" from your hand, and reveal it] When this unit is placed on (VC) or (RC), if you have a <Kagero> vanguard, you may pay the cost. If you do, choose one of your opponent\'s rear-guards, and retire it.',
    }),
  ],
  // Dragonic Gaias
  'EB09-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { clan: KG, trigger: 'none', sameColumnAsSource: true },
      }),
      cost: [ab.soulBlast(2), ab.restCost()],
      optional: true,
      effect: [ab.critical(ab.eventCard(), 1, 'end_of_battle')],
      text: '[AUTO](RC):[Soul-Blast 2 & Rest] this unit] When a <Kagero> normal unit in the same column as this unit attacks, you may pay the cost. If you do, that unit gets [Critical] +1 until end of that battle.',
    }),
  ],
  // Dragon Dancer, Maria
  'EB09-008': [
    perfectGuard(
      KG,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Kagero> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Kagero> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  'EB09-009': { sameAs: 'TD02-002' }, // Dragon Monk, Goku
  // Dragon Knight, Neshat
  'EB09-010': [
    hitDrawCB2(
      KG,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Kagero> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  'EB09-011': { sameAs: 'TD02-005' }, // Berserk Dragon
  'EB09-012': { sameAs: 'EB01-012' }, // Bellicosity Dragon
  // Dragon Knight, Ashgar
  'EB09-013': [
    boostPower(
      3000,
      ab.all(),
      '[AUTO](RC):When this unit boosts([Boost]) a card named "Transcendence Dragon, Dragonic Nouvelle Vague", the boosted([Boost]) unit gets [Power] +3000 until end of that battle.',
      { name: NOUVELLE },
    ),
  ],
  // Nouvelleroman Dragon
  'EB09-014': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: kageroVanguard,
      cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { name: NOUVELLE }), 'deck_top')],
      optional: true,
      effect: [
        ab.search('s', { clan: KG, grade: { min: 3 } }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Choose a card named "Transcendence Dragon, Dragonic Nouvelle Vague" from your hand, reveal it to your opponent, and put it on the top of your deck] When this unit is placed on (VC) or (RC), if you have a <Kagero> vanguard, you may pay the cost. If you do, search your deck for up to one grade 3 or greater <Kagero>, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  'EB09-015': { sameAs: 'BT04-036' }, // Lizard Soldier, Raopia
  'EB09-016': { sameAs: 'BT01-016' }, // Lizard Soldier, Conroe
  // Dragon Knight, Morteza
  'EB09-017': [
    ...discardPump(
      KG,
      '[AUTO](VC):[Choose a <Kagero> from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +6000 until end of that battle.\n[AUTO](RC):[Choose a <Kagero> from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Beikin Grim Dragon
  'EB09-018': [
    vanguardArrivesPump(
      KG,
      '[AUTO](RC):When your grade 3 <Kagero> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Genie Soldat
  'EB09-019': [
    ab.restraint(),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.duringYourMainPhase(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.lose(ab.self(), { ability: 'restraint' })],
      text: '[AUTO](VC/RC):[Counter-Blast 1] During your main phase, when an opponent\'s rear-guard is put into the drop zone, this unit loses "Restraint" until end of turn.',
    }),
    boostedByClan(
      KG,
      5000,
      '[AUTO](VC):When this unit is boosted([Boost]) by a <Kagero>, this unit gets [Power] +5000 until end of that battle.',
      ['VC'],
      '3',
    ),
  ],
  'EB09-020': { sameAs: 'EB01-034' }, // Prowling Dragon, Striken
  'EB09-021': { sameAs: 'BT01-022' }, // Dragon Knight, Nehalem
  // Demonic Dragon Mage, Kongara
  'EB09-022': [
    attackBonus(
      ab.count(ab.units('opponent', ['RC']), { max: 2 }),
      '[AUTO](VC/RC):When this unit attacks, if the number of rear-guards your opponent has is two or less, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'EB09-023': { sameAs: 'BT01-048' }, // Embodiment of Armor, Bahr
  'EB09-024': { sameAs: 'EB01-013' }, // Guard Griffin
  'EB09-025': { sameAs: 'TD02-009' }, // Flame of Hope, Aermo
  'EB09-026': { sameAs: 'TD02-010' }, // Demonic Dragon Madonna, Joka
  // Scale Dragon of the Magma Cave
  'EB09-027': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: kageroVanguard,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Soul-Blast 1] When this unit attacks, if you have a <Kagero> vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  'EB09-028': { sameAs: 'BT11-070' }, // Red Pulse Dracokid
  'EB09-029': { sameAs: 'BT03-076' }, // Blue Ray Dracokid
  'EB09-030': { sameAs: 'BT01-024' }, // Embodiment of Spear, Tahr
  'EB09-031': { sameAs: 'BT01-051' }, // Dragon Dancer, Monica
  'EB09-032': { sameAs: 'BT01-052' }, // Lizard Soldier, Ganlu
  'EB09-033': { sameAs: 'BT01-053' }, // Dragon Monk, Genjo
  'EB09-034': { sameAs: 'BT02-064' }, // Gattling Claw Dragon
  'EB09-035': { sameAs: 'BT04-072' }, // Flame Seed Salamander
};
