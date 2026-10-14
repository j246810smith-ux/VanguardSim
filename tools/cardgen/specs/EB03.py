SET = 'EB03'
DOC = 'EB03 "Cavalry of Black Steel" (Extra Booster, D-029)'
PRELUDE = r"""const SB = 'Spike Brothers';
const MEGA = 'Megacolony';
const GP = 'Gold Paladin';
/** "During your battle phase" */
const duringYourBattlePhase = ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' });
/** "[AUTO](VC/RC):When this unit attacks (a vanguard), all of your opponent's units cannot intercept until end of that battle." */
const noIntercept = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attacks(),
    effect: [ab.restrict(ab.units('opponent', ['RC']), 'cannot_intercept', 'end_of_battle')],
    text,
  });
/** "[AUTO]:[Counter-Blast 1] During your battle phase, when this unit is placed on (RC), if you have a <Spike Brothers> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of turn." */
const battleCall5000 = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    triggerIf: duringYourBattlePhase,
    condition: ab.vanguardIs({ clan: SB }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.power(ab.self(), 5000)],
    text,
  });
/** "[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <clan> vanguard, this unit gets [Power] +2000 until end of that battle." */
const clanVanguardAttack2000 = (clan: string, text: string) =>
  attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan }), text });
/** The Vortimer ride chain: "[AUTO]:[Choose one of your <Gold Paladin> rear-guards, and retire it] When a card named <rider> rides this unit, if you have a card named <inSoul> in your soul, you may pay the cost. If you do, look at up to two cards from the top of your deck, search for up to two <Gold Paladin> from among them, call them to separate open (RC), and put the rest on the bottom of your deck in any order." */
const vortimerChain = (rider: string, inSoul: string, text: string) =>
  ab.auto({
    id: '2',
    zones: ['any'],
    trigger: ab.ridden({ name: rider }),
    condition: ab.inSoul(inSoul),
    cost: [ab.retireCost(ab.units('you', ['RC'], { clan: GP }))],
    optional: true,
    effect: [
      ab.lookTop('l', 2),
      ab.choose('c', ab.bound('l', { clan: GP }), 2, { upTo: true }),
      ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
      ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
    ],
    text,
  });
/** "… look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck." */
const flashEdgeCall: Step[] = [...topCallOpen(GP), ab.moveTo(ab.bound('look', { zone: 'deck' }), 'deck_bottom')];"""

