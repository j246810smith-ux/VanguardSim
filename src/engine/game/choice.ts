import type { DeckOrder, PendingChoice, PlayerId } from '../state/types';
import { emit, type Draft } from './context';

export interface ChoiceSpec {
  readonly player: PlayerId;
  readonly kind: PendingChoice['kind'];
  readonly options: readonly string[];
  readonly min: number;
  readonly max: number;
  readonly prompt: string;
  readonly order?: DeckOrder;
  readonly shown?: readonly string[];
  readonly subject?: string;
  readonly source?: string;
}

/**
 * Returns the task's answer, asking the player if needed. Returns null while waiting.
 * - No options, or nothing may be chosen: the answer is empty (CR 8.5.3.1.3).
 * - Exactly one possible answer (must choose all of the options): made automatically and
 *   logged with `forced: true` (CR 8.5.3.1: choose as many as possible).
 */
export function ask(d: Draft, task: { selection?: string[] }, spec: ChoiceSpec): string[] | null {
  if (task.selection !== undefined) return task.selection;
  const max = Math.min(spec.max, spec.options.length);
  if (max === 0) return [];
  const s = d.state;
  const id = s.nextChoiceId++;
  if (spec.min >= spec.options.length) {
    const all = [...spec.options];
    emit(d, {
      type: 'CHOICE_MADE',
      choiceId: id,
      player: spec.player,
      selection: all,
      forced: true,
    });
    return all;
  }
  // an ability's step: name the card whose ability asks (3.6, several prompts in a row)
  const frameId = (task as { frame?: number }).frame;
  const frame = frameId === undefined ? undefined : s.frames.find((f) => f.id === frameId);
  s.pendingChoice = {
    id,
    ...spec,
    options: [...spec.options],
    max,
    ...(frame && spec.source === undefined ? { source: frame.source } : {}),
  };
  emit(d, { type: 'CHOICE_REQUESTED', choice: s.pendingChoice });
  return null;
}
