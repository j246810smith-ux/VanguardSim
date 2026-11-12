/**
 * G-FC02 "Fighter's Collection 2015 Winter" (DECISIONS D-034): 24 G units and 24 normal units for
 * the clans' new leaders (Witches, Jewel Knights, Kaisers, Workeroids, "Rex", Seven Seas …). G units
 * stride by the rules; only their other abilities are scripted here. English text from Internet
 * Archive copies of the official pages; Hellfire Seal Dragon Knight, Agitomaru and Squallrex from the
 * card wiki (scripts/cards/wiki-english.json). G-FC02-024 is the original printing of G-BT12-045.
 *
 * "Your opponent may discard … If he or she does not, …" is a choice of up to that many cards by the
 * opponent: fewer than asked counts as not discarding (nothing is discarded).
 */
import data from '../../data/cards/G-FC02.json';
import { ab, type CardFilter, type Condition, type Selector, type Step } from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { gFaceUp, gFaceUpAny, pumpRetireAtEnd } from './gShapes';

const RECORDS = (data as SetFile).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text;
  if (t === undefined) throw new Error(`G-FC02: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-FC02: no text line ${n} for ${id}`);
  return line;
};
const nameOf = (id: string): string => {
  const n = RECORDS.find((c) => c.id === id)?.en?.name;
  if (n === undefined) throw new Error(`G-FC02: no English name for ${id}`);
  return n;
};
const ID = (n: number) => `G-FC02-${String(n).padStart(3, '0')}`;

// --- pieces --------------------------------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const heart = (part: string): Condition => ({ cond: 'heart_named', part });
const vanguardNamed = (part: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part, ...filter }));
/** "if you have two or more cards with X in its original card name on your (VC)" (the G unit and its hearts) */
const onVCOriginal = (part: string, n = 2): Condition =>
  ab.count(ab.cards('you', ['VC', 'hearts'], { originalNameIncludes: part }), { min: n });
const rearGuards = (filter: CardFilter = {}): Selector => ab.units('you', ['RC'], filter);
const oppRearGuards = (filter: CardFilter = {}): Selector => ab.units('opponent', ['RC'], filter);
const frontRow = (filter: CardFilter = {}): Selector => ab.units('you', ['VC', 'front_RC'], filter);
const faceUpNamed = (id: string): Selector =>
  ab.cards('you', ['gzone'], { faceUp: true, name: nameOf(id) });
const perCount = (sel: Selector, max: number, f: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(sel, n === max ? { min: n } : { min: n, max: n }), f(n)),
  );
/**
 * "with "Kaiser" in its card name": the Japanese text matches カイザー, which English prints as
 * "Kaiser", "Daikaiser" and "Meteokaiser"; 'aiser' matches exactly those names.
 */
const KAISER = 'aiser';
const ccSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
const hitsVanguard = ab.attackHits('vanguard');
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
const searchToHand = (as: string, filter: CardFilter): Step[] => [
  ab.search(as, filter),
  ab.reveal(bound(as)),
  ab.toHand(bound(as)),
  ab.shuffle(),
];
const discardOne = (as: string): Step[] => [
  ab.choose(as, ab.cards('you', ['hand']), 1, { prompt: 'Choose a card to discard' }),
  ab.moveTo(bound(as), 'drop'),
];
const atEnd = (target: Selector, effect: Step[], t: string): Step =>
  ab.atNextOn(target, 'end_phase', effect, 'end_of_turn', t);
const retireAtEnd = (target: Selector): Step =>
  atEnd(target, [ab.retire(ab.self())], 'At the end of that turn, retire this unit.');
/** "Choose up to three cards with "Pacifica" in its card name from your hand, and reveal them. If you reveal three cards with different card names" */
const revealThreePacifica = (as: string, then: Step[]): Step[] => [
  ab.choose(as, ab.cards('you', ['hand'], { nameIncludes: 'Pacifica' }), 3, {
    upTo: true,
    prompt: 'You may reveal up to three cards with "Pacifica" in their names',
  }),
  ab.reveal(bound(as)),
  ab.if_(
    ab.all(ab.count(bound(as), { min: 3 }), {
      cond: 'distinct_names',
      of: bound(as),
      range: { min: 3 },
    }),
    then,
  ),
];
/** "your opponent may choose n cards from his or her hand, and discard them. If he or she does not, <otherwise>" */
const opponentMayDiscard = (as: string, n: number, otherwise: Step[]): Step[] => [
  ab.choose(as, ab.cards('opponent', ['hand']), n, {
    upTo: true,
    chooser: 'opponent',
    prompt:
      n === 1
        ? 'You may discard a card (otherwise your opponent’s ability goes on)'
        : `You may discard ${n} cards (otherwise your opponent’s ability goes on)`,
  }),
  ab.if_(ab.count(bound(as), { min: n }), [ab.moveTo(bound(as), 'drop')], otherwise),
];
/** "Choose a grade 3 card from your hand, and reveal it" (paid as the first part of the effect). */
const revealGrade3: Step[] = [
  ab.choose('rv3', ab.cards('you', ['hand'], { grade: { min: 3, max: 3 } }), 1, {
    prompt: 'Choose a grade 3 card from your hand to reveal',
  }),
  ab.reveal(bound('rv3')),
];
const hasGrade3InHand = ab.exists(ab.cards('you', ['hand'], { grade: { min: 3, max: 3 } }));
/** "[Soul-Blast n]" as an effect */
const soulBlastEffect = (n: number): Step[] => [
  ab.choose('sbx', ab.cards('you', ['soul']), n, { prompt: `Choose ${n} cards from your soul` }),
  ab.moveTo(bound('sbx'), 'drop'),
];

