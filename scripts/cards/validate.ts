/**
 * npm run cards:validate — checks imported card data and ability scripts.
 * Errors (exit code 1) block a release; warnings are listed for review.
 */
import { CARD_DATA_VERSION, SETS } from '../../src/cards';
import { isSameAs, registryFor } from '../../src/cards/load';
import type { CardRecord } from '../../src/cards/record';

const errors: string[] = [];
const warnings: string[] = [];

const SKILL_FOR_GRADE: Record<number, string> = {
  0: 'boost',
  1: 'boost',
  2: 'intercept',
  3: 'twin_drive',
};

function checkRecord(r: CardRecord, set: string): void {
  const e = (m: string) => errors.push(`${r.id}: ${m}`);
  const w = (m: string) => warnings.push(`${r.id}: ${m}`);
  if (!/^(BT|TD)\d{2}-\d{3}$/.test(r.id)) e('bad id format');
  if (r.set !== set) e(`set ${r.set} in file ${set}`);
  if (!r.jp) e('missing Japanese record (canonical source)');
  if (!r.en) w('missing English record');
  // a reviewed Japanese-only card (BT11-055) has no English source
  if (!r.sources.jp || (!r.sources.en && !r.checks.reviewed)) e('missing source URL for a site');
  if (!r.checks.jpEnStatsMatch) {
    if (r.checks.reviewed) w(`JP/EN difference (reviewed): ${r.checks.mismatches.join('; ')}`);
    else e(`JP/EN mismatch: ${r.checks.mismatches.join('; ')}`);
  }
  if (!Number.isInteger(r.grade) || r.grade < 0 || r.grade > 3) e(`grade ${r.grade} outside 0-3`);
  if (r.power <= 0 || r.power % 1000 !== 0) e(`power ${r.power}`);
  if (r.shield % 5000 !== 0) e(`shield ${r.shield}`);
  if (r.critical < 1) e(`critical ${r.critical}`);
  if ((r.cardType === 'trigger_unit') !== (r.trigger !== null))
    e('trigger icon does not match card type');
  if (r.trigger !== null && r.grade !== 0) e('trigger unit not grade 0');
  if (r.skillIcon !== SKILL_FOR_GRADE[r.grade])
    w(`skill ${r.skillIcon} unusual for grade ${r.grade}`);
  if (r.printings.length === 0) e('no printings');
  const text = r.en?.text ?? '';
  // the official text sometimes has encoding slips (e.g. "&gt" without ";"): shown verbatim, flagged
  if (/&[a-z]+(?![a-z;])/i.test(text))
    w(`text has a stray HTML entity: ${/&[a-z]+/i.exec(text)![0]}`);
}

for (const { file, abilities } of SETS) {
  const ids = new Set<string>();
  for (const r of file.cards) {
    if (ids.has(r.id)) errors.push(`${r.id}: duplicate`);
    ids.add(r.id);
    checkRecord(r, file.set);
  }
  for (const id of Object.keys(abilities)) {
    if (!ids.has(id)) errors.push(`${id}: ability script for a card not in ${file.set}`);
  }
  // reprints: the card they point at must be the same card (name and stats)
  for (const [id, entry] of Object.entries(abilities)) {
    if (!isSameAs(entry)) continue;
    const mine = file.cards.find((c) => c.id === id);
    const target = SETS.flatMap((x) => x.file.cards).find((c) => c.id === entry.sameAs);
    if (!target) {
      errors.push(`${id}: reprint of unknown card ${entry.sameAs}`);
      continue;
    }
    if (!mine) continue;
    const same = (['grade', 'power', 'shield', 'critical', 'trigger', 'skillIcon'] as const).every(
      (k) => mine[k] === target[k],
    );
    const name = (c: typeof mine) => (c.en ?? c.jp)!.name;
    if (!same || name(mine) !== name(target)) {
      errors.push(`${id}: not the same card as ${entry.sameAs} (${name(mine)} / ${name(target)})`);
    }
    const text = (c: typeof mine) =>
      (c.en?.text ?? '')
        .replace(/\s+/g, '')
        .replace(/<+/g, '<')
        .replace(/>+/g, '>')
        .replace(/＋/g, '+')
        .toLowerCase();
    if (text(mine) !== text(target)) warnings.push(`${id}: text differs from ${entry.sameAs}`);
    // the original must carry the scripts itself: no chains (and so no cycles)
    const original = SETS.find((x) => x.file.cards.some((c) => c.id === entry.sameAs))!.abilities[
      entry.sameAs
    ];
    if (original !== undefined && isSameAs(original)) {
      errors.push(`${id}: ${entry.sameAs} is itself a reprint (point at the original)`);
    }
  }
}

try {
  registryFor(SETS, CARD_DATA_VERSION); // validates every ability definition
} catch (err) {
  const details = (err as { details?: { problems?: string[] } }).details;
  errors.push(
    `ability scripts: ${(err as Error).message}${details?.problems ? `\n  ${details.problems.join('\n  ')}` : ''}`,
  );
}

const cards = SETS.reduce((n, s) => n + s.file.cards.length, 0);
console.log(`cards:validate — ${SETS.length} set(s), ${cards} cards`);
for (const w of warnings) console.log(`  warning  ${w}`);
for (const e of errors) console.log(`  ERROR    ${e}`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length > 0 ? 1 : 0);
