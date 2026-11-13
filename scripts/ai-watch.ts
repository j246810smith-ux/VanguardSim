/**
 * Watch the AI play itself: `npm run ai:watch -- [games] [--seed 90000] [--a smart] [--b smart] [--logs 10] [--g]`
 *
 * `--g`: G Era rules with the G Trial Decks and G starter decks (otherwise the Original Era library).
 *
 * Plays the library's tournament decks through the real engine and writes the first `--logs` games
 * as readable turn-by-turn logs in bench-results/watch/ (git-ignored). Over all games it counts
 * plays that look wrong, so a mistake seen in one log can be checked against many games. The counts
 * are symptoms to investigate, not proof of a mistake: a fix still has to win `npm run ai:bench`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SMART_V29, SmartController, type SmartOptions } from '../src/ai/smartController';
import { TERMS, type Evaluator } from '../src/ai/evaluate';
import { alreadySafe, isPerfectGuard } from '../src/ai/guarding';
import { cardRegistry } from '../src/cards';
import { deckListOf, LIBRARY } from '../src/decks/library';
import { G_STARTER_DECKS } from '../src/decks/gStarters';
import { G_TRIAL_DECKS } from '../src/decks/trialDecks';
import { gAuditDecks } from './g-audit-decks';

import {
  actingPlayer,
  applyCommand,
  createGame,
  currentCritical,
  currentPower,
  currentShield,
  EARLY_BT01_BT17_FORMAT,
  EARLY_VANGUARD_RULES,
  G_ERA_FORMAT,
  G_ERA_RULES,
  getLegalActions,
  other,
  REAR_GUARD_CIRCLES,
  vanguardOf,
  viewFor,
  type Command,
  type EngineContext,
  type GameEvent,
  type GameState,
  type InstanceId,
  type LegalAction,
  type PlayerId,
} from '../src/engine';

const args = process.argv.slice(2);
const gEra = args.includes('--g');
const ctx: EngineContext = {
  registry: cardRegistry(),
  ruleset: gEra ? G_ERA_RULES : EARLY_VANGUARD_RULES,
  format: gEra ? G_ERA_FORMAT : EARLY_BT01_BT17_FORMAT,
};

const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const positional = args.find(
  (a, i) => !a.startsWith('--') && !(args[i - 1]?.startsWith('--') && args[i - 1] !== '--g'),
);
const games = Number(positional ?? '20');
const seedBase = Number(flag('seed', '90000'));
const logs = Number(flag('logs', '10'));

const OPTIONS: Record<string, SmartOptions> = {
  smart: {},
  'smart-v29': SMART_V29,
  'smart-plan': { winConPlan: true },
};
const optionsOf = (name: string): SmartOptions => {
  const o = OPTIONS[name];
  if (!o) throw new Error(`controllers: ${Object.keys(OPTIONS).join(', ')}`);
  return o;
};
const aOptions = optionsOf(flag('a', 'smart'));
const bOptions = optionsOf(flag('b', 'smart'));

const skipped = new Map<string, number>();
const counts = new Map<string, number>();
const examples = new Map<string, string[]>();
function note(kind: string, where: string) {
  counts.set(kind, (counts.get(kind) ?? 0) + 1);
  const list = examples.get(kind) ?? [];
  if (list.length < 3) list.push(where);
  examples.set(kind, list);
}

const name = (s: GameState, id: InstanceId | null | undefined) => {
  if (!id) return '-';
  const card = s.cards[id];
  return card ? ctx.registry.get(card.definitionId).name : id;
};
const defOf = (s: GameState, id: InstanceId) => ctx.registry.get(s.cards[id]!.definitionId);
const faceUp = (s: GameState, p: PlayerId) =>
  s.players[p].damage.filter((id) => s.cards[id]!.faceUp).length;

function board(s: GameState, p: PlayerId): string {
  const c = (id: InstanceId | undefined) => {
    if (!id) return '.';
    const locked = s.cards[id]!.locked ? ' LOCKED' : '';
    return `${name(s, id)} ${currentPower(s, ctx, id)}${s.cards[id]!.orientation === 'rest' ? ' (rest)' : ''}${locked}`;
  };
  const at = (circle: (typeof REAR_GUARD_CIRCLES)[number]) =>
    c(s.players[p].circles[circle].at(-1));
  const vg = vanguardOf(s.players[p]);
  return [
    `    P${p} dmg ${s.players[p].damage.length} (${faceUp(s, p)} up) hand ${s.players[p].hand.length} soul ${s.players[p].soul.length} deck ${s.players[p].deck.length}${gEra ? ` G zone ${s.players[p].gzone.length} (${s.players[p].gzone.filter((id) => s.cards[id]!.faceUp).length} up)` : ''}`,
    `      front: ${at('front_left')} | VG ${c(vg ?? undefined)} | ${at('front_right')}`,
    `      back:  ${at('back_left')} | ${at('back_center')} | ${at('back_right')}`,
    `      hand:  ${s.players[p].hand
      .map((id) => {
        const d = defOf(s, id);
        return `${d.name}[G${d.grade} ${d.shield / 1000}k${isPerfectGuard(d) ? ' PG' : ''}${d.trigger ? ` ${d.trigger}` : ''}]`;
      })
      .join(', ')}`,
  ].join('\n');
}

function describe(s: GameState, c: Command, actions: readonly LegalAction[]): string {
  switch (c.type) {
    case 'MULLIGAN':
      return `mulligan back: ${c.cardIds.map((id) => name(s, id)).join(', ') || '(keep all)'}`;
    case 'RIDE':
      return `RIDE ${name(s, c.cardId)}`;
    case 'CALL':
      return `CALL ${name(s, c.cardId)} to ${c.circle}`;
    case 'SWAP_REAR_GUARDS':
      return `SWAP column ${c.column}`;
    case 'ATTACK':
      return `ATTACK with ${name(s, c.attacker)} boost ${name(s, c.booster)} -> ${name(s, c.target)}`;
    case 'GUARD':
      return `GUARD ${name(s, c.cardId)} (${currentShield(s, ctx, c.cardId)})`;
    case 'INTERCEPT':
      return `INTERCEPT ${name(s, c.unitId)} (${currentShield(s, ctx, c.unitId)})`;
    case 'PASS_GUARD':
      return 'no more guards';
    case 'ACTIVATE':
      return `ACTIVATE ${name(s, c.source)} ${c.abilityId}`;
    case 'END_PHASE':
      return `end ${s.phase} phase`;
    case 'CHOOSE': {
      const a = actions.find((x) => x.type === 'CHOOSE');
      const kind = a?.type === 'CHOOSE' ? a.kind : '?';
      const label = (o: string) => (s.cards[o] ? name(s, o) : o);
      const opts = a?.type === 'CHOOSE' ? a.options.map(label).join(' / ') : '';
      return `choose (${kind}) ${c.selection.map(label).join(', ') || '(none)'}  from: ${opts}`;
    }
    default:
      return c.type;
  }
}

function narrate(s: GameState, e: GameEvent): string | null {
  switch (e.type) {
    case 'CHECK_REVEALED':
      return `      ${e.check} check: ${ctx.registry.get(e.definitionId).name}${e.trigger ? ` [${e.trigger}${e.active ? '' : ', no effect'}]` : ''}`;
    case 'ATTACK_HIT':
      return `      HIT ${name(s, e.target)}`;
    case 'ABILITY_RESOLVING':
      return `      ability: ${name(s, e.source)} (${e.abilityId})`;
    case 'ABILITY_FIZZLED':
      return `      ability fizzled: ${e.reason}`;
    case 'CARD_MOVED':
      if (e.reason === 'retire' || e.to.zone === 'drop') {
        if (e.from.zone === 'guardian' || e.from.zone === 'trigger') return null;
        return `      ${name(s, e.instanceId)} ${e.from.zone} -> drop (${e.reason})`;
      }
      return null;
    default:
      return null;
  }
}

/** Every shield the defender could still add, and whether a perfect guard is possible. */
function guardsLeft(s: GameState, p: PlayerId, actions: readonly LegalAction[]) {
  let shield = 0;
  let perfect = false;
  let gGuardian = false;
  for (const a of actions) {
    if (a.type === 'GUARD') {
      for (const id of a.cardIds) {
        if (isPerfectGuard(defOf(s, id))) perfect = s.players[p].hand.length >= 2 || perfect;
        else shield += currentShield(s, ctx, id);
      }
    }
    if (a.type === 'INTERCEPT') for (const id of a.unitIds) shield += currentShield(s, ctx, id);
    if (a.type === 'G_GUARD' && a.cardIds.length > 0) {
      shield += Math.max(...a.cardIds.map((id) => defOf(s, id).shield));
      gGuardian = true;
    }
  }
  return { shield, perfect, gGuardian };
}

