/** EB02 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentShield, type GameState } from '../../src/engine';
import { andThen as then, apply, ctx, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand } from '../fixtures/cardTest';
import { onField, pull, settle } from '../fixtures/setHelpers';
import {
  attackPumps,
  callIt,
  fillSoul,
  OPP,
  OPP_G1,
  OPP_G3,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const BT_G2 = 'EB02-012'; // Mermaid Idol, Flute (8000; its own CONT needs four rear-guards)
const BT_G1 = 'EB02-023'; // Mermaid Idol, Felucca
const BT_G3 = 'EB02-008'; // Super Idol, Ceram

/** Rear-guards for the "four or more Bermuda Triangle rear-guards" checks. */
const fourBermuda = (s: GameState) => {
  for (const c of ['front_left', 'front_right', 'back_left', 'back_right'] as const) {
    const id = s.players[0].deck.find((x) => s.cards[x]!.definitionId === BT_G1)!;
    s.players[0].deck.splice(s.players[0].deck.indexOf(id), 1);
    s.cards[id]!.faceUp = true;
    s.players[0].circles[c].push(id);
  }
};
const inSoul = (s: GameState, def: string) => {
  const [id] = pull(s, def, 'drop');
  s.players[0].drop.splice(s.players[0].drop.indexOf(id!), 1);
  s.players[0].soul.push(id!);
  return id!;
};

describe('EB02 Bermuda Triangle grade 3s', () => {
  it.each(['EB02-001', 'EB02-003'])(
    '%s: +3000 during your turn with four Bermuda Triangle rear-guards',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: card } },
        defender: { circles: { vanguard: OPP } },
        extra: [[BT_G1, BT_G1, BT_G1, BT_G1], []],
      });
      const vg = unitAt(s, 0, 'vanguard');
      const base = pw(s, vg);
      fourBermuda(s);
      expect(pw(s, vg)).toBe(base + 3000);
    },
  );

  it('EB02-001 Pacifica: main phase Soul-Charge 1, draw, a card to the bottom; [SB8 & CB5] its hit calls three Bermuda Triangles', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB02-001' } },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = s.players[0].soul.length;
    const hand = s.players[0].hand.length;
    const r = drain(apply(s, { type: 'END_PHASE', player: 0 }));
    expect(r.state.players[0].soul.length).toBe(soul + 1);
    expect(r.state.players[0].hand.length).toBe(hand);
    const hit = scene({
      attacker: { circles: { vanguard: 'EB02-001' }, damage: vanilla(5) },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [[BT_G1, BT_G2], []],
    });
    fillSoul(hit, 0, 8);
    const vg = unitAt(hit, 0, 'vanguard');
    const bermuda = hit.players[0].deck.filter(
      (x) => ctx.registry.get(hit.cards[x]!.definitionId).clan === 'Bermuda Triangle',
    );
    const rr = settle(apply(hit, attack(vg, unitAt(hit, 1, 'vanguard'))), bermuda);
    expect(onField(rr.state, 0)).toHaveLength(4);
  });

  it('EB02-002 Top Idol, Riviere: +1000 with Super Idol, Riviere in the soul; [CB2 & discard a copy] its hit gives three rear-guards +5000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'EB02-002', front_left: BT_G1, back_left: BT_G1 },
        hand: ['EB02-002'],
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['EB02-011'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    inSoul(s, 'EB02-011');
    expect(pw(s, vg)).toBe(base + 1000);
    const rgs = [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'back_left')];
    const r = settle(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))), rgs);
    for (const id of rgs) expect(boosts(r, id, 5000)).toBe(1);
  });

  it('EB02-003 Lena: placed on (VC), returns your Bermuda Triangle rear-guards to your hand', () => {
    const { s, r } = rideIt('EB02-003', {
      vanguard: BT_G2,
      others: { front_left: BT_G1, back_left: OPP_G1 },
    });
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'front_left'));
    expect(onField(r.state, 0)).toContain(unitAt(s, 0, 'back_left'));
  });

  it('EB02-008 Ceram: [CB1] +3000 attacking', () => {
    expect(attackPumps('EB02-008', 3000, { damage: 1 })).toBe(1);
  });

  it.each(['EB02-016', 'EB02-018'])(
    '%s: [return a rear-guard] a grade 3 Bermuda Triangle drive check calls one from your hand',
    (card) => {
      const s = scene({
        attacker: {
          circles: { vanguard: card, front_left: BT_G1 },
          hand: [BT_G2],
          // one grade 3 among the drive checks (a second would return the called unit again)
          deckTop: [BT_G3, OPP_G1],
        },
        defender: { circles: { vanguard: OPP_G3 }, hand: [OPP_G1], deckTop: vanilla(2) },
      });
      const flute = inHand(s, 0, BT_G2);
      const r = settle(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), [
        flute,
        unitAt(s, 0, 'front_left'),
      ]);
      expect(onField(r.state, 0)).toContain(flute);
    },
  );
});

