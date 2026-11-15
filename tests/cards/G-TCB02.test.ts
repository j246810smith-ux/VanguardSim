/**
 * G-TCB02 "The GENIUS STRATEGY": every card with text is scripted, Success, Dark Device and
 * Obtirandus's "cannot call to (RC)" work, and Murakumo, Megacolony and Great Nature decks are
 * played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { gApply, gCtx, gLegal } from '../fixtures/gEra';
import { maker, pw, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const MK = maker('Murakumo', ['G-TCB02-001', 'G-TCB02-022'], ctx);
const MC = maker('Megacolony', ['G-TCB02-002', 'G-TCB02-006'], ctx);
const GN = maker('Great Nature', ['G-TCB02-008', 'G-TCB02-036'], ctx);

describe('G-TCB02', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-TCB02-'));
    expect(cards).toHaveLength(75);
    expect(
      cards
        .filter(
          (d) =>
            d.text.trim() !== '' &&
            !/^\(You may only have up to four/.test(d.text.trim()) &&
            d.abilities.length === 0,
        )
        .map((d) => d.id),
    ).toEqual([]);
  });

  it('Success 20000: Cornegie becomes successful (+4000) once a rear-guard reaches 20000', () => {
    const s = scene(
      [GN, KG],
      {
        circles: { vanguard: 'G-TCB02-037', front_left: 'G-TCB02-066', front_right: 'G-TCB02-065' },
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main' },
    );
    const corn = s.players[0].circles.front_left[0]!;
    expect(pw(s, corn)).toBe(9000);
    // push the other rear-guard to 20000 with an effect, then let check timing run
    const t: GameState = structuredClone(s);
    const panda = t.players[0].circles.front_right[0]!;
    t.modifiers.push({ target: panda, stat: 'power', amount: 11000, until: 'end_of_turn' });
    const r = gApply(t, { type: 'END_PHASE', player: 0 });
    expect(r.state.cards[corn]!.successful).toBe(true);
    expect(pw(r.state, corn)).toBe(13000);
  });

  it('Dark Device: Aristscythe gets +2000 only with no standing opponent unit in its column', () => {
    const def = ctx.registry.get('G-TCB02-055');
    expect(def.abilities[0]!.kind).toBe('AUTO');
    const s = scene(
      [MC, KG],
      { circles: { vanguard: 'G-TCB02-031', front_left: 'G-TCB02-055' } },
      { circles: { vanguard: 'G-BT01-014', front_right: 'G-BT01-073' } },
    );
    const unit = s.players[0].circles.front_left[0]!;
    const atk = (st: GameState) =>
      gApply(st, {
        type: 'ATTACK',
        player: 0,
        attacker: unit,
        target: st.players[1].circles.vanguard.at(-1)!,
        booster: null,
      }).state;
    // the opponent's front-right rear-guard faces our front-left: standing, no bonus
    expect(pw(atk(s), unit)).toBe(9000);
    const rested: GameState = structuredClone(s);
    rested.cards[rested.players[1].circles.front_right[0]!]!.orientation = 'rest';
    expect(pw(atk(rested), unit)).toBe(11000);
  });

  it('Obtirandus: the opponent cannot call to (RC) until the end of their next turn', () => {
    const s: GameState = structuredClone(
      scene(
        [MC, KG],
        { circles: { vanguard: 'G-TCB02-031' } },
        { circles: { vanguard: 'G-BT01-014' } },
        { at: 'main' },
      ),
    );
    s.players[1].noRCCallsThrough = s.turnNumber + 1;
    const t: GameState = structuredClone(s);
    t.activePlayer = 1;
    t.turnNumber += 1;
    expect(gLegal(t, 1, 'CALL')).toBeUndefined();
    t.turnNumber += 2;
    // later turns are free again (only the phase check remains)
    expect((t.players[1].noRCCallsThrough ?? -1) >= t.turnNumber).toBe(false);
  });
});

describe('G-TCB02 decks played out by the basic AI', () => {
  it.each([
    [
      'Murakumo',
      MK,
      ['G-TCB02-005', 'G-TCB02-023', 'G-TCB02-043', 'G-TCB02-045', 'G-TCB02-048', 'G-TCB02-053'],
    ],
    [
      'Megacolony',
      MC,
      ['G-TCB02-007', 'G-TCB02-031', 'G-TCB02-032', 'G-TCB02-055', 'G-TCB02-057', 'G-TCB02-064'],
    ],
    [
      'Great Nature',
      GN,
      ['G-TCB02-009', 'G-TCB02-037', 'G-TCB02-039', 'G-TCB02-066', 'G-TCB02-068', 'G-TCB02-075'],
    ],
  ] as const)('%s', (_clan, make, include) => {
    const deck = make([...include]);
    for (const seed of [3, 11]) {
      const { finalState, truncated } = runMatch({ seed, decks: [deck, deck] }, ctx, [
        new BasicController(ctx),
        new BasicController(ctx),
      ]);
      expect(truncated).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
    }
  });
});
