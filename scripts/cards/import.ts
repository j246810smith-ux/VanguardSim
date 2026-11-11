/**
 * Card importer (Phase 6, DECISIONS D-017/D-018).
 *
 *   npm run cards:import -- BT01 [--refresh] [--images]
 *
 * Reads both official databases (Japanese = canonical set membership and stats, English = the
 * text the engine displays), caches raw pages in data/raw/ (git-ignored), cross-checks JP vs EN
 * stats, and writes data/cards/<SET>.json. Only with `--images` does it also download the card
 * images into assets/cards/ (git-ignored), for the developer's personal offline use (D-018/D-025:
 * art is never committed or redistributed, and the game never downloads it).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CardRecord, Localized, SetFile, SourceRef } from '../../src/cards/record';
import { pairPrintings, type NameDictionary } from './pair';
import { parseApiCard, parseCardPage, parseListPage, type ApiCard, type ParsedCard } from './parse';

const IMPORTER_VERSION = 2;

/**
 * JP/EN differences that are real regional printing differences, checked by hand, and which
 * printing's stats the game uses. Japanese stats are canonical (CARD_DATA policy §1) unless the
 * user chose the English printing (`use: 'en'`, DECISIONS D-020). Both values stay recorded.
 */
const REVIEWED_DIFFERENCES: Readonly<
  Record<string, { readonly reason: string; readonly use: 'jp' | 'en' }>
> = {
  'G-TD03-012': {
    reason:
      'The English page lists the wrong shield; the Japanese value fits the card (a sentinel has shield 0, a grade 1 has 5000, a grade 0 has 10000).',
    use: 'jp',
  },
  'G-TD03-013': {
    reason:
      'The English page lists the wrong shield; the Japanese value fits the card (a sentinel has shield 0, a grade 1 has 5000, a grade 0 has 10000).',
    use: 'jp',
  },
  'G-TD03-019': {
    reason:
      'The English page lists the wrong shield; the Japanese value fits the card (a sentinel has shield 0, a grade 1 has 5000, a grade 0 has 10000).',
    use: 'jp',
  },
  'BT03-052': {
    reason:
      'English BT03 prints Spiral Master as a critical trigger; the Japanese original is a draw trigger (the game uses it: user, 2026-10-28, D-031).',
    use: 'jp',
  },
  'BT03-058': {
    reason:
      'English BT03 prints Herbivorous Dragon, Brutosaurus as a critical trigger; the Japanese original is a draw trigger (the game uses it: user, 2026-10-28, D-031).',
    use: 'jp',
  },
  'BT03-073': {
    reason:
      'English BT03 prints Victory Maker as a critical trigger; the Japanese original is a draw trigger (the game uses it: user, 2026-10-28, D-031).',
    use: 'jp',
  },
  'BT08-058': {
    reason:
      'Black Lily Musketeer, Hermann: the English page gives its race as Battleroid; the Japanese original (and every other Musketeer) is a Bioroid.',
    use: 'jp',
  },
  'BT11-055': {
    reason:
      'Hazard Bob is only in the Japanese BT11; the English set replaced it with an English-only card (Crimson Witch, Radish). Japanese text and stats are used.',
    use: 'jp',
  },
  'BT15-014': {
    reason:
      'Dragonic Burnout: the English database lists no shield; it is a grade 2 [Intercept] unit with 5000 shield, as the Japanese database shows.',
    use: 'jp',
  },
  'BT15-074': {
    reason:
      'Star-vader, Sparkdoll: the English database lists 500 power (a typo); the Japanese database shows 5000 like every grade 0 trigger.',
    use: 'jp',
  },
  'EB06-008': {
    reason:
      'Shining Singer, Ionia: the English page prints "Critical -" (missing); the Japanese database shows 1 like every unit.',
    use: 'jp',
  },
  'G-BT06-015': {
    reason:
      'Extreme Battler, Break-pass: the Japanese database shows the card as updated after the G era (shield 15000, a damage-check draw); the archived 2019 English page is the G-era card (shield 10000), which the game uses.',
    use: 'en',
  },
  'G-TD07-005': {
    reason:
      'Star Magician, Elen: the English page gives its race as Elf; the Japanese database shows Human (the card has no text, so only the race differs).',
    use: 'jp',
  },
  'G-BT02-030': {
    reason:
      'Blue Storm Marine General, Milos: the Japanese database lists the grade 2 unit with [Boost]; every grade 2 unit has [Intercept], as the English page shows.',
    use: 'en',
  },
  'PR11-0020': {
    reason:
      'Sphere Magus: the Japanese database calls it a trigger unit and its text limits it as [Heal], but its trigger field is empty; the English page shows the heal trigger.',
    use: 'en',
  },
  'TD07-004': {
    reason:
      'The Japanese database lists Tear Knight, Lazarus with no shield; every grade 2 [Intercept] unit has 5000 (the English page shows 5000).',
    use: 'en',
  },
};

/**
 * JP base number → EN base number, where identity pairing cannot decide on its own (two English
 * cards with identical stats, clan and race). Each entry was checked by comparing the card art or
 * the katakana name (a direct transliteration of the English name).
 */
const PAIRING_OVERRIDES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // Toypugal and Borgal: both RP grade 1 6000 High Beast; identical art on both sites
  BT03: { '035': '036', '066': '068' },
  // by name: ダッドリー・ダグラス Dudley Douglass, 猛将 ザカリー Fierce Leader, Zachary,
  // 十字撃ち ガープ Cross Shot, Garp (the English EB03 is numbered differently)
  EB03: { '016': '018', '017': '019', '035': '041' },
  // シャイニングシンガー イオニア Shining Singer, Ionia: the English page lacks the critical, so the
  // stats differ (REVIEWED_DIFFERENCES)
  EB06: { '008': '008' },
  // リピス・メイガス Ripis Magus: identical stats to another English card; checked by name
  EB07: { '024': '024' },
  // by name: ツイン・オーダー Twin Order, イニグロイド・コムラード Enigroid Comrade, イニグマン・リプル
  // Enigman Ripple, グローリー・メーカー Glory Maker, 蛹怪人 ギラファ Pupa Mutant, Giraffa,
  // ステルス・ミリピード Stealth Millipede
  BT04: { '027': '028', '053': '055', '054': '056', '055': '057', '062': '064', '063': '065' },
  // by name: ブレイクスルー・ドラゴン Breakthrough Dragon, モアイ・ザ・グレート Moai the Great,
  // 獣神 ブラック・トータス Beast Deity, Black Tortoise
  BT06: { '088': '092', '097': '104', '098': '105' },
  // ティアーナイト ラザロス Tear Knight, Lazarus: the JP page omits its shield (see REVIEWED_DIFFERENCES)
  // 黒百合の銃士 ヘルマン Black Lily Musketeer, Hermann: race differs (see REVIEWED_DIFFERENCES)
  BT08: { '058': '058' },
  // 蒼嵐水将 ミロス Blue Storm Marine General, Milos: the JP page gives [Boost] (see REVIEWED_DIFFERENCES)
  'G-BT02': { '030': '030' },
  // 星の奇術師 エレン Star Magician, Elen: race differs (see REVIEWED_DIFFERENCES)
  'G-TD07': { '005': '005' },
  // メチャバトラー ブチヌーク Extreme Battler, Break-pass: the Japanese card was updated after the G era
  'G-BT06': { '015': '015' },
  // the same numbers on both sites (names checked one by one); the name matcher misses several
  'G-TD03': Object.fromEntries(
    Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(3, '0')).map((n) => [n, n]),
  ),
  // English BT16 "ver.E" is numbered differently and adds cards from other products; by name:
  // 探索者 シングセイバー・ドラゴン Seeker, Thing Saver Dragon, 実直の探索者 エグバート Forthright
  // Seeker, Egbert, 喧嘩屋 ビッグバンナックル・ドラゴン Brawler, Big Bang Knuckle Dragon, 喧嘩屋
  // ワイルドラッシュ・ドラゴン Brawler, Wild Rush Dragon, ブラスター・ブレード・探索者 Blaster Blade
  // Seeker (English only as the Legend printing L02), 喧嘩屋 ビッグバンスラッシュ・ドラゴン Brawler,
  // Big Bang Slash Dragon, 弩弓の探索者 ギルダス Great Crossbow Seeker, Gildas, 連節棍の探索者
  // イスバザード Flail Seeker, Isbuzzard, 先陣の探索者 ファイル Advance Party Seeker, File, 威嚇の喧嘩屋
  // コウメイ Threatening Brawler, Kohmei, 喧嘩屋 ファイティング・ドラコキッド Brawler, Fighting
  // Dracokid, 天弓の探索者 モルヴィ Heaven Bow Seeker, Morvi, 天矢の探索者 リュネート Heaven Arrow
  // Seeker, Lunate, 粗暴の喧嘩屋 シュウギ Violent Brawler, Shuki, ジャンボ・ザ・スタンガン Jumbo the
  // Stungun, 秘宝 ミラージュ・パンサー Prized, Mirage Panther
  BT16: {
    '001': '002',
    '002': '012',
    '003': '005',
    '004': '007',
    '009': 'L02',
    '011': '019',
    '021': '028',
    '022': '030',
    '024': '032',
    '026': '043',
    '028': '045',
    '044': '058',
    '046': '062',
    '052': '091',
    '089': '135',
    '090': '136',
    // Japanese BT16 cards printed in English BT17, by katakana name: アルティメットライザー・MF
    // Mega-flare, フェニックスライザー・DW Drill-wing, シンバスター Sin Buster, ドライオン Drion,
    // 牡丹 (peony) マルティナ Martina, リコリス ヴェラ Vera, アルティメットライザー・DF Dual-flare,
    // フェニックスライザー・FW Flame-wing, ウイングライザー Wingraizer, タンクライザー Tankraizer,
    // キャノンライザー Cannonraizer, カービングライザー Carvingraizer, リザーブライザー Reserveraizer,
    // ウルバスター Ur Buster, ライオネッター Lionetter, ラッセルブリザード Russell Blizzard, 牡丹
    // トゥーレ Toure, リコリス サウル Saul, サンドストーム Sandstorm, シザリオン Scissorion,
    // エクスブレーズ X Blaise, ミストゴースト Mist Ghost, 桔梗 (platycodon) エヴェリーナ Evelina,
    // 水仙 (narcissus) ヨアキム Joachim
    '005': 'BT17/004',
    '013': 'BT17/017',
    '006': 'BT17/005',
    '015': 'BT17/019',
    '008': 'BT17/025',
    '019': 'BT17/010',
    '029': 'BT17/036',
    '030': 'BT17/037',
    '062': 'BT17/090',
    '031': 'BT17/093',
    '064': 'BT17/092',
    '065': 'BT17/094',
    '066': 'BT17/095',
    '033': 'BT17/039',
    '034': 'BT17/040',
    '076': 'BT17/105',
    '040': 'BT17/054',
    '041': 'BT17/055',
    '073': 'BT17/102',
    '074': 'BT17/103',
    '078': 'BT17/107',
    '079': 'BT17/108',
    '097': 'BT17/139',
    '098': 'BT17/140',
  },
  // English BT17 "ver.E" (numbered differently; some cards are in English BT16), by name:
  // プロミネンスコア Prominence Core, ボーテックス・ドラゴニュート Vortex Dragonewt, ビッグバン
  // ナックル・バスター Big Bang Knuckle Buster, パーゲイションブレス Purgation Breath, ティラノ
  // クエイク Tyrannoquake, 勇躍 ケリン Brave Stride Seeker, Cherin, 夕立 (shower) トラヘルン
  // Trahern, 双斧 (twin axe) バッシア Bassia, ワールウインド Whirlwind, ティンダースピア Tinder
  // Spear, マグマアーマー Magmaarmor, ティラノバイト Tyrannobite, ナイトアーマー Knightarmor,
  // ビッグバンスラッシュ・バスター Big Bang Slash Buster, アストロリーパー Astro-reaper, 閃銃
  // (flash gun) オスミウム Osmium, ロビンナイト Robin Knight, イアニス Ianis, スターレス Starless,
  // せぶるみー Sebrumy, さばるみー Sabremy, ルキウス Lucius, ホーリー・ウィザード Holy Wizard,
  // ねいるがる Nalegal, ホーリー・アコライト Holy Acolyte, サバー Sabha, マレイコウ Maleikoh,
  // マレイセイ Maleisei, グルー Grue, コウキン Kohkin, トウコン Tohkon, ボルトナックル Volt
  // Knuckle, 輝線 (emission line) アンチモン Antimony, 光線 (ray) サマリウム Samarium, 日食
  // (eclipse) チャコール Charcoal
  // ペインレーザー Pain Laser, ダークゾディアック Dark Zodiac, メナスレーザー Menace Laser,
  // 煉獄竜騎士 ジャミレフ Perdition Dragon Knight, Jamileh
  BT17: {
    '003': '002',
    '007': '008',
    '012': '012',
    '058': '059',
    // 抹消者 エッグヘルム・ドラコキッド Eradicator, Egghelm Dracokid (same stats as Wildclock Dragon)
    '079': 'BT16/095',
    '001': 'BT16/004',
    '004': '003',
    '005': 'BT16/006',
    '009': 'BT16/011',
    '014': '015',
    '021': 'BT16/029',
    '022': 'BT16/036',
    '024': 'BT16/078',
    '027': '030',
    '028': '031',
    '029': '033',
    '030': '034',
    '031': '035',
    '032': 'BT16/020',
    '033': '044',
    '034': '046',
    '036': '050',
    '041': 'BT16/055',
    '042': 'BT16/056',
    '043': 'BT16/060',
    '044': 'BT16/061',
    '046': 'BT16/066',
    '050': 'BT16/074',
    '051': 'BT16/075',
    '053': 'BT16/080',
    '060': '063',
    '062': '067',
    '063': '068',
    '066': '071',
    '078': 'BT16/090',
    '080': 'BT16/096',
    '081': 'BT16/104',
    '084': '118',
    '085': '120',
    '086': '121',
  },
  // identity pairing fails on a stat difference (see REVIEWED_DIFFERENCES): ドラゴニック・バーンアウト Dragonic
  // Burnout and 星輝兵 スパークドール Star-vader, Sparkdoll, matched by name
  BT15: { '014': '014', '074': '074' },
  TD07: { '004': '004' },
};
/**
 * English "ver.E" boosters that share Japanese cards with each other: English BT16 has the
 * Japanese BT17 Liberators, Deletors and Aqua Force cards, and English BT17 the Japanese BT16
 * Risers, Metalborgs and Musketeers. Their English printings are searched in both sets.
 */
