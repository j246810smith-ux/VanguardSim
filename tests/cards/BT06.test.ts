/**
 * BT06 card tests: every card with abilities is named here at least once (cards:report).
 */
import { describe, expect, it } from 'vitest';
import {
  currentCritical,
  currentPower,
  currentShield,
  getLegalActions,
  type Command,
  type GameState,
  type LegalAction,
  type PlayerId,
} from '../../src/engine';
import {
  andThen as then,
  answer,
  apply,
  ctx,
  find,
  scene,
  vanilla,
  type Run,
} from '../fixtures/bt01';
import { unitAt } from '../fixtures/scenario';

const legal = <T extends LegalAction['type']>(s: GameState, p: PlayerId, type: T) =>
  getLegalActions(s, p, ctx).find((a): a is Extract<LegalAction, { type: T }> => a.type === type);
const inHand = (s: GameState, p: PlayerId, def: string) =>
  s.players[p].hand.find((id) => s.cards[id]!.definitionId === def)!;
const defOf = (s: GameState, id: string) => s.cards[id]!.definitionId;
const pw = (s: GameState, id: string) => currentPower(s, ctx, id);
const attack = (attacker: string, target: string, booster: string | null = null): Command => ({
  type: 'ATTACK',
  player: 0,
  attacker,
  target,
  booster,
});
const activate = (source: string, abilityId = '1', player: PlayerId = 0): Command => ({
  type: 'ACTIVATE',
  player,
  source,
  abilityId,
});
const call = (
  cardId: string,
  circle: 'front_left' | 'back_left' | 'front_right' | 'back_right' | 'back_center',
): Command => ({ type: 'CALL', player: 0, cardId, circle });
const endPhase = (p: PlayerId = 0): Command => ({ type: 'END_PHASE', player: p });
const passGuard = (r: Run): Run =>
  legal(r.state, 1, 'PASS_GUARD') ? then(r, { type: 'PASS_GUARD', player: 1 }) : r;
const field = (s: GameState, p: PlayerId) =>
  Object.values(s.players[p].circles)
    .flat()
    .map((id) => defOf(s, id));
function put(s: GameState, p: PlayerId, defs: readonly string[], zone: 'soul' | 'drop') {
  const pl = s.players[p];
  return defs.map((def) => {
    const id = pl.deck.find((x) => s.cards[x]!.definitionId === def);
    if (!id) throw new Error(`put: no ${def} in deck`);
    pl.deck.splice(pl.deck.indexOf(id), 1);
    pl[zone].push(id);
    s.cards[id]!.faceUp = true;
    return id;
  });
}
const fillSoul = (s: GameState, p: PlayerId, n: number) => {
  const pl = s.players[p];
  pl.soul.push(...pl.deck.splice(pl.deck.length - n, n));
};
/** Answer `player`'s pending choices: "yes", preferred options, else the first options offered. */
function drain(r: Run, player: PlayerId = 0, prefer: readonly string[] = []): Run {
  for (let i = 0; i < 40 && r.state.pendingChoice?.player === player; i++) {
    const c = r.state.pendingChoice;
    const preferred = c.options.filter((o) => prefer.includes(o)).slice(0, Math.max(c.max, 1));
    r =
      c.kind === 'yes_no'
        ? answer(r, 'yes')
        : preferred.length
          ? answer(r, ...preferred)
          : answer(r, ...c.options.slice(0, Math.max(c.min, 1)));
  }
  return r;
}

const AF_G2 = 'BT06-024';
const AF_G1 = 'BT06-047';
const GB_G2 = 'BT01-038';
const GB_G1 = 'BT01-077';
const GP_G2 = 'BT06-032'; // Knight of Superior Skills, Beaumains
const GP_G1 = 'BT06-082'; // Knight of Elegant Skills, Gareth
const NK_G2 = 'BT06-037';
const NK_G1 = 'BT06-091';
const NG_G2 = 'BT01-030';
const NG_G1 = 'BT01-060';
const RP_G1 = 'BT01-042';
const RP_G2 = 'BT01-021';
const OPP = 'BT01-021'; // a vanilla Royal Paladin: of none of BT06's clans
const GUARD = [RP_G1];

