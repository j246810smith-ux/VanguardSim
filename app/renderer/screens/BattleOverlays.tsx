import { TriggerRatioPanel } from '../prompts/TriggerRatio';
import { activeHouseRules, HouseRulesPanel } from '../prompts/HouseRules';
import { useEffect, useRef, useState } from 'react';
import { FxLayer } from '../combat/Combat';
import { ME } from '../engine';
import { GGuardPrompt, StridePrompt } from '../prompts/GPrompts';
import { type SessionBase } from '../game/session';
import { DemoSummary } from './DemoSummary';
import { CardDetails, ZoneViewer } from '../prompts/CardDetails';
import { CardMenu, ChoicePrompt, MulliganPrompt, SkillsMenu } from '../prompts/Prompts';
import { ConnectionBanner } from '../online/ConnectionBanner';
import { InspectButton } from '../board/InspectButton';

import { endingText } from './useBattleController';

import type { BattleController } from './useBattleController';

/**
 * The prompts, menus, dialogs and end screens of a game, shared by the desktop stage and the phone
 * layout: they act through the same controller, so both layouts behave the same.
 */
export function BattleOverlays({
  c,
  logDrawer = false,
}: {
  c: BattleController;
  /** Phone layout: the battle log opens as a drawer over the left rail. */
  logDrawer?: boolean;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ratioOpen, setRatioOpen] = useState(false);
  const {
    session,
    myDeckName,
    opponentDeckName,
    selection,
    setSelection,
    picked,
    details,
    setDetails,
    zone,
    setZone,
    logOpen,
    setLogOpen,
    menu,
    setMenu,
    toast,
    demo,
    game,
    view,
    legal,
    leaveDialog,
    dismissFx,
    send,
    toggle,
    opp,
    me,
    menuCard,
    winner,
    config,
    online,
    onRematch,
    onExit,
    onRestart,
    onDemoSetup,
  } = c;
  return (
    <>
      {legal.choose && (
        <ChoicePrompt
          view={view}
          choose={legal.choose}
          picked={picked}
          onToggle={toggle}
          onSubmit={(sel) =>
            send({ type: 'CHOOSE', player: ME, choiceId: legal.choose!.choiceId, selection: sel })
          }
        />
      )}
      {legal.mulligan && (
        <MulliganPrompt
          count={picked.length}
          onSubmit={() => send({ type: 'MULLIGAN', player: ME, cardIds: picked })}
        />
      )}

      {/* touch screens (U3): Inspect beside the selected card, when its menu (which has Card
          details) is not open */}
      {selection && !(menuCard && !legal.choose) && !details && (
        <InspectButton
          key={selection.id}
          id={selection.id}
          onInspect={() => setDetails(selection.id)}
        />
      )}
      {menuCard && !legal.choose && (
        <CardMenu
          view={view}
          id={menuCard}
          legal={legal}
          onRide={() => send({ type: 'RIDE', player: ME, cardId: menuCard })}
          onCall={(circle) => send({ type: 'CALL', player: ME, cardId: menuCard, circle })}
          onActivate={(o) =>
            send({ type: 'ACTIVATE', player: ME, source: o.source, abilityId: o.abilityId })
          }
          onDetails={() => setDetails(menuCard)}
          onClose={() => setSelection(null)}
        />
      )}
      {menu === 'skills' && (
        <SkillsMenu
          view={view}
          legal={legal}
          onActivate={(o) =>
            send({ type: 'ACTIVATE', player: ME, source: o.source, abilityId: o.abilityId })
          }
          onClose={() => setMenu(null)}
        />
      )}
      {menu === 'stride' && legal.stride && !legal.choose && (
        <StridePrompt
          view={view}
          stride={legal.stride}
          onSend={send}
          onClose={() => setMenu(null)}
        />
      )}
      {menu === 'gguard' && legal.gGuard && !legal.choose && (
        <GGuardPrompt
          view={view}
          gGuard={legal.gGuard}
          onSend={send}
          onClose={() => setMenu(null)}
        />
      )}
      {menu === 'swap' && (
        <div className="popover" style={{ right: 20, bottom: 130, width: 340 }}>
          <b style={{ fontSize: 20 }}>Move rear-guards</b>
          {legal.swap.map((column) => (
            <button
              key={column}
              className="btn ability-option"
              onClick={() => send({ type: 'SWAP_REAR_GUARDS', player: ME, column })}
            >
              Swap the {column} column (front ↔ back)
            </button>
          ))}
        </div>
      )}
      {menu === 'game' && (
        <div className="popover" style={{ right: 20, top: 70, width: 300 }}>
          <button className="btn ability-option" onClick={() => (setLogOpen(true), setMenu(null))}>
            Battle log
          </button>
          <button
            className="btn ability-option"
            onClick={() => (setRulesOpen(true), setMenu(null))}
            data-testid="open-house-rules"
          >
            House rules ({activeHouseRules(view) || 'none'} on)
          </button>
          <button
            className="btn ability-option"
            onClick={() => (setRatioOpen(true), setMenu(null))}
            data-testid="open-trigger-ratio"
          >
            Trigger ratio (your deck)
          </button>
          {view.status !== 'finished' && (
            <button
              className="btn ability-option"
              onClick={() => send({ type: 'CONCEDE', player: ME })}
            >
              Concede
            </button>
          )}
          <button className="btn ability-option" onClick={onExit}>
            Main menu
          </button>
        </div>
      )}

      {logOpen && <Log lines={session.log} onClose={() => setLogOpen(false)} drawer={logDrawer} />}
      {rulesOpen && <HouseRulesPanel view={view} onClose={() => setRulesOpen(false)} />}
      {ratioOpen && (
        <TriggerRatioPanel
          view={view}
          deckList={c.myDeck.cards}
          onClose={() => setRatioOpen(false)}
        />
      )}

      <FxLayer fx={session.fx[0]} onDone={dismissFx} />
      {/* B11: Final Turn, cosmetic */}
      {c.finalTurn && (
        <div
          key={c.finalTurn.key}
          className={`final-turn ${c.finalTurn.seat === ME ? 'me' : 'opp'}`}
          data-testid="final-turn"
          role="status"
        >
          <div className="final-turn-title">FINAL TURN!</div>
          <div className="final-turn-who">
            {c.finalTurn.seat === ME ? 'You declare' : 'Your opponent declares'}
          </div>
        </div>
      )}

      {online?.connection && <ConnectionBanner watch={online.connection} />}
      {toast && <div className="toast">Not allowed: {toast}</div>}
      {details && <CardDetails view={view} id={details} onClose={() => setDetails(null)} />}
      {leaveDialog}
      {zone && (
        <ZoneViewer
          view={view}
          title={zone.title}
          ids={zone.ids}
          revealFaceDown={zone.reveal ?? false}
          onPick={(id) => setDetails(id)}
          onClose={() => setZone(null)}
        />
      )}

      {demo && view.status === 'finished' && session.fx.length === 0 && game && (
        <DemoSummary
          game={game}
          names={[myDeckName, opponentDeckName]}
          onRestart={() => onRestart?.()}
          onNewSeed={onRematch}
          onDecks={() => onDemoSetup?.()}
          onLog={() => setLogOpen(true)}
        />
      )}
      {!demo && view.status === 'finished' && session.fx.length === 0 && (
        <div className="game-over" data-testid="game-over">
          <h1 className={winner === ME ? 'win' : 'lose'}>
            {winner === ME ? 'VICTORY' : winner === null ? 'DRAW' : 'DEFEAT'}
          </h1>
          <div className="game-summary" data-testid="game-summary">
            <div className="how">{endingText(session.ending?.reason ?? null, winner)}</div>
            <div>
              Turn {view.turnNumber} · your damage {me.damage.length}/6 · opponent's damage{' '}
              {opp.damage.length}/6
            </div>
            <div>
              {myDeckName} <span className="vs">vs</span> {opponentDeckName}
            </div>
            <div className="dim">
              {online
                ? `Online vs ${online.opponentName}`
                : `Seed ${config!.seed} · ${session.commands.length} actions`}
            </div>
          </div>
          <div className="buttons" style={{ display: 'flex', gap: 14 }}>
            <button className="menu-btn" style={{ width: 300 }} onClick={onRematch}>
              REMATCH
            </button>
            <button className="menu-btn" style={{ width: 300 }} onClick={onExit}>
              {online ? 'LEAVE' : 'MAIN MENU'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function Log({
  lines,
  onClose,
  drawer = false,
}: {
  lines: SessionBase['log'];
  onClose: () => void;
  /** Phone layout: a drawer over the left rail that leaves the board in view, not a window. */
  drawer?: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);
  // block body: newer Chromium returns a Promise from scrollIntoView, which React would call as cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);
  const body = (
    <>
      <div className="log-head">
        <b>BATTLE LOG</b>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="log-body">
        {lines.map((l) => (
          <div key={l.id} className={`l-${l.tone}`}>
            {l.text}
          </div>
        ))}
        <div ref={end} />
      </div>
    </>
  );
  if (drawer)
    return (
      <div className="log-drawer" data-testid="log">
        {body}
      </div>
    );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal log-modal" data-testid="log" onClick={(e) => e.stopPropagation()}>
        {body}
      </div>
    </div>
  );
}
