import { InfoPanel } from '../board/Feedback';
import { HIDDEN } from '../../../src/engine';
import { Field } from '../board/Field';
import { Hand } from '../board/Hand';
import { PhaseRail, PlayerPlate, TablePiles } from '../board/Panels';
import { AttackLines, AttackPreviewPanel, BattleHud } from '../combat/Combat';
import { AbilityCallout } from '../board/AbilityCallout';
import { BattleCosmetics } from '../board/Cosmetics';
import { DEFAULT_SLEEVE } from '../cosmetics';
import { AI, ME } from '../engine';
import { circleState } from '../game/interaction';
import { ActionBar } from '../prompts/Prompts';
import { CardView } from '../ui/CardView';
import { Num } from '../ui/Num';
import { CentreEmblem, Icon } from '../ui/svg';

import { BattleOverlays } from './BattleOverlays';
import {
  useBattleController,
  LEVEL_NAME,
  clanOf,
  opponentVanguardClan,
  type Props,
} from './useBattleController';

export type { OnlineInfo } from './useBattleController';

export function BattleScreen(props: Props) {
  const c = useBattleController(props);
  const {
    settings,
    session,
    myDeck,
    selection,
    picked,
    setDetails,
    setLogOpen,
    menu,
    setMenu,
    gEra,
    staged,
    demo,
    view,
    hovered,
    legal,
    onCircle,
    onHand,
    onDragStart,
    onDropCard,
    bar,
    status,
    battle,
    lineAttacker,
    lineBooster,
    preview,
    opp,
    me,
    openZone,
    table,
    config,
    online,
  } = c;
  return (
    <>
      {/* the table (D-035): field, piles and playmat on a tilted (or overhead) plane; the HUD stays flat */}
      <div className={`table-wrap view-${settings.tableView}`} style={table.wrap}>
        <div className="table" style={table.plane}>
          <BattleCosmetics
            mySleeve={online?.mySleeve ?? config?.mySleeve ?? settings.defaultSleeve}
            opponentSleeve={online?.opponentSleeve ?? config?.aiSleeve ?? DEFAULT_SLEEVE}
            playmat={online?.playmat ?? config?.playmat ?? settings.playmat}
          />
          <div className="field-frame opp" />
          <div className="field-frame me" />
          <div className="divider" />
          {!battle && <CentreEmblem />}
          <TablePiles
            view={view}
            onOpen={openZone}
            gEra={gEra}
            deckEnds={(p) => session.deckKnown.ends(p)}
          />

          <Field
            view={view}
            player={AI}
            stateOf={(p, c) => circleState(view, legal, selection, picked, p, c)}
            onCircle={onCircle}
            onDetails={setDetails}
            battleAttacker={battle?.attacker ?? null}
            battleTarget={battle?.target ?? null}
          />
          <Field
            view={view}
            player={ME}
            stateOf={(p, c) => circleState(view, legal, selection, picked, p, c)}
            onCircle={onCircle}
            onDetails={setDetails}
            battleAttacker={battle?.attacker ?? null}
            battleTarget={battle?.target ?? null}
          />
          <AttackLines
            view={view}
            attacker={lineAttacker}
            target={battle?.target ?? null}
            booster={lineBooster}
          />
        </div>
      </div>
      <BattleHud view={view} attackFresh={c.attackFresh} marked={c.markedShield} />
      <AbilityCallout
        view={view}
        fx={session.fx[0]?.kind === 'ability' ? session.fx[0] : undefined}
        choose={legal.choose}
      />
      {preview && !demo && <AttackPreviewPanel preview={preview} />}

      {/* opponent (top) */}
      <PlayerPlate
        side="opp"
        {...(demo ? { role: 'CPU 2' } : {})}
        name={
          online ? online.opponentName : `CPU${demo ? ' 2' : ''} (${LEVEL_NAME[config!.aiLevel]})`
        }
        clan={
          online
            ? (online.opponentClan ?? opponentVanguardClan(view, AI) ?? 'Opponent')
            : clanOf(config!.aiDeck)
        }
        damage={opp.damage.length}
      />
      <div className="opp-hand" data-zone={`${AI}-hand`}>
        {opp.hand.map((id) => (
          <div key={id} data-iid={id}>
            <CardView
              definitionId={
                view.cards[id]!.definitionId === HIDDEN ? null : view.cards[id]!.definitionId
              }
              width={44}
              height={62}
            />
          </div>
        ))}
      </div>
      <div className="counters">
        <div className="counter">
          <small>DAMAGE</small>
          <Num value={opp.damage.length} testId="opp-damage" />
          /6
        </div>
        <div className="counter">
          <small>DECK</small>
          <Num value={opp.deck.length} testId="opp-deck" />
        </div>
        <div className="counter">
          <small>HAND</small>
          <Num value={opp.hand.length} testId="opp-hand" />
        </div>
        <button
          className="icon-btn"
          style={{ position: 'relative', marginLeft: 10 }}
          onClick={() => setMenu(menu === 'game' ? null : 'game')}
          title="Game menu"
          data-nav-menu
        >
          <Icon name="gear" />
        </button>
      </div>
      {/* turn & phase */}
      <PhaseRail
        view={view}
        step={session.battleStep}
        gEra={gEra}
        guide={status && !status.waiting ? status.text : null}
        seats={session.seats}
      />
      {/* fixed information panel (Battlefield 2.0): battle history or the card looked at */}
      <InfoPanel
        view={view}
        hovered={hovered}
        lines={session.log}
        onOpenLog={() => setLogOpen(true)}
        onDetails={setDetails}
      />

      {/* me (bottom) */}
      <PlayerPlate
        side="me"
        name={demo ? `CPU 1 (${LEVEL_NAME[demo.p1Level]})` : 'You'}
        {...(demo ? { role: 'CPU 1' } : {})}
        clan={clanOf(myDeck)}
        damage={me.damage.length}
      />

      <Hand
        view={view}
        legal={legal}
        selection={selection}
        marked={legal.mulligan || legal.choose ? picked : staged.map((g) => g.id)}
        onClick={onHand}
        onDetails={setDetails}
        onDragStart={onDragStart}
        onDrop={onDropCard}
      />
      <ActionBar actions={view.status === 'finished' ? [] : bar} />

      {/* the opponent "looks at their hand" while the AI decides (v0.28 feedback) */}
      {status?.waiting && (
        <div
          className={`thinking ${'seat' in status && status.seat === ME ? 'me' : ''}`}
          data-testid="opponent-thinking"
        >
          {status.text.replace('…', '')}
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}

      <BattleOverlays c={c} />
    </>
  );
}

export { Log } from './BattleOverlays';
