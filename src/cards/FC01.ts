/**
 * FC01 "Fighter's Collection 2013" (Japanese-only product, D-029; English text from later printings where one exists) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import { hitDrawCB2, vanguardPlus10000 } from './shapes';

const GP = 'Gold Paladin';
const GEN = 'Genesis';
const NK = 'Narukami';
const DI = 'Dark Irregulars';
const BT = 'Bermuda Triangle';
const NN = 'Neo Nectar';
const GN = 'Great Nature';
const AQF = 'Aqua Force';
/** "When this unit attacks a vanguard, this unit gets [Power] +n until end of that battle." */
const attackVanguardPump = (amount: number, text: string, id = '2') =>
  ab.auto({
    id,
    zones: ['VC'],
    trigger: ab.attacksVanguard(),
    effect: [ab.power(ab.self(), amount, 'end_of_battle')],
    text,
  });

export const FC01: SetAbilities = {
  // Mighty Spear Liberator, Bleoberis
  'FC01-001': [
    ab.breakRide({
      id: 'br',
      clan: GP,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.lookTop('l', 2),
        ab.choose('c', ab.bound('l', { clan: GP }), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
        vanguardPlus10000(),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When a <Gold Paladin> rides this unit, you may pay the cost. If you do, look at up to two cards from the top of your deck, search for up to two <Gold Paladin> from among them, call them to separate open (RC), put the rest on the bottom of your deck in any order, choose one of your vanguards, and that unit gets [Power] +10000 until end of turn.',
    }),
    attackVanguardPump(
      2000,
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
    ab.lord(),
  ],
  // Wisdom Keeper, Metis
  'FC01-002': [
    ab.breakRide({
      id: 'br',
      clan: GEN,
      cost: [ab.counterBlast(1)],
      effect: [ab.draw(1), ab.soulCharge(3), vanguardPlus10000()],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When a <Genesis> rides this unit, you may pay the cost. If you do, draw a card, [Soul-Charge 3], choose one of your vanguards, and that unit gets [Power] +10000 until end of turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.soulCharge(1), ab.power(ab.self(), 1000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks a vanguard, [Soul-Charge 1], this unit gets [Power] +1000 until end of that battle.',
    }),
    ab.lord(),
  ],
  // Eradicator, Electric Shaper Dragon
  'FC01-003': [
    ab.breakRide({
      id: 'br',
      clan: NK,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'shaper',
            zones: ['VC'],
            trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }, true),
            effect: [
              ab.choose('r', ab.units('opponent', ['back_RC'], { sameColumnAsEvent: true })),
              ab.retire(ab.bound('r')),
            ],
            text: "[AUTO](VC):When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards, choose one of your opponent's rear-guards in the back row of the same column as the (RC) that card was on, and retire it.",
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Narukami> rides this unit, choose one of your vanguards, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):When your opponent\'s rear-guard is put into the drop zone due to an effect from one of your cards, choose one of your opponent\'s rear-guards in the back row of the same column as the (RC) that card was on, and retire it.".',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: ab.count(ab.cards('opponent', ['damage']), { min: 3 }),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks, if your opponent has three or more cards in his or her damage zone, this unit gets [Power] +2000 until end of that battle.',
    }),
    ab.lord(),
  ],
  // Story Teller
  'FC01-004': [
    hitDrawCB2(
      DI,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Dark Irregulars> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Pretty Celeb, Charlotte
  'FC01-005': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: BT }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.toHand(ab.self()),
        ab.choose(
          'c',
          ab.cards('you', ['hand'], { clan: BT, notName: 'Pretty Celeb, Charlotte' }),
          1,
          { upTo: true },
        ),
        ab.superiorCall(ab.bound('c'), { open: true }),
      ],
      text: '[AUTO](RC):[Counter-Blast 1] When this unit\'s attack hits a vanguard, if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, return this unit to your hand, choose up to one <Bermuda Triangle> not named "Pretty Celeb, Charlotte" from your hand, and call it to an open (RC).',
    }),
  ],
  // Dandelion Musketeer, Mirkka
  'FC01-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: NN }),
      condition: ab.all(ab.vanguardIs({ clan: NN }), ab.deckShuffledThisTurn()),
      effect: [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a <Neo Nectar>, if you have a <Neo Nectar> vanguard, if your deck had been shuffled due to an effect from one of your cards during this turn, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Peerless Scribe, Ponga
  'FC01-007': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: { cond: 'power', of: ab.attackedUnit(), range: { min: 12000 } },
      effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks a vanguard, if the [Power] of the unit it is battling is 12000 or greater, this unit gets [Power] +10000 until end of that battle.',
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.vanguardIs({ clan: GN }),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit attacks a vanguard, if you have a <Great Nature> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  'FC01-008': { sameAs: 'BT01-021' }, // Knight of Silence, Gallatin
  'FC01-009': { sameAs: 'BT10-022' }, // Fellowship Jewel Knight, Tracie
  'FC01-010': { sameAs: 'BT01-042' }, // Little Sage, Marron
  'FC01-011': { sameAs: 'BT10-046' }, // Stinging Jewel Knight, Shellie
  'FC01-012': { sameAs: 'BT04-043' }, // Black Sage, Charon
  'FC01-013': { sameAs: 'TD08-004' }, // Liberator of Silence, Gallatin
  'FC01-014': { sameAs: 'BT06-082' }, // Knight of Elegant Skills, Gareth
  'FC01-015': { sameAs: 'TD08-010' }, // Little Liberator, Marron
  'FC01-016': { sameAs: 'TD13-004' }, // Battle Maiden, Izunahime
  'FC01-017': { sameAs: 'TD13-005' }, // Battle Maiden, Sahohime
  'FC01-018': { sameAs: 'TD13-008' }, // Battle Maiden, Mihikarihime
  'FC01-019': { sameAs: 'TD02-005' }, // Berserk Dragon
  'FC01-020': { sameAs: 'EB01-012' }, // Bellicosity Dragon
  'FC01-021': { sameAs: 'TD09-004' }, // Eradicator, Thunder Boom Dragon
  'FC01-022': { sameAs: 'BT06-091' }, // Red River Dragoon
  'FC01-023': { sameAs: 'TD09-010' }, // Eradicator, Demolition Dragon
  'FC01-024': { sameAs: 'EB02-016' }, // Velvet Voice, Raindear
  // Water General of Wave-like Spirals, Benedict
  'FC01-025': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { attacking: true }),
        ab.is(ab.attackedUnit(), { isVanguard: true }),
      ),
      condition: ab.vanguardIs({ clan: AQF }),
      effect: [ab.stand(ab.self()), ab.power(ab.self(), -5000)],
      text: '[AUTO](RC)：At the end of the battle that this unit attacked a vanguard, if you have an <Aqua Force> vanguard, [Stand] this unit, and this unit gets [Power] -5000 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
  ],
  'FC01-026': { sameAs: 'TD07-008' }, // Tear Knight, Theo
};
