import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FormatKey } from '../../src/engine';
import { setPlayFormat } from './engine';
import type { AiLevel, SessionConfig } from './game/session';
import { BattleScreen, type OnlineInfo } from './screens/BattleScreen';
import { OnlineScreen } from './screens/OnlineScreen';
import type { OnlineController } from './online/controller';
import { DeckBuilder } from './screens/DeckBuilder';
import { deckEntries, DeckList } from './screens/deckChoice';
import {
  loadSettings,
  saveSettings,
  SettingsContext,
  useSettings,
  type Settings,
  type Speed,
} from './settings';
import './artwork/api'; // window.vanguardDesktop types
import { audio } from './audio/audio';
import { STAGE_H, STAGE_W } from './board/layout';
import { PlaymatPicker, SleevePicker } from './ui/CosmeticPickers';
import { DEFAULT_SLEEVE } from './cosmetics';
import { randomSeed, seedFrom } from './game/seed';
import { DemoSetup, type DemoChoice } from './screens/DemoSetup';
import { UpdateManager } from './screens/UpdateManager';
import { migrationNotice, startMigrationResult } from './migrations';
import { desktopUpdates, updateResultText, type UpdateCheck, type UpdateResult } from './updates';

const FEEDBACK_HINT =
  'Opens GitHub in your browser, where you can write and post it. Needs a free GitHub account. Posts are public.';

/** D-019: a fixed 1920×1080 stage, scaled to fit the window. */
function Stage({
  children,
  reducedMotion,
  screenShake,
}: {
  children: ReactNode;
  reducedMotion: boolean;
  screenShake: boolean;
}) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div
      className={`viewport ${reducedMotion ? 'reduce-motion' : ''} ${screenShake ? 'shake-on' : ''}`}
    >
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

type Screen =
  | { name: 'menu' }
  | { name: 'setup' }
  | { name: 'settings' }
  | { name: 'updates'; from: 'menu' | 'settings' }
  | { name: 'decks' }
  | { name: 'battle'; config: SessionConfig; key: number }
  | { name: 'demo-setup' }
  | { name: 'online'; notice: string | null }
  | { name: 'online-battle'; info: OnlineInfo; key: number };

const AI_LABEL: Record<AiLevel, string> = { random: 'Easy', basic: 'Normal', smart: 'Hard' };

