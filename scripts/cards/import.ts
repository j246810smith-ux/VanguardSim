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
const HOSTS = { en: 'https://en.cf-vanguard.com', jp: 'https://cf-vanguard.com' } as const;
const DELAY_MS = 400; // be polite to the official site
const USER_AGENT = 'VanguardSim card importer (personal offline simulator)';

type Site = keyof typeof HOSTS;

const args = process.argv.slice(2);
const set = args.find((a) => !a.startsWith('--'));
const refresh = args.includes('--refresh');
const images = args.includes('--images');
// boosters, trial decks and the side sets of DECISIONS D-029
if (!set || !/^(BT|TD|EB|FC|DG|MBT|MTD)\d{2}$/.test(set)) {
  console.error(
    'usage: npm run cards:import -- BT01|TD01|EB01|FC01|MBT01|… [--refresh] [--images]',
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

const firstNumber = (site: Site, s: string) => (site === 'en' ? `${s}/001EN` : `${s}/001`);
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
  const product = products.data.items.find((p) => p.name.startsWith(`【${s}】`));
  if (!product) throw new Error(`jp: no product named 【${s}】 in the card list`);
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
  const own = [...new Set(numbers)].filter((n) => n.startsWith(`${s}/`));
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

async function fetchSite(site: Site, s: string = set!): Promise<Fetched[]> {
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

const baseRe = (site: Site, s: string) => new RegExp(`^${s}/(\\d{3})${site === 'en' ? 'EN' : ''}$`);

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
      if (/\/[SL]\d+/.test(f.card.number)) {
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

/** JP→EN clan and race names from the sets already imported. */
function knownNames(): NameDictionary {
  const names: NameDictionary = { clan: new Map(), race: new Map() };
  const dir = join('data', 'cards');
  if (!existsSync(dir)) return names;
  for (const f of readdirSync(dir).filter(
    (n) => /^BT\d{2}\.json$/.test(n) && n !== `${set}.json`,
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

async function main(): Promise<void> {
  const jp = group('jp', await fetchSite('jp'));
  const en = group('en', await fetchSite('en'));
  useSpecials(en, PAIRING_OVERRIDES[set!] ?? {});
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
  // CARD_DATA policy §1/§8: Japanese set membership is canonical; English numbers may differ
  const pairing = pairPrintings(
    card(jp.bases),
    card(en.bases),
    knownNames(),
    PAIRING_OVERRIDES[set!],
    // the English ver.E sets reshuffled the Japanese ones: equal numbers mean nothing there
    !EN_SHARED_SETS[set!],
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
  const cards: CardRecord[] = [];
  for (const no of numbers) {
    const j = jp.bases.get(no);
    const enNo = pairing.pairs.get(no);
    const e = enNo === undefined ? undefined : en.bases.get(enNo);
    const reviewed =
      crossCheck(j?.card, e?.card).length > 0 ? REVIEWED_DIFFERENCES[`${set}-${no}`] : undefined;
    // CARD_DATA policy §1/§7: Japanese-original data is canonical, unless the user chose the English printing
    const canonical = (reviewed?.use === 'en' && e ? e : (j ?? e))!.card;
    const mismatches = crossCheck(j?.card, e?.card);
    const id = `${set}-${no}`;
    cards.push({
      id,
      set: set!,
      jp: j ? localized(j.card) : null,
      en: e ? localized(e.card) : null,
      cardType: canonical.type,
      grade: canonical.grade,
      power: canonical.power,
      shield: canonical.shield,
      critical: canonical.critical,
      skillIcon: canonical.skillIcon,
      trigger: canonical.trigger,
      // the keyword line, not a quoted name (「真理の守護者 ロックス」 is not a sentinel)
      sentinel: /:Sentinel/.test(e?.card.text ?? '') || /守護者（守護者は/.test(j?.card.text ?? ''),
      rarity: canonical.rarity,
      printings: [...(jp.printings.get(no) ?? []), ...(enNo ? (en.printings.get(enNo) ?? []) : [])],
      sources: { ...(j ? { jp: j.source } : {}), ...(e ? { en: e.source } : {}) },
      checks: {
        jpEnStatsMatch: mismatches.length === 0,
        mismatches,
        ...(reviewed ? { reviewed: reviewed.reason, statsFrom: reviewed.use } : {}),
      },
    });
    // Japanese-only cards (BT11-055) use the Japanese art
    await downloadImage(id, e?.card ?? j?.card, e ? 'en' : 'jp');
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
  const product = set!.startsWith('TD') ? await productDeck(pairing.pairs) : undefined;
  const file: SetFile = {
    set: set!,
    importedAt: new Date().toISOString(),
    importerVersion: IMPORTER_VERSION,
    cards,
    ...(product ? { product } : {}),
    enOnly: pairing.enOnly
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

/** "4pc TD01/001EN Crimson Butterfly, Brigitte" lines of the English product page. */
async function productDeck(
  pairs: ReadonlyMap<string, string>,
): Promise<NonNullable<SetFile['product']>> {
  const path = `/products/${set!.toLowerCase()}/`;
  const { html, fetchedAt } = await page('en', path, 'product');
  const name =
    /<h1 class="title">(?:[^<]*<br\s*\/?>)?\s*([^<]+)<\/h1>/.exec(html)?.[1]?.trim() ?? set!;
  const enToJp = new Map([...pairs].map(([jp, en]) => [en, jp]));
  const cards: { id: string; count: number }[] = [];
  // "0?": the TD11 page prints "TD11/0002EN"
  for (const m of html.matchAll(/(\d+)pc\s+([A-Z]{2}\d{2})\/0?(\d{3})EN\*?\s/g)) {
    const [, count, code, enNo] = m;
    if (code !== set) throw new Error(`${set} product page lists ${code}/${enNo}EN`);
    const jpNo = enToJp.get(enNo!);
    if (!jpNo) throw new Error(`${set} product card ${code}/${enNo}EN has no Japanese printing`);
    cards.push({ id: `${set}-${jpNo}`, count: Number(count) });
  }
  if (cards.length === 0) throw new Error(`${set}: no cards found on ${path}`);
  return { name, cards, source: { url: HOSTS.en + path, fetchedAt, regulation: '' } };
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
