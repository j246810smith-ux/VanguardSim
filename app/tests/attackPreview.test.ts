import { describe, expect, it } from 'vitest';
import type { AttackOption, Circle, GameState } from '../../src/engine';
import { attackPreview, shieldNeeded } from '../renderer/game/attackPreview';

type Units = Partial<Record<Circle, string>>;

/** Just enough GameState for the preview: circles, legion, orientation, battle. */
function board(me: Units, ai: Units, opts: { rested?: string[]; legion?: [string, string] } = {}) {
  const circles = (u: Units) =>
    Object.fromEntries(
      (
        ['vanguard', 'front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const
      ).map((c) => [c, u[c] ? [u[c]] : []]),
    );
  const ids = [...Object.values(me), ...Object.values(ai), ...(opts.legion ?? [])];
  const cards = Object.fromEntries(
    ids.map((id) => [
      id,
      { locked: false, orientation: opts.rested?.includes(id!) ? 'rest' : 'stand' },
    ]),
  );
  const mvc = opts.legion ? { ...circles(me), vanguard: [...opts.legion] } : circles(me);
  return {
    players: [
      {
        circles: mvc,
        legion: opts.legion ? { leader: opts.legion[0], mate: opts.legion[1] } : null,
      },
      { circles: circles(ai), legion: null },
    ],
    cards,
    battle: null,
  } as unknown as GameState;
}

const POWER: Record<string, number> = {
  vg: 11000,
  lead: 11000,
  mate: 10000,
  fl: 9000,
  fr: 10000,
  bl: 7000,
  bc: 8000,
  br: 6000,
  oppVg: 11000,
};
const stats = { power: (id: string) => POWER[id] ?? 0, critical: () => 1 };

const option = (
  attacker: string,
  attackerCircle: Circle,
  booster?: [string, AttackOption['boosters'][number]['circle']],
): AttackOption => ({
  attacker,
  attackerCircle,
  targets: [{ id: 'oppVg', circle: 'vanguard' }],
  boosters: booster ? [{ id: booster[0], circle: booster[1] }] : [],
});

describe('attack preview (D-028)', () => {
  it('needs the smallest 5000-step shield that beats the attack', () => {
    expect(shieldNeeded(10000, 11000)).toBe(0);
    expect(shieldNeeded(11000, 11000)).toBe(5000);
    expect(shieldNeeded(16000, 11000)).toBe(10000);
    expect(shieldNeeded(19000, 11000)).toBe(10000);
    expect(shieldNeeded(21000, 11000)).toBe(15000);
  });

  it('adds the default booster per column and compares with the opposing vanguard', () => {
    const view = board(
      { vanguard: 'vg', front_left: 'fl', front_right: 'fr', back_left: 'bl', back_center: 'bc' },
      { vanguard: 'oppVg' },
    );
    const options = [
      option('fl', 'front_left', ['bl', 'back_left']),
      option('vg', 'vanguard', ['bc', 'back_center']),
      option('fr', 'front_right'),
    ];
    const p = attackPreview(view, 0, options, null, stats);
    expect(p.targetPower).toBe(11000);
    expect(p.columns.map((c) => [c.label, c.attack, c.boost, c.total, c.needs])).toEqual([
      ['LEFT', 9000, 7000, 16000, 10000],
      ['VG', 11000, 8000, 19000, 10000],
      ['RIGHT', 10000, 0, 10000, 0],
    ]);
    expect(p.columns.every((c) => c.ready && c.note === null)).toBe(true);
  });

  it('follows the selected attacker and its boost toggle', () => {
    const view = board({ vanguard: 'vg', back_center: 'bc' }, { vanguard: 'oppVg' });
    const options = [option('vg', 'vanguard', ['bc', 'back_center'])];
    const off = attackPreview(
      view,
      0,
      options,
      { kind: 'attacker', id: 'vg', booster: null },
      stats,
    );
    const vg = off.columns[1]!;
    expect([vg.selected, vg.boost, vg.total, vg.needs]).toEqual([true, 0, 11000, 5000]);
  });

  it('marks empty and rested columns', () => {
    const view = board(
      { vanguard: 'vg', front_left: 'fl' },
      { vanguard: 'oppVg' },
      {
        rested: ['fl'],
      },
    );
    const p = attackPreview(view, 0, [option('vg', 'vanguard')], null, stats);
    expect(p.columns.map((c) => c.note)).toEqual(['rested', null, 'empty']);
    expect(p.columns[0]!.ready).toBe(false);
  });

  it('counts a legion with both units', () => {
    const view = board({}, { vanguard: 'oppVg' }, { legion: ['lead', 'mate'] });
    const p = attackPreview(view, 0, [option('lead', 'vanguard')], null, stats);
    expect(p.columns[1]!.attack).toBe(21000);
    expect(p.columns[1]!.needs).toBe(15000);
  });
});