/** Note plays that look wrong. `s` is the true state before `c`. */
function audit(
  s: GameState,
  p: PlayerId,
  c: Command,
  actions: readonly LegalAction[],
  where: string,
) {
  const b = s.battle;
  if (c.type === 'ATTACK') {
    const opt = actions.find((a) => a.type === 'ATTACK');
    const o = opt?.type === 'ATTACK' ? opt.options.find((x) => x.attacker === c.attacker) : null;
    if (c.booster === null && (o?.boosters.length ?? 0) > 0)
      note('attacked without a boost', where);
    const attackerPower =
      currentPower(s, ctx, c.attacker) + (c.booster ? currentPower(s, ctx, c.booster) : 0);
    const targetPower = currentPower(s, ctx, c.target);
    if (attackerPower < targetPower) {
      const vanguard = o?.attackerCircle === 'vanguard';
      note(
        vanguard ? 'vanguard attack below target power' : 'rear-guard attack below target power',
        where,
      );
    }
    if (c.target !== vanguardOf(s.players[other(p)])) note('attacked a rear-guard', where);
    if (o?.attackerCircle === 'vanguard') {
      const rearLeft =
        opt?.type === 'ATTACK' && opt.options.some((x) => x.attackerCircle !== 'vanguard');
      if (rearLeft) note('(info) vanguard attacked before rear-guards', where);
    }
  }
  if (c.type === 'END_PHASE' && s.phase === 'battle') {
    const opt = actions.find((a) => a.type === 'ATTACK');
    if (opt?.type === 'ATTACK' && opt.options.length > 0)
      note('ended battle with attackers left', where);
  }
  if (c.type === 'END_PHASE' && s.phase === 'ride') {
    const ride = actions.find((a) => a.type === 'RIDE');
    const vg = vanguardOf(s.players[p]);
    if (ride?.type === 'RIDE' && vg) {
      const g = defOf(s, vg).grade;
      if (g < 3 && ride.cardIds.some((id) => defOf(s, id).grade === g + 1))
        note('did not ride up', where);
    }
  }
  if (c.type === 'END_PHASE' && actions.some((a) => a.type === 'STRIDE'))
    note('did not stride when able', where);
  if (c.type === 'G_GUARD') note('(info) used a G guardian', where);
  if (c.type === 'STRIDE') note('(info) strode', where);
  if (c.type === 'END_PHASE' && s.phase === 'main') {
    const call = actions.find((a) => a.type === 'CALL');
    if (call?.type === 'CALL') {
      const empty = call.circles.filter((x) => s.players[p].circles[x].length === 0);
      const units = call.cardIds.filter((id) => {
        const d = defOf(s, id);
        return d.trigger === null && !d.sentinel;
      });
      if (empty.length >= 2 && units.length >= 2)
        note('ended main with units and 2+ empty circles', where);
    }
    for (const a of actions) {
      if (a.type !== 'ACTIVATE') continue;
      for (const o of a.options) {
        const d = defOf(s, o.source);
        const text = d.abilities.find((x) => x.id === o.abilityId)?.text ?? '';
        skipped.set(
          `${d.name}: ${text.slice(0, 90)}`,
          (skipped.get(`${d.name}: ${text.slice(0, 90)}`) ?? 0) + 1,
        );
      }
    }
  }
  if (c.type === 'GUARD' && b) {
    const d = defOf(s, c.cardId);
    const need = currentPower(s, ctx, b.attacker) - currentPower(s, ctx, b.target) + 1;
    const dmg = s.players[p].damage.length;
    if (need <= 0) note('guarded an attack already stopped', where);
    if (isPerfectGuard(d) && dmg <= 2) note('perfect guard at 0-2 damage', where);
    if (!isPerfectGuard(d) && need > 0 && currentShield(s, ctx, c.cardId) >= need + 10000)
      note('guard over by 10000+', where);
    if (
      b.target === vanguardOf(s.players[p]) &&
      dmg <= 1 &&
      currentCritical(s, ctx, b.attacker) === 1
    )
      note('(info) guarded the vanguard at 0-1 damage', where);
    if (b.target !== vanguardOf(s.players[p])) note('(info) guarded a rear-guard', where);
  }
  if (c.type === 'PASS_GUARD' && b) {
    const vg = vanguardOf(s.players[p]);
    const hitsVg =
      b.target === vg && currentPower(s, ctx, b.attacker) >= currentPower(s, ctx, b.target);
    const dmg = s.players[p].damage.length;
    if (
      hitsVg &&
      !alreadySafe(s, ctx, p, b.target) &&
      dmg + currentCritical(s, ctx, b.attacker) >= 6
    ) {
      const need = currentPower(s, ctx, b.attacker) - currentPower(s, ctx, b.target) + 1;
      const left = guardsLeft(s, p, actions);
      if (left.perfect || left.shield >= need)
        note('let a LETHAL hit through with guards left', where);
      if (left.gGuardian) note('let a LETHAL hit through with a G guardian available', where);
    }
  }
}