describe('EB02 returning to hand', () => {
  it.each(['EB02-006', 'EB02-017'])(
    '%s: [CB1] returned to your hand from (RC): Soul-Charge 1 and draw',
    (card) => {
      // Pearl Sisters, Perla's hit returns it
      const s = scene({
        attacker: { circles: { vanguard: 'EB02-005', front_left: card }, damage: vanilla(1) },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      const unit = unitAt(s, 0, 'front_left');
      fillSoul(s, 0, 1);
      const soul = s.players[0].soul.length;
      const r = settle(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), [
        unit,
      ]);
      expect(r.state.players[0].hand).toContain(unit);
      // Perla paid Soul-Blast 1; the returned card charged one back
      expect(r.state.players[0].soul.length).toBe(soul);
      expect(
        find(r.events, 'CARD_MOVED').filter((e) => e.reason === 'draw').length,
      ).toBeGreaterThanOrEqual(1);
    },
  );

  it('EB02-004 Perle: placed, Perla gets "its hit vanguard: Soul-Charge 1 and draw"', () => {
    const { s, r: call } = callIt('EB02-004', { vanguard: 'EB02-005' });
    const vg = unitAt(s, 0, 'vanguard');
    expect(call.state.grants.some((g) => g.target === vg)).toBe(true);
  });

  it('EB02-013 Tyrrhenia: [SB2] its boosted hit returns another rear-guard to your hand', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: BT_G2, front_left: BT_G2, back_left: 'EB02-013', front_right: BT_G1 },
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    fillSoul(s, 0, 2);
    const r = settle(
      apply(
        s,
        attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
      ),
      [unitAt(s, 0, 'front_right')],
    );
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'front_right'));
  });

  it('EB02-014 Weddell: forerunner; [soul] returns a Bermuda Triangle rear-guard to your hand', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: BT_G2, back_left: 'EB02-014', front_left: BT_G1 } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'), '2')));
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'front_left'));
    expect(r.state.players[0].soul).toContain(unitAt(s, 0, 'back_left'));
  });
});

