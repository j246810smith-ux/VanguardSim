import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decode, parseCardPage, quoteBreaks } from '../../scripts/cards/parse';

const html = (name: string) =>
  readFileSync(new URL(`../fixtures/html/${name}`, import.meta.url), 'utf8');

describe('official card page parser', () => {
  it('parses a normal unit (EN)', () => {
    const c = parseCardPage(html('en_BT01_002EN.html'), 'en');
    expect(c).toMatchObject({
      number: 'BT01/002EN',
      name: 'Blaster Blade',
      type: 'normal_unit',
      clan: 'Royal Paladin',
      race: 'Human',
      grade: 2,
      power: 9000,
      critical: 1,
      shield: 5000,
      skillIcon: 'intercept',
      trigger: null,
      regulation: 'G-Regulation',
      rarity: 'RRR',
      image: '/wordpress/wp-content/images/cardlist/bt01/BT01_002EN.png',
      expansions: [5],
    });
    expect(c.text.split('\n')).toHaveLength(2);
    expect(c.text).toMatch(/^\[AUTO\]:\[Counter-Blast 2\] When this unit is placed on \(VC\)/);
  });

  it('parses a trigger unit (gift field) and "-" text', () => {
    const c = parseCardPage(html('en_BT01_045EN.html'), 'en');
    expect(c).toMatchObject({ type: 'trigger_unit', trigger: 'draw', grade: 0, text: '' });
  });

  it('parses the Japanese site; sentinel text present on both', () => {
    const jp = parseCardPage(html('jp_BT01_011.html'), 'jp');
    const en = parseCardPage(html('en_BT01_011EN.html'), 'en');
    expect(jp).toMatchObject({
      number: 'BT01/011',
      grade: 1,
      power: 6000,
      shield: 0,
      skillIcon: 'boost',
    });
    expect(jp.text).toContain('守護者');
    expect(en.text).toContain('Sentinel');
    for (const f of [
      'grade',
      'power',
      'shield',
      'critical',
      'skillIcon',
      'trigger',
      'type',
    ] as const) {
      expect(jp[f], f).toEqual(en[f]);
    }
  });

  it('decodes entities and leaves unknown malformed ones untouched', () => {
    expect(decode('&lt;Royal Paladin&gt; &amp; &#39;x&#39;')).toBe("<Royal Paladin> & 'x'");
    expect(decode('&foo vanguard')).toBe('&foo vanguard');
  });

  it('turns the English line-break quotes back into quotes (BT05 on)', () => {
    expect(
      quoteBreaks(
        'a card named <br>Phantom Blaster Dragon<br> in your soul, +2000.<br>[AUTO](VC):x',
      ),
    ).toBe('a card named "Phantom Blaster Dragon" in your soul, +2000.<br>[AUTO](VC):x');
  });

  it('decodes legacy entities without a semicolon, like a browser (BT03/072EN)', () => {
    expect(decode('the number of &ltOracle Think Tank&gt in your soul')).toBe(
      'the number of <Oracle Think Tank> in your soul',
    );
  });

  it('rejects pages without a card', () => {
    expect(() => parseCardPage('<html></html>', 'en')).toThrow(/no card detail/);
  });
});