CARDS = {
    # ---- Spike Brothers
    # Demonic Lord, Dudley Emperor
    'EB03-001': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2), ab.moveChosenCost(ab.cards('you', ['hand'], { clan: SB }), 'soul', 2)],
      optional: true,
      effect: [
        ab.search('s', { clan: SB }, 2),
        ab.superiorCall(ab.bound('s'), { open: true, separate: true }),
        ab.shuffle(),
      ],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.boostedBy({ clan: SB }),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: {t1},
    })""",
    'EB03-003': 'kamikazeAttack({t})',
    # Jelly Beans
    'EB03-008': r"""ab.act({
      id: '1',
      zones: ['hand'],
      cost: [ab.revealCost(), ab.moveCost(ab.self(), 'deck_bottom')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: SB }), [
          ab.search('s', { clan: SB, nameIncludes: 'Dudley', grade: { max: 2 } }),
          ab.reveal(ab.bound('s')),
          ab.toHand(ab.bound('s')),
          ab.shuffle(),
        ]),
      ],
      text: {t},
    })""",
    'EB03-009': 'battleCall5000({t})',
    'EB03-016': 'battleCall5000({t})',
    # Fierce Leader, Zachary
    'EB03-017': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: SB }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.atNext('close_step', ab.returnSelfToDeck(), 'end_of_battle', 'Return this unit to your deck, and shuffle your deck.'),
      ],
      text: {t},
    })""",
    'EB03-018': 'hitWithFourOthersDraw(SB, {t})',
    'EB03-019': 'placedCharge(SB, {t})',
    # Smart Leader, Dark Bringer
    'EB03-020': r"""riddenCall(SB, {t0}),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.choose('c', ab.cards('you', ['hand'], { clan: SB }), 1, { upTo: true }), ab.superiorCall(ab.bound('c'))],
      text: {t1},
    })""",
    # ---- Megacolony
    # Martial Arts Mutant, Master Beetle
    'EB03-004': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(3)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 2, { upTo: true }),
        ab.restrict(ab.bound('t'), 'cannot_stand', 'next_stand_phase'),
      ],
      text: {t0},
    }),
    clanPurity(MEGA, {t1})""",
    'EB03-010': 'clanVanguardAttack2000(MEGA, {t})',
    'EB03-011': 'noIntercept({t})',
    'EB03-012': 'noIntercept({t})',
    'EB03-022': 'interceptShield(MEGA, {t})',
    'EB03-023': 'hitWithFourOthersDraw(MEGA, {t})',
    'EB03-024': 'placedCharge(MEGA, {t})',
    'EB03-025': 'boostHitDiscardDraw({t})',
    # Megacolony Battler C
    'EB03-026': r"""riddenCall(MEGA, {t0}),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: MEGA }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'])),
        ab.restrict(ab.bound('t'), 'cannot_stand', 'next_stand_phase'),
      ],
      text: {t1},
    })""",
    # ---- Gold Paladin
    # Spectral Duke Dragon
    'EB03-002': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), { cond: 'battle_target', vanguard: true }),
      cost: [ab.counterBlast(2), ab.retireCost(ab.units('you', ['RC'], { clan: GP }), 3)],
      optional: true,
      effect: [ab.stand(ab.self()), ab.lose(ab.self(), { icon: 'twin_drive' })],
      text: {t0},
    }),
    soulNamedBonus('Black Dragon Knight, Vortimer', 1000, {t1})""",
    'EB03-013': 'clanVanguardAttack2000(GP, {t})',
    # Black Dragon Knight, Vortimer
    'EB03-014': r"""soulNamedBonus('Scout of Darkness, Vortimer', 1000, {t0}),
    vortimerChain('Spectral Duke Dragon', 'Scout of Darkness, Vortimer', {t1})""",
    'EB03-015': "...chainStarter(GP, 'Scout of Darkness, Vortimer', ['Spectral Duke Dragon', 'Black Dragon Knight, Vortimer'], {T})",
    # Flash Edge Valkyrie
    'EB03-028': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: flashEdgeCall,
      text: {t},
    })""",
    # Scout of Darkness, Vortimer
    'EB03-029': r"""soulNamedBonus('Black Dragon Whelp, Vortimer', 1000, {t0}),
    vortimerChain('Black Dragon Knight, Vortimer', 'Black Dragon Whelp, Vortimer', {t1})""",
    # Blade Feather Valkyrie
    'EB03-030': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ name: 'Flash Edge Valkyrie' }, 'self', 'vanguard'),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: flashEdgeCall,
      text: {t},
    })""",
    'EB03-031': 'placedHandToSoul(GP, {t})',
    # Falcon Knight of the Azure
    'EB03-032': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: GP, excludeSelf: true })), ab.power(ab.bound('t'), 2000)],
      text: {t},
    })""",
    # ---- Royal Paladin, Shadow Paladin, Kagero
    # White Dragon Knight, Pendragon
    'EB03-005': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('main_phase'),
      effect: [
        ab.lookTop('l', 5),
        ab.choose('r', ab.bound('l', { clan: 'Royal Paladin', grade: { min: 3 } }), 1, { upTo: true }),
        ab.superiorRide(ab.bound('r')),
        ab.shuffle(),
      ],
      text: {t0},
    }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), effect: [ab.power(ab.self(), 5000)], text: {t1} })""",
    # Origin Mage, Ildona
    'EB03-006': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacks(),
      cost: [ab.counterBlast(2), ab.retireCost(ab.units('you', ['RC'], { clan: 'Shadow Paladin' }), 2)],
      optional: true,
      effect: [ab.draw(2), ab.power(ab.self(), 3000, 'end_of_battle')],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })""",
    # Dragonic Lawkeeper
    'EB03-007': r"""ab.act({
      id: '2',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.moveTo(ab.units('opponent', ['RC']), 'bind'),
        ab.atNext(
          'end_phase',
          [
            ab.asOpponent([
              ab.choose('c', ab.cards('you', ['bind'], { boundBySource: true, faceUp: true }), 4, { upTo: true }),
              ab.superiorCall(ab.bound('c'), { separate: true }),
              ab.moveTo(ab.cards('you', ['bind'], { boundBySource: true }), 'drop'),
            ]),
          ],
          'end_of_turn',
          'At the beginning of the end phase of that turn, your opponent chooses up to four face up cards that were bound with this effect from his or her bind zone, calls them to separate (RC), and puts all other cards that were bound with this effect into the drop zone.',
        ),
      ],
      text: {t0},
    }),
    attackBonus(opponentFewRearGuards(), {t1}, ['VC'])""",
}
