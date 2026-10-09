/**
 * Automatic-ability trigger detection (CR 8.6.2). Called for every event as it is emitted, so
 * the state examined is the state at the moment of the event. Matching abilities become standby
 * entries; they are played at the next check timing (see game/tasks.ts).
 */
import type { Draft } from '../game/context';
import { locate } from '../game/locate';
import type { GameEvent } from '../state/events';
import {
  vanguardOf,
  type InstanceId,
  type Phase,
  type PlayerId,
  type ZoneRef,
} from '../state/types';
import { abilitiesOf, grantAbilityId, holders } from './catalog';
import { activeZoneOf, limitBreakMet, zoneAllows } from './continuous';
import { evaluate, matches, type EvalContext } from './evaluate';
import type { AutoAbility, StepName, Subject, TriggerCondition } from './types';

const PHASE_STEP: Partial<Record<Phase, StepName>> = {
  stand: 'stand_phase',
  draw: 'draw_phase',
  ride: 'ride_phase',
  main: 'main_phase',
  battle: 'battle_phase',
  end: 'end_phase',
};

const BATTLE_STEP: Record<string, StepName> = {
  start: 'start_step',
  attack: 'attack_step',
  guard: 'guard_step',
  drive: 'drive_step',
  damage: 'damage_step',
  close: 'close_step',
};

const isFieldZone = (ref: ZoneRef): boolean => ref.zone === 'circle' || ref.zone === 'guardian';
const fieldZone = (ref: ZoneRef): 'VC' | 'RC' | 'GC' =>
  ref.zone === 'guardian' ? 'GC' : ref.zone === 'circle' && ref.circle === 'vanguard' ? 'VC' : 'RC';

/** Does the card `subject` refers to equal `card`? `subject` is relative to the ability (ec). */
function subjectIs(
  ec: EvalContext,
  subject: Subject,
  card: InstanceId | null,
  cardMaster: PlayerId,
): boolean {
  if (card === null) return false;
  if (subject === 'self') return card === ec.source;
  if (subject.owner === 'you' && cardMaster !== ec.master) return false;
  if (subject.owner === 'opponent' && cardMaster === ec.master) return false;
  return matches(ec, card, subject.filter);
}

interface Match {
  /** The card the event is about (bound as `event_card`). */
  readonly eventCard: InstanceId | null;
  /** For events where the ability's own card left a zone: the zone it left, for zone checks. */
  readonly sourceZone?: ZoneRef;
}

/** The event card left the field; when the ability is its own, check zones where it was. */
const leftField = (who: Subject, e: Extract<GameEvent, { type: 'CARD_MOVED' }>): Match =>
  who === 'self' ? { eventCard: e.instanceId, sourceZone: e.from } : { eventCard: e.instanceId };

