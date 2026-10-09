/**
 * Terminal playtest: you (player 1 on screen) vs the basic AI, BT01 starter decks.
 *
 *   npm run play            (choose decks interactively)
 *   npm run play -- --seed 42
 *
 * Commands at any menu: a number to choose, "?" + number (e.g. "?3") to read a hand card,
 * "b" to read the board's card text, "q" to concede and quit.
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { BasicController } from '../src/ai/basicController';
import { cardRegistry } from '../src/cards';
import { STARTER_DECKS } from '../src/decks/starters';
import {
  actingPlayer,
  applyCommand,
  createGame,
  currentCritical,
  currentPower,
  EARLY_BT01_BT17_FORMAT,
  EARLY_VANGUARD_RULES,
  getLegalActions,
  REAR_GUARD_CIRCLES,
  vanguardOf,
  viewFor,
  type Circle,
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
const ME: PlayerId = 0;
const AI: PlayerId = 1;
const rl = createInterface({ input, output, terminal: false });
const lines = rl[Symbol.asyncIterator]();
/** Prompt and read one line (buffered, so piped input works too). Ends the game on end of input. */
async function ask(prompt: string): Promise<string> {
  output.write(prompt);
  const next = await lines.next();
  if (next.done) {
    console.log('(end of input)');
    process.exit(0);
  }
  return next.value;
}

// ---- presentation -----------------------------------------------------------------------------

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

const def = (s: GameState, id: InstanceId) => ctx.registry.get(s.cards[id]!.definitionId);
const name = (s: GameState, id: InstanceId) => def(s, id).name;
const short = (str: string, n: number) => (str.length > n ? `${str.slice(0, n - 1)}…` : str);
const trig = (s: GameState, id: InstanceId) => {
  const t = def(s, id).trigger;
  return t ? ` [${t}]` : '';
};

function cardLine(s: GameState, id: InstanceId): string {
  const d = def(s, id);
  const sent = d.sentinel ? ' Sentinel' : '';
  return `${d.name} — G${d.grade} ${d.power}/${d.shield ? `shield ${d.shield}` : 'no shield'}${trig(s, id)}${sent} <${d.clan}>`;
}

function unitCell(s: GameState, ids: readonly InstanceId[], width: number): string {
  const id = ids.at(-1);
  if (!id) return c.dim('·'.padEnd(width));
  const card = s.cards[id]!;
  if (card.locked) return c.dim('[locked]'.padEnd(width));
  const rest = card.orientation === 'rest' ? c.dim('(R)') : '   ';
  const label = `${short(name(s, id), width - 14)} G${def(s, id).grade} ${currentPower(s, ctx, id)}`;
  return `${label.padEnd(width - 3)}${rest}`;
}

const W = 34;
function renderSide(s: GameState, p: PlayerId, mirrored: boolean): string[] {
  const pl = s.players[p];
  const cells = (circles: readonly Circle[]) =>
    circles.map((x) => unitCell(s, pl.circles[x], W)).join(' | ');
  // columns face each other: the opponent's right is above my left (CR 4.6.2.1)
  const front: Circle[] = mirrored
    ? ['front_right', 'vanguard', 'front_left']
    : ['front_left', 'vanguard', 'front_right'];
  const back: Circle[] = mirrored
    ? ['back_right', 'back_center', 'back_left']
    : ['back_left', 'back_center', 'back_right'];
  const faceUpDamage = pl.damage.filter((id) => s.cards[id]!.faceUp).length;
  const info =
    `damage ${pl.damage.length} (${faceUpDamage} face up)  hand ${pl.hand.length}  deck ${pl.deck.length}  ` +
    `soul ${pl.soul.length}  drop ${pl.drop.length}` +
    (pl.bind.length ? `  bind ${pl.bind.length}` : '');
  const vg = vanguardOf(pl);
  const crit = vg ? `  (vanguard critical ${currentCritical(s, ctx, vg)})` : '';
  return mirrored
    ? [info + crit, `  back : ${cells(back)}`, `  front: ${cells(front)}`]
    : [`  front: ${cells(front)}`, `  back : ${cells(back)}`, info + crit];
}

