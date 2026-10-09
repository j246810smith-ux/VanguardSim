import {
  splitAbilityOption,
  type ActOption,
  type GameState,
  type InstanceId,
} from '../../../src/engine';
import { defOf, ME } from '../engine';
import { circleName } from '../game/describe';
import { choiceReady, type Choose, type Legal } from '../game/interaction';
import { CardView } from '../ui/CardView';
import { Icon } from '../ui/svg';

const onBoard = (s: GameState, id: string) =>
  s.players.some(
    (pl) =>
      Object.values(pl.circles).some((ids) => ids.includes(id)) ||
      (pl.id === ME && pl.hand.includes(id)),
  );

function abilityText(s: GameState, source: InstanceId, abilityId: string): string {
  const def = defOf(s, source);
  const ab = def?.abilities.find((a) => a.id === abilityId);
  // granted abilities are known by `g<grant id>` (abilities/catalog.ts grantAbilityId)
  const granted = s.grants.find((g) => g.target === source && `g${g.id}` === abilityId);
  return ab?.text ?? granted?.ability.text ?? 'ability';
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
        <div className="prompt docked" data-testid="choice">
          <h3>{choose.prompt}</h3>
          {buttons([
            ['yes', 'Yes'],
            ['no', 'No'],
          ])}
        </div>
      );
    case 'number':
      return (
        <div className="prompt docked" data-testid="choice">
          <h3>{choose.prompt}</h3>
          {buttons(choose.options.map((o) => [o, o]))}
        </div>
      );
    case 'top_or_bottom':
      return (
        <div className="prompt docked" data-testid="choice">
          <h3>{choose.prompt}</h3>
          {buttons(choose.options.map((o) => [o, o === 'top' ? 'Top of deck' : 'Bottom of deck']))}
        </div>
      );
    case 'circle':
      return (
        <div className="prompt docked" data-testid="choice">
          <h3>{choose.prompt}</h3>
          <div className="hint">Click a glowing circle, or:</div>
          {buttons(choose.options.map((o) => [o, circleName(o)]))}
        </div>
      );
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
                <b>{name}</b> — {sb ? abilityText(view, sb.source, sb.abilityId) : ''}
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
      return (
        <div className={`prompt ${offBoard.length ? '' : 'docked'}`} data-testid="choice">
          <h3>{choose.prompt}</h3>
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
        </div>
      );
    }
  }
}

export function MulliganPrompt({ count, onSubmit }: { count: number; onSubmit: () => void }) {
  return (
    <div className="prompt docked" data-testid="mulligan">
      <h3>Mulligan</h3>
      <div className="hint">
        Click hand cards to return them to the deck, then redraw. You may keep your whole hand.
      </div>
      <div className="buttons">
        <button className="btn gold" onClick={onSubmit}>
          {count === 0 ? 'Keep hand' : `Return ${count} and redraw`}
        </button>
      </div>
    </div>
  );
}

/** Actions for the selected hand card or unit: ride, activated abilities, details. */
export function CardMenu({
  view,
  id,
  legal,
  onRide,
  onActivate,
  onDetails,
  onClose,
}: {
  view: GameState;
  id: InstanceId;
  legal: Legal;
  onRide: () => void;
  onActivate: (o: ActOption) => void;
  onDetails: () => void;
  onClose: () => void;
}) {
  const def = defOf(view, id);
  const acts = legal.act.filter((o) => o.source === id);
  const inHand = view.players[ME].hand.includes(id);
  return (
    <div className="popover" style={{ left: 730, bottom: 238 }} data-testid="card-menu">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b style={{ fontSize: 20 }}>{def?.name}</b>
        <button className="btn" style={{ padding: '2px 10px' }} onClick={onClose}>
          ✕
        </button>
      </div>
      {inHand && legal.call.has(id) && (
        <div className="hint" style={{ margin: '6px 0' }}>
          Drag to a glowing circle — or click one — to call.
        </div>
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
    <div className="action-bar">
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
