/**
 * G Trial Decks G-TD09 to G-TD15 (DECISIONS D-034). The official product pages list no quantities:
 * the counts come from Internet Archive copies of the Cardfight wiki (data/sources/
 * g-td09-15-wiki-lists.json: URL, capture time, retrieval time, SHA-256), and each adds up to its
 * official total. Reprints use the original's abilities (`sameAs`, below each object).
 *
 * New here: free strides (Dragheart, Luard; Tirua), grade modifiers (Steam Maiden, Imi), deck Brave
 * grade (Knight of Tomahawk), "the brave abilities of your cards are active" (Alectos), unlock
 * tracking and "cannot be locked" (G-TD15), "placed on (RC) other than from your hand" (Chrono Dran G).
 */
import td09 from '../../data/cards/G-TD09.json';
import td10 from '../../data/cards/G-TD10.json';
import td11 from '../../data/cards/G-TD11.json';
import td12 from '../../data/cards/G-TD12.json';
import td13 from '../../data/cards/G-TD13.json';
import td14 from '../../data/cards/G-TD14.json';
import td15 from '../../data/cards/G-TD15.json';
import {
  ab,
  type AbilityDefinition,
  type CardFilter,
  type Condition,
  type Cost,
  type Selector,
  type Step,
} from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { gbAttackVanguard, gPerfectGuard } from './G-TD01';
import { gbInterceptPlus10000 } from './G-TD06';
import { strideFodder } from './gShapes';

