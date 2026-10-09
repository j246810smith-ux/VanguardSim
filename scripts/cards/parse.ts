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
};
/** HTML entities; also the legacy `&lt` / `&gt` / `&amp` / `&quot` without a semicolon, which
 * browsers decode and the official English site uses in some card text (e.g. BT03/072EN). */
export const decode = (s: string): string =>
  s.replace(/&(#\d+|#x[0-9a-f]+|\w+);|&(lt|gt|amp|quot)/gi, (m, e?: string, legacy?: string) => {
    if (legacy) return ENTITIES[legacy.toLowerCase()]!;
    e = e!;
    if (e in ENTITIES) return ENTITIES[e]!;
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return m;
  });

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
    critical: number(field(block, 'critical'), 'critical'),
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

/** Card numbers in a set-list page (main page or a cardsearch_ex page). */
export function parseListPage(
  html: string,
  site: 'en' | 'jp',
): { numbers: string[]; maxPage: number } {
  const re = site === 'en' ? /cardno=([A-Z0-9/-]+EN)[&"]/g : /cardno=([A-Z0-9/-]+?)[&"]/g;
  const numbers = [...new Set([...html.matchAll(re)].map((x) => x[1]!))];
  const maxPage = Number(/var max_page = (\d+)/.exec(html)?.[1] ?? 1);
  return { numbers, maxPage };
}
