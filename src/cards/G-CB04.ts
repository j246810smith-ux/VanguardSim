/**
 * G-CB04 "Gear of Fate" (G Clan Booster 4, DECISIONS D-034): Gear Chronicle time leap
 * ("Chronojet"), the bind zone ("Chronofang", <Gear Colossus>), putting the opponent's rear-guards
 * into the deck ("Chronoscommand") and the Legion of Slow Divider Dragon. G units stride by the
 * rules; only their other abilities are scripted here. English from Internet Archive copies of the
 * official pages and the card wiki.
 *
 * New here: calls by a time leap are marked (`byTimeLeap` on the `placed` trigger), cards bound
 * from the drop zone (`fromDrop`), "your drive check revealed a trigger unit this turn"
 * (`drive_trigger_this_turn`) and copying only [AUTO] abilities (`copy_abilities` `onlyAuto`).
 */
import data from '../../data/cards/G-CB04.json';
import translations from '../../data/translations/unofficial.json';
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
import { gPerfectGuard } from './G-TD01';
import { gFaceUp, gFaceUpAny, noGuardsFromHand } from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CB04: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CB04: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-CB04: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const ZTB = 'Zodiac Time Beast';
const COLOSSUS = 'Gear Colossus';
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const chronojet = vanguardNamed('Chronojet');
const chronofang = vanguardNamed('Chronofang');
const chronoscommand = vanguardNamed('Chronoscommand');
const colossusVanguard: Condition = ab.exists(ab.units('you', ['VC'], { race: COLOSSUS }));
const faceUpGNamed = (p: string): Condition =>
  ab.exists(ab.cards('you', ['gzone'], { faceUp: true, nameIncludes: p }));
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
const vanguardLegion: Condition = ab.exists(ab.units('you', ['VC'], { legionMate: true }));
const bindZone = (filter: CardFilter = {}) => ab.cards('you', ['bind'], filter);
const bindAtLeast = (n: number): Condition => ab.count(bindZone(), { min: n });
const oppRGsAtMost = (n: number): Condition => ab.count(ab.units('opponent', ['RC']), { max: n });

// --- effect pieces -------------------------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const myHand = (filter: CardFilter = {}) => ab.cards('you', ['hand'], filter);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const myVanguard = ab.units('you', ['VC']);
const chooseUpTo = (as: string, from: Selector, n = 1, prompt?: string): Step =>
  ab.choose(as, from, n, { upTo: true, ...(prompt ? { prompt } : {}) });
/** "bind the top card of your deck face up" (as `bt`) */
const bindTop: Step[] = [ab.lookTop('bt', 1), ab.moveTo(bound('bt'), 'bind')];
/** "choose a card from your hand, and bind it face up" */
const bindFromHand: Step[] = [
  ab.choose('bh', myHand(), 1, { prompt: 'Choose a card from your hand to bind face up' }),
  ab.moveTo(bound('bh'), 'bind'),
];
/** "your opponent chooses one of his or her (<filter>) rear-guards, and puts it on the bottom of his or her deck" */
const oppBottomsOwn = (areas: ('RC' | 'back_RC')[] = ['RC'], filter: CardFilter = {}): Step[] => [
  ab.choose('ob', ab.units('opponent', areas, filter), 1, { chooser: 'opponent' }),
  ab.moveTo(bound('ob'), 'deck_bottom'),
];
/** "choose (up to) one of your opponent's (<filter>) rear-guards, and your opponent puts that unit on the bottom of his or her deck" */
const youChooseOppBottom = (filter: CardFilter = {}, upTo = false): Step[] => [
  ab.choose('ob', ab.units('opponent', ['RC'], filter), 1, upTo ? { upTo: true } : {}),
  ab.moveTo(bound('ob'), 'deck_bottom'),
];
/** "choose one of your (other) rear-guards (<filter>), and you may time leap it" */
const mayLeap = (filter: CardFilter = {}): Step[] => [
  chooseUpTo('tl', myRGs(filter), 1, 'You may time leap one of your rear-guards'),
  ab.timeLeap(bound('tl')),
];
/** One branch per grade 0–3 of the card bound as `as`: `f(g)` with that grade. */
const perGradeOf = (as: string, f: (g: number) => Step[]): Step[] =>
  [0, 1, 2, 3].map((g) => ab.if_(ab.exists(bound(as, { grade: { min: g, max: g } })), f(g)));
