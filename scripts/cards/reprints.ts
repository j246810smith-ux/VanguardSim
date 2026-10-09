/**
 * `npm run cards:reprints -- TD01`: which cards of a set are reprints of cards already in the pool
 * (same English name, grade, power and trigger), for writing `{ sameAs }` entries, and which
 * are new and need scripts. Reprints whose text differs from the original are flagged for review.
 * With `--emit`, prints the `{ sameAs }` lines ready to paste.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CardRecord, SetFile } from '../../src/cards/record';

const set = process.argv.slice(2).find((a) => !a.startsWith('--'));
const emit = process.argv.includes('--emit');
if (!set) {
  console.error('usage: npm run cards:reprints -- TD01 [--emit]');
  process.exit(2);
}
const dir = join('data', 'cards');
const files = readdirSync(dir)
  .filter((f) => /^(BT|TD)\d{2}\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as SetFile);
const target = files.find((f) => f.set === set);
if (!target) throw new Error(`no data/cards/${set}.json`);
const name = (c: CardRecord) => (c.en ?? c.jp)!.name;
// compared like the text audit: whitespace, doubled brackets and full-width plus signs vary
const text = (c: CardRecord) =>
  (c.en?.text ?? '')
    .replace(/\s+/g, '')
    .replace(/<+/g, '<')
    .replace(/>+/g, '>')
    .replace(/＋/g, '+')
    .toLowerCase();
// earlier printings first: the original is the card a reprint points at. Later boosters are left
// out (BT11-020 reprints BT08-019, not the other way round).
const boosterNo = (s: string) => (/^BT(\d+)$/.exec(s) ? Number(s.slice(2)) : null);
const laterBooster = (s: string) => {
  const mine = boosterNo(set!);
  const theirs = boosterNo(s);
  return mine !== null && theirs !== null && theirs > mine;
};
const others = files
  .filter((f) => f.set !== set && !laterBooster(f.set))
  .flatMap((f) => f.cards)
  .sort((a, b) => a.id.localeCompare(b.id));

for (const c of target.cards) {
  const same = others.filter(
    (o) => name(o) === name(c) && o.grade === c.grade && o.power === c.power,
  );
  const original = same.find((o) => o.trigger === c.trigger);
  // wording often changes between printings ("([Boost])", "four or more"): review these by eye
  const differs = original && text(original) !== text(c) ? original : undefined;
  if (emit) {
    if (original) console.log(`  // ${name(c)}\n  '${c.id}': { sameAs: '${original.id}' },`);
    continue;
  }
  console.log(
    `${c.id} ${name(c).padEnd(40)} ${original ? `reprint of ${original.id}` : 'NEW'}${
      !original && (c.en?.text ?? '') ? ' (has text)' : ''
    }${differs ? ' (TEXT DIFFERS: review)' : ''}`,
  );
}