function render(s: GameState): void {
  const header = `Turn ${s.turnNumber} — ${s.activePlayer === ME ? c.green('YOUR turn') : c.red("AI's turn")} — ${s.phase.toUpperCase()} phase`;
  console.log('\n' + '─'.repeat(110));
  console.log(c.bold(header));
  console.log(c.red('AI   ') + renderSide(s, AI, true).join('\n     '));
  if (s.players[AI].guardian.length || s.players[ME].guardian.length) {
    const g = (p: PlayerId) =>
      s.players[p].guardian.map((id) => `${name(s, id)} (${def(s, id).shield})`).join(', ') || '-';
    console.log(c.yellow(`     guardians — AI: ${g(AI)} | you: ${g(ME)}`));
  }
  console.log(c.green('YOU  ') + renderSide(s, ME, false).join('\n     '));
  if (s.battle) {
    const b = s.battle;
    console.log(
      c.yellow(
        `  ⚔ ${name(s, b.attacker)} (${currentPower(s, ctx, b.attacker)}) → ${name(s, b.target)} (${currentPower(s, ctx, b.target)})`,
      ),
    );
  }
  console.log(c.bold('  Your hand:'));
  s.players[ME].hand.forEach((id, i) => console.log(`   h${i + 1}. ${cardLine(s, id)}`));
}

/** One readable line per meaningful event (hidden information is not shown). */
function describe(s: GameState, e: GameEvent): string | null {
  const who = (p: PlayerId) => (p === ME ? c.green('You') : c.red('AI'));
  const n = (id: InstanceId) => name(s, id);
  switch (e.type) {
    case 'TURN_STARTED':
      return c.bold(`— Turn ${e.turn}: ${e.player === ME ? 'your turn' : "AI's turn"} —`);
    case 'UNIT_RIDDEN':
      return `${who(e.player)} ${e.superior ? 'superior ' : ''}ride ${n(e.instanceId)}`;
    case 'UNIT_CALLED':
      return `${who(e.player)} ${e.superior ? 'superior ' : ''}call ${n(e.instanceId)} to ${e.circle}`;
    case 'ATTACK_DECLARED':
      return `${who(e.player)}: ${n(e.attacker)} attacks ${n(e.target)}${e.booster ? ` (boost: ${n(e.booster)})` : ''}`;
    case 'GUARDIAN_CALLED':
      return `${who(e.player)} guard with ${n(e.instanceId)}`;
    case 'INTERCEPTED':
      return `${who(e.player)} intercept with ${n(e.instanceId)}`;
    case 'CHECK_REVEALED':
      return `  ${e.check} check: ${n(e.instanceId)}${e.trigger ? (e.active ? c.yellow(` ★ ${e.trigger.toUpperCase()} TRIGGER`) : c.dim(` (${e.trigger}, other clan: no effect)`)) : ''}`;
    case 'ATTACK_RESOLVED':
      return `  ${e.attackPower} vs ${e.defensePower}: ${e.hit ? c.red('HIT') : c.green('no hit')}`;
    case 'DAMAGE_DEALT':
      return `  ${who(e.player)} take ${e.amount} damage`;
    case 'ABILITY_RESOLVING':
      return c.cyan(`  ${s.cards[e.source] ? n(e.source) : '?'}: ability`);
    case 'ABILITY_FIZZLED':
      return c.dim(`  ability fizzled (${e.reason})`);
    case 'CARD_MOVED':
      if (e.reason === 'retire' && e.from.zone === 'circle') return `  ${n(e.instanceId)} retired`;
      if (e.reason === 'heal') return c.green(`  healed ${n(e.instanceId)}`);
      if (e.reason === 'draw' && e.to.player === ME) return c.dim(`  you draw ${n(e.instanceId)}`);
      return null;
    case 'CARD_LOCKED':
      return `  ${n(e.instanceId)} locked`;
    case 'GAME_ENDED':
      return c.bold(
        e.winner === ME
          ? '*** YOU WIN ***'
          : e.winner === AI
            ? '*** THE AI WINS ***'
            : '*** DRAW ***',
      );
    default:
      return null;
  }
}

function log(s: GameState, events: readonly GameEvent[]): void {
  for (const e of events) {
    const line = describe(s, e);
    if (line) console.log(line);
  }
}

// ---- input ------------------------------------------------------------------------------------

interface Option {
  readonly label: string;
  readonly then: () => Promise<Command | null> | Command | null;
}

