import { useEffect } from 'react';
import {
  HIDDEN,
  currentCritical,
  currentPower,
  currentShield,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../../../src/engine';
import { circlePos, toScreen, type Point, type TableView } from '../board/layout';
import { ctx, ME } from '../engine';
import type { AttackPreview } from '../game/attackPreview';
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

/** The centre line between the fields, on screen (the table may be tilted, D-035). */
const centreY = (view: TableView) => Math.round(toScreen({ x: 960, y: 504 }, view).y);

/**
 * Attack vs. defence on the centre line (D-035): your plate on the left, the opponent's on the
 * right, VS between them, with the boost, shields and how much shield still stops the hit.
 */
export function BattleHud({ view }: { view: GameState }) {
  const { tableView } = useSettings();
  const b = view.battle;
  if (!b) return null;
  const attackerSide = view.activePlayer;
  const defenderSide: PlayerId = attackerSide === 0 ? 1 : 0;
  const atk = isOn(view, attackerSide, b.attacker) ? currentPower(view, ctx, b.attacker) : 0;
  const def = isOn(view, defenderSide, b.target) ? currentPower(view, ctx, b.target) : 0;
  const boost =
    b.booster && isOn(view, attackerSide, b.booster) ? currentPower(view, ctx, b.booster) : 0;
  const crit = isOn(view, attackerSide, b.attacker) ? currentCritical(view, ctx, b.attacker) : 1;
  const guardians = view.players[defenderSide].guardian;
  const shield = guardians.reduce((sum, id) => sum + currentShield(view, ctx, id), 0);
  const myAttack = attackerSide === ME;
  const guarded = def > atk;
  // the attack hits when defence ≤ attack, so shields come in steps of 5000 above the gap
  const needs = Math.floor((atk - def) / 5000) * 5000 + 5000;
  const attack = (
    <div className={`vs-plate atk ${myAttack ? 'me' : 'opp'}`} key="atk">
      <span className="lbl">ATTACK</span>
      <span className="val">{atk}</span>
      <span className="sub">
        {boost > 0 ? `boost +${boost} · ` : ''}★{crit}
      </span>
    </div>
  );
  const defence = (
    <div
      className={`vs-plate def ${myAttack ? 'opp' : 'me'} ${guarded ? 'guarded' : ''}`}
      key="def"
    >
      <span className="lbl">DEFENCE</span>
      <span className="val">{def}</span>
      <span className="sub">
        {shield > 0 ? `shield +${shield} · ` : ''}
        {guarded ? 'GUARDED' : `needs ${needs}`}
      </span>
    </div>
  );
  return (
    <div className="battle-vs" style={{ top: centreY(tableView) }} data-testid="battle-hud">
      {myAttack ? attack : defence}
      <div className="vs-mark">VS</div>
      {myAttack ? defence : attack}
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
    </div>
  );
}

/** Per-column attack power during my battle phase, compared with the opponent's vanguard (D-028). */
export function AttackPreviewPanel({ preview }: { preview: AttackPreview }) {
  const focus = preview.columns.find((c) => c.selected || c.attacking);
  return (
    <div className="panel attack-preview" data-testid="attack-preview">
      <div className="ap-head">
        <span>ATTACK POWER</span>
        <span className="ap-vs">
          vs VG <b>{preview.targetPower}</b>
        </span>
      </div>
      {preview.columns.map((c) => (
        <div
          key={c.circle}
          className={[
            'ap-row',
            c.ready || c.attacking ? '' : 'off',
            c.selected || c.attacking ? 'focus' : '',
          ].join(' ')}
        >
          <span className="ap-col">{c.label}</span>
          {c.attacker === null ? (
            <span className="ap-note">empty</span>
          ) : (
            <>
              <span className="ap-sum">
                {c.attack}
                {c.boost > 0 ? ` + ${c.boost}` : ''}
              </span>
              <span className={`ap-total ${c.needs > 0 ? 'hits' : ''}`}>{c.total}</span>
              <span className="ap-crit">★{c.critical}</span>
              {c.note && <span className="ap-note">{c.note}</span>}
            </>
          )}
        </div>
      ))}
      <div className="ap-foot">
        {focus
          ? focus.needs > 0
            ? `${focus.label}: ${focus.total} vs ${preview.targetPower} · needs ${focus.needs} shield`
            : `${focus.label}: ${focus.total} vs ${preview.targetPower} · no hit unless powered up`
          : 'Pick an attacker to see its attack.'}
      </div>
    </div>
  );
}

const TRIGGER_EFFECT: Record<string, string> = {
  critical: 'Critical +1 · Power +5000',
  draw: 'Draw 1 · Power +5000',
  stand: 'Stand 1 rear-guard · Power +5000',
  heal: 'Heal 1 damage · Power +5000',
};

type Mode = 'full' | 'short' | 'off';

/** How long each moment holds the stage, per cut-in mode (ms at normal speed; 0 = not shown). */
const HOLD: Record<Mode, Record<Fx['kind'], number>> = {
  full: {
    ride: 1500,
    legion: 1700,
    attack: 750,
    check: 1400,
    result: 900,
    banner: 900,
    ability: 1500,
  },
  short: {
    ride: 750,
    legion: 850,
    attack: 0,
    check: 1000,
    result: 700,
    banner: 700,
    ability: 1500,
  },
  off: { ride: 900, legion: 900, attack: 0, check: 1300, result: 900, banner: 900, ability: 1500 },
};

const nameOf = (definitionId: string) =>
  definitionId === HIDDEN ? '' : ctx.registry.get(definitionId).name;

/**
 * Checks, hit results, banners and (D-035) cut-ins take the stage briefly; the rules never wait
 * for them. "Full" plays Dear Days–style cut-ins (ride, legion, attack, a large check in the
 * middle), "Short" quick ones, "Off" only the small banners. Instant speed skips them all.
 */
export function FxLayer({ fx, onDone }: { fx: Fx | undefined; onDone: (id: number) => void }) {
  const settings = useSettings();
  // its own setting, not tied to Reduced motion (which stops cards sliding): the user chose it
  const mode: Mode = settings.cutIns ?? 'full';
  const hold = fx ? HOLD[mode][fx.kind] : 0;
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => onDone(fx.id), paced(settings, hold));
    return () => clearTimeout(t);
  }, [fx, settings, onDone, hold]);
  // abilities are drawn beside the G circle (board/AbilityCallout); only their timing is here
  if (!fx || fx.kind === 'ability' || settings.speed === 'instant' || hold === 0) return null;
  const ms = `${paced(settings, hold)}ms`;
  const side = (p: PlayerId) => (p === ME ? 'me' : 'opp');
  return (
    <div className={`fx fx-${mode}`} key={fx.id} style={{ ['--hold' as string]: ms }}>
      {fx.kind === 'ride' &&
        (mode === 'off' ? (
          <div className={`fx-banner ${side(fx.player)}`}>
            {fx.superior ? 'SUPERIOR RIDE!' : 'RIDE!'}
          </div>
        ) : (
          <div className={`cutin ride ${side(fx.player)} ${mode}`} data-testid="cutin-ride">
            <div className="band">
              <div className="band-art">
                <CardView definitionId={fx.definitionId} width={300} height={437} />
              </div>
            </div>
            <div className="hero">
              <CardView definitionId={fx.definitionId} width={260} height={379} />
            </div>
            <div className="words">
              <div className="call">{fx.superior ? 'SUPERIOR RIDE!' : 'RIDE!'}</div>
              <div className="name">{nameOf(fx.definitionId)}</div>
            </div>
          </div>
        ))}
      {fx.kind === 'legion' &&
        (mode === 'off' ? (
          <div className="fx-banner gold">LEGION!</div>
        ) : (
          <div className={`cutin legion ${side(fx.player)} ${mode}`} data-testid="cutin-legion">
            <div className="band gold" />
            <div className="pair">
              <div className="l">
                <CardView definitionId={fx.leader} width={220} height={320} />
              </div>
              <div className="r">
                <CardView definitionId={fx.mate} width={220} height={320} />
              </div>
            </div>
            <div className="words">
              <div className="call">LEGION!</div>
              <div className="name">
                {nameOf(fx.leader)} + {nameOf(fx.mate)}
              </div>
            </div>
          </div>
        ))}
      {fx.kind === 'attack' && (
        <div className={`cutin attack ${side(fx.player)}`} data-testid="cutin-attack">
          <div className="slash" />
          <div className="mini">
            <CardView definitionId={fx.attacker} width={110} height={160} />
          </div>
          <div className="words">
            <div className="call">ATTACK!</div>
            <div className="name">
              {nameOf(fx.attacker)}
              {fx.boosted ? ' (boosted)' : ''} → {nameOf(fx.target)}
            </div>
          </div>
        </div>
      )}
      {fx.kind === 'check' &&
        (mode === 'full' ? (
          <div
            className={`cutin check ${side(fx.player)} ${fx.trigger && fx.active ? `t-${fx.trigger}` : 'none'}`}
            data-testid="cutin-check"
          >
            <div className="kind">{fx.check === 'drive' ? 'DRIVE CHECK' : 'DAMAGE CHECK'}</div>
            <div className="flip">
              {fx.trigger && fx.active && <div className="burst" />}
              <CardView definitionId={fx.definitionId} width={230} height={335} />
            </div>
            {fx.trigger && fx.active ? (
              <>
                <div className={`trig ${fx.trigger}`}>{fx.trigger.toUpperCase()} TRIGGER!</div>
                <div className="effect">{TRIGGER_EFFECT[fx.trigger]}</div>
              </>
            ) : (
              <div className="trig none">{fx.trigger ? 'NO EFFECT' : 'NO TRIGGER'}</div>
            )}
          </div>
        ) : (
          <div className={`fx-check ${side(fx.player)}`}>
            <CardView definitionId={fx.definitionId} width={110} height={160} />
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
        ))}
      {fx.kind === 'result' && (
        <div className={`fx-banner ${fx.hit ? 'hit' : 'nohit'} ${mode}`}>
          {fx.hit ? 'HIT!' : 'NO HIT'}
        </div>
      )}
      {fx.kind === 'banner' && <div className={`fx-banner ${fx.tone}`}>{fx.text}</div>}
    </div>
  );
}
