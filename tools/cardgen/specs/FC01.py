SET = 'FC01'
DOC = 'FC01 "Fighter\'s Collection 2013" (Japanese-only product, D-029; English text from later printings where one exists)'
PRELUDE = r"""const GP = 'Gold Paladin';
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
  });"""

# reprints whose first printing found is itself a reprint: point at the original
REPRINTS = {
    'FC01-016': 'TD13-004',
    'FC01-017': 'TD13-005',
    'FC01-018': 'TD13-008',
    'FC01-019': 'TD02-005',
    'FC01-026': 'TD07-008',
}

CARDS = {
    # 剛槍の解放者 ブレオベリス (Bleoberis; Japanese only): Break Ride, look at up to two, call up to
    # two Gold Paladin to separate open (RC), the rest to the bottom in any order, vanguard +10000
    'FC01-001': r"""ab.breakRide({
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
      text: {t0},
    }),
    attackVanguardPump(2000, {t1}),
    ab.lord()""",
    # Wisdom Keeper, Metis
    'FC01-002': r"""ab.breakRide({
      id: 'br',
      clan: GEN,
      cost: [ab.counterBlast(1)],
      effect: [ab.draw(1), ab.soulCharge(3), vanguardPlus10000()],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.soulCharge(1), ab.power(ab.self(), 1000, 'end_of_battle')],
      text: {t1},
    }),
    ab.lord()""",
    # 抹消者 エレクトリックシェイパー・ドラゴン (Electric Shaper Dragon; Japanese only): Break Ride
    # grants "when your card's effect puts an opposing rear-guard into the drop zone, retire the
    # opposing back-row rear-guard in the same column as the (RC) it was on"
    'FC01-003': r"""ab.breakRide({
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
            text: '【自】【(V)】：あなたのカードの効果で、相手のリアガードがドロップゾーンに置かれた時、そのカードがあった(R)と同じ縦列の後列にいる相手のリアガードを１枚選び、退却させる。',
          }),
        ),
      ],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: ab.count(ab.cards('opponent', ['damage']), { min: 3 }),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: {t1},
    }),
    ab.lord()""",
    # ストーリー・テラー (Story Teller; Japanese only)
    'FC01-004': 'hitDrawCB2(DI, {t})',
    # Pretty Celeb, Charlotte
    'FC01-005': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: BT }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.toHand(ab.self()),
        ab.choose('c', ab.cards('you', ['hand'], { clan: BT, notName: 'Pretty Celeb, Charlotte' }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true }),
      ],
      text: {t},
    })""",
    # Dandelion Musketeer, Mirkka
    'FC01-006': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: NN }),
      condition: ab.all(ab.vanguardIs({ clan: NN }), ab.deckShuffledThisTurn()),
      effect: [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')],
      text: {t},
    })""",
    # 無双祐筆 ポンガ (Ponga; Japanese only): +10000 attacking a vanguard with 12000 or more power
    'FC01-007': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: { cond: 'power', of: ab.attackedUnit(), range: { min: 12000 } },
      effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.vanguardIs({ clan: GN }),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: {t1},
    })""",
    # Water General of Wave-like Spirals, Benedict
    'FC01-025': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.attackedUnit(), { isVanguard: true })),
      condition: ab.vanguardIs({ clan: AQF }),
      effect: [ab.stand(ab.self()), ab.power(ab.self(), -5000)],
      text: {t},
    })""",
}