async function menu(
  s: GameState,
  title: string,
  options: readonly Option[],
): Promise<Command | null> {
  for (;;) {
    console.log(c.bold(`\n${title}`));
    options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}`));
    const raw = (await ask('> ')).trim().toLowerCase();
    if (raw === 'q') return { type: 'CONCEDE', player: ME };
    if (raw === 'b') {
      showBoardText(s);
      continue;
    }
    if (raw.startsWith('?')) {
      const id = s.players[ME].hand[Number(raw.slice(1).replace('h', '')) - 1];
      console.log(
        id ? `${cardLine(s, id)}\n${def(s, id).text || '(no abilities)'}` : 'No such hand card.',
      );
      continue;
    }
    const pick = options[Number(raw) - 1];
    if (!pick) {
      console.log('Enter a number from the list (or ?N, b, q).');
      continue;
    }
    const result = await pick.then();
    if (result) return result;
  }
}

function showBoardText(s: GameState): void {
  for (const p of [AI, ME]) {
    for (const x of ['vanguard', ...REAR_GUARD_CIRCLES] as Circle[]) {
      const id = s.players[p].circles[x].at(-1);
      if (id && !s.cards[id]!.locked)
        console.log(
          `${p === ME ? 'you' : 'AI '} ${x}: ${cardLine(s, id)}\n    ${def(s, id).text.replace(/\n/g, '\n    ') || '(no abilities)'}`,
        );
    }
  }
}

const label = (s: GameState, id: string) =>
  ['yes', 'no', 'top', 'bottom'].includes(id) ||
  /^\d+$/.test(id) ||
  REAR_GUARD_CIRCLES.includes(id as never)
    ? id
    : s.cards[id]
      ? `${cardLine(s, id)}${s.cards[id]!.owner === AI ? c.red(' (AI)') : ''}`
      : id;

async function chooseMany(
  s: GameState,
  a: Extract<LegalAction, { type: 'CHOOSE' }>,
): Promise<Command> {
  const optionLabel = (o: string) => (a.kind === 'order_abilities' ? `ability #${o}` : label(s, o));
  for (;;) {
    console.log(
      c.bold(`\n${a.prompt}`) +
        c.dim(
          a.min === a.max
            ? ` (choose ${a.min})`
            : ` (choose ${a.min}–${a.max}, numbers separated by spaces; blank = none)`,
        ),
    );
    a.options.forEach((o, i) => console.log(`  ${i + 1}. ${optionLabel(o)}`));
    const raw = (await ask('> ')).trim();
    if (raw === 'q') return { type: 'CONCEDE', player: ME };
    const picks = raw === '' ? [] : raw.split(/[\s,]+/).map((x) => a.options[Number(x) - 1]);
    if (
      picks.some((x) => x === undefined) ||
      new Set(picks).size !== picks.length ||
      picks.length < a.min ||
      picks.length > a.max
    ) {
      console.log(
        `Pick ${a.min === a.max ? a.min : `${a.min}–${a.max}`} different numbers from the list.`,
      );
      continue;
    }
    return { type: 'CHOOSE', player: ME, choiceId: a.choiceId, selection: picks as string[] };
  }
}

