/**
 * npm run cards:validate — checks imported card data and ability scripts.
 * Errors (exit code 1) block a release; warnings are listed for review.
 */
import { pathToFileURL } from 'node:url';
import { CARD_DATA_VERSION, SETS } from '../../src/cards';
import { isSameAs, registryFor } from '../../src/cards/load';
import type { CardRecord } from '../../src/cards/record';

export interface ReprintComparison {
  /** Same stats and, when a language is shared, the same name in that language. */
  readonly sameCard: boolean;
  readonly sameText: boolean;
  /** The language both records have (English preferred); null if they share none. */
  readonly language: 'en' | 'jp' | null;
  readonly names: readonly [string, string];
}

const STAT_KEYS = ['grade', 'power', 'shield', 'critical', 'trigger', 'skillIcon'] as const;

const normalizeText = (t: string) =>
  t
    .normalize('NFKC') // full-width ＋, digits and brackets on the Japanese site
    .replace(/\s+/g, '')
    .replace(/<+/g, '<')
    .replace(/>+/g, '>')
    .toLowerCase();

/**
 * Compares a reprint with the card it points at like for like: English with English when both
 * have an English record, otherwise Japanese with Japanese (Japanese-only reprints such as
 * G-FTD01 and G-DG01 have no English record, and comparing a Japanese name with an English one
 * always failed).
 */
export function compareReprint(mine: CardRecord, target: CardRecord): ReprintComparison {
  const sameStats = STAT_KEYS.every((k) => mine[k] === target[k]);
  const language = mine.en && target.en ? 'en' : mine.jp && target.jp ? 'jp' : null;
  const names: [string, string] = language
    ? [mine[language]!.name, target[language]!.name]
    : [(mine.en ?? mine.jp)!.name, (target.en ?? target.jp)!.name];
  const sameName = language === null || names[0] === names[1];
  const sameText =
    language !== null &&
    normalizeText(mine[language]!.text) === normalizeText(target[language]!.text);
  return { sameCard: sameStats && sameName, sameText, language, names };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();

function main(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const SKILL_FOR_GRADE: Record<number, string> = {
    0: 'boost',
    1: 'boost',
    2: 'intercept',
    3: 'twin_drive',
    // grade 4 (Dragonic Nouvelle Vague, EB09): normal ride onto a grade 3 like any next grade
    4: 'twin_drive',
  };

  function checkRecord(r: CardRecord, set: string): void {
    const e = (m: string) => errors.push(`${r.id}: ${m}`);
    const w = (m: string) => warnings.push(`${r.id}: ${m}`);
    const englishOnly = r.checks.englishOnly !== undefined; // D-031: 'BT16-001EN', no JP record
    if (
      !/^(((BT|TD|EB|FC|DG|MBT|MTD)\d{2}|G-[A-Z]{2,4}\d{2})-\d{3}|PR1[1-4]-\d{4}[A-Z]?|VZ01-\d{3})$/.test(
        r.id.replace(/EN$/, ''),
      )
    )
      e('bad id format');
    if (englishOnly !== r.id.endsWith('EN')) e('English-only id and record disagree');
    if (r.set !== set) e(`set ${r.set} in file ${set}`);
    if (!r.jp && !englishOnly) e('missing Japanese record (canonical source)');
    if (!r.en) w('missing English record');
    // a reviewed Japanese-only card (BT11-055) has no English source, nor has a card of a
    // product with no English release whose English record comes from an earlier card (FC01), nor
    // has a card whose English text comes from an archived card-wiki page (G-BT06 onward)
    if (
      (!r.sources.jp && !englishOnly) ||
      (!r.sources.en && !r.sources.enWiki && !r.checks.reviewed && !r.checks.englishFrom)
    )
      e('missing source URL for a site');
    if (!r.checks.jpEnStatsMatch) {
      if (r.checks.reviewed) w(`JP/EN difference (reviewed): ${r.checks.mismatches.join('; ')}`);
      else e(`JP/EN mismatch: ${r.checks.mismatches.join('; ')}`);
    }
    if (!Number.isInteger(r.grade) || r.grade < 0 || r.grade > 4) e(`grade ${r.grade} outside 0-4`);
    // a G guardian (G-BT07 onward) has no power or critical: it only guards
    const gGuardian =
      r.cardType === 'g_unit' &&
      (/^\[G Guardian\]/.test(r.en?.text ?? '') || /^【Ｇガーディアン】/.test(r.jp?.text ?? ''));
    if (!gGuardian && (r.power <= 0 || r.power % 1000 !== 0)) e(`power ${r.power}`);
    if (r.shield % 5000 !== 0) e(`shield ${r.shield}`);
    if (!gGuardian && r.critical < 1) e(`critical ${r.critical}`);
    if ((r.cardType === 'trigger_unit') !== (r.trigger !== null))
      e('trigger icon does not match card type');
    if (r.trigger !== null && r.grade !== 0) e('trigger unit not grade 0');
    // G units (D-034): grade 4 with Triple Drive!!! (or no icon for G guardians)
    const expected = r.cardType === 'g_unit' ? 'triple_drive' : SKILL_FOR_GRADE[r.grade];
    if (r.skillIcon !== expected && !(r.cardType === 'g_unit' && r.skillIcon === null))
      w(`skill ${r.skillIcon} unusual for grade ${r.grade}`);
    if (r.cardType === 'g_unit' && r.grade !== 4) w(`G unit of grade ${r.grade}`);
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
      const cmp = compareReprint(mine, target);
      if (!cmp.sameCard) {
        errors.push(
          `${id}: not the same card as ${entry.sameAs} (${cmp.names[0]} / ${cmp.names[1]})`,
        );
      }
      if (cmp.language === null) {
        warnings.push(`${id}: no shared language with ${entry.sameAs}, name and text not compared`);
      } else if (!cmp.sameText) warnings.push(`${id}: text differs from ${entry.sameAs}`);
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
}
