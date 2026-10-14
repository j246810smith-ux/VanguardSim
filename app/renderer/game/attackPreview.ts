/**
 * Attack preview: for each of my front-row columns, the attacker's power, the booster's power and
 * the total, compared with the opponent's vanguard (D-028). Read-only: it never changes the game.
 */
import type { AttackOption, GameState, InstanceId, PlayerId } from '../../../src/engine';
import { defaultBooster, type Selection } from './interaction';

export type FrontCircle = 'front_left' | 'vanguard' | 'front_right';

export interface ColumnPreview {
  readonly circle: FrontCircle;
  readonly label: string;
  /** The unit in the front circle (the leader for a legion), or null if the circle is empty. */
  readonly attacker: InstanceId | null;
  /** Attacker power, including a legion mate's power. */
  readonly attack: number;
  /** Power the booster would add (0 = no legal or chosen booster). */
  readonly boost: number;
  readonly total: number;
  readonly critical: number;
  /** The unit can attack now. */
  readonly ready: boolean;
  /** Why it can't attack, when it can't. */
  readonly note: 'empty' | 'rested' | 'cannot attack' | null;
  readonly selected: boolean;
  readonly attacking: boolean;
  /** Shield the opponent's vanguard needs to stop this attack (0 = it does not hit as it is). */
  readonly needs: number;
}

export interface AttackPreview {
  readonly columns: readonly ColumnPreview[];
  /** Power of the opponent's vanguard (without shields). */
  readonly targetPower: number;
}

export interface StatReader {
  /** Power without battle relationships (no boost, no guardians). */
  power(id: InstanceId): number;
  critical(id: InstanceId): number;
}

const COLUMNS: readonly { circle: FrontCircle; label: string }[] = [
  { circle: 'front_left', label: 'LEFT' },
  { circle: 'vanguard', label: 'VG' },
  { circle: 'front_right', label: 'RIGHT' },
];

/** The smallest shield (in steps of 5000) that makes the defence higher than the attack. */
export function shieldNeeded(attack: number, defence: number): number {
  return attack < defence ? 0 : Math.floor((attack - defence) / 5000) * 5000 + 5000;
}

export function attackPreview(
  view: GameState,
  me: PlayerId,
  options: readonly AttackOption[],
  selection: Selection,
  stats: StatReader,
): AttackPreview {
  const mine = view.players[me];
  const opp = view.players[me === 0 ? 1 : 0];
  const oppVg = opp.legion?.leader ?? opp.circles.vanguard.at(-1) ?? null;
  const targetPower =
    oppVg === null
      ? 0
      : stats.power(oppVg) + (opp.legion?.leader === oppVg ? stats.power(opp.legion.mate) : 0);
  const battle = view.battle;

  const columns = COLUMNS.map(({ circle, label }): ColumnPreview => {
    const legion = circle === 'vanguard' ? mine.legion : null;
    const top = legion ? legion.leader : (mine.circles[circle].at(-1) ?? null);
    const attacker = top !== null && !view.cards[top]!.locked ? top : null;
    const option = options.find((o) => o.attackerCircle === circle) ?? null;
    const selected = selection?.kind === 'attacker' && selection.id === attacker;
    const attacking = battle !== null && battle.attacker === attacker;
    let booster: InstanceId | null = null;
    if (selected) booster = selection.booster;
    else if (attacking) booster = battle.booster;
    else if (option) booster = defaultBooster(option);
    const attack =
      attacker === null ? 0 : stats.power(attacker) + (legion ? stats.power(legion.mate) : 0);
    const boost = booster === null ? 0 : stats.power(booster);
    const total = attack + boost;
    const note =
      attacker === null
        ? 'empty'
        : option || attacking
          ? null
          : view.cards[attacker]!.orientation === 'rest'
            ? 'rested'
            : 'cannot attack';
    return {
      circle,
      label,
      attacker,
      attack,
      boost,
      total,
      critical: attacker === null ? 0 : stats.critical(attacker),
      ready: option !== null,
      note,
      selected,
      attacking,
      needs: attacker === null ? 0 : shieldNeeded(total, targetPower),
    };
  });
  return { columns, targetPower };
}