/** Does `event` satisfy trigger condition `t` for the ability in `ec`? */
function matchTrigger(ec: EvalContext, t: TriggerCondition, e: GameEvent): Match | null {
  const s = ec.state;
  const masterOf = (id: InstanceId): PlayerId => locate(s, id).player;
  switch (t.on) {
    case 'placed': {
      // CR 10.1.4: placed = moved from a non-circle zone onto a circle.
      if (e.type !== 'CARD_MOVED' || isFieldZone(e.from) || !isFieldZone(e.to)) return null;
      const circle = fieldZone(e.to);
      if (Array.isArray(t.circle) ? !t.circle.includes(circle) : circle !== t.circle) return null;
      if (t.from && e.from.zone !== t.from) return null;
      return subjectIs(ec, t.who, e.instanceId, e.to.player) ? { eventCard: e.instanceId } : null;
    }
    case 'ridden': {
      if (e.type !== 'UNIT_RIDDEN' || e.previous === null) return null;
      if (!subjectIs(ec, t.who, e.previous, e.player)) return null;
      if (t.by && !matches(ec, e.instanceId, t.by)) return null;
      if (t.bySelf && e.instanceId !== ec.source) return null;
      return {
        eventCard: e.instanceId,
        sourceZone: { player: e.player, zone: 'circle', circle: 'vanguard' },
      };
    }
    case 'attacks': {
      if (e.type !== 'ATTACK_DECLARED' || !subjectIs(ec, t.who, e.attacker, e.player)) return null;
      if (t.target) {
        const onVC =
          locate(s, e.target).zone === 'circle' &&
          vanguardOf(s.players[masterOf(e.target)]) === e.target;
        if ((t.target === 'vanguard') !== onVC) return null;
      }
      return { eventCard: e.attacker };
    }
    case 'attacked':
      return e.type === 'ATTACK_DECLARED' && subjectIs(ec, t.who, e.target, masterOf(e.target))
        ? { eventCard: e.target }
        : null;
    case 'boosts': {
      if (e.type !== 'ATTACK_DECLARED' || e.booster === null) return null;
      if (!subjectIs(ec, t.who, e.booster, e.player)) return null;
      if (t.boosted && !matches(ec, e.attacker, t.boosted)) return null;
      return { eventCard: e.attacker };
    }
    case 'attack_hits': {
      if (e.type !== 'ATTACK_HIT' || !subjectIs(ec, t.who, e.attacker, s.activePlayer)) return null;
      if (t.target === 'vanguard' && !e.targetWasVanguard) return null;
      if (t.target === 'rear-guard' && e.targetWasVanguard) return null;
      return { eventCard: e.target };
    }
    case 'retired': {
      // CR 10.1.3.2: moved from the field to the drop zone.
      if (e.type !== 'CARD_MOVED' || !isFieldZone(e.from) || e.to.zone !== 'drop') return null;
      return subjectIs(ec, t.who, e.instanceId, e.from.player) ? leftField(t.who, e) : null;
    }
    case 'check_reveals': {
      if (e.type !== 'CHECK_REVEALED' || e.check !== t.check) return null;
      // the checking unit: the attacking vanguard for a drive check, the vanguard for damage
      const checker =
        t.check === 'drive' ? (s.battle?.attacker ?? null) : vanguardOf(s.players[e.player]);
      if (!subjectIs(ec, t.who, checker, e.player)) return null;
      if (t.card && !matches(ec, e.instanceId, t.card)) return null;
      return { eventCard: e.instanceId };
    }
    case 'boosted': {
      if (e.type !== 'ATTACK_DECLARED' || e.booster === null) return null;
      if (!subjectIs(ec, t.who, e.attacker, e.player)) return null;
      if (t.by && !matches(ec, e.booster, t.by)) return null;
      return { eventCard: e.booster };
    }
    case 'boosted_attack_hits': {
      const booster = s.battle?.booster ?? null;
      if (e.type !== 'ATTACK_HIT' || booster === null) return null;
      if (!subjectIs(ec, t.who, booster, s.activePlayer)) return null;
      if (t.boosted && !matches(ec, e.attacker, t.boosted)) return null;
      if (t.target === 'vanguard' && !e.targetWasVanguard) return null;
      if (t.target === 'rear-guard' && e.targetWasVanguard) return null;
      return { eventCard: e.attacker };
    }
    case 'stands':
      return e.type === 'UNIT_STOOD' && subjectIs(ec, t.who, e.instanceId, e.player)
        ? { eventCard: e.instanceId }
        : null;
    case 'put_into_damage':
      return e.type === 'CARD_MOVED' &&
        e.to.zone === 'damage' &&
        e.from.zone !== 'damage' &&
        subjectIs(ec, t.who, e.instanceId, e.to.player)
        ? { eventCard: e.instanceId }
        : null;
    case 'rests':
      return e.type === 'UNIT_RESTED' && subjectIs(ec, t.who, e.instanceId, e.player)
        ? { eventCard: e.instanceId }
        : null;
    case 'put_into_drop': {
      if (e.type !== 'CARD_MOVED' || e.to.zone !== 'drop') return null;
      const fromOk =
        t.from === 'soul'
          ? e.from.zone === 'soul'
          : isFieldZone(e.from) && fieldZone(e.from) === t.from;
      if (!fromOk) return null;
      if (t.byYourEffect && !(e.reason === 'effect' && e.by === ec.master)) return null;
      if (t.causeFilter && !(e.cause !== undefined && matches(ec, e.cause, t.causeFilter)))
        return null;
      return subjectIs(ec, t.who, e.instanceId, e.from.player) ? leftField(t.who, e) : null;
    }
    case 'put_into_soul':
      return e.type === 'CARD_MOVED' &&
        e.to.zone === 'soul' &&
        e.from.zone !== 'soul' &&
        subjectIs(ec, t.who, e.instanceId, e.to.player)
        ? { eventCard: e.instanceId }
        : null;
    case 'intercepts':
      return e.type === 'INTERCEPTED' && subjectIs(ec, t.who, e.instanceId, e.player)
        ? { eventCard: e.instanceId }
        : null;
    case 'locked':
      if (e.type !== 'CARD_LOCKED' || !subjectIs(ec, t.who, e.instanceId, e.player)) return null;
      if (t.byYourEffect && e.by !== ec.master) return null;
      return { eventCard: e.instanceId };
    case 'unlocked':
      return e.type === 'CARD_UNLOCKED' && subjectIs(ec, t.who, e.instanceId, e.player)
        ? { eventCard: e.instanceId }
        : null;
    case 'drawn':
      return e.type === 'CARD_MOVED' &&
        e.reason === 'draw' &&
        subjectIs(ec, t.who, e.instanceId, e.to.player)
        ? { eventCard: e.instanceId }
        : null;
    case 'legion':
      // CR 10.1.24.13: either unit "legions"
      if (e.type !== 'LEGION') return null;
      if (subjectIs(ec, t.who, e.leader, e.player)) return { eventCard: e.mate };
      return subjectIs(ec, t.who, e.mate, e.player) ? { eventCard: e.leader } : null;
    case 'step_start': {
      let step: StepName | undefined;
      if (e.type === 'PHASE_CHANGED') step = PHASE_STEP[e.phase];
      else if (e.type === 'STEP_STARTED') step = BATTLE_STEP[e.step];
      if (step !== t.step) return null;
      const yours = s.activePlayer === ec.master;
      if ((t.whose === 'you' && !yours) || (t.whose === 'opponent' && yours)) return null;
      return { eventCard: null };
    }
  }
}

