/**
 * Level 2 AI (blueprint AI_SPEC): simple priorities, no lookahead. Rides the highest grade,
 * fills empty circles, attacks with everything (rear-guards first, boosting when it can), guards
 * hits on its vanguard once damage matters, answers "may" with yes. It sees only its own view.
 */
import {
  currentPower,
  currentShield,
  HIDDEN,
  other,
  REAR_GUARD_CIRCLES,
  vanguardOf,
  type Command,
  type EngineContext,
  type GameState,
  type InstanceId,
  type LegalAction,
  type PlayerId,
} from '../engine';
import type { PlayerController } from './controller';
import { alreadySafe, payableSentinel } from './guarding';

const FRONT = ['front_left', 'front_right'] as const;

export interface BasicOptions {
  /**
   * Guard like a competent player (the Hard AI's model of its opponent, AI plan stage 4): at 4+
   * damage, or when the hit would be lethal, guard with a margin of 5000 per drive check of a
   * vanguard attack (the attacker may still reveal triggers), using a perfect guard when no plain
   * guard covers a lethal hit.
   */
  readonly competentGuard?: boolean;
}

export class BasicController implements PlayerController {
  constructor(
    private readonly ctx: EngineContext,
    private readonly options: BasicOptions = {},
  ) {}

  private def(s: GameState, id: InstanceId) {
    const d = s.cards[id]!.definitionId;
    return d === HIDDEN ? null : this.ctx.registry.get(d);
  }

  chooseCommand(s: GameState, player: PlayerId, actions: readonly LegalAction[]): Command {
    const find = <T extends LegalAction['type']>(type: T) =>
      actions.find((a): a is Extract<LegalAction, { type: T }> => a.type === type);

    const mulligan = find('MULLIGAN');
    if (mulligan) {
      // return grade 3s when the hand has no grade 1 or 2 to ride up with
      const grades = mulligan.selectable.map((id) => this.def(s, id)?.grade ?? 0);
      const canRide = grades.some((g) => g === 1) && grades.some((g) => g === 2);
      return {
        type: 'MULLIGAN',
        player,
        cardIds: canRide ? [] : mulligan.selectable.filter((_, i) => grades[i] === 3),
      };
    }

    const choose = find('CHOOSE');
    if (choose)
      return {
        type: 'CHOOSE',
        player,
        choiceId: choose.choiceId,
        selection: this.answer(s, player, choose),
      };

    if (find('PASS_GUARD')) return this.guard(s, player, actions);

    const ride = find('RIDE');
    if (ride) {
      const best = [...ride.cardIds].sort(
        (a, b) => (this.def(s, b)?.grade ?? 0) - (this.def(s, a)?.grade ?? 0),
      )[0]!;
      const vg = vanguardOf(s.players[player]);
      if (vg && (this.def(s, best)?.grade ?? 0) > (this.def(s, vg)?.grade ?? 0)) {
        return { type: 'RIDE', player, cardId: best };
      }
    }

    const call = find('CALL');
    if (call && s.players[player].hand.length > 3) {
      const circles = s.players[player].circles;
      const empty = call.circles.filter((c) => circles[c].length === 0);
      const sentinel = (id: InstanceId) => this.def(s, id)?.sentinel ?? false;
      // keep sentinels and trigger units (10000 shield) in hand for guarding
      const keepers = (id: InstanceId) => sentinel(id) || this.def(s, id)?.trigger !== null;
      const pool = call.cardIds.filter((id) => !keepers(id));
      if (empty.length > 0 && pool.length > 0) {
        const front = empty.find((c) => (FRONT as readonly string[]).includes(c));
        const byPower = [...pool].sort(
          (a, b) => (this.def(s, b)?.power ?? 0) - (this.def(s, a)?.power ?? 0),
        );
        const boosters = pool.filter((id) => this.def(s, id)?.skillIcon === 'boost');
        const card = front ? byPower[0]! : (boosters[0] ?? byPower[0]!);
        return { type: 'CALL', player, cardId: card, circle: front ?? empty[0]! };
      }
    }

    const attack = find('ATTACK');
    if (attack) {
      // rear-guards first, so the vanguard's triggers can go where they are needed
      const option = [...attack.options].sort((a, b) =>
        a.attackerCircle === 'vanguard' ? 1 : b.attackerCircle === 'vanguard' ? -1 : 0,
      )[0]!;
      const target = option.targets.find((t) => t.circle === 'vanguard') ?? option.targets[0]!;
      return {
        type: 'ATTACK',
        player,
        attacker: option.attacker,
        target: target.id,
        booster: option.boosters[0]?.id ?? null,
      };
    }

    if (find('END_PHASE')) return { type: 'END_PHASE', player };
    return { type: 'CONCEDE', player };
  }

