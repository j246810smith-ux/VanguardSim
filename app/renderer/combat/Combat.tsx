import { useEffect } from 'react';
import {
  currentPower,
  currentShield,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../../../src/engine';
import { circlePos, type Point } from '../board/layout';
import { ctx, ME } from '../engine';
import type { Fx } from '../game/session';
import { paced, useSettings } from '../settings';
import { CardView } from '../ui/CardView';

const isOn = (s: GameState, p: PlayerId, id: InstanceId) =>
  Object.values(s.players[p].circles).some((ids) => ids.includes(id));

function posOf(s: GameState, id: InstanceId): Point | null {
  for (const p of [0, 1] as const) {
    for (const [circle, ids] of Object.entries(s.players[p].circles)) {
      if (ids.includes(id)) return circlePos(p, circle as never);
    }
  }
  return null;
}

/** Attack arrow (attacker → target) and boost link (booster → attacker), for the live battle or a pending selection. */
export function AttackLines({
  view,
  attacker,
  target,
  booster,
}: {
  view: GameState;
  attacker: InstanceId | null;
  target: InstanceId | null;
  booster: InstanceId | null;
}) {
  const a = attacker ? posOf(view, attacker) : null;
  const t = target ? posOf(view, target) : null;
  const b = booster ? posOf(view, booster) : null;
  if (!a) return null;
  return (
    <svg className="attack-lines" viewBox="0 0 1920 1080">
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="#ffd34d" />
        </marker>
      </defs>
      {b && <line className="boost" x1={b.x} y1={b.y} x2={a.x} y2={a.y} />}
      {t && <line className="atk" x1={a.x} y1={a.y} x2={t.x} y2={t.y} markerEnd="url(#arrow)" />}
    </svg>
  );
}

/** Attack vs. defence power, boost contribution and guardians, on the centre line. */
export function BattleHud({ view }: { view: GameState }) {
  const b = view.battle;
  if (!b) return null;
  const attackerSide = view.activePlayer;
  const defenderSide: PlayerId = attackerSide === 0 ? 1 : 0;
  const atk = isOn(view, attackerSide, b.attacker) ? currentPower(view, ctx, b.attacker) : 0;
  const def = isOn(view, defenderSide, b.target) ? currentPower(view, ctx, b.target) : 0;
  const boost =
    b.booster && isOn(view, attackerSide, b.booster) ? currentPower(view, ctx, b.booster) : 0;
  const guardians = view.players[defenderSide].guardian;
  const shield = guardians.reduce((sum, id) => sum + currentShield(view, ctx, id), 0);
  const myAttack = attackerSide === ME;
  // the attack hits when defence ≤ attack, so shields come in steps of 5000 above the gap
  return (
    <>
      <div className="battle-hud atk" style={{ left: myAttack ? 520 : 1400 }}>
        <span className="lbl">ATTACK</span>
        <span className="val">{atk}</span>
        {boost > 0 && <span className="sub">boost +{boost}</span>}
      </div>
      <div className="battle-hud" style={{ left: myAttack ? 1400 : 520 }}>
        <span className="lbl">DEFENCE</span>
        <span className="val" style={{ color: def > atk ? 'var(--good)' : 'var(--text)' }}>
          {def}
        </span>
        {shield > 0 && <span className="sub">shield +{shield}</span>}
        <span className="sub" style={{ color: def > atk ? 'var(--good)' : 'var(--hit)' }}>
          {def > atk ? 'GUARDED' : `needs ${Math.floor((atk - def) / 5000) * 5000 + 5000} shield`}
        </span>
      </div>
      {guardians.length > 0 && (
        <div className="guardian-row">
          {guardians.map((id) => (
            <div key={id} style={{ position: 'relative' }}>
              <CardView definitionId={view.cards[id]!.definitionId} width={70} height={102} />
              <span className="g-shield">{currentShield(view, ctx, id)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const TRIGGER_EFFECT: Record<string, string> = {
  critical: 'Critical +1 · Power +5000',
  draw: 'Draw 1 · Power +5000',
  stand: 'Stand 1 rear-guard · Power +5000',
  heal: 'Heal 1 damage · Power +5000',
};

/** Checks, hit results and banners take the stage briefly (skippable; instant speed skips them). */
export function FxLayer({ fx, onDone }: { fx: Fx | undefined; onDone: (id: number) => void }) {
  const settings = useSettings();
  useEffect(() => {
    if (!fx) return;
    const ms = paced(settings, fx.kind === 'check' ? 1300 : 900);
    const t = setTimeout(() => onDone(fx.id), ms);
    return () => clearTimeout(t);
  }, [fx, settings, onDone]);
  if (!fx || settings.speed === 'instant') return null;
  return (
    <div className="fx" key={fx.id}>
      {fx.kind === 'check' && (
        <div className={`fx-check ${fx.player === ME ? 'me' : 'opp'}`}>
          <CardView definitionId={fx.definitionId} width={220} height={320} />
          <div>
            <div className="kind">{fx.check === 'drive' ? 'DRIVE CHECK' : 'DAMAGE CHECK'}</div>
            {fx.trigger && fx.active ? (
              <>
                <div className={`trig ${fx.trigger}`}>{fx.trigger.toUpperCase()} TRIGGER</div>
                <div className="effect">{TRIGGER_EFFECT[fx.trigger]}</div>
              </>
            ) : (
              <div className="trig none">{fx.trigger ? 'NO EFFECT' : 'NO TRIGGER'}</div>
            )}
          </div>
        </div>
      )}
      {fx.kind === 'result' && (
        <div className={`fx-banner ${fx.hit ? 'hit' : 'nohit'}`}>{fx.hit ? 'HIT!' : 'NO HIT'}</div>
      )}
      {fx.kind === 'banner' && <div className={`fx-banner ${fx.tone}`}>{fx.text}</div>}
    </div>
  );
}