/**
 * `--explain`: when a G unit's [ACT] is left unused at the end of a main phase, log each evaluation
 * term after ending the phase and after playing that [ACT] (true state, one playout each).
 */
function explainSkippedAct(
  s: GameState,
  p: PlayerId,
  c: Command,
  actions: readonly LegalAction[],
  ai: SmartController,
  log: string[],
) {
  if (c.type !== 'END_PHASE' || s.phase !== 'main') return;
  const evaluator = (ai as unknown as { evaluator: Evaluator }).evaluator;
  for (const a of actions) {
    if (a.type !== 'ACTIVATE') continue;
    for (const o of a.options) {
      if (defOf(s, o.source).cardType !== 'g_unit') continue;
      const act: Command = {
        type: 'ACTIVATE',
        player: p,
        source: o.source,
        abilityId: o.abilityId,
      };
      const end = ai.playOut(s, p, [c]);
      const used = ai.playOut(s, p, [act]);
      if (!end || !used) {
        log.push(
          `      EXPLAIN ${defOf(s, o.source).name}: playout failed (${!used ? 'act' : 'end'})`,
        );
        note('G unit [ACT] playout failed', `${s.turnNumber}`);
        continue;
      }
      const e = evaluator.breakdown(end, p);
      const u = evaluator.breakdown(used, p);
      const diff = TERMS.map((t) => `${t} ${Math.round(u[t] - e[t])}`).join(', ');
      log.push(`      EXPLAIN ${defOf(s, o.source).name} act-minus-end: ${diff}`);
      for (const t of TERMS) {
        const d = u[t] - e[t];
        if (Math.abs(d) >= 300)
          note(`(explain) G [ACT] ${t} ${d > 0 ? '+' : '-'}`, `${s.turnNumber}`);
      }
    }
  }
}

