import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EARLY_BT01_BT17_FORMAT, EARLY_VANGUARD_RULES, type RuleValue } from '../../src/engine';

const unresolved = readFileSync(
  new URL('../../docs/UNRESOLVED_RULINGS.md', import.meta.url),
  'utf8',
);

const reviewKeys = (obj: object) =>
  Object.entries(obj)
    .filter(([, v]) => typeof v === 'object' && v !== null && 'status' in v)
    .filter(([, v]) => (v as RuleValue<unknown>).status === 'needs_review')
    .map(([k]) => k);

describe('unverified rules are tracked', () => {
  it.each([
    ['ruleset', EARLY_VANGUARD_RULES],
    ['format', EARLY_BT01_BT17_FORMAT],
  ])('every needs_review %s value is listed in docs/UNRESOLVED_RULINGS.md', (_, obj) => {
    for (const key of reviewKeys(obj)) expect(unresolved, key).toContain(`\`${key}\``);
  });
});

const ruleValues = (obj: object) =>
  Object.entries(obj).filter(
    (e): e is [string, RuleValue<unknown>] =>
      typeof e[1] === 'object' && e[1] !== null && 'status' in e[1],
  );

describe('verified rules cite their source', () => {
  it.each([
    ['ruleset', EARLY_VANGUARD_RULES],
    ['format', EARLY_BT01_BT17_FORMAT],
  ])('every verified %s value cites a comprehensive-rules section', (_, obj) => {
    for (const [key, v] of ruleValues(obj)) {
      if (v.status === 'verified') expect(v.note, key).toMatch(/^CR \d/);
    }
  });
});
