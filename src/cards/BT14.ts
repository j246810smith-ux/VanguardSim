/**
 * BT14 "Brilliant Strike" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackCBPump4000,
  attackPower,
  boostPower,
  boostedByClan,
  callTillEndOfTurn,
  damageThenReturn,
  driveCheckClan2000,
  hitDrawCB2,
  hitVanguardFlip,
  hitVanguardPump,
  lbAttackVanguard,
  nameBoost6000,
  nameVanguardAttack,
  perfectGuard,
  placedPump2000,
  placedSoulBlastDraw,
  rcAttackVanguardClan2000,
  sentinelCall,
  soulDiscardDraw,
  soulNamedBonus,
  topCallOpen,
  vanguardArrivesPump,
  vanguardPlus10000,
} from './shapes';

const RP = 'Royal Paladin';
const GP = 'Gold Paladin';
const GEN = 'Genesis';
const KAG = 'Kagero';
const NAR = 'Narukami';
const MUR = 'Murakumo';
const NN = 'Neo Nectar';
const HYAKKI = 'Covert Demonic Dragon, Hyakki Vogue "Яeverse"';
const LANCER = 'Sanctuary of Light, Planet Lancer';
const STORM = 'Sanctuary of Light, Little Storm';
const DETERMINATOR = 'Sanctuary of Light, Determinator';
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));
const grade3 = { grade: { min: 3, max: 3 } };
/** "your opponent chooses n of his or her rear-guards, and retires them" */
const oppRetires = (n = 1): Step =>
  ab.asOpponent([
    ab.choose('r', ab.units('you', ['RC']), n, {
      prompt:
        n === 1
          ? 'Choose one of your rear-guards to retire'
          : `Choose ${n} of your rear-guards to retire`,
    }),
    ab.retire(ab.bound('r')),
  ]);
/** "at the end of that turn, return that unit to your hand" */
const returnToHandAtEnd = (as: string): Step =>
  ab.atNextOn(
    ab.bound(as),
    'end_phase',
    [ab.toHand(ab.self())],
    'end_of_turn',
    'At the end of that turn, return this unit to your hand.',
  );
/** "[ACT](RC):[Choose a grade 3 card with X in its card name from your drop zone, and put it on the bottom of your deck] If you have a <clan> vanguard, choose one of your grade 3 units with X in its card name, and that unit gets [Power] +5000 until end of turn." */
const dropBottomPump = (clan: string, part: string, text: string) =>
  ab.act({
    id: '1',
    zones: ['RC'],
    cost: [
      ab.moveChosenCost(
        ab.cards('you', ['drop'], { ...grade3, nameIncludes: part }),
        'deck_bottom',
      ),
    ],
    effect: [
      ab.if_(ab.vanguardIs({ clan }), [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { ...grade3, nameIncludes: part })),
        ab.power(ab.bound('t'), 5000),
      ]),
    ],
    text,
  });
/** "[CONT](VC/RC):During your turn, if the number of <clan> rear-guards you have is four or more, this unit gets [Power] +3000." */
const fourRearGuards3000 = (clan: string, text: string) =>
  ab.cont({
    id: '1',
    zones: ['VC', 'RC'],
    condition: ab.all(ab.yourTurn(), ab.count(ab.units('you', ['RC'], { clan }), { min: 4 })),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });
/** "[ACT](RC):[Soul-Blast 1] If you have a <Murakumo> vanguard, choose one of your open (RC), and move this unit to that circle." */
const sidestep = (text: string, id = '1') =>
  ab.act({
    id,
    zones: ['RC'],
    cost: [ab.soulBlast(1)],
    effect: [ab.if_(ab.vanguardIs({ clan: MUR }), [ab.moveToOpenRC()])],
    text,
  });
/** "When this card is put into the drop zone from your soul, if you have a <Genesis> vanguard, you may [Soul-Charge 2]." */
const soulDropCharge = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('soul'),
    condition: ab.vanguardIs({ clan: GEN }),
    effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])],
    text,
  });
/** "[AUTO](RC):When your card named X is put into the drop zone from your soul, if you have a <Genesis> vanguard, this unit gets [Power] +3000 until end of turn." */
const namedSoulDropPump = (name: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.putIntoDropFrom('soul', { owner: 'you', filter: { name } }),
    condition: ab.vanguardIs({ clan: GEN }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });

export const BT14: SetAbilities = {
  // Broken Heart Jewel Knight, Ashlei "Яeverse"
  'BT14-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        ab.lockCost(ab.units('you', ['RC'], { nameIncludes: 'Jewel Knight' })),
      ],
      effect: [
        ab.choose('r', ab.units('opponent', ['front_RC']), 1, { upTo: true }),
        ab.retire(ab.bound('r')),
        ab.search('s', { nameIncludes: 'Jewel Knight' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose one of your rear-guards with "Jewel Knight" in its card name, and lock it] Choose up to one rear-guard in your opponent\'s front row, retire it, search your deck for up to one card with "Jewel Knight" in its card name, call it to (RC), and shuffle your deck. This ability cannot be used for the rest of that turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
    soulNamedBonus(
      'Pure Heart Jewel Knight, Ashlei',
      2000,
      '[CONT](VC):If you have a card named "Pure Heart Jewel Knight, Ashlei" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Liberator of Bonds, Gancelot Zenith
  'BT14-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [
        ab.counterBlast(1, { nameIncludes: 'Liberator' }),
        ab.moveChosenCost(ab.units('you', ['RC'], { grade: { max: 2 } }), 'deck_bottom'),
      ],
      optional: true,
      effect: [...topCallOpen(GP), ab.power(ab.bound('c'), 10000)],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1]-card with "Liberator" in its card name & Choose one of your grade 2 or less rear-guards, and put it on the bottom of your deck] When this unit attacks a vanguard, you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), put the rest on the bottom of your deck, and that unit gets [Power] +10000 until end of turn.',
    }),
    soulNamedBonus(
      'Solitary Liberator, Gancelot',
      2000,
      '[CONT](VC):If you have a card named "Solitary Liberator, Gancelot" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Salvation Lion, Grand Ezel Scissors
  'BT14-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2), ab.soulBlast(2)],
      effect: [
        ab.unlock(ab.cards('you', ['locked'])),
        ab.if_(ab.count(ab.units('you', ['RC'], { clan: GP }), { min: 5, max: 5 }), [
          ab.power(ab.self(), 10000),
          ab.critical(ab.self(), 1),
          ab.atNextOn(
            ab.self(),
            'end_phase',
            [
              ab.soulCharge(1),
              ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })),
              { op: 'turn_face', target: ab.bound('d'), faceUp: true },
            ],
            'end_of_turn',
            'At the end of that turn, [Soul-Charge 1], choose a card from your damage zone, and turn it face up.',
          ),
        ]),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Soul-Blast 2] Unlock all of your locked cards, if the number of <Gold Paladin> rear-guards you have is five, until end of turn, this unit gets [Power] +10000/[Critical] +1, and at the end of that turn, [Soul-Charge 1], choose a card from your damage zone, and turn it face up.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.self(), 'power', 1000, ab.units('you', ['RC'], { clan: GP }))],
      text: '[CONT](VC):During your turn, this unit gets [Power] +1000 for each of your <Gold Paladin> rear-guards.',
    }),
    ab.lord(),
  ],
  // Sunlight Goddess, Yatagarasu
  'BT14-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(9)],
      optional: true,
      effect: [
        ab.draw(2),
        ab.choose('t', ab.units('you', ['RC'], { clan: GEN }), 2, { upTo: true }),
        ab.stand(ab.bound('t')),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Soul-Blast 9] When this unit attacks a vanguard, you may pay the cost. If you do, draw two cards, choose up to two of your <Genesis> rear-guards, and [Stand] them.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('GC', { owner: 'you', filter: { clan: GEN } }),
      triggerIf: ab.is(ab.self(), { beingAttacked: true }),
      oncePerBattle: true,
      effect: [ab.moveTo(ab.eventCard(), 'soul')],
      text: '[AUTO](VC):During the battle that this unit was attacked, when your <Genesis> guardian is put into the drop zone, put that card into your soul. This ability cannot be used for the rest of that battle. (If two or more cards are put into the drop zone at the same time, put one card into the soul)',
    }),
    ab.lord(),
  ],
  // Omniscience Regalia, Minerva
  'BT14-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      cost: [ab.counterBlast(1), ab.soulBlast(3), ab.discard(3, { clan: GEN })],
      optional: true,
      effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Soul-Blast 3 & Choose three <Genesis> from your hand, and discard them] At the end of the battle that this unit attacked, you may pay the cost. If you do, [Stand] this unit, and this unit gets [Power] +5000 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
    soulNamedBonus(
      'Regalia of Wisdom, Angelica',
      2000,
      '[CONT](VC):If you have a card named "Regalia of Wisdom, Angelica" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Dauntless Dominate Dragon "Яeverse"
  'BT14-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { clan: KAG }))],
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'dauntless',
            zones: ['VC'],
            trigger: ab.driveCheckReveals({ clan: KAG, grade: { min: 1 } }),
            effect: [
              ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 1 } }), 1, {
                upTo: true,
              }),
              ab.retire(ab.bound('r')),
              ab.power(ab.self(), 3000),
            ],
            text: "[AUTO](VC):When this unit's drive check reveals a grade 1 or greater <Kagero>, choose up to one of your opponent's grade 1 or less rear-guards, retire it, and this unit gets [Power] +3000 until end of turn.",
          }),
        ),
      ],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose one of your <Kagero> rear-guards, and lock it] Until end of turn, this unit gets \"[AUTO](VC):When this unit's drive check reveals a grade 1 or greater <Kagero>, choose up to one of your opponent's grade 1 or less rear-guards, retire it, and this unit gets [Power] +3000 until end of turn.\". This ability cannot be used for the rest of that turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
    soulNamedBonus(
      'Dauntless Drive Dragon',
      2000,
      '[CONT](VC):If you have a card named "Dauntless Drive Dragon" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Eradicator, Ignition Dragon
  'BT14-007': [
    ab.breakRide({
      id: 'br',
      clan: NAR,
      cost: [ab.counterBlast(1)],
      effect: [oppRetires(2), vanguardPlus10000()],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When a <Narukami> rides this unit, you may pay the cost. If you do, your opponent chooses two of his or her rear-guards, retire them, choose your vanguard, and that unit gets [Power] +10000 until end of turn.',
    }),
    attackPower({
      id: '2',
      amount: 2000,
      zones: ['VC'],
      condition: moreRearGuards,
      text: "[AUTO](VC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +2000 until end of that battle.",
    }),
    ab.lord(),
  ],
  // Eradicator, Tempest Bolt Dragon
  'BT14-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3, { nameIncludes: 'Eradicator' })],
      effect: [ab.retire(ab.units('you', ['RC'])), ab.retire(ab.units('opponent', ['RC']))],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 3]-card with "Eradicator" in its card name] Retire all rear-guards of all fighters.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.yourTurn(),
      // +2000 for each open (RC) of both fighters = 10 circles, minus each occupied one
      effects: [
        ab.gets(ab.self(), 'power', 20000),
        ab.gets(ab.self(), 'power', -2000, ab.units('you', ['RC'])),
        ab.gets(ab.self(), 'power', -2000, ab.units('opponent', ['RC'])),
        ab.gets(ab.self(), 'power', -2000, ab.cards('you', ['locked'])),
        ab.gets(ab.self(), 'power', -2000, ab.cards('opponent', ['locked'])),
      ],
      text: "[CONT](VC):During your turn, this unit gets [Power] +2000 for each of all fighter's open (RC).",
    }),
    ab.lord(),
  ],
  // Sanctuary of Light, Planetal Dragon
  'BT14-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.power(ab.units('you', ['VC', 'RC'], { nameIncludes: 'Sanctuary of Light' }), 3000),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, all of your units with "Sanctuary of Light" in its card name gets [Power] +3000 until end of turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: 'Sanctuary of Light' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one card with "Sanctuary of Light" in its card name, call it to (RC), and shuffle your deck.',
    }),
    soulNamedBonus(
      DETERMINATOR,
      1000,
      '[CONT](VC):If you have a card named "Sanctuary of Light, Determinator" in your soul, this unit gets [Power] +1000.',
    ),
  ],
  // Banding Jewel Knight, Miranda
  'BT14-010': [
    attackPower({
      amount: 2000,
      zones: ['RC'],
      condition: ab.vanguardIs({ nameIncludes: 'Ashlei' }),
      text: '[AUTO](RC):When this unit attacks, if you have a vanguard with "Ashlei" in its card name, this unit gets [Power] +2000 until end of that battle.',
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ nameIncludes: 'Ashlei' }),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: RP })),
        ab.power(ab.bound('t'), 3000),
      ],
      text: '[AUTO](RC):When this unit\'s attack hits a vanguard, if you have a vanguard with "Ashlei" in its card name, choose one of your <Royal Paladin>, and that unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Summoning Jewel Knight, Gloria
  'BT14-011': [
    sentinelCall(
      RP,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, if you have a <Royal Paladin> vanguard, you may pay the cost. If you do, reveal five cards from the top of your deck. Call all <Royal Paladin> to (GC) at [Rest] from among them, and put the rest into your drop zone.',
    ),
  ],
  // Sword Formation Liberator, Igraine
  'BT14-012': [
    sentinelCall(
      GP,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, reveal five cards from the top of your deck. Call all <Gold Paladin> to (GC) at [Rest] from among them, and put the rest into your drop zone.',
    ),
  ],
  // Shield Goddess, Aegis
  'BT14-013': [
    sentinelCall(
      GEN,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, if you have a <Genesis> vanguard, you may pay the cost. If you do, reveal five cards from the top of your deck. Call all <Genesis> to (GC) at [Rest] from among them, and put the rest into your drop zone.',
    ),
  ],
  // Covert Demonic Dragon, Kagura Bloome
  'BT14-014': [
    ab.breakRide({
      id: 'br',
      clan: MUR,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 10000),
        ab.search('s', { sameNameAsBound: 'v' }, 2),
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
        returnToHandAtEnd('s'),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When a <Murakumo> rides this unit, you may pay the cost. If you do, choose your vanguard, and until end of turn, that unit gets [Power] +10000, search your deck for up to two cards with the same name as that card, call them to separate (RC), shuffle your deck, and at the end of that turn, return the units called with this effect to your hand.',
    }),
    boostedByClan(
      MUR,
      2000,
      '[AUTO](VC):When this unit is boosted ([Boost]) by a <Murakumo>, this unit gets [Power] +2000 until end of that battle.',
      ['VC'],
      '2',
    ),
    ab.lord(),
  ],
  // Covert Demonic Dragon, Hyakki Vogue "Яeverse"
  'BT14-015': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.lockCost(ab.units('you', ['RC'], { clan: MUR }), 2)],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { name: HYAKKI }), 3, { upTo: true }),
        ab.power(ab.bound('t'), 10000),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Choose two of your <Murakumo> rear-guards, and lock them] Choose up to three of your "Covert Demonic Dragon, Hyakki Vogue "Яeverse"", and those units get [Power] +10000 until end of turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('s', { name: HYAKKI }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
        returnToHandAtEnd('s'),
      ],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one card named "Covert Demonic Dragon, Hyakki Vogue "Яeverse"", call it to (RC), shuffle your deck, and at the end of that turn, return that unit to your hand.',
    }),
    ab.lord(),
  ],
  // Silver Snow, Sasame
  'BT14-016': [
    sentinelCall(
      MUR,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, if you have a <Murakumo> vanguard, you may pay the cost. If you do, reveal five cards from the top of your deck. Call all <Murakumo> to (GC) at [Rest] from among them, and put the rest into your drop zone.',
    ),
  ],
  // Eradicator, Lorentz Force Dragon
  'BT14-017': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('VC', {
        owner: 'you',
        filter: { ...grade3, nameIncludes: 'Eradicator' },
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [oppRetires()],
      text: '[AUTO](RC):[Counter-Blast 1] When your grade 3 unit with "Eradicator" in its card name is placed on (VC), you may pay the cost. If you do, your opponent chooses one of his or her rear-guards, and retires it.',
    }),
  ],
  // Maiden of Venus Trap "Яeverse"
  'BT14-018': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { clan: NN }))],
      effect: [
        ab.lookTop('l', 5),
        ab.choose('c', ab.bound('l', { clan: NN }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
        ab.power(ab.bound('c'), 5000),
      ],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose one of your <Neo Nectar> rear-guards, and lock it] Look at up to five cards from the top of your deck, search for up to one <Neo Nectar> from among them, call it to (RC), shuffle your deck, and that unit gets [Power] +5000 until end of turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: [ab.power(ab.self(), 2000)],
      text: '[ACT](VC):[Counter-Blast 1] This unit gets [Power] +2000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Deep Green Lord, Master Wisteria
  'BT14-019': [
    ab.breakRide({
      id: 'br',
      clan: NN,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('a', ab.units('you', ['RC'], { clan: NN }), 2, { upTo: true }),
        ab.search('s', { sameNameAsBound: 'a' }, 2),
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
        vanguardPlus10000(),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When a <Neo Nectar> rides this unit, you may pay the cost. If you do, choose up to two of your <Neo Nectar> rear-guards, search your deck for up to one card with the same name as each of those cards, call them to separate (RC), shuffle your deck, choose your vanguard, and that unit gets [Power] +10000 until end of turn.',
    }),
    boostedByClan(
      NN,
      2000,
      '[AUTO](VC):When this unit is boosted ([Boost]) by a <Neo Nectar>, this unit gets [Power] +2000 until end of that battle.',
      ['VC'],
      '2',
    ),
    ab.lord(),
  ],
  // Red Rose Musketeer, Antonio
  'BT14-020': [
    perfectGuard(
      NN,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Neo Nectar> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Neo Nectar> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Sanctuary of Light, Determinator
  'BT14-021': [
    soulNamedBonus(
      STORM,
      1000,
      '[CONT](VC):If you have a card named "Sanctuary of Light, Little Storm" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: { on: 'ridden', who: { owner: 'you', filter: { name: STORM } }, bySelf: true },
      condition: ab.inSoul(LANCER),
      effect: [
        ab.search('s', { nameIncludes: 'Sanctuary of Light' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO]:When this unit rides a card named "Sanctuary of Light, Little Storm", if you have a card named "Sanctuary of Light, Planet Lancer" in your soul, search your deck for up to one card with "Sanctuary of Light" in its card name, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Linking Jewel Knight, Tilda
  'BT14-022': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('VC', {
        owner: 'you',
        filter: { ...grade3, nameIncludes: 'Jewel Knight' },
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { clan: RP, grade: { max: 1 } }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):[Counter-Blast 1] When your grade 3 unit with "Jewel Knight" in its card name is placed on (VC), you may pay the cost. If you do, search your deck for up to one grade 1 or less <Royal Paladin>, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Sanctuary of Light, Planet Lancer
  'BT14-023': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden({ name: STORM }),
      effect: [
        ab.lookTop('l', 7),
        ab.choose(
          'f',
          ab.bound('l', { nameIn: ['Sanctuary of Light, Planetal Dragon', DETERMINATOR] }),
          1,
          { upTo: true },
        ),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.shuffle(),
      ],
      text: '[AUTO]:When a card named "Sanctuary of Light, Little Storm" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Sanctuary of Light, Planetal Dragon" or "Sanctuary of Light, Determinator" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: RP, notName: STORM }),
      effect: [ab.may('Call this unit to a rear-guard circle?', [ab.superiorCall(ab.self())])],
      text: '[AUTO]:When a <Royal Paladin> not named "Sanctuary of Light, Little Storm" rides this unit, you may call this card to (RC).',
    }),
  ],
  // Treasure Liberator, Calogrenant
  'BT14-024': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ clan: GP, ...grade3 }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: topCallOpen(GP),
      text: "[AUTO](VC):[Counter-Blast 1] When this unit's drive check reveals a grade 3 <Gold Paladin>, you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck.",
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Blue Skies Liberator, Hengist
  'BT14-025': [
    hitDrawCB2(
      GP,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Burning Scale Knight, Eliwood
  'BT14-026': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: { ...grade3, nameIncludes: 'Ezel' } }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: topCallOpen(GP),
      text: '[AUTO](RC):[Counter-Blast 1] When your grade 3 unit with "Ezel" in its card name is placed on (VC), you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck.',
    }),
  ],
  'BT14-027': { sameAs: 'TD13-002' }, // Battle Maiden, Mizuha
  'BT14-028': { sameAs: 'TD13-006' }, // Goddess of Trees, Jupiter
  // Battle Maiden, Amenohoakari
  'BT14-029': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boosts({ clan: GEN, ...grade3 }),
      effect: [ab.may('Soul-Charge 1?', [ab.soulCharge(1)])],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a grade 3 <Genesis>, you may [Soul-Charge 1].',
    }),
  ],
  // Vorpal Cannon Dragon
  'BT14-030': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 2 } })),
        ab.retire(ab.bound('r')),
      ],
      text: "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, choose one of your opponent's grade 2 or less rear-guards, and retire it.",
    }),
  ],
  // Flame Dance, Agni
  'BT14-031': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: { cond: 'power', of: ab.attackedUnit(), range: { min: 12000 } },
      effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
      text: "[AUTO](VC):When this unit attacks a vanguard, if this unit's battle opponent's [Power]  is 12000 or greater, this unit gets [Power] +10000 until end of that battle.",
    }),
    rcAttackVanguardClan2000(
      KAG,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Kagero> vanguard, this unit gets [Power] +2000 until end of that battle.',
      '2',
    ),
  ],
  // Dominate Drive Dragon
  'BT14-032': [
    nameVanguardAttack(
      'Dauntless',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Dauntless" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Dragon Knight, Akram
  'BT14-033': [
    nameBoost6000(
      'Dauntless',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit with "Dauntless" in its card name, you may pay the cost. If you do, the boosted unit gets [Power] +6000 until end of that battle.',
    ),
  ],
  // Dragon Knight, Sadegh
  'BT14-034': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }, true),
      condition: ab.vanguardIs({ clan: KAG }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [oppRetires()],
      text: "[AUTO](RC):[Put this unit into your soul] When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards, if you have a <Kagero> vanguard, you may pay the cost. If you do, your opponent chooses one of his or her rear-guards, and retires it.",
    }),
  ],
  // Truth Seeking Stealth Rogue, Amakusa
  'BT14-035': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      MUR,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Murakumo> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Demonic Hair Stealth Rogue, Grenjin
  'BT14-036': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.all(
        ab.vanguardIs({ clan: MUR }),
        ab.exists(ab.boostingUnit()),
        ab.is(ab.boostingUnit(), { clan: MUR }),
      ),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: callTillEndOfTurn({ name: 'Demonic Hair Stealth Rogue, Grenjin' }),
      text: '[AUTO](VC/RC):[Counter-Blast 1] When this unit\'s attack hits a vanguard, if this unit is boosted ([Boost]) by a <Murakumo>, and you have a <Murakumo> vanguard, you may pay the cost. If you do, search you deck for up to one card named "Demonic Hair Stealth Rogue, Grenjin", call it to (RC), shuffle your deck, and at the end of that turn, put the unit called by this effect on the bottom of your deck.',
    }),
  ],
  // Bangasa Stealth Rogue, Sukerock
  'BT14-037': [
    sidestep(
      '[ACT](RC):[Soul-Blast 1] If you have a <Murakumo> vanguard, choose one of your open (RC), and move this unit to that circle. (The state of the card does not change)',
    ),
  ],
  // Deadly Eradicator, Ouei
  'BT14-038': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: { clan: NAR, ...grade3 } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.choose('r', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('r'))],
      text: "[AUTO](RC):[Put this unit into your soul] When your grade 3 <Narukami> is placed on (VC), you may pay the cost. If you do, choose one of your opponent's rear-guards in the front row, and retire it.",
    }),
  ],
  // Spirit Beads Eradicator, Nata
  'BT14-039': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Eradicator' })),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'nata',
            zones: ['VC'],
            trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }, true),
            effect: [ab.power(ab.self(), 3000)],
            text: "[AUTO](VC):When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards, this unit gets [Power] +3000 until end of turn.",
          }),
        ),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose you vanguard with "Eradicator" in its card name, and until end of turn, this unit gets "[AUTO](VC):When your opponent\'s rear-guard is put into the drop zone due to an effect from one of your cards, this unit gets [Power] +3000 until end of turn.".',
    }),
  ],
  // White Rose Musketeer, Alberto
  'BT14-040': [
    hitVanguardFlip(
      NN,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have a <Neo Nectar> vanguard, choose a card from your damage zone, and turn it face up.",
    ),
  ],
  // Maiden of Cherry Bloom
  'BT14-041': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: NN }),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { name: 'Maiden of Cherry Stone' }),
        ab.superiorCall(ab.bound('s'), { rested: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](VC/RC):[Counter-Blast 1 & Soul-Blast 1] When this unit\'s attack hits a vanguard, if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Maiden of Cherry Stone", call it to (RC) at [Rest], and shuffle your deck.',
    }),
  ],
  // Maiden of Cherry Stone
  'BT14-042': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: ab.vanguardIs({ clan: NN }),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [
        ab.search('s', { name: 'Maiden of Cherry Bloom' }),
        ab.superiorCall(ab.bound('s'), { rested: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):[Put this unit on the top of your deck] When an attack hits a vanguard during the battle that this unit boosted ([Boost]), if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Maiden of Cherry Bloom", call it to (RC) at [Rest], and shuffle your deck.',
    }),
  ],
  // Knight of Frevor, Hector
  'BT14-043': [
    driveCheckClan2000(
      RP,
      "[AUTO](VC):When this unit's drive check reveals a <Royal Paladin>, this unit gets [Power] +2000 until end of that battle.",
    ),
  ],
  // Mystical Hermit
  'BT14-044': [
    hitVanguardPump(
      RP,
      "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your <Royal Paladin>, and that unit gets [Power] +3000 until end of turn.",
      ['RC'],
    ),
  ],
  // Jewel Knight, Tranmy
  'BT14-045': [
    damageThenReturn(
      RP,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Royal Paladin> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Sanctuary of Light, Little Storm
  'BT14-046': [
    soulNamedBonus(
      LANCER,
      1000,
      '[CONT](VC):If you have a card named "Sanctuary of Light, Planet Lancer" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: RP, grade: { min: 2, max: 2 }, notName: DETERMINATOR }),
      condition: ab.inSoul(LANCER),
      effect: [
        ab.lookTop('l', 7),
        ab.choose('f', ab.bound('l', { name: DETERMINATOR }), 1, { upTo: true }),
        ab.superiorRide(ab.bound('f')),
        ab.shuffle(),
      ],
      text: '[AUTO]:When a grade 2 <Royal Paladin> not named "Sanctuary of Light, Determinator" rides this unit, if you have a card named "Sanctuary of Light, Planet Lancer" in your soul, look at up to seven cards from the top of your deck, search for up to one card named "Sanctuary of Light, Determinator" from among them, ride it, and shuffle your deck.',
    }),
  ],
  // Jewel Knight, Melmy
  'BT14-047': [
    damageThenReturn(
      RP,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Royal Paladin> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Security Jewel Knight, Alwain
  'BT14-048': [
    dropBottomPump(
      RP,
      'Ashlei',
      '[ACT](RC):[Choose a grade 3 card with "Ashlei" in its card name from your drop zone, and put it on the bottom of your deck] If you have a <Royal Paladin> vanguard, choose one of your grade 3 units with "Ashlei" in its card name, and that unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Desire Jewel Knight, Heloise
  'BT14-049': [
    ab.forerunner(),
    boostPower(
      3000,
      ab.count(ab.units('you', ['RC'], { nameIncludes: 'Jewel Knight', excludeSelf: true }), {
        min: 3,
      }),
      '[AUTO](RC):When this unit boosts ([Boost]), if the number of your other "Jewel Knight" rear-guards is three or more, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
      {},
      '2',
    ),
  ],
  'BT14-050': [], // Jewel Knight, Noble Stinger
  'BT14-051': [], // Jewel Knight, Sacred Unicorn
  'BT14-052': [], // Jewel Knight, Opt Harpist
  'BT14-053': [], // Jewel Knight, Hilmy
  // Sacred Guardian Beast, Ceryneia
  'BT14-054': [
    hitVanguardPump(
      GP,
      "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your <Gold Paladin>, and that unit gets [Power] +3000 until end of turn.",
      ['RC'],
    ),
  ],
  // Liberator, Burning Blow
  'BT14-055': [
    driveCheckClan2000(
      GP,
      "[AUTO](VC):When this unit's drive check reveals a <Gold Paladin>, this unit gets [Power] +2000 until end of that battle.",
    ),
  ],
  // Dolgal Liberator
  'BT14-056': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard', {
        owner: 'you',
        filter: { nameIncludes: 'Liberator', excludeSelf: true },
      }),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 5000)],
      text: '[AUTO](VC/RC):[Counter-Blast 1] When another of your units with "Liberator" in its card name attacks, and hits a vanguard, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of turn.',
    }),
  ],
  // Sacred Twin Beast, Black Lion
  'BT14-057': [
    fourRearGuards3000(
      GP,
      '[CONT](VC/RC):During your turn, if the number of <Gold Paladin> rear-guards you have is four or more, this unit gets [Power] +3000.',
    ),
  ],
  // Blue Axe Knight, Taliesin
  'BT14-058': [
    vanguardArrivesPump(
      GP,
      '[AUTO](RC):When your grade 3 <Gold Paladin> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Knight of Passion, Torre
  'BT14-059': [
    nameVanguardAttack(
      'Ezel',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Ezel" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Sacred Twin Beast, White Lion
  'BT14-060': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ nameIncludes: 'Ezel' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.topTo(1, 'damage'),
        ab.atNextOn(
          ab.units('you', ['VC']),
          'end_phase',
          [
            ab.choose('d', ab.cards('you', ['damage']), 1, {
              prompt: 'Choose a card in your damage zone to return to your deck',
            }),
            ab.moveTo(ab.bound('d'), 'deck_bottom'),
            ab.shuffle(),
          ],
          'end_of_turn',
          'At the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
        ),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Ezel" in its card name, you may pay the cost. If you do, [Soul-Charge 1], put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    }),
  ],
  // Flying Sword Liberator, Gorlois
  'BT14-061': [
    dropBottomPump(
      GP,
      'Gancelot',
      '[ACT](RC):[Choose a grade 3 card with "Gancelot" in its card name from your drop zone, and put it on the bottom of your deck] If you have a <Gold Paladin> vanguard, choose one of your grade 3 units with "Gancelot" in its card name, and that unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Knife Throwing Knight, Maleagant
  'BT14-062': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [
        ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 2, { upTo: true }),
        { op: 'turn_face', target: ab.bound('d'), faceUp: true },
      ],
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, choose up to two cards from your damage zone, and turn them face up.',
    }),
  ],
  // Scarlet Lion Cub, Caria
  'BT14-063': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: 'Ezel', isVanguard: true }, 'self', 'vanguard'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.lookTop('look', 2),
        ab.choose('c', ab.bound('look', { clan: GP }), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true, rested: true }),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      text: '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a vanguard with "Ezel" in its card name, you may pay the cost. If you do, look at up to two cards from the top of your deck, search for up to two <Gold Paladin> from among them, call them to open (RC) at [Rest], and put the rest on the bottom of your deck in any order.',
    }),
  ],
  'BT14-064': [], // Liberator, Ground Crack
  'BT14-065': [], // Naapgal Liberator
  // Angelic Wiseman
  'BT14-066': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: ab.vanguardIs({ clan: GEN }),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Soul-Blast 3] When this unit attacks, if you have a <Genesis> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Myth Guard, Fomalhaut
  'BT14-067': [
    driveCheckClan2000(
      GEN,
      "[AUTO](VC):When this unit's drive check reveals a <Genesis>, this unit gets [Power] +2000 until end of that battle.",
    ),
  ],
  // Witch of Grapes, Grappa
  'BT14-068': [
    soulDropCharge(
      '[AUTO]:When this card is put into the drop zone from your soul, if you have a <Genesis> vanguard, you may [Soul-Charge 2].',
    ),
  ],
  // Myth Guard, Denebola
  'BT14-069': [
    namedSoulDropPump(
      'Myth Guard, Denebola',
      '[AUTO](RC):When your "Myth Guard, Denebola" is put into the drop zone from your soul, if you have a <Genesis> vanguard, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Battle Maiden, Kayanarumi
  'BT14-070': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Witch of Oranges, Valencia
  'BT14-071': [
    soulDropCharge(
      '[AUTO]:When this card is put into the drop zone from your soul, if you have a <Genesis> vanguard, you may [Soul-Charge 2].',
    ),
  ],
  // Myth Guard, Achernar
  'BT14-072': [
    namedSoulDropPump(
      'Myth Guard, Achernar',
      '[AUTO](RC):When your "Myth Guard, Achernar" is put into the drop zone from your soul, if you have a <Genesis> vanguard, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Goddess of Union, Yuno
  'BT14-073': [
    nameVanguardAttack(
      'Regalia',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Regalia" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Ordain Owl
  'BT14-074': [
    dropBottomPump(
      GEN,
      'Regalia',
      '[ACT](RC):[Choose a grade 3 card with "Regalia" in its card name from your drop zone, and put it on the bottom of your deck] If you have a <Genesis> vanguard, choose one of your grade 3 units with "Regalia" in its card name, and that unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Spectral Sheep
  'BT14-075': [
    ab.forerunner(),
    soulDiscardDraw(
      GEN,
      '[ACT](RC):[Put this unit into your soul & Choose a card from your hand, and discard it] If you have a <Genesis> vanguard, draw a card.',
    ),
  ],
  // Dragon Knight, Jaral
  'BT14-076': [
    driveCheckClan2000(
      KAG,
      "[AUTO](VC):When this unit's drive check reveals a <Kagero>, this unit gets [Power] +2000 until end of that battle.",
    ),
  ],
  // Flame Star Seal Dragon Knight
  'BT14-077': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(ab.vanguardIs({ nameIncludes: 'Seal Dragon' }), [
          ab.restrict(ab.units('opponent', ['RC']), 'cannot_intercept'),
        ]),
      ],
      text: '[ACT](VC/RC):[Counter-Blast 1] If you have a vanguard with "Seal Dragon" in its card name, all of your opponent\'s rear-guards cannot intercept ([Intercept]) until end of turn.',
    }),
  ],
  // Dragon Knight, Razer
  'BT14-078': [
    vanguardArrivesPump(
      KAG,
      '[AUTO](RC):When your grade 3 <Kagero> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Demonic Dragon Mage, Taksaka
  'BT14-079': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Diable Drive Dragon
  'BT14-080': [
    nameVanguardAttack(
      'Dauntless',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Dauntless" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Explosive Claw Seal Dragon Knight
  'BT14-081': [
    attackBonus(
      ab.all(ab.vanguardIs({ clan: KAG }), ab.is(ab.attackedUnit(), { grade: { min: 2, max: 2 } })),
      '[AUTO](VC/RC):When this unit attacks a grade 2 unit, if you have a <Kagero> vanguard, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Calamity Tower Wyvern
  'BT14-082': [
    placedSoulBlastDraw(
      KAG,
      '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <Kagero> vanguard, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Egg Prison Seal Dragon Knight
  'BT14-083': [
    ab.forerunner(),
    soulDiscardDraw(
      KAG,
      '[ACT](RC):[Put this unit into your soul & Choose a card from your hand, and discard it] If you have a <Kagero> vanguard, draw a card.',
    ),
  ],
  'BT14-084': [], // Lizard Soldier, Goraha
  'BT14-085': [], // Flame of Rest, Geara
  'BT14-086': [], // Wyvern Strike, Flee
  'BT14-087': [], // Dragon Dancer, Barbara
  // Stealth Beast, Chain Geek
  'BT14-088': [
    fourRearGuards3000(
      MUR,
      '[CONT](VC/RC):During your turn, if the number of <Murakumo> rear-guards you have is four or more, this unit gets [Power] +3000.',
    ),
  ],
  // Stealth Beast, Deathly Dagger
  'BT14-089': [
    boostPower(
      3000,
      ab.is(ab.boostedUnit(), { sameNameAsAnotherUnit: true }),
      '[AUTO](RC):When this unit boosts ([Boost]) a <Murakumo>, if the number of units with the same name as the boosted ([Boost]) unit is two or more, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
      { clan: MUR },
    ),
  ],
  // Masago Stealth Rogue, Goemon
  'BT14-090': [
    ab.forerunner(),
    sidestep(
      '[ACT](RC):[Soul-Blast 1] If you have a <Murakumo> vanguard, choose one of your open (RC), and move this unit to that circle. (The state of the card does not change)',
      '2',
    ),
  ],
  'BT14-091': [], // Dirk Stealth Rogue, Yaiba
  'BT14-092': [], // Dark Knight Stealth Rogue, Clogg
  // Thundering Bow, Zahraa
  'BT14-093': [
    hitVanguardFlip(
      NAR,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have a <Narukami> vanguard, choose a card from your damage zone, and turn it face up.",
    ),
  ],
  // Plasma Scimitar Dragoon
  'BT14-094': [
    vanguardArrivesPump(
      NAR,
      '[AUTO](RC):When your grade 3 <Narukami> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Dragon Dancer, Agatha
  'BT14-095': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }, true),
      condition: ab.vanguardIs({ clan: NAR }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: NAR, excludeSelf: true })),
        ab.power(ab.bound('t'), 3000),
      ],
      text: "[AUTO](RC):[Soul-Blast 1] When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards, if you have a <Narukami> vanguard, you may pay the cost. If you do, choose one of your other <Narukami>, and that unit gets [Power] +3000 until end of turn.",
    }),
  ],
  // Wyvern Strike, Zalus
  'BT14-096': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: NAR, excludeSelf: true })),
        ab.power(ab.bound('t'), 2000),
      ],
      text: '[ACT](RC):[Rest] this unit] Choose one of your other <Narukami>, and that unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Wish Granting Djinn
  'BT14-097': [
    ab.forerunner(),
    soulDiscardDraw(
      NAR,
      '[ACT](RC):[Put this unit into your soul & Choose a card from your hand, and discard it] If you have a <Narukami> vanguard, draw a card.',
    ),
  ],
  // Jack in Pumpkin
  'BT14-098': [
    attackCBPump4000(
      NN,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Neo Nectar>] When this unit attacks, if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Lotus Druid
  'BT14-099': [
    placedPump2000(
      NN,
      '[AUTO]:When this unit is placed on (RC), choose one of your other <Neo Nectar>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Maiden of Physalis
  'BT14-100': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: ab.vanguardIs({ clan: NN }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        ab.choose('c', ab.bound('l', { clan: NN, grade: { min: 1, max: 1 } }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { rested: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]), if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, look at up to five cards from the top of your deck, search for up to one grade 1 <Neo Nectar> from among them, call it to (RC) at [Rest], and shuffle your deck.',
    }),
  ],
  'BT14-101': [], // Maiden of Eggplant
  // Blue Rose Musketeer, Ernst
  'BT14-102': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: NN }), [
          ab.lookTop('l', 4),
          ab.choose('c', ab.bound('l', { nameIncludes: 'Musketeer' }), 1, { upTo: true }),
          ab.superiorCall(ab.bound('c')),
          ab.shuffle(),
        ]),
      ],
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit on the bottom of your deck] If you have a <Neo Nectar> vanguard, look at up to four cards from the top of your deck, search for up to one card with "Musketeer" in its card name from among them, call it to (RC), and shuffle your deck.',
    }),
  ],
};