describe('Limit Break (BT06 introduces it)', () => {
  it.each(['BT06-001', 'BT06-003'])(
    '%s: +5000 attacking a vanguard only with four or more damage',
    (card) => {
      for (const [damage, bonus] of [
        [3, 0],
        [4, 5000],
      ] as const) {
        const s = scene({
          attacker: { circles: { vanguard: card }, damage: vanilla(damage) },
          defender: { circles: { vanguard: OPP }, hand: GUARD },
        });
        const vg = unitAt(s, 0, 'vanguard');
        const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard')));
        expect(pw(r.state, vg), `${damage} damage`).toBe(10000 + bonus);
      }
    },
  );

  it('BT06-004 Blond Ezel: LB4 ACT calls the top Gold Paladin and gains its original power', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT06-004' }, damage: vanilla(4), deckTop: [GP_G2] },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(legal(s, 0, 'ACTIVATE')).toBeDefined();
    const r = drain(apply(s, activate(vg)), 0, [s.players[0].deck[0]!, 'front_left']);
    expect(field(r.state, 0)).toContain(GP_G2);
    // +10000 original power, +1000 for the Gold Paladin rear-guard (its CONT)
    expect(pw(r.state, vg)).toBe(10000 + 10000 + 1000);
    const three = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT06-004' }, damage: vanilla(3) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(legal(three, 0, 'ACTIVATE')).toBeUndefined();
  });
});

describe('BT06-006 Dragonic Kaiser Vermillion: battles the whole front row', () => {
  const setup = () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT06-006' }, damage: vanilla(4), deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: RP_G1, front_left: RP_G1, front_right: RP_G2, back_left: RP_G2 },
        hand: ['BT01-046', 'BT01-047'],
        deckTop: vanilla(2),
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = then(drain(apply(s, activate(vg))), endPhase());
    return { s, r, vg };
  };

  it('attacks the vanguard and both front rear-guards at once; each is compared and hit', () => {
    const { s, r: start, vg } = setup();
    expect(pw(start.state, vg)).toBe(11000 + 2000);
    let r = then(start, attack(vg, unitAt(s, 1, 'vanguard')));
    expect(r.state.battle!.extraTargets.map((t) => t.circle).sort()).toEqual([
      'front_left',
      'front_right',
    ]);
    r = passGuard(r);
    expect(find(r.events, 'ATTACK_RESOLVED')).toHaveLength(3);
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(r.state.players[1].circles.front_right).toEqual([]);
    expect(r.state.players[1].circles.back_left).toHaveLength(1); // back row is not attacked
    expect(r.state.players[1].damage.length).toBeGreaterThan(0);
  });

  it('each guardian guards the attacked unit the defender chooses', () => {
    const { s, r: start, vg } = setup();
    let r = then(start, attack(vg, unitAt(s, 1, 'vanguard')));
    const guard = legal(r.state, 1, 'GUARD')!;
    expect(guard.guardable).toHaveLength(3);
    const fl = unitAt(s, 1, 'front_left');
    const card = r.state.players[1].hand[0]!;
    r = then(r, { type: 'GUARD', player: 1, cardId: card, guarding: fl });
    expect(pw(r.state, fl)).toBe(8000 + currentShield(r.state, ctx, card));
    expect(pw(r.state, unitAt(s, 1, 'vanguard'))).toBe(8000);
    r = passGuard(r);
    expect(r.state.players[1].circles.front_left).toEqual([fl]); // guarded: not hit
    expect(r.state.players[1].circles.front_right).toEqual([]);
  });

  it('cannot guard a unit that is not being attacked', () => {
    const { s, r: start, vg } = setup();
    const r = then(start, attack(vg, unitAt(s, 1, 'vanguard')));
    expect(() =>
      then(r, {
        type: 'GUARD',
        player: 1,
        cardId: r.state.players[1].hand[0]!,
        guarding: unitAt(s, 1, 'back_left'),
      }),
    ).toThrow(/not being attacked/);
  });

  it('without the ACT it is an ordinary single attack; -2000 with another clan', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT06-006', front_left: RP_G1 } },
      defender: { circles: { vanguard: OPP, front_left: RP_G1 }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(9000);
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard')));
    expect(r.state.battle!.extraTargets).toEqual([]);
  });
});