describe('EB02 Riviere chain and others', () => {
  it('EB02-015 Cadet Riviere: ridden by Mermaid Idol, Riviere, takes a Top/Super Idol Riviere from the top seven', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB02-015' }, hand: ['EB02-024'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB02-011'], []],
    });
    const [superIdol] = pull(s, 'EB02-011', 'top');
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'EB02-024') }), 0, [
      superIdol!,
    ]);
    expect(r.state.players[0].hand).toContain(superIdol);
  });

  it('EB02-024 Mermaid Idol, Riviere: +1000 with Cadet Riviere in the soul; ridden by Super Idol, Riviere with it in the soul, draws', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB02-024' }, hand: ['EB02-011'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB02-015'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    inSoul(s, 'EB02-015');
    expect(pw(s, vg)).toBe(base + 1000);
    const hand = s.players[0].hand.length;
    const rr = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'EB02-011') }));
    expect(rr.state.players[0].hand.length).toBe(hand); // -1 ridden, +1 drawn
  });

  it('EB02-011 Super Idol, Riviere: ridden by Top Idol, Riviere with Mermaid Idol, Riviere in the soul, draws', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB02-011' }, hand: ['EB02-002'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB02-024'], []],
    });
    inSoul(s, 'EB02-024');
    const hand = s.players[0].hand.length;
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'EB02-002') }));
    expect(r.state.players[0].hand.length).toBe(hand);
  });

  it('EB02-005 Perla: [SB1] its hit returns another Bermuda Triangle rear-guard (see EB02-006)', () => {
    expect(ctx.registry.get('EB02-005').abilities).toHaveLength(1);
  });

  it('EB02-007 Elly: [discard a Bermuda Triangle] a Bermuda Triangle being attacked cannot be hit', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: BT_G2 }, hand: ['EB02-007', BT_G1], deckTop: vanilla(2) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'EB02-007') }), 1);
    r = settle(r);
    expect(r.state.players[1].damage).toHaveLength(0);
  });

  it('EB02-012 Flute: +3000 during your turn with four Bermuda Triangle rear-guards', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: BT_G3,
          front_left: BT_G2,
          front_right: BT_G1,
          back_left: BT_G1,
          back_right: BT_G1,
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(11000);
  });

  it('EB02-019 Claire: placed, another Bermuda Triangle gets +2000', () => {
    const { s, r } = callIt('EB02-019', { vanguard: BT_G2 });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 2000)).toBe(1);
  });

  it('EB02-020 Izumi: +5000 shield intercepting with a Bermuda Triangle vanguard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: BT_G2, front_left: 'EB02-020' }, hand: [OPP_G1] },
    });
    const unit = unitAt(s, 1, 'front_left');
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'INTERCEPT', player: 1, unitId: unit }), 1);
    expect(currentShield(r.state, ctx, unit)).toBe(10000);
  });

  it('EB02-022 Myrtoa: placed with a Bermuda Triangle vanguard, each player may draw', () => {
    const { s, r } = callIt('EB02-022', { vanguard: BT_G2 });
    expect(r.state.players[0].hand.length).toBe(s.players[0].hand.length);
    let rr = r;
    if (rr.state.pendingChoice?.player === 1) rr = drain(rr, 1);
    expect(rr.state.players[1].hand.length).toBe(s.players[1].hand.length + 1);
  });

  it('EB02-023 Felucca: placed with a Bermuda Triangle vanguard, Soul-Charge 1', () => {
    const { s, r } = callIt('EB02-023', { vanguard: BT_G2 });
    expect(r.state.players[0].soul.length).toBe(s.players[0].soul.length + 1);
  });

  it('EB02-025 Amur: [discard] its boosted hit draws', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: BT_G2, front_left: BT_G2, back_left: 'EB02-025' },
        hand: [OPP_G1],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = settle(
      apply(
        s,
        attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
      ),
    );
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it('EB02-030–033 Drive Quartet: each gets +3000 with its partner on (RC)', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: BT_G2,
          front_left: 'EB02-030',
          front_right: 'EB02-031',
          back_left: 'EB02-032',
          back_right: 'EB02-033',
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    for (const c of ['front_left', 'front_right', 'back_left', 'back_right'] as const)
      expect(pw(s, unitAt(s, 0, c))).toBe(7000);
    const alone = scene({
      attacker: { circles: { vanguard: BT_G2, front_left: 'EB02-030', front_right: 'EB02-032' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(alone, unitAt(alone, 0, 'front_left'))).toBe(4000);
  });

  it('EB02-034 Shizuku: forerunner; [CB1 & soul] takes a grade 3 Bermuda Triangle from the top five', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: BT_G2, back_left: 'EB02-034' },
        damage: vanilla(1),
        deckTop: [BT_G3],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const hand = s.players[0].hand.length;
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'), '2')));
    expect(r.state.players[0].hand.length).toBe(hand + 1);
  });
});