/** Event types that can satisfy some trigger condition (fast reject for everything else). */
const TRIGGERING = new Set<GameEvent['type']>([
  'CARD_MOVED',
  'UNIT_RIDDEN',
  'ATTACK_DECLARED',
  'ATTACK_HIT',
  'PHASE_CHANGED',
  'STEP_STARTED',
  'CARD_UNLOCKED',
  'CARD_LOCKED',
  'UNIT_STOOD',
  'UNIT_RESTED',
  'CHECK_REVEALED',
  'INTERCEPTED',
  'LEGION',
]);

export function detectTriggers(d: Draft, event: GameEvent): void {
  const s = d.state;
  if (s.status !== 'playing' || !TRIGGERING.has(event.type)) return;
  for (const id of holders(s, 'AUTO')) {
    const abilities = abilitiesOf(s, d.ctx, id);
    const where = locate(s, id);
    if (where.zone === 'deck') continue;
    const ec: EvalContext = {
      state: s,
      ctx: d.ctx,
      master: where.player,
      source: id,
      bindings: {},
      eventCard: null,
    };
    for (const a of abilities) {
      if (a.kind !== 'AUTO') continue;
      const m = matchTrigger(ec, a.trigger, event);
      if (!m) continue;
      if (!zoneAllows(a.zones, activeZoneOf(m.sourceZone ?? where))) continue;
      if (!isUsable(d, id, a, where.player)) continue;
      if (a.triggerIf && !evaluate({ ...ec, eventCard: m.eventCard }, a.triggerIf)) continue;
      const standby = {
        id: s.nextId++,
        master: where.player,
        source: id,
        abilityId: a.id,
        eventCard: m.eventCard,
        ...(a.id.startsWith('g') && s.grants.some((g) => grantAbilityId(g.id) === a.id)
          ? { granted: a }
          : {}),
      };
      s.standby.push(standby);
      // pushed directly (not emitted) so this bookkeeping event cannot itself trigger anything
      d.events.push({
        type: 'ABILITY_TRIGGERED',
        standbyId: standby.id,
        master: standby.master,
        source: id,
        abilityId: a.id,
      });
    }
  }
}

/** Limit Break (checked when the ability triggers, CR 10.2.5.3.2.1) and once-per-turn use. */
function isUsable(d: Draft, source: InstanceId, a: AutoAbility, master: PlayerId): boolean {
  if (!limitBreakMet(d.state, master, a.limitBreak)) return false;
  return !(a.oncePerTurn && d.state.usedThisTurn.includes(`${source}/${a.id}`));
}
