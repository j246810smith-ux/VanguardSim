/**
 * Maintain the OU (Original Era Usable) list, data/ou/ou-list.json (six-workstream brief W1).
 * Players cannot change it; this is the maintainer's tool.
 *
 *   npm run ou -- list                        every entry, with blockers
 *   npm run ou -- check <id>                  what would stop a card being OU
 *   npm run ou -- set <id> <status> [notes]   status: approved | proposed | rejected | held
 *   npm run ou -- remove <id>
 *   npm run ou -- version <x.y>               a new list version (new entries record it)
 *
 * `set ... approved` refuses a card that needs G era rules (ouBlockers) or is not in the pool.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { cardRegistry } from '../src/cards';
import { ouBlockers, parseOuList, type OuStatus } from '../src/engine';

const FILE = 'data/ou/ou-list.json';
const raw = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, unknown>;
const list = parseOuList(raw);
const registry = cardRegistry();
const [cmd, id, arg, ...rest] = process.argv.slice(2);

const blockersOf = (cardId: string): string[] =>
  registry.has(cardId) ? ouBlockers(registry.get(cardId)) : ['not in the card pool'];

function save(cards: typeof list.cards, version = list.version) {
  writeFileSync(FILE, `${JSON.stringify({ ...raw, version, cards }, null, 2)}\n`);
  console.log(`saved ${FILE} (v${version}, ${cards.length} entries)`);
}

switch (cmd) {
  case 'list':
    for (const e of list.cards) {
      const b = blockersOf(e.id);
      console.log(
        `${e.id}\t${e.status}\tv${e.since}\t${b.length ? `blockers: ${b.join('; ')}` : 'ok'}`,
      );
    }
    break;
  case 'check': {
    const b = blockersOf(id!);
    console.log(b.length ? `${id}: ${b.join('; ')}` : `${id}: nothing needs G era rules`);
    break;
  }
  case 'set': {
    const status = arg as OuStatus;
    if (!['approved', 'proposed', 'rejected', 'held'].includes(status))
      throw new Error(`bad status ${arg}`);
    const b = blockersOf(id!);
    if (status === 'approved' && b.length) throw new Error(`${id} cannot be OU: ${b.join('; ')}`);
    const old = list.cards.find((c) => c.id === id);
    const notes = rest.length
      ? [arg === undefined ? '' : '', ...rest].join(' ').trim()
      : old?.notes;
    const entry = {
      id: id!,
      status,
      since: old?.since ?? list.version,
      ...(notes ? { notes } : {}),
    };
    save([...list.cards.filter((c) => c.id !== id), entry]);
    break;
  }
  case 'remove':
    save(list.cards.filter((c) => c.id !== id));
    break;
  case 'version':
    save(list.cards, id!);
    break;
  default:
    console.log(
      'npm run ou -- list | check <id> | set <id> <status> [notes] | remove <id> | version <x.y>',
    );
}
