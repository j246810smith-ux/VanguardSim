import {
  splitAbilityOption,
  type ActOption,
  type RearGuardCircle,
  type GameState,
  type InstanceId,
} from '../../../src/engine';
import { defOf, ME } from '../engine';
import { circleName } from '../game/describe';
import { choiceReady, type Choose, type Legal } from '../game/interaction';
import { CardView } from '../ui/CardView';
import { Icon } from '../ui/svg';
import { DockedPrompt } from './DockedPrompt';

const onBoard = (s: GameState, id: string) =>
  s.players.some(
    (pl) =>
      Object.values(pl.circles).some((ids) => ids.includes(id)) ||
      (pl.id === ME && pl.hand.includes(id)),
  );

export function abilityText(s: GameState, source: InstanceId, abilityId: string): string {
  const def = defOf(s, source);
  const ab = def?.abilities.find((a) => a.id === abilityId);
  // granted abilities are known by `g<grant id>` (abilities/catalog.ts grantAbilityId)
  const granted = s.grants.find((g) => g.target === source && `g${g.id}` === abilityId);
  return ab?.text ?? granted?.ability.text ?? 'ability';
}

/**
 * Putting cards on the top or bottom of the deck one at a time: the cards placed so far, numbered
 * in the order they will sit, with an empty slot for the next one.
 */
function DeckOrderStrip({ view, order }: { view: GameState; order: NonNullable<Choose['order']> }) {
  const slots = Array.from({ length: order.total }, (_, i) => order.placed[i] ?? null);
  const label = (i: number) =>
    order.to === 'top'
      ? i === 0
        ? '1 · top card'
        : `${i + 1}`
      : i === order.total - 1
        ? `${i + 1} · bottom card`
        : `${i + 1}`;
  return (
    <div className="deck-order" data-testid="deck-order">
      <div className="deck-order-title">
        {order.to === 'top'
          ? 'Top of your deck — the first card you choose is the top card'
          : 'Bottom of your deck — each card goes under the ones before it'}
      </div>
      <div className="deck-order-row">
        {order.to === 'bottom' && <div className="deck-order-end">rest of deck ▸</div>}
        {slots.map((id, i) => {
          const d = id ? defOf(view, id) : undefined;
          const next = i === order.placed.length;
          return (
            <div key={i} className={`deck-order-slot ${id ? 'filled' : ''} ${next ? 'next' : ''}`}>
              {id ? (
                <CardView definitionId={view.cards[id]!.definitionId} width={64} height={93} />
              ) : (
                <div className="deck-order-empty">{next ? 'next' : ''}</div>
              )}
              <div className="cap">{label(i)}</div>
              {d && <div className="cap name">{d.name}</div>}
            </div>
          );
        })}
        {order.to === 'top' && <div className="deck-order-end">◂ rest of deck</div>}
      </div>
    </div>
  );
}

/**
 * Every engine choice kind. Cards on the board/hand are picked in place (they glow); others
 * (deck search, drop, soul, damage) appear as a grid here.
 */
