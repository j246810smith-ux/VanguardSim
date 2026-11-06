/**
 * Watch the AI play itself: `npm run ai:watch -- [games] [--seed 90000] [--a smart] [--b smart] [--logs 10]`
 *
 * Plays the library's tournament decks through the real engine and writes the first `--logs` games
 * as readable turn-by-turn logs in bench-results/watch/ (git-ignored). Over all games it counts
 * plays that look wrong, so a mistake seen in one log can be checked against many games. The counts
 * are symptoms to investigate, not proof of a mistake: a fix still has to win `npm run ai:bench`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SMART_V29, SmartController, type SmartOptions } from '../src/ai/smartController';
import { alreadySafe, isPerfectGuard } from '../src/ai/guarding';
import { cardRegistry } from '../src/cards';
import { deckListOf, LIBRARY } from '../src/decks/library';
import {
  actingPlayer,
  applyCommand,
  createGame,
  currentCritical,
  currentPower,
  currentShield,
  EARLY_BT01_BT17_FORMAT,
  EARLY_VANGUARD_RULES,
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

const ctx: EngineContext = {
  registry: cardRegistry(),
  ruleset: EARLY_VANGUARD_RULES,
  format: EARLY_BT01_BT17_FORMAT,
};

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const positional = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
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
    `    P${p} dmg ${s.players[p].damage.length} (${faceUp(s, p)} up) hand ${s.players[p].hand.length} soul ${s.players[p].soul.length} deck ${s.players[p].deck.length}`,
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
  for (const a of actions) {
    if (a.type === 'GUARD') {
      for (const id of a.cardIds) {
        if (isPerfectGuard(defOf(s, id))) perfect = s.players[p].hand.length >= 2 || perfect;
        else shield += currentShield(s, ctx, id);
      }
    }
    if (a.type === 'INTERCEPT') for (const id of a.unitIds) shield += currentShield(s, ctx, id);
  }
  return { shield, perfect };
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
    }
  }
}

mkdirSync(join('bench-results', 'watch'), { recursive: true });
const pairs = LIBRARY.map((a, i) => [a, LIBRARY[(i * 7 + 3) % LIBRARY.length]!] as const);
let fallbacks = 0;
let winsA = 0;
let totalTurns = 0;
const endings = new Map<string, number>();

for (let g = 0; g < games; g++) {
  const seed = seedBase + g;
  const [deckA, deckB] = pairs[g % pairs.length]!;
  const firstPlayer = (Math.floor(g / 2) % 2) as PlayerId;
  const listA = deckListOf(deckA);
  const listB = deckListOf(deckB);
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
