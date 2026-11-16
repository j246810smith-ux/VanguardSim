/**
 * G-CB06 "Rondeau of Chaos & Salvation" (G Clan Booster 6, DECISIONS D-034): Link Joker
 * "Star-vader" lock, "Messiah" unlock and "Deletor" delete. G units stride by the rules; only their
 * other abilities are scripted here. English from Internet Archive copies of the official pages
 * and the card wiki (scripts/cards/wiki-english.json); G-CB06-031 from
 * data/translations/unofficial.json. The official English text drops the «Messiah» race icon
 * ("if your vanguard is a ,"): read as a <Messiah> vanguard / heart card.
 */
import data from '../../data/cards/G-CB06.json';
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
import { faceUpGCards, gFaceUp, gFaceUpAny, noGuardsFromHand, resist } from './gShapes';
import { gPerfectGuard } from './G-TD01';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CB06: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CB06: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-CB06: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?$/, '');
};
const nameOf = (id: string): string => {
  const name = RECORDS.find((c) => c.id === id)?.en?.name;
  if (name === undefined) throw new Error(`G-CB06: no name for ${id}`);
  return name;
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
const MESSIAH: CardFilter = { race: 'Messiah' };
const messiahVanguard: Condition = ab.exists(ab.units('you', ['VC'], MESSIAH));
const messiahHeart: Condition = { cond: 'heart_race', race: 'Messiah' };
const oppLocked = ab.cards('opponent', ['locked']);
const anyLocked = ab.cards('any', ['locked']);
const oppHasLocked = (n = 1): Condition => ab.count(oppLocked, { min: n });
const oppDeleted: Condition = ab.exists(ab.units('opponent', ['VC'], { deleted: true }));

// --- selectors and effect pieces -----------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const STAR: CardFilter = { nameIncludes: 'Star-vader' };
const DELETOR: CardFilter = { nameIncludes: 'Deletor' };
const REVERSE: CardFilter = { nameIncludes: 'Я' };
const CHAOS: CardFilter = { nameIncludes: 'Chaos' };
/** "your opponent chooses one of his or her rear-guards, and locks it" (as `l`) */
const oppLocksOne: Step[] = [
  ab.choose('l', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
  ab.lock(bound('l')),
];
/** "choose one of your opponent's rear-guards, and lock it" */
const lockOne: Step[] = [ab.choose('l', ab.units('opponent', ['RC']), 1), ab.lock(bound('l'))];
/** "choose one of your opponent's locked cards, and that card cannot be unlocked during his or her next end phase" */
const keepLocked = (from: Selector = oppLocked): Step[] => [
  ab.choose('k', from, 1),
  ab.restrict(bound('k'), 'cannot_unlock', 'next_end_phase'),
];
/** "look at n cards from the top of your deck, reveal up to m <filter>, put into your hand, shuffle" */
const lookReveal = (n: number, filter: CardFilter, m = 1): Step[] => [
  ab.lookTop('l', n),
  ab.choose('f', bound('l', filter), m, { upTo: true }),
  ab.reveal(bound('f')),
  ab.toHand(bound('f')),
  ab.shuffle(),
];
/** "choose one of your units (with X), and it cannot be hit until end of that battle" */
const guardUnit = (id: string, line: number, filter: CardFilter, extra: Step[] = []) => {
  const pg = gPerfectGuard(text(id, line));
  return {
    ...pg,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true, ...filter }), 1),
      ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ...extra,
    ],
  } as AbilityDefinition;
};
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
/** "When this unit is retired from (RC) for the effect or cost of your card" */
const retiredByYou = ab.putIntoDropFrom('RC', 'self', true);
/** "[CONT](Hand):… while you are paying the cost of a G unit with X for [Stride], this unit may be discarded as a grade 3." */
const strideAsGrade3 = (id: string, vanguard: string): AbilityDefinition =>
  ab.cont({
    id: '1',
    zones: ['hand'],
    effects: [{ ce: 'stride_grade', amount: 2, vanguardNameIncludes: vanguard }],
    text: text(id, 0),
  });
const strideDiscarded = { on: 'stride_discarded' as const, who: 'self' as const };

