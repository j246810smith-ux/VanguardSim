/**
 * House rule Negromarl (prompt pack 2026-11-15, 3.3): Witch Doctor of the Abyss, Negromarl
 * (BT02-012, printed grade 3 / 8000) gets +2000 or +3000 power on (VC) and (RC), Original era
 * formats only, off by default; every other power effect adds on top.
 */
import { describe, expect, it } from 'vitest';
import { basePower, currentShield, type GameState } from '../../src/engine';
import { ctx, scene } from '../fixtures/bt01';
import { unitAt } from '../fixtures/scenario';
import { OPP } from '../fixtures/shapeChecks';

const NEGROMARL = 'BT02-012';

function board(rule?: 2000 | 3000, formatId?: string): GameState {
  const s = structuredClone(
    scene({
      at: 'main',
      attacker: { circles: { vanguard: NEGROMARL, front_left: NEGROMARL } },
      defender: { circles: { vanguard: OPP } },
    }),
  );
  if (rule) (s as { customRules: unknown }).customRules = { negromarl: rule };
  if (formatId) (s as { formatId: string }).formatId = formatId;
  return s;
}

describe('Negromarl house rule', () => {
  it('is off by default: printed 8000', () => {
    const s = board();
    expect(basePower(s, ctx, unitAt(s, 0, 'vanguard'))).toBe(8000);
  });

  it('+2000 or +3000 on (VC) and (RC)', () => {
    for (const bonus of [2000, 3000] as const) {
      const s = board(bonus);
      expect(basePower(s, ctx, unitAt(s, 0, 'vanguard'))).toBe(8000 + bonus);
      expect(basePower(s, ctx, unitAt(s, 0, 'front_left'))).toBe(8000 + bonus);
    }
  });

  it('also in Original Era — Expanded, never in the G era', () => {
    const ex = board(2000, 'ORIGINAL_EXPANDED');
    expect(basePower(ex, ctx, unitAt(ex, 0, 'vanguard'))).toBe(10000);
    const g = board(2000, 'G_ERA');
    expect(basePower(g, ctx, unitAt(g, 0, 'vanguard'))).toBe(8000);
  });

  it('only Negromarl, and not its shield', () => {
    const s = board(3000);
    expect(basePower(s, ctx, unitAt(s, 1, 'vanguard'))).toBe(
      basePower(board(), ctx, unitAt(board(), 1, 'vanguard')),
    );
    const id = unitAt(s, 0, 'front_left');
    expect(currentShield(s, ctx, id)).toBe(
      currentShield(board(), ctx, unitAt(board(), 0, 'front_left')),
    );
  });
});

describe('prompts name the card whose ability asks (prompt pack 2026-11-15, 3.6)', () => {
  it('a "you may pay" prompt carries its source card', async () => {
    const { apply } = await import('../fixtures/bt01');
    const { inHand } = await import('../fixtures/cardTest');
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: NEGROMARL },
        hand: [NEGROMARL],
        damage: ['BT01-021', 'BT01-022'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const card = inHand(s, 0, NEGROMARL);
    const r = apply(s, { type: 'CALL', player: 0, cardId: card, circle: 'front_left' });
    expect(r.state.pendingChoice?.kind).toBe('yes_no');
    expect(r.state.pendingChoice?.source).toBe(card);
  });
});

describe('lock prompts name their card (prompt pack 2026-11-15, 3.6)', () => {
  it("BT17-034 Osmium's hit asks which locked card stays locked, naming Osmium", async () => {
    const { apply: run, andThen } = await import('../fixtures/bt01');
    const { attack, drain } = await import('../fixtures/cardTest');
    const { lockOpp, OPP, OPP_G1, unitAt } = await import('../fixtures/shapeChecks');
    const { legal } = await import('../fixtures/cardTest');
    const s = scene({
      attacker: { circles: { vanguard: OPP, front_left: 'BT17-034' } },
      defender: {
        circles: { vanguard: OPP_G1, front_left: OPP, front_right: OPP },
        deckTop: ['BT01-021', 'BT01-022'],
      },
    });
    lockOpp(s, 'front_left');
    lockOpp(s, 'front_right');
    const osmium = unitAt(s, 0, 'front_left');
    let r = run(s, attack(osmium, unitAt(s, 1, 'vanguard'), null));
    for (let i = 0; i < 40; i++) {
      const c = r.state.pendingChoice;
      if (c?.player === 0 && c.options.every((o) => r.state.cards[o]?.locked)) break;
      if (c) r = drain(r, c.player, []);
      else if (legal(r.state, 1, 'PASS_GUARD')) r = andThen(r, { type: 'PASS_GUARD', player: 1 });
      else break;
    }
    const c = r.state.pendingChoice;
    expect(c?.options).toHaveLength(2);
    expect(c?.source).toBe(osmium);
  });
});
