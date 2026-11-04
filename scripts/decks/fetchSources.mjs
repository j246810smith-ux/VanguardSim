/**
 * Caches research sources for the deck library (docs/deck-intelligence/). Read-only downloads into
 * data/raw/decks/ (git-ignored):
 *   - jp-products.json: the official Japanese product list with release dates
 *   - pr-<year>.json: the official yearly PR card lists
 *   - vanguardus/posts-<n>.json: every post of the vanguardus blog (Blogger's public feed)
 *
 *   node scripts/decks/fetchSources.mjs [--refresh]
 */
/* global fetch, setTimeout */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join('data', 'raw', 'decks');
const refresh = process.argv.includes('--refresh');
const UA = { 'User-Agent': 'VanguardSim deck research (personal offline simulator)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(join(OUT, 'vanguardus'), { recursive: true });

async function save(url, file) {
  if (!refresh && existsSync(file)) return null;
  await sleep(700);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  writeFileSync(file, text);
  return text;
}

await save('https://cf-vanguard.com/manage/card-list-user/products', join(OUT, 'jp-products.json'));

// the official PR lists by year (names and numbers), for the release dates of promotional printings
for (const year of [2011, 2012, 2013, 2014]) {
  const file = join(OUT, `pr-${year}.json`);
  if (!refresh && existsSync(file) && JSON.parse(readFileSync(file, 'utf8')).complete) continue;
  const items = [];
  let listed = 0;
  for (let page = 1; page < 20; page++) {
    await sleep(700);
    const url = `https://cf-vanguard.com/manage/card-list-user/list?title=${year}&page=${page}&per_page=100`;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.json();
    listed = data.total;
    items.push(...data.items);
    if (data.items.length === 0 || items.length >= listed) break;
  }
  writeFileSync(file, JSON.stringify({ total: listed, items, complete: items.length === listed }));
}

const PAGE = 150;
let total = 0;
for (let start = 1; ; start += PAGE) {
  const file = join(OUT, 'vanguardus', `posts-${start}.json`);
  const url = `https://vanguardus.blogspot.com/feeds/posts/default?alt=json&max-results=${PAGE}&start-index=${start}`;
  const text = (await save(url, file)) ?? readFileSync(file, 'utf8');
  const entries = JSON.parse(text).feed.entry ?? [];
  total += entries.length;
  console.log(`posts from ${start}: ${entries.length}`);
  if (entries.length === 0) break;
}
console.log(`vanguardus: ${total} posts`);