const SETUP_FORMAT_KEY = 'vanguard-sim.setup-format';
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: not remembered
  }
};
const recall = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  /** The live online connection (D-032), from the lobby until the player leaves. */
  const online = useRef<OnlineController | null>(null);
  // the last CPU demonstration's choices, kept while the app runs (v0.28)
  const demoChoice = useRef<DemoChoice | null>(null);
  const leaveOnline = () => {
    online.current?.stop();
    online.current = null;
  };
  /** The last update check this run (D-037); the start-up check fills it when switched on. */
  const [updateCheck, setUpdateCheck] = useState<UpdateCheck | null>(null);
  const [startSettings] = useState(settings);
  useEffect(() => {
    if (!startSettings.checkUpdatesAtStart) return;
    let live = true;
    void desktopUpdates()
      ?.check(startSettings.updateChannel)
      .then((r) => live && setUpdateCheck(r))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [startSettings]);
  const updateReady = updateCheck?.ok && updateCheck.available ? updateCheck.latest.version : null;
  /** What the updater did before this start, shown once on the main menu. */
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  /** What happened to the saved data at this start, when the player should know. */
  const [dataNotice, setDataNotice] = useState(() => migrationNotice(startMigrationResult()));
  useEffect(() => {
    let live = true;
    void desktopUpdates()
      ?.lastResult()
      .then((r) => live && setUpdateResult(r))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => saveSettings(settings), [settings]);
  // menus and the Deck Builder use the Classic rules; a G-era game sets its own (D-034)
  useEffect(() => {
    if (screen.name !== 'battle') setPlayFormat('classic');
  }, [screen.name]);
  useEffect(() => audio.configure(settings), [settings]);
  // menu music everywhere but in a battle; a new battle (or rematch) starts the battle music
  const battleKey = screen.name === 'battle' || screen.name === 'online-battle' ? screen.key : null;
  useEffect(() => audio.setMusic(battleKey === null ? 'menu' : 'battle'), [battleKey]);

  return (
    <SettingsContext.Provider value={settings}>
      <Stage reducedMotion={settings.reducedMotion} screenShake={settings.screenShake}>
        {screen.name === 'menu' && (
          <MainMenu
            go={setScreen}
            updateReady={updateReady}
            updateResult={updateResult}
            onDismissResult={() => setUpdateResult(null)}
            dataNotice={dataNotice}
            onDismissData={() => setDataNotice(null)}
          />
        )}
        {screen.name === 'updates' && (
          <UpdateManager
            settings={settings}
            onChange={setSettings}
            initial={updateCheck}
            onChecked={setUpdateCheck}
            onBack={() =>
              setScreen(screen.from === 'menu' ? { name: 'menu' } : { name: 'settings' })
            }
          />
        )}
        {screen.name === 'setup' && (
          <Setup
            onBack={() => setScreen({ name: 'menu' })}
            onStart={(config) => setScreen({ name: 'battle', config, key: Date.now() })}
          />
        )}
        {screen.name === 'decks' && <DeckBuilder onBack={() => setScreen({ name: 'menu' })} />}
        {screen.name === 'demo-setup' && (
          <DemoSetup
            initial={demoChoice.current}
            onBack={() => setScreen({ name: 'menu' })}
            onStart={(config, choice) => {
              demoChoice.current = choice;
              setScreen({ name: 'battle', config, key: Date.now() });
            }}
          />
        )}
        {screen.name === 'online' && (
          <OnlineScreen
            notice={screen.notice}
            onBack={() => {
              leaveOnline();
              setScreen({ name: 'menu' });
            }}
            onConnected={(c) => (online.current = c)}
            callbacks={{
              started: (info) => setScreen({ name: 'online-battle', info, key: Date.now() }),
              closed: (reason) => {
                online.current = null;
                setScreen({ name: 'online', notice: reason });
              },
            }}
          />
        )}
        {screen.name === 'online-battle' && (
          <BattleScreen
            key={screen.key}
            online={screen.info}
            onRematch={() => online.current?.rematch()}
            onExit={() => {
              leaveOnline();
              setScreen({ name: 'menu' });
            }}
          />
        )}
        {screen.name === 'settings' && (
          <SettingsScreen
            settings={settings}
            onChange={setSettings}
            onBack={() => setScreen({ name: 'menu' })}
            onUpdates={() => setScreen({ name: 'updates', from: 'settings' })}
          />
        )}
        {screen.name === 'battle' && (
          <BattleScreen
            key={screen.key}
            config={screen.config}
            onRematch={() =>
              setScreen({
                name: 'battle',
                config: { ...screen.config, seed: randomSeed() },
                key: Date.now(),
              })
            }
            onExit={() => setScreen({ name: 'menu' })}
            onRestart={() => setScreen({ ...screen, key: Date.now() })}
            onDemoSetup={() => setScreen({ name: 'demo-setup' })}
          />
        )}
      </Stage>
    </SettingsContext.Provider>
  );
}

/**
 * Play Online (D-032): switched off in v0.25.0-alpha, switched on again 2026-10-30 (user's
 * request). Set to false to show "Coming soon" instead.
 */
const ONLINE_READY = true;

function MainMenu({
  go,
  updateReady,
  updateResult,
  onDismissResult,
  dataNotice,
  onDismissData,
}: {
  go: (s: Screen) => void;
  updateResult: UpdateResult | null;
  onDismissResult: () => void;
  dataNotice: string | null;
  onDismissData: () => void;
  /** A newer version found by the start-up check (shown on the menu only, never in a match). */
  updateReady: string | null;
}) {
  return (
    <div className="menu">
      {window.vanguardDesktop?.openFeedback && (
        <button
          className="btn"
          onClick={() => void window.vanguardDesktop?.openFeedback?.()}
          data-testid="feedback-menu"
          title={FEEDBACK_HINT}
          style={{ position: 'absolute', bottom: 24, right: 24 }}
        >
          Report a Problem / Suggest Something
        </button>
      )}
      {dataNotice && (
        <button
          className="btn"
          onClick={onDismissData}
          data-testid="data-notice"
          title="Click to dismiss"
          style={{ position: 'absolute', bottom: 24, left: 24, maxWidth: 560, textAlign: 'left' }}
        >
          {dataNotice}
        </button>
      )}
      {updateResult && (
        <button
          className="btn update-result"
          onClick={onDismissResult}
          data-testid="update-result"
          title="Click to dismiss"
          style={{ position: 'absolute', top: 24, left: 24, maxWidth: 560, textAlign: 'left' }}
        >
          {updateResultText(updateResult)}
        </button>
      )}
      {updateReady && (
        <button
          className="btn update-notice"
          onClick={() => go({ name: 'updates', from: 'menu' })}
          data-testid="update-notice"
          style={{ position: 'absolute', top: 24, right: 24, borderColor: '#ffd166' }}
        >
          Update available: v{updateReady}
        </button>
      )}
      <h1 className="title">CARDFIGHT SIM</h1>
      <div className="subtitle">VG-BT01 — BT17 · CLASSIC RULES</div>
      <button className="menu-btn" onClick={() => go({ name: 'setup' })} data-testid="new-game">
        NEW GAME
      </button>
      <button
        className="menu-btn"
        onClick={() => go({ name: 'online', notice: null })}
        disabled={!ONLINE_READY}
        title={ONLINE_READY ? undefined : 'Online play is not ready yet'}
        data-testid="play-online"
      >
        PLAY ONLINE
        <small>{ONLINE_READY ? 'In testing' : 'Coming soon'}</small>
      </button>
      <button
        className="menu-btn"
        onClick={() => go({ name: 'demo-setup' })}
        data-testid="cpu-demo"
      >
        CPU DEMONSTRATION
        <small>Watch two decks play</small>
      </button>
      <button className="menu-btn" onClick={() => go({ name: 'decks' })} data-testid="deck-builder">
        DECK BUILDER
      </button>
      <button className="menu-btn" onClick={() => go({ name: 'settings' })} data-testid="settings">
        SETTINGS
      </button>
      <button className="menu-btn" onClick={() => window.close()}>
        QUIT
      </button>
      <div className="hint" style={{ marginTop: 24, opacity: 0.6, fontSize: 14 }}>
        Unofficial fan project, not affiliated with Bushiroad. Cardfight!! Vanguard © Bushiroad.
      </div>
    </div>
  );
}

function Setup({ onBack, onStart }: { onBack: () => void; onStart: (c: SessionConfig) => void }) {
  const settings = useSettings();
  // v0.28: Game Setup remembers the last format played
  const [format, setFormat] = useState<FormatKey>(() =>
    recall(SETUP_FORMAT_KEY) === 'g' ? 'g' : 'classic',
  );
  const entries = useMemo(() => deckEntries(format), [format]);
  const [mine, setMine] = useState(0);
  const [theirs, setTheirs] = useState(1);
  const pickFormat = (f: FormatKey) => {
    setFormat(f);
    setMine(0);
    setTheirs(1);
  };
  const [ai, setAi] = useState<AiLevel>('smart');
  const [seed, setSeed] = useState('');
  const [seedHelp, setSeedHelp] = useState(false);
  const [delayedLegion, setDelayedLegion] = useState(false);
  const start = () => {
    const my = entries[mine]!;
    const their = entries[theirs]!;
    remember(SETUP_FORMAT_KEY, format);
    onStart({
      seed: seedFrom(seed) ?? randomSeed(),
      myDeck: my.deck,
      myDeckName: my.name,
      aiDeck: their.deck,
      aiDeckName: their.name,
      aiLevel: ai,
      delayedLegion,
      format,
      // D-033: a deck's own sleeve and playmat, else the defaults from Settings
      mySleeve: my.sleeve ?? settings.defaultSleeve,
      aiSleeve: their.sleeve ?? DEFAULT_SLEEVE,
      playmat: my.playmat ?? settings.playmat,
    });
  };
  return (
    <div className="menu" style={{ justifyContent: 'flex-start', paddingTop: 40 }}>
      <h1 className="title" style={{ fontSize: 52 }}>
        GAME SETUP
      </h1>
      <div className="row">
        Format
        <span className="seg">
          <button
            className={format === 'classic' ? 'on' : ''}
            onClick={() => pickFormat('classic')}
            data-testid="format-classic"
          >
            Original Era <small className="fmt-sub">BT01–BT17 · no G units</small>
          </button>
          <button
            className={format === 'g' ? 'on' : ''}
            onClick={() => pickFormat('g')}
            data-testid="format-g"
            title="Original Era cards plus the G era: G units, Stride, G guardians, Generation Break. In testing: please report problems."
          >
            Expanded Era <small className="fmt-sub">+ G era</small>{' '}
            <span className="testing-tag">IN TESTING</span>
          </button>
        </span>
      </div>
      <div className="setup">
        <div>
          <h2 style={{ color: 'var(--me)' }}>YOUR DECK</h2>
          <DeckList entries={entries} selected={mine} onSelect={setMine} />
        </div>
        <div>
          <h2 style={{ color: 'var(--opp)' }}>OPPONENT DECK</h2>
          <DeckList entries={entries} selected={theirs} onSelect={setTheirs} />
        </div>
      </div>
      <div className="row">
        Opponent AI
        <span className="seg">
          {(['random', 'basic', 'smart'] as const).map((l) => (
            <button key={l} className={ai === l ? 'on' : ''} onClick={() => setAi(l)}>
              {AI_LABEL[l]}
            </button>
          ))}
        </span>
        <span style={{ marginLeft: 30 }}>Seed</span>
        <input
          className="text"
          placeholder="random"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          data-testid="seed"
        />
        <button
          className={`btn info ${seedHelp ? 'on' : ''}`}
          onClick={() => setSeedHelp((v) => !v)}
          title="What is the seed?"
          data-testid="seed-help-toggle"
        >
          ?
        </button>
      </div>
      {seedHelp && (
        <div className="seed-help" data-testid="seed-help">
          <b>The seed decides the luck of a game:</b> who goes first and every shuffle (the starting
          decks, mulligans and &ldquo;shuffle your deck&rdquo; effects), so also which cards come up
          in drive and damage checks. Both players share one seed.
          <br />
          <b>Leave it blank</b> for a new random game every time. <b>Type a number or any word</b>{' '}
          to fix the luck: the same seed with the same two decks deals the same game again. It stays
          the same as long as you make the same choices; once a choice differs, the game goes its
          own way from there. The Basic and Smart AIs don&rsquo;t use the seed (they play the same
          way in the same position); the Random AI does. Each game&rsquo;s seed is the first line of
          its log.
        </div>
      )}
      <div className="row">
        Custom rules
        <span className="seg">
          <button
            className={delayedLegion ? 'on' : ''}
            onClick={() => setDelayedLegion((v) => !v)}
            data-testid="rule-delayed-legion"
            title="Seek Mate returns four normal units without Sentinel. At the start of your next stand phase, the Legion Mate goes into your soul or drop zone."
          >
            Delayed Legion: {delayedLegion ? 'ON' : 'OFF'}
          </button>
        </span>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="menu-btn" style={{ width: 300 }} onClick={onBack}>
          BACK
        </button>
        <button className="menu-btn" style={{ width: 300 }} onClick={start} data-testid="start">
          START
        </button>
      </div>
    </div>
  );
}

function SettingsScreen({
  settings,
  onChange,
  onBack,
  onUpdates,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
  onUpdates: () => void;
}) {
  const speeds: [Speed, string][] = [
    ['normal', 'Normal'],
    ['fast', 'Fast'],
    ['instant', 'Instant (no effects)'],
  ];
  const volumes: [number, string][] = [
    [0, 'Off'],
    [25, '25%'],
    [50, '50%'],
    [75, '75%'],
    [100, '100%'],
  ];
  const volume = (label: string, key: 'musicVolume' | 'sfxVolume') => (
    <div className="row">
      <span style={{ width: 300 }}>{label}</span>
      <span className="seg">
        {volumes.map(([v, text]) => (
          <button
            key={v}
            className={settings[key] === v ? 'on' : ''}
            onClick={() => {
              onChange({ ...settings, [key]: v });
              if (key === 'sfxVolume') setTimeout(() => audio.play(['call']), 50);
            }}
          >
            {text}
          </button>
        ))}
      </span>
    </div>
  );
  const toggle = (
    label: string,
    key: 'reducedMotion' | 'screenShake' | 'showArt' | 'foil' | 'muted',
  ) => (
    <div className="row">
      <span style={{ width: 300 }}>{label}</span>
      <span className="seg">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            className={settings[key] === v ? 'on' : ''}
            onClick={() => onChange({ ...settings, [key]: v })}
          >
            {v ? 'On' : 'Off'}
          </button>
        ))}
      </span>
    </div>
  );
  // Esc goes back too (the list scrolls, BACK stays visible below it)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
  return (
    <div className="menu settings-screen">
      <h1 className="title" style={{ fontSize: 52 }}>
        SETTINGS
      </h1>
      <div className="settings-scroll" data-testid="settings-scroll">
        <div className="row">
          <span style={{ width: 300 }}>Animation speed</span>
          <span className="seg">
            {speeds.map(([v, label]) => (
              <button
                key={v}
                className={settings.speed === v ? 'on' : ''}
                onClick={() => onChange({ ...settings, speed: v })}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        <div className="row">
          <span style={{ width: 300 }}>
            Battle cut-ins
            <div className="hint">Ride, attack and trigger moments</div>
          </span>
          <span className="seg">
            {(
              [
                ['full', 'Full'],
                ['short', 'Short'],
                ['off', 'Off'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                className={settings.cutIns === v ? 'on' : ''}
                onClick={() => onChange({ ...settings, cutIns: v })}
                data-testid={`cutins-${v}`}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        <div className="row">
          <span style={{ width: 300 }}>
            Battle view
            <div className="hint">Straight from above, or a tilted table</div>
          </span>
          <span className="seg">
            {(
              [
                ['overhead', 'Overhead (90°)'],
                ['tilted', 'Tilted (45°)'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                className={settings.tableView === v ? 'on' : ''}
                onClick={() => onChange({ ...settings, tableView: v })}
                data-testid={`view-${v}`}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        {toggle('Screen shake when an attack hits', 'screenShake')}
        {toggle('Reduced motion', 'reducedMotion')}
        {toggle('Show card art', 'showArt')}
        {toggle('Foil effect on rare cards', 'foil')}
        {volume('Music volume', 'musicVolume')}
        {volume('Sound effects volume', 'sfxVolume')}
        {toggle('Mute all sound', 'muted')}
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span style={{ width: 300 }}>
            Card sleeve
            <div className="hint">For decks without their own sleeve</div>
          </span>
          <SleevePicker
            value={settings.defaultSleeve}
            onChange={(id) => onChange({ ...settings, defaultSleeve: id })}
          />
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span style={{ width: 300 }}>Playmat</span>
          <PlaymatPicker
            value={settings.playmat}
            onChange={(id) => onChange({ ...settings, playmat: id })}
          />
        </div>
        <ArtworkStatus />
        {window.vanguardDesktop?.openFeedback && (
          <div className="row">
            <span style={{ width: 300 }}>
              Feedback
              <div className="hint">{FEEDBACK_HINT}</div>
            </span>
            <button
              className="btn"
              onClick={() => void window.vanguardDesktop?.openFeedback?.()}
              data-testid="feedback-settings"
            >
              Report a Problem / Suggest Something
            </button>
          </div>
        )}
        <div className="row">
          <span style={{ width: 300 }}>
            Updates
            <div className="hint">Installed version, newest release, release notes</div>
          </span>
          <button className="btn" onClick={onUpdates} data-testid="open-updates">
            Open Update Manager
          </button>
        </div>
      </div>
      <button
        className="menu-btn"
        style={{ width: 300 }}
        onClick={onBack}
        data-testid="settings-back"
      >
        BACK
      </button>
    </div>
  );
}

/** Desktop app only: how many cards have art, and the way to the Artwork Manager. */
function ArtworkStatus() {
  const desktop = window.vanguardDesktop;
  const [status, setStatus] = useState<{ installed: number; expected: number } | null>(null);
  useEffect(() => {
    void desktop?.artworkStatus().then(setStatus);
  }, [desktop]);
  if (!desktop) return null;
  return (
    <div className="row" data-testid="artwork-status">
      <span style={{ width: 300 }}>Card artwork</span>
      <span style={{ width: 260 }}>
        {status ? `${status.installed} of ${status.expected} cards` : '…'}
      </span>
      <button className="btn" onClick={() => void desktop.openArtworkManager()}>
        Open Artwork Manager
      </button>
    </div>
  );
}
