/**
 * Parses a card detail page of the official Cardfight!! Vanguard card databases
 * (en.cf-vanguard.com and cf-vanguard.com share the same markup). Pure: HTML in, fields out.
 */
import type { SkillIcon, TriggerType } from '../../src/engine/cards/types';

export interface ParsedCard {
  readonly site: 'en' | 'jp';
  readonly number: string;
  readonly name: string;
  readonly type: 'normal_unit' | 'trigger_unit';
  readonly clan: string;
  readonly race: string;
  readonly grade: number;
  readonly power: number;
  readonly critical: number;
  /** 0 when the card shows "-". */
  readonly shield: number;
  readonly skillIcon: SkillIcon | null;
  readonly trigger: TriggerType | null;
  readonly text: string;
  readonly regulation: string;
  readonly rarity: string;
  readonly image: string | null;
  /** Expansion IDs of the products this printing is found in. */
  readonly expansions: readonly number[];
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
  hearts: '♥', // EB10 "PR&hearts;ISM"
};
/** HTML entities; also the legacy `&lt` / `&gt` / `&amp` / `&quot` and numeric `&#9829` without a
 * semicolon, which browsers decode and the official English site uses in some card text and names
 * (BT03/072EN, EB06 "PR&#9829ISM"). */
export const decode = (s: string): string =>
  s.replace(
    /&(#\d+|#x[0-9a-f]+|\w+);|&(lt|gt|amp|quot)|&#(\d+)/gi,
    (m, e?: string, legacy?: string, num?: string) => {
      if (num) return String.fromCodePoint(parseInt(num, 10));
      if (legacy) return ENTITIES[legacy.toLowerCase()]!;
      e = e!;
      if (e in ENTITIES) return ENTITIES[e]!;
      if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10));
      return m;
    },
  );

const clean = (html: string): string =>
  decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n');

/**
 * From BT05 on, the English site writes quoted names as line breaks: `named <br>Blaster Dark<br> in`.
 * A break right after a space opens such a quote (a real line break follows a full stop).
 */
export const quoteBreaks = (html: string): string =>
  html.replace(/ <br\s*\/?>([^<]*?)<br\s*\/?>/g, ' "$1"');

function field(block: string, cls: string): string {
  const m = new RegExp(`<div class="${cls}">([\\s\\S]*?)</div>`).exec(block);
  if (!m) throw new Error(`card page: missing field "${cls}"`);
  return clean(m[1]!);
}

const number = (s: string, what: string): number => {
  const m = /-?\d+/.exec(s);
  if (!m) throw new Error(`card page: no number in ${what} "${s}"`);
  return Number(m[0]);
};

function skill(s: string): SkillIcon | null {
  if (/Twin Drive|ツインドライブ/.test(s)) return 'twin_drive';
  if (/Intercept|インターセプト/.test(s)) return 'intercept';
  if (/Boost|ブースト/.test(s)) return 'boost';
  if (s === '-' || s === '') return null;
  throw new Error(`card page: unknown skill "${s}"`);
}

function trigger(gift: string): TriggerType | null {
  if (/Critical|クリティカル/.test(gift)) return 'critical';
  if (/Draw|ドロー/.test(gift)) return 'draw';
  if (/Stand|スタンド/.test(gift)) return 'stand';
  if (/Heal|ヒール/.test(gift)) return 'heal';
  if (gift === '-' || gift === '') return null;
  throw new Error(`card page: unknown trigger "${gift}"`);
}