export function ChoicePrompt({
  view,
  choose,
  picked,
  onToggle,
  onSubmit,
}: {
  view: GameState;
  choose: Choose;
  picked: readonly string[];
  onToggle: (option: string) => void;
  onSubmit: (selection: readonly string[]) => void;
}) {
  const range =
    choose.min === choose.max ? `Choose ${choose.min}` : `Choose ${choose.min}–${choose.max}`;
  const buttons = (labels: [string, string][]) => (
    <div className="buttons">
      {labels.map(([value, label]) => (
        <button key={value} className="btn primary" onClick={() => onSubmit([value])}>
          {label}
        </button>
      ))}
    </div>
  );
  switch (choose.kind) {
    case 'yes_no':
      return (
        <DockedPrompt>
          <h3>{choose.prompt}</h3>
          {buttons([
            ['yes', 'Yes'],
            ['no', 'No'],
          ])}
        </DockedPrompt>
      );
    case 'number':
      return (
        <DockedPrompt>
          <h3>{choose.prompt}</h3>
          {buttons(choose.options.map((o) => [o, o]))}
        </DockedPrompt>
      );
    case 'name':
      return (
        <div className="prompt" data-testid="choice">
          <h3>{choose.prompt}</h3>
          <div className="name-list">{buttons(choose.options.map((o) => [o, o]))}</div>
        </div>
      );
    case 'top_or_bottom':
      return (
        <DockedPrompt>
          <h3>{choose.prompt}</h3>
          {view.pendingChoice?.shown?.map((id) => (
            <div key={id} className="looked-card">
              <CardView definitionId={view.cards[id]!.definitionId} width={150} height={218} />
            </div>
          ))}
          {buttons(choose.options.map((o) => [o, o === 'top' ? 'Top of deck' : 'Bottom of deck']))}
        </DockedPrompt>
      );
    case 'soul_or_drop':
      return (
        <DockedPrompt>
          <h3>{choose.prompt}</h3>
          {buttons([
            ['soul', 'Soul'],
            ['drop', 'Drop Zone'],
          ])}
        </DockedPrompt>
      );
    case 'circle': {
      // rear-guard circles: the same circle map as a normal call (B9), legal circles only
      const rear = choose.options.every((o) => REAR_GUARD_SET.has(o));
      const placing = view.pendingChoice?.shown ?? [];
      return (
        <DockedPrompt>
          <h3>{choose.prompt}</h3>
          {rear && placing.length > 0 && (
            <div className="looked-card">
              {placing.map((id) => (
                <CardView
                  key={id}
                  definitionId={view.cards[id]!.definitionId}
                  width={110}
                  height={160}
                />
              ))}
            </div>
          )}
          <div className="hint">Click a glowing circle, or:</div>
          {rear ? (
            <CallMap
              view={view}
              open={choose.options as readonly RearGuardCircle[]}
              onCall={(c) => onSubmit([c])}
            />
          ) : (
            buttons(choose.options.map((o) => [o, circleName(o)]))
          )}
        </DockedPrompt>
      );
    }
    case 'order_abilities':
      return (
        <div className="prompt" data-testid="choice">
          <h3>{choose.prompt}</h3>
          <div className="hint">
            These abilities triggered together — choose which resolves next.
          </div>
          {choose.options.map((o) => {
            const sb = view.standby.find((x) => String(x.id) === o);
            const name = sb ? (defOf(view, sb.source)?.name ?? '?') : `#${o}`;
            return (
              <button key={o} className="btn ability-option" onClick={() => onSubmit([o])}>
                <b>{name}</b>
                {sb &&
                sb.eventCard !== null &&
                sb.eventCard !== sb.source &&
                onBoard(view, sb.eventCard)
                  ? ` (for ${defOf(view, sb.eventCard)?.name ?? '?'})`
                  : ''}{' '}
                — {sb ? abilityText(view, sb.source, sb.abilityId) : ''}
              </button>
            );
          })}
        </div>
      );
    case 'ability':
      return (
        <div className="prompt" data-testid="choice">
          <h3>{choose.prompt}</h3>
          {choose.options.map((o) => {
            const [unit, abilityId] = splitAbilityOption(o);
            return (
              <button key={o} className="btn ability-option" onClick={() => onSubmit([o])}>
                <b>{defOf(view, unit)?.name ?? '?'}</b> — {abilityText(view, unit, abilityId)}
              </button>
            );
          })}
        </div>
      );
    default: {
      const offBoard = choose.options.filter((o) => !onBoard(view, o));
      const single = choose.min === 1 && choose.max === 1;
      const body = (
        <>
          <h3>{choose.prompt}</h3>
          {choose.order && <DeckOrderStrip view={view} order={choose.order} />}
          <div className="hint">
            {range}
            {offBoard.length < choose.options.length
              ? ' — glowing cards on the field/hand can be clicked'
              : ''}
            {!single && ` · selected ${picked.length}`}
          </div>
          {offBoard.length > 0 && (
            <div className="pick-grid">
              {offBoard.map((id) => {
                const d = defOf(view, id);
                return (
                  <div
                    key={id}
                    className={`pick ${picked.includes(id) ? 'selected' : ''}`}
                    onClick={() => onToggle(id)}
                    data-nav
                    data-iid={id}
                  >
                    <CardView
                      definitionId={d ? view.cards[id]!.definitionId : null}
                      width={112}
                      height={163}
                    />
                    <div className="cap">{d?.name ?? 'Face-down card'}</div>
                  </div>
                );
              })}
            </div>
          )}
          {!single && (
            <div className="buttons">
              <button
                className="btn gold"
                disabled={!choiceReady(choose, picked)}
                onClick={() => onSubmit(picked)}
              >
                {picked.length === 0 ? 'Choose none' : 'Confirm'}
              </button>
            </div>
          )}
        </>
      );
      return offBoard.length ? (
        <div className="prompt" data-testid="choice">
          {body}
        </div>
      ) : (
        <DockedPrompt>{body}</DockedPrompt>
      );
    }
  }
}

export function MulliganPrompt({ count, onSubmit }: { count: number; onSubmit: () => void }) {
  return (
    <DockedPrompt testId="mulligan">
      <h3>Mulligan</h3>
      <div className="hint">
        Click hand cards to return them to the deck, then redraw. You may keep your whole hand.
      </div>
      <div className="buttons">
        <button className="btn gold" onClick={onSubmit}>
          {count === 0 ? 'Keep hand' : `Return ${count} and redraw`}
        </button>
      </div>
    </DockedPrompt>
  );
}