export const G_FC02: SetAbilities = {
  // ================================================================================== G units
  // Climax Jewel Knight Lord, Evangeline
  [ID(1)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [
        ab.if_(
          ab.all(
            heart('Jewel Knight'),
            ab.count(rearGuards({ nameIncludes: 'Jewel Knight' }), { min: 3 }),
          ),
          [
            ab.power(
              ab.units('you', ['VC', 'RC'], { nameIncludes: 'Jewel Knight' }),
              3000,
              'end_of_turn',
              faceUpNamed(ID(1)),
            ),
          ],
        ),
      ],
      text: text(ID(1), 1),
    }),
  ],
  // Bluish Flame True Liberator, Holy Flame
  [ID(2)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ab.if_(
          heart('Liberator'),
          perCount(faceUpNamed(ID(2)), 8, (n) =>
            Array.from({ length: n }, (_, i): Step[] => [
              ab.lookTop(`hl${i}`, 3),
              ab.choose(`hc${i}`, bound(`hl${i}`), 1, { upTo: true }),
              ab.superiorCall(bound(`hc${i}`)),
              ab.moveTo(bound(`hl${i}`, { zone: 'deck' }), 'drop'),
              ab.power(bound(`hc${i}`), 2000),
            ]).flat(),
          ),
        ),
      ],
      text: text(ID(2), 1),
    }),
  ],
  // Helldeity Seal Dragon, Crossorigin
  [ID(3)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ab.if_(heart('Seal Dragon'), [
          ...perCount(faceUpNamed(ID(3)), 5, (n) => [
            ab.choose('xr', oppRearGuards(), n, { upTo: true }),
          ]),
          ab.retire(bound('xr')),
          ab.asOpponent([
            ab.lookTop('xl', 4),
            ab.reveal(bound('xl')),
            ab.choose('xg', bound('xl', { grade: { min: 2, max: 2 } }), 1, {
              countOf: bound('xr', { zone: 'drop' }),
            }),
            ab.superiorCall(bound('xg'), { separate: true, open: true }),
            ab.shuffle(),
          ]),
          ab.if_(ab.count(oppRearGuards({ grade: { min: 2, max: 2 } }), { min: 2 }), [
            ab.critical(ab.self(), 1),
          ]),
        ]),
      ],
      text: text(ID(3), 1),
    }),
  ],
  // Conquering Supreme Dragon, Dragonic Kaiser Warning
  [ID(4)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUp(nameOf(ID(4)))],
      effect: [
        ab.if_(heart(KAISER), [
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'warning_front_row',
              zones: ['VC'],
              effects: [ab.allow(ab.self(), 'attack_entire_front_row')],
              text: "[CONT](VC):This unit battles all of your opponent's units in the front row in one attack.",
            }),
          ),
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'warning_hit',
              zones: ['VC'],
              trigger: ab.attackHits(),
              effect: [
                ab.choose('wp', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 2, {
                  upTo: true,
                }),
                ab.power(bound('wp'), 5000),
              ],
              text: "[AUTO](VC):When this unit's attack hits, choose up to two of your other units, and they get [Power] +5000 until end of turn.",
            }),
          ),
        ]),
      ],
      text: text(ID(4), 1),
    }),
  ],
  // Ultimate Beast Deity, Ethics Buster Catastrophe
  [ID(5)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [
        ab.if_(heart('Beast Deity'), [
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'catastrophe_stand',
              zones: ['VC'],
              trigger: ab.driveCheckReveals({ grade: { min: 1 }, nameIncludes: 'Beast Deity' }),
              effect: [
                ab.choose('cs', rearGuards(), 1, { upTo: true }),
                ab.stand(bound('cs')),
                ab.if_(ab.count(faceUpNamed(ID(5)), { min: 2 }), [ab.power(bound('cs'), 3000)]),
              ],
              text: '[AUTO](VC):When your drive check reveals a grade 1 or greater card with "Beast Deity" in its card name, choose up to one of your rear-guards, [Stand] it, and if you have two or more face up cards named "Ultimate Beast Deity, Ethics Buster Catastrophe" in your G zone, that unit gets [Power] +3000 until end of turn.',
            }),
          ),
        ]),
      ],
      text: text(ID(5), 1),
    }),
  ],
  // Legendary Dimensional Robo, Daikaiser Leon
  [ID(6)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUp(nameOf(ID(6)))],
      effect: [
        ab.if_(heart(KAISER), [
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'leon_guardian',
              zones: ['VC'],
              trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 } }),
              effect: [
                ab.choose('lg', ab.cards('opponent', ['GC']), 1, { upTo: true }),
                ab.nullify(bound('lg'), 'cannot_be_hit'),
                ab.retire(bound('lg')),
              ],
              text: '[AUTO](VC):When your drive check reveals a grade 3 card, choose up to one of your opponent\'s guardians, retire it, and that unit\'s effects with "cannot be hit" are nullified.',
            }),
          ),
        ]),
      ],
      text: text(ID(6), 1),
    }),
  ],
  // Interdimensional Dragon, Chronoscommand Revolution
  [ID(7)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 2,
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1), gFaceUp(nameOf(ID(7)))],
      optional: true,
      effect: [
        ab.choose('ro', oppRearGuards(), 5),
        ab.asOpponent([ab.bottomInOrder(bound('ro'))]),
        ab.if_(
          ab.exists(
            ab.cards('you', ['gzone'], {
              faceUp: true,
              name: 'Interdimensional Dragon, Chronoscommand Dragon',
            }),
          ),
          [
            ab.choose('rk', rearGuards(), 2, {
              upTo: true,
              prompt: 'Choose up to two rear-guards to keep',
            }),
            ab.choose('ra', rearGuards({ notBound: 'rk' }), 5),
          ],
          [ab.choose('ra', rearGuards(), 5)],
        ),
        ab.bottomInOrder(bound('ra')),
      ],
      text: text(ID(7), 1),
    }),
  ],
  // Twinkle Happiness☆, Pacifica
  [ID(8)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp(nameOf(ID(8)))],
      effect: [
        ab.if_(heart('Pacifica'), [
          ab.choose('pr', rearGuards()),
          ab.toHand(bound('pr')),
          ab.if_(
            ab.exists(bound('pr', { zone: 'hand' })),
            searchToHand('ps', { nameIncludes: 'Pacifica' }),
          ),
          ...revealThreePacifica('pv', [ab.critical(ab.self(), 1)]),
        ]),
      ],
      text: text(ID(8), 1),
    }),
  ],
  // Floral Witch Master, MiMi
  [ID(9)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: heart('Witch'),
      cost: [ab.discard(1, { nameIncludes: 'Witch' })],
      optional: true,
      effect: opponentMayDiscard('md', 2, [ab.dealDamage(1, true)]),
      text: text(ID(9), 1),
    }),
  ],
  // Holy Seraph, Nociel
  [ID(10)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      ...afterAttackingVanguard,
      condition: heart('Nociel'),
      cost: [ab.moveChosenCost(rearGuards(), 'damage', 2)],
      optional: true,
      effect: [
        ab.choose('nc', ab.cards('you', ['damage']), 2),
        ab.superiorCall(bound('nc'), { separate: true }),
        ab.power(bound('nc', { nameIncludes: 'Nociel' }), 5000),
      ],
      text: text(ID(10), 1),
    }),
  ],
  // Witch Queen of Transfiguration, Sinclair
  [ID(11)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(
          ab.all(
            heart('Witch'),
            ab.count(oppRearGuards({ grade: { min: 0, max: 0 } }), { min: 2 }),
          ),
          [
            ab.asOpponent([
              ab.lookTop('sl', 10),
              ab.reveal(bound('sl')),
              ab.choose('sg', bound('sl', { grade: { min: 0, max: 0 } }), 1),
              ab.superiorRide(bound('sg')),
              ab.shuffle(),
            ]),
            ab.grant(
              ab.units('opponent', ['VC']),
              ab.auto({
                id: 'sinclair_guard',
                zones: ['VC'],
                trigger: ab.atStartOf('guard_step', 'opponent'),
                triggerIf: ab.exists(ab.units('you', ['VC', 'RC'], { beingAttacked: true })),
                cost: [ab.counterBlast(1)],
                optional: true,
                effect: [
                  ab.choose('sgc', ab.cards('you', ['hand']), 50, {
                    upTo: true,
                    prompt: 'Choose any number of cards to call to (GC)',
                  }),
                  ab.callGuardians(bound('sgc')),
                ],
                text: '[AUTO](VC):[Counter-Blast 1] At the beginning of the guard step of the battle that your unit was attacked, you may pay the cost. If you do, choose any number of cards from your hand, and call them to (GC) as [Rest].',
              }),
            ),
            ab.grant(
              ab.units('opponent', ['VC']),
              ab.auto({
                id: 'sinclair_ride_back',
                zones: ['VC'],
                trigger: ab.atStartOf('end_phase', 'any'),
                effect: [
                  ab.choose('srb', ab.cards('you', ['soul']), 1, { upTo: true }),
                  ab.superiorRide(bound('srb')),
                ],
                text: '[AUTO](VC):At the end of the turn, choose up to one card from your soul, and ride it as [Stand].',
              }),
            ),
          ],
        ),
      ],
      text: text(ID(11), 1),
    }),
  ],
  // Witch Queen of Holy Water, Clove
  [ID(12)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: heart('Witch'),
      cost: [ab.soulBlast(6)],
      optional: true,
      effect: [
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'clove_witches',
            zones: ['VC'],
            condition: ab.yourTurn(),
            effects: [
              ab.gets(ab.units('you', ['VC', 'RC'], { nameIncludes: 'Witch' }), 'power', 5000),
            ],
            text: '[CONT](VC):During your turn, all of your units with "Witch" in its card name get [Power] +5000.',
          }),
        ),
        ab.if_(ab.count(ab.cards('you', ['hearts']), { min: 2 }), [ab.critical(ab.self(), 1)]),
      ],
      text: text(ID(12), 1),
    }),
  ],
  // Steel Blade Shura Stealth Dragon, Hayakujirakan
  [ID(13)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(heart('Shura Stealth Dragon'), [
          ab.chooseRandom('hr', ab.cards('opponent', ['hand'])),
          ...ab.bindFaceDown(bound('hr')),
          ab.if_(ab.count(ab.cards('opponent', ['hand']), { max: 3 }), [
            ab.choose('hb', oppRearGuards(), 5),
            ab.moveTo(bound('hb'), 'bind'),
          ]),
          ...['hr', 'hb'].map((as) =>
            atEnd(
              bound(as, { zone: 'bind' }),
              [ab.toHand(ab.self())],
              'At the end of that turn, put this card into your hand.',
            ),
          ),
        ]),
      ],
      text: text(ID(13), 1),
    }),
  ],
  // Destruction Tyrant, Hellrex Maxima
  [ID(14)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.retireCost(rearGuards())],
      effect: [
        ab.if_(heart('Rex'), [
          ab.search('hx', { nameIncludes: 'Rex' }),
          ab.moveTo(bound('hx'), 'bind'),
          ab.shuffle(),
          ab.if_(ab.exists(bound('hx', { zone: 'bind' })), [
            ab.choose('hp', frontRow(), 3, { upTo: true }),
            ab.power(bound('hp'), 4000),
          ]),
        ]),
      ],
      text: text(ID(14), 1),
    }),
  ],
  // Ambush Demon Stealth Dragon, Hyakki Vogue Nayuta
  [ID(15)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.moveChosenCost(rearGuards({ nameIncludes: 'Hyakki' }), 'deck_bottom')],
      effect: [
        ab.if_(heart('Hyakki'), [
          ab.choose('nu', ab.units('you')),
          ab.search('ns', { sameNameAsBound: 'nu' }),
          ab.superiorCall(bound('ns')),
          ab.shuffle(),
          ab.power(bound('ns'), 10000),
          atEnd(
            bound('ns'),
            [ab.toHand(ab.self())],
            'At the end of that turn, return this unit to your hand.',
          ),
        ]),
      ],
      text: text(ID(15), 1),
    }),
  ],
  // Death Star-vader, Quintessence Dragon
  [ID(16)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: heart('Infinite'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('ql', ab.units('opponent', ['front_RC'])),
        ab.choose('ql', ab.units('opponent', ['back_RC']), 1, { append: true }),
        ab.lock(bound('ql')),
        ab.if_(ab.count(ab.cards('you', ['damage']), { min: 4 }), [
          ab.restrict(bound('ql'), 'cannot_unlock', 'next_end_phase'),
        ]),
      ],
      text: text(ID(16), 1),
    }),
  ],
  // Divine Hand, Good End Dragger
  [ID(17)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      ...afterAttackingVanguard,
      condition: heart('Bad End'),
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['hand']), 'soul')],
      optional: true,
      effect: [
        ab.moveTo(ab.self(), 'gzone'),
        ab.search('gd', { grade: { min: 3, max: 3 } }, 2),
        ab.choose('gc', bound('gd'), 1, { prompt: 'Choose a card to call (the other is ridden)' }),
        ab.superiorCall(bound('gc'), { open: true }),
        ab.superiorRide(bound('gd', { zone: 'deck', notBound: 'gc' })),
        // "ride the rest as [Rest]"
        ab.if_(ab.exists(bound('gd', { notBound: 'gc', isVanguard: true })), [
          ab.rest(ab.units('you', ['VC'])),
        ]),
        ab.shuffle(),
      ],
      text: text(ID(17), 1),
    }),
  ],
  // Wings of Annihilation, Blade Wing Tibold
  [ID(18)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: heart('Blade Wing'),
      effect: [
        ab.moveTo(ab.cards('you', ['drop']), 'deck_bottom'),
        ab.shuffle(),
        ab.if_(
          ab.soulCountAtLeast(15),
          [
            ab.grant(
              ab.self(),
              ab.cont({
                id: 'tibold_front',
                zones: ['VC'],
                effects: [ab.gets(ab.units('you', ['front_RC']), 'power', 10000)],
                text: '[CONT](VC):All of your rear-guards in the front row get [Power] +10000',
              }),
            ),
          ],
          [ab.soulCharge(5)],
        ),
      ],
      text: text(ID(18), 1),
    }),
  ],
  // Nightmare Doll of the Abyss, Beatrix
  [ID(19)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      ...afterAttackingVanguard,
      condition: heart('Nightmare Doll'),
      cost: [ab.moveChosenCost(rearGuards({ race: 'Workeroid' }), 'soul', 3)],
      optional: true,
      effect: [
        ab.moveTo(ab.self(), 'gzone'),
        ab.choose('bw', ab.cards('you', ['soul'], { race: 'Workeroid' }), 2, { upTo: true }),
        ab.superiorCall(bound('bw'), { separate: true }),
      ],
      text: text(ID(19), 1),
    }),
  ],
  // Loved by the Seven Seas, Nightmist
  [ID(20)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(heart('Seven Seas'), [
          ab.choose('nm', ab.cards('you', ['drop']), 2, { upTo: true }),
          ab.superiorCall(bound('nm'), { separate: true }),
          retireAtEnd(bound('nm')),
        ]),
      ],
      text: text(ID(20), 1),
    }),
  ],
  // Blue Flight Marshal Dragon, Mythril-core Dragon
  [ID(21)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard', { owner: 'you' }),
      triggerIf: ab.battleAtLeast(3),
      condition: heart('Trans-core'),
      effect: opponentMayDiscard('mo', 1, [ab.draw(2)]),
      text: text(ID(21), 1),
    }),
  ],
  // Evil Armor Mutant Deity, Goliath
  [ID(22)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(heart('Giraffa'), [
          ab.choose('gg', ab.units('you', ['VC', 'RC'], { nameIncludes: 'Giraffa' }), 6, {
            upTo: true,
          }),
          ab.grant(
            bound('gg'),
            ab.cont({
              id: 'goliath_power',
              zones: ['VC', 'RC'],
              condition: ab.all(
                ab.yourTurn(),
                ab.not(ab.exists(ab.units('opponent', ['VC', 'RC'], { orientation: 'stand' }))),
              ),
              effects: [ab.gets(ab.self(), 'power', 5000)],
              text: "[CONT](VC/RC):During your turn, if all of your opponent's vanguards and rear-guards are [Rest], this unit gets [Power] +5000.",
            }),
          ),
          ab.grant(
            bound('gg'),
            ab.auto({
              id: 'goliath_hit',
              zones: ['VC', 'RC'],
              trigger: hitsVanguard,
              effect: [
                ab.choose('gn', oppRearGuards(), 1, { upTo: true }),
                ab.restrict(bound('gn'), 'cannot_stand', 'next_stand_phase'),
              ],
              text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose up to one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase.",
            }),
          ),
        ]),
      ],
      text: text(ID(22), 1),
    }),
  ],
  // Omniscience Dragon, Cath Palug
  [ID(23)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: false } }, 'vanguard'),
      condition: heart('Honorary Professor'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('cp', rearGuards(), 1, { upTo: true }), ...pumpRetireAtEnd('cp', true)],
      text: text(ID(23), 1),
    }),
  ],
  // Protector Lotus Maiden of Yggdrasil (also G-BT12-045)
  [ID(24)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ab.if_(heart('Maiden of'), [
          ab.choose('lm', frontRow({ nameIncludes: 'Maiden of' }), 3, { upTo: true }),
          ab.power(bound('lm'), 5000),
          ab.grant(
            bound('lm'),
            ab.auto({
              id: 'lotus_hit',
              zones: ['VC', 'RC'],
              trigger: hitsVanguard,
              effect: [
                ab.lookTop('ll', 5),
                ab.choose('lc', bound('ll', { sameNameAsClanUnit: '*' }), 1, { upTo: true }),
                ab.superiorCall(bound('lc')),
                ab.shuffle(),
              ],
              text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, look at five cards from the top of your deck, search for up to one card with the same card name as a card on your (VC) or (RC) from among them, call it to (RC), and shuffle your deck.",
            }),
          ),
        ]),
      ],
      text: text(ID(24), 1),
    }),
  ],

  // ============================================================================= normal units
  // Calling Jewel Knight, Christine
  [ID(25)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(
        ab.count(rearGuards({ nameIncludes: 'Jewel Knight', excludeSelf: true }), { min: 3 }),
        hasGrade3InHand,
      ),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...revealGrade3,
        ab.search('cj', { grade: { min: 3, max: 3 }, nameIncludes: 'Jewel Knight' }),
        ab.superiorCall(bound('cj')),
        ab.shuffle(),
        atEnd(
          bound('cj'),
          [ab.toHand(ab.self()), ...discardOne('cjd')],
          'At the end of that turn, put this card into your hand, choose a card from your hand, and discard it.',
        ),
      ],
      text: text(ID(25)),
    }),
  ],
  // Rose Red Witch, CooCoo
  [ID(26)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.all(vanguardNamed('Witch'), ab.count(ab.cards('you', ['soul']), { max: 1 })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(2), ...discardOne('cd')],
      text: text(ID(26)),
    }),
  ],
  // Love Sniper, Nociel
  [ID(27)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.putIntoDamage({ owner: 'you', filter: { nameIncludes: 'Nociel' } }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.if_(ab.is(ab.eventCard(), { faceUp: true, zone: 'damage' }), [
          ab.toHand(ab.eventCard()),
          ab.topTo(1, 'damage'),
        ]),
      ],
      text: text(ID(27), 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand']), 'damage')],
      optional: true,
      effect: [ab.choose('ln', ab.cards('you', ['damage'])), ab.toHand(bound('ln'))],
      text: text(ID(27), 1),
    }),
  ],
  // Witch of Intelligence, Dehtail
  [ID(28)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(onVCOriginal('Witch'), ab.exists(oppRearGuards())),
      effect: [
        ab.may('Pay the [?] cost (declare it) to use this ability?', [
          ab.choose('dr', oppRearGuards(), 1, {
            prompt: "Choose one of your opponent's (RC) with a rear-guard",
          }),
          ab.asOpponent([
            ab.lookTop('dl', 5),
            ab.reveal(bound('dl')),
            ab.choose('dg', bound('dl', { grade: { min: 0, max: 0 } }), 1),
            ab.superiorCall(bound('dg'), { circlesOf: 'dr' }),
            ab.shuffle(),
          ]),
        ]),
      ],
      text: text(ID(28)),
    }),
  ],
  // Sword Principle Liberator, Magnus
  [ID(29)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: onVCOriginal('Liberator'),
      effect: [
        ab.lookTop('ml', 3),
        ab.choose('mc', bound('ml', { nameIncludes: 'Liberator' }), 1, { upTo: true }),
        ab.superiorCall(bound('mc')),
        ab.bottomInOrder(bound('ml', { zone: 'deck' })),
        ab.if_(ab.is(bound('mc'), { nameIncludes: 'Bluish Flame' }), [
          ab.may('Return that unit to your hand?', [ab.toHand(bound('mc'))]),
        ]),
      ],
      text: text(ID(29)),
    }),
  ],
  // Witch of Quill Pens, Oneon
  [ID(30)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('soul'),
      condition: vanguardNamed('Witch'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self()), ab.power(ab.self(), 2000)],
      text: text(ID(30)),
    }),
  ],
  // Hellfire Seal Dragon Knight
  [ID(31)]: [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ab.if_(vanguardNamed('Seal Dragon'), [
          ab.restrict(oppRearGuards(), 'cannot_intercept'),
          ab.power(
            ab.self(),
            2000,
            'end_of_turn',
            ab.units('opponent', ['VC', 'RC'], { grade: { min: 2, max: 2 } }),
          ),
        ]),
      ],
      text: text(ID(31)),
    }),
  ],
  // Stealth Rogue of Night Fog, Agitomaru
  [ID(32)]: [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: hitsVanguard,
      effect: [
        ab.choose('ab', ab.cards('opponent', ['bind']), 1, { upTo: true }),
        ab.moveTo(bound('ab'), 'drop'),
      ],
      text: text(ID(32)),
    }),
  ],
  // Destruction Dragon, Squallrex
  [ID(33)]: [
    ab.act({
      id: '1',
      zones: ['hand'],
      cost: [ab.moveCost(ab.self(), 'bind')],
      effect: [ab.choose('sq', ab.units('you'), 1, { upTo: true }), ab.power(bound('sq'), 3000)],
      text: text(ID(33), 0),
    }),
    ab.auto({
      id: '2',
      zones: ['bind'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.yourTurn(),
        ab.exists(ab.units('you', ['VC', 'RC'], { attacking: true, nameIncludes: 'Rex' })),
        ab.battleTarget(true),
      ),
      cost: [ab.counterBlast(1), ab.retireCost(rearGuards())],
      optional: true,
      effect: [ab.superiorCall(ab.self())],
      text: text(ID(33), 1),
    }),
  ],
  // Stealth Dragon, Oboro Keeper
  [ID(34)]: [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      cost: [ab.moveChosenCost(rearGuards({ name: nameOf(ID(34)) }), 'deck_top', 2)],
      optional: true,
      effect: searchToHand('ok', { grade: { min: 3, max: 3 } }),
      text: text(ID(34)),
    }),
  ],
  // Crownholder Dragon
  [ID(35)]: [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits(undefined, {
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: KAISER },
      }),
      effect: [
        ab.choose('ch', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.power(bound('ch'), 2000),
        ab.power(ab.self(), 2000),
      ],
      text: text(ID(35)),
    }),
  ],
  // Beast Deity, Dragotwist
  [ID(36)]: [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.stands(),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      condition: vanguardNamed('Beast Deity'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('me', ab.self()),
        ab.choose('dt', oppRearGuards({ powerAtMostOf: 'me' }), 1, { upTo: true }),
        ab.retire(bound('dt')),
      ],
      text: text(ID(36)),
    }),
  ],
  // Dimensional Robo, Daibazooka
  [ID(37)]: [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed(KAISER),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text(ID(37), 0),
    }),
    ab.cont({
      id: 'trigger_grade',
      zones: ['any'],
      effects: [{ ce: 'deck_grade', amount: 1, vanguardNameIncludes: KAISER, zone: 'trigger' }],
      text: text(ID(37), 1),
    }),
    ab.auto({
      id: 'trigger_charge',
      zones: ['any'],
      trigger: {
        on: 'check_reveals',
        check: 'drive',
        who: { owner: 'you' },
        card: { isSource: true },
      },
      condition: vanguardNamed(KAISER),
      effect: ccSc,
      text: text(ID(37), 1),
    }),
  ],
  // Clearout Star-vader, Buromin
  [ID(38)]: [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: ab.all(
        vanguardNamed('Star-vader', { grade: { min: 3, max: 3 } }),
        ab.exists(ab.cards('opponent', ['locked'])),
      ),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.search('bi', { nameIncludes: 'Infinite' }),
        ab.superiorRide(bound('bi')),
        ab.rest(ab.units('you', ['VC'])),
        ab.shuffle(),
      ],
      text: text(ID(38)),
    }),
  ],
  // Death Flag Dragger
  [ID(39)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      condition: hasGrade3InHand,
      effect: [
        ab.may('Reveal a grade 3 card from your hand to use this ability?', [
          ...revealGrade3,
          ...searchToHand('df', { nameIncludes: 'Bad End' }),
        ]),
      ],
      text: text(ID(39)),
    }),
  ],
  // Blade Wing Sullivan
  [ID(40)]: [
    ab.cont({
      id: '1',
      zones: ['VC'],
      condition: ab.soulCountAtLeast(15),
      effects: [ab.gets(ab.cards('you', ['GC']), 'shield', 10000)],
      text: text(ID(40), 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['VC'],
      trigger: ab.atStartOf('close_step', 'opponent'),
      triggerIf: ab.is(ab.self(), { beingAttacked: true }),
      condition: ab.soulCountAtLeast(15),
      effect: soulBlastEffect(2),
      text: text(ID(40), 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('sr', rearGuards()),
        ab.search('ss', { sameNameAsBound: 'sr', excludeSelf: true }, 3),
        ab.moveTo(bound('ss'), 'soul'),
        ab.shuffle(),
      ],
      text: text(ID(40), 1),
    }),
  ],
  // Nightmare Doll Master, Brenda
  [ID(41)]: [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('bd', ab.cards('you', ['soul'], { race: 'Workeroid' }), 1, { upTo: true }),
        ab.superiorCall(bound('bd')),
        ab.grant(
          bound('bd'),
          ab.auto({
            id: 'brenda_return',
            zones: ['any'],
            trigger: { on: 'put_into_soul', who: 'self', fromRC: true },
            effect: [
              ab.choose('bb', ab.cards('you', ['soul'], { name: nameOf(ID(41)) })),
              ab.superiorCall(bound('bb')),
            ],
            text: '[AUTO]:When this unit is put into your soul from (RC), choose a card named "Nightmare Doll Master, Brenda" from your soul, and call it to (RC).',
          }),
        ),
      ],
      text: text(ID(41), 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'soul'),
      effect: [ab.lose(ab.self(), { ability: '1' })],
      text: text(ID(41), 1),
    }),
  ],
  // Reform-calling Gear Eagle
  [ID(42)]: [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: hitsVanguard,
      condition: vanguardNamed('Chronoscommand'),
      effect: [
        ab.choose('tl', rearGuards({ excludeSelf: true }), 1, { upTo: true }),
        ab.timeLeap(bound('tl')),
      ],
      text: text(ID(42), 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides({ owner: 'you', filter: { nameIncludes: 'Chronoscommand' } }),
      triggerIf: ab.yourTurn(),
      cost: [ab.moveChosenCost(rearGuards(), 'deck_bottom')],
      optional: true,
      effect: [
        ab.lookTop('el', 10),
        ab.choose('et', bound('el', { abilityTextIncludes: 'ime leap' }), 2, { upTo: true }),
        ab.reveal(bound('et')),
        ab.toHand(bound('et')),
        ab.shuffle(),
      ],
      text: text(ID(42), 1),
    }),
  ],
  // Seven Seas Sage, Plegeton
  [ID(43)]: [
    ab.auto({
      id: '1',
      zones: ['drop'],
      trigger: ab.atStartOf('ride_phase'),
      condition: vanguardNamed('Seven Seas', { grade: { min: 2 } }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.superiorRide(ab.self())],
      text: text(ID(43), 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('pl', ab.cards('you', ['drop']), 1, { upTo: true }),
        ab.superiorCall(bound('pl')),
        retireAtEnd(bound('pl')),
      ],
      text: text(ID(43), 1),
    }),
  ],
  // Friend of the Sun, Marlkka
  [ID(44)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.returnedToHand(),
      condition: vanguardNamed('Pacifica'),
      effect: [
        ...searchToHand('mk', { nameIncludes: 'Pacifica' }),
        ...revealThreePacifica('mv', [
          ...ccSc,
          ab.choose('mp', ab.units('you'), 1, { upTo: true }),
          ab.power(bound('mp'), 5000),
        ]),
      ],
      text: text(ID(44)),
    }),
  ],
  // Amphibian Dragon
  [ID(45)]: [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      triggerIf: ab.battleAtLeast(3),
      effect: [
        ab.search('at', { nameIncludes: 'Trans-core' }),
        ab.moveTo(bound('at'), 'bind'),
        ab.shuffle(),
      ],
      text: text(ID(45), 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('ride_phase'),
      condition: ab.exists(ab.units('you', ['VC'], { grade: { min: 2 } })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('ar', ab.cards('you', ['bind'], { nameIncludes: 'Trans-core' }), 1, {
          upTo: true,
        }),
        ab.superiorRide(bound('ar')),
      ],
      text: text(ID(45), 1),
    }),
  ],
  // Elite Mutant, Tryghul
  [ID(46)]: [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('ride_phase', 'opponent'),
      condition: ab.exists(ab.units('opponent', ['VC', 'RC'], { orientation: 'rest' })),
      effect: [
        ab.lookTop('tl', 5),
        ab.choose('tg', bound('tl', { nameIncludes: 'Giraffa' }), 1, { upTo: true }),
        ab.reveal(bound('tg')),
        ab.toHand(bound('tg')),
        ab.shuffle(),
      ],
      text: text(ID(46)),
    }),
  ],
  // Honorary Assistant, Mikesaburo
  [ID(47)]: [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.duringYourMainPhase(),
      effect: [
        ab.choose('ma', rearGuards({ excludeSelf: true })),
        ab.grant(
          bound('ma'),
          ab.auto({
            id: 'mikesaburo_search',
            zones: ['any'],
            trigger: ab.putIntoDropFrom('RC'),
            condition: ab.duringYourEndPhase(),
            effect: searchToHand('ms', { grade: { min: 3, max: 3 } }),
            text: '[AUTO]:When this unit is put into your drop zone from (RC) during your end phase, search your deck for up to one grade 3 card, reveal it to your opponent, put it into your hand, and shuffle your deck.',
          }),
        ),
      ],
      text: text(ID(47)),
    }),
  ],
  // Maiden of Waterpot
  [ID(48)]: [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn(
        'RC',
        { owner: 'you', filter: { nameIncludes: 'Maiden of', excludeSelf: true } },
        'deck',
      ),
      condition: vanguardNamed('Maiden of'),
      cost: [
        ab.moveCost(ab.self(), 'soul'),
        ab.moveChosenCost(ab.cards('you', ['drop'], { trigger: 'none', gUnit: false }), 'deck_top'),
      ],
      optional: true,
      effect: [ab.shuffle(), ab.draw(1), ...ab.counterCharge(1)],
      text: text(ID(48)),
    }),
  ],
};
