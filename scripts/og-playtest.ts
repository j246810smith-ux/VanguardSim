/**
 * G-BT01 OG Expanded playtest metrics: `npm run og:playtest -- [games] [--ai smart|basic] [--seed 2000]`
 *
 * Each playtest deck (src/decks/ogPlaytest.ts) plays the starter deck it was made from, `games`
 * games per pairing with seats and turn order alternating, under Original Era — Expanded. Prints
 * the playtest deck's win rate with a 95% interval, average game length, and how often each G-BT01
 * card's abilities resolved (per game, both decks). Saves JSON in bench-results/ (git-ignored).
 * Measurements only: nothing here changes a card.
 *
 * `--held`: the comparison test for the held Counter-Charge sentinels. Each playtest deck swaps its
 * four sentinels for its clan's held sentinel and plays the unchanged playtest deck, in the pool with
 * the held cards (`ouApproved(list, { includeHeld: true })`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { BasicController } from '../src/ai/basicController';
import { SmartController } from '../src/ai/smartController';
import { cardRegistry } from '../src/cards';
import { OG_PLAYTEST_DECKS, ogPlaytestBase } from '../src/decks/ogPlaytest';
import {
  EARLY_VANGUARD_RULES,
  OU_LIST,
  PLAY_FORMATS,
  originalExpandedFormat,
  ouApproved,
  type DeckList,
  type EngineContext,
} from '../src/engine';
import { wilson } from '../src/sim/benchmark';
import { runMatch } from '../src/sim/runMatch';

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1]! : def;
};
const games = Number(args.find((a) => /^\d+$/.test(a)) ?? 20);
const aiName = opt('ai', 'smart');
const seed0 = Number(opt('seed', '2000'));
const held = args.includes('--held');
/** Each playtest deck's sentinel and its clan's held Counter-Charge sentinel. */
const HELD_SENTINEL: Record<string, readonly [string, string]> = {
  'Royal Paladin': ['BT16-010', 'G-BT01-011'],
  'Oracle Think Tank': ['EB05-007', 'G-BT01-013'],
  Kagero: ['BT01-015', 'G-BT01-016'],
  'Nova Grappler': ['BT16-014', 'G-BT01-018'],
};
const registry = cardRegistry();
const ctx: EngineContext = {
  registry,
  ruleset: EARLY_VANGUARD_RULES,
  format: held
    ? originalExpandedFormat(ouApproved(OU_LIST, { includeHeld: true }), `${OU_LIST.version}+held`)
    : PLAY_FORMATS.classic_ou.format,
};
const make = (deck: DeckList) =>
  aiName === 'basic' ? new BasicController(ctx) : new SmartController(ctx, deck);

const report: unknown[] = [];
for (const playtest of OG_PLAYTEST_DECKS) {
  const clan = registry.get(playtest.deck.cards.find((c) => !c.startsWith('G-'))!).clan;
  const [sentinel, cc] = HELD_SENTINEL[clan]!;
  // --held: the deck under test has the held sentinel; it plays the unchanged playtest deck
  const d = held
    ? {
        ...playtest,
        name: `${playtest.name} + held sentinel`,
        deck: {
          ...playtest.deck,
          cards: playtest.deck.cards.map((c) => (c === sentinel ? cc : c)),
        },
      }
    : playtest;
  const base = held ? playtest : ogPlaytestBase(playtest.name)!;
  let wins = 0;
  let draws = 0;
  let truncated = 0;
  let turns = 0;
  const uses = new Map<string, number>();
  const started = Date.now();
  for (let g = 0; g < games; g++) {
    const testFirst = g % 2 === 0; // seat 0 goes first in createGame's seed order; alternate seats
    const decks: [DeckList, DeckList] = testFirst ? [d.deck, base.deck] : [base.deck, d.deck];
    const r = runMatch({ seed: seed0 + g, decks }, ctx, [make(decks[0]), make(decks[1])]);
    const me = testFirst ? 0 : 1;
    const end = r.events.find((e) => e.type === 'GAME_ENDED');
    if (r.truncated) truncated++;
    else if (end?.type === 'GAME_ENDED' && end.winner === me) wins++;
    else if (end?.type === 'GAME_ENDED' && end.winner === null) draws++;
    turns += r.events.filter((e) => e.type === 'TURN_STARTED').length;
    for (const e of r.events)
      if (e.type === 'ABILITY_RESOLVING') {
        const id = r.finalState.cards[e.source]?.definitionId ?? '';
        if (id.startsWith('G-BT01-')) uses.set(id, (uses.get(id) ?? 0) + 1);
      }
  }
  const ci = wilson(wins, games);
  const line = {
    deck: d.name,
    against: base.name,
    ai: aiName,
    games,
    wins,
    draws,
    truncated,
    winRate: wins / games,
    ci95: [ci.low, ci.high],
    avgTurns: turns / games,
    seconds: (Date.now() - started) / 1000,
    abilityUsesPerGame: Object.fromEntries(
      [...uses]
        .sort()
        .map(([id, n]) => [`${id} ${registry.get(id).name}`, +(n / games).toFixed(2)]),
    ),
  };
  report.push(line);
  console.log(
    `${d.name} vs ${base.name}: ${wins}/${games} wins (${(100 * line.winRate).toFixed(0)}%, 95% ${(100 * ci.low).toFixed(0)}–${(100 * ci.high).toFixed(0)}%), ${draws} draws, ${truncated} truncated, ${line.avgTurns.toFixed(1)} turns/game, ${line.seconds.toFixed(0)}s`,
  );
  for (const [k, v] of Object.entries(line.abilityUsesPerGame)) console.log(`    ${k}: ${v}/game`);
}
mkdirSync('bench-results', { recursive: true });
const file = `bench-results/og-playtest${held ? '-held' : ''}-${aiName}-${games}-${seed0}.json`;
writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
console.log(`saved ${file}`);
