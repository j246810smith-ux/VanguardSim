/**
 * G-BT11 "Demonic Advent" card tests (DECISIONS D-034): Dominate (CR 1.48.1 10.35) and the other new
 * pieces have real tests, every card with text is checked to be scripted, and each clan's deck with
 * its G units is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { SmartController } from '../../src/ai/smartController';
import { runMatch } from '../../src/sim/runMatch';
import {
  checkZoneInvariant,
  currentPower,
  G_ERA_FORMAT,
  type EngineContext,
  type GameState,
} from '../../src/engine';
import { gApply, gCtx, gLegal, settle, type Run } from '../fixtures/gEra';
import {
  andThen,
  answer,
  atGuard,
  callFrom,
  def,
  fill,
  maker,
  pick,
  scene,
  stride,
  strideToMain,
  type Maker,
} from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';
import { interceptors } from '../../src/engine/game/combat';

const ctx: EngineContext = {
  ...gCtx,
  format: { ...G_ERA_FORMAT, legalSets: [...G_ERA_FORMAT.legalSets, 'G-BT11'] },
};
const NB = (g: string[]): Maker => maker('Nubatama', g, ctx);
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const MUJIN = 'G-BT11-008';
const MAGUN = 'G-BT11-017';
const GEHOU = 'G-BT11-018';
const UTSUROI = 'G-BT11-020';
const KASSEN = 'G-BT11-077';
const UZUITACHI = 'G-BT11-078';
const TENGAI = 'G-BT11-080';
const MORISHIGE = 'G-BT11-076'; // Nubatama grade 3
const DOHA = 'G-BT01-067'; // Kagero grade 2, 10000, no abilities
const GARAN = 'G-BT01-072'; // Kagero grade 1, 8000, no abilities
const BLADEMASTER = 'G-BT01-014'; // Kagero grade 3, 11000
const HEAL = 'BT13-059'; // Nubatama heal trigger

const declared = (r: Run) => r.events.flatMap((e) => (e.type === 'ATTACK_DECLARED' ? [e] : []));
const answerUntil = (r: Run, card: string, ...selection: string[]) =>
  answer(settle(r, { stopWhen: pick(card) }), ...selection);
const idle = (s: GameState) => s.battle === null && s.tasks.length === 0 && !s.pendingChoice;

describe('Dominate (CR 1.48.1 10.35)', () => {
  it('G-BT11-008 Mujinlord: the chosen opponent rear-guards get +4000, are dominated and each attack the vanguard', () => {
    const s0 = scene(
      [NB([MUJIN]), KG],
      {
        circles: { vanguard: MORISHIGE, back_right: TENGAI },
        hand: [MORISHIGE],
        damage: [GARAN, GARAN],
      },
      { circles: { vanguard: BLADEMASTER, front_left: DOHA, back_left: GARAN } },
      { at: 'ride', faceUpG: 1, ctx },
    );
    const doha = unitAt(s0, 1, 'front_left');
    const garan = unitAt(s0, 1, 'back_left');
    const vg = unitAt(s0, 1, 'vanguard');
    // stride (one face-up Mujinlord already, its cost turns a second one face up: up to two units)
    const st = strideToMain(s0, MUJIN).state;
    const source = unitAt(st, 0, 'vanguard');
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === source)!;
    let r = gApply(st, { type: 'ACTIVATE', player: 0, source, abilityId: o.abilityId });
    r = settle(r, { stopWhen: pick(doha) });
    r = answer(r, doha, garan);
    // the first battle reaches the guard step and waits for the defender
    r = settle(r, { stopWhen: atGuard });
    expect(r.state.battle?.attacker).toBe(doha); // in the order they were chosen
    expect(r.state.cards[garan]!.dominatedBy).toBe(0);
    expect(r.state.cards[doha]!.dominatedBy).toBe(0);
    // CR 1.48.1 10.35.6: a dominated rear-guard cannot intercept
    const intercept = gLegal(r.state, 1, 'INTERCEPT');
    expect(intercept?.unitIds ?? []).not.toContain(doha);
    r = settle(r);
    const attacks = declared(r);
    expect(attacks.map((a) => a.attacker).sort()).toEqual([doha, garan].sort());
    expect(attacks.every((a) => a.target === vg && a.booster === null)).toBe(true);
    // +4000 each (10000 → 14000, 8000 → 12000); the first hit's damage check may power up the vanguard
    const powers = r.events.flatMap((e) => (e.type === 'ATTACK_RESOLVED' ? [e.attackPower] : []));
    expect(powers).toEqual([14000, 12000]);
    expect(r.events.some((e) => e.type === 'ATTACK_HIT')).toBe(true);
    // CR 1.48.1 10.35.1.2: domination ends with the effect; still the main phase, nothing pending
    expect(r.state.cards[doha]!.dominatedBy).toBeUndefined();
    expect(r.state.cards[garan]!.dominatedBy).toBeUndefined();
    expect(r.state.cards[doha]!.orientation).toBe('rest');
    expect(r.state.players[1].circles.front_left).toContain(doha);
    expect(r.state.phase).toBe('main');
    expect(idle(r.state)).toBe(true);
    // G-BT11-080 Tengai got its end-of-turn ability (once per dominated attack)
    const tengai = unitAt(r.state, 0, 'back_right');
    expect(r.state.grants.filter((g) => g.target === tengai).length).toBeGreaterThanOrEqual(1);
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('G-BT11-008 Mujinlord: your own chosen rear-guards only get +4000', () => {
    const s0 = scene(
      [NB([MUJIN]), KG],
      { circles: { vanguard: MORISHIGE, front_left: TENGAI }, hand: [MORISHIGE], damage: [GARAN] },
      { circles: { vanguard: BLADEMASTER, front_left: DOHA } },
      { at: 'ride', faceUpG: 1, ctx },
    );
    const st = strideToMain(s0, MUJIN).state;
    const mine = unitAt(st, 0, 'front_left');
    const source = unitAt(st, 0, 'vanguard');
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === source)!;
    let r = gApply(st, { type: 'ACTIVATE', player: 0, source, abilityId: o.abilityId });
    r = answerUntil(r, mine, mine);
    r = settle(r);
    expect(declared(r)).toHaveLength(0);
    expect(r.state.cards[mine]!.dominatedBy).toBeUndefined();
    expect(idle(r.state)).toBe(true);
  });

  it('G-BT11-017 Maguntenbu: the dominated unit attacks another of its player’s units, then is retired', () => {
    const s0 = scene(
      [NB([MAGUN]), KG],
      { circles: { vanguard: MORISHIGE }, hand: [MORISHIGE], damage: [GARAN] },
      { circles: { vanguard: BLADEMASTER, front_left: DOHA, back_left: GARAN } },
      { at: 'ride', faceUpG: 1, ctx },
    );
    const doha = unitAt(s0, 1, 'front_left');
    const garan = unitAt(s0, 1, 'back_left');
    const st = strideToMain(s0, MAGUN).state;
    const source = unitAt(st, 0, 'vanguard');
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === source)!;
    let r = gApply(st, { type: 'ACTIVATE', player: 0, source, abilityId: o.abilityId });
    r = answerUntil(r, doha, doha);
    // "attack your opponent's other unit": the vanguard or the back-row rear-guard
    r = settle(r, { stopWhen: pick(garan) });
    expect(r.state.pendingChoice!.options).not.toContain(doha);
    r = settle(answer(r, garan));
    expect(declared(r)).toEqual([expect.objectContaining({ attacker: doha, target: garan })]);
    // both go to their owner's drop zone: Garan hit, Doha retired at the end of that battle
    expect(r.state.players[1].drop).toEqual(expect.arrayContaining([doha, garan]));
    expect(r.state.players[0].drop).not.toContain(doha);
    expect(idle(r.state)).toBe(true);
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('G-BT11-077 Kassen Myouou: front-row rear-guards are dominated at the start of the battle phase and attack the back row; then the battle phase goes on', () => {
    const s0 = scene(
      [NB([MUJIN]), KG],
      { circles: { vanguard: KASSEN, front_left: UZUITACHI } },
      { circles: { vanguard: BLADEMASTER, front_left: DOHA, back_left: GARAN } },
      { at: 'main', faceUpG: 1, ctx },
    );
    const doha = unitAt(s0, 1, 'front_left');
    const garan = unitAt(s0, 1, 'back_left');
    const handBefore = s0.players[1].hand.length;
    let r = gApply(s0, { type: 'END_PHASE', player: 0 });
    r = settle(r);
    expect(declared(r)).toEqual([expect.objectContaining({ attacker: doha, target: garan })]);
    expect(r.state.players[1].drop).toContain(garan);
    // G-BT11-078 Uzuitachi: retired for its cost, the opponent discarded a card
    expect(r.state.players[0].circles.front_left).toHaveLength(0);
    expect(r.state.players[1].hand.length).toBe(handBefore - 1);
    // the dominated attack did not start a new start step of its own: the turn's start step is next
    expect(r.state.phase).toBe('battle');
    expect(r.state.battle).toBeNull();
    expect(r.state.cards[doha]!.dominatedBy).toBeUndefined();
    expect(gLegal(r.state, 0, 'ATTACK')).toBeTruthy();
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('G-BT11-018 Gehourakan: a grade 1 back-row rear-guard of the attacker becomes the defender’s guardian, then goes to its owner’s drop zone', () => {
    // player 0 (Kagero) attacks; player 1 (Nubatama) calls Gehourakan as a G guardian
    const s0 = scene(
      [KG, NB([GEHOU])],
      { circles: { vanguard: BLADEMASTER, back_left: GARAN } },
      { circles: { vanguard: MORISHIGE }, hand: [HEAL], damage: [GARAN, GARAN] },
      { faceUpG: 0, ctx },
    );
    const s1 = fill(s0, 'soul', 1, undefined, 1);
    const garan = unitAt(s1, 0, 'back_left');
    let r = settle(
      gApply(s1, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(s1, 0, 'vanguard'),
        target: unitAt(s1, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: atGuard },
    );
    const g = gLegal(r.state, 1, 'G_GUARD');
    expect(g).toBeTruthy();
    const cardId = g!.cardIds.find((id) => def(r.state, id) === GEHOU)!;
    const discard = g!.costCards.find((id) => def(r.state, id) === HEAL)!;
    r = settle(andThen(r, { type: 'G_GUARD', player: 1, cardId, discard }));
    expect(r.events.some((e) => e.type === 'DOMINATED' && e.instanceIds.includes(garan))).toBe(
      true,
    );
    expect(
      r.events.some(
        (e) =>
          e.type === 'CARD_MOVED' &&
          e.instanceId === garan &&
          e.to.zone === 'guardian' &&
          e.to.player === 1,
      ),
    ).toBe(true);
    // Garan's shield guards the vanguard: 11000 + Gehourakan + Garan
    const resolved = r.events.find((e) => e.type === 'ATTACK_RESOLVED');
    expect(resolved).toEqual(expect.objectContaining({ hit: false }));
    // retired with the other guardians, into its owner's drop zone
    expect(r.state.players[0].drop).toContain(garan);
    expect(r.state.players[1].drop).not.toContain(garan);
    expect(r.state.cards[garan]!.dominatedBy).toBeUndefined();
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('G-BT11-020 Utsuroi returns from the drop zone when a dominated unit’s attack hits a vanguard', () => {
    const s0 = scene(
      [NB([MUJIN]), KG],
      { circles: { vanguard: MORISHIGE }, hand: [MORISHIGE], damage: [GARAN] },
      { circles: { vanguard: BLADEMASTER, front_left: DOHA } },
      { at: 'ride', faceUpG: 1, also: [UTSUROI], ctx },
    );
    const s1 = fill(s0, 'drop', 2, UTSUROI);
    const [first, second] = s1.players[0].drop;
    const doha = unitAt(s1, 1, 'front_left');
    const st = strideToMain(s1, MUJIN).state;
    const source = unitAt(st, 0, 'vanguard');
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === source)!;
    let r = gApply(st, { type: 'ACTIVATE', player: 0, source, abilityId: o.abilityId });
    r = answerUntil(r, doha, doha);
    r = settle(r);
    expect(r.events.filter((e) => e.type === 'ATTACK_HIT')).toHaveLength(1);
    const hand = r.state.players[0].hand;
    expect([first, second].filter((id) => hand.includes(id!))).toHaveLength(1);
    expect([first, second].filter((id) => r.state.players[0].deck.at(-1) === id)).toHaveLength(1);
  });
});

describe('Nubatama Dominate decks played out by the basic AI', () => {
  it('plays to the end, and dominates in at least one game', () => {
    const deck = NB([MUJIN, MAGUN, GEHOU])([KASSEN, UZUITACHI, TENGAI, UTSUROI]);
    let dominated = 0;
    for (const seed of [3, 11, 29]) {
      const { finalState, truncated, events } = runMatch({ seed, decks: [deck, deck] }, ctx, [
        new BasicController(ctx),
        new BasicController(ctx),
      ]);
      expect(truncated).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
      expect(Object.values(finalState.cards).some((c) => c.dominatedBy !== undefined)).toBe(false);
      dominated += events.filter((e) => e.type === 'DOMINATED').length;
    }
    expect(dominated).toBeGreaterThan(0);
  });

  it('the Hard AI plays a Dominate mirror to the end', () => {
    const deck = NB([MUJIN, MAGUN, GEHOU])([KASSEN, UZUITACHI, TENGAI, UTSUROI]);
    const { finalState, truncated } = runMatch({ seed: 7, decks: [deck, deck] }, ctx, [
      new SmartController(ctx, deck),
      new SmartController(ctx, deck),
    ]);
    expect(truncated).toBe(false);
    expect(checkZoneInvariant(finalState)).toEqual([]);
  }, 120_000);
});

const RP = (g: string[]): Maker => maker('Royal Paladin', g, ctx);
const LLEW = 'G-BT11-026'; // grade 3 with "Blaster" in its name
const BLASTER_BLADE = 'TD01-005';

describe('G-BT11 Royal Paladin', () => {
  it('G-BT11-026 Llew: placed with a "Blaster Blade" in the drop zone, puts it on the bottom of the deck for +5000; on (RC) it can intercept', () => {
    const s0 = scene(
      [RP([]), KG],
      { circles: { vanguard: LLEW }, hand: [LLEW] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'main', also: [BLASTER_BLADE], ctx },
    );
    const s1 = fill(s0, 'drop', 1, BLASTER_BLADE);
    const blade = s1.players[0].drop[0]!;
    const r = callFrom(s1, LLEW, 'front_left');
    const llew = unitAt(r.state, 0, 'front_left');
    expect(r.state.players[0].deck.at(-1)).toBe(blade);
    expect(
      r.events.some(
        (e) =>
          e.type === 'MODIFIER_ADDED' && e.modifier.target === llew && e.modifier.amount === 5000,
      ),
    ).toBe(true);
    expect(interceptors(r.state, ctx, 0)).toContain(llew);
  });

  it('G-BT11-001 Gancelot Peace Saver: with a "Blaster" heart, attacking gives [Counter-Charge 1], drive +1 and [Critical] +1', () => {
    const s0 = scene(
      [RP(['G-BT11-001']), KG],
      { circles: { vanguard: LLEW }, hand: [LLEW], damage: [GARAN] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', faceUpG: 1, ctx },
    );
    const st = structuredClone(stride(s0, 'G-BT11-001').state);
    for (const id of st.players[0].damage) st.cards[id]!.faceUp = false;
    let r = andThen(
      { state: st, events: [] },
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
    );
    const vg = unitAt(r.state, 0, 'vanguard');
    r = settle(
      gApply(r.state, {
        type: 'ATTACK',
        player: 0,
        attacker: vg,
        target: unitAt(r.state, 1, 'vanguard'),
        booster: null,
      }),
    );
    const icon = ctx.registry.get('G-BT11-001').skillIcon;
    const base = icon === 'triple_drive' ? 3 : icon === 'twin_drive' ? 2 : 1;
    const drives = r.events.filter(
      (e) => e.type === 'CHECK_REVEALED' && e.check === 'drive',
    ).length;
    expect(drives).toBe(base + 1);
    expect(r.events.some((e) => e.type === 'CARD_TURNED' && e.faceUp === true)).toBe(true);
    expect(
      r.events.some(
        (e) =>
          e.type === 'MODIFIER_ADDED' &&
          e.modifier.target === vg &&
          e.modifier.stat === 'critical' &&
          e.modifier.until === 'end_of_battle',
      ),
    ).toBe(true);
  });

  it('G-BT11-012 Lien guards only a grade 3 "Alfred" or "Blaster" unit', () => {
    const guarded = (vanguard: string) => {
      const s0 = scene(
        [KG, RP([])],
        { circles: { vanguard: BLADEMASTER } },
        { circles: { vanguard }, hand: ['G-BT11-012'] },
        { ctx },
      );
      const s1 = fill(s0, 'soul', 1, undefined, 1);
      let r = settle(
        gApply(s1, {
          type: 'ATTACK',
          player: 0,
          attacker: unitAt(s1, 0, 'vanguard'),
          target: unitAt(s1, 1, 'vanguard'),
          booster: null,
        }),
        { stopWhen: atGuard },
      );
      const lien = r.state.players[1].hand.find((id) => def(r.state, id) === 'G-BT11-012')!;
      r = settle(andThen(r, { type: 'GUARD', player: 1, cardId: lien }));
      return r.events.some((e) => e.type === 'ATTACK_RESOLVED' && !e.hit);
    };
    expect(guarded(LLEW)).toBe(true);
    expect(guarded('G-BT06-011')).toBe(false); // Model Knight, Orhan: grade 3, 11000
  });
});

const SEERSUCKER = 'G-BT11-063';
const ATAR = 'G-BT11-035';
const BIRDSEYE = 'G-BT11-070'; // "Seal Dragon" in its name
const JAUGO = 'G-BT11-064';
const KIKIRA = 'G-BT11-073'; // Kagero heal trigger

describe('G-BT11 Kagero', () => {
  it('G-BT11-063 Seersucker retires a rear-guard, the opponent calls a grade 2 from the deck, and Atar returns from the drop zone', () => {
    const s0 = scene(
      [maker('Kagero', ['G-BT01-005'], ctx), KG],
      { circles: { vanguard: BLADEMASTER }, hand: [SEERSUCKER], damage: [BIRDSEYE] },
      { circles: { vanguard: BLADEMASTER, front_left: GARAN } },
      { at: 'main', also: [ATAR], ctx },
    );
    // two Atar in the drop zone: one pays for the other ("one of your other sentinels")
    const s1 = fill(s0, 'drop', 2, ATAR);
    const atars = [...s1.players[0].drop];
    const garan = unitAt(s1, 1, 'front_left');
    const handBefore = s1.players[0].hand.length;
    const r = callFrom(s1, SEERSUCKER, 'front_right');
    expect(r.state.players[1].drop).toContain(garan);
    const called = r.events.find(
      (e) =>
        e.type === 'CARD_MOVED' &&
        e.from.zone === 'deck' &&
        e.from.player === 1 &&
        e.to.zone === 'circle',
    ) as { instanceId: string } | undefined;
    expect(called).toBeTruthy();
    expect(ctx.registry.get(def(r.state, called!.instanceId)).grade).toBe(2);
    // you drew a card and one Atar came back: hand = before − Seersucker + draw + Atar
    expect(atars.filter((id) => r.state.players[0].hand.includes(id))).toHaveLength(1);
    expect(r.state.players[0].hand.length).toBe(handBefore - 1 + 1 + 1);
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('G-BT11-032 Granitcross: retires the grade 2 rear-guards; with no grade 2 in the opponent’s hand, you draw', () => {
    const s0 = scene(
      [maker('Kagero', ['G-BT11-032'], ctx), KG],
      { circles: { vanguard: SEERSUCKER }, hand: [SEERSUCKER], damage: [GARAN] },
      { circles: { vanguard: BLADEMASTER, front_left: DOHA }, hand: [GARAN] },
      { at: 'ride', ctx },
    );
    const s1 = fill(s0, 'soul', 1);
    const doha = unitAt(s1, 1, 'front_left');
    const st = andThen(stride(s1, 'G-BT11-032'), { type: 'END_PHASE', player: 0 }).state;
    expect(interceptors(st, ctx, 1)).toEqual([]);
    const source = unitAt(st, 0, 'vanguard');
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === source)!;
    const handBefore = st.players[0].hand.length;
    const r = settle(gApply(st, { type: 'ACTIVATE', player: 0, source, abilityId: o.abilityId }));
    expect(r.state.players[1].drop).toContain(doha);
    expect(r.state.players[0].hand.length).toBe(handBefore + 1);
  });

  it('G-BT11-033 Abd Salam gets [Shield] +10000 for each of the attacker’s open (RC)', () => {
    const s0 = scene(
      [KG, maker('Kagero', ['G-BT11-033'], ctx)],
      { circles: { vanguard: BLADEMASTER, front_left: DOHA } },
      { circles: { vanguard: BLADEMASTER }, hand: [KIKIRA], damage: [GARAN, GARAN] },
      { ctx },
    );
    let r = settle(
      gApply(s0, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(s0, 0, 'vanguard'),
        target: unitAt(s0, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: atGuard },
    );
    const g = gLegal(r.state, 1, 'G_GUARD')!;
    const cardId = g.cardIds.find((id) => def(r.state, id) === 'G-BT11-033')!;
    const discard = g.costCards.find((id) => def(r.state, id) === KIKIRA)!;
    r = settle(andThen(r, { type: 'G_GUARD', player: 1, cardId, discard }));
    const resolved = r.events.find((e) => e.type === 'ATTACK_RESOLVED') as { defensePower: number };
    // vanguard 11000 + G guardian's printed shield + 4 open (RC) × 10000
    const printed = ctx.registry.get('G-BT11-033').shield ?? 0;
    expect(resolved.defensePower).toBe(11000 + printed + 40000);
  });

  it('G-BT11-064 Jaugo: +2000 for each of the opponent’s open back-row (RC) while blazing', () => {
    const s0 = scene(
      [maker('Kagero', ['G-BT01-005'], ctx), KG],
      { circles: { vanguard: JAUGO } },
      { circles: { vanguard: BLADEMASTER, back_left: GARAN } },
      { faceUpG: 1, ctx },
    );
    const jaugo = unitAt(s0, 0, 'vanguard');
    expect(currentPower(s0, ctx, jaugo)).toBe(11000);
    const t = structuredClone(s0);
    t.players[0].blazing = true;
    expect(currentPower(t, ctx, jaugo)).toBe(11000 + 2 * 2000);
  });
});

describe('G-BT11 Nubatama', () => {
  it('G-BT11-036 Kurehalord: the opponent binds a card from hand face down and gets it back at the end of the turn', () => {
    const s0 = scene(
      [NB(['G-BT11-036']), KG],
      { circles: { vanguard: MORISHIGE }, hand: [MORISHIGE] },
      { circles: { vanguard: BLADEMASTER }, hand: [GARAN, DOHA] },
      { at: 'ride', ctx },
    );
    const st = andThen(
      stride(s0, 'G-BT11-036'),
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
    ).state;
    let r = settle(
      gApply(st, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(st, 0, 'vanguard'),
        target: unitAt(st, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: (x) => x.players[1].bind.length > 0 && x.battle?.step === 'guard' },
    );
    const bound_ = r.state.players[1].bind;
    expect(bound_).toHaveLength(1);
    expect(r.state.cards[bound_[0]!]!.faceUp).toBe(false);
    r = settle(r, { stopWhen: (x) => x.activePlayer === 1 });
    expect(r.state.players[1].hand).toContain(bound_[0]);
  });

  it('G-BT11-076 Morishige: rest another rear-guard; the opponent’s chosen rear-guard gets +3000 and Morishige +10000', () => {
    const s0 = scene(
      [NB([MUJIN]), KG],
      { circles: { vanguard: MORISHIGE, back_center: TENGAI } },
      { circles: { vanguard: BLADEMASTER, front_left: DOHA } },
      { at: 'main', faceUpG: 1, ctx },
    );
    const mori = unitAt(s0, 0, 'vanguard');
    const doha = unitAt(s0, 1, 'front_left');
    const o = gLegal(s0, 0, 'ACTIVATE')!.options.find((x) => x.source === mori)!;
    const r = settle(
      gApply(s0, { type: 'ACTIVATE', player: 0, source: mori, abilityId: o.abilityId }),
    );
    expect(r.state.cards[unitAt(s0, 0, 'back_center')]!.orientation).toBe('rest');
    expect(currentPower(r.state, ctx, doha)).toBe(13000);
    expect(currentPower(r.state, ctx, mori)).toBe(21000);
  });

  it('G-BT11-083 Daruma Collapse: a unit stood by Dominate powers up its column and draws', () => {
    const s0 = scene(
      [NB([MUJIN]), KG],
      {
        circles: { vanguard: MORISHIGE, front_right: 'G-BT11-083' },
        hand: [MORISHIGE],
        damage: [GARAN],
      },
      { circles: { vanguard: BLADEMASTER, front_left: DOHA }, rested: ['front_left'] },
      { at: 'ride', faceUpG: 1, ctx },
    );
    const doha = unitAt(s0, 1, 'front_left');
    const st = strideToMain(s0, MUJIN).state;
    const source = unitAt(st, 0, 'vanguard');
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === source)!;
    const handBefore = st.players[0].hand.length;
    let r = gApply(st, { type: 'ACTIVATE', player: 0, source, abilityId: o.abilityId });
    r = answerUntil(r, doha, doha);
    // Daruma Collapse (front right) faces the opponent's front left: same column as Doha
    r = settle(r, { most: true });
    expect(r.state.players[0].circles.front_right).toHaveLength(0);
    expect(r.state.players[0].hand.length).toBe(handBefore + 1);
    expect(
      r.events.some(
        (e) =>
          e.type === 'MODIFIER_ADDED' && e.modifier.target === doha && e.modifier.amount === 2000,
      ),
    ).toBe(true);
  });
});

const DI = (g: string[]): Maker => maker('Dark Irregulars', g, ctx);
const SCHARHROT = 'G-BT11-010';
const CYCLONE = 'G-BT11-087';
const AGARES = 'G-BT11-040'; // "Amon" in its name
const WERKATZE = 'G-BT11-093';

describe('G-BT11 Dark Irregulars', () => {
  it('G-BT11-087 Hateful Cyclone soul-charges an "Amon" card: -2000, then +5000 per five soul; Scharhrot’s Darkness attack then gets +5000', () => {
    const s0 = scene(
      [DI(['G-BT01-005']), KG],
      { circles: { vanguard: SCHARHROT }, hand: [CYCLONE], deckTop: [AGARES] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'main', faceUpG: 2, ctx },
    );
    const s1 = fill(s0, 'soul', 9 - s0.players[0].soul.length);
    let r = callFrom(s1, CYCLONE, 'front_left');
    const cyclone = unitAt(r.state, 0, 'front_left');
    expect(r.state.players[0].soul).toHaveLength(10);
    expect(currentPower(r.state, ctx, cyclone)).toBe(7000 - 2000 + 10000);
    // Darkness is active (a card went into the soul this turn), soul 10: +5000 when attacking
    r = andThen(r, { type: 'END_PHASE', player: 0 });
    const vg = unitAt(r.state, 0, 'vanguard');
    r = settle(
      gApply(r.state, {
        type: 'ATTACK',
        player: 0,
        attacker: vg,
        target: unitAt(r.state, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: atGuard },
    );
    expect(currentPower(r.state, ctx, vg)).toBe(11000 + 5000);
  });

  it('G-BT11-093 Werkatze Rekrut goes into the soul from (GC) when the attack did not hit', () => {
    const s0 = scene(
      [KG, DI(['G-BT01-005'])],
      { circles: { vanguard: BLADEMASTER } },
      { circles: { vanguard: SCHARHROT }, hand: [WERKATZE] },
      { ctx },
    );
    let r = settle(
      gApply(s0, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(s0, 0, 'vanguard'),
        target: unitAt(s0, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: atGuard },
    );
    const w = r.state.players[1].hand.find((id) => def(r.state, id) === WERKATZE)!;
    r = andThen(r, { type: 'GUARD', player: 1, cardId: w });
    r = settle(r, { stopWhen: (x) => x.battle === null });
    // 11000 against 11000 + 10000 shield (seed 3: the drive check gives no second trigger)
    expect(r.events.some((e) => e.type === 'ATTACK_RESOLVED' && !e.hit)).toBe(true);
    expect(r.state.players[1].soul).toContain(w);
  });
});

const GN = (g: string[]): Maker => maker('Genesis', g, ctx);
const AMARUDA = 'G-BT11-005';
const SENRI = 'G-BT11-052';
const DETECT = 'G-BT11-055';
const MARKAB = 'G-BT11-056';
const MULTITASK = 'G-BT11-053';

describe('G-BT11 Genesis', () => {
  it('G-BT11-005 Amaruda: with an empty hand, stride by soul-blasting three revelation cards', () => {
    const s0 = scene(
      [GN(['G-BT11-004']), KG],
      { circles: { vanguard: AMARUDA } },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', also: [SENRI, DETECT, MULTITASK], ctx },
    );
    const s1 = fill(fill(fill(s0, 'soul', 1, SENRI), 'soul', 1, DETECT), 'soul', 1, MULTITASK);
    const st = structuredClone(s1);
    st.players[0].deck.push(...st.players[0].hand.splice(0)); // empty hand: only the soul can pay
    const r0 = gApply(st, { type: 'END_PHASE', player: 0 });
    const a = gLegal(r0.state, 0, 'STRIDE')!;
    expect(a).toBeTruthy();
    expect(a.soulCost?.n).toBe(3);
    const paid = a.soulCost!.cards.slice(0, 3);
    const r = settle(
      gApply(r0.state, { type: 'STRIDE', player: 0, cardId: a.cardIds[0]!, discard: paid }),
      { no: true },
    );
    expect(def(r.state, unitAt(r.state, 0, 'vanguard'))).toBe('G-BT11-004');
    expect(r.state.players[0].drop).toEqual(expect.arrayContaining(paid));
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('Revelation rests another rear-guard: G-BT11-055 Detect Angel gets +4000, G-BT11-052 Senri may put the top card on the bottom for +2000', () => {
    const s0 = scene(
      [GN(['G-BT11-004']), KG],
      { circles: { vanguard: AMARUDA, front_left: DETECT, back_left: MARKAB }, hand: [SENRI] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'main', faceUpG: 1, ctx },
    );
    const detect = unitAt(s0, 0, 'front_left');
    const markab = unitAt(s0, 0, 'back_left');
    let r = callFrom(s0, SENRI, 'front_right', { stopWhen: pick(markab) });
    r = settle(answer(r, markab));
    const senri = unitAt(r.state, 0, 'front_right');
    expect(r.state.cards[markab]!.orientation).toBe('rest');
    expect(currentPower(r.state, ctx, detect)).toBe(7000 + 4000);
    expect(currentPower(r.state, ctx, senri)).toBe(9000 + 2000);
  });
});

describe('G-BT11 coverage', () => {
  it('every card with ability text is scripted', () => {
    const missing = ctx.registry
      .all()
      .filter(
        (d) =>
          d.id.startsWith('G-BT11-') &&
          d.text.trim() !== '' &&
          !/^\(You may only have up to four/.test(d.text.trim()),
      )
      .filter((d) => d.abilities.length === 0)
      .map((d) => d.id);
    expect(missing).toEqual([]);
  });
});

const GC = (g: string[]): Maker => maker('Gear Chronicle', g, ctx);

describe('G-BT11 Gear Chronicle and Connell', () => {
  it('G-BT11-096 Rewind Tiger binds a <Zodiac Time Beast> from the top: draw and +2000 (cards with two races match either)', () => {
    const s0 = scene(
      [GC(['G-BT01-005']), KG],
      {
        circles: { vanguard: 'G-BT11-023', back_left: 'G-BT11-046' },
        hand: ['G-BT11-096'],
        deckTop: ['G-BT11-100'],
        damage: [GARAN],
      },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'main', ctx },
    );
    const handBefore = s0.players[0].hand.length;
    const r = callFrom(s0, 'G-BT11-096', 'front_left');
    const tiger = unitAt(r.state, 0, 'front_left');
    expect(r.state.players[0].bind.map((id) => def(r.state, id))).toEqual(['G-BT11-100']);
    expect(r.state.cards[unitAt(s0, 0, 'back_left')]!.orientation).toBe('rest');
    expect(currentPower(r.state, ctx, tiger)).toBe(8000 + 2000);
    expect(r.state.players[0].hand.length).toBe(handBefore - 1 + 1);
  });

  it('G-BT11-104 Connell must be chosen when the opponent’s effect chooses its player’s rear-guard', () => {
    const s0 = scene(
      [maker('Kagero', ['G-BT01-005'], ctx), KG],
      { circles: { vanguard: BLADEMASTER }, hand: ['G-BT11-068'], damage: [GARAN] },
      {
        circles: {
          vanguard: BLADEMASTER,
          front_left: DOHA,
          front_right: 'G-BT11-104',
          back_left: GARAN,
        },
      },
      { at: 'main', faceUpG: 1, ctx },
    );
    const t = structuredClone(s0);
    t.cards[t.players[1].gzone[0]!]!.faceUp = true; // the defender's Generation Break 1
    const connell = unitAt(t, 1, 'front_right');
    const r = callFrom(t, 'G-BT11-068', 'front_left');
    expect(r.state.players[1].drop).toContain(connell);
    expect(r.state.players[1].circles.front_left).toHaveLength(1);
    expect(r.state.players[1].circles.back_left).toHaveLength(1);
  });
});

describe('G-BT11 decks of every clan, played out by the basic AI', () => {
  it.each([
    [
      'Royal Paladin',
      RP(['G-BT11-001', 'G-BT11-003', 'G-BT11-025']),
      [LLEW, 'G-BT11-049', 'G-BT11-050', 'G-BT11-012'],
    ],
    [
      'Kagero',
      maker('Kagero', ['G-BT11-006', 'G-BT11-032', 'G-BT11-033'], ctx),
      ['G-BT11-007', SEERSUCKER, JAUGO, 'G-BT11-065', ATAR],
    ],
    [
      'Genesis',
      GN(['G-BT11-004', 'G-BT11-013', 'G-BT11-027']),
      [AMARUDA, 'G-BT11-028', 'G-BT11-030', SENRI, DETECT],
    ],
    [
      'Dark Irregulars',
      DI(['G-BT11-009', 'G-BT11-021', 'G-BT11-038', 'G-BT11-039']),
      [SCHARHROT, AGARES, CYCLONE, 'G-BT11-043', WERKATZE],
    ],
    [
      'Gear Chronicle',
      GC(['G-BT11-002', 'G-BT11-011']),
      ['G-BT11-023', 'G-BT11-094', 'G-BT11-096', 'G-BT11-047', 'G-BT11-048'],
    ],
  ] as const)('%s', (_, make, include) => {
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