mkdirSync(join('bench-results', 'watch'), { recursive: true });
type Watched = { readonly name: string; readonly list: ReturnType<typeof deckListOf> };
/**
 * G audit decks: one per clan, built like the set tests' decks (newest G-era units first) with a
 * G deck of the clan's newest G units, two G guardian names among them when the clan has them.
 */
const POOL: readonly Watched[] = gEra
  ? [
      ...gAuditDecks(ctx).map((d) => ({ name: d.name, list: d.deck })),
      ...(args.includes('--trial')
        ? [...G_TRIAL_DECKS, ...G_STARTER_DECKS].map((d) => ({ name: d.name, list: d.deck }))
        : []),
    ]
  : LIBRARY.map((d) => ({ name: d.name, list: deckListOf(d) }));
if (gEra) console.log(`G decks: ${POOL.map((d) => d.name).join(', ')}`);
const pairs = POOL.map((a, i) => [a, POOL[(i * 7 + 3) % POOL.length]!] as const);
let fallbacks = 0;
let winsA = 0;
let totalTurns = 0;
const endings = new Map<string, number>();

for (let g = 0; g < games; g++) {
  const seed = seedBase + g;
  const [deckA, deckB] = pairs[g % pairs.length]!;
  const firstPlayer = (Math.floor(g / 2) % 2) as PlayerId;
  const listA = deckA.list;
  const listB = deckB.list;
  const controllers = [
    new SmartController(ctx, listA, aOptions),
    new SmartController(ctx, listB, bOptions),
  ] as const;
  const log: string[] = [
    `=== seed ${seed}: P0 ${deckA.name} vs P1 ${deckB.name}, P${firstPlayer} goes first`,
  ];
  let decisionLines: string[] = [];
  controllers.forEach((c) => {
    c.debug = (m) => {
      if (m.startsWith('FALLBACK')) {
        fallbacks++;
        note('fell back to the Normal AI', `seed ${seed}: ${m}`);
      }
      decisionLines.push(`      ${m}`);
    };
  });
  let state = createGame({ seed, decks: [listA, listB], firstPlayer }, ctx).state;
  let lastTurn = -1;
  let commands = 0;
  while (state.status !== 'finished' && commands < 10_000) {
    const p = actingPlayer(state)!;
    if (state.turnNumber !== lastTurn) {
      lastTurn = state.turnNumber;
      log.push(
        `\n--- turn ${state.turnNumber}: P${state.activePlayer} (${state.activePlayer === 0 ? deckA.name : deckB.name})`,
      );
      log.push(board(state, 0), board(state, 1));
    }
    const actions = getLegalActions(state, p, ctx);
    decisionLines = [];
    const command = controllers[p]!.chooseCommand(viewFor(state, p), p, actions);
    if (args.includes('--explain'))
      explainSkippedAct(state, p, command, actions, controllers[p]!, log);
    const where = `seed ${seed} turn ${state.turnNumber} P${p} ${state.phase}`;
    audit(state, p, command, actions, where);
    const b = state.battle;
    const fight =
      command.type === 'PASS_GUARD' && b
        ? ` [attack ${currentPower(state, ctx, b.attacker)} crit ${currentCritical(state, ctx, b.attacker)} vs ${name(state, b.target)} ${currentPower(state, ctx, b.target)}, P${p} dmg ${state.players[p].damage.length}]`
        : '';
    log.push(`  P${p} ${state.phase}: ${describe(state, command, actions)}${fight}`);
    if (
      ['ATTACK', 'RIDE', 'CALL', 'ACTIVATE'].includes(command.type) ||
      (b && p !== state.activePlayer)
    )
      log.push(
        `      hand before: ${state.players[p].hand.map((id) => name(state, id)).join(', ')}`,
      );
    log.push(...decisionLines);
    const result = applyCommand(state, command, ctx);
    for (const e of result.events) {
      const line = narrate(result.state, e);
      if (line) log.push(line);
    }
    state = result.state;
    if (command.type === 'ATTACK') {
      const after = state.battle;
      if (after)
        log.push(
          `      power ${currentPower(state, ctx, after.attacker)} vs ${currentPower(state, ctx, after.target)}`,
        );
    }
    commands++;
  }
  const w = state.winner;
  if (w === 0) winsA++;
  totalTurns += state.turnNumber;
  const loser = w === null ? null : other(w);
  const reason =
    loser === null ? 'draw' : state.players[loser].damage.length >= 6 ? '6 damage' : 'other';
  endings.set(reason, (endings.get(reason) ?? 0) + 1);
  log.push(
    `\n=== winner P${w} on turn ${state.turnNumber} (${reason})`,
    board(state, 0),
    board(state, 1),
  );
  if (g < logs) writeFileSync(join('bench-results', 'watch', `game-${seed}.txt`), log.join('\n'));
  process.stderr.write(`  game ${g + 1}/${games}\n`);
}

console.log(`${games} games: P0 won ${winsA}, average ${(totalTurns / games).toFixed(1)} turns`);
console.log(`endings: ${[...endings].map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`fallbacks to Normal: ${fallbacks}`);
console.log('abilities left unused at the end of a main phase:');
for (const [k, n] of [...skipped].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}
for (const [kind, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${kind}   e.g. ${examples.get(kind)!.join(' ; ')}`);
}