const EN_SHARED_SETS: Readonly<Record<string, readonly string[]>> = {
  BT16: ['BT17'],
  BT17: ['BT16'],
};
/**
 * Sets whose English-only cards join the pool (DECISIONS D-031): the English "ver.E" BT16/BT17
 * printed cards that the Japanese sets do not have. They get the English number as id
 * ('BT16-001EN') and the English record as their only source.
 */
const EN_ONLY_IN_POOL = new Set(['BT16', 'BT17']);
/**
 * Japanese products with no English release (Fighter's Collection 2013, DAIGO Special Set). Their reprints take the
 * English record of the same card from an earlier set; their new cards take it from the English
 * printing listed in EN_PRINTED_ELSEWHERE, and stay Japanese-only otherwise (like BT11-055).
 */
const NO_ENGLISH_SET = new Set(['FC01', 'DG01']);
/** JP base number → English card number of a later English printing (checked by name and stats). */
const EN_PRINTED_ELSEWHERE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // 英知の守り手 メーティス Wisdom Keeper, Metis; プリティセレブ シャルロット Pretty Celeb, Charlotte;
  // タンポポの銃士 ミルッカ Dandelion Musketeer, Mirkka; 波状螺旋の水将 ベネディクト Water General of
  // Wave-like Spirals, Benedict
  FC01: { '002': 'EB12/009EN', '005': 'PR/0048EN', '006': 'PR/0150EN', '025': 'PR/0052EN' },
  // PR cards whose English printing is in an English booster (the "English-only" cards of those sets):
  // みるびる Miru Biru, ドラゴニック・エクスキューショナー Dragonic Executioner, ドラゴンアーマード・ナイト
  // Dragon Armored Knight, カップボウラー Cup Bowler, 天空のイーグルナイト Eagle Knight of the Skies,
  // ジャイロスリンガー Gyro Slinger, カンフーキッド ボルタ Kungfu Kid, Bolta, グレイプショット・ワイバーン
  // Grapeshot Wyvern, 双煌の剣士 マーハウス Twin Shine Swordsman, Marhaus, ブラッディ・カーフ Bloody
  // Calf, メガコロニー戦闘員B Megacolony Battler B, 魔竜導師 マコラガ Demonic Dragon Mage, Mahoraga,
  // ミスリルの召喚術士 Conjurer of Mithril
  PR11: {
    '0013': 'EB03/039EN',
    '0015': 'EB03/017EN',
    '0016': 'EB03/042EN',
    '0018': 'BT06/113EN',
    '0028': 'EB03/038EN',
    '0034': 'EB03/024EN',
    '0038': 'BT06/112EN',
    '0039': 'EB03/043EN',
    '0041': 'EB03/016EN',
    '0047': 'BT03/026EN',
    '0048': 'BT04/036EN',
    '0052': 'BT05/040EN',
    '0053': 'BT05/035EN',
  },
  // DAIGO Special Set: English printed its new cards in Mega Trial Deck MT01 under the same numbers
  DG01: Object.fromEntries(
    ['001', '006', '007', '010', '011', '012', '013'].map((n) => [n, `MT01/${n}EN`]),
  ),
  // PR cards printed in English boosters: 指揮官 ゲイリー・ギャノン Commander, Garry Gannon,
  // くーんがる Coongal, ドレッドチャージ・ドラゴン Dreadcharge Dragon, ブライトランス・ドラグーン
  // Brightlance Dragoon, 軍旗の騎士 ロディーヌ Battle Flag Knight, Laudine, グリード・シェイド Greed
  // Shade, サテライトフォール・ドラゴン Satellitefall Dragon
  PR12: {
    '0050': 'EB03/025EN',
    '0055': 'BT06/089EN',
    '0056': 'BT06/101EN',
    '0057': 'BT06/102EN',
    '0059': 'BT06/090EN',
    '0062': 'BT06/077EN',
    '0063': 'BT06/091EN',
  },
  // later English printings: デトニクス・ドリルドラゴン Detonix Drill Dragon, 遮光の星輝兵 サルファー Shading
  // Star-vader, Sulfur; Duo いいコト日記 シェリル Duo Happy Diary, Sheryl has B/W numbers
  PR14: {
    '0235': 'G-RC01/034EN',
    '0215': 'G-RC01/036EN',
    '0195B': 'PR/0125EN-B',
  },
  // 紅の魔女 ラディッシュ Crimson Witch, Radish was printed in English as BT11/055EN. The A/B promos
  // (光の聖域 ブライトネス・ドラゴン Sanctuary of Light, Brightness Dragon, 霧雨の騎士 ベルナルド Mist Rain
  // Knight, Bernardo, 掟の女神 ユースティティア Goddess of Law, Justitia, 封竜 ジョーゼット Seal Dragon,
  // Georgette, グラビティボルト・ドラゴン Gravity Bolt Dragon, 忍獣 メタモルフォックス Stealth Beast,
  // Metamorfox) have English A/B numbers the PR scan misses.
  PR13: {
    '0117': 'BT11/055EN',
    '0160A': 'PR/0102EN-A',
    '0161A': 'PR/0103EN-A',
    '0162A': 'PR/0104EN-A',
    '0163A': 'PR/0105EN-A',
    '0164A': 'PR/0106EN-A',
    '0165A': 'PR/0107EN-A',
  },
};
/**
 * PR cards (roadmap: docs/design/ORIGINAL_ERA_ROADMAP.md): set PR11 is the official 【2011年度】 list,
 * ids are `PR11-0003` (Japanese number). The English site numbers its PR cards differently and has
 * no yearly lists, so a pair is only accepted from this table, checked by name: JP number → English
 * number. A card not listed here has no English printing and takes its Japanese record.
 */