/** Actions for the selected hand card or unit: ride, activated abilities, details. */
export function CardMenu({
  view,
  id,
  legal,
  onRide,
  onCall,
  onActivate,
  onDetails,
  onClose,
}: {
  view: GameState;
  id: InstanceId;
  legal: Legal;
  onRide: () => void;
  /** Call the card to this rear-guard circle (the circle map below, v0.28). */
  onCall?: (circle: RearGuardCircle) => void;
  onActivate: (o: ActOption) => void;
  onDetails: () => void;
  onClose: () => void;
}) {
  const def = defOf(view, id);
  const acts = legal.act.filter((o) => o.source === id);
  const inHand = view.players[ME].hand.includes(id);
  return (
    <div className="popover card-menu" data-testid="card-menu">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b style={{ fontSize: 20 }}>{def?.name}</b>
        <button className="btn" style={{ padding: '2px 10px' }} onClick={onClose}>
          ✕
        </button>
      </div>
      {inHand && legal.call.has(id) && (
        <>
          <div className="hint" style={{ margin: '6px 0' }}>
            Call to a circle below, or drag / click a glowing circle on the board.
          </div>
          {onCall && <CallMap view={view} open={legal.callCircles} onCall={onCall} />}
        </>
      )}
      {legal.ride.has(id) && (
        <button className="btn primary ability-option" onClick={onRide}>
          <b>Ride</b> onto your vanguard
        </button>
      )}
      {acts.map((o) => (
        <button key={o.abilityId} className="btn ability-option" onClick={() => onActivate(o)}>
          <b>Activate:</b> {abilityText(view, o.source, o.abilityId)}
        </button>
      ))}
      <button className="btn ability-option" onClick={onDetails}>
        Card details
      </button>
    </div>
  );
}

const REAR_GUARD_SET: ReadonlySet<string> = new Set([
  'front_left',
  'front_right',
  'back_left',
  'back_center',
  'back_right',
]);

/** Your circles as on the board: front row (left, VC, right) over the back row (v0.28). */
const CALL_MAP: readonly (readonly (RearGuardCircle | 'vanguard')[])[] = [
  ['front_left', 'vanguard', 'front_right'],
  ['back_left', 'back_center', 'back_right'],
];

/**
 * Where to call: a small map of your rear-guard circles laid out like the board, so the choice
 * matches the circle you see. Circles you may call to are buttons; an occupied one says the unit
 * there is retired; the vanguard circle and closed circles cannot be picked.
 */
export function CallMap({
  view,
  open,
  onCall,
}: {
  view: GameState;
  open: readonly RearGuardCircle[];
  onCall: (circle: RearGuardCircle) => void;
}) {
  const circles = view.players[ME].circles;
  return (
    <div className="call-map" data-testid="call-map">
      {CALL_MAP.map((row, r) => (
        <div key={r} className="call-row">
          {row.map((c) => {
            if (c === 'vanguard')
              return (
                <div key={c} className="call-spot vc">
                  VC
                </div>
              );
            const unit = circles[c].at(-1);
            const name = unit ? (defOf(view, unit)?.name ?? 'unit') : null;
            const legalHere = open.includes(c);
            return (
              <button
                key={c}
                className={`call-spot ${unit ? 'occupied' : 'open'}`}
                disabled={!legalHere}
                title={
                  unit
                    ? `${circleName(c)}: ${name} is retired if you call here`
                    : `${circleName(c)}: open`
                }
                onClick={() => onCall(c)}
                data-testid={`call-${c}`}
              >
                <span className="where">{r === 0 ? 'FRONT' : 'BACK'}</span>
                <span className="who">{name ?? 'open'}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Every activated ability available now (including cards in the drop zone or soul). */
export function SkillsMenu({
  view,
  legal,
  onActivate,
  onClose,
}: {
  view: GameState;
  legal: Legal;
  onActivate: (o: ActOption) => void;
  onClose: () => void;
}) {
  return (
    <div className="popover" style={{ right: 20, bottom: 130 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <b style={{ fontSize: 20 }}>Activated abilities</b>
        <button className="btn" style={{ padding: '2px 10px' }} onClick={onClose}>
          ✕
        </button>
      </div>
      {legal.act.map((o) => (
        <button
          key={`${o.source}/${o.abilityId}`}
          className="btn ability-option"
          onClick={() => onActivate(o)}
        >
          <b>{defOf(view, o.source)?.name ?? '?'}:</b> {abilityText(view, o.source, o.abilityId)}
        </button>
      ))}
    </div>
  );
}

export interface BarAction {
  readonly key: string;
  readonly label: string;
  readonly icon: Parameters<typeof Icon>[0]['name'];
  readonly onClick: () => void;
  readonly tone?: 'primary' | 'warn';
  readonly toggled?: boolean;
}

export function ActionBar({ actions }: { actions: readonly BarAction[] }) {
  return (
    <div className="action-bar" data-nav-group="actions">
      {actions.map((a) => (
        <button
          key={a.key}
          className={`action ${a.tone ?? ''} ${a.toggled ? 'toggled' : ''}`}
          onClick={a.onClick}
          data-testid={`action-${a.key}`}
        >
          <Icon name={a.icon} />
          {a.label}
        </button>
      ))}
    </div>
  );
}