describe('shared shapes', () => {
  it.each([
    ['BT06-012', AF_G2, AF_G1],
    ['BT06-017', GP_G2, GP_G1],
    ['BT06-020', NK_G2, NK_G1],
  ])('perfect guard %s', (pg, vg, discardDef) => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: vg }, hand: [pg, discardDef] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, pg) });
    r = passGuard(drain(r, 1));
    expect(find(r.events, 'ATTACK_RESOLVED')[0]!.hit).toBe(false);
  });

  it.each([
    ['BT06-008', NG_G1],
    ['BT06-013', GB_G1],
  ])('%s: -2000 with a unit of another clan', (card, ally) => {
    const pure = scene({
      at: 'main',
      attacker: { circles: { vanguard: card, front_left: ally } },
      defender: { circles: { vanguard: OPP } },
    });
    const base = ctx.registry.get(card).power;
    expect(pw(pure, unitAt(pure, 0, 'vanguard'))).toBe(base);
    const mixed = scene({
      at: 'main',
      attacker: { circles: { vanguard: card, front_left: RP_G1 } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(mixed, unitAt(mixed, 0, 'vanguard'))).toBe(base - 2000);
  });

  it.each([
    ['BT06-009', 'BT06-025'],
    ['BT06-025', 'BT06-049'],
    ['BT06-049', 'BT06-026'],
  ])('%s (VC): +1000 with %s in the soul', (card, named) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: card } },
      defender: { circles: { vanguard: OPP } },
      extra: [[named], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    put(s, 0, [named], 'soul');
    expect(pw(s, vg)).toBe(base + 1000);
  });

  it.each([
    ['BT06-043', AF_G2, AF_G1],
    ['BT06-061', GB_G2, GB_G1],
    ['BT06-078', GP_G2, GP_G1],
    ['BT06-088', NK_G2, NK_G1],
    ['BT06-097', NG_G2, NG_G1],
  ])('%s: boosted by its clan, +2000', (card, _vg, booster) => {
    const s = scene({
      attacker: { circles: { vanguard: card, back_center: booster } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(ctx.registry.get(card).power + 8000 + 2000);
  });

  it.each([
    ['BT06-051', AF_G2],
    ['BT06-067', GB_G2],
    ['BT06-083', GP_G2],
    ['BT06-092', NK_G2],
    ['BT06-100', NG_G2],
  ])('%s: boosted hit on a vanguard, may return to hand', (card, vg) => {
    const s = scene({
      attacker: { circles: { vanguard: vg, back_center: card }, deckTop: vanilla(1) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const booster = unitAt(s, 0, 'back_center');
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), booster))),
    );
    expect(r.state.players[0].hand).toContain(booster);
  });

  it.each([
    ['BT06-064', GB_G1],
    ['BT06-081', GP_G1],
    ['BT06-090', NK_G1],
    ['BT06-099', NG_G1],
  ])('%s: hits a vanguard with four other clan rear-guards, draws', (card, body) => {
    const other = { [GB_G1]: GB_G2, [GP_G1]: GP_G2, [NK_G1]: NK_G2, [NG_G1]: NG_G2 }[body]!;
    const s = scene({
      attacker: {
        circles: {
          vanguard: body,
          front_left: card,
          back_left: body,
          front_right: body,
          back_right: body,
          back_center: other,
        },
      },
      defender: { circles: { vanguard: 'BT04-051' }, deckTop: vanilla(1) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it.each([
    ['BT06-030', GB_G2],
    ['BT06-033', GP_G2],
    ['BT06-038', NK_G2],
  ])('%s: hits a vanguard, a damage card face up', (card, vg) => {
    const s = scene({
      attacker: { circles: { vanguard: vg, front_left: card }, damage: vanilla(1) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const dmg = s.players[0].damage[0]!;
    s.cards[dmg]!.faceUp = false;
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.cards[dmg]!.faceUp).toBe(true);
  });

  it.each([
    ['BT06-054', AF_G2, 'BT06-001'],
    ['BT06-072', GB_G2, 'BT06-003'],
    ['BT06-085', GP_G2, 'BT06-004'],
    ['BT06-094', NK_G2, 'BT06-006'],
  ])('%s: CB1 and into the soul, finds a grade 3 in the top five', (card, vg, g3) => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: vg, back_left: card },
        damage: vanilla(1),
        deckTop: [...vanilla(2), g3, ...vanilla(2)],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'), '2')));
    expect(r.state.players[0].hand.map((id) => defOf(r.state, id))).toEqual([g3]);
  });

  it.each([
    ['BT06-054', AF_G1],
    ['BT06-035', GP_G1],
    ['BT06-041', NK_G1],
    ['BT06-042', NG_G1],
    ['BT06-060', AF_G1],
    ['BT06-071', GB_G1],
    ['BT06-072', GB_G1],
    ['BT06-085', GP_G1],
    ['BT06-094', NK_G1],
  ])('%s: another clan unit rides it, may call it', (g0, g1) => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: g0 }, hand: [g1] },
      defender: { circles: { vanguard: OPP } },
    });
    const self = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, g1) }), 0, [
      'back_left',
    ]);
    expect(r.state.players[0].circles.back_left).toEqual([self]);
  });

  it.each([
    ['BT06-058', AF_G2],
    ['BT06-087', GP_G2],
    ['BT06-096', NK_G2],
  ])('%s: into the soul, a clan unit gets +3000', (card, vg) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: vg, back_left: card } },
      defender: { circles: { vanguard: OPP } },
    });
    const v = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))));
    expect(pw(r.state, v)).toBe(13000);
  });

  it.each(['BT06-023', 'BT06-044', 'BT06-048'])(
    '%s: a card put into your damage zone, +2000',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: AF_G2, front_left: card }, hand: ['BT06-011', AF_G1] },
        defender: { circles: { vanguard: OPP } },
      });
      const unit = unitAt(s, 0, 'front_left');
      const base = pw(s, unit);
      const r = drain(apply(s, call(inHand(s, 0, 'BT06-011'), 'back_left')));
      expect(pw(r.state, unit)).toBe(base + 2000);
    },
  );

  it.each([
    ['BT06-053', 'BT06-001'],
    ['BT06-069', 'BT06-003'],
  ])('%s: SB1 when boosting %s, +5000', (card, vg) => {
    const s = scene({
      attacker: { circles: { vanguard: vg, back_center: card } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    fillSoul(s, 0, 1);
    const v = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(v, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
    expect(pw(r.state, v)).toBe(10000 + 6000 + 5000);
  });

  it.each(['BT06-050', 'BT06-066'])('%s: CB1 for +1000', (card) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GB_G2, front_left: card }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const u = unitAt(s, 0, 'front_left');
    expect(pw(drain(apply(s, activate(u))).state, u)).toBe(8000);
  });

  it.each([
    ['BT06-022', AF_G2],
    ['BT06-027', GB_G2],
  ])('%s: attacks a vanguard with a clan vanguard, +2000', (card, vg) => {
    const s = scene({
      attacker: { circles: { vanguard: vg, front_left: card } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const u = unitAt(s, 0, 'front_left');
    expect(pw(apply(s, attack(u, unitAt(s, 1, 'vanguard'))).state, u)).toBe(12000);
  });

  it.each(['BT06-005', 'BT06-034'])(
    '%s: boosted by a Gold Paladin, hits a vanguard, calls the top Gold Paladin',
    (card) => {
      const s = scene({
        attacker: {
          circles: { vanguard: GP_G2, front_left: card, back_left: GP_G1 },
          damage: vanilla(1),
          deckTop: [GP_G1],
        },
        defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
      });
      const top = s.players[0].deck[0]!;
      let r = passGuard(
        apply(
          s,
          attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
        ),
      );
      r = drain(r, 0, [top]);
      expect(Object.values(r.state.players[0].circles).flat()).toContain(top);
    },
  );
});

describe('BT06 cards', () => {
  it('BT06-001 Kiriel: placed on VC, calls a face-up Angel Feather from damage and refills it face down', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: AF_G2 },
        hand: ['BT06-001'],
        damage: [...vanilla(1), AF_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const angel = s.players[0].damage[1]!;
    const top = s.players[0].deck[0]!;
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT06-001') }));
    expect(Object.values(r.state.players[0].circles).flat()).toContain(angel);
    expect(r.state.players[0].damage).toContain(top);
    expect(r.state.cards[top]!.faceUp).toBe(false);
  });

  it.each(['BT06-002', 'BT06-011'])(
    '%s: puts an Angel Feather from hand into damage to take a damage card into hand',
    (card) => {
      const gc = card === 'BT06-002';
      const s = scene({
        attacker: gc
          ? { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) }
          : { circles: { vanguard: AF_G2 }, hand: [card, AF_G1], damage: vanilla(1) },
        defender: gc
          ? { circles: { vanguard: AF_G2 }, hand: [card, AF_G1], damage: vanilla(1) }
          : { circles: { vanguard: OPP } },
        ...(gc ? {} : { at: 'main' as const }),
      });
      const p: PlayerId = gc ? 1 : 0;
      const old = s.players[p].damage[0]!;
      let r = gc
        ? then(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), {
            type: 'GUARD',
            player: 1,
            cardId: inHand(s, 1, card),
          })
        : apply(s, call(inHand(s, 0, card), 'front_left'));
      r = drain(r, p, [old]);
      expect(r.state.players[p].hand).toContain(old);
      expect(r.state.players[p].damage.map((id) => defOf(r.state, id))).toContain(AF_G1);
    },
  );

  it('BT06-003 Cocytus: placed on VC, CB2 calls a Granblue from the drop zone', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: GB_G2 }, hand: ['BT06-003'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [[GB_G1], []],
    });
    put(s, 0, [GB_G1], 'drop');
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT06-003') }));
    expect(field(r.state, 0)).toContain(GB_G1);
  });

  it('BT06-007 Shiden / BT06-039 Raien: an opponent rear-guard cannot intercept', () => {
    for (const card of ['BT06-007', 'BT06-039']) {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: NK_G2 }, hand: [card] },
        defender: { circles: { vanguard: OPP, front_left: RP_G2 } },
      });
      const r = drain(apply(s, call(inHand(s, 0, card), 'front_left')));
      expect(
        r.state.restrictions.some(
          (x) => x.target === unitAt(s, 1, 'front_left') && x.restriction === 'cannot_intercept',
        ),
      ).toBe(true);
    }
  });

  it('BT06-008 Azure Dragon: hits a vanguard, discard a copy to stand two rear-guards', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT06-008', front_left: NG_G1, front_right: NG_G1 },
        rested: ['front_left', 'front_right'],
        hand: ['BT06-008'],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')))),
      0,
      [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'front_right')],
    );
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.orientation).toBe('stand');
  });

  it('BT06-009 Cosmo Healer: hits a vanguard, CB2 + discard to heal a damage card', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT06-009' },
        hand: ['BT06-009'],
        damage: vanilla(3),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.players[0].damage).toHaveLength(2);
  });

  it('BT06-010 Armaros: hits with an Angel Feather vanguard, CB2 to draw', () => {
    const s = scene({
      attacker: { circles: { vanguard: AF_G2, front_left: 'BT06-010' }, damage: vanilla(2) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it('BT06-013 Deadly Swordmaster: retire Deadly Spirit and Deadly Nightmare to ride from the drop zone', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GB_G2, front_left: 'BT06-029', back_left: 'BT06-031' } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT06-013'], []],
    });
    const [sword] = put(s, 0, ['BT06-013'], 'drop');
    const r = drain(apply(s, activate(sword!, '2')));
    expect(r.state.players[0].circles.vanguard).toEqual([sword]);
  });

  it('BT06-014 Thanatos: hits a vanguard, retire it to call another Granblue from the drop zone', () => {
    const s = scene({
      attacker: { circles: { vanguard: GB_G2, front_left: 'BT06-014' }, damage: vanilla(1) },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
      extra: [[GB_G1], []],
    });
    const [romario] = put(s, 0, [GB_G1], 'drop');
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))),
      0,
      ['front_left'],
    );
    expect(Object.values(r.state.players[0].circles).flat()).toContain(romario);
  });

  it('BT06-015 Agravain: Ultimate gives +1 critical and +1000 per Gold Paladin rear-guard for the rest of the game', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT06-015', front_left: GP_G1 }, damage: vanilla(5) },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 7);
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(apply(s, activate(vg, '2')));
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    expect(pw(r.state, vg)).toBe(11000);
    r = then(r, endPhase(), endPhase()); // the turn ends; the effects stay
    expect(r.state.grants.some((g) => g.target === vg && g.until === 'end_of_game')).toBe(true);
    expect(r.state.modifiers.some((m) => m.target === vg && m.until === 'end_of_game')).toBe(true);
  });

  it('BT06-016 Sleygal Dagger: four other Gold Paladin rear-guards, CB1 for +2000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: GP_G2,
          front_left: 'BT06-016',
          back_left: GP_G1,
          front_right: GP_G1,
          back_right: GP_G1,
          back_center: GP_G1,
        },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const u = unitAt(s, 0, 'front_left');
    expect(pw(drain(apply(s, activate(u))).state, u)).toBe(9000);
  });

  it('BT06-018 Indra: CB1, +1 critical for each Indra on your rear-guard circles', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT06-018', front_left: 'BT06-018', front_right: 'BT06-018' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(currentCritical(r.state, ctx, vg)).toBe(3);
  });

  it('BT06-019 Deathscythe: placed with a Narukami vanguard, CB2 retires a grade 2 or less', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: NK_G2 }, hand: ['BT06-019'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: RP_G2 } },
    });
    const r = drain(apply(s, call(inHand(s, 0, 'BT06-019'), 'front_left')));
    expect(r.state.players[1].circles.front_left).toEqual([]);
  });

  it('BT06-021 Feather Palace: Ultimate heals one damage card per Angel Feather rear-guard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT06-021', front_left: AF_G1, front_right: AF_G1 },
        damage: vanilla(5),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    fillSoul(s, 0, 7);
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.players[0].damage).toHaveLength(5 - 2); // two Angel Feather rear-guards: heal two
    expect(r.state.players[0].drop.length).toBeGreaterThanOrEqual(2);
  });

  it('BT06-025 Fate Healer / BT06-026 Nurse / BT06-049 Injector: the Ergodiel ride line', () => {
    // Nurse: when Injector rides it, look at seven for an Ergodiel
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'BT06-026' },
        hand: ['BT06-049'],
        deckTop: [...vanilla(3), 'BT06-025', ...vanilla(3)],
      },
      defender: { circles: { vanguard: OPP } },
    });
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT06-049') });
    r = drain(
      r,
      0,
      r.state.players[0].deck.filter((id) => defOf(r.state, id) === 'BT06-025'),
    );
    expect(r.state.players[0].hand.map((id) => defOf(r.state, id))).toContain('BT06-025');

    // Injector: when Fate Healer rides it (Nurse in the soul), swap a hand card for a damage card
    const i = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'BT06-049' },
        hand: ['BT06-025', AF_G1],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT06-026'], []],
    });
    put(i, 0, ['BT06-026'], 'soul');
    const dmg = i.players[0].damage[0]!;
    r = drain(apply(i, { type: 'RIDE', player: 0, cardId: inHand(i, 0, 'BT06-025') }), 0, [dmg]);
    expect(r.state.players[0].hand).toContain(dmg);

    // Fate Healer: when Cosmo Healer rides it (Injector in the soul), two for two
    const f = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'BT06-025' },
        hand: ['BT06-009', AF_G1, AF_G1],
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT06-049'], []],
    });
    put(f, 0, ['BT06-049'], 'soul');
    const damage = [...f.players[0].damage];
    r = drain(apply(f, { type: 'RIDE', player: 0, cardId: inHand(f, 0, 'BT06-009') }), 0, damage);
    expect(r.state.players[0].hand).toEqual(expect.arrayContaining(damage));
  });

  it.each([
    ['BT06-028', 3, 'BT06-003'],
    ['BT06-065', 2, 'BT06-028'],
  ])('%s: at the ride phase, discard to ride %s from the drop zone', (card, grade, target) => {
    const oppVg = grade === 3 ? 'BT01-033' : RP_G2;
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: card }, hand: [GB_G1], deckTop: vanilla(2) },
      extra: [['BT01-033'], [target]],
    });
    s.players[0].circles.vanguard = [];
    void oppVg;
    const opp = scene({
      attacker: { circles: { vanguard: oppVg } },
      defender: { circles: { vanguard: card }, hand: [GB_G1], deckTop: vanilla(2) },
      extra: [[], [target]],
    });
    const [dropped] = put(opp, 1, [target], 'drop');
    const r = drain(apply(opp, endPhase(0)), 1, [dropped!]);
    expect(r.state.players[1].circles.vanguard).toEqual([dropped]);
    expect(legal(r.state, 1, 'RIDE')).toBeUndefined();
  });

  it.each(['BT06-029', 'BT06-031'])(
    '%s: from the drop zone, SB2 + retire a Granblue to call itself',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: GB_G2, front_left: GB_G1 } },
        defender: { circles: { vanguard: OPP } },
        extra: [[card], []],
      });
      fillSoul(s, 0, 1);
      const [self] = put(s, 0, [card], 'drop');
      const r = drain(apply(s, activate(self!)), 0, ['back_left']);
      expect(Object.values(r.state.players[0].circles).flat()).toContain(self);
    },
  );

  it('BT06-035 Kyrph: with Beaumains on VC, Kyrph and Gareth into the soul ride Blond Ezel', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GP_G2, back_left: 'BT06-035', front_left: GP_G1 } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT06-004'], []],
    });
    let r = drain(apply(s, activate(unitAt(s, 0, 'back_left'), '2')));
    r = drain(
      r,
      0,
      r.state.players[0].deck.filter((id) => defOf(r.state, id) === 'BT06-004'),
    );
    expect(defOf(r.state, r.state.players[0].circles.vanguard[0]!)).toBe('BT06-004');
  });

  it('BT06-036 Gyras: Ultimate makes Narukami attacks mill a card for +3000/+1', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT06-036', front_left: NK_G1 },
        damage: vanilla(5),
        deckTop: [NK_G2, ...vanilla(3)],
      },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    fillSoul(s, 0, 7);
    let r = then(drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2'))), endPhase());
    const fl = unitAt(s, 0, 'front_left');
    r = drain(then(r, attack(fl, unitAt(s, 1, 'vanguard'))));
    expect(pw(r.state, fl)).toBe(8000 + 3000);
    expect(currentCritical(r.state, ctx, fl)).toBe(2);
  });

  it('BT06-040 Photon Bomber Wyvern: boosts a Narukami vanguard vs three damage, +4000', () => {
    const s = scene({
      attacker: { circles: { vanguard: NK_G2, back_center: 'BT06-040' } },
      defender: { circles: { vanguard: OPP }, damage: vanilla(3), hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(10000 + 6000 + 4000);
  });

  it('BT06-041 Saishin / BT06-042 White Tiger: boosted hit on a vanguard, into the soul for an effect', () => {
    const s = scene({
      attacker: { circles: { vanguard: NK_G2, back_center: 'BT06-041' }, damage: vanilla(1) },
      defender: { circles: { vanguard: RP_G1, front_left: 'BT04-047' }, deckTop: vanilla(1) },
    });
    let r = drain(
      passGuard(
        apply(
          s,
          attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
        ),
      ),
    );
    expect(r.state.players[1].circles.front_left).toEqual([]);

    const t = scene({
      attacker: {
        circles: { vanguard: NG_G2, back_center: 'BT06-042', front_left: 'BT06-098' },
        rested: ['front_left'],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: RP_G1 }, deckTop: vanilla(1) },
    });
    r = drain(
      passGuard(
        apply(
          t,
          attack(unitAt(t, 0, 'vanguard'), unitAt(t, 1, 'vanguard'), unitAt(t, 0, 'back_center')),
        ),
      ),
    );
    expect(r.state.cards[unitAt(t, 0, 'front_left')]!.orientation).toBe('stand');
  });

  it('BT06-045 Mastema / BT06-052 Clutch Rifle Angel: damage at least the opponent’s', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: AF_G2, front_left: 'BT06-045', back_center: 'BT06-052' },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, damage: vanilla(2), hand: GUARD },
    });
    const fl = unitAt(s, 0, 'front_left');
    expect(pw(apply(s, attack(fl, unitAt(s, 1, 'vanguard'))).state, fl)).toBe(11000);
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(10000 + 6000 + 4000);
  });

  it('BT06-046 Penemue: intercepts with an Angel Feather vanguard, +5000 shield', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: AF_G2, front_left: 'BT06-046' }, hand: GUARD },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'INTERCEPT', player: 1, unitId: unitAt(s, 1, 'front_left') });
    expect(currentShield(r.state, ctx, unitAt(s, 1, 'front_left'))).toBe(10000);
  });

  it('BT06-059 Happy Bell, Nociel: into the soul with a hand card into damage, takes a damage card', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: AF_G2, back_left: 'BT06-059' },
        hand: [AF_G1],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const dmg = s.players[0].damage[0]!;
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))), 0, [dmg]);
    expect(r.state.players[0].hand).toEqual([dmg]);
    const other = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: OPP, back_left: 'BT06-059' },
        hand: [AF_G1],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(legal(other, 0, 'ACTIVATE')).toBeUndefined();
  });

  it('BT06-060 Sunny Smile Angel: boosts +3000, then returns to the deck at the end phase', () => {
    const s = scene({
      attacker: { circles: { vanguard: AF_G2, back_center: 'BT06-060' } },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(10000 + 3000 + 3000);
  });

  it('BT06-062 Stormride Ghost Ship: loses Restraint when a Granblue is called from the drop zone', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GB_G2, front_left: 'BT06-062', back_left: GB_G1 } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT06-031'], []],
    });
    fillSoul(s, 0, 1);
    const [nightmare] = put(s, 0, ['BT06-031'], 'drop');
    let r = drain(apply(s, activate(nightmare!)), 0, [unitAt(s, 0, 'back_left'), 'back_right']);
    r = then(r, endPhase());
    expect(legal(r.state, 0, 'ATTACK')?.options.map((o) => o.attacker)).toContain(
      unitAt(s, 0, 'front_left'),
    );
  });

  it('BT06-063 Frigid Night: smaller hand, +3000; BT06-070 Cursed Rifle: discard for +4000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: GB_G2, front_left: 'BT06-063', front_right: 'BT06-070' },
        hand: [GB_G1],
      },
      defender: { circles: { vanguard: OPP }, hand: [RP_G1, RP_G1] },
    });
    const fl = unitAt(s, 0, 'front_left');
    expect(pw(apply(s, attack(fl, unitAt(s, 1, 'vanguard'))).state, fl)).toBe(11000);
    const fr = unitAt(s, 0, 'front_right');
    expect(pw(drain(apply(s, attack(fr, unitAt(s, 1, 'vanguard')))).state, fr)).toBe(10000);
  });

  it('BT06-068 Ripple Banshee: placed, another Granblue gets +2000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GB_G2 }, hand: ['BT06-068'] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, call(inHand(s, 0, 'BT06-068'), 'front_left')));
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(12000);
  });

  it('BT06-071 Captain Nightkid: CB1, looks at ten and puts a Granblue into the drop zone', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: GB_G2, back_left: 'BT06-071' },
        damage: vanilla(1),
        deckTop: [...vanilla(4), GB_G1, ...vanilla(5)],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'), '2')));
    expect(r.state.players[0].drop.map((id) => ctx.registry.get(defOf(r.state, id)).clan)).toEqual([
      'Granblue',
    ]);
  });

  it('BT06-076 Hades Steersman: a grade 3 Granblue placed on VC calls it from the drop zone behind', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: GB_G2 }, hand: ['BT06-027'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT06-076'], []],
    });
    const [steersman] = put(s, 0, ['BT06-076'], 'drop');
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT06-027') }));
    expect(r.state.players[0].circles.back_center).toEqual([steersman]);
  });

  it('BT06-077 Gigantech Crusher: four Gold Paladin rear-guards called this turn, +10000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT06-077' }, hand: [GP_G1, GP_G1, GP_G1, GP_G1] },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    let r: Run = { state: s, events: [] };
    for (const circle of ['front_left', 'back_left', 'front_right', 'back_right'] as const) {
      r = then(r, call(r.state.players[0].hand[0]!, circle));
    }
    r = then(r, endPhase());
    const vg = unitAt(s, 0, 'vanguard');
    r = then(r, attack(vg, unitAt(s, 1, 'vanguard')));
    expect(pw(r.state, vg)).toBe(20000);
  });

  it('BT06-079 Gigantech Commander / BT06-084 Tron: more rear-guards than the opponent', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: GP_G2,
          front_left: 'BT06-079',
          back_center: 'BT06-084',
          back_left: GP_G1,
        },
      },
      defender: { circles: { vanguard: OPP }, hand: GUARD },
    });
    const fl = unitAt(s, 0, 'front_left');
    expect(pw(apply(s, attack(fl, unitAt(s, 1, 'vanguard'))).state, fl)).toBe(11000);
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')));
    expect(pw(r.state, vg)).toBe(10000 + 6000 + 4000);
  });

  it('BT06-080 Elephas: CB2 calls a grade 0 Gold Paladin normal unit from the deck', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GP_G2 }, hand: ['BT06-080'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT06-035'], []],
    });
    const r = drain(apply(s, call(inHand(s, 0, 'BT06-080'), 'front_left')), 0, ['back_left']);
    expect(field(r.state, 0)).toContain('BT06-035');
  });

  it('BT06-089 Hex Cannon Wyvern / BT06-093 Yowsh: Narukami attack bonuses', () => {
    const s = scene({
      attacker: { circles: { vanguard: NK_G2, front_left: 'BT06-089', front_right: 'BT06-093' } },
      defender: { circles: { vanguard: OPP }, damage: vanilla(3), hand: GUARD },
    });
    fillSoul(s, 0, 1);
    const fl = unitAt(s, 0, 'front_left');
    expect(pw(apply(s, attack(fl, unitAt(s, 1, 'vanguard'))).state, fl)).toBe(11000);
    const fr = unitAt(s, 0, 'front_right');
    expect(pw(drain(apply(s, attack(fr, unitAt(s, 1, 'vanguard')))).state, fr)).toBe(9000);
  });

  it.each(['BT06-098', 'BT06-101'])(
    '%s: hits a vanguard, looks at five for Azure Dragon',
    (card) => {
      const s = scene({
        attacker: {
          circles: { vanguard: NG_G2, front_left: card },
          deckTop: [...vanilla(2), 'BT06-008', ...vanilla(2)],
        },
        defender: { circles: { vanguard: 'BT04-051' }, deckTop: vanilla(1) },
      });
      let r = passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))));
      r = drain(
        r,
        0,
        r.state.players[0].deck.filter((id) => defOf(r.state, id) === 'BT06-008'),
      );
      expect(r.state.players[0].hand.map((id) => defOf(r.state, id))).toContain('BT06-008');
    },
  );

  it('heal triggers with only reminder text (BT06-075)', () => {
    expect(ctx.registry.get('BT06-075').trigger).toBe('heal');
  });
});