const PR_PAIRS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // ブラスター・ブレード・バースト Blaster Blade Burst; no English printing: 015 くらうでぃあ
  VZ01: { '001': '0412' },
  // no English printing: 0012 ぐらいむ, 0040 ブラスター・ケロロ
  PR11: {
    '0003': '0011', // 剣帝 ドラゴニック・ヴァルブレイド Sword Emperor, Dragonic Valblade
    '0004': '0006', // エグザイル・ドラゴン Exile Dragon
    '0006': '0004', // 空域の守護 ナイトグリフォン Guardian of the Skies, Night Griffon
    '0008': '0027', // ナイトスクワイヤ アレン Knight Squire Allen
    '0010': '0005', // アルフレッド・アーリー Alfred Early
    '0011': '0022', // ライオンメイン・スタリオン Lion Mane Stallion
    '0014': '0034', // ぎろ Giro
    '0020': '0015', // スフィア・メイガス Sphere Magus
    '0021': '0008', // 不死竜 スカルドラゴン Dragon Undead, Skull Dragon
    '0022': '0009', // キング・シーホース King Seahorse
    '0023': '0016', // ハイドッグブリーダー セイラン High Dog Breeder, Seiran
    '0024': '0014', // ドラゴニック・ヴァニッシャー Dragonic Vanisher
    '0026': '0028', // ワイバーンストライク プラジューリ Wyvern Strike, Plajuri
    '0027': '0013', // 剛剣の騎士 カラドック Knight of the Steel Blade, Caradoc
    '0030': '0023', // ドラゴニック・ウォーターフォウル Dragonic Waterfall
    '0031': '0010', // ホーリーディザスター・ドラゴン Holy Disaster Dragon
    '0033': '0050', // 砲撃竜 スレッジアンキロ Cannon Fire Dragon, Sledge Ankylo
    '0035': '0012', // ナレッジ・ドランカー Knowledge Drunkard
    '0042': '0037', // フレアウィップ・ドラゴン Flare Whip Dragon
    '0043': '0029', // トリプル・ダーク・アーマー Triple Dark Armor
    '0044': '0033', // ダークサイド・ペガサス Darkside Pegasus
    '0046': '0030', // 陸戦支援型イニグシップ Land Battle Support Type, Enigship
    '0051': '0062', // ワイバーンストライク ギュントゥル Wyvern Strike, Gyuntulu
    '0054': '0031', // ノーライフキング デスアンカー No Life King, Death Anchor
  },
  // no English printing: 0064 ブラスター・豆しば, 0065 灼熱の獅子 ケロロエイゼル, 0080 スパイダーマン,
  // 0086 レディバグ・キャヴァリー, 0087 ボルテージクロー・ドラゴン, 0094 くまモン,
  // 0095 珊瑚の王女 テティス, 0101 キッダーニ男爵
  PR12: {
    '0061': '0038', // レッド・マグマ Red Magma
    '0067': '0025', // ザ・ダーク・ディクテイター The Dark Dictator
    '0068': '0032', // 蒼白き月の魔王 Dark Lord of Pale Moon
    '0070': '0018', // ブラックメイン・ウィッチ Blackmane Witch
    '0071': '0039', // ランブルガン・ドラゴン Rumble Gun Dragon
    '0072': '0019', // 媚態のサキュバス Flirtatious Succubus
    '0073': '0020', // サイクリング・アクター Cycling Actor
    '0074': '0021', // ビーカー・ホルスタイン Beaker Holstein
    '0076': '0026', // 学問の体現者 シルベスト Epitome of Knowledge, Silvest
    '0077': '0024', // スタンプ・ラッコ Stamp Sea Otter
    '0081': '0040', // 薬剤の弾丸 エルミエル Medical Gunner, Hermieres
    '0082': '0041', // 突撃竜 サーキュラー・スピノ Assault Dragon, Circular Spino
    '0083': '0035', // 魔竜戦鬼 ヴァスキ Demonic Dragon Berserker, Vasuki
    '0085': '0042', // 戦場の歌姫 ネフェリィ Battle Siren, Neferli
    '0090': '0063', // 残光の騎士 ジェラール Knight of Afterglow, Gerard
    '0091': '0073', // タービュランス・ドラゴン Turbulence Dragon
    '0092': '0036', // エクスカルペイト・ザ・ブラスター Exculpate the Blaster
    '0093': '0044', // クリムゾンライトニング・ドラゴン Crimson Lightning Dragon
    '0096': '0053', // ホーリーエッジ・ナイト Holy Edge Knight
    '0097': '0074', // ドラゴンダンサー ストーミ Dragon Dancer, Stormy
    '0098': '0054', // 忍妖 ガシャドクロ Stealth Fiend, Gashadokuro
    '0099': '0055', // アース・ガンナー Earth Gunner
    '0100': '0083', // ソフトタンク・スロース Soft Tank Sloth
  },
  PR13: {
    '0102': '0070', // 雲海のシールドナイト Shield Knight of the Clouds
    '0107': '0088', // ストームブリング・ドラゴン Storm Bring Dragon
    '0108': '0084', // 輝ける未来 エリア Electrohm, Elia
    '0116': '0060', // 大鷹の解放者 カドー Goshawk Liberator, Cadeau
    '0118': '0049', // 抹消者 スパークホーン・ドラゴン Eradicator, Spark Horn Dragon
    '0120': '0065', // 不死竜 マレフィックドラゴン Dragon Undead, Malefic Dragon
    '0121': '0066', // マシニング・アーマービートル Machining Armor Beetle
    '0122': '0075', // 強襲のスカイナイト Assault Sky Knight
    '0132': '0067', // バトルシスター きゃんでぃ Battle Sister, Candy
    '0133': '0076', // 呪槍の撃退者 ダーマッド Cursed Spear Revenger, Diarmuid
    '0134': '0071', // グラファイトキャノン・ドラゴン Graphite Cannon Dragon
    '0135': '0077', // 星輝兵 ダークバンド・ドラゴン Star-vader, Dark Band Dragon
    '0136': '0110', // 倦怠のサキュバス Indifferent Succubus
    '0137': '0085', // 涙滴の水将 カルロス Tear Drop Marine General, Carlos
    '0139': '0111', // 希望の剣 リシャール Sword of Hope, Richard
    '0143': '0080', // ペンタゴナル・メイガス Pentagonal Magus
    '0150': '0126', // 繚乱の騎士 トゥールーズ Knight of Extravagance, Toulouse
    '0152': '0086', // 敢然の宝石騎士 ジュリア Fearless Jewel Knight, Julia
    '0153': '0112', // 千の名を持つ飛竜騎士 Thousand Name Wyvern Knight
    '0154': '0087', // ジェットライザー Jetraizer
    '0155': '0081', // 次元ロボ ダイバレット Dimensional Robo, Daibarrett
    '0156': '0191', // パンジーの銃士 シルヴィア Pansy Musketeer, Silvia
    '0157': '0192', // テーピング・キャット Taping Cat
    '0158': '0113', // ぱぴるがる Papilugal
    '0166': '0121', // 覚醒の解放者 フリード Awakening Liberator, Freed
    '0169': '0127', // 撃退者 デスマスター・ドラゴン Revenger, Deathmaster Dragon
    '0172': '0098', // 星輝兵 マルチバース・ドラゴン Star-vader, Multiverse Dragon
    '0179': '0122', // シャドウブレイズ・ドラゴン Shadow Blaze Dragon
    '0180': '0100', // ドラゴンダンサー アラベラ Dragon Dancer, Arabella
    '0181': '0114', // 忍獣 バンデットエイプ Stealth Beast, Bandit Ape
    '0183': '0123', // エッグ・ジャグラー Egg Juggler
    '0184': '0108', // メイデン・オブ・ビーナストラップ ミューズ Maiden of Venus Trap Muse
  },
  PR14: {
    '0151': '0119', // ガスト・ブラスター・ドラゴン Gust Blaster Dragon
    '0185': '0115', // 着ぐるみアイドル アルク Costume Idol, Alk
    '0186': '0116', // プラネットアイドル パシフィカ Planet Idol, Pacifica
    '0187': '0117', // シャングリラスター コーラル Shangri-La Star, Coral
    '0203': '0128', // 落日の星輝兵 ダームスタチウム Setting Sun Star-vader, Darmstadtium
    '0210': '0129', // 黄昏の神器 ヘスペリス Twilight Regalia, Hesperis
    '0223': '0130', // 探索者 ライトセイバー・ドラゴン Seeker, Light Saver Dragon
    '0224': '0131', // 探索者 ライトブレイズ・ドラゴン Seeker, Light Blaze Dragon
    '0225': '0132', // 切開の守護天使 マルキダエル Holy Edge Celestial, Malchidael
    '0226': '0133', // 投薬の守護天使 アスモデル Dosage Celestial, Asmodel
    '0227': '0134', // 陰陽の忍鬼 セイメイ Onmyo Stealth Rogue, Seimei
    '0228': '0135', // 変幻の忍鬼 クズノハ Transformation Stealth Rogue, Kuzunoha
    '0229': '0136', // クラッキング・ビーストテイマー Cracking Beast Tamer
    '0230': '0137', // バーキング・スカイタイガー Barking Sky Tiger
    '0231': '0138', // マシニング・タランチュラ mkⅡ Machining Tarantula mk II
    '0232': '0139', // マシニング・ホーネット mkⅡ Machining Hornet mk II
    '0233': '0140', // 魔法科学者 テスター・フォックス Magic Scientist, Tester Fox
    '0234': '0141', // 幻想科学者 リサーチャー・フォックス Illusion Scientist, Researcher Fox
    '0237': '0211', // 溢れ出す夢 マドレ Dream Team, Madre
    '0243': '0217', // 溢れ出す夢 ディオス Dream Team, Dios
    '0244': '0218', // 永遠の宝物 ローレンス Eternal Memory, Lorens
    '0245': '0219', // 虹色の合図 ウルミア Mirage Sign, Urmia
    '0248': '0153', // 変革の騎士 ラディナス Knight of Reform, Ladinas
    '0252': '0154', // お天気お姉さん らむね Weather Girl, Ramune
    '0254': '0155', // 忍獣 トビヒコ Stealth Beast, Tobihiko
    '0255': '0156', // 喧嘩屋 アースクラック・ドラゴン Brawler, Earthcrack Dragon
    '0256': '0158', // キング・サーペント King Serpent
    '0259': '0166', // 勝機の宝石騎士 イーヴァン Prevail Jewel Knight, Yvain
    '0260': '0167', // 宝石騎士 そーどみー Jewel Knight, Swordmy
    '0261': '0181', // バトルシスター たふぃー Battle Sister, Taffy
    '0265': '0151', // メッチャリーダー レイバード Extreme Leader, Raybird
    '0269': '0174', // サンクチュアリガード・ギャランティ Sanctuary Guard Guarantee
    '0270': '0175', // マジカル・ギャンブラー Magical Gambler
    '0272': '0177', // ハイドロランス ツァニス Hydro Lance, Tzanis
    '0273': '0178', // ラベル・パンゴリン Label Pangolin
    '0274': '0179', // スッパ・スッパー Sour Slicer
    '0285': '0142', // 宝鏡の女神 オオヒルメ Goddess of the Treasured Mirror, Ohirume
    '0287': '0143', // 期待の新星 トロワ Rising Star, Trois
    '0289': '0144', // 騎士王の先導者 エゼル King of Knights' Vanguard, Ezzell
    '0291': '0163', // 真・究極次元ロボ グレートダイカイザー True Ultimate Dimensional Robo, Great Daikaiser
    '0293': '0164', // アモンの主謀者 アスタロト Amon's Leader, Astaroth
  },
};
/**
 * G-era cards on a PR list: not Original Era cards, so they are left out of the list's set and wait
 * for the Expanded Era's PR cards (roadmap): ハーモニクス・メサイア, ヒートエレメント マグム (G units),
 * スチームファイター メスヘデ (Gear Chronicle, G Break).
 */
const G_ERA_ON_PR_LIST: Readonly<Record<string, readonly string[]>> = {
  PR14: ['0250', '0258', '0271'],
};
const prYear = (s: string) => /^PR(\d{2})$/.exec(s)?.[1] ?? null;
/**
 * Products imported like a PR list: only cards new to the game, reprints recorded by Japanese
 * name. VZ01 is the "Cardfight!! Vanguard 0" Start Set (number VZ/001, product 【VZ】, 2013).
 */
