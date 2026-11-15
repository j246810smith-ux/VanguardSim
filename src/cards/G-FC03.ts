/**
 * G-FC03 "Fighter's Collection 2016" (DECISIONS D-034): 51 G units, a G4 and a G guardian for each
 * clan plus three Cray Elementals. G units stride and G guardians are called by the rules (their
 * first line); only their other abilities are scripted. English text from the Internet Archive.
 */
import data from '../../data/cards/G-FC03.json';
import {
  ab,
  type AbilityDefinition,
  type CardFilter,
  type Condition,
  type Selector,
  type Step,
} from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { gFaceUp, gFaceUpAny } from './gShapes';

const RECORDS = (data as SetFile).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text;
  if (t === undefined) throw new Error(`G-FC03: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-FC03: no text line ${n} for ${id}`);
  return line;
};
const nameOf = (id: string): string => RECORDS.find((c) => c.id === id)!.en!.name;

const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const myRGs = ab.units('you', ['RC']);
const myUnits = ab.units('you', ['VC', 'RC']);
const oppRGs = ab.units('opponent', ['RC']);
const hand = ab.cards('you', ['hand']);
/** "the number of face up cards named <this card> in your G zone" */
const faceUpNamed = (id: string): Selector =>
  ab.cards('you', ['gzone'], { faceUp: true, name: nameOf(id) });
/** One branch per exact count of `sel` (1…max; the last is "max or more"). */
const perCount = (sel: Selector, max: number, f: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(sel, n === max ? { min: n } : { min: n, max: n }), f(n)),
  );
const granted = (
  target: Selector,
  ability: AbilityDefinition,
  until: 'end_of_turn' | 'end_of_battle' = 'end_of_turn',
): Step => ab.grant(target, ability, until);
const brave: Condition = ab.any(ab.count(hand, { max: 3 }), { cond: 'brave_active' });
const oracle: Condition = ab.count(hand, { min: 5 });
const thunderstrike = (n: number): Condition =>
  ab.count(ab.cards('opponent', ['bind']), { min: n });
const wave = (min: number, max = 99): Condition => ({ cond: 'battle_number', range: { min, max } });
const oppRested = ab.units('opponent', ['VC', 'RC'], { orientation: 'rest' });

/** "[AUTO]:When this unit is placed on (GC), if <cond>, this unit gets [Shield] +n until end of that battle." */
const gGuard = (
  id: string,
  condition: Condition | null,
  effect: Step[] = [],
  amount = 5000,
  line = 1,
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC'),
    ...(condition ? { condition } : {}),
    effect: [...effect, ab.shield(ab.self(), amount, 'end_of_battle')],
    text: text(id, line),
  });
/** "[CONT](GC):If <cond>, this unit gets [Shield] +5000." */
const gGuardCont = (id: string, condition: Condition, line = 1): AbilityDefinition =>
  ab.cont({
    id: String(line + 1),
    zones: ['GC'],
    condition,
    effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 }],
    text: text(id, line),
  });
const allClans = (id: string, line: number): AbilityDefinition =>
  ab.cont({
    id: 'all_clans',
    zones: ['any'],
    effects: [{ ce: 'all_clans' }],
    text: text(id, line),
  });
/** "At the end of the battle that this unit attacked a vanguard" */
const endOfBattleAttackedVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
/** "look at n cards from the top of your deck, search for up to one card from among them, call it to (an open) (RC), and put the rest on the bottom of your deck in any order" */
const lookCallBottom = (n: number, open = false): Step[] => [
  ab.lookTop('l', n),
  ab.choose('c', bound('l'), 1, { upTo: true, prompt: 'Choose up to one card to call' }),
  ab.superiorCall(bound('c'), open ? { open: true } : {}),
  ab.bottomInOrder(bound('l', { zone: 'deck' })),
];

