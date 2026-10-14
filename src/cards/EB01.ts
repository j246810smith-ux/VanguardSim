/**
 * EB01 "Comic Style Vol.1" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import { attackBonus, clanPurity, guardShield, hitVanguardFlip, placedCharge } from './shapes';

const NG = 'Nova Grappler';
const MURAKUMO = 'Murakumo';
const PM = 'Pale Moon';
const OTT = 'Oracle Think Tank';
const KAGERO = 'Kagero';
const MEGACOLONY = 'Megacolony';
const RAIZER = 'Raizer';
const MACHINING = 'Machining';
/** "[CONT](VC/RC):During your turn, if you have a unit named "Battleraizer" in the back row of the same column as this unit, this unit gets [Power] +n." */
const raizerCustom = (amount: number, text: string) =>
  ab.cont({
    id: '1',
    zones: ['VC', 'RC'],
    condition: ab.all(
      ab.yourTurn(),
      ab.exists(ab.units('you', ['back_RC'], { name: 'Battleraizer', sameColumnAsSource: true })),
    ),
    effects: [ab.gets(ab.self(), 'power', amount)],
    text,
  });
/** "[AUTO]:When this unit rides a <clan>, this unit gets "[CONT](VC):If this unit would attack, it may instead attack an opponent's unit in the back row." until end of turn." */
const ridesBackRowAttack = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: { on: 'ridden', who: { owner: 'you', filter: { clan } }, bySelf: true },
    effect: [
      ab.grant(
        ab.self(),
        ab.cont({
          id: 'back_row',
          zones: ['VC'],
          effects: [ab.allow(ab.self(), 'attack_back_row')],
          text: "[CONT](VC):If this unit would attack, it may instead attack an opponent's unit in the back row.",
        }),
      ),
    ],
    text,
  });
/** The Arresters: "[CONT](RC) in the <own> column of the front row:If you have a <Murakumo> vanguard, and you have a unit named <partner> on (RC) in the <other> column of the front row, this unit gets [Power] +3000." */
const arrester = (own: 'front_left' | 'front_right', partner: string, text: string) =>
  ab.cont({
    id: '1',
    zones: ['RC'],
    condition: ab.all(
      ab.is(ab.self(), { onCircle: own }),
      ab.vanguardIs({ clan: MURAKUMO }),
      ab.exists(
        ab.units('you', ['RC'], {
          name: partner,
          onCircle: own === 'front_left' ? 'front_right' : 'front_left',
        }),
      ),
    ),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });
/** "[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Megacolony> with "Machining" in its card name in your soul, this unit gets [Power] +3000 until end of turn." */
const machiningPlaced = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.exists(ab.cards('you', ['soul'], { clan: MEGACOLONY, nameIncludes: MACHINING })),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });

export const EB01: SetAbilities = {
  // Perfect Raizer
  'EB01-001': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.not(
        ab.exists(ab.units('you', ['VC', 'RC'], { nameIncludes: RAIZER, excludeSelf: true })),
      ),
      effects: [ab.gets(ab.self(), 'power', -2000)],
      text: '[CONT](VC/RC):If you do not have another card with "Raizer" in its card name on your (VC) or (RC), this unit gets [Power] -2000.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [
        ab.gets(ab.self(), 'power', 3000, ab.cards('you', ['soul'], { nameIncludes: RAIZER })),
      ],
      text: '[CONT](VC):During your turn, this unit gets [Power] +3000 for each card in your soul with "Raizer" in its card name.',
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.soulCountAtLeast(4, { nameIncludes: RAIZER })),
      effects: [ab.gets(ab.self(), 'critical', 1)],
      text: '[CONT](VC):During your turn, if the number of cards in your soul with "Raizer" in its card name is four or more, this unit gets [Critical] +1.',
    }),
    ab.auto({
      id: '4',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.moveTo(ab.units('you', ['RC'], { nameIncludes: RAIZER }), 'soul')],
      text: '[AUTO]:When this unit is placed on (VC), put all rear-guards you have with "Raizer" in its card name into your soul.',
    }),
  ],
  // Dueling Dragon, ZANBAKU
  'EB01-002': [
    clanPurity(
      MURAKUMO,
      '[CONT](VC/RC):If you have a non-<Murakumo> vanguard or rear-guard, this unit gets [Power] -2000.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase', 'opponent'),
      condition: ab.exists(ab.units('opponent', ['VC'], { grade: { min: 3 } })),
      effect: [
        ab.asOpponent([
          ab.choose('d', ab.cards('you', ['hand']), 1, {
            upTo: true,
            prompt:
              'Discard a card from your hand? If you do not, you cannot normal ride this ride phase',
          }),
          ab.if_(
            ab.exists(ab.bound('d')),
            [ab.moveTo(ab.bound('d'), 'drop')],
            [ab.endNormalRide()],
          ),
        ]),
      ],
      text: "[AUTO](VC):At the beginning of your opponent's ride phase, if your opponent has a grade 3 or greater vanguard, your opponent may choose a card from his or her hand, and discard it. If your opponent does not, your opponent cannot normal ride during that ride phase.",
    }),
  ],
  // Hi-powered Raizer Custom
  'EB01-003': [
    raizerCustom(
      8000,
      '[CONT](VC/RC):During your turn, if you have a unit named "Battleraizer" in the back row of the same column as this unit, this unit gets [Power] +8000.',
    ),
  ],
  // Golden Beast Tamer
  'EB01-004': [
    ab.restraint(),
    ab.act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [],
      effect: [ab.lose(ab.self(), { ability: 'restraint' })],
      text: '[ACT](VC/RC): This unit loses "Restraint" until end of turn.',
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.units('you', ['front_RC'], { clan: PM }), 'power', 3000)],
      text: '[CONT](VC):During your turn, all of your <Pale Moon> rear-guards in your front row get [Power] +3000.',
    }),
    ab.auto({
      id: '4',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { clan: PM, race: 'Chimera' })),
        ab.superiorCall(ab.bound('c')),
      ],
      text: '[AUTO]:When this unit is placed on (VC), choose a <Pale Moon> <Chimera> from your soul, and call it to (RC).',
    }),
  ],
  // Machining Stag Beetle
  'EB01-005': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose(
          'c',
          ab.cards('you', ['soul'], { clan: MEGACOLONY, nameIncludes: MACHINING }),
          2,
          { upTo: true },
        ),
        ab.superiorCall(ab.bound('c'), { separate: true, rested: true }),
        {
          op: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byOriginalPowerOf: ab.bound('c'),
        },
      ],
      text: '[AUTO]:When this unit is placed on (VC), choose up to two <Megacolony> with "Machining" in its card name from your soul, call them to separate (RC) as [Rest], and increase this unit\'s [Power]  by the sum of the original [Power]  of the units called with this effect until end of turn.',
    }),
  ],
  // Imperial Daughter
  'EB01-006': [
    ab.cont({
      id: 'restraint',
      zones: ['any'],
      condition: ab.not(
        ab.all(
          ab.is(ab.self(), { isVanguard: true }),
          ab.yourTurn(),
          ab.not(ab.exists(ab.units('you', ['RC']))),
        ),
      ),
      effects: [ab.cannot(ab.self(), 'cannot_attack')],
      text: '[CONT](VC/RC):Restraint (This unit cannot attack.)',
    }),
    ab.act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(ab.units('you', ['RC'], { clan: OTT, excludeSelf: true }), 'soul'),
      ],
      effect: [ab.lose(ab.self(), { ability: 'restraint' })],
      text: '[ACT](VC/RC):[Counter-Blast 1 & Choose another of your <Oracle Think Tank> rear-guards, and put it into your soul] This unit loses "Restraint" until end of turn.',
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.not(ab.exists(ab.units('you', ['RC'])))),
      effects: [ab.gets(ab.self(), 'power', 10000), ab.gets(ab.self(), 'critical', 1)],
      text: '[CONT](VC):During your turn, if you do not have any rear-guards, this unit gets [Power] +10000/[Critical] +1 and loses "Restraint".',
    }),
  ],
  // Weather Forecaster, Miss Mist
  'EB01-007': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.is(ab.attackingUnit(), { isVanguard: true, grade: { max: 2 } }),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: OTT, beingAttacked: true })),
        ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: "[AUTO]:When this unit is placed on (GC), if it is during the battle in which your opponent's grade 2 or less vanguard attacked, choose one of your <Oracle Think Tank> that is being attacked, and that unit cannot be hit until end of that battle.",
    }),
  ],
  // Miss Splendor
  'EB01-008': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      effect: [ab.restrict(ab.units('opponent', ['RC']), 'cannot_intercept', 'end_of_battle')],
      text: "[AUTO](VC/RC):When this unit attacks, your opponent's units cannot intercept ([Intercept]) until end of that battle.",
    }),
  ],
  // Rocket Hammer Man
  'EB01-009': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: NG, excludeSelf: true })),
        ab.power(ab.bound('t'), 2000),
      ],
      text: '[ACT](RC):[Rest] this unit] Choose another of your <Nova Grappler>, and that unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Twin Swordsman, MUSASHI
  'EB01-010': [
    attackBonus(
      ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC'])),
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Promise Daughter
  'EB01-011': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      cost: [ab.discard(1, { clan: OTT })],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Choose an <Oracle Think Tank> from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // Bellicosity Dragon
  'EB01-012': [
    hitVanguardFlip(
      KAGERO,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have a <Kagero> vanguard, choose a card from your damage zone, and turn it face up.",
    ),
  ],
  // Guard Griffin
  'EB01-013': [
    guardShield(
      KAGERO,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC), if you have a <Kagero> vanguard, you may pay the cost. If you do, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Sage of Guidance, Zenon
  'EB01-014': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: 'Royal Paladin' }),
      effect: [
        ab.lookTop('top', 1),
        ab.reveal(ab.bound('top')),
        ab.if_(
          ab.exists(ab.bound('top', { clan: 'Royal Paladin', sameGradeAsVanguard: true })),
          [ab.superiorRide(ab.bound('top'))],
          [ab.moveTo(ab.bound('top'), 'drop')],
        ),
      ],
      text: '[AUTO]:When this unit is placed on (RC), if you have a <Royal Paladin> vanguard, reveal the top card of your deck. If the revealed card is a <Royal Paladin> with the same grade as your vanguard, ride it, and if it is not, put that card into your drop zone.',
    }),
  ],
  // Savage King
  'EB01-015': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [
        ab.soulBlast(1),
        ab.retireCost(ab.units('you', ['RC'], { clan: 'Tachikaze', excludeSelf: true })),
      ],
      effect: [ab.power(ab.self(), 3000)],
      text: '[ACT](VC/RC):[Soul-Blast 1 & Choose another of your <Tachikaze> rear-guards, and retire it] This unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Boomerang Thrower
  'EB01-016': [
    ridesBackRowAttack(
      NG,
      '[AUTO]:When this unit rides a <Nova Grappler>, this unit gets "[CONT](VC):If this unit would attack, it may instead attack an opponent\'s unit in the back row." until end of turn.',
    ),
  ],
  // Raizer Custom
  'EB01-017': [
    raizerCustom(
      6000,
      '[CONT](VC/RC):During your turn, if you have a unit named "Battleraizer" in the back row of the same column as this unit, this unit gets [Power] +6000.',
    ),
  ],
  'EB01-018': [], // Wall Boy
  // Cat Butler
  'EB01-019': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.attackingUnit(), { isVanguard: true }),
      condition: ab.battleHit(false),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { clan: NG, grade: { max: 2 } })),
        ab.stand(ab.bound('v')),
      ],
      text: '[AUTO](RC):［Retire this unit］ At the beginning of the close step of the battle that your vanguard attacked, if the attack did not hit during that battle, you may pay the cost. If you do, choose one of your grade 2 or less <Nova Grappler> vanguards, and [Stand] it.',
    }),
  ],
  'EB01-020': { sameAs: 'BT01-032' }, // Battleraizer
  // Jumping Jill
  'EB01-021': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'soul'),
      condition: ab.vanguardIs({ clan: PM }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO]:When this unit is placed on (RC) from your soul, if you have a <Pale Moon> vanguard, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Nitro Juggler
  'EB01-022': [
    placedCharge(
      PM,
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Pale Moon> vanguard, you may [Soul-Charge 1].',
    ),
  ],
  // Starting Presenter
  'EB01-023': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden({ clan: PM }),
      effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])],
      text: '[AUTO]:When another <Pale Moon> rides this unit, you may [Soul-Charge 2].',
    }),
  ],
  'EB01-024': [], // Hoop Magician
  // Lark Pigeon
  'EB01-025': [
    ab.auto({
      id: '1',
      zones: ['soul'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      condition: ab.all(
        ab.vanguardIs({ clan: PM }),
        ab.count(ab.cards('you', ['hand']), { max: 0 }),
      ),
      effect: [ab.may('Call this card to (GC) as [Rest]?', [ab.callGuardians(ab.self())])],
      text: '[AUTO]Soul:At the beginning of your guard step, if you have a <Pale Moon> vanguard, and you do not have any cards in your hand, you may call this card to (GC) as [Rest].',
    }),
  ],
  // Swift Archer, FUSHIMI
  'EB01-026': [
    ridesBackRowAttack(
      MURAKUMO,
      '[AUTO]:When this unit rides a <Murakumo>, this unit gets "[CONT](VC):If this unit would attack, it may instead attack an opponent\'s unit in the back row." until end of turn.',
    ),
  ],
  // Left Arrester
  'EB01-027': [
    arrester(
      'front_left',
      'Right Arrester',
      '[CONT](RC) in the left column of the front row:If you have a <Murakumo> vanguard, and you have a unit named "Right Arrester" on (RC) in the right column of the front row, this unit gets [Power] +3000.',
    ),
  ],
  // Right Arrester
  'EB01-028': [
    arrester(
      'front_right',
      'Left Arrester',
      '[CONT](RC) in the right column of the front row:If you have a <Murakumo> vanguard, and you have a unit named "Left Arrester" on (RC) in the left column of the front row, this unit gets [Power] +3000.',
    ),
  ],
  // Machining Mantis
  'EB01-029': [
    machiningPlaced(
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Megacolony> with "Machining" in its card name in your soul, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Machining Hornet
  'EB01-030': [
    machiningPlaced(
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Megacolony> with "Machining" in its card name in your soul, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Machining Worker Ant
  'EB01-031': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.choose('s', ab.units('you', ['RC'], { nameIncludes: MACHINING })),
        ab.stand(ab.bound('s')),
      ],
      text: '[AUTO]:When this unit is placed on (RC), choose one of your rear-guards with "Machining" in its card name, and [Stand] it.',
    }),
  ],
  'EB01-032': [], // Shelter Beetle
  'EB01-033': { sameAs: 'BT01-027' }, // Lozenge Magus
  // Prowling Dragon, Striken
  'EB01-034': [
    ab.cont({
      id: 'restraint',
      zones: ['VC'],
      effects: [ab.cannot(ab.self(), 'cannot_attack')],
      text: '[CONT](VC):Restraint (This unit cannot attack.)',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.isAttacked(),
      condition: ab.not(ab.exists(ab.boostingUnit())),
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit is attacked, if there are no boosting ([Boost]) units, this unit gets [Power] +5000 until end of that battle.',
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.ridden({ clan: KAGERO }),
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 5000),
        ab.critical(ab.bound('v'), 1),
      ],
      text: '[AUTO]:When another <Kagero> rides this unit, choose one of your vanguards, and that unit gets [Power] +5000/[Critical] +1 until end of turn.',
    }),
  ],
  // Spike Bouncer
  'EB01-035': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard', {
        owner: 'you',
        filter: { clan: 'Spike Brothers', excludeSelf: true },
      }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](VC/RC):When an attack by another of your <Spike Brothers> hits a vanguard, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
};