export function parseCardPage(html: string, site: 'en' | 'jp'): ParsedCard {
  const m = /<div class="cardlist_detail">([\s\S]*?)<div class="btns">/.exec(html);
  if (!m) throw new Error('card page: no card detail block (card not found?)');
  const block = m[1]!;
  const typeText = field(block, 'type');
  const type = /Trigger|トリガー/.test(typeText) ? 'trigger_unit' : 'normal_unit';
  if (type === 'normal_unit' && !/Normal|ノーマル/.test(typeText)) {
    throw new Error(`card page: unsupported card type "${typeText}"`);
  }
  const text = field(quoteBreaks(block), 'effect');
  const shield = field(block, 'shield');
  const image = /<div class="main"><img src="([^"]+)"/.exec(block)?.[1] ?? null;
  return {
    site,
    number: field(block, 'number'),
    name: clean(/<span class="face">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? ''),
    type,
    clan: field(block, 'group'),
    race: field(block, 'race'),
    grade: number(field(block, 'grade'), 'grade'),
    power: number(field(block, 'power'), 'power'),
    // a few English pages print "Critical -" (missing data): read as 0, which then shows up as a
    // JP/EN mismatch to review
    critical: /\d/.test(field(block, 'critical'))
      ? number(field(block, 'critical'), 'critical')
      : 0,
    shield: /\d/.test(shield) ? number(shield, 'shield') : 0,
    skillIcon: skill(field(block, 'skill')),
    trigger: trigger(field(block, 'gift')),
    text: text === '-' ? '' : text,
    regulation: field(block, 'regulation'),
    rarity: field(block, 'rarity'),
    image,
    expansions: [
      ...new Set([...html.matchAll(/cardsearch\/\?expansion=(\d+)/g)].map((x) => Number(x[1]))),
    ],
  };
}

/** A card as the redesigned Japanese site's JSON API returns it (`/manage/card-list-user/detail`). */
export interface ApiCard {
  readonly card_number: string;
  readonly card_name: string;
  readonly card_kind_name: string;
  readonly clan: string;
  readonly tribe?: string;
  readonly grade: string;
  readonly power: string;
  readonly critical: string;
  readonly shield: string;
  readonly skill_icon: string;
  readonly card_trigger: string;
  readonly text: string;
  readonly text_html?: string;
  readonly regulation: string;
  readonly rare: string;
  readonly picture: string;
}

/** Japanese card image folder, the API's `cardImageBase` (the same path the old pages used). */
export const JP_IMAGE_BASE = '/wordpress/wp-content/images/cardlist/';

/**
 * The same fields as parseCardPage, from the Japanese JSON API (the official Japanese site loads
 * its card pages from it since its 2026-10 redesign; the English site still serves pages).
 */
export function parseApiCard(c: ApiCard, expansions: readonly { id: string }[]): ParsedCard {
  const kind = c.card_kind_name;
  const type = /トリガー/.test(kind) ? 'trigger_unit' : 'normal_unit';
  if (type === 'normal_unit' && !/ノーマル/.test(kind)) {
    throw new Error(`card API: unsupported card type "${kind}"`);
  }
  const text = clean(c.text_html ?? c.text);
  return {
    site: 'jp',
    number: c.card_number,
    name: clean(c.card_name),
    type,
    clan: clean(c.clan),
    race: clean(c.tribe ?? ''),
    grade: number(c.grade, 'grade'),
    power: number(c.power, 'power'),
    critical: number(c.critical, 'critical'),
    shield: /\d/.test(c.shield) ? number(c.shield, 'shield') : 0,
    skillIcon: skill(c.skill_icon),
    trigger: trigger(c.card_trigger),
    text: text === '-' ? '' : text,
    regulation: c.regulation,
    rarity: c.rare,
    image: c.picture ? JP_IMAGE_BASE + c.picture : null,
    expansions: [...new Set(expansions.map((e) => Number(e.id)))],
  };
}

/** Card numbers in a set-list page (main page or a cardsearch_ex page). */
export function parseListPage(
  html: string,
  site: 'en' | 'jp',
): { numbers: string[]; maxPage: number } {
  const re = site === 'en' ? /cardno=([A-Z0-9/-]+EN(?:-[BW])?)[&"]/g : /cardno=([A-Z0-9/-]+?)[&"]/g;
  const numbers = [...new Set([...html.matchAll(re)].map((x) => x[1]!))];
  const maxPage = Number(/var max_page = (\d+)/.exec(html)?.[1] ?? 1);
  return { numbers, maxPage };
}