const isListProduct = (s: string) => prYear(s) !== null || s === 'VZ01';
/** The last English PR number is found by asking until this many numbers in a row do not exist. */
const EN_PR_MISSES = 15;
const HOSTS = { en: 'https://en.cf-vanguard.com', jp: 'https://cf-vanguard.com' } as const;
const DELAY_MS = 400; // be polite to the official site
const USER_AGENT = 'VanguardSim card importer (personal offline simulator)';

type Site = keyof typeof HOSTS;

const args = process.argv.slice(2);
const set = args.find((a) => !a.startsWith('--'));
const refresh = args.includes('--refresh');
const images = args.includes('--images');
// boosters, trial decks and the side sets of DECISIONS D-029
// …and the G era's products (DECISIONS D-034): G-BT01, G-TD01, G-EB01, G-CB01, G-CHB01, G-FC01, …
if (!set || !/^((BT|TD|EB|FC|DG|MBT|MTD)\d{2}|G-[A-Z]{2,4}\d{2}|PR1[1-4]|VZ01)$/.test(set)) {
  console.error(
    'usage: npm run cards:import -- BT01|TD01|EB01|FC01|MBT01|G-TD01|G-BT01|PR11|… [--refresh] [--images]',
  );
  process.exit(2);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

async function fetchRaw(url: string, attempts = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    await sleep(DELAY_MS * i);
    requests++;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return res;
    // the official site occasionally answers 404/5xx for a page that exists; retry a couple of times
    if (i >= attempts) throw new Error(`HTTP ${res.status} for ${url}`);
    console.warn(`HTTP ${res.status} for ${url}, retrying`);
  }
}

/** Fetches a page, using the raw cache unless --refresh. Returns HTML and when it was fetched. */
async function page(
  site: Site,
  path: string,
  cacheName: string,
  forSet: string = set!,
): Promise<{ html: string; fetchedAt: string }> {
  const file = join('data', 'raw', site, forSet, `${cacheName.replace(/[/\\?&=]/g, '_')}.html`);
  const meta = `${file}.meta`;
  // an empty cached page is a download that failed: fetch it again
  if (!refresh && existsSync(file) && existsSync(meta) && statSync(file).size > 0) {
    return { html: readFileSync(file, 'utf8'), fetchedAt: readFileSync(meta, 'utf8').trim() };
  }
  const html = await (await fetchRaw(HOSTS[site] + path)).text();
  const fetchedAt = new Date().toISOString();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  writeFileSync(meta, fetchedAt);
  return { html, fetchedAt };
}

const TWIN_PRINT_SETS: ReadonlySet<string> = new Set(['EB10']);
const firstNumber = (site: Site, s: string) =>
  site === 'en' ? `${s}/001EN${TWIN_PRINT_SETS.has(s) ? '-B' : ''}` : `${s}/001`;
const cardPath = (no: string) => `/cardlist/?cardno=${no}`;

/** Find the set's expansion ID on a site: the product listed on card 001 whose list contains it. */
async function expansionOf(site: Site, s: string): Promise<number> {
  const { html } = await page(site, cardPath(firstNumber(site, s)), firstNumber(site, s), s);
  const card = parseCardPage(html, site);
  for (const exp of card.expansions) {
    const list = await page(site, `/cardlist/cardsearch/?expansion=${exp}`, `list_${exp}_1`, s);
    if (parseListPage(list.html, site).numbers.includes(firstNumber(site, s))) return exp;
  }
  throw new Error(`${site}: could not find the expansion for ${s}`);
}

async function listNumbers(site: Site, exp: number, s: string): Promise<string[]> {
  const first = parseListPage(
    (await page(site, `/cardlist/cardsearch/?expansion=${exp}`, `list_${exp}_1`, s)).html,
    site,
  );
  const numbers = [...first.numbers];
  for (let p = 2; p <= first.maxPage; p++) {
    const more = await page(
      site,
      `/cardlist/cardsearch_ex/?expansion=${exp}&view=image&page=${p}`,
      `list_${exp}_${p}`,
      s,
    );
    numbers.push(...parseListPage(more.html, site).numbers);
  }
  return [...new Set(numbers)].filter((n) => n.startsWith(`${s}/`));
}

interface Fetched {
  readonly card: ParsedCard;
  readonly source: SourceRef;
}

/**
 * The Japanese site since its 2026-10 redesign: card pages are filled by JavaScript from a JSON
 * API (the page's PWOCG_CFG: apiBase /manage, endpoints card-list-user/products, /list, /detail).
 * Responses are cached in data/raw/jp/<SET>/ like the pages. Sets imported before the redesign
 * keep their cached pages (fetchSite uses those when present).
 */
const API = '/manage/card-list-user';
async function apiJson<T>(path: string, cacheName: string, s: string) {
  const { html, fetchedAt } = await page('jp', path, cacheName, s);
  return { data: JSON.parse(html) as T, fetchedAt };
}

async function fetchJpApi(s: string): Promise<Fetched[]> {
  const products = await apiJson<{ items: { id: string; name: string }[] }>(
    `${API}/products`,
    'api_products',
    s,
  );
  const year = prYear(s);
  const productName = year ? `【20${year}年度】PRカード` : s === 'VZ01' ? '【VZ】' : `【${s}】`;
  const product = products.data.items.find((p) => p.name.startsWith(productName));
  if (!product) throw new Error(`jp: no product named ${productName} in the card list`);
  const numbers: string[] = [];
  for (let p = 1; p < 50; p++) {
    const { data } = await apiJson<{ total: number; items: { card_number: string }[] }>(
      `${API}/list?title=${product.id}&page=${p}&per_page=100`,
      `api_list_${product.id}_${p}`,
      s,
    );
    numbers.push(...data.items.map((i) => i.card_number));
    if (data.items.length === 0 || numbers.length >= data.total) break;
  }
  const own = [...new Set(numbers)].filter((n) =>
    n.startsWith(year ? 'PR/' : s === 'VZ01' ? 'VZ/' : `${s}/`),
  );
  console.log(`jp ${s}: product ${product.id} ${product.name} (API), ${own.length} printings`);
  const out: Fetched[] = [];
  for (const no of own) {
    const path = `${API}/detail?cardno=${encodeURIComponent(no)}`;
    const { data, fetchedAt } = await apiJson<{ card: ApiCard; expansions: { id: string }[] }>(
      path,
      `api_${no}`,
      s,
    );
    let card: ParsedCard;
    try {
      card = parseApiCard(data.card, data.expansions);
    } catch (e) {
      throw new Error(`jp ${no}: ${(e as Error).message}`, { cause: e });
    }
    out.push({ card, source: { url: HOSTS.jp + path, fetchedAt, regulation: card.regulation } });
  }
  return out;
}

/** Was this set imported from the old Japanese pages (their cache is still there)? */
const hasPageCache = (s: string) => {
  const dir = join('data', 'raw', 'jp', s);
  return existsSync(dir) && readdirSync(dir).some((f) => /^list_\d+_1\.html$/.test(f));
};

/** Every English PR card, read by number (they are cached across the yearly sets in data/raw/en/PR). */
async function fetchEnPr(): Promise<Fetched[]> {
  const out: Fetched[] = [];
  for (let n = 1, misses = 0; misses < EN_PR_MISSES; n++) {
    const no = `PR/${String(n).padStart(4, '0')}EN`;
    const { html, fetchedAt } = await page('en', cardPath(no), no, 'PR');
    if (!/cardlist_detail/.test(html) || !html.includes('class="face"')) {
      misses++;
      continue;
    }
    misses = 0;
    let card: ParsedCard;
    try {
      card = parseCardPage(html, 'en');
    } catch (e) {
      // not a unit (no power or grade): tokens and the like are not cards of this game
      console.log(`  note: ${no} skipped: ${(e as Error).message}`);
      continue;
    }
    out.push({
      card,
      source: { url: HOSTS.en + cardPath(no), fetchedAt, regulation: card.regulation },
    });
  }
  console.log(`en PR: ${out.length} printings`);
  return out;
}

/** PR lists hold a card several times (other art): the lowest number is the base, the rest printings. */
function groupPr(site: Site, fetched: Fetched[]): ReturnType<typeof group> {
  const key = (f: Fetched) => /^(?:PR|VZ)\/(\d{3,4}[A-Z]?)(?:EN.*)?$/.exec(f.card.number)![1]!;
  const bases = new Map<string, Fetched>();
  const printings = new Map<string, string[]>();
  for (const f of [...fetched].sort((a, b) => key(a).localeCompare(key(b)))) {
    const base = [...bases].find(([, b]) => b.card.name === f.card.name);
    if (base) printings.get(base[0])!.push(f.card.number);
    else {
      bases.set(key(f), f);
      printings.set(key(f), [f.card.number]);
    }
  }
  return { bases, printings, specials: new Map() };
}

/**
 * Since its 2026-11 redesign the English site fills its card pages with JavaScript from an API we
 * do not use, so G-era sets not cached before then are read from Internet Archive copies of the
 * old English card pages (user's choice, 2026-11-11). One CDX query lists every archived card URL
 * of the set; each card takes its newest pre-2020 copy with a card detail block (the G-era text),
 * else its newest copy of any date. Cached in data/raw/archive/<SET>/.
 */
const enFromArchive = (s: string) =>
  /^G-/.test(s) && !existsSync(join('data', 'raw', 'en', s)) && !isListProduct(s);

