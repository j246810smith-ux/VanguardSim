/**
 * Ability shapes shared by the G-era sets (G-BT01 onward, DECISIONS D-034). Each takes the exact
 * text it implements, so a set file passes the line from its own card data.
 */
import { ab, type AbilityDefinition, type CardFilter, type Cost, type Step } from '../engine';
import { gPerfectGuard } from './G-TD01';

/** "[Choose a face down card named <name> from your G zone, and turn it face up]" */
export const gFaceUp = (name: string): Cost => ({ cost: 'g_face_up', n: 1, filter: { name } });
/** "[Choose a face down card from your G zone, and turn it face up]" */
export const gFaceUpAny = (): Cost => ({ cost: 'g_face_up', n: 1 });
/** "If the number of face up cards in your G zone is two or more" */
export const faceUpGZone = (n = 2) =>
  ab.count(ab.cards('you', ['gzone'], { faceUp: true }), { min: n });
/** "for each face up card in your G zone" */
export const faceUpGCards = () => ab.cards('you', ['gzone'], { faceUp: true });

/** "Look at n cards from the top of your deck, choose up to <take> …, put it into your hand, and put the rest on the bottom" */
export const lookTakeBottom = (n: number, take: number, filter: CardFilter = {}): Step[] => [
  ab.lookTop('look', n),
  ab.choose('t', ab.bound('look', filter), take, { upTo: true }),
  ab.toHand(ab.bound('t')),
  ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
];

/** "Choose one of your opponent's (grade n or less) rear-guards, and your opponent puts that unit on the bottom of his or her deck." */
export const opponentToBottom = (maxGrade?: number): Step[] => [
  ab.choose(
    'b',
    ab.units('opponent', ['RC'], maxGrade === undefined ? {} : { grade: { max: maxGrade } }),
  ),
  ab.moveTo(ab.bound('b'), 'deck_bottom'),
];

/** "Choose (up to) n of your opponent's (grade x or less) rear-guards, and retire them." */
export const retireOpponent = (maxGrade?: number, n = 1, upTo = false): Step[] => [
  ab.choose(
    'r',
    ab.units('opponent', ['RC'], maxGrade === undefined ? {} : { grade: { max: maxGrade } }),
    n,
    upTo ? { upTo } : {},
  ),
  ab.retire(ab.bound('r')),
];

/** "Choose one of your opponent's rear-guards in the front row, and retire it." */
export const retireOpponentFront = (): Step[] => [
  ab.choose('r', ab.units('opponent', ['front_RC'])),
  ab.retire(ab.bound('r')),
];

/** "until end of that battle, your opponent cannot call grade <min> (or greater) cards from hand to (GC)" */
export const noGuardsFromHand = (minGrade: 0 | 1, text: string): Step =>
  ab.grant(
    ab.self(),
    ab.cont({
      id: minGrade === 0 ? 'no_g0_guard' : 'no_g1_guard',
      zones: ['VC', 'RC'],
      effects: [
        ab.forbidGuard('opponent', minGrade === 0 ? { grade: { max: 0 } } : { grade: { min: 1 } }),
      ],
      text,
    }),
    'end_of_battle',
  );

/** Sentinel: perfect guard, then Counter-Charge 1 if a card of the same name is in the drop zone. */
export const gPerfectGuardCC = (text: string, name: string): AbilityDefinition => {
  const pg = gPerfectGuard(text);
  if (pg.kind !== 'AUTO') return pg;
  return {
    ...pg,
    trigger: ab.placedOn('GC', 'self', 'hand'),
    effect: [
      ab.choose('t', ab.units('you', ['VC'], { beingAttacked: true })),
      ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ab.if_(ab.exists(ab.cards('you', ['drop'], { name })), ab.counterCharge(1)),
    ],
  };
};

/**
 * "Stride fodder": [AUTO][Choose a grade 3 card from your hand, and reveal it] placed on (RC)
 * from hand: search a grade 3 with <part> in its name, reveal it, to hand, shuffle, discard a card;
 * [CONT]Hand: grade +2 while paying a stride cost.
 */
