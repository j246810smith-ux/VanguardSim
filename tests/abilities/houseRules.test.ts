/**
 * The user's house rules C1 (9K grade 3 bonus) and C2 (cheaper Mega Blast), docs/design/
 * V032_FEEDBACK_AUDIT.md: off by default, chosen when the game is created (`customRules`).
 */
import { describe, expect, it } from 'vitest';
import { SETS } from '../../src/cards';
import {
  actingPlayer,
  basePower,
  getLegalActions,
  type CustomRules,
  type GameState,
} from '../../src/engine';
import { G_ERA_FORMAT } from '../../src/engine/rules/format';
import { answer, apply, ctx, scene, vanilla } from '../fixtures/bt01';
import { activate, drain } from '../fixtures/cardTest';
import { fillSoul, OPP, unitAt } from '../fixtures/shapeChecks';
import { BasicController } from '../../src/ai/basicController';
import { STARTER_DECKS } from '../../src/decks/starters';
import { cheaperMegaBlast } from '../../src/engine/abilities/runtime';
import { runMatch } from '../../src/sim/runMatch';

const bt01 = SETS.find((x) => x.file.cards.some((c) => c.id.startsWith('BT01-')))!.file.cards;
/** A BT01 grade 3 with this printed power and no [CONT] ability that could change it. */
const grade3 = (power: number) =>
  bt01.find(
    (c) =>
      c.id.startsWith('BT01-') &&
      c.grade === 3 &&
      c.power === power &&
      !ctx.registry.get(c.id).abilities.some((a) => a.kind === 'CONT'),
  )!.id;
const NINE_K = grade3(9000);
const TEN_K = grade3(10000);

const withRules = (s: GameState, rules: CustomRules): GameState => ({ ...s, customRules: rules });

const vanguardScene = (vanguard: string, front?: string) =>
  scene({
    at: 'main',
    attacker: { circles: { vanguard, ...(front ? { front_left: front } : {}) } },
    defender: { circles: { vanguard: OPP } },
  });

describe('C1: 9K grade 3 bonus', () => {
  it('found the test cards', () => {
    expect(ctx.registry.get(NINE_K).power).toBe(9000);
    expect(ctx.registry.get(TEN_K).power).toBe(10000);
  });

  it('a printed 9000 grade 3 on (VC) gets +1000, or +2000 with that setting', () => {
    const s = vanguardScene(NINE_K);
    const vc = unitAt(s, 0, 'vanguard');
    expect(basePower(s, ctx, vc)).toBe(9000);
    expect(basePower(withRules(s, { nineKGrade3: 1000 }), ctx, vc)).toBe(10000);
    expect(basePower(withRules(s, { nineKGrade3: 2000 }), ctx, vc)).toBe(11000);
  });

  it('not on (RC), not for a printed 10000, and not in the G era', () => {
    const s = withRules(vanguardScene(TEN_K, NINE_K), { nineKGrade3: 1000 });
    expect(basePower(s, ctx, unitAt(s, 0, 'front_left'))).toBe(9000);
    expect(basePower(s, ctx, unitAt(s, 0, 'vanguard'))).toBe(10000);
    const g = {
      ...withRules(vanguardScene(NINE_K), { nineKGrade3: 1000 }),
      formatId: G_ERA_FORMAT.id,
    };
    expect(basePower(g, ctx, unitAt(g, 0, 'vanguard'))).toBe(9000);
  });

  it('a printed 10000 reduced to 9000 by an effect does not qualify', () => {
    const s = withRules(vanguardScene(TEN_K), { nineKGrade3: 1000 });
    const vc = unitAt(s, 0, 'vanguard');
    const reduced: GameState = {
      ...s,
      modifiers: [{ target: vc, stat: 'power', amount: -1000, until: 'end_of_turn' }],
    };
    expect(basePower(reduced, ctx, vc)).toBe(9000);
  });
});

describe('C2: cheaper Mega Blast', () => {
  const VORTEX = 'BT01-013'; // [Soul-Blast 8 & Counter-Blast 5] retire up to three rear-guards
  const mega = (damage: number, soul: number, rules: CustomRules = {}) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: VORTEX }, damage: vanilla(damage) },
      defender: { circles: { vanguard: OPP } },
    });
    // exactly `soul` cards in the soul
    const pl = s.players[0];
    pl.deck.push(...pl.soul.splice(0));
    fillSoul(s, 0, soul);
    return withRules(s, rules);
  };
  const canMega = (s: GameState) =>
    getLegalActions(s, 0, ctx).some(
      (a) => a.type === 'ACTIVATE' && a.options.some((o) => o.abilityId === '2'),
    );
  const faceDown = (s: GameState) =>
    s.players[0].damage.filter((id) => !s.cards[id]!.faceUp).length;

  it('without the rule, CB4 & SB6 is not enough', () => {
    expect(canMega(mega(4, 6))).toBe(false);
    expect(canMega(mega(5, 8))).toBe(true);
  });

  it('with the rule, CB4 & SB6 is enough and is paid without a question', () => {
    const s = mega(4, 6, { megaBlastCheap: true });
    expect(canMega(s)).toBe(true);
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(faceDown(r.state)).toBe(4);
    expect(r.state.players[0].soul.length).toBe(0);
  });

  it('when both can be paid the player chooses; the cheaper one costs CB4 & SB6', () => {
    const s = mega(5, 8, { megaBlastCheap: true });
    const r = apply(s, activate(unitAt(s, 0, 'vanguard'), '2'));
    expect(r.state.pendingChoice).toMatchObject({ kind: 'yes_no', player: 0 });
    expect(r.state.pendingChoice!.prompt).toMatch(/Counter Blast 4 & Soul Blast 6/);
    const cheap = drain(answer(r, 'yes'));
    expect(faceDown(cheap.state)).toBe(4);
    expect(cheap.state.players[0].soul.length).toBe(2);
    const full = drain(answer(r, 'no'));
    expect(faceDown(full.state)).toBe(5);
    expect(full.state.players[0].soul.length).toBe(0);
  });

  it('other costs are unchanged by the rule', () => {
    const s = mega(5, 8, { megaBlastCheap: true });
    expect(actingPlayer(s)).toBe(0);
    expect(ctx.registry.get('BT01-014').abilities.length).toBeGreaterThan(0);
  });
});

describe('the CPU with both house rules on', () => {
  it('plays whole games without an error, Mega Blast decks included', () => {
    const decks = STARTER_DECKS.filter((d) =>
      d.deck.cards.some((id) =>
        cheaperMegaBlast(
          { customRules: { megaBlastCheap: true } } as GameState,
          ctx.registry.get(id).abilities.flatMap((a) => (a.kind === 'ACT' ? a.cost : [])),
        ),
      ),
    );
    const pool = decks.length ? decks : STARTER_DECKS;
    for (let seed = 1; seed <= 4; seed++) {
      const r = runMatch(
        {
          seed,
          decks: [
            pool[seed % pool.length]!.deck,
            STARTER_DECKS[(seed * 3) % STARTER_DECKS.length]!.deck,
          ],
          customRules: { nineKGrade3: 1000, megaBlastCheap: true },
        },
        ctx,
        [new BasicController(ctx), new BasicController(ctx)],
      );
      expect(r.truncated).toBe(false);
      expect(r.finalState.status).toBe('finished');
      // the rules were in force in these games
      expect(r.finalState.customRules).toEqual({ nineKGrade3: 1000, megaBlastCheap: true });
    }
  });
});