const RECORDS = [td09, td10, td11, td12, td13, td14, td15].flatMap((f) => (f as SetFile).cards);
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text;
  if (!t) throw new Error(`G-TD09-15: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-TD09-15: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-TD09-15: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"$/, '');
};
const bound = (as: string, filter?: CardFilter) => ab.bound(as, filter);
const units = ab.units('you', ['VC', 'RC']);
const myRGs = ab.units('you', ['RC']);
const opponentRGs = ab.units('opponent', ['RC']);
const otherRGs = ab.units('you', ['RC'], { excludeSelf: true });
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const strides = (filter?: CardFilter) => ({
  on: 'stride' as const,
  who: filter ? { owner: 'you' as const, filter } : { owner: 'you' as const },
});
const pump = (amount: number, filter: CardFilter = {}, upTo = false): Step[] => [
  ab.choose('p', ab.units('you', ['VC', 'RC'], filter), 1, upTo ? { upTo: true } : {}),
  ab.power(bound('p'), amount),
];
/** "[ACT](RC):[Put this unit into your soul] Choose (up to) one of your units, and it gets [Power] +3000 until end of turn." */
const soulPump = (id: string, filter: CardFilter = {}, upTo = false, line = 0): AbilityDefinition =>
  ab.act({
    id: String(line + 1),
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: pump(3000, filter, upTo),
    text: text(id, line),
  });
const placed = (
  id: string,
  textOrLine: string | number,
  circle: 'VC' | 'RC' | 'GC' | ('VC' | 'RC' | 'GC')[],
  cost: Cost[],
  effect: Step[],
  extra: {
    condition?: Condition;
    generationBreak?: number;
    from?: 'hand' | 'deck' | 'drop' | 'soul' | 'bind';
    abilityId?: string;
  } = {},
): AbilityDefinition => {
  const { from, abilityId, ...rest } = extra;
  return ab.auto({
    id: abilityId ?? (typeof textOrLine === 'number' ? String(textOrLine + 1) : 'placed'),
    zones: ['any'],
    trigger: from ? ab.placedOn(circle, 'self', from) : ab.placedOn(circle),
    ...(cost.length ? { cost, optional: true } : {}),
    ...rest,
    effect,
    text: typeof textOrLine === 'number' ? text(id, textOrLine) : textOrLine,
  });
};
const afterThisAttackedVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
const afterThisBoosted = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { boosting: true }),
};
const ritual = (n: number): Condition =>
  ab.count(ab.cards('you', ['drop'], { grade: { min: 1, max: 1 } }), { min: n });
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });
const vanguardNamed = (part_: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part_ }));
const handCount = ab.cards('you', ['hand']);
const atBattlePhase = ab.atStartOf('battle_phase');

// --- Gear Chronicle ------------------------------------------------------------------------------
const ZTB = 'Zodiac Time Beast';
/** "if there is a <Zodiac Time Beast> on your (VC) (Race of heart cards is included)" */
const ztbOnVC = (minGrade?: number): Condition =>
  minGrade === undefined
    ? ab.any(ab.exists(ab.units('you', ['VC'], { race: ZTB })), { cond: 'heart_race', race: ZTB })
    : ab.any(
        ab.exists(ab.units('you', ['VC'], { race: ZTB, grade: { min: minGrade } })),
        ab.all(
          { cond: 'heart_race', race: ZTB },
          ab.exists(ab.units('you', ['VC'], { grade: { min: minGrade } })),
        ),
      );

// --- Royal Paladin: brave ------------------------------------------------------------------------
/** Brave: three or less cards in hand, or Alectos made your brave abilities active this turn */
const brave: Condition = ab.any(ab.count(handCount, { max: 3 }), { cond: 'brave_active' });

// --- Neo Nectar: bloom ---------------------------------------------------------------------------
const bloomTrigger = ab.placedOn('RC', {
  owner: 'you',
  filter: { excludeSelf: true, sameNameAsSource: true },
});
const boostAbility = (id: string): AbilityDefinition =>
  ab.cont({ id, zones: ['RC'], effects: [ab.allow(ab.self(), 'boost')], text: 'Boost ([Boost])' });

// --- Nubatama: dominate --------------------------------------------------------------------------
const dominatedUnit = { owner: 'you' as const, filter: { dominated: true } };
const dominateOne = (from: Selector, attack: 'vanguard' | 'other_unit', upTo = true): Step[] => [
  ab.choose('dm', from, 1, upTo ? { upTo: true } : {}),
  { op: 'dominate_attack', target: bound('dm'), attack },
];

// --- Bermuda Triangle: Chouchou ------------------------------------------------------------------
const otherChouchouRG = ab.units('you', ['RC'], { nameIncludes: 'Chouchou', excludeSelf: true });
const chouchouToDeck = {
  on: 'put_into_deck' as const,
  who: { owner: 'you' as const, filter: { nameIncludes: 'Chouchou', excludeSelf: true } },
};
const chouchouToBottomCost: Cost = ab.moveChosenCost(otherChouchouRG, 'deck_bottom');

// --- Link Joker: lock ----------------------------------------------------------------------------
const lockedCards = ab.cards('any', ['locked']);
const messiahVanguard: Condition = ab.exists(ab.units('you', ['VC'], { race: 'Messiah' }));
const backRowRGs = ab.units('any', ['back_RC']);

export const G_TD09: SetAbilities = {
  // Metapulsar, Huang-long
  'G-TD09-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      ...afterThisAttackedVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('b', ab.cards('you', ['bind'], { faceUp: true, grade: { min: 1 } }), 1),
        ab.if_(ab.exists(bound('b')), [
          ab.may('Call that card to (RC)? (Otherwise it is put into your hand)', [
            ab.superiorCall(bound('b')),
          ]),
          ab.toHand(bound('b', { zone: 'bind' })),
        ]),
      ],
      text: part('G-TD09-001', '[AUTO](VC):[Counter-Blast 1]'),
    }),
  ],
  // Chronojet Dragon G: "for every two face up cards in your G zone"
  'G-TD09-002': [
    ...[2, 4, 6, 8, 10, 12, 14, 16].map((n) =>
      ab.cont({
        id: `1-${n}`,
        zones: ['VC'],
        condition: ab.all(
          ab.yourTurn(),
          ab.count(ab.cards('you', ['gzone'], { faceUp: true }), { min: n }),
        ),
        effects: [
          { ce: 'modify', target: ab.self(), stat: 'power', amount: 5000 },
          {
            ce: 'modify',
            target: ab.units('you', ['RC'], { race: ZTB }),
            stat: 'power',
            amount: 1000,
          },
        ],
        text: text('G-TD09-002', 0),
      }),
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: strides({ race: ['Gear Dragon', ZTB] }),
      triggerIf: ab.yourTurn(),
      effect: [
        ab.choose('h', handCount, 1, { upTo: true, prompt: 'Choose up to one card to call' }),
        ab.superiorCall(bound('h')),
        ab.choose('tl', myRGs, 1, {
          upTo: true,
          prompt: 'Choose up to one rear-guard to time leap',
        }),
        ab.timeLeap(bound('tl')),
      ],
      text: text('G-TD09-002', 1),
    }),
  ],
  // Chronofang Tiger G
  'G-TD09-003': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      ...afterThisAttackedVanguard,
      cost: [ab.soulBlast(1), ab.moveChosenCost(otherRGs, 'bind')],
      optional: true,
      effect: [
        ab.choose('o', ab.units('opponent', ['RC'], { sameColumnAsSource: true }), 1),
        ab.moveTo(bound('o'), 'deck_bottom'),
      ],
      text: text('G-TD09-003', 0),
    }),
  ],
  // Steam Maiden, Imi
  'G-TD09-004': [
    gbAttackVanguard(1, 4000, ['VC', 'RC'], text('G-TD09-004', 0)),
    placed(
      'G-TD09-004',
      1,
      'RC',
      [],
      [
        ab.may('Have this unit get grade -2 until end of turn?', [
          { op: 'modify', target: ab.self(), stat: 'grade', amount: -2, duration: 'end_of_turn' },
        ]),
      ],
    ),
  ],
  // Chronoclaw Monkey
  'G-TD09-006': [
    placed('G-TD09-006', 0, 'RC', [ab.counterBlast(1)], [ab.power(ab.self(), 5000)], {
      generationBreak: 1,
      condition: ztbOnVC(),
    }),
  ],
  // Chronobeat Buffalo
  'G-TD09-007': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ztbOnVC(3),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-TD09-007', 0),
    }),
  ],
  // Iron Fist Sanction Colossus
  'G-TD09-008': [gbInterceptPlus10000('shield', text('G-TD09-008', 0))],
  // Chronoethos Jackal
  'G-TD09-010': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ztbOnVC(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-TD09-010', 0),
    }),
  ],
  // Steam Sniper, Lishma
  'G-TD09-011': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is({ sel: 'role', role: 'boosted' }, { isVanguard: true }),
      ),
      cost: [ab.soulBlast(1), ab.discard(1)],
      optional: true,
      effect: [ab.timeLeap(ab.self())],
      text: text('G-TD09-011', 0),
    }),
    placed('G-TD09-011', 1, 'RC', [ab.counterBlast(1)], [ab.draw(1)], {
      generationBreak: 1,
      from: 'bind',
    }),
  ],
  // Chronocharge Unicorn
  'G-TD09-012': [
    placed(
      'G-TD09-012',
      0,
      'RC',
      [],
      [
        ab.choose('z', ab.units('you', ['VC', 'RC'], { race: ZTB, excludeSelf: true }), 1),
        ab.power(bound('z'), 3000),
      ],
    ),
  ],
  // Repel-circuit Dragon (Sentinel: card data)
  'G-TD09-013': [gPerfectGuard(text('G-TD09-013', 1))],
  // Chrono Dran G
  'G-TD09-014': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: {
        on: 'placed',
        who: { owner: 'you', filter: { excludeSelf: true } },
        circle: 'RC',
        notFrom: 'hand',
      },
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ...[0, 1, 2, 3].map((g) =>
          ab.if_(ab.is({ sel: 'event_card' }, { grade: { min: g, max: g } }), [
            ab.search('s', { race: ZTB, grade: { min: g, max: g } }),
          ]),
        ),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
      ],
      text: text('G-TD09-014', 1),
    }),
  ],
  // Chronotherapy Hamster: only the deck-limit reminder
  'G-TD09-018': [],
};
(G_TD09 as Record<string, unknown>)['G-TD09-019'] = { sameAs: 'G-TD01-019' };

export const G_TD10: SetAbilities = {
  // Dark Dragon, Carnivore Dragon
  'G-TD10-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.retireCost(myRGs)],
      effect: [
        ab.if_(
          ab.count(opponentRGs, { min: 2 }),
          [
            ab.choose('or', opponentRGs, 2, {
              chooser: 'opponent',
              prompt: 'Choose two of your rear-guards to retire',
            }),
            ab.retire(bound('or')),
          ],
          [
            ab.retire(opponentRGs),
            ab.choose('f', ab.units('you', ['VC', 'front_RC']), 3, { upTo: true }),
            ab.power(bound('f'), 4000),
          ],
        ),
      ],
      text: part('G-TD10-001', '[ACT](VC)[1/turn]'),
    }),
  ],
  // Crest-vicious Dragon
  'G-TD10-002': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ritual(3), ab.exists({ sel: 'role', role: 'booster' })),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-TD10-002', 0),
    }),
  ],
  // Dragheart, Luard
  'G-TD10-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase'),
      condition: ritual(3),
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' }),
          'deck_bottom',
          2,
        ),
      ],
      optional: true,
      effect: [{ op: 'free_stride' }],
      text: text('G-TD10-003', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1), ab.retireCost(myRGs)],
      optional: true,
      effect: [
        ab.search('s', { grade: { max: 1 } }, 2),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.shuffle(),
      ],
      text: text('G-TD10-003', 1),
    }),
  ],
  // Blue Thorn Heavy-slash, Valdemar
  'G-TD10-004': [
    gbAttackVanguard(1, 4000, ['VC', 'RC'], text('G-TD10-004', 0)),
    ab.act({
      id: '2',
      zones: ['VC', 'RC'],
      requires: ritual(3),
      cost: [ab.retireCost(myRGs)],
      effect: [ab.power(ab.self(), 4000)],
      text: text('G-TD10-004', 1),
    }),
  ],
  // Direct Owlner, Debihira
  'G-TD10-006': [
    placed('G-TD10-006', 0, 'RC', [ab.discard(1)], [ab.draw(1)], {
      condition: ab.compare(myRGs, '>=', opponentRGs),
    }),
  ],
  // Dragwizard, Liafail
  'G-TD10-007': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [
        ab.soulBlast(1),
        ab.retireCost(ab.units('you', ['RC'], { excludeSelf: true, sameColumnAsSource: true })),
      ],
      effect: [ab.draw(1)],
      text: text('G-TD10-007', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ritual(3),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-TD10-007', 1),
    }),
  ],
  // Blade-proof Knight, Youghal
  'G-TD10-008': [gbInterceptPlus10000('shield', text('G-TD10-008', 0))],
  // Dragwizard, Knies
  'G-TD10-009': [
    placed('G-TD10-009', 0, 'RC', [], [ab.power(ab.self(), 2000)], {
      from: 'deck',
      condition: ritual(3),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      ...afterThisBoosted,
      cost: [
        ab.counterBlast(1),
        ab.retireCost(ab.units('you', ['RC'], { excludeSelf: true, sameColumnAsSource: true })),
      ],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-TD10-009', 1),
    }),
  ],
  // Killermyu
  'G-TD10-010': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      effect: [
        ab.may('The boosted unit gets [Power] +4000 (retire this unit at the end of the battle)?', [
          ab.power({ sel: 'role', role: 'boosted' }, 4000, 'end_of_battle'),
          ab.atNextOn(
            ab.self(),
            'close_step',
            [ab.retire(ab.self())],
            'end_of_battle',
            'At the end of that battle, retire this unit.',
          ),
        ]),
      ],
      text: text('G-TD10-010', 0),
    }),
  ],
  // Puzzled Owlner, Clothru
  'G-TD10-011': [
    placed('G-TD10-011', 0, 'RC', [], pump(3000, { excludeSelf: true }), { condition: ritual(3) }),
  ],
  // Demon World Castle, Vorbeugen (Sentinel: card data)
  'G-TD10-012': [gPerfectGuard(text('G-TD10-012', 1))],
  // Dragprince, Rute
  'G-TD10-013': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'put_into_drop', who: 'self', from: 'RC', byYourEffect: true },
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: pump(5000),
      text: text('G-TD10-013', 1),
    }),
  ],
  // Abyss Grail: only the deck-limit reminder
  'G-TD10-017': [],
  // Howl Owl
  'G-TD10-018': [soulPump('G-TD10-018', {}, true)],
};

export const G_TD11: SetAbilities = {
  // Divine Knight of Lore, Selfes
  'G-TD11-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('bf', handCount, 60, {
          upTo: true,
          prompt: 'Choose any number of cards from your hand to bind face down',
        }),
        ...ab.bindFaceDown(bound('bf')),
        ab.choose('r', myRGs, 1),
        ab.power(bound('r'), 5000),
        ab.atNextOn(
          bound('bf', { zone: 'bind' }),
          'end_phase',
          [ab.toHand(ab.self())],
          'end_of_turn',
          'At the end of that turn, put this card into your hand.',
        ),
      ],
      text: part('G-TD11-001', '[AUTO](VC):[Soul-Blast 1]'),
    }),
  ],
  // Conspicuous Knight, Concianus
  'G-TD11-002': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      condition: brave,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-TD11-002', 0),
    }),
  ],
  // Devout Falx Dragon
  'G-TD11-004': [otherGrade2Placed('G-TD11-004')],
  // Flying Swallow Knight, Claus
  'G-TD11-006': [
    placed(
      'G-TD11-006',
      0,
      'RC',
      [],
      [...pump(2000, { excludeSelf: true }), ab.power(ab.self(), 2000)],
      { generationBreak: 1, condition: vanguardNamed('Altmile') },
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: brave,
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: text('G-TD11-006', 1),
    }),
  ],
  // Knight of Honesty, Carausius
  'G-TD11-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('s', { grade: { min: 2, max: 2 } }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('s', { zone: 'circle', ...withAbility('Brave') })), [
          ab.power(bound('s', { zone: 'circle' }), 3000),
        ]),
      ],
      text: text('G-TD11-007', 0),
    }),
  ],
  // Knight of Resilience, Baldus
  'G-TD11-008': [gbInterceptPlus10000('shield', text('G-TD11-008', 0))],
  // Knight of Respect, Diotius
  'G-TD11-009': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: withAbility('Brave') }),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.search('s', withAbility('Brave')), ab.superiorCall(bound('s')), ab.shuffle()],
      text: text('G-TD11-009', 0),
    }),
  ],
  // Support Sorcerer of Damascus
  'G-TD11-010': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      condition: brave,
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.draw(1), ...ab.counterCharge(2)],
      text: text('G-TD11-010', 0),
    }),
  ],
  // Knight of Tomahawk
  'G-TD11-011': [
    placed('G-TD11-011', 0, 'RC', [], [ab.power(ab.self(), 2000)], { generationBreak: 1 }),
    ab.cont({
      id: '2',
      zones: ['any'],
      effects: [{ ce: 'deck_grade', amount: 1, vanguardNameIncludes: '', brave: true }],
      text: text('G-TD11-011', 1),
    }),
  ],
  // Walgal (Sentinel: card data)
  'G-TD11-012': [gPerfectGuard(text('G-TD11-012', 1))],
  // Knight of Discipline, Alectos
  'G-TD11-013': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('battle_phase', 'any'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1), { op: 'brave_active' }],
      text: text('G-TD11-013', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      requires: brave,
      cost: [ab.restCost()],
      effect: pump(3000),
      text: text('G-TD11-013', 2),
    }),
  ],
  // Knight of Pretty Sword: only the deck-limit reminder
  'G-TD11-017': [],
  // Gliding Eagle
  'G-TD11-018': [soulPump('G-TD11-018')],
};
(G_TD11 as Record<string, unknown>)['G-TD11-003'] = { sameAs: 'G-TD02-002' };

export const G_TD12: SetAbilities = {
  // Flower Princess of Faith, Celine
  'G-TD12-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('h', handCount, 1, { upTo: true }),
        ab.superiorCall(bound('h')),
        ab.power(bound('h', { zone: 'circle' }), 5000),
        ab.if_(ab.exists(bound('h', { zone: 'circle', ...withAbility('Bloom') })), [
          ...ab.counterCharge(1),
          ab.soulCharge(1),
        ]),
      ],
      text: part('G-TD12-001', '[AUTO]:[Counter-Blast 1]'),
    }),
  ],
  // Abundant Flower Maiden, Patricia
  'G-TD12-002': [
    ab.auto({
      id: 'bloom',
      zones: ['VC', 'RC'],
      trigger: bloomTrigger,
      effect: [ab.power(ab.self(), 6000)],
      text: text('G-TD12-002', 0),
    }),
  ],
  // Floraneura Dragon
  'G-TD12-004': [otherGrade2Placed('G-TD12-004')],
  // Osmanthus Maiden, Anelma
  'G-TD12-006': [
    ab.auto({
      id: 'bloom',
      zones: ['RC'],
      generationBreak: 1,
      trigger: bloomTrigger,
      effect: [
        ab.choose('t', units, 3, { upTo: true }),
        ab.power(bound('t'), 2000),
        ab.if_(vanguardNamed('Ranunculus'), [granted(ab.self(), boostAbility('anelma_boost'))]),
      ],
      text: text('G-TD12-006', 0),
    }),
  ],
  // Irrigating Maiden, Ramona: its granted [AUTO] is its own, with the same condition
  ...(() => {
    const cond = ab.all(
      ab.yourTurn(),
      ab.count(ab.units('you', ['VC', 'RC'], { excludeSelf: true, ...withAbility('Bloom') }), {
        min: 2,
      }),
    );
    return {
      'G-TD12-007': [
        ab.cont({
          id: '1',
          zones: ['RC'],
          condition: cond,
          effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
          text: text('G-TD12-007', 0),
        }),
        ab.auto({
          id: '2',
          zones: ['RC'],
          generationBreak: 1,
          trigger: ab.attackHits('vanguard'),
          condition: cond,
          cost: [ab.counterBlast(1)],
          optional: true,
          effect: [
            ab.lookTop('l', 5),
            ab.choose('b', bound('l', withAbility('Bloom')), 1, { upTo: true }),
            ab.reveal(bound('b')),
            ab.toHand(bound('b')),
            ab.shuffle(),
          ],
          text: text('G-TD12-007', 0),
        }),
      ],
    };
  })(),
  // Monstera Knight
  'G-TD12-008': [gbInterceptPlus10000('shield', text('G-TD12-008', 0))],
  // Ravishing Maiden, Penelope
  'G-TD12-009': [
    ab.auto({
      id: 'bloom',
      zones: ['RC'],
      trigger: bloomTrigger,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', myRGs, 3, { upTo: true }),
        ab.power(bound('t'), 2000),
        granted(
          bound('t'),
          ab.auto({
            id: 'penelope_boost',
            zones: ['RC'],
            generationBreak: 1,
            trigger: ab.boosts(withAbility('Bloom')),
            effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
            text: '[AUTO](RC)[Generation Break 1]:When this unit boosts ([Boost]) a unit with the bloom ability, this unit gets [Power] +2000 until end of that battle.',
          }),
        ),
      ],
      text: text('G-TD12-009', 0),
    }),
  ],
  // Crested Ibis Color Valkyrie, Nelly
  'G-TD12-010': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [
        {
          ce: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 1000,
          per: ab.units('you', ['RC'], {
            name: 'Crested Ibis Color Valkyrie, Nelly',
            excludeSelf: true,
          }),
        },
      ],
      text: text('G-TD12-010', 0),
    }),
  ],
  // Pis Tateo (Sentinel: card data)
  'G-TD12-011': [gPerfectGuard(text('G-TD12-011', 1))],
  // Maple Leaf Squire
  'G-TD12-012': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      effect: [ab.power({ sel: 'role', role: 'boosted' }, 3000, 'end_of_battle')],
      text: text('G-TD12-012', 0),
    }),
  ],
  // Augury Maiden, Ida
  'G-TD12-013': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('d', ab.cards('you', ['drop']), 1),
        ab.moveTo(bound('d'), 'deck_bottom'),
        ab.if_(ab.exists(bound('d', withAbility('Bloom'))), [ab.draw(1)]),
      ],
      text: text('G-TD12-013', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.choose('x', units, 1, { prompt: 'Choose the first unit' }),
        ab.choose('y', ab.units('you', ['VC', 'RC'], { notBound: 'x' }), 1, {
          prompt: 'Choose the second unit',
        }),
        { op: 'also_named_as', target: bound('x'), of: bound('y') },
        { op: 'also_named_as', target: bound('y'), of: bound('x') },
      ],
      text: text('G-TD12-013', 2),
    }),
  ],
  // Color Pixy, Quitterie: only the deck-limit reminder
  'G-TD12-017': [],
  // Monkeypod Dragon
  'G-TD12-018': [soulPump('G-TD12-018')],
};
(G_TD12 as Record<string, unknown>)['G-TD12-003'] = { sameAs: 'G-TD03-002' };

export const G_TD13: SetAbilities = {
  // Enma Stealth Dragon, Kingoku Tenbu
  'G-TD13-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: atBattlePhase,
      triggerIf: ab.yourTurn(),
      effect: dominateOne(opponentRGs, 'other_unit'),
      text: part('G-TD13-001', 'Dominate-'),
    }),
  ],
  // Secret Message Stealth Hermit, Abudataishi ([G Guardian]: card data)
  'G-TD13-002': [
    placed(
      'G-TD13-002',
      part('G-TD13-002', '[AUTO]:'),
      'GC',
      [],
      [ab.shield(ab.self(), 5000, 'end_of_battle')],
      { condition: ab.compare(handCount, '<=', ab.cards('opponent', ['hand'])) },
    ),
  ],
  // Demon Stealth Rogue, Genba
  'G-TD13-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: atBattlePhase,
      triggerIf: ab.yourTurn(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: dominateOne(ab.units('opponent', ['front_RC']), 'other_unit', false),
      text: text('G-TD13-003', 0),
    }),
  ],
  // Demon Stealth Dragon, Jaken Myouou
  'G-TD13-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.placedOn('VC'),
      triggerIf: ab.yourTurn(),
      effect: dominateOne(opponentRGs, 'vanguard'),
      text: text('G-TD13-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacks(
        { owner: 'any', filter: { excludeSelf: true, isVanguard: false } },
        'vanguard',
      ),
      triggerIf: ab.yourTurn(),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-TD13-004', 1),
    }),
  ],
  // Demon Stealth Dragon, Shiranui "Oboro"
  'G-TD13-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase'),
      effect: [
        ab.choose('c', ab.cards('opponent', ['drop'], { gUnit: false }), 1, { upTo: true }),
        ab.asOpponent([ab.superiorCall(bound('c'))]),
        ab.if_(ab.exists(bound('c', { zone: 'circle' })), [
          ab.atNextOn(
            bound('c', { zone: 'circle' }),
            'end_phase',
            [ab.retire(ab.self())],
            'end_of_turn',
            'At the end of that turn, retire this unit.',
          ),
        ]),
      ],
      text: text('G-TD13-005', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: strides(),
      effect: [
        ab.choose('dm', opponentRGs, 1, { upTo: true }),
        ab.power(bound('dm'), 4000),
        { op: 'dominate_attack', target: bound('dm'), attack: 'other_unit' },
      ],
      text: text('G-TD13-005', 1),
    }),
  ],
  // Stealth Dragon, Genkai
  'G-TD13-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(dominatedUnit),
      triggerIf: ab.yourTurn(),
      condition: vanguardNamed('Shiranui'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1), ab.power(ab.self(), 2000)],
      text: text('G-TD13-007', 0),
    }),
  ],
  // Stealth Rogue of Departed Soul, Toranaga
  'G-TD13-008': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.soulBlast(1)],
      effect: [ab.power(ab.self(), 1000)],
      text: text('G-TD13-008', 0),
    }),
  ],
  // Stealth Beast, Kabe Itachi
  'G-TD13-009': [gbInterceptPlus10000('shield', text('G-TD13-009', 0))],
  // Stealth Dragon, Seizui
  'G-TD13-011': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(dominatedUnit),
      triggerIf: ab.yourTurn(),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-TD13-011', 0),
    }),
  ],
  // Stealth Beast, Katarigitsune
  'G-TD13-012': strideFodder('Shiranui', text('G-TD13-012', 0), text('G-TD13-012', 1)),
  // Isolation Stealth Rogue, Matsuba (Sentinel: card data)
  'G-TD13-013': [gPerfectGuard(text('G-TD13-013', 1))],
  // Stealth Dragon, Madoi
  'G-TD13-014': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(dominatedUnit),
      triggerIf: ab.yourTurn(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('a', ab.units('any', ['RC']), 1, { upTo: true }),
        ab.power(bound('a'), 3000),
      ],
      text: text('G-TD13-014', 1),
    }),
  ],
  // Voracious Stealth Rogue, Kosode: only the deck-limit reminder
  'G-TD13-017': [],
  // Almsgiving Stealth Rogue, Jirokichi
  'G-TD13-018': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('a', ab.units('any', ['RC']), 1), ab.power(bound('a'), 3000)],
      text: text('G-TD13-018', 0),
    }),
  ],
};

export const G_TD14: SetAbilities = {
  // Chouchou, Lillinel
  'G-TD14-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.choose('r', myRGs, 1, { upTo: true }),
        ab.if_(ab.exists(bound('r')), [
          ab.may(
            'Put that unit on the bottom of your deck (draw two cards)? Otherwise it returns to your hand',
            [ab.moveTo(bound('r'), 'deck_bottom'), ab.draw(2)],
          ),
          ab.toHand(bound('r', { zone: 'circle' })),
        ]),
      ],
      text: part('G-TD14-001', '[AUTO](VC):'),
    }),
  ],
  // Chouchou, Palffy ([G Guardian]: card data)
  'G-TD14-002': [
    placed(
      'G-TD14-002',
      part('G-TD14-002', '[AUTO]:'),
      'GC',
      [],
      [ab.shield(ab.self(), 5000, 'end_of_battle')],
      { condition: ab.count(handCount, { min: 3 }) },
    ),
  ],
  // Chouchou Debut Stage, Tirua
  'G-TD14-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: strides(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('t', 1),
        ab.reveal(bound('t')),
        ab.toHand(bound('t')),
        ab.if_(ab.exists(bound('t', { nameIncludes: 'Chouchou' })), [
          ab.choose('r', myRGs, 1, { upTo: true }),
          ab.moveTo(bound('r'), 'deck_bottom'),
          ab.if_(ab.exists(bound('r', { zone: 'deck' })), [ab.draw(1)]),
        ]),
      ],
      text: text('G-TD14-003', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 1,
      effects: [{ ce: 'free_stride', maxRearGuards: 1 }],
      text: text('G-TD14-003', 1),
    }),
  ],
  // Chouchou, Pierine
  'G-TD14-004': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [chouchouToBottomCost],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-TD14-004', 0),
    }),
  ],
  // Chouchou, Piorina
  'G-TD14-005': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: chouchouToDeck,
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-TD14-005', 0),
    }),
  ],
  // Chouchou, Ayana
  'G-TD14-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: chouchouToDeck,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('c', ab.cards('you', ['hand'], { nameIncludes: 'Chouchou' }), 1, { upTo: true }),
        ab.superiorCall(bound('c')),
        ab.power(bound('c', { zone: 'circle' }), 3000),
      ],
      text: text('G-TD14-007', 0),
    }),
  ],
  // Chouchou, Listella
  'G-TD14-008': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(1), chouchouToBottomCost],
      optional: true,
      effect: [ab.draw(1), ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-TD14-008', 0),
    }),
  ],
  // Chouchou, Milda
  'G-TD14-009': [
    ab.cont({
      id: '1',
      zones: ['RC', 'GC'],
      condition: ab.count(otherRGs, { max: 1 }),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 },
        { ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 },
      ],
      text: text('G-TD14-009', 0),
    }),
  ],
  // Chouchou, Clenes: the discard is chosen one card at a time until the grades reach 3
  'G-TD14-011': [
    placed(
      'G-TD14-011',
      0,
      'RC',
      [],
      [
        ab.lookTop('l', 7),
        ab.choose('t', bound('l', { nameIncludes: 'Tirua' }), 1, { upTo: true }),
        ab.reveal(bound('t')),
        ab.toHand(bound('t')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('t', { zone: 'hand' })), [
          ...[1, 2, 3].map((k) =>
            ab.if_({ cond: 'grade_sum', of: bound('dc', { zone: 'drop' }), range: { max: 2 } }, [
              ab.choose('dc', handCount, 1, {
                append: true,
                prompt: `Discard cards with grades totalling 3 or more (card ${k})`,
              }),
              ab.moveTo(bound('dc', { zone: 'hand' }), 'drop'),
            ]),
          ),
        ]),
      ],
      { from: 'hand' },
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: vanguardNamed('Tirua'),
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [...ab.counterCharge(1)],
      text: text('G-TD14-011', 1),
    }),
  ],
  // Chouchou, Marl
  'G-TD14-012': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is({ sel: 'role', role: 'boosted' }, { isVanguard: true, nameIncludes: 'Chouchou' }),
      ),
      cost: [ab.counterBlast(1), chouchouToBottomCost],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('c', handCount, 1, { upTo: true }),
        ab.superiorCall(bound('c')),
      ],
      text: text('G-TD14-012', 0),
    }),
  ],
  // Chouchou, Corrin (Sentinel: card data)
  'G-TD14-013': [gPerfectGuard(text('G-TD14-013', 1))],
  // Chouchou, Resaca
  'G-TD14-014': [
    placed('G-TD14-014', 0, 'RC', [], pump(3000, { nameIncludes: 'Chouchou', excludeSelf: true })),
  ],
  // Chouchou, Sasha
  'G-TD14-015': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: chouchouToDeck,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'hand')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-TD14-015', 1),
    }),
  ],
  // Chouchou, Richell: only the deck-limit reminder
  'G-TD14-018': [],
  // Chouchou, Pitte
  'G-TD14-019': [soulPump('G-TD14-019')],
};

export const G_TD15: SetAbilities = {
  // Genesis Dragon, Bearing Messiah
  'G-TD15-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('l', backRowRGs, 1),
        ab.lock(bound('l')),
        ab.choose('u', lockedCards, 1),
        ab.unlock(bound('u')),
      ],
      text: part('G-TD15-001', '[AUTO](VC):'),
    }),
  ],
  // Light that Seals the Tear, Lady Healer ([G Guardian]: card data)
  'G-TD15-002': [
    placed(
      'G-TD15-002',
      part('G-TD15-002', '[AUTO]:'),
      'GC',
      [ab.soulBlast(1)],
      [
        ab.shield(ab.self(), 5000, 'end_of_battle'),
        ab.if_(messiahVanguard, [ab.shield(ab.self(), 5000, 'end_of_battle')]),
      ],
      { condition: ab.exists(lockedCards) },
    ),
  ],
  // Alter Ego Neo Messiah
  'G-TD15-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: strides({ race: 'Messiah' }),
      effect: [
        ab.choose('h', handCount, 1, { upTo: true }),
        ab.superiorCall(bound('h')),
        ab.choose('m', myRGs, 1, {
          upTo: true,
          prompt: 'Choose up to one of your rear-guards to lock',
        }),
        ab.choose('o', opponentRGs, 1, {
          upTo: true,
          prompt: "Choose up to one of your opponent's rear-guards to lock",
        }),
        ab.lock(bound('m')),
        ab.lock(bound('o')),
      ],
      text: text('G-TD15-003', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.atStartOf('end_phase'),
      condition: { cond: 'unlocked_by_your_effect' },
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(2)],
      text: text('G-TD15-003', 1),
    }),
  ],
  // Restrain Dragon
  'G-TD15-005': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: { on: 'unlocked', who: { owner: 'any' } },
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.lock({ sel: 'event_card' })],
      text: text('G-TD15-005', 0),
    }),
    gbAttackVanguard(1, 4000, ['VC', 'RC'], text('G-TD15-005', 1), '2'),
  ],
  // Metallia Messiah
  'G-TD15-008': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [ab.cannot(ab.self(), 'cannot_be_locked')],
      text: text('G-TD15-008', 0),
    }),
    ...(['locked', 'unlocked'] as const).map((on) =>
      ab.auto({
        id: `2-${on}`,
        zones: ['RC'],
        generationBreak: 1,
        trigger: { on, who: { owner: 'any', filter: { excludeSelf: true } } },
        effect: [ab.power(ab.self(), 3000)],
        text: text('G-TD15-008', 1),
      }),
    ),
  ],
  // Great Wall
  'G-TD15-009': [
    ab.auto({
      id: '1',
      zones: ['GC'],
      trigger: ab.intercepts(),
      condition: ab.exists(lockedCards),
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-TD15-009', 0),
    }),
  ],
  // Dunamis Messiah
  'G-TD15-011': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...afterThisBoosted,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('u', lockedCards, 1, { upTo: true }),
        ab.unlock(bound('u')),
        ab.lock(ab.self()),
        ...pump(4000),
      ],
      text: text('G-TD15-011', 0),
    }),
  ],
  // Allbirth Pangolin (Sentinel: card data)
  'G-TD15-012': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('pg', units, 1),
        ab.restrict(bound('pg'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: text('G-TD15-012', 1),
    }),
  ],
  // Multiple Star of Binding, Cluster Mine
  'G-TD15-013': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard', { owner: 'you' }),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('m', myRGs, 1, { prompt: 'Choose one of your rear-guards to lock' }),
        ab.lock(bound('m')),
        ab.asOpponent([
          ab.choose('o', ab.units('you', ['RC']), 1, {
            prompt: 'Choose one of your rear-guards to lock',
          }),
          ab.lock(bound('o')),
        ]),
      ],
      text: text('G-TD15-013', 0),
    }),
  ],
  // Neon Messiah Aurion
  'G-TD15-014': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: { on: 'unlocked', who: 'self' },
      triggerIf: ab.yourTurn(),
      condition: messiahVanguard,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1), ...pump(5000)],
      text: text('G-TD15-014', 1),
    }),
  ],
  // Mourning Child of Reaction: only the deck-limit reminder
  'G-TD15-017': [],
};
(G_TD15 as Record<string, unknown>)['G-TD15-004'] = { sameAs: 'G-TD05-002' };
(G_TD15 as Record<string, unknown>)['G-TD15-007'] = { sameAs: 'G-BT05-016' };
(G_TD15 as Record<string, unknown>)['G-TD15-010'] = { sameAs: 'G-BT03-038' };
(G_TD15 as Record<string, unknown>)['G-TD15-018'] = { sameAs: 'G-TD05-019' };

/** "[AUTO](VC/RC)[Generation Break 1]:When your other grade 2 or greater unit is placed on (RC), this unit gets [Power] +3000 until end of turn." */
function otherGrade2Placed(id: string): AbilityDefinition {
  return ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    generationBreak: 1,
    trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true, grade: { min: 2 } } }),
    effect: [ab.power(ab.self(), 3000)],
    text: text(id, 0),
  });
}