/** "+n for every k cards in your bind zone": one [CONT] per step. */
const perBound = (
  id: string,
  line: number,
  zones: ('VC' | 'RC' | 'GC')[],
  stat: 'power' | 'shield',
  amount: number,
  every: number,
  condition?: Condition,
): AbilityDefinition[] =>
  Array.from({ length: 12 }, (_, i) =>
    ab.cont({
      id: i === 0 ? String(line + 1) : `${line + 1}_${i + 1}`,
      zones,
      condition: condition
        ? ab.all(condition, bindAtLeast(every * (i + 1)))
        : bindAtLeast(every * (i + 1)),
      effects: [ab.gets(ab.self(), stat, amount)],
      text: text(id, line),
    }),
  );
/**
 * "choose one of your opponent's rear-guards, your opponent returns that unit to his or her deck,
 * searches his or her deck for up to one card with grade -1 than that unit, calls it to (RC), and
 * shuffles his or her deck" (as G-TD06).
 */
const returnForOneGradeLess: Step[] = [
  ab.choose('r', ab.units('opponent', ['RC'])),
  ab.if_(
    ab.is(bound('r'), { grade: { max: 0 } }),
    [ab.moveTo(bound('r'), 'deck_bottom'), ab.asOpponent([ab.shuffle()])],
    [1, 2, 3].map((g) =>
      ab.if_(ab.is(bound('r'), { grade: { min: g, max: g } }), [
        ab.moveTo(bound('r'), 'deck_bottom'),
        ab.asOpponent([
          ab.search('low', { grade: { min: g - 1, max: g - 1 } }),
          ab.superiorCall(bound('low')),
          ab.shuffle(),
        ]),
      ]),
    ),
  ),
];

// --- triggers ------------------------------------------------------------------------------------
/** "When … is placed on (RC) from your deck due to time leap" */
const placedByLeap = (who: 'self' | 'other') => ({
  on: 'placed' as const,
  who:
    who === 'self' ? ('self' as const) : { owner: 'you' as const, filter: { excludeSelf: true } },
  circle: 'RC' as const,
  from: 'deck' as const,
  byTimeLeap: true,
});
/** "When your opponent's rear-guard is put into his or her deck (due to an effect from one of your cards)" */
const oppIntoDeck = (byYou = false) => ({
  on: 'put_into_deck' as const,
  who: { owner: 'opponent' as const },
  ...(byYou ? { byYourEffect: true } : {}),
});
/** "When this unit is put into your bind zone from (RC) / the drop zone" */
const boundFrom = (from: 'RC' | 'drop') => ({
  on: 'put_into_bind' as const,
  who: 'self' as const,
  ...(from === 'RC' ? { fromRC: true } : { fromDrop: true }),
});
const afterBoosting = (boosted: CardFilter = {}) => ({
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { boosting: true }), ab.is(ab.boostedUnit(), boosted)),
});
const interceptGuard = (id: string, line: number): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.intercepts(),
    condition: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
    effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
    text: text(id, line),
  });