async function archiveGet(url: string, file: string): Promise<string> {
  if (!refresh && existsSync(file) && statSync(file).size > 0) return readFileSync(file, 'utf8');
  const body = await (await fetchRaw(url, 5)).text();
  if (/Internet Archive: Temporarily Offline|<title>Wayback Machine<\/title>/.test(body))
    throw new Error(`the Internet Archive is unavailable (${url}); try again later`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  return body;
}

async function fetchEnArchive(s: string): Promise<Fetched[]> {
  const dir = join('data', 'raw', 'archive', s);
  const host = HOSTS.en.replace(/^https:\/\//, '');
  const cdx = await archiveGet(
    `https://web.archive.org/cdx/search/cdx?url=${host}/cardlist/?cardno=${s}/&matchType=prefix&filter=statuscode:200&fl=original,timestamp&output=txt`,
    join(dir, 'cdx.txt'),
  );
  // card number → its archived URLs and timestamps (any extra query parameters are kept)
  const snaps = new Map<string, { url: string; stamp: string }[]>();
  for (const line of cdx.split('\n')) {
    const [url, stamp] = line.trim().split(' ');
    if (!url || !stamp || !/^\d{14}$/.test(stamp)) continue;
    const no = /cardno=([^&]+)/.exec(url)?.[1]?.replace(/%2F/gi, '/');
    if (!no || !new RegExp(`^${s}/[0-9A-Z]+EN$`).test(no)) continue;
    snaps.set(no, [...(snaps.get(no) ?? []), { url, stamp }]);
  }
  const out: Fetched[] = [];
  for (const [no, list] of [...snaps].sort(([a], [b]) => a.localeCompare(b))) {
    const ordered = [
      ...list
        .filter((x) => x.stamp < ARCHIVE_BEFORE)
        .sort((a, b) => b.stamp.localeCompare(a.stamp)),
      ...list
        .filter((x) => x.stamp >= ARCHIVE_BEFORE)
        .sort((a, b) => b.stamp.localeCompare(a.stamp)),
    ];
    let found: Fetched | null = null;
    for (const { url, stamp } of ordered.slice(0, 4)) {
      const file = join(dir, `${no.replace(/[/\\?&=]/g, '_')}_${stamp}.html`);
      const html = await archiveGet(`https://web.archive.org/web/${stamp}id_/${url}`, file);
      if (!/cardlist_detail/.test(html)) continue;
      let card: ParsedCard;
      try {
        card = parseCardPage(html, 'en');
      } catch {
        continue;
      }
      if (isUpdated(card.text)) continue;
      const at = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}Z`;
      found = {
        card,
        source: {
          url: `https://web.archive.org/web/${stamp}/${url}`,
          fetchedAt: at,
          regulation: card.regulation,
        },
      };
      break;
    }
    if (found) out.push(found);
    else console.log(`  en ${no}: no usable archived copy`);
  }
  console.log(`en ${s}: ${out.length} printings from the Internet Archive`);
  return out;
}

async function fetchSite(site: Site, s: string = set!): Promise<Fetched[]> {
  if (site === 'en' && isListProduct(s)) return fetchEnPr();
  if (site === 'en' && enFromArchive(s)) return fetchEnArchive(s);
  if (site === 'jp' && (refresh || !hasPageCache(s))) return fetchJpApi(s);
  const exp = await expansionOf(site, s);
  const numbers = await listNumbers(site, exp, s);
  console.log(`${site} ${s}: expansion ${exp}, ${numbers.length} printings`);
  const out: Fetched[] = [];
  for (const no of numbers) {
    const { html, fetchedAt } = await page(site, cardPath(no), no, s);
    let card: ParsedCard;
    try {
      card = parseCardPage(html, site);
    } catch (e) {
      throw new Error(`${site} ${no}: ${(e as Error).message}`, { cause: e });
    }
    out.push({
      card,
      source: { url: HOSTS[site] + cardPath(no), fetchedAt, regulation: card.regulation },
    });
  }
  return out;
}

// EB10 prints every card twice ('EB10/001B' / 'EB10/001EN-B' black, '…W' white art): the B
// printing is the base, the W one an alternate printing found by name
const baseRe = (site: Site, s: string) =>
  new RegExp(`^${s}/(\\d{3})${site === 'en' ? 'EN(?:-B)?' : 'B?'}$`);

/** Base printings by 3-digit number, and every printing grouped under its base by card name. */
function group(site: Site, fetched: Fetched[], s: string = set!) {
  const bases = new Map<string, Fetched>();
  for (const f of fetched) {
    const m = baseRe(site, s).exec(f.card.number);
    if (m) bases.set(m[1]!, f);
  }
  const printings = new Map<string, string[]>();
  for (const [no, f] of bases) printings.set(no, [f.card.number]);
  /** Skipped special printings by short number ('L02'), usable as pairing-override targets. */
  const specials = new Map<string, Fetched>();
  for (const f of fetched) {
    if (baseRe(site, s).test(f.card.number)) continue;
    // exact name first; the official data sometimes differs in punctuation between printings
    const loose = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const base =
      [...bases].find(([, b]) => b.card.name === f.card.name) ??
      [...bases].find(([, b]) => loose(b.card.name) === loose(f.card.name));
    if (!base) {
      // special "S" printings sometimes reprint a card from another set (BT10/S12 Blaster Blade
      // Liberator is BT09's), and the English "ver.E" BT16/BT17 add "L" (Legend) printings of
      // cards from trial and Legend decks (BT16/L02EN Blaster Blade Seeker is TD14's); those
      // cards are imported with their own set (Japanese set membership is canonical)
      // …and the G boosters' "SR" printings reprint earlier G sets' cards (G-BT04/SR01 is G-BT01/001),
      // and their "Re:" printings revive Classic-era cards (G-BT08/Re:01 Amnesty Messiah is BT11's)
      if (/\/(S|L|SR|Re:)\d+/.test(f.card.number)) {
        if (s === set) {
          console.log(`  note: ${f.card.number} (${f.card.name}) is not a card of ${s}; skipped`);
        }
        specials.set(f.card.number.slice(s.length + 1).replace(/EN$/, ''), f);
        continue;
      }
      throw new Error(`${site}: printing ${f.card.number} (${f.card.name}) matches no base card`);
    }
    if (base[1].card.name !== f.card.name) {
      console.log(
        `  note: ${f.card.number} is named "${f.card.name}" but its base card is "${base[1].card.name}"`,
      );
    }
    printings.get(base[0])!.push(f.card.number);
  }
  return { bases, printings, specials };
}

/**
 * A pairing override may name a special printing ('L02'): the Japanese base card exists in this
 * set, but the English set only has it as a special printing (BT16-009 Blaster Blade Seeker is
 * BT16/L02EN). That printing then serves as the English base, with its same-name siblings.
 */
function useSpecials(g: ReturnType<typeof group>, overrides: Readonly<Record<string, string>>) {
  for (const target of Object.values(overrides)) {
    const f = g.specials.get(target);
    if (!f || g.bases.has(target)) continue;
    g.bases.set(target, f);
    g.printings.set(
      target,
      [...g.specials.values()].filter((o) => o.card.name === f.card.name).map((o) => o.card.number),
    );
  }
}

/**
 * DECISIONS D-034: the G format plays G-era cards with the text they had in the G era. Cards the
 * official database marks "Updated: Text" were rewritten after the G era (2019 onward, e.g. the
 * Imaginary Gift updates); their G-era text comes from the newest Internet Archive copy of the
 * English card page from before 2020 that does not carry the update. Cached in data/raw/archive.
 */
const ARCHIVE_BEFORE = '20200101';
const isUpdated = (text: string) => /^(Updated:|アップデート：)/.test(text);

/**
 * G-era cards rewritten after the G era whose official page was never archived (D-034). The two
 * G units and Cafar come from a pre-2020 snapshot of the card wiki. The other three have no snapshot
 * either: their text is the current text without the lines added later, the same difference the
 * archived cards of each kind show (a G unit loses its Imaginary Gift [ACT] and "even if the attack
 * did not hit" [CONT]; a former critical trigger loses "revealed for a damage check", shield 10000).
 */
const STRIDE_LINE =
  '[Stride]-Stride Step-[COST][Choose one or more cards from hand with the sum of their grades being 3 or greater, and discard them], and [Stride] this card on your (VC) from face down.';
const NO_OFFICIAL_ARCHIVE: Readonly<
  Record<string, { text: string; shield?: number; url: string; stamp: string }>
> = {
  'G-TD03-001': {
    text: `${STRIDE_LINE}\n[AUTO](VC):When this unit's attack hits a vanguard, choose one of your rear-guards, search your deck for up to one card with the same name as that unit, call it to (RC), shuffle your deck, and the unit called with this effect gets [Power] +2000 until end of turn.`,
    url: 'https://web.archive.org/web/20190721000620/https://cardfight.fandom.com/wiki/Flower_Princess_of_Spring,_Arborea',
    stamp: '2019-07-21T00:06:20.000Z',
  },
  'G-BT03-032': {
    text: `${STRIDE_LINE}\n[AUTO](VC):When this unit's attack hits a vanguard, choose one of your rear-guards, search your deck for up to two cards with the same card name as that unit, call them to separate (RC), shuffle your deck, and at the end of that turn, put the units called with this effect on the bottom of your deck in any order.`,
    url: 'https://web.archive.org/web/20190917003808/https://cardfight.fandom.com/wiki/Ambush_Demon_Stealth_Fiend,_Ushimitsu_Train',
    stamp: '2019-09-17T00:38:08.000Z',
  },
  'G-BT03-039': {
    text: `${STRIDE_LINE}\n[AUTO](VC):When this unit's attack hits a vanguard, [Soul-Charge 2], if the number of cards in your soul is six or more, draw a card.`,
    url: 'https://web.archive.org/web/20191021145110/https://cardfight.fandom.com/wiki/Love_Tempest,_Kisskill_Lira',
    stamp: '2019-10-21T14:51:10.000Z',
  },
  'G-BT04-015': {
    text: '[AUTO](RC):[Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with "Claret Sword Dragon" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets [Power] +5000 until end of that battle.',
    shield: 10000,
    url: 'https://web.archive.org/web/20190824222201/https://cardfight.fandom.com/wiki/Taboo_Mage,_Cafar',
    stamp: '2019-08-24T22:22:01.000Z',
  },
  'G-BT04-032': {
    text: `${STRIDE_LINE}\n[AUTO](VC):When this unit's attack hits a vanguard, [COST][Soul-Blast 3], look at the top three cards of your deck, choose a card from among them, put it into your hand, and put the rest into your soul.`,
    url: 'https://en.cf-vanguard.com/cardlist/?cardno=G-BT04/032EN',
    stamp: '2026-11-06T00:00:00.000Z',
  },
  'G-BT05-012': {
    text: '[AUTO](RC):[Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with "Susanoo" in its card name, you may pay the cost. If you do, draw a card, choose up to one of your vanguards, and it gets [Power] +5000 until end of that battle.',
    shield: 10000,
    url: 'https://en.cf-vanguard.com/cardlist/?cardno=G-BT05/012EN',
    stamp: '2026-11-06T00:00:00.000Z',
  },
  'G-BT05-015': {
    text: '[AUTO](RC):[Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with "Vanquisher" in its card name, you may pay the cost. If you do, draw a card, choose up to one of your vanguards, and it gets [Power] +5000 until end of that battle.',
    shield: 10000,
    url: 'https://en.cf-vanguard.com/cardlist/?cardno=G-BT05/015EN',
    stamp: '2026-11-06T00:00:00.000Z',
  },
};

/**
 * G-BT06 onward (read from the Internet Archive): cards whose official English page was never
 * archived. Name and text from the newest pre-2020 archived copy of their card-wiki page, written
 * in the official notation ("[Counter-Blast 1]"); clan and race are the English names of the
 * Japanese ones. Stats are the Japanese card's.
 */
const WIKI = (stamp: string, page: string) =>
  `https://web.archive.org/web/${stamp}/http://cardfight.wikia.com/wiki/${page}`;