export const G_CB06: SetAbilities = {
  // ============================================================================ G units
  // Genesis Dragon, Harmonics Neo Messiah
  'G-CB06-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 3,
      trigger: ab.attacks(),
      condition: messiahHeart,
      cost: [gFaceUpAny()],
      optional: true,
      effect: [
        ab.choose('u', anyLocked, 10, { upTo: true, prompt: 'Unlock all locked cards' }),
        ab.choose('u', ab.cards('any', ['locked'], { notBound: 'u' }), 10, {
          upTo: true,
          append: true,
        }),
        ab.unlock(bound('u')),
        ab.power(bound('u', { mine: true, zone: 'circle' }), 5000),
        ab.power(ab.self(), 5000, 'end_of_turn', bound('u', { zone: 'circle' })),
        ab.if_(ab.count(bound('u', { zone: 'circle' }), { min: 5 }), [
          noGuardsFromHand(1, part('G-CB06-001', 'your opponent cannot call')),
        ]),
      ],
      text: text('G-CB06-001', 1),
    }),
  ],
  // Death Star-vader, Chaos Breaker Deluge: the damage zone card is put there face up (UNRESOLVED_RULINGS)
  'G-CB06-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 3,
      cost: [ab.soulBlast(1), gFaceUpAny(), ab.discard(1)],
      effect: [
        ab.if_(heart('Chaos'), [
          ab.asOpponent([
            ab.choose('h', ab.cards('you', ['hand']), 2, {
              prompt: 'Choose two cards from your hand to put on separate (RC) as locked cards',
            }),
            ab.superiorCall(bound('h'), { separate: true }),
            ab.lock(bound('h', { zone: 'circle' })),
          ]),
          ab.if_(ab.count(ab.cards('opponent', ['damage']), { max: 4 }), [
            ab.choose('dm', oppLocked, 1),
            ab.moveTo(bound('dm'), 'damage'),
          ]),
        ]),
      ],
      text: text('G-CB06-002', 1),
    }),
  ],
  // Genesis Dragon, Basaltis Messiah: "a locked card and a rear-guard … for each face up card"
  'G-CB06-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: messiahHeart,
      cost: [ab.counterBlast(1), gFaceUp(nameOf('G-CB06-003'))],
      optional: true,
      effect: [
        ab.choose('u', anyLocked, 1, {
          upTo: true,
          countOf: faceUpGCards(),
          prompt: 'Choose locked cards to unlock',
        }),
        ab.unlock(bound('u')),
        ab.choose('k', ab.units('any', ['RC']), 1, {
          upTo: true,
          countOf: faceUpGCards(),
          prompt: 'Choose rear-guards to lock',
        }),
        ab.lock(bound('k')),
        ab.if_(ab.exists(bound('u', { zone: 'circle' })), [ab.draw(1)]),
      ],
      text: text('G-CB06-003', 1),
    }),
  ],
  // Death Star-vader, "Omega Fall" Glendios: its second [ACT] ("deal this unit one damage") needs
  // an engine piece: not scripted (UNRESOLVED_RULINGS "G-CB06 notes")
  'G-CB06-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp(nameOf('G-CB06-004')), ab.retireCost(myRGs(REVERSE), 2)],
      effect: [
        ab.asOpponent([
          ab.choose('dz', ab.cards('you', ['damage']), 5, {
            upTo: true,
            prompt: 'Choose as many cards as possible to put on separate (RC) as locked cards',
          }),
          ab.superiorCall(bound('dz'), { separate: true, open: true }),
          ab.lock(bound('dz', { zone: 'circle' })),
          ...[1, 2, 3, 4, 5].map((n) =>
            ab.if_(ab.count(bound('dz', { zone: 'circle' }), { min: n, max: n }), [
              ab.choose('dr', ab.cards('you', ['drop']), n, {
                upTo: true,
                prompt: 'Choose cards to put face up into your damage zone',
              }),
            ]),
          ),
          ab.moveTo(bound('dr'), 'damage'),
        ]),
        ab.restrict(oppLocked, 'cannot_unlock', 'next_end_phase'),
      ],
      text: part(
        'G-CB06-004',
        '[ACT](VC)[1/turn]:[Choose a face down',
        '"[ACT](VC)[1/turn]:[Counter',
      ),
    }),
  ],
  // Death Star-vader, Glueball Dragon
  'G-CB06-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), gFaceUp(nameOf('G-CB06-005'))],
      effect: [
        ab.if_(heart('Star-vader'), [
          ab.choose('l', ab.units('opponent', ['RC']), 1, {
            chooser: 'opponent',
            countOf: faceUpGCards(),
          }),
          ab.lock(bound('l')),
        ]),
      ],
      text: part('G-CB06-005', '[ACT](VC)[1/turn]', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      effects: [ab.gets(ab.units('you', ['VC', 'front_RC'], STAR), 'power', 3000, oppLocked)],
      text: part('G-CB06-005', '[CONT](VC)[Generation Break 3]'),
    }),
  ],
  // Deliberate Deletor, Aodaien
  'G-CB06-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp(nameOf('G-CB06-006')), ab.retireCost(myRGs(DELETOR))],
      effect: [
        ab.if_(heart('Deletor'), [
          ab.del(ab.units('opponent', ['VC'])),
          ab.power(
            ab.units('you', ['VC', 'front_RC']),
            2000,
            'end_of_turn',
            ab.cards('you', ['gzone'], { faceUp: true, name: nameOf('G-CB06-006') }),
          ),
        ]),
      ],
      text: text('G-CB06-006', 1),
    }),
  ],
  // Nebula Dragon, Cyclic Dragon
  'G-CB06-017': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'cyclic_hit',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            cost: [ab.counterBlast(1), ab.soulBlast(1)],
            optional: true,
            effect: [
              ab.choose('l', ab.units('opponent', ['front_RC']), 1, { upTo: true }),
              ab.choose('l', ab.units('opponent', ['back_RC']), 1, { upTo: true, append: true }),
              ab.lock(bound('l')),
            ],
            text: part('G-CB06-017', '[AUTO](VC):[Counter-Blast 1 & Soul-Blast 1]'),
          }),
        ),
      ],
      text: text('G-CB06-017', 1),
    }),
  ],
  // Genesis Machine Deity, Desthergen ([G Guardian]: card data)
  'G-CB06-018': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.count(anyLocked, { min: 2 }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CB06-018', 1),
    }),
  ],
  // Blaming Deletor, Ibiores ([G Guardian]: card data)
  'G-CB06-019': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: vanguardNamed('Deletor'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['VC', 'front_RC']), 3, { upTo: true }),
        ab.power(bound('t'), -1000, 'end_of_turn', myUnits(DELETOR)),
        ab.power(
          bound('t'),
          -1000,
          'end_of_turn',
          ab.cards('you', ['gzone'], { faceUp: true, ...DELETOR }),
        ),
      ],
      text: text('G-CB06-019', 1),
    }),
  ],
  // ============================================================================ grade 3
  // Star-vader, Chaos Breaker Crisis: "if a unit was not retired due to the effect of this card
  // during this turn" is once per turn (UNRESOLVED_RULINGS)
  'G-CB06-007': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1, STAR)],
      optional: true,
      effect: oppLocksOne,
      text: text('G-CB06-007', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['VC'],
      trigger: ab.strides({ owner: 'you', filter: { originalNameIncludes: 'Star-vader' } }),
      cost: [ab.counterBlast(1, STAR)],
      optional: true,
      effect: oppLocksOne,
      text: text('G-CB06-007', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.unlocked({ owner: 'opponent' }),
      effect: [
        ab.may('Retire that unlocked unit and draw a card?', [
          ab.retire(ab.eventCard()),
          ab.draw(1),
        ]),
      ],
      text: text('G-CB06-007', 1),
    }),
  ],
  // Darkjet Deletor, Greiend
  'G-CB06-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.counterBlast(1, DELETOR), ab.retireCost(myRGs(DELETOR), 2)],
      effect: [ab.del(ab.units('opponent', ['VC']))],
      text: text('G-CB06-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides({ owner: 'you', filter: { originalNameIncludes: 'Deletor' } }),
      effect: [
        ab.lookTop('top', 1),
        ab.reveal(bound('top')),
        ab.superiorCall(bound('top', DELETOR)),
        ab.moveTo(bound('top', { zone: 'deck' }), 'drop'),
        ab.choose('t', myUnits(), 1),
        ab.power(bound('t'), 2000),
        ab.choose('b', ab.cards('opponent', ['drop']), 2, { chooser: 'opponent' }),
        ...ab.bindFaceDown(bound('b')),
      ],
      text: text('G-CB06-008', 1),
    }),
  ],
  // Confront Deletor, Jagwokk: "all fighters look at the top card of their decks, and call it"
  'G-CB06-020': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: oppDeleted,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('a', 1),
        ab.superiorCall(bound('a')),
        ab.asOpponent([ab.lookTop('b', 1), ab.superiorCall(bound('b'))]),
        ab.if_(
          ab.any(
            { cond: 'grade_sum', of: bound('a', { zone: 'circle' }), range: { min: 3 } },
            { cond: 'grade_sum', of: bound('b', { zone: 'circle' }), range: { min: 3 } },
            ...[0, 1, 2].map((k) =>
              ab.all(
                {
                  cond: 'grade_sum',
                  of: bound('a', { zone: 'circle' }),
                  range: { min: k, max: k },
                },
                { cond: 'grade_sum', of: bound('b', { zone: 'circle' }), range: { min: 3 - k } },
              ),
            ),
          ),
          [ab.power(ab.self(), 5000)],
        ),
      ],
      text: text('G-CB06-020', 0),
    }),
  ],
  // Star-vader, Boseritter
  'G-CB06-021': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1, STAR)],
      optional: true,
      effect: lockOne,
      text: text('G-CB06-021', 0),
    }),
  ],
  // One who Bisects the Interstellar Gap (unofficial English)
  'G-CB06-031': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.exists(anyLocked),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: keepLocked(anyLocked),
      text: text('G-CB06-031', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-CB06-031', 1),
    }),
  ],
  // ============================================================================ grade 2
  // Lady Fencer of Matter Transmission
  'G-CB06-009': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: messiahVanguard,
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CB06-009', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      trigger: ab.unlocked('self'),
      condition: messiahVanguard,
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CB06-009', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      condition: messiahVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'fencer_lock',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            effect: [ab.lock(ab.self())],
            text: 'At the end of that battle, lock this unit.',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CB06-009', 1),
    }),
  ],
  // Star-vader, Strange Dragon
  'G-CB06-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardNamed('Chaos'),
      effect: [
        ...[ab.attacksVanguard(), ab.boosts()].map((trigger, i) =>
          ab.grant(
            ab.self(),
            ab.auto({
              id: i === 0 ? 'strange_attack' : 'strange_boost',
              zones: ['RC'],
              trigger,
              ...(i === 1 ? { condition: ab.battleTarget(true) } : {}),
              effect: [
                ...oppLocksOne,
                ab.if_(ab.not(ab.exists(bound('l'))), [ab.power(ab.self(), 5000, 'end_of_battle')]),
              ],
              text: part('G-CB06-011', '[AUTO](RC):When this unit attacks or boosts'),
            }),
          ),
        ),
      ],
      text: text('G-CB06-011', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: oppHasLocked(),
      effects: [ab.allow(ab.self(), 'boost')],
      text: text('G-CB06-011', 1),
    }),
  ],
  // Star-vader, Crusgabel
  'G-CB06-022': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      ...afterAttackingVanguard,
      cost: [ab.counterBlast(1), ab.discard(1)],
      optional: true,
      effect: lookReveal(10, REVERSE, 2),
      text: text('G-CB06-022', 0),
    }),
  ],
  // Star-vader, Globuladia
  'G-CB06-023': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardNamed('Star-vader', { grade: { min: 3 } }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.asOpponent([
          ab.choose('d', ab.cards('you', ['drop']), 1, {
            prompt: 'Choose a card from your drop zone to put on (RC) as a locked card',
          }),
          ab.superiorCall(bound('d'), { open: true }),
          ab.lock(bound('d', { zone: 'circle' })),
        ]),
        ab.power(ab.self(), 3000),
        ab.if_(oppHasLocked(2), [ab.power(ab.self(), 3000)]),
      ],
      text: text('G-CB06-023', 0),
    }),
  ],
  // Black Bullet of Iron Star, Photosphere: the cost (a card from hand on (RC) as a locked card)
  // is paid as the first step of the effect
  'G-CB06-024': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: messiahVanguard,
      effect: [
        ab.may('Put a card from your hand on (RC) as a locked card ([Power] +9000)?', [
          ab.choose('h', ab.cards('you', ['hand']), 1),
          ab.superiorCall(bound('h'), { open: true }),
          ab.lock(bound('h', { zone: 'circle' })),
          ab.if_(ab.exists(bound('h', { zone: 'circle' })), [
            ab.power(ab.self(), 9000, 'end_of_battle'),
          ]),
        ]),
      ],
      text: text('G-CB06-024', 0),
    }),
  ],
  // Forbid Deletor, Zakuelad: "he or she cannot Stride during his or her next ride phase" needs an
  // engine piece: only the [Power] +2000 is scripted (UNRESOLVED_RULINGS)
  'G-CB06-025': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      requires: oppDeleted,
      cost: [ab.counterBlast(1, DELETOR)],
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CB06-025', 0),
    }),
  ],
  // Rapid Gunner of Degeneration
  'G-CB06-032': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.lockCost(myRGs({ sameColumnAsSource: true, excludeSelf: true }))],
      effect: [
        ab.choose('t', myUnits({ excludeSelf: true }), 1, { upTo: true }),
        ab.power(bound('t'), 3000),
      ],
      text: text('G-CB06-032', 0),
    }),
  ],
  // Star-vader, Red Sprite Dragon
  'G-CB06-033': [
    ab.cont({
      id: '1',
      zones: ['RC', 'GC'],
      condition: oppHasLocked(),
      effects: [ab.gets(ab.self(), 'power', 2000), ab.gets(ab.self(), 'shield', 5000)],
      text: text('G-CB06-033', 0),
    }),
  ],
  // ============================================================================ grade 1
  // Globule Dober: "unlocked due to the effect of your vanguard or during your end phase" is any unlock
  'G-CB06-012': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.unlocked('self'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1), ...ab.counterCharge(1)],
      text: text('G-CB06-012', 0),
    }),
  ],
  // Star-vader, Metonaxe Dragon
  'G-CB06-013': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: oppHasLocked(2),
      effect: [
        ab.power(ab.self(), 4000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'metonaxe_keep',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            condition: ab.all(ab.battleHit(), ab.battleTarget(true), oppHasLocked()),
            effect: keepLocked(),
            text: part('G-CB06-013', 'at the end of that battle'),
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CB06-013', 0),
    }),
  ],
  // Prayer Child of Steady State Cosmo (Sentinel: card data)
  'G-CB06-014': [
    guardUnit('G-CB06-014', 1, MESSIAH),
    ab.act({
      id: '3',
      zones: ['drop'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'bind'), ab.lockCost(myRGs(), 2)],
      effect: [ab.draw(1)],
      text: text('G-CB06-014', 2),
    }),
  ],
  // Iron Wall Star-vader, Thorium (Sentinel: card data)
  'G-CB06-015': [
    guardUnit('G-CB06-015', 1, STAR, [
      ab.if_(oppHasLocked(3), [ab.may('Draw a card?', [ab.draw(1)])]),
    ]),
  ],
  // Remove Deletor, Igalga (Sentinel: card data)
  'G-CB06-016': [
    guardUnit('G-CB06-016', 1, DELETOR),
    ab.auto({
      id: '3',
      zones: ['drop'],
      trigger: ab.deleted({ owner: 'opponent' }),
      cost: [ab.moveCost(ab.self(), 'bind')],
      optional: true,
      effect: [ab.choose('t', myUnits(DELETOR), 1), ab.power(bound('t'), 4000)],
      text: text('G-CB06-016', 2),
    }),
  ],
  // Star-vader, Spiral Arm
  'G-CB06-026': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [
        ab.gets(ab.units('you', ['VC', 'RC', 'GC'], { notClan: 'Link Joker' }), 'shield', 10000),
      ],
      text: text('G-CB06-026', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.any(
          ab.is(ab.boostedUnit(), { nameIncludes: 'Glendios' }),
          ab.is(ab.boostedUnit(), REVERSE),
        ),
      ),
      cost: [ab.counterBlast(1, REVERSE)],
      optional: true,
      effect: oppLocksOne,
      text: text('G-CB06-026', 1),
    }),
  ],
  // Star-vader, Penrose Gate
  'G-CB06-027': [
    strideAsGrade3('G-CB06-027', 'Star-vader'),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: strideDiscarded,
      condition: ab.exists(ab.units('you', ['VC'], { originalNameIncludes: 'Chaos' })),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: lookReveal(7, CHAOS),
      text: text('G-CB06-027', 1),
    }),
  ],
  // Dark Metal Chameleon
  'G-CB06-028': [
    resist(text('G-CB06-028', 0)),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.unlocked('self'),
      effect: [...ab.counterCharge(1)],
      text: text('G-CB06-028', 1),
    }),
  ],
  // Hire Deletor, Farwon
  'G-CB06-029': [
    strideAsGrade3('G-CB06-029', 'Deletor'),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: strideDiscarded,
      condition: ab.exists(ab.units('you', ['VC'], { originalNameIncludes: 'Deletor' })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self())],
      text: text('G-CB06-029', 1),
    }),
  ],
  // Gravitate Turtle: printed as an [AUTO] with no trigger; read as a continuous ability
  'G-CB06-034': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: oppHasLocked(),
      effects: [ab.allow(ab.self(), 'intercept'), ab.allow(ab.self(), 'intercept_from_back_row')],
      text: text('G-CB06-034', 0),
    }),
  ],
  // Abolition Star-vader, Neodymium
  'G-CB06-035': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.unlocked({ owner: 'opponent' }),
      condition: ab.all(
        ab.opponentsTurn(),
        { cond: 'phase', phase: 'end' },
        vanguardNamed('Star-vader'),
      ),
      cost: [ab.soulBlast(1), ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.choose('r', ab.eventCard(), 1),
        ab.retire(bound('r')),
        ab.if_(ab.exists(bound('r', { zone: 'drop' })), [ab.draw(1)]),
      ],
      text: text('G-CB06-035', 0),
    }),
  ],
  // Cosmosphere Cat
  'G-CB06-036': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.choose('t', myUnits({ excludeSelf: true }), 2, { upTo: true }),
        ab.power(bound('t'), 1000, 'end_of_turn', anyLocked),
      ],
      text: text('G-CB06-036', 0),
    }),
  ],
  // Star-vader, Elgibs
  'G-CB06-037': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts(STAR),
      condition: oppHasLocked(2),
      effect: [
        ab.may('Draw a card (then discard a card, [Power] +2000)?', [
          ab.draw(1),
          ab.choose('dc', ab.cards('you', ['hand']), 1, { prompt: 'Choose a card to discard' }),
          ab.moveTo(bound('dc'), 'drop'),
          ab.power(ab.self(), 2000, 'end_of_battle'),
        ]),
      ],
      text: text('G-CB06-037', 0),
    }),
  ],
  // ============================================================================ grade 0
  // Flutter Deletor, Zuiije
  'G-CB06-038': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: retiredByYou,
      condition: oppDeleted,
      effect: [
        ab.lookTop('top', 1),
        ab.superiorCall(bound('top')),
        ab.if_(ab.exists(bound('top', { zone: 'circle', ...DELETOR })), [
          ab.moveTo(ab.self(), 'soul'),
          ...ab.counterCharge(1),
        ]),
      ],
      text: text('G-CB06-038', 1),
    }),
  ],
  // Star-vader, Planck Dracokid
  'G-CB06-039': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
      effect: [...lookReveal(7, CHAOS), ab.if_(oppHasLocked(), oppLocksOne)],
      text: text('G-CB06-039', 1),
    }),
  ],
  // Star-vader, Quark Shoebill
  'G-CB06-044': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('t', myUnits(), 1), ab.power(bound('t'), 3000)],
      text: text('G-CB06-044', 0),
    }),
  ],
  // Rendering Deletor, Efames
  'G-CB06-045': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      trigger: retiredByYou,
      condition: oppDeleted,
      effect: [
        ab.lookTop('top', 1),
        ab.superiorCall(bound('top')),
        ab.power(bound('top', { zone: 'circle' }), 5000),
      ],
      text: text('G-CB06-045', 0),
    }),
  ],
  // Star-vader, Magnetor Hedgehog / Star-vader, Roche Wave: triggers with no ability text
  // reprints
  'G-CB06-010': { sameAs: 'BT13-015' },
  'G-CB06-030': { sameAs: 'G-BT03-082' },
  'G-CB06-043': { sameAs: 'G-BT05-076' },
};