  /** Guard hits on the vanguard from 3 damage on (always at 5), cheapest cards first. */
  private guard(s: GameState, player: PlayerId, actions: readonly LegalAction[]): Command {
    const b = s.battle!;
    const vg = vanguardOf(s.players[player]);
    const damage = s.players[player].damage.length;
    const attackPower = currentPower(s, this.ctx, b.attacker);
    const defense = currentPower(s, this.ctx, b.target);
    const worthIt =
      b.target === vg &&
      damage >= 3 &&
      attackPower >= defense &&
      !alreadySafe(s, this.ctx, player, b.target);
    if (worthIt && this.options.competentGuard) {
      const competent = this.competentGuard(s, player, actions, attackPower - defense + 1);
      if (competent) return competent;
    }
    if (worthIt) {
      const guard = actions.find(
        (a): a is Extract<LegalAction, { type: 'GUARD' }> => a.type === 'GUARD',
      );
      const intercept = actions.find(
        (a): a is Extract<LegalAction, { type: 'INTERCEPT' }> => a.type === 'INTERCEPT',
      );
      if (intercept) return { type: 'INTERCEPT', player, unitId: intercept.unitIds[0]! };
      if (guard) {
        const sentinel = payableSentinel(s, this.ctx, player, guard.cardIds);
        const needed = attackPower - defense + 1;
        if (sentinel && (damage >= 4 || needed > 15000))
          return { type: 'GUARD', player, cardId: sentinel };
        const plain = guard.cardIds
          .filter((id) => !this.def(s, id)?.sentinel)
          .sort((x, y) => (this.def(s, x)?.shield ?? 0) - (this.def(s, y)?.shield ?? 0));
        const enough = plain.find((id) => currentShield(s, this.ctx, id) >= needed) ?? plain.at(-1);
        if (enough && (damage >= 4 || this.def(s, enough)!.shield >= needed)) {
          return { type: 'GUARD', player, cardId: enough };
        }
      }
    }
    return { type: 'PASS_GUARD', player };
  }

  private answer(
    s: GameState,
    player: PlayerId,
    c: Extract<LegalAction, { type: 'CHOOSE' }>,
  ): string[] {
    const take = (ids: readonly string[]) =>
      ids.slice(0, Math.max(c.min, Math.min(c.max, ids.length)));
    switch (c.kind) {
      case 'yes_no':
        return ['yes'];
      case 'top_or_bottom':
        return ['top'];
      case 'number':
        return [c.options.at(-1)!];
      case 'ability':
        return [c.options[0]!];
      case 'power_recipient':
      case 'critical_recipient': {
        // the unit currently attacking, else our vanguard
        const pick =
          s.battle && s.activePlayer === player ? s.battle.attacker : vanguardOf(s.players[player]);
        return [c.options.includes(pick ?? '') ? pick! : c.options[0]!];
      }
      case 'circle': {
        const empty = REAR_GUARD_CIRCLES.find(
          (x) => c.options.includes(x) && s.players[player].circles[x].length === 0,
        );
        return [empty ?? c.options[0]!];
      }
      case 'select': {
        // opponent's units first for "choose … opponent" effects; otherwise in order
        const theirs = c.options.filter((id) => s.cards[id]?.owner === other(player));
        return take(theirs.length > 0 && theirs.length >= c.min ? theirs : c.options);
      }
      default:
        return take(c.options);
    }
  }

  /**
   * The competent guard (see BasicOptions): the cheapest set of hand cards and interceptors that
   * covers the hit plus a trigger margin, or a perfect guard; null to fall back to the basic rule.
   */
  private competentGuard(
    s: GameState,
    player: PlayerId,
    actions: readonly LegalAction[],
    needed: number,
  ): Command | null {
    const b = s.battle!;
    const damage = s.players[player].damage.length;
    const attackerDef = this.def(s, b.attacker);
    const vanguardAttack = b.attackerCircle === 'vanguard';
    const checks = vanguardAttack ? (attackerDef?.skillIcon === 'twin_drive' ? 2 : 1) : 0;
    const crit = 1;
    const lethal = damage + crit >= 6;
    if (damage < 4 && !lethal) return null;
    const margin = 5000 * checks;
    const guard = actions.find(
      (a): a is Extract<LegalAction, { type: 'GUARD' }> => a.type === 'GUARD',
    );
    const intercept = actions.find(
      (a): a is Extract<LegalAction, { type: 'INTERCEPT' }> => a.type === 'INTERCEPT',
    );
    const pieces = [
      ...(intercept?.unitIds ?? []).map((id) => ({
        command: { type: 'INTERCEPT', player, unitId: id } as Command,
        shield: currentShield(s, this.ctx, id),
      })),
      ...(guard?.cardIds ?? [])
        .filter((id) => !this.def(s, id)?.sentinel)
        .map((id) => ({
          command: { type: 'GUARD', player, cardId: id } as Command,
          shield: currentShield(s, this.ctx, id),
        })),
    ].sort((x, y) => x.shield - y.shield);
    // one card at a time (each guard returns to the guard step): the smallest single piece that
    // covers what is still needed, else the largest piece
    const target = needed + margin;
    const enough = pieces.find((p) => p.shield >= target);
    const total = pieces.reduce((t, p) => t + p.shield, 0);
    const sentinel = payableSentinel(s, this.ctx, player, guard?.cardIds ?? []);
    if (total < target && sentinel && (lethal || damage >= 4))
      return { type: 'GUARD', player, cardId: sentinel };
    if (enough) return enough.command;
    if (pieces.length > 0 && total >= needed) return pieces.at(-1)!.command;
    return sentinel ? { type: 'GUARD', player, cardId: sentinel } : null;
  }
}