const wikiStamp = (url: string) => {
  const t = /web\/(\d{14})\//.exec(url)![1]!;
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}Z`;
};
/** G-BT07 onward: written by tools/cardgen/wiki_english.py (same shape as the G-BT06 entries below). */
const WIKI_ENGLISH_FILE = join('scripts', 'cards', 'wiki-english.json');
const WIKI_ENGLISH_GENERATED: Readonly<
  Record<string, { name: string; text: string; url: string }>
> = existsSync(WIKI_ENGLISH_FILE) ? JSON.parse(readFileSync(WIKI_ENGLISH_FILE, 'utf8')) : {};
const WIKI_ENGLISH: Readonly<Record<string, { name: string; text: string; url: string }>> = {
  ...WIKI_ENGLISH_GENERATED,
  'G-BT06-042': {
    name: 'Red-leaf Dragon',
    text: '[CONT]:You may have up to sixteen cards named "Red-leaf Dragon" in a deck.\n[AUTO](VC/RC)[Generation Break 1]:[Counter-Blast 1] At the beginning of your main phase, you may pay the cost. If you do, search your deck for up to one card named "Red-leaf Dragon", call it to (RC), shuffle your deck, and until end of turn, this unit gets "[CONT](VC/RC):This unit gets [Power] +1000 for each other unit named "Red-leaf Dragon" on (VC) or (RC).".',
    url: WIKI('20170924065525', 'Red-leaf_Dragon'),
  },
  'G-BT06-045': {
    name: 'Shyngal',
    text: '[AUTO](RC)[Generation Break 1] Brave (This ability is active when you have three or less cards in your hand):When this unit attacks a vanguard, until end of that battle, this unit gets [Power] +2000, and "[AUTO](RC):[Counter-Blast 1] When this unit\'s attack hits, you may pay the cost. If you do, at the end of that turn, draw a card.".',
    url: WIKI('20170106025711', 'Shyngal'),
  },
  'G-BT06-054': {
    name: 'Greymyu',
    text: '[AUTO][Generation Break 1]:[Counter-Blast 1 & Soul-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Claret Sword Dragon" in its card name, you may pay the cost. If you do, search your deck for up to one grade 1 or less card, call it to (RC), shuffle your deck, and this unit gets [Power] +2000 until end of turn.',
    url: WIKI('20170927022732', 'Greymyu'),
  },
  'G-BT06-056': {
    name: 'Blaster Rapier',
    text: '[AUTO](VC/RC):[Counter-Blast 1-card with "Blaster" in its card name] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, search your deck for up to one grade 1 or less card, call it to (RC), and shuffle your deck.',
    url: WIKI('20170704184743', 'Blaster_Rapier'),
  },
  'G-BT06-069': {
    name: 'Master Kungfu',
    text: 'Rush-[AUTO](RC)[Generation Break 1]:When this unit [Stand] due to an effect from one of your cards, until end of turn, this unit gets "[AUTO](RC):[Counter-Blast 1] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, choose up to one of your other rear-guards, [Stand] it, and that unit gets [Power] +5000 until end of turn.".',
    url: WIKI('20170917041217', 'Master_Kungfu'),
  },
  'G-BT06-070': {
    name: 'Kumar the Destroyer',
    text: 'Rush-[AUTO](RC)[Generation Break 1]:When this unit [Stand] due to an effect from one of your cards, until end of turn, this unit gets "[AUTO](RC):When this unit attacks, this unit gets [Power] +5000 until end of that battle.".',
    url: WIKI('20170917042111', 'Kumar_the_Destroyer'),
  },
  'G-BT06-071': {
    name: 'Shinobiraizer',
    text: '[AUTO](RC)[1/Turn]:When your other unit with "Raizer" in its card name in the same column as this unit [Stand] due to an effect from one of your cards, you may reveal three cards from the top of your deck. If you reveal three cards, and all of the revealed cards have "Raizer" in its card name, choose up to one card from among them, put it into your hand, put the rest into your drop zone, and if not, put the revealed cards into your drop zone.',
    url: WIKI('20180521223636', 'Shinobiraizer'),
  },
  'G-BT06-072': {
    name: 'Beast Deity, Horned Hulk',
    text: '[ACT](RC):[Soul-Blast 1-card with "Beast Deity" in its card name & [Rest] this unit] Choose up to one of your other units with "Beast Deity" in its card name, and it gets [Power] +5000 until end of turn.',
    url: WIKI('20170917045923', 'Beast_Deity,_Horned_Hulk'),
  },
  'G-BT06-073': {
    name: 'Rajadamnern Kid',
    text: '[AUTO](RC):When your other unit with the rush ability in the same column as this unit [Stand] due to an effect from one of your cards, [Stand] this unit.',
    url: WIKI('20170917043522', 'Rajadamnern_Kid'),
  },
  'G-BT06-074': {
    name: 'Turboraizer Custom',
    text: '[AUTO]:Forerunner (When a unit of the same clan rides this unit, you may call this unit to (RC))\n[ACT](RC):[Counter-Blast 1 & Retire this unit] If you have a vanguard with "Raizer" in its card name, choose up to one of your other rear-guards with "Raizer" in its card name, and until end of turn, it gets "[AUTO](RC)[1/Turn]:When your vanguard attacks, [Stand] this unit, and this unit gets [Power] +5000 until end of turn.".',
    url: WIKI('20180514041314', 'Turboraizer_Custom'),
  },
  'G-BT06-075': {
    name: 'Totem Brothers',
    text: '',
    url: WIKI('20180812043709', 'G_Booster_Set_6:_Transcension_of_Blade_and_Blossom'),
  },
  'G-BT06-076': {
    name: 'Training Therapist',
    text: '(You may only have up to four cards with "[Heal] HEAL" in a deck.)',
    url: WIKI('20180812043709', 'G_Booster_Set_6:_Transcension_of_Blade_and_Blossom'),
  },
  'G-BT06-080': {
    name: 'Dreaming Pegasus',
    text: '[AUTO][Generation Break 1]:When this unit is placed on (RC), look at three cards from the top of your deck, search for up to one card from among them, put it into your soul, and put the rest on the bottom of your deck in any order.',
    url: WIKI('20170106010615', 'Dreaming_Pegasus'),
  },
  'G-BT06-081': {
    name: 'Signal Snake Tamer',
    text: "[ACT](RC):[Counter-Blast 1 & [Rest] this unit] Reveal the top card of your deck, choose up to one card from your soul with the same grade as the revealed card's grade, call it to (RC), and shuffle your deck.",
    url: WIKI('20170924043148', 'Signal_Snake_Tamer'),
  },
  'G-BT06-097': {
    name: 'Cropmaker Dragon',
    text: '[AUTO][Generation Break 1]:[Counter-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose up to one of your other rear-guards with the bloom ability, retire it, search your deck for up to two cards with the same card name as that unit, call them to separate open (RC), shuffle your deck, and those units get [Power] +3000 until end of turn.',
    url: WIKI('20181105053616', 'Cropmaker_Dragon'),
  },
  'G-BT06-098': {
    name: 'Af Roccoli',
    text: '[AUTO](RC)[Generation Break 1]:[Retire this unit] When an attack hits a vanguard during the battle that this unit boosted, you may pay the cost. If you do, choose up to one of your other rear-guards, search your deck for up to one card with the same card name as that unit, call it to (RC), shuffle your deck.',
    url: WIKI('20180525184112', 'Af_Roccoli'),
  },
  'G-BT06-099': {
    name: 'Tomboy Elf',
    text: '[ACT](RC)[1/Turn]:[Choose a normal unit from your drop zone, and put it on the top of your deck] Choose up to one of your units with the bloom ability, until end of turn, it gets "[CONT](VC/RC):This unit gets [Power] +2000 for each of your other units with the same card name as this unit.", and shuffle your deck.',
    url: WIKI('20170924042217', 'Tomboy_Elf'),
  },
  'G-BT06-100': {
    name: 'Maiden of Rambler',
    text: '[CONT](Hand):While you are paying the cost for Stride, if you have a vanguard with "Maiden of" in its card name, this card gets grade+1.\n[AUTO]:When this card is put into the drop zone from your hand for the cost of Stride, if you have a vanguard with "Maiden of" in its card name, call this card to (RC), and draw a card.',
    url: WIKI('20170924082330', 'Maiden_of_Rambler'),
  },
  'G-BT06-101': {
    name: 'Maiden of Noisette',
    text: '[AUTO]:Forerunner (When a unit of the same clan rides this unit, you may call this unit to (RC))\n[ACT](RC):[Counter-Blast 1-card with "Maiden of" in its card name & Put this unit into your soul] If you have a vanguard with "Maiden of" in its card name, choose up to two of your other units with "Maiden of" in its card name, and until end of turn, they get "[AUTO](VC/RC):When this unit\'s attack hits a vanguard, draw a card.".',
    url: WIKI('20170924064939', 'Maiden_of_Noisette'),
  },
};

async function archivedText(
  enNumber: string,
): Promise<{ text: string; shield: number; source: SourceRef } | null> {
  const url = HOSTS.en + cardPath(enNumber);
  const file = join('data', 'raw', 'archive', set!, `${enNumber.replace(/[/\\?&=]/g, '_')}.html`);
  let html: string;
  let stamp: string;
  if (!refresh && existsSync(file) && existsSync(`${file}.meta`)) {
    html = readFileSync(file, 'utf8');
    stamp = readFileSync(`${file}.meta`, 'utf8').trim();
  } else {
    const cdx = await (
      await fetchRaw(
        `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url.replace(/^https:\/\//, ''))}&to=${ARCHIVE_BEFORE}&filter=statuscode:200&fl=timestamp&output=txt`,
      )
    ).text();
    const stamps = cdx
      .split('\n')
      .filter((l) => /^\d{14}$/.test(l))
      .reverse();
    let found: { html: string; stamp: string } | null = null;
    for (const t of stamps) {
      const h = await (await fetchRaw(`https://web.archive.org/web/${t}id_/${url}`)).text();
      if (/cardlist_detail/.test(h) && !isUpdated(parseCardPage(h, 'en').text)) {
        found = { html: h, stamp: t };
        break;
      }
    }
    if (!found) return null;
    ({ html, stamp } = found);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    writeFileSync(`${file}.meta`, stamp);
  }
  const c = parseCardPage(html, 'en');
  const at = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}Z`;
  return {
    text: c.text,
    shield: c.shield,
    source: {
      url: `https://web.archive.org/web/${stamp}/${url}`,
      fetchedAt: at,
      regulation: c.regulation,
    },
  };
}

const localized = (c: ParsedCard): Localized => ({
  number: c.number,
  name: c.name,
  text: c.text,
  clan: c.clan,
  race: c.race,
  image: c.image,
});