export const G_FC03: SetAbilities = {
  // ================================================================================ G units
  // Divine Knight of Rainbow Brocade, Clotenus
  'G-FC03-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      requires: brave,
      cost: [ab.counterBlast(1), ab.soulBlast(1), gFaceUpAny()],
      effect: [
        ...perCount(faceUpNamed('G-FC03-001'), 5, (n) => [
          ab.search('s', { grade: { min: 2, max: 2 } }, n),
          ab.superiorCall(bound('s'), { separate: true }),
        ]),
        ab.shuffle(),
        granted(
          ab.self(),
          ab.cont({
            id: 'clotenus',
            zones: ['VC'],
            generationBreak: 3,
            condition: ab.count(myRGs, { min: 5 }),
            effects: [
              { ce: 'modify', target: ab.self(), stat: 'power', amount: 10000 },
              { ce: 'modify', target: ab.self(), stat: 'critical', amount: 1 },
            ],
            text: '[CONT](VC)[Generation Break 3]:If you have five rear-guards, this unit gets [Power] +10000/[Critical] +1.',
          }),
        ),
      ],
      text: text('G-FC03-001', 1),
    }),
  ],
  // Lord of Guidance, Wakahirume
  'G-FC03-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      condition: oracle,
      cost: [ab.counterBlast(1), ab.soulBlast(1), gFaceUp(nameOf('G-FC03-002'))],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('t', hand, 1, {
          prompt: 'Choose a card from your hand to put on top of your deck',
        }),
        ab.moveTo(bound('t'), 'deck_top'),
      ],
      text: text('G-FC03-002', 1),
    }),
  ],
  // Meteokaiser, Bustered
  'G-FC03-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1), gFaceUpAny()],
      optional: true,
      effect: [
        ab.choose('s', myRGs, 1, {
          countOf: faceUpNamed('G-FC03-003'),
          prompt: 'Choose rear-guards to [Stand]',
        }),
        ab.stand(bound('s')),
        ab.if_(ab.all(ab.count(bound('s'), { min: 2 }), ab.count(myRGs, { min: 5 })), [
          granted(
            ab.self(),
            ab.auto({
              id: 'bustered',
              zones: ['VC'],
              trigger: ab.atStartOf('close_step'),
              cost: [ab.counterBlast(1), ab.discard(2)],
              optional: true,
              effect: [
                ab.stand(ab.self()),
                granted(
                  ab.self(),
                  ab.cont({
                    id: 'drive_minus',
                    zones: ['VC'],
                    effects: [{ ce: 'drive', target: ab.self(), amount: -2 }],
                    text: 'drive -2',
                  }),
                ),
              ],
              text: '[AUTO](VC):[Counter-Blast 1 & Choose two cards from your hand, and discard them] At the end of the battle, you may pay the cost. If you do, [Stand] this unit, and it gets drive -2 until end of turn.',
            }),
            'end_of_battle',
          ),
        ]),
      ],
      text: text('G-FC03-003', 1),
    }),
  ],
  // Genesis Dragon, Trans-else Messiah
  'G-FC03-004': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 2,
      trigger: ab.placedOn('VC'),
      condition: { cond: 'heart_named', part: 'Messiah' },
      cost: [ab.counterBlast(1), gFaceUp(nameOf('G-FC03-004'))],
      optional: true,
      effect: [
        ab.choose('n', ab.units('any', ['RC']), 10),
        ab.unlock(ab.cards('any', ['locked'])),
        ab.lock(bound('n')),
      ],
      text: text('G-FC03-004', 1),
    }),
  ],
  // Dreamiy Axel, Milward
  'G-FC03-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.soulBlast(1), gFaceUpAny()],
      effect: [
        ab.choose('m', ab.cards('you', ['soul']), 2, {
          upTo: true,
          prompt: 'Choose up to two cards from your soul to call',
        }),
        ab.superiorCall(bound('m'), { separate: true }),
        ab.power(bound('m', { zone: 'circle' }), 4000),
        ab.atNextOn(
          bound('m', { zone: 'circle' }),
          'end_phase',
          [ab.moveTo(ab.self(), 'soul')],
          'end_of_turn',
          'At the end of that turn, put this unit into your soul.',
        ),
        ab.choose('u', myUnits, 1, {
          countOf: faceUpNamed('G-FC03-005'),
          prompt: 'Choose units to give the ability',
        }),
        granted(
          bound('u'),
          ab.auto({
            id: 'milward',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ab.choose('c', ab.cards('you', ['soul']), 1, { upTo: true }),
              ab.superiorCall(bound('c'), { occupied: true }),
            ],
            text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose up to one card from your soul, and call it to a (RC) with a unit.",
          }),
        ),
      ],
      text: text('G-FC03-005', 1),
    }),
  ],
  // Interdimensional Dragon, Warp Drive Dragon
  'G-FC03-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ab.choose('g', ab.cards('you', ['gzone'], { faceUp: false }), 1, {
          prompt: 'Choose a face down card from your G zone',
        }),
        ab.may('Turn it face up?', [{ op: 'turn_face', target: bound('g'), faceUp: true }]),
        ab.choose('t', myRGs, 1, {
          countOf: faceUpNamed('G-FC03-006'),
          upTo: true,
          prompt: 'Choose rear-guards to time leap',
        }),
        ...perCount(bound('t'), 5, (n) => [
          ab.choose('b', ab.units('opponent', ['RC'], { grade: { max: n } }), 1),
          ab.moveTo(bound('b'), 'deck_bottom'),
        ]),
        ab.timeLeap(bound('t')),
      ],
      text: text('G-FC03-006', 1),
    }),
  ],
  // Demon Sea Queen, Maread
  'G-FC03-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny(), ab.discard(1)],
      effect: [
        ...perCount(faceUpNamed('G-FC03-007'), 5, (n) => [
          {
            op: 'choose_grade_sum',
            as: 'c',
            from: ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' }),
            count: n,
            maxGradeSum: 4,
          },
        ]),
        ab.superiorCall(bound('c'), { separate: true }),
        {
          op: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byOriginalPowerOf: bound('c', { zone: 'circle' }),
        },
      ],
      text: text('G-FC03-007', 1),
    }),
  ],
  // Flower Princess of Perpetual Summer, Verano
  'G-FC03-008': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [
        ab.soulBlast(1),
        gFaceUpAny(),
        ab.moveChosenCost(hand, 'deck_bottom'),
        ab.moveChosenCost(ab.cards('you', ['drop']), 'deck_bottom'),
      ],
      optional: true,
      effect: [
        ab.choose('h', hand, 2, {
          upTo: true,
          prompt: 'Choose up to two cards from your hand to call',
        }),
        ab.superiorCall(bound('h'), { separate: true }),
        ab.choose('r', myRGs, 1, {
          countOf: faceUpNamed('G-FC03-008'),
          prompt: 'Choose rear-guards',
        }),
        ...perCount(bound('r'), 5, (n) => [ab.search('s', { sameNameAsBound: 'r' }, n)]),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.shuffle(),
        granted(
          bound('s', { zone: 'circle' }),
          ab.cont({
            id: 'boost',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'boost')],
            text: 'Boost ([Boost])',
          }),
        ),
      ],
      text: text('G-FC03-008', 1),
    }),
  ],
  // Holy Seraph, Zachariel
  'G-FC03-009': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        granted(
          ab.self(),
          ab.cont({
            id: 'zachariel',
            zones: ['VC'],
            condition: ab.exists(ab.cards('you', ['damage'], { faceUp: true })),
            effects: [
              { ce: 'modify', target: ab.units('you', ['front_RC']), stat: 'power', amount: 3000 },
            ],
            text: '[CONT](VC):If you have a face up card in your damage zone, all of the rear-guards in your front row get [Power] +3000.',
          }),
        ),
        granted(
          ab.self(),
          ab.cont({
            id: 'zachariel5',
            zones: ['VC'],
            condition: ab.count(ab.cards('you', ['damage']), { min: 5 }),
            effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 10000 }],
            text: '[CONT](VC):If the number of cards in your damage zone is five, this unit gets [Power] +10000.',
          }),
        ),
      ],
      text: text('G-FC03-009', 1),
    }),
  ],
  // Dark Dragon, Distress Dragon
  'G-FC03-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(3), ab.soulBlast(3), gFaceUpAny()],
      effect: [
        ab.choose('r', myRGs, 5, {
          upTo: true,
          prompt: 'Choose any number of your rear-guards to retire',
        }),
        ab.retire(bound('r')),
        ab.choose('or', oppRGs, 1, {
          countOf: bound('r'),
          chooser: 'opponent',
          prompt: 'Choose your rear-guards to retire',
        }),
        ab.retire(bound('or')),
        ...[3, 4, 5].map((n) =>
          ab.if_(
            ab.all(ab.count(bound('r'), { min: n, max: n }), ab.count(bound('or'), { min: 6 - n })),
            [ab.draw(2), ...ab.counterCharge(1), ab.soulCharge(1), ab.power(ab.self(), 20000)],
          ),
        ),
      ],
      text: text('G-FC03-010', 1),
    }),
  ],
  // Golden Knight of Incandescence, Ebraucus
  'G-FC03-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: lookCallBottom(2, true),
      text: text('G-FC03-011', 1),
    }),
  ],
  // Beast-Slayer Military Deity, Tyr
  'G-FC03-012': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(3)],
      effect: [
        ab.lookTopPlace(),
        granted(
          ab.self(),
          ab.auto({
            id: 'tyr',
            zones: ['VC'],
            trigger: {
              on: 'check_reveals',
              check: 'drive',
              who: 'self',
              card: { grade: { min: 1 } },
            },
            effect: [ab.may('[Soul-Charge 3]?', [ab.soulCharge(3)])],
            text: '[AUTO](VC):When your drive check reveals a grade 1 or greater card, you may [Soul-Charge 3].',
          }),
        ),
      ],
      text: text('G-FC03-012', 1),
    }),
  ],
  // Flame Emperor Dragon King, Irresist Dragon
  'G-FC03-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.either(
          "Choose a unit in your opponent's front row (no: the back row)?",
          [ab.retire(ab.units('opponent', ['front_RC']))],
          [ab.retire(ab.units('opponent', ['back_RC']))],
        ),
      ],
      text: text('G-FC03-013', 1),
    }),
  ],
  // Rikudo Stealth Dragon, Gounrakan
  'G-FC03-014': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('keep', oppRGs, 2, {
          chooser: 'opponent',
          prompt: 'Choose two of your rear-guards to keep',
        }),
        ab.choose('b', ab.units('opponent', ['RC'], { notBound: 'keep' }), 5),
        ab.moveTo(bound('b'), 'bind'),
        ab.if_(ab.count(bound('b', { zone: 'bind' }), { min: 3 }), [
          ab.choose('d', bound('b', { zone: 'bind' }), 2, {
            chooser: 'opponent',
            prompt: 'Choose two bound cards to put into the drop zone',
          }),
          ab.moveTo(bound('d'), 'drop'),
        ]),
        ab.atNextOn(
          bound('b', { zone: 'bind' }),
          'end_phase',
          [ab.moveTo(ab.self(), 'hand')],
          'end_of_turn',
          'At the end of the turn, put this card into your hand.',
        ),
      ],
      text: text('G-FC03-014', 1),
    }),
  ],
  // Destruction Tyrant, Gradogigant: its engorge counts and pays off in one ability
  'G-FC03-015': [
    ab.auto({
      id: 'engorge',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      effect: [
        ab.choose('__engorge', ab.units('you', ['RC'], { excludeSelf: true }), 5, {
          upTo: true,
          prompt: 'Engorge: choose rear-guards to retire (none to skip)',
        }),
        ab.engorge(ab.self(), bound('__engorge')),
        ...perCount(bound('__engorge', { zone: 'drop' }), 5, (n) => [
          ab.power(ab.self(), 5000 * n),
        ]),
        ab.if_(ab.count(bound('__engorge', { zone: 'drop' }), { min: 3 }), [ab.draw(1)]),
      ],
      text: `${text('G-FC03-015', 1)}\n${text('G-FC03-015', 2)}`,
    }),
  ],
  // Ambush Demon Stealth Dragon, Onibibu Radar
  'G-FC03-016': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('h', hand, 1, {
          upTo: true,
          prompt: 'Choose up to one card from your hand to call',
        }),
        ab.superiorCall(bound('h')),
        ab.choose('t', myRGs, 1),
        ab.power(bound('t'), 2000),
        granted(
          bound('t'),
          ab.cont({
            id: 'back_row',
            zones: ['RC'],
            effects: [{ ce: 'allow', target: ab.self(), permission: 'attack_from_back_row' }],
            text: '[CONT](RC):This unit can attack a vanguard from the back row.',
          }),
        ),
      ],
      text: text('G-FC03-016', 1),
    }),
  ],
  // Conquering Supreme Dragon, Voltechzapper Dragon
  'G-FC03-017': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: thunderstrike(3),
      effect: [
        ab.power(ab.self(), 10000, 'end_of_battle'),
        granted(
          ab.self(),
          ab.auto({
            id: 'volt',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: perCount(ab.cards('opponent', ['bind']), 10, (n) =>
              n < 2
                ? []
                : [
                    ab.choose('v', oppRGs, Math.floor(n / 2), {
                      chooser: 'opponent',
                      prompt: 'Choose your rear-guards to retire and bind',
                    }),
                    ab.moveTo(bound('v'), 'bind'),
                  ],
            ),
            text: "[AUTO](VC):[Counter-Blast 1] At the end of the battle, you may pay the cost. If you do, for every two cards in your oponent's bind zone, your opponent chooses one of his or her rear-guards, retires it, and binds that card face up.",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-FC03-017', 1),
    }),
  ],
  // Super Cosmic Hero, X-phoenix
  'G-FC03-018': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      ...endOfBattleAttackedVanguard,
      condition: ab.all(ab.is(ab.self(), { power: { min: 35000 } }), {
        cond: 'battle_hit',
        hit: false,
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-FC03-018', 1),
    }),
  ],
  // Super Heavy Chariot, Tiger Centurion
  'G-FC03-019': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('c', ab.units('you', ['RC'], { abilityTextIncludes: 'Charge' }), 5, {
          upTo: true,
          prompt: 'Choose rear-guards with the charge ability',
        }),
        { op: 'charge', target: bound('c') },
        ab.choose('p', ab.units('you', ['RC'], { notBound: 'c' }), 5, {
          upTo: true,
          prompt: 'Choose up to five other rear-guards',
        }),
        ab.power(bound('p'), 2000),
      ],
      text: text('G-FC03-019', 1),
    }),
  ],
  // Rebellious Retainer of Fresh Blood, Frederick
  'G-FC03-020': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.moveChosenCost(hand, 'soul')],
      effect: [
        ab.power(ab.self(), 1000, 'end_of_turn', ab.cards('you', ['soul'])),
        ab.if_(ab.count(ab.cards('you', ['soul']), { min: 10 }), [
          ab.power(ab.units('you', ['front_RC']), 5000),
          ab.lose(ab.self(), { ability: '1' }),
        ]),
      ],
      text: text('G-FC03-020', 1),
    }),
  ],
  // Lucky Rise, Elprina
  'G-FC03-021': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1)],
      effect: [ab.choose('r', myRGs, 2, { upTo: true }), ab.toHand(bound('r'))],
      text: text('G-FC03-021', 1),
    }),
  ],
  // Marine General of Heavenly Silk, Christos
  'G-FC03-022': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: wave(1, 1),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.units('you', ['front_RC']), 2000),
        granted(
          ab.units('you', ['front_RC']),
          ab.auto({
            id: 'christos',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            condition: wave(3, 4),
            effect: [ab.draw(1)],
            text: "[AUTO](RC)Wave-3rd or 4th time:When this unit's attack hits a vanguard, draw a card.",
          }),
        ),
      ],
      text: text('G-FC03-022', 1),
    }),
  ],
  // Wild-fire Mutant Deity, Staggle Dipper
  'G-FC03-023': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ab.choose('t', myUnits, 3, { upTo: true }),
        ab.power(bound('t'), 1000, 'end_of_turn', oppRested),
      ],
      text: text('G-FC03-023', 1),
    }),
  ],
  // Omniscience Dragon, Hrimthurs
  'G-FC03-024': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      ...endOfBattleAttackedVanguard,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', myRGs, 1),
        ab.power(bound('t'), 4000),
        ab.may('That unit gets another [Power] +4000 (retire it at the end of the turn)?', [
          ab.power(bound('t'), 4000),
          ab.atNextOn(
            bound('t'),
            'end_phase',
            [ab.retire(ab.self())],
            'end_of_turn',
            'At the end of that turn, retire this unit.',
          ),
        ]),
        ab.if_(ab.exists(bound('t', { power: { min: 20000 } })), [ab.draw(1)]),
      ],
      text: text('G-FC03-024', 1),
    }),
  ],
  // ============================================================================ G guardians
  'G-FC03-025': [
    gGuard('G-FC03-025', ab.exists(ab.units('you', ['RC'], { grade: { min: 2, max: 2 } }))),
  ],
  'G-FC03-026': [gGuard('G-FC03-026', ab.count(hand, { min: 3 }))],
  'G-FC03-027': [gGuardCont('G-FC03-027', ab.count(ab.cards('you', ['damage']), { min: 4 }))],
  // Dark Knight, Ludvik
  'G-FC03-028': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('g', ab.units('you', ['RC'], { grade: { max: 1 } }), 1),
        ab.if_(ab.exists(bound('g')), [
          ab.may('Move it to your (GC)?', [{ op: 'to_guardian', target: bound('g') }]),
        ]),
      ],
      text: text('G-FC03-028', 1),
    }),
  ],
  'G-FC03-029': [gGuard('G-FC03-029', ab.count(myRGs, { min: 2 }))],
  // Goddess of Seven Colors, Iris
  'G-FC03-030': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('s', ab.cards('you', ['drop']), 3, { upTo: true }),
        ab.moveTo(bound('s'), 'soul'),
        ab.if_(ab.count(bound('s', { zone: 'soul' }), { min: 3 }), [
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
      ],
      text: text('G-FC03-030', 1),
    }),
  ],
  'G-FC03-031': [gGuard('G-FC03-031', ab.count(oppRGs, { max: 4 }))],
  'G-FC03-032': [gGuard('G-FC03-032', ab.count(ab.cards('opponent', ['hand']), { max: 6 }))],
  'G-FC03-033': [gGuardCont('G-FC03-033', { cond: 'compare', a: myRGs, op: '<=', b: oppRGs })],
  // Ambush Demon Stealth Fiend, Hougen Wing
  'G-FC03-034': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { grade: { min: 1 } }), 1),
        ab.search('s', { sameNameAsBound: 'r' }),
        ab.callGuardians(bound('s')),
        ab.shuffle(),
        granted(
          bound('s', { zone: 'circle' }),
          ab.auto({
            id: 'hougen',
            zones: ['any'],
            trigger: { on: 'put_into_drop', who: 'self', from: 'GC' },
            effect: [ab.moveTo(ab.self(), 'deck_bottom')],
            text: '[AUTO]:When this unit is put into the drop zone from (GC), put this card on the bottom of your deck.',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-FC03-034', 1),
    }),
  ],
  'G-FC03-035': [gGuardCont('G-FC03-035', thunderstrike(1))],
  'G-FC03-036': [
    gGuard('G-FC03-036', {
      cond: 'compare',
      a: ab.cards('you', ['damage']),
      op: '>=',
      b: ab.cards('opponent', ['damage']),
    }),
  ],
  'G-FC03-037': [gGuard('G-FC03-037', ab.is(ab.attackingUnit(), { power: { min: 20000 } }))],
  // Death Star-vader, Demon Maxwell
  'G-FC03-038': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.lockCost(ab.units('you', ['back_RC']))],
      optional: true,
      effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-FC03-038', 1),
    }),
  ],
  'G-FC03-039': [gGuard('G-FC03-039', ab.count(myRGs, { max: 3 }))],
  // False Dark Wings, Agrat bat Mahlat
  'G-FC03-040': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.soulCharge(2),
        ab.if_(ab.count(ab.cards('you', ['soul']), { min: 6 }), [
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
      ],
      text: text('G-FC03-040', 1),
    }),
  ],
  // Chainsaw Megatrick, Furnival
  'G-FC03-041': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.lookTop('l', 3),
        ab.choose('s', bound('l'), 1, { prompt: 'Choose a card to put into your soul' }),
        ab.moveTo(bound('s'), 'soul'),
        ab.bottomInOrder(bound('l', { zone: 'deck' })),
        ab.if_(ab.exists(bound('s', { grade: { min: 1 } })), [
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
      ],
      text: text('G-FC03-041', 1),
    }),
  ],
  // Retroactive Time Maiden, Uluru
  'G-FC03-042': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('n', ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' }), 1, {
          upTo: true,
          prompt: 'Choose up to one normal unit',
        }),
        ab.choose('t', ab.cards('you', ['drop'], { trigger: 'any' }), 1, {
          upTo: true,
          prompt: 'Choose up to one trigger unit',
        }),
        ab.moveTo(bound('n'), 'deck_bottom'),
        ab.moveTo(bound('t'), 'deck_bottom'),
        ab.if_(ab.all(ab.exists(bound('n')), ab.exists(bound('t'))), [
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
      ],
      text: text('G-FC03-042', 1),
    }),
  ],
  // Eclipse Dragonhulk, Deep Corpse Dragon
  'G-FC03-043': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.topToCost(2, 'drop')],
      optional: true,
      effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-FC03-043', 1),
    }),
  ],
  // Sailor's Medley, Nasha
  'G-FC03-044': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('r', hand, 1, {
          upTo: true,
          prompt: 'Choose up to one card from your hand to reveal',
        }),
        ab.reveal(bound('r')),
        ...[0, 1, 2, 3].map((g) =>
          ab.if_(
            ab.all(
              ab.exists(bound('r', { grade: { min: g, max: g } })),
              ab.exists(ab.units('you', ['VC', 'RC', 'GC'], { grade: { min: g, max: g } })),
            ),
            [ab.shield(ab.self(), 5000, 'end_of_battle')],
          ),
        ),
      ],
      text: text('G-FC03-044', 1),
    }),
  ],
  'G-FC03-045': [gGuard('G-FC03-045', wave(1, 2))],
  'G-FC03-046': [gGuard('G-FC03-046', ab.count(oppRested, { min: 2 }))],
  // Immortality Professor, Kundalini
  'G-FC03-047': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('t', myRGs, 1),
        ab.if_(ab.exists(bound('t')), [
          ab.may('Give it "At the end of each turn, retire this unit, and [Counter-Charge 1]"?', [
            granted(
              bound('t'),
              ab.auto({
                id: 'kundalini',
                zones: ['RC'],
                trigger: ab.atStartOf('end_phase', 'any'),
                effect: [ab.retire(ab.self()), ...ab.counterCharge(1)],
                text: '[AUTO](RC):At the end of each turn, retire this unit, and [Counter-Charge 1].',
              }),
            ),
            ab.shield(ab.self(), 5000, 'end_of_battle'),
          ]),
        ]),
      ],
      text: text('G-FC03-047', 1),
    }),
  ],
  // Sacred Tree Dragon, Rain Breath Dragon
  'G-FC03-048': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('h', hand, 1, {
          upTo: true,
          prompt: 'Choose up to one card from your hand to call',
        }),
        ab.superiorCall(bound('h')),
        granted(
          bound('h', { zone: 'circle' }),
          ab.cont({
            id: 'resist',
            zones: ['RC', 'GC'],
            effects: [{ ce: 'restrict', target: ab.self(), restriction: 'resist' }],
            text: '[CONT](RC)/(GC):Resist',
          }),
        ),
        ab.if_(ab.exists(bound('h', { zone: 'circle' })), [
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
      ],
      text: text('G-FC03-048', 1),
    }),
  ],
  // ======================================================================== Cray Elementals
  // Air Element, Sebreeze
  'G-FC03-049': [
    ab.act({
      id: '1',
      zones: ['GZ'],
      requires: ab.all(
        ab.exists(ab.units('you', ['VC'], { grade: { min: 3, max: 3 } })),
        ab.count(ab.cards('you', ['gzone'], { faceUp: true }), { max: 0 }),
        ab.exists(ab.units('opponent', ['VC'], { grade: { min: 2, max: 2 } })),
        ab.not({ cond: 'placed_on_vc_in_ride_phase', player: 'opponent' }),
        { cond: 'turn', of: 'you' },
      ),
      cost: [ab.counterBlast(2), ab.discard(1)],
      effect: [{ op: 'stride_self' }],
      text: text('G-FC03-049', 1),
    }),
    allClans('G-FC03-049', 2),
  ],
  // Metal Element, Scryew
  'G-FC03-050': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.count(ab.cards('you', ['gzone'], { faceUp: true }), { min: 1 }),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-FC03-050', 1),
    }),
    allClans('G-FC03-050', 2),
  ],
  // Dark Element, Dizmel
  'G-FC03-051': [
    ab.cont({
      id: '2',
      zones: ['GC'],
      effects: [{ ce: 'restrict', target: ab.self(), restriction: 'resist' }],
      text: text('G-FC03-051', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('t', myRGs, 1),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_turn'),
        ab.restrict(bound('t'), 'resist', 'end_of_turn'),
      ],
      text: text('G-FC03-051', 2),
    }),
    allClans('G-FC03-051', 3),
  ],
};
