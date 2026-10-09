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
import { parseCardPage, parseListPage, type ParsedCard } from './parse';

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
      'English BT03 prints Spiral Master as a critical trigger; the Japanese original is a draw trigger.',
    use: 'en',
  },
  'BT03-058': {
    reason:
      'English BT03 prints Herbivorous Dragon, Brutosaurus as a critical trigger; the Japanese original is a draw trigger.',
    use: 'en',
  },
  'BT03-073': {
    reason:
      'English BT03 prints Victory Maker as a critical trigger; the Japanese original is a draw trigger.',
    use: 'en',
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
  // identity pairing fails on a stat difference (see REVIEWED_DIFFERENCES): ドラゴニック・バーンアウト Dragonic
  // Burnout and 星輝兵 スパークドール Star-vader, Sparkdoll, matched by name
  BT15: { '014': '014', '074': '074' },
  TD07: { '004': '004' },
};
const HOSTS = { en: 'https://en.cf-vanguard.com', jp: 'https://cf-vanguard.com' } as const;
const DELAY_MS = 400; // be polite to the official site
const USER_AGENT = 'VanguardSim card importer (personal offline simulator)';

type Site = keyof typeof HOSTS;

const args = process.argv.slice(2);
const set = args.find((a) => !a.startsWith('--'));
const refresh = args.includes('--refresh');
const images = args.includes('--images');
if (!set || !/^(BT|TD)\d{2}$/.test(set)) {
  console.error('usage: npm run cards:import -- BT01|TD01 [--refresh] [--images]');
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
): Promise<{ html: string; fetchedAt: string }> {
  const file = join('data', 'raw', site, set!, `${cacheName.replace(/[/\\?&=]/g, '_')}.html`);
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

const firstNumber = (site: Site) => (site === 'en' ? `${set}/001EN` : `${set}/001`);
const cardPath = (no: string) => `/cardlist/?cardno=${no}`;

/** Find the set's expansion ID on a site: the product listed on card 001 whose list contains it. */
async function expansionOf(site: Site): Promise<number> {
  const { html } = await page(site, cardPath(firstNumber(site)), firstNumber(site));
  const card = parseCardPage(html, site);
  for (const exp of card.expansions) {
    const list = await page(site, `/cardlist/cardsearch/?expansion=${exp}`, `list_${exp}_1`);
    if (parseListPage(list.html, site).numbers.includes(firstNumber(site))) return exp;
  }
  throw new Error(`${site}: could not find the expansion for ${set}`);
}

async function listNumbers(site: Site, exp: number): Promise<string[]> {
  const first = parseListPage(
    (await page(site, `/cardlist/cardsearch/?expansion=${exp}`, `list_${exp}_1`)).html,
    site,
  );
  const numbers = [...first.numbers];
  for (let p = 2; p <= first.maxPage; p++) {
    const more = await page(
      site,
      `/cardlist/cardsearch_ex/?expansion=${exp}&view=image&page=${p}`,
      `list_${exp}_${p}`,
    );
    numbers.push(...parseListPage(more.html, site).numbers);
  }
  return [...new Set(numbers)].filter((n) => n.startsWith(`${set}/`));
}

interface Fetched {
  readonly card: ParsedCard;
  readonly source: SourceRef;
}

async function fetchSite(site: Site): Promise<Fetched[]> {
  const exp = await expansionOf(site);
  const numbers = await listNumbers(site, exp);
  console.log(`${site}: expansion ${exp}, ${numbers.length} printings`);
  const out: Fetched[] = [];
  for (const no of numbers) {
    const { html, fetchedAt } = await page(site, cardPath(no), no);
    let card: ParsedCard;
    try {
      card = parseCardPage(html, site);
    } catch (e) {
      throw new Error(`${site} ${no}: ${(e as Error).message}`);
    }
    out.push({
      card,
      source: { url: HOSTS[site] + cardPath(no), fetchedAt, regulation: card.regulation },
    });
  }
  return out;
}

const baseRe = (site: Site) => new RegExp(`^${set}/(\\d{3})${site === 'en' ? 'EN' : ''}$`);

/** Base printings by 3-digit number, and every printing grouped under its base by card name. */
function group(site: Site, fetched: Fetched[]) {
  const bases = new Map<string, Fetched>();
  for (const f of fetched) {
    const m = baseRe(site).exec(f.card.number);
    if (m) bases.set(m[1]!, f);
  }
  const printings = new Map<string, string[]>();
  for (const [no, f] of bases) printings.set(no, [f.card.number]);
  for (const f of fetched) {
    if (baseRe(site).test(f.card.number)) continue;
    // exact name first; the official data sometimes differs in punctuation between printings
    const loose = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const base =
      [...bases].find(([, b]) => b.card.name === f.card.name) ??
      [...bases].find(([, b]) => loose(b.card.name) === loose(f.card.name));
    if (!base) {
      // special "S" printings sometimes reprint a card from another set (BT10/S12 Blaster Blade
      // Liberator is BT09's); that card is imported with its own set
      if (/\/S\d+/.test(f.card.number)) {
        console.log(`  note: ${f.card.number} (${f.card.name}) is not a card of ${set}; skipped`);
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
  return { bases, printings };
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
  const card = <T extends { card: ParsedCard }>(m: Map<string, T>) =>
    new Map([...m].map(([no, f]) => [no, f.card]));
  // CARD_DATA policy §1/§8: Japanese set membership is canonical; English numbers may differ
  const pairing = pairPrintings(
    card(jp.bases),
    card(en.bases),
    knownNames(),
    PAIRING_OVERRIDES[set!],
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
  const product = set!.startsWith('TD') ? await productDeck(pairing.pairs) : undefined;
  const file: SetFile = {
    set: set!,
    importedAt: new Date().toISOString(),
    importerVersion: IMPORTER_VERSION,
    cards,
    ...(product ? { product } : {}),
    enOnly: pairing.enOnly.map((no) => {
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