export const G_CB04: SetAbilities = {
  // ============================================================================ G units
  // Deus Ex Machina, Demiurge: "twelve … with different card names" is checked before paying
  // (UNRESOLVED_RULINGS "G-CB04 notes")
  'G-CB04-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      requires: {
        cond: 'distinct_names',
        of: bindZone({ faceUp: true, race: ZTB }),
        range: { min: 12 },
      },
      cost: [ab.moveChosenCost(bindZone({ faceUp: true, race: ZTB }), 'drop', 12)],
      effect: [
        ab.choose('top', ab.cards('you', ['drop']), 12, {
          prompt: 'Choose twelve cards to put on the top of your deck',
        }),
        ab.topInOrder(bound('top')),
        granted(
          ab.self(),
          ab.auto({
            id: 'demiurge_attack',
            zones: ['VC'],
            trigger: ab.attacks(),
            effect: [
              noGuardsFromHand(
                1,
                'Your opponent cannot call grade 1 or greater cards from hand to (GC).',
              ),
            ],
            text: part('G-CB04-001', '[AUTO](VC):When this unit attacks'),
          }),
        ),
      ],
      text: text('G-CB04-001', 1),
    }),
  ],
  // Chronotiger Rebellion
  'G-CB04-002': [
    ...perBound('G-CB04-002', 1, ['VC'], 'power', 5000, 2),
    ab.auto({
      id: '3',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: heart('Chronofang'),
      cost: [
        ab.soulBlast(1),
        gFaceUp('Chronotiger Rebellion'),
        ab.moveChosenCost(myHand(), 'bind'),
        ab.moveChosenCost(myRGs(), 'bind'),
      ],
      optional: true,
      effect: [
        ab.critical(ab.self(), 1, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'rebellion_drive',
            zones: ['VC'],
            effects: [{ ce: 'drive', target: ab.self(), amount: 1 }],
            text: 'drive +1',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CB04-002', 2),
    }),
  ],
  // Chronodragon Gear Groovy: the [AUTO] abilities of the two chosen G units are copied
  'G-CB04-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [gFaceUp('Chronodragon Gear Groovy')],
      effect: [
        ab.if_(heart('Chronojet'), [
          ab.choose(
            'gd',
            ab.cards('you', ['gzone'], {
              faceUp: true,
              race: 'Gear Dragon',
              notName: 'Chronodragon Gear Groovy',
            }),
            2,
            { prompt: 'Choose two face up <Gear Dragon> in your G zone' },
          ),
          {
            op: 'copy_abilities',
            target: ab.self(),
            from: bound('gd'),
            duration: 'end_of_turn',
            onlyAuto: true,
          },
        ]),
      ],
      text: text('G-CB04-003', 1),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 3,
      cost: [ab.soulBlast(1), gFaceUpAny()],
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-CB04-003', 2),
    }),
  ],
  // Interdimensional Beast, Pandora Chimera ([G Guardian]: card data)
  'G-CB04-007': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: oppBottomsOwn(['back_RC']),
      text: text('G-CB04-007', 1),
    }),
  ],
  // Interdimensional Dragon, Heteroround Dragon ([G Guardian]: card data)
  'G-CB04-008': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: chronojet,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC']), 1),
        ab.moveTo(bound('r'), 'deck_bottom'),
        ab.asOpponent([ab.shuffle(), ab.lookTop('ot', 1), ab.superiorCall(bound('ot'))]),
      ],
      text: text('G-CB04-008', 1),
    }),
  ],
  // Deus Ex Machina, Ergos
  'G-CB04-014': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.topToCost(1, 'bind')],
      optional: true,
      effect: [chooseUpTo('b', bindZone()), ab.toHand(bound('b')), ...bindFromHand],
      text: text('G-CB04-014', 1),
    }),
  ],
  // ============================================================================ grade 3
  // Ephemeral Wand Dragon
  'G-CB04-004': [
    ...(['attacks', 'attacked'] as const).map((on, i) =>
      ab.auto({
        id: i === 0 ? '1' : '1b',
        zones: ['VC'],
        generationBreak: 2,
        trigger: on === 'attacks' ? ab.attacks() : ab.isAttacked(),
        condition: ab.is(on === 'attacks' ? ab.attackedUnit() : ab.attackingUnit(), {
          isVanguard: true,
        }),
        cost: [
          ab.soulBlast(1),
          { cost: 'g_face_up', n: 1, filter: { nameIncludes: 'Chronoscommand' } },
        ],
        optional: true,
        effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
        text: text('G-CB04-004', 0),
      }),
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: {
        on: 'stride',
        who: { owner: 'you', filter: { nameIncludes: 'Chronoscommand' } },
      },
      condition: ab.yourTurn(),
      cost: [gFaceUpAny()],
      optional: true,
      effect: [ab.choose('v', myVanguard, 1), ab.power(bound('v'), 10000)],
      text: text('G-CB04-004', 1),
    }),
  ],
  // Prospatheia Idea-drone
  'G-CB04-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      trigger: ab.placedOn('GC', { owner: 'you' }),
      condition: ab.is(ab.attackingUnit(), { isVanguard: true }),
      cost: [
        ab.soulBlast(1),
        ab.moveChosenCost(ab.units('you', ['GC'], { grade: { max: 2 } }), 'bind'),
      ],
      optional: true,
      effect: [ab.power(ab.self(), 15000, 'end_of_battle')],
      text: text('G-CB04-005', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['drop']), 'bind')],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.choose('b', myRGs(), 1),
        ab.moveTo(bound('b'), 'bind'),
        ab.if_(ab.exists(bound('b', { zone: 'bind' })), oppBottomsOwn()),
      ],
      text: text('G-CB04-005', 1),
    }),
  ],
  // Ergasia Idea-drone
  'G-CB04-015': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: colossusVanguard,
      effect: [ab.draw(1), ...bindFromHand],
      text: text('G-CB04-015', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['bind'],
      generationBreak: 1,
      trigger: boundFrom('drop'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.search('s', {}), ab.moveTo(bound('s'), 'bind'), ab.shuffle()],
      text: text('G-CB04-015', 1),
    }),
  ],
  // Slow Divider Dragon
  'G-CB04-016': [
    ab.seekMate({
      id: '1',
      names: ['Steam Knight, Puzur-Ili'],
      legionPower: 20000,
      text: text('G-CB04-016', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.counterBlast(1), ab.moveChosenCost(myHand(), 'soul')],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        chooseUpTo('c', bound('l')),
        ab.reveal(bound('c')),
        ab.toHand(bound('c')),
        ab.shuffle(),
        ...perGradeOf('c', (g) => youChooseOppBottom({ grade: { min: g, max: g } })),
      ],
      text: text('G-CB04-016', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.lookTop('t2', 2),
        ab.moveTo(bound('t2'), 'drop'),
        ...perGradeOf('t2', (g) => [
          ab.if_(ab.count(bound('t2', { grade: { min: g, max: g } }), { min: 2 }), [
            chooseUpTo('h', bound('t2')),
            ab.toHand(bound('h')),
          ]),
        ]),
      ],
      text: text('G-CB04-016', 2),
    }),
  ],
  // Unbounded Colossus
  'G-CB04-028': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.exists(ab.units('you', ['VC'], { attacking: true })),
      condition: ab.not({ cond: 'drive_trigger_this_turn' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: mayLeap({ excludeSelf: true }),
      text: text('G-CB04-028', 0),
    }),
  ],
  // ============================================================================ grade 2
  // Delayed Blazer Dragon
  'G-CB04-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: placedByLeap('other'),
      condition: chronojet,
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CB04-006', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: vanguardNamed('Chronojet', { grade: { min: 4, max: 4 } }),
      effect: mayLeap({ grade: { min: 2, max: 2 } }),
      text: text('G-CB04-006', 1),
    }),
  ],
  // Steam Tamer, Nanni
  'G-CB04-009': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(ab.yourTurn(), chronofang),
      effects: [ab.gets(ab.self(), 'power', 1000, bindZone())],
      text: text('G-CB04-009', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['bind'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.exists(
        ab.units('you', ['VC'], { attacking: true, grade: { min: 4 }, nameIncludes: 'Chronofang' }),
      ),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self())],
      text: text('G-CB04-009', 1),
    }),
  ],
  // Diaperno Idea-drone
  'G-CB04-010': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: colossusVanguard,
      cost: [ab.counterBlast(1), ab.topToCost(1, 'bind')],
      optional: true,
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'diaperno_hit',
            zones: ['RC'],
            trigger: ab.attackHits(),
            effect: [
              ab.search('s', {}, 2),
              ab.choose('b', bound('s'), 1, { prompt: 'Choose a card to bind face up' }),
              ab.moveTo(bound('b'), 'bind'),
              ab.moveTo(bound('s', { zone: 'deck' }), 'drop'),
              ab.shuffle(),
              ab.if_(ab.exists(bound('b', { zone: 'bind', race: ZTB })), ab.counterCharge(1)),
            ],
            text: part('G-CB04-010', "[AUTO](RC):When this unit's attack hits"),
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CB04-010', 0),
    }),
  ],
  // Extend Magne Dragon
  'G-CB04-017': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: oppRGsAtMost(1),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-CB04-017', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: oppIntoDeck(),
      condition: faceUpGNamed('Chronoscommand'),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CB04-017', 1),
    }),
  ],
  // Kaigomai Idea-drone
  'G-CB04-018': [
    ab.cont({
      id: '1',
      zones: ['RC', 'GC'],
      condition: bindAtLeast(5),
      effects: [ab.cannot(ab.self(), 'resist')],
      text: text('G-CB04-018', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.intercepts(),
      condition: ab.exists(ab.units('you', ['VC'], { race: COLOSSUS, beingAttacked: true })),
      effect: [
        ab.search('z', { race: ZTB }),
        ab.moveTo(bound('z'), 'bind'),
        ab.shuffle(),
        ab.if_(ab.exists(bound('z', { zone: 'bind' })), [
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
      ],
      text: text('G-CB04-018', 1),
    }),
  ],
  // Steam Knight, Puzur-Ili (reprint)
  'G-CB04-019': { sameAs: 'G-BT01-040' },
  // Steam Maiden, Shag-kusa
  'G-CB04-020': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: chronofang,
      cost: [ab.moveChosenCost(myRGs({ excludeSelf: true }), 'bind')],
      optional: true,
      effect: [
        ab.power(ab.self(), 3000),
        granted(
          ab.self(),
          ab.cont({
            id: 'shagkusa_boost',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'boost')],
            text: 'Boost',
          }),
        ),
      ],
      text: text('G-CB04-020', 0),
    }),
  ],
  // Everchanging Gear Peacock
  'G-CB04-029': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: oppIntoDeck(true),
      condition: chronoscommand,
      effect: mayLeap(),
      text: text('G-CB04-029', 0),
    }),
  ],
  // Steam Maiden, Limer
  'G-CB04-030': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardLegion,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: youChooseOppBottom({ grade: { min: 1 } }),
      text: text('G-CB04-030', 0),
    }),
  ],
  // Prompturret Dragon
  'G-CB04-031': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardLegion,
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'prompturret_hit',
            zones: ['RC'],
            trigger: ab.attackHits(),
            cost: [ab.counterBlast(1), ab.soulBlast(1)],
            optional: true,
            effect: [
              ab.lookTop('rv', 1),
              ab.reveal(bound('rv')),
              ...perGradeOf('rv', (g) => youChooseOppBottom({ grade: { min: g, max: g } })),
              ab.draw(1),
            ],
            text: part('G-CB04-031', '[AUTO](RC):[Counter-Blast 1 & Soul-Blast 1]'),
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CB04-031', 0),
    }),
  ],
  // Steam Soldier, Ur-zi
  'G-CB04-032': [
    ab.cont({
      id: '1',
      zones: ['RC', 'GC'],
      condition: ab.all(faceUpGNamed('Chronoscommand'), oppRGsAtMost(2)),
      effects: [ab.gets(ab.self(), 'power', 5000), ab.gets(ab.self(), 'shield', 5000)],
      text: text('G-CB04-032', 0),
    }),
  ],
  // Faceless Knight, Starda
  'G-CB04-033': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: bindAtLeast(2),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-CB04-033', 0),
    }),
    interceptGuard('G-CB04-033', 1),
  ],
  // ============================================================================ grade 1
  // Steam Maiden, Mesh-kia
  'G-CB04-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: placedByLeap('self'),
      cost: [ab.restCost()],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('t', myUnits({ excludeSelf: true }), 1),
        ab.power(bound('t'), 4000),
      ],
      text: text('G-CB04-011', 0),
    }),
  ],
  // Steam Keeper, La-ba'shim (Sentinel: card data)
  'G-CB04-012': [
    gPerfectGuard(text('G-CB04-012', 1)),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: placedByLeap('self'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-CB04-012', 2),
    }),
  ],
  // Causality Dragon
  'G-CB04-021': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: chronojet,
      effect: [
        ab.choose('t', myUnits(), 1),
        ab.power(bound('t'), 2000),
        granted(
          bound('t'),
          ab.auto({
            id: 'causality_leap',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            effect: mayLeap({ excludeSelf: true }),
            text: part('G-CB04-021', 'Time Leap-[AUTO](VC/RC)'),
          }),
        ),
      ],
      text: text('G-CB04-021', 0),
    }),
  ],
  // Steam Maiden, Lasina-bel
  'G-CB04-022': [
    ab.auto({
      id: '1',
      zones: ['bind'],
      generationBreak: 1,
      trigger: boundFrom('RC'),
      effect: youChooseOppBottom({ grade: { max: 1 } }, true),
      text: text('G-CB04-022', 0),
    }),
  ],
  // Tick-away Dragon
  'G-CB04-023': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: placedByLeap('other'),
      effect: [chooseUpTo('d', ab.cards('you', ['drop'])), ab.moveTo(bound('d'), 'deck_bottom')],
      text: text('G-CB04-023', 0),
    }),
  ],
  // Chanomai Idea-drone (Sentinel: card data; no guard ability of its own)
  'G-CB04-024': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      condition: colossusVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('top', 5),
        ab.callGuardians(bound('top')),
        ab.choose('two', bound('top', { zone: 'circle' }), 2, {
          prompt: 'Choose two of the guardians called with this effect',
        }),
        ab.may('Bind the two chosen guardians face up?', [
          ab.moveTo(bound('two'), 'bind'),
          ab.if_(ab.count(bound('two', { zone: 'bind' }), { min: 2 }), [
            ...ab.counterCharge(1),
            ab.shield(ab.self(), 5000, 'end_of_battle'),
          ]),
        ]),
      ],
      text: text('G-CB04-024', 1),
    }),
  ],
  // Steam Maiden, Ishme
  'G-CB04-025': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(chronoscommand, oppRGsAtMost(1)),
      effects: [ab.gets(ab.self(), 'power', 5000), ab.allow(ab.self(), 'attack_from_back_row')],
      text: text('G-CB04-025', 0),
    }),
  ],
  // Alithinos Idea-drone
  'G-CB04-034': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      ...afterBoosting({ race: COLOSSUS }),
      cost: [ab.moveChosenCost(bindZone(), 'drop'), ab.retireCost(ab.self())],
      optional: true,
      effect: [...bindTop, ...ab.counterCharge(1)],
      text: text('G-CB04-034', 0),
    }),
  ],
  // Steam Hunter, Emen-bara
  'G-CB04-035': [
    ab.act({
      id: '1',
      zones: ['bind'],
      generationBreak: 1,
      requires: chronofang,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.superiorCall(ab.self()),
        ab.if_(ab.exists(ab.units('opponent', ['RC'])), [
          ab.may(
            "Choose one of your opponent's rear-guards to return to the deck?",
            returnForOneGradeLess,
          ),
        ]),
      ],
      text: text('G-CB04-035', 0),
    }),
  ],
  // Steam Fighter, Agar
  'G-CB04-036': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 4),
        ab.reveal(bound('l')),
        chooseUpTo('c', bound('l', { abilityTextIncludes: '[Legion' })),
        ab.toHand(bound('c')),
        ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
      ],
      text: text('G-CB04-036', 0),
    }),
  ],
  // Steam Maiden, Muti
  'G-CB04-037': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ nameIncludes: 'Chronofang' }),
      cost: [ab.soulBlast(1), ab.moveChosenCost(bindZone(), 'drop')],
      optional: true,
      effect: [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')],
      text: text('G-CB04-037', 0),
    }),
  ],
  // Gear Owl Perching at Nightfall
  'G-CB04-038': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...afterBoosting({ isVanguard: true, nameIncludes: 'Chronoscommand' }),
      condition: ab.not(ab.exists(ab.cards('you', ['damage'], { faceUp: true }))),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [...ab.counterCharge(2), ab.if_(ab.count(myHand(), { max: 5 }), [ab.draw(1)])],
      text: text('G-CB04-038', 0),
    }),
  ],
  // Trumpeting Worker
  'G-CB04-039': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: oppIntoDeck(),
      condition: vanguardLegion,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1), ...ab.counterCharge(1), ab.soulCharge(1)],
      text: text('G-CB04-039', 0),
    }),
  ],
  // Progress Second Dragon: its [CONT] has no effect in the engine (UNRESOLVED_RULINGS)
  'G-CB04-040': [
    ab.cont({ id: '1', zones: ['RC'], effects: [], text: text('G-CB04-040', 0) }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: oppIntoDeck(true),
      condition: chronoscommand,
      effect: [ab.may('Time leap this unit?', [ab.timeLeap(ab.self())])],
      text: text('G-CB04-040', 1),
    }),
  ],
  // Voltaro Idea-drone
  'G-CB04-041': [
    ab.auto({
      id: '1',
      zones: ['bind'],
      trigger: boundFrom('RC'),
      condition: ab.all(colossusVanguard, bindAtLeast(4)),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ...ab.counterCharge(1),
        ab.if_(bindAtLeast(6), [
          ab.choose('b', bindZone(), 1),
          ab.toHand(bound('b')),
          ...bindFromHand,
        ]),
      ],
      text: text('G-CB04-041', 0),
    }),
  ],
  // Meow Meow Worker
  'G-CB04-042': [
    ab.auto({
      id: '1',
      zones: ['bind'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      condition: chronofang,
      cost: [ab.moveCost(ab.self(), 'drop')],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('dc', myHand(), 1, { prompt: 'Choose a card to discard' }),
        ab.moveTo(bound('dc'), 'drop'),
      ],
      text: text('G-CB04-042', 0),
    }),
  ],
  // Faceless Maiden, Iter
  'G-CB04-043': perBound('G-CB04-043', 0, ['GC'], 'shield', 5000, 4, colossusVanguard),
  // ============================================================================ grade 0
  // Night-barking Gear Tabby
  'G-CB04-013': [
    ab.auto({
      id: '1',
      zones: ['bind'],
      trigger: boundFrom('RC'),
      condition: chronofang,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1), ab.choose('v', myVanguard, 1), ab.power(bound('v'), 5000)],
      text: text('G-CB04-013', 0),
    }),
  ],
  // Chrono Tigar
  'G-CB04-026': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: oppIntoDeck(),
      condition: ab.all(ab.yourTurn(), chronofang, ab.exists(bindZone({ faceUp: true }))),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('c', bindZone({ faceUp: true }), 1),
        ab.superiorCall(bound('c')),
        ab.power(bound('c', { zone: 'circle' }), 4000),
      ],
      text: text('G-CB04-026', 1),
    }),
  ],
  // Anarchia Idea-drone
  'G-CB04-027': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [
        ab.moveChosenCost(ab.cards('you', ['drop'], { race: COLOSSUS }), 'deck_bottom'),
        ab.moveChosenCost(ab.cards('you', ['soul'], { race: COLOSSUS }), 'deck_bottom'),
        ab.moveCost(ab.self(), 'deck_bottom'),
      ],
      effect: [
        ab.shuffle(),
        ab.lookTop('l', 3),
        ab.choose('h', bound('l'), 1, { prompt: 'Choose a card to put into your hand' }),
        ab.toHand(bound('h')),
        ab.choose('so', bound('l', { zone: 'deck' }), 1, {
          prompt: 'Choose a card to put into your soul',
        }),
        ab.moveTo(bound('so'), 'soul'),
        ab.moveTo(bound('l', { zone: 'deck' }), 'bind'),
      ],
      text: text('G-CB04-027', 0),
    }),
  ],
};