function crossCheck(jp: ParsedCard | undefined, en: ParsedCard | undefined): string[] {
  if (!jp || !en) return [`only on the ${jp ? 'Japanese' : 'English'} site`];
  const fields = ['type', 'grade', 'power', 'critical', 'shield', 'skillIcon', 'trigger'] as const;
  return fields
    .filter((f) => jp[f] !== en[f])
    .map((f) => `${f}: JP ${String(jp[f])} vs EN ${String(en[f])}`);
}

async function downloadImage(
  id: string,
  card: ParsedCard | undefined,
  site: Site = 'en',
): Promise<void> {
  if (!images || !card?.image) return;
  const ext = card.image.split('.').pop() ?? 'png';
  const file = join('assets', 'cards', set!, `${id}.${ext}`);
  if (existsSync(file) && !refresh) return;
  const res = await fetchRaw(HOSTS[site] + card.image);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

/**
 * Race names no imported card had yet when they were needed: the plain English of the Japanese
 * (no official English page gave it). G-BT08-083 Novelty Introductor is the only Dark Elf.
 */
const SEED_RACES: ReadonlyMap<string, string> = new Map([['ダークエルフ', 'Dark Elf']]);

/** JP→EN clan and race names from the sets already imported. */
function knownNames(allSets = false): NameDictionary {
  const names: NameDictionary = { clan: new Map(), race: new Map(SEED_RACES) };
  const dir = join('data', 'cards');
  if (!existsSync(dir)) return names;
  for (const f of readdirSync(dir).filter(
    (n) =>
      (allSets ? /^[A-Z][A-Z0-9-]*\d{2}(EN)?\.json$/ : /^BT\d{2}\.json$/).test(n) &&
      n !== `${set}.json`,
  )) {
    const data = JSON.parse(readFileSync(join(dir, f), 'utf8')) as SetFile;
    for (const c of data.cards) {
      if (!c.jp || !c.en || !c.checks.jpEnStatsMatch) continue;
      names.clan.set(c.jp.clan, c.en.clan);
      names.race.set(c.jp.race, c.en.race);
    }
  }
  return names;
}

/** Japanese name → the first imported card with that name and an English record. */
function englishByJapaneseName(): Map<string, { id: string; en: Localized }> {
  const out = new Map<string, { id: string; en: Localized }>();
  const dir = join('data', 'cards');
  for (const f of readdirSync(dir)
    .filter((n) => /^[A-Z]+\d{2}\.json$/.test(n))
    .sort()) {
    if (f === `${set}.json`) continue;
    for (const c of (JSON.parse(readFileSync(join(dir, f), 'utf8')) as SetFile).cards) {
      if (c.jp && c.en && !out.has(c.jp.name)) out.set(c.jp.name, { id: c.id, en: c.en });
    }
  }
  return out;
}

/** Japanese name → the imported card with that name (first by set order), for PR reprints. */
function cardsByJapaneseName(): Map<string, CardRecord> {
  const out = new Map<string, CardRecord>();
  const dir = join('data', 'cards');
  for (const f of readdirSync(dir)
    .filter((n) => /^(G-)?[A-Z]+\d{2}\.json$/.test(n))
    .sort()) {
    if (f === `${set}.json`) continue;
    for (const c of (JSON.parse(readFileSync(join(dir, f), 'utf8')) as SetFile).cards) {
      if (c.jp && !out.has(c.jp.name)) out.set(c.jp.name, c);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const isPr = isListProduct(set!);
  const jp = isPr ? groupPr('jp', await fetchSite('jp')) : group('jp', await fetchSite('jp'));
  const en = isPr
    ? groupPr('en', await fetchSite('en'))
    : NO_ENGLISH_SET.has(set!)
      ? group('en', [])
      : group('en', await fetchSite('en'));
  // a PR card with the name of a card in the game is another printing of it: nothing new to add
  const reprints: { number: string; id: string }[] = [];
  if (isPr) {
    for (const no of G_ERA_ON_PR_LIST[set!] ?? []) {
      jp.bases.delete(no);
      jp.printings.delete(no);
    }
    const known = cardsByJapaneseName();
    const knownEnglish = new Set([...known.values()].flatMap((c) => (c.en ? [c.en.name] : [])));
    for (const [no, f] of [...jp.bases]) {
      const original = known.get(f.card.name);
      if (!original) continue;
      const clean = (t: string) => t.replace(/\s+/g, '');
      if (clean(original.jp!.text) !== clean(f.card.text))
        console.log(`  TEXT DIFFERS: ${f.card.number} vs ${original.id} ${f.card.name}: review`);
      for (const n of jp.printings.get(no)!) reprints.push({ number: n, id: original.id });
      jp.bases.delete(no);
      jp.printings.delete(no);
    }
    for (const [no, f] of [...en.bases]) if (knownEnglish.has(f.card.name)) en.bases.delete(no);
    // the unchecked candidates, for filling in PR_PAIRS by name
    const candidates = pairPrintings(
      new Map([...jp.bases].map(([n, f]) => [n, f.card])),
      new Map([...en.bases].map(([n, f]) => [n, f.card])),
      knownNames(),
      {},
      false,
    );
    const label = (n: string) => `${n} ${en.bases.get(n)!.card.name}`;
    for (const [j, e] of candidates.pairs) {
      if (PR_PAIRS[set!]?.[j]) continue;
      console.log(`  candidate: JP ${j} ${jp.bases.get(j)!.card.name} → EN ${label(e)}`);
    }
    for (const a of candidates.ambiguous) {
      if (PR_PAIRS[set!]?.[a.jp]) continue;
      const names = a.candidates.map(label).join(' | ');
      console.log(`  ambiguous: JP ${a.jp} ${jp.bases.get(a.jp)!.card.name} → ${names}`);
    }
    for (const j of candidates.jpOnly) {
      if (PR_PAIRS[set!]?.[j]) continue;
      console.log(`  no candidate: JP ${j} ${jp.bases.get(j)!.card.name}`);
    }
    if (process.env.PR_DUMP_EN) {
      for (const n of en.bases.keys()) console.log(`  en: ${label(n)}`);
    }
    // only reviewed pairs count
    const allowed = new Set(Object.values(PR_PAIRS[set!] ?? {}));
    for (const no of [...en.bases.keys()]) if (!allowed.has(no)) en.bases.delete(no);
  }
  useSpecials(en, PAIRING_OVERRIDES[set!] ?? {});
  const elsewhere = EN_PRINTED_ELSEWHERE[set!] ?? {};
  for (const enNo of Object.values(elsewhere)) {
    const { html, fetchedAt } = await page('en', cardPath(enNo), enNo);
    const c = parseCardPage(html, 'en');
    en.bases.set(enNo, {
      card: c,
      source: { url: HOSTS.en + cardPath(enNo), fetchedAt, regulation: c.regulation },
    });
    en.printings.set(enNo, [c.number]);
  }
  // English printings of this set's Japanese cards that the English release put in another set
  // (keys 'BT17/011'); only those that pair are used, the rest belong to that set
  const shared = new Set<string>();
  for (const other of EN_SHARED_SETS[set!] ?? []) {
    const g = group('en', await fetchSite('en', other), other);
    for (const [no, f] of g.bases) {
      const key = `${other}/${no}`;
      en.bases.set(key, f);
      en.printings.set(key, g.printings.get(no)!);
      shared.add(key);
    }
  }
  const card = <T extends { card: ParsedCard }>(m: Map<string, T>) =>
    new Map([...m].map(([no, f]) => [no, f.card]));
  // D-034: a Japanese card updated after the G era (shield 15000 and new text, e.g. the G-BT06/07
  // vanguard-attack critical triggers) pairs with the same English number when only the shield
  // differs; the archived English page is the G-era card
  const updatedPairs = Object.fromEntries(
    [...jp.bases].flatMap(([no, j]) => {
      const e = en.bases.get(no);
      if (!e || !isUpdated(j.card.text)) return [];
      const diff = crossCheck(j.card, e.card);
      return diff.length > 0 && diff.every((d) => d.startsWith('shield:')) ? [[no, no]] : [];
    }),
  );
  // CARD_DATA policy §1/§8: Japanese set membership is canonical; English numbers may differ
  const pairing = pairPrintings(
    card(jp.bases),
    card(en.bases),
    knownNames(),
    { ...updatedPairs, ...PAIRING_OVERRIDES[set!], ...elsewhere, ...PR_PAIRS[set!] },
    // the English ver.E sets reshuffled the Japanese ones: equal numbers mean nothing there
    !EN_SHARED_SETS[set!] && !isPr,
  );
  if (pairing.ambiguous.length > 0) {
    for (const a of pairing.ambiguous) {
      const names = a.candidates.map((e) => `${e} ${en.bases.get(e)!.card.name}`).join(', ');
      console.error(`  ambiguous: JP ${a.jp} ${jp.bases.get(a.jp)!.card.name} → ${names}`);
    }
    throw new Error(`${set}: add PAIRING_OVERRIDES for the ambiguous cards above`);
  }
  for (const [j, e] of pairing.pairs) {
    if (j !== e) console.log(`  paired JP ${j} with EN ${e} (${en.bases.get(e)!.card.name})`);
  }
  const numbers = [...jp.bases.keys()].sort();
  const englishOf = NO_ENGLISH_SET.has(set!) ? englishByJapaneseName() : new Map();
  const cards: CardRecord[] = [];
  // clan and race names for card-wiki English records: learned from every imported set
  const names = knownNames(true);
  for (const no of numbers) {
    const j = jp.bases.get(no);
    const enNo = pairing.pairs.get(no);
    const e = enNo === undefined ? undefined : en.bases.get(enNo);
    // no English printing: a reprint takes the English record of the same card in an earlier set
    const enFrom = !e && j && NO_ENGLISH_SET.has(set!) ? englishOf.get(j.card.name) : undefined;
    const reviewed =
      crossCheck(j?.card, e?.card).length > 0
        ? (REVIEWED_DIFFERENCES[`${set}-${no}`] ??
          (updatedPairs[no] && e
            ? {
                reason: `The Japanese database shows the card as updated after the G era (shield ${j!.card.shield}, new text); the archived English page is the G-era card (shield ${e.card.shield}), which the game uses.`,
                use: 'en' as const,
              }
            : undefined) ??
          (isPr && !e
            ? {
                reason:
                  'This card was never printed in English. Japanese text and stats are used (like BT11-055).',
                use: 'jp' as const,
              }
            : NO_ENGLISH_SET.has(set!) && !enFrom
              ? {
                  reason: `${set} had no English release and this card was never printed in English. Japanese text and stats are used (like BT11-055).`,
                  use: 'jp' as const,
                }
              : undefined))
        : undefined;
    // CARD_DATA policy §1/§7: Japanese-original data is canonical, unless the user chose the English printing
    const canonical = (reviewed?.use === 'en' && e ? e : (j ?? e))!.card;
    const id = `${set}-${no}`;
    const wiki = !e && j ? WIKI_ENGLISH[id] : undefined;
    const mismatches = enFrom || wiki ? [] : crossCheck(j?.card, e?.card);
    // D-034: a G-era card rewritten after the G era plays with its archived G-era text
    let original: Awaited<ReturnType<typeof archivedText>> = null;
    if (e && isUpdated(e.card.text)) {
      original = await archivedText(e.card.number);
      const reviewedOriginal = NO_OFFICIAL_ARCHIVE[id];
      if (!original && reviewedOriginal) {
        original = {
          text: reviewedOriginal.text,
          shield: reviewedOriginal.shield ?? e.card.shield,
          source: {
            url: reviewedOriginal.url,
            fetchedAt: reviewedOriginal.stamp,
            regulation: e.card.regulation,
          },
        };
      }
      if (!original) throw new Error(`${id}: "Updated" text and no pre-2020 archived page`);
      console.log(`  ${id}: updated text; G-era text from ${original.source.url}`);
    }
    cards.push({
      id,
      set: set!,
      jp: j ? localized(j.card) : null,
      en: e
        ? { ...localized(e.card), ...(original ? { text: original.text } : {}) }
        : wiki && j
          ? {
              number: `${set}/${no}EN`,
              name: wiki.name,
              text: wiki.text,
              clan: names.clan.get(j.card.clan) ?? j.card.clan,
              race: names.race.get(j.card.race) ?? j.card.race,
              image: j.card.image,
            }
          : (enFrom?.en ?? null),
      cardType: canonical.type,
      grade: canonical.grade,
      power: canonical.power,
      // the G-era card: later updates raised some shields (G-BT02-011: 10000, now 15000)
      shield: original?.shield ?? canonical.shield,
      critical: canonical.critical,
      skillIcon: canonical.skillIcon,
      trigger: canonical.trigger,
      // the keyword line, not a quoted name (「真理の守護者 ロックス」 is not a sentinel)
      sentinel: /:Sentinel/.test(e?.card.text ?? '') || /守護者（守護者は/.test(j?.card.text ?? ''),
      rarity: canonical.rarity,
      printings: [...(jp.printings.get(no) ?? []), ...(enNo ? (en.printings.get(enNo) ?? []) : [])],
      sources: {
        ...(j ? { jp: j.source } : {}),
        ...(e ? { en: e.source } : {}),
        ...(original ? { enArchive: original.source } : {}),
        ...(wiki
          ? { enWiki: { url: wiki.url, fetchedAt: wikiStamp(wiki.url), regulation: '' } }
          : {}),
      },
      checks: {
        jpEnStatsMatch: mismatches.length === 0,
        mismatches,
        ...(original ? { updatedText: e!.card.text } : {}),
        ...(reviewed ? { reviewed: reviewed.reason, statsFrom: reviewed.use } : {}),
        ...(enFrom ? { englishFrom: enFrom.id } : {}),
        ...(wiki ? { englishFromWiki: true } : {}),
      },
    });
    // Japanese-only cards (BT11-055) use the Japanese art
    try {
      await downloadImage(id, e?.card ?? j?.card, e ? 'en' : 'jp');
    } catch (err) {
      // PR/0102EN-A…0107EN-A: the official English page names an image that is not on the server
      if (!e || !j) throw err;
      console.log(`  ${id}: no English image, using the Japanese art`);
      await downloadImage(id, j.card, 'jp');
    }
  }
  // a Trial Deck is a fixed 50-card product: its contents come from the official English
  // product page (the Japanese pages and the card pages list no quantities)
  // D-031: English cards that no Japanese card of this set or of the shared sets pairs with
  const pairedElsewhere = new Set(
    (EN_SHARED_SETS[set!] ?? []).flatMap((other) => {
      const f = join('data', 'cards', `${other}.json`);
      if (!existsSync(f)) throw new Error(`${set}: import ${other} first (English-only cards)`);
      return (JSON.parse(readFileSync(f, 'utf8')) as SetFile).cards.flatMap((c) => c.printings);
    }),
  );
  const englishOnly = pairing.enOnly.filter(
    (no) => !shared.has(no) && !pairedElsewhere.has(en.bases.get(no)!.card.number),
  );
  if (EN_ONLY_IN_POOL.has(set!)) {
    for (const no of englishOnly) {
      const e = en.bases.get(no)!;
      const id = `${set}-${no}EN`;
      cards.push({
        id,
        set: set!,
        jp: null,
        en: localized(e.card),
        cardType: e.card.type,
        grade: e.card.grade,
        power: e.card.power,
        shield: e.card.shield,
        critical: e.card.critical,
        skillIcon: e.card.skillIcon,
        trigger: e.card.trigger,
        sentinel: /:Sentinel/.test(e.card.text),
        rarity: e.card.rarity,
        printings: en.printings.get(no) ?? [],
        sources: { en: e.source },
        checks: {
          jpEnStatsMatch: true,
          mismatches: [],
          englishOnly: 'Printed only in the English ver.E set; added by the user (D-031).',
        },
      });
      await downloadImage(id, e.card, 'en');
    }
  }
  const product = /^(G-)?TD\d{2}$/.test(set!) ? await productDeck(pairing.pairs) : undefined;
  const file: SetFile = {
    set: set!,
    importedAt: new Date().toISOString(),
    importerVersion: IMPORTER_VERSION,
    cards,
    ...(product ? { product } : {}),
    ...(isPr ? { reprints } : {}),
    enOnly: (isPr ? [] : pairing.enOnly)
      .filter((no) => !shared.has(no) && !(EN_ONLY_IN_POOL.has(set!) && englishOnly.includes(no)))
      .map((no) => {
        const c = en.bases.get(no)!.card;
        return { number: c.number, name: c.name, printings: en.printings.get(no) ?? [] };
      }),
  };
  mkdirSync(join('data', 'cards'), { recursive: true });
  writeFileSync(join('data', 'cards', `${set}.json`), JSON.stringify(file, null, 2) + '\n');
  const bad = cards.filter((c) => !c.checks.jpEnStatsMatch);
  console.log(
    `${set}: ${cards.length} cards written (${requests} requests); JP/EN mismatches: ${bad.length}`,
  );
  for (const c of bad) console.log(`  ${c.id}: ${c.checks.mismatches.join('; ')}`);
  for (const c of file.enOnly ?? [])
    console.log(`  English-only (not in the Japanese set): ${c.number} ${c.name}`);
  if (product) {
    const total = product.cards.reduce((n, c) => n + c.count, 0);
    console.log(`  product deck "${product.name}": ${total} cards`);
  }
}

/** A Trial Deck whose official product page has no card list. */
const PRODUCT_LISTS: Readonly<
  Record<string, { counts: Readonly<Record<string, number>>; url: string; stamp: string }>
> = {
  'G-TD05': {
    counts: {
      '001': 2,
      '002': 2,
      '003': 4,
      '004': 2,
      '005': 4,
      '006': 2,
      '007': 2,
      '008': 2,
      '009': 4,
      '010': 4,
      '011': 2,
      '012': 3,
      '013': 2,
      '014': 1,
      '015': 4,
      '016': 2,
      '017': 4,
      '018': 4,
      '019': 2,
    },
    url: 'https://web.archive.org/web/20170905224536/https://cardfight.wikia.com/wiki/G_Trial_Deck_5:_Fateful_Star_Messiah',
    stamp: '2017-09-05T22:45:36.000Z',
  },
  // G-TD06 to G-TD08 share one layout (the wiki's grade breakdown: 17/15/10/8 + 2 G units)
  'G-TD06': {
    counts: gTd06To08Counts(),
    url: 'https://web.archive.org/web/20170126050322/http://cardfight.wikia.com/wiki/G_Trial_Deck_6:_Rallying_Call_of_the_Interspectral_Dragon',
    stamp: '2017-01-26T05:03:22.000Z',
  },
  'G-TD07': {
    counts: gTd06To08Counts(),
    url: 'https://web.archive.org/web/20170611040816/http://cardfight.wikia.com/wiki/G_Trial_Deck_7:_Illusionist_of_the_Crescent_Moon',
    stamp: '2017-06-11T04:08:16.000Z',
  },
  'G-TD08': {
    counts: gTd06To08Counts(),
    url: 'https://web.archive.org/web/20170324101434/http://cardfight.wikia.com/wiki/G_Trial_Deck_8:_Vampire_Princess_of_the_Nether_Hour',
    stamp: '2017-03-24T10:14:34.000Z',
  },
};

/** 001…019 counts of G-TD06, G-TD07 and G-TD08 (52 cards each). */
function gTd06To08Counts(): Readonly<Record<string, number>> {
  const n = [2, 4, 2, 2, 4, 2, 2, 2, 4, 4, 3, 2, 2, 1, 4, 4, 2, 4, 2];
  return Object.fromEntries(n.map((c, i) => [String(i + 1).padStart(3, '0'), c]));
}

/**
 * "4pc TD01/001EN Crimson Butterfly, Brigitte" lines of the English product page. A G-era Trial
 * Deck also lists its G units (DECISIONS D-034): they form the G deck.
 */
async function productDeck(
  pairs: ReadonlyMap<string, string>,
): Promise<NonNullable<SetFile['product']>> {
  // G-TD01 → /products/gtd01/
  const path = `/products/${set!.toLowerCase().replace('-', '')}/`;
  const { html, fetchedAt } = await page('en', path, 'product');
  const name =
    /<h1 class="title">(?:[^<]*<br\s*\/?>)?\s*([^<]+)<\/h1>/.exec(html)?.[1]?.trim() ?? set!;
  const enToJp = new Map([...pairs].map(([jp, en]) => [en, jp]));
  const cards: { id: string; count: number }[] = [];
  // "0?": the TD11 page prints "TD11/0002EN"; "G-?": the G-TD03 page prints "GTD03/001EN"
  for (const m of html.matchAll(/(\d+)pc\s+((?:G-?)?[A-Z]{2}\d{2})\/0?(\d{3})EN\*?\s/g)) {
    const [, count, code, enNo] = m;
    if (code!.replace(/^G(?=T)/, 'G-') !== set)
      throw new Error(`${set} product page lists ${code}/${enNo}EN`);
    const jpNo = enToJp.get(enNo!);
    if (!jpNo) throw new Error(`${set} product card ${code}/${enNo}EN has no Japanese printing`);
    cards.push({ id: `${set}-${jpNo}`, count: Number(count) });
  }
  // the official page gives only "52 pre-set cards": the list is from the card wiki, and adds up to 52
  const listed = PRODUCT_LISTS[set!];
  if (cards.length === 0 && listed) {
    for (const [no, count] of Object.entries(listed.counts))
      cards.push({ id: `${set}-${no}`, count });
    return { name, cards, source: { url: listed.url, fetchedAt: listed.stamp, regulation: '' } };
  }
  if (cards.length === 0) throw new Error(`${set}: no cards found on ${path}`);
  return { name, cards, source: { url: HOSTS.en + path, fetchedAt, regulation: '' } };
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
