/**
 * Structural validation of ability definitions, run when cards are loaded. Catches authoring
 * mistakes the type system cannot: duplicate IDs, bindings used before they are made, event-only
 * selectors outside automatic abilities, and impossible numbers.
 */
import type { AbilityDefinition, Condition, Cost, Selector, Step } from './types';

export function validateAbilities(
  cardId: string,
  abilities: readonly AbilityDefinition[],
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const a of abilities) {
    const where = `${cardId}/${a.id}`;
    const report = (msg: string) => problems.push(`${where}: ${msg}`);
    if (seen.has(a.id)) report('duplicate ability id');
    seen.add(a.id);
    if (a.zones.length === 0) report('ability has no active zone');
    if (a.text.trim() === '') report('missing text');
    if (a.limitBreak !== undefined && (a.limitBreak < 1 || a.limitBreak > 6)) {
      report(`limitBreak ${a.limitBreak} out of range 1-6`);
    }

    const isAuto = a.kind === 'AUTO';
    const bound = new Set<string>();

    const checkSelector = (sel: Selector, context: string) => {
      if (sel.sel === 'bound' && !bound.has(sel.name)) {
        report(`${context} uses "${sel.name}" before it is chosen`);
      }
      if (sel.sel === 'event_card' && !isAuto)
        report(`${context}: event_card outside an AUTO ability`);
      if (sel.sel === 'cards' && sel.areas.length === 0)
        report(`${context}: selector has no areas`);
    };
    const checkCondition = (c: Condition, context: string): void => {
      switch (c.cond) {
        case 'count':
        case 'is':
          checkSelector(c.of, context);
          return;
        case 'not':
          checkCondition(c.c, context);
          return;
        case 'all':
        case 'any':
          c.cs.forEach((x) => checkCondition(x, context));
          return;
        default:
          return;
      }
    };
    const checkCosts = (costs: readonly Cost[], context: string) => {
      for (const c of costs) {
        if ('n' in c && (!Number.isInteger(c.n) || c.n < 1))
          report(`${context}: cost count must be ≥ 1`);
        if ('from' in c) checkSelector(c.from, context);
        if ('target' in c) checkSelector(c.target, context);
      }
    };
    const checkSteps = (steps: readonly Step[], context: string): void => {
      for (const st of steps) {
        const here = `${context} ${st.op}`;
        switch (st.op) {
          case 'choose':
            checkSelector(st.from, here);
            if (st.countOf) checkSelector(st.countOf, here);
            else if (!Number.isInteger(st.count) || st.count < 1)
              report(`${here}: count must be ≥ 1`);
            bound.add(st.as);
            break;
          case 'choose_random':
            checkSelector(st.from, here);
            bound.add(st.as);
            break;
          case 'choose_grade_sum':
            checkSelector(st.from, here);
            bound.add(st.as);
            break;
          case 'search':
            if (!Number.isInteger(st.upTo) || st.upTo < 1) report(`${here}: upTo must be ≥ 1`);
            bound.add(st.as);
            break;
          case 'draw':
          case 'soul_charge':
            if (!Number.isInteger(st.n) || st.n < 1) report(`${here}: n must be ≥ 1`);
            break;
          case 'shuffle':
          case 'look_top_place':
          case 'end_normal_ride':
          case 'extra_drive_check':
          case 'win':
          case 'place_top_locked':
            break;
          case 'deal_damage':
            if (!Number.isInteger(st.n) || st.n < 1) report(`${here}: n must be ≥ 1`);
            break;
          case 'as_opponent':
            checkSteps(st.steps, here);
            break;
          case 'top_to':
            if (!Number.isInteger(st.n) || st.n < 1) report(`${here}: n must be ≥ 1`);
            break;
          case 'look_top':
            if (!Number.isInteger(st.n) || st.n < 1) report(`${here}: n must be ≥ 1`);
            bound.add(st.as);
            break;
          case 'if':
            checkCondition(st.cond, here);
            checkSteps(st.then, here);
            if (st.else) checkSteps(st.else, here);
            break;
          case 'may':
            if (st.payable) checkCosts(st.payable, here);
            checkSteps(st.then, here);
            break;
          case 'pay':
            checkCosts(st.costs, here);
            st.costs.forEach((_, i) => bound.add(`__cost${i}`));
            break;
          case 'grant':
            checkSelector(st.target, here);
            for (const p of validateAbilities(where, [st.ability])) report(`granted: ${p}`);
            break;
          default:
            checkSelector(st.target, here);
        }
      }
    };

    switch (a.kind) {
      case 'AUTO':
        if (a.triggerIf) checkCondition(a.triggerIf, 'triggerIf');
        if (a.condition) checkCondition(a.condition, 'condition');
        if (a.optional && !a.cost?.length) report('optional is only meaningful with a cost');
        if (a.cost) checkCosts(a.cost, 'cost');
        a.cost?.forEach((_, i) => bound.add(`__cost${i}`));
        checkSteps(a.effect, 'effect');
        break;
      case 'ACT':
        checkCosts(a.cost, 'cost');
        a.cost.forEach((_, i) => bound.add(`__cost${i}`));
        checkSteps(a.effect, 'effect');
        break;
      case 'CONT':
        if (a.condition) checkCondition(a.condition, 'condition');
        for (const e of a.effects) {
          if (e.ce === 'forbid_guard' || e.ce === 'also_clan' || e.ce === 'deck_limit') continue;
          checkSelector(e.target, 'effect');
          if (e.ce === 'modify' && e.per) checkSelector(e.per, 'effect per');
        }
        break;
    }
  }
  return problems;
}