export const strideFodder = (
  part: string,
  searchText: string,
  gradeText: string,
): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.placedOn('RC', 'self', 'hand'),
    condition: ab.exists(ab.cards('you', ['hand'], { grade: { min: 3, max: 3 } })),
    effect: [
      ab.may('Reveal a grade 3 card from your hand to use this ability?', [
        ab.choose('rv', ab.cards('you', ['hand'], { grade: { min: 3, max: 3 } }), 1, {
          prompt: 'Choose a grade 3 card from your hand to reveal',
        }),
        ab.reveal(ab.bound('rv')),
        ab.search('s', { grade: { min: 3, max: 3 }, nameIncludes: part }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
        ab.choose('dc', ab.cards('you', ['hand']), 1, { prompt: 'Choose a card to discard' }),
        ab.moveTo(ab.bound('dc'), 'drop'),
      ]),
    ],
    text: searchText,
  }),
  ab.cont({
    id: 'stride_grade',
    zones: ['hand'],
    effects: [{ ce: 'stride_grade', amount: 2 }],
    text: gradeText,
  }),
];

/** "When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards" */
export const opponentRetiredByYou = (other = false) => ({
  on: 'put_into_drop' as const,
  who: { owner: 'opponent' as const },
  from: 'RC' as const,
  byYourEffect: true,
  ...(other ? { otherCause: true } : {}),
});

/** "When your opponent's rear-guard is put into his or her deck due to an effect from one of your cards" */
export const opponentToDeckByYou = () => ({
  on: 'put_into_deck' as const,
  who: { owner: 'opponent' as const },
  byYourEffect: true,
});

/** "… you may have it get [Power] +n until end of turn. If you do, return this unit to your deck, and shuffle your deck." */
export const pumpThenReturn = (as: string, amount: number): Step =>
  ab.may(`Give +${amount} and return this unit to your deck?`, [
    ab.power(ab.bound(as), amount),
    ...ab.returnSelfToDeck(),
  ]);

/** "[CONT](VC/RC)/(GC):Resist (This unit cannot be chosen by the effects of your opponent's cards)" */
export const resist = (text: string, id = 'resist'): AbilityDefinition =>
  ab.cont({
    id,
    zones: ['VC', 'RC', 'GC'],
    effects: [ab.cannot(ab.self(), 'resist')],
    text,
  });

/** "[CONT]:This card is from all clans and nations." (Cray Elemental) */
export const allClans = (text: string): AbilityDefinition =>
  ab.cont({ id: 'all_clans', zones: ['any'], effects: [{ ce: 'all_clans' }], text });

/** "[AUTO](RC):[Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with <part> in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets [Power] +5000 until end of that battle." */
export const bringerToSoul = (part: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
    condition: ab.exists(ab.units('you', ['VC'], { nameIncludes: part, grade: { min: 3 } })),
    cost: [ab.moveCost(ab.self(), 'soul')],
    optional: true,
    effect: [
      ab.draw(1),
      ab.choose('v', ab.units('you', ['VC'])),
      ab.power(ab.bound('v'), 5000, 'end_of_battle'),
    ],
    text,
  });

/** "choose (another of) your rear-guards, [Stand] it, it gets [Power] +4000 until end of turn, at the end of that turn, (draw a card, and) retire that unit" */
export const standPumpRetire = (drawToo: boolean, excludeSelf = true): Step[] => [
  ab.choose('t', ab.units('you', ['RC'], excludeSelf ? { excludeSelf: true } : {})),
  ab.stand(ab.bound('t')),
  ...pumpRetireAtEnd('t', drawToo),
];

/** "<bound> gets [Power] +4000 until end of turn, at the end of that turn, (draw a card, and) retire that unit" */
export const pumpRetireAtEnd = (as: string, drawToo: boolean, amount = 4000): Step[] => [
  ab.power(ab.bound(as), amount),
  ab.atNextOn(
    ab.bound(as),
    'end_phase',
    drawToo ? [ab.draw(1), ab.retire(ab.self())] : [ab.retire(ab.self())],
    'end_of_turn',
    drawToo ? 'Draw a card, and retire this unit.' : 'Retire this unit.',
  ),
];