async function myCommand(s: GameState): Promise<Command> {
  const actions = getLegalActions(s, ME, ctx);
  const find = <T extends LegalAction['type']>(type: T) =>
    actions.find((a): a is Extract<LegalAction, { type: T }> => a.type === type);

  const mull = find('MULLIGAN');
  if (mull) {
    render(s);
    const raw = (
      await ask(c.bold('\nMulligan: hand numbers to return (e.g. "1 4"), blank to keep: '))
    ).trim();
    const ids =
      raw === ''
        ? []
        : raw
            .split(/[\s,]+/)
            .map((x) => s.players[ME].hand[Number(x.replace('h', '')) - 1])
            .filter((x): x is string => !!x);
    return { type: 'MULLIGAN', player: ME, cardIds: [...new Set(ids)] };
  }
  const choice = find('CHOOSE');
  if (choice) return chooseMany(s, choice);

  render(s);
  const options: Option[] = [];
  for (const a of actions) {
    switch (a.type) {
      case 'RIDE':
        for (const id of a.cardIds)
          options.push({
            label: `Ride ${cardLine(s, id)}`,
            then: () => ({ type: 'RIDE', player: ME, cardId: id }),
          });
        break;
      case 'CALL':
        options.push({
          label: 'Call a unit to a rear-guard circle',
          then: () =>
            menu(
              s,
              'Call which card?',
              a.cardIds.map((id) => ({
                label: cardLine(s, id),
                then: () =>
                  menu(
                    s,
                    `Call ${name(s, id)} to which circle?`,
                    a.circles.map((circle) => ({
                      label: `${circle}${s.players[ME].circles[circle].length ? ` (replaces ${name(s, s.players[ME].circles[circle].at(-1)!)})` : ''}`,
                      then: () => ({ type: 'CALL', player: ME, cardId: id, circle }),
                    })),
                  ),
              })),
            ),
        });
        break;
      case 'SWAP_REAR_GUARDS':
        for (const column of a.columns)
          options.push({
            label: `Swap the ${column} column's rear-guards`,
            then: () => ({ type: 'SWAP_REAR_GUARDS', player: ME, column }),
          });
        break;
      case 'ACTIVATE':
        for (const o of a.options) {
          const ab = def(s, o.source).abilities.find((x) => x.id === o.abilityId);
          options.push({
            label: `Activate ${name(s, o.source)}: ${short(ab?.text ?? 'granted ability', 90)}`,
            then: () => ({
              type: 'ACTIVATE',
              player: ME,
              source: o.source,
              abilityId: o.abilityId,
            }),
          });
        }
        break;
      case 'ATTACK':
        options.push({
          label: 'Attack',
          then: () =>
            menu(
              s,
              'Attack with?',
              a.options.map((o) => ({
                label: `${name(s, o.attacker)} (${o.attackerCircle}, ${currentPower(s, ctx, o.attacker)})`,
                then: () =>
                  menu(
                    s,
                    'Attack which unit?',
                    o.targets.map((t) => ({
                      label: `${name(s, t.id)} (${t.circle}, ${currentPower(s, ctx, t.id)})`,
                      then: () =>
                        o.boosters.length === 0
                          ? {
                              type: 'ATTACK',
                              player: ME,
                              attacker: o.attacker,
                              target: t.id,
                              booster: null,
                            }
                          : menu(s, 'Boost?', [
                              ...o.boosters.map((bo) => ({
                                label: `Boost with ${name(s, bo.id)} (+${currentPower(s, ctx, bo.id)})`,
                                then: (): Command => ({
                                  type: 'ATTACK',
                                  player: ME,
                                  attacker: o.attacker,
                                  target: t.id,
                                  booster: bo.id,
                                }),
                              })),
                              {
                                label: 'No boost',
                                then: (): Command => ({
                                  type: 'ATTACK',
                                  player: ME,
                                  attacker: o.attacker,
                                  target: t.id,
                                  booster: null,
                                }),
                              },
                            ]),
                    })),
                  ),
              })),
            ),
        });
        break;
      case 'GUARD':
        for (const id of a.cardIds)
          options.push({
            label: `Guard with ${cardLine(s, id)}`,
            then: () => ({ type: 'GUARD', player: ME, cardId: id }),
          });
        break;
      case 'INTERCEPT':
        for (const id of a.unitIds)
          options.push({
            label: `Intercept with ${name(s, id)} (shield ${def(s, id).shield})`,
            then: () => ({ type: 'INTERCEPT', player: ME, unitId: id }),
          });
        break;
      case 'PASS_GUARD':
        options.push({
          label: 'Stop guarding (take the attack)',
          then: () => ({ type: 'PASS_GUARD', player: ME }),
        });
        break;
      case 'END_PHASE': {
        const what = s.phase === 'battle' ? 'Stop attacking (end turn)' : `End ${s.phase} phase`;
        options.push({ label: what, then: () => ({ type: 'END_PHASE', player: ME }) });
        break;
      }
      default:
        break;
    }
  }
  options.push({ label: 'Concede', then: () => ({ type: 'CONCEDE', player: ME }) });
  return (await menu(s, 'What do you do? (?N = read hand card N, b = read board)', options))!;
}

// ---- main -------------------------------------------------------------------------------------

async function pickDeck(prompt: string): Promise<number> {
  console.log(c.bold(`\n${prompt}`));
  STARTER_DECKS.forEach((d, i) => console.log(`  ${i + 1}. ${d.name} — ${c.dim(d.description)}`));
  for (;;) {
    const n = Number((await ask('> ')).trim());
    if (STARTER_DECKS[n - 1]) return n - 1;
  }
}

async function main(): Promise<void> {
  console.log(
    c.bold('Cardfight!! Vanguard — BT01 playtest (rules: Comprehensive Rules 1.29, Nov 2014)'),
  );
  const seedArg = process.argv.indexOf('--seed');
  const seed =
    seedArg >= 0 ? Number(process.argv[seedArg + 1]) : Math.floor(Math.random() * 2 ** 31);
  const mine = await pickDeck('Choose your deck:');
  const theirs = await pickDeck("Choose the AI's deck:");
  const setup = { seed, decks: [STARTER_DECKS[mine]!.deck, STARTER_DECKS[theirs]!.deck] as const };
  let { state, events } = createGame(setup, ctx);
  console.log(c.dim(`Seed ${seed} (replay with: npm run play -- --seed ${seed})`));
  console.log(state.firstPlayer === ME ? 'You go first.' : 'The AI goes first.');
  const ai = new BasicController(ctx);
  const commands: Command[] = [];
  log(state, events);
  while (state.status !== 'finished') {
    const player = actingPlayer(state)!;
    const command =
      player === ME
        ? await myCommand(state)
        : ai.chooseCommand(viewFor(state, AI), AI, getLegalActions(state, AI, ctx));
    try {
      ({ state, events } = applyCommand(state, command, ctx));
      commands.push(command);
      log(state, events);
    } catch (err) {
      console.log(c.red(`Not allowed: ${(err as Error).message}`));
    }
  }
  render(state);
  console.log(c.dim(`\n${commands.length} commands. Seed ${seed}.`));
  rl.close();
}

main().catch((err: unknown) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
