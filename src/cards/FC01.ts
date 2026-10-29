/**
 * FC01 "Fighter's Collection 2013" (Japanese-only product, D-029; English text from later printings where one exists) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import { hitDrawCB2, vanguardPlus10000 } from './shapes';

const GP = 'Gold Paladin';
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
  });

export const FC01: SetAbilities = {
  // 剛槍の解放者 ブレオベリス
  'FC01-001': [
    ab.breakRide({
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
      text: '【自】【リミットブレイク】(4)（あなたのダメージが４枚以上で有効）：[【カウンターブラスト】(1)]《ゴールドパラディン》がこのユニットにライドした時、コストを払ってよい。払ったら、あなたの山札の上から２枚まで見て、《ゴールドパラディン》を２枚まで探し、ユニットのいない別々の(R)にコールし、残りのカードを山札の下に好きな順番で置き、あなたのヴァンガードを１枚選び、そのターン中、パワー＋10000。',
    }),
    attackVanguardPump(
      2000,
      '【自】【(V)】：このユニットがヴァンガードにアタックした時、そのバトル中、このユニットのパワー＋2000。',
    ),
    ab.lord(),
  ],
  // Wisdom Keeper, Metis
  'FC01-002': [
    ab.breakRide({
      id: 'br',
      clan: GEN,
      cost: [ab.counterBlast(1)],
      effect: [ab.draw(1), ab.soulCharge(3), vanguardPlus10000()],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When a <Genesis> rides this unit, you may pay the cost. If you do, draw a card, [Soul-Charge 3], choose one of your vanguards, and that unit gets [Power] +10000 until end of turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.soulCharge(1), ab.power(ab.self(), 1000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks a vanguard, [Soul-Charge 1], this unit gets [Power] +1000 until end of that battle.',
    }),
    ab.lord(),
  ],
  // 抹消者 エレクトリックシェイパー・ドラゴン
  'FC01-003': [
    ab.breakRide({
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
      text: '【自】【リミットブレイク】(4)（あなたのダメージが４枚以上で有効）：《なるかみ》がこのユニットにライドした時、あなたのヴァンガードを１枚選び、そのターン中、パワー＋10000し、『【自】【(V)】：あなたのカードの効果で、相手のリアガードがドロップゾーンに置かれた時、そのカードがあった(R)と同じ縦列の後列にいる相手のリアガードを１枚選び、退却させる。』を与える。',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: ab.count(ab.cards('opponent', ['damage']), { min: 3 }),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: '【自】【(V)】：このユニットがアタックした時、相手のダメージゾーンが３枚以上なら、そのバトル中、このユニットのパワー＋2000。',
    }),
    ab.lord(),
  ],
  // ストーリー・テラー
  'FC01-004': [
    hitDrawCB2(
      DI,
      '【自】【(V)/(R)】：[【カウンターブラスト】(2)]このユニットのアタックがヒットした時、あなたの《ダークイレギュラーズ》のヴァンガードがいるなら、コストを払ってよい。払ったら、１枚引く。',
    ),
  ],
  // Pretty Celeb, Charlotte
  'FC01-005': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: BT }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.toHand(ab.self()),
        ab.choose(
          'c',
          ab.cards('you', ['hand'], { clan: BT, notName: 'Pretty Celeb, Charlotte' }),
          1,
          { upTo: true },
        ),
        ab.superiorCall(ab.bound('c'), { open: true }),
      ],
      text: '[AUTO](RC):[Counter-Blast 1] When this unit\'s attack hits a vanguard, if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, return this unit to your hand, choose up to one <Bermuda Triangle> not named "Pretty Celeb, Charlotte" from your hand, and call it to an open (RC).',
    }),
  ],
  // Dandelion Musketeer, Mirkka
  'FC01-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: NN }),
      condition: ab.all(ab.vanguardIs({ clan: NN }), ab.deckShuffledThisTurn()),
      effect: [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a <Neo Nectar>, if you have a <Neo Nectar> vanguard, if your deck had been shuffled due to an effect from one of your cards during this turn, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // 無双祐筆 ポンガ
  'FC01-007': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: { cond: 'power', of: ab.attackedUnit(), range: { min: 12000 } },
      effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
      text: '【自】【(V)】：このユニットがヴァンガードにアタックした時、バトル相手のパワーが12000以上なら、そのバトル中、このユニットのパワー＋10000。',
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.vanguardIs({ clan: GN }),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: '【自】【(R)】：このユニットがヴァンガードにアタックした時、あなたの《グレートネイチャー》のヴァンガードがいるなら、そのバトル中、このユニットのパワー＋2000。',
    }),
  ],
  'FC01-008': { sameAs: 'BT01-021' }, // Knight of Silence, Gallatin
  'FC01-009': { sameAs: 'BT10-022' }, // Fellowship Jewel Knight, Tracie
  'FC01-010': { sameAs: 'BT01-042' }, // Little Sage, Marron
  'FC01-011': { sameAs: 'BT10-046' }, // Stinging Jewel Knight, Shellie
  'FC01-012': { sameAs: 'BT04-043' }, // Black Sage, Charon
  'FC01-013': { sameAs: 'TD08-004' }, // Liberator of Silence, Gallatin
  'FC01-014': { sameAs: 'BT06-082' }, // Knight of Elegant Skills, Gareth
  'FC01-015': { sameAs: 'TD08-010' }, // Little Liberator, Marron
  'FC01-016': { sameAs: 'TD13-004' }, // Battle Maiden, Izunahime
  'FC01-017': { sameAs: 'TD13-005' }, // Battle Maiden, Sahohime
  'FC01-018': { sameAs: 'TD13-008' }, // Battle Maiden, Mihikarihime
  'FC01-019': { sameAs: 'TD02-005' }, // Berserk Dragon
  'FC01-020': { sameAs: 'EB01-012' }, // Bellicosity Dragon
  'FC01-021': { sameAs: 'TD09-004' }, // Eradicator, Thunder Boom Dragon
  'FC01-022': { sameAs: 'BT06-091' }, // Red River Dragoon
  'FC01-023': { sameAs: 'TD09-010' }, // Eradicator, Demolition Dragon
  'FC01-024': { sameAs: 'EB02-016' }, // Velvet Voice, Raindear
  // Water General of Wave-like Spirals, Benedict
  'FC01-025': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { attacking: true }),
        ab.is(ab.attackedUnit(), { isVanguard: true }),
      ),
      condition: ab.vanguardIs({ clan: AQF }),
      effect: [ab.stand(ab.self()), ab.power(ab.self(), -5000)],
      text: '[AUTO](RC)：At the end of the battle that this unit attacked a vanguard, if you have an <Aqua Force> vanguard, [Stand] this unit, and this unit gets [Power] -5000 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
  ],
  'FC01-026': { sameAs: 'TD07-008' }, // Tear Knight, Theo
};
