import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { AiLevel, SessionConfig } from './game/session';
import { BattleScreen, type OnlineInfo } from './screens/BattleScreen';
import { OnlineScreen } from './screens/OnlineScreen';
import type { OnlineController } from './online/controller';
import { DeckBuilder } from './screens/DeckBuilder';
import { deckEntries, DeckList } from './screens/deckChoice';
import { loadSettings, saveSettings, SettingsContext, type Settings, type Speed } from './settings';
import './artwork/api'; // window.vanguardDesktop types
import { audio } from './audio/audio';
import { STAGE_H, STAGE_W } from './board/layout';

/** D-019: a fixed 1920×1080 stage, scaled to fit the window. */
function Stage({ children, reducedMotion }: { children: ReactNode; reducedMotion: boolean }) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className={`viewport ${reducedMotion ? 'reduce-motion' : ''}`}>
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
  | { name: 'decks' }
  | { name: 'battle'; config: SessionConfig; key: number }
  | { name: 'online'; notice: string | null }
  | { name: 'online-battle'; info: OnlineInfo; key: number };

const AI_LABEL: Record<AiLevel, string> = { random: 'Easy', basic: 'Normal', smart: 'Hard' };

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  /** The live online connection (D-032), from the lobby until the player leaves. */
  const online = useRef<OnlineController | null>(null);
  const leaveOnline = () => {
    online.current?.stop();
    online.current = null;
  };
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => audio.configure(settings), [settings]);
  // menu music everywhere but in a battle; a new battle (or rematch) starts the battle music
  const battleKey = screen.name === 'battle' || screen.name === 'online-battle' ? screen.key : null;
  useEffect(() => audio.setMusic(battleKey === null ? 'menu' : 'battle'), [battleKey]);

  return (
    <SettingsContext.Provider value={settings}>
      <Stage reducedMotion={settings.reducedMotion}>
        {screen.name === 'menu' && <MainMenu go={setScreen} />}
        {screen.name === 'setup' && (
          <Setup
            onBack={() => setScreen({ name: 'menu' })}
            onStart={(config) => setScreen({ name: 'battle', config, key: Date.now() })}
          />
        )}
        {screen.name === 'decks' && <DeckBuilder onBack={() => setScreen({ name: 'menu' })} />}
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
          />
        )}
      </Stage>
    </SettingsContext.Provider>
  );
}

/**
 * Play Online (D-032) is built but switched off until it is ready for players (user's request,
 * 2026-10-29). Set to true to use it, e.g. for `npm run online:probe`.
 */
const ONLINE_READY = false;

function MainMenu({ go }: { go: (s: Screen) => void }) {
  return (
    <div className="menu">
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
        {!ONLINE_READY && <small>Coming soon</small>}
      </button>
      <button className="menu-btn" onClick={() => go({ name: 'decks' })} data-testid="deck-builder">
        DECK BUILDER
      </button>
      <button className="menu-btn" onClick={() => go({ name: 'settings' })}>
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
  const [entries] = useState(deckEntries);
  const [mine, setMine] = useState(0);
  const [theirs, setTheirs] = useState(1);
  const [ai, setAi] = useState<AiLevel>('smart');
  const [seed, setSeed] = useState('');
  const [delayedLegion, setDelayedLegion] = useState(false);
  const start = () => {
    const my = entries[mine]!;
    const their = entries[theirs]!;
    const n = Number(seed);
    onStart({
      seed: seed.trim() !== '' && Number.isInteger(n) ? n : randomSeed(),
      myDeck: my.deck,
      myDeckName: my.name,
      aiDeck: their.deck,
      aiDeckName: their.name,
      aiLevel: ai,
      delayedLegion,
    });
  };
  return (
    <div className="menu" style={{ justifyContent: 'flex-start', paddingTop: 40 }}>
      <h1 className="title" style={{ fontSize: 52 }}>
        GAME SETUP
      </h1>
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
        />
      </div>
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
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
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
  const toggle = (label: string, key: 'reducedMotion' | 'showArt' | 'foil' | 'muted') => (
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
  return (
    <div className="menu">
      <h1 className="title" style={{ fontSize: 52 }}>
        SETTINGS
      </h1>
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
      {toggle('Reduced motion', 'reducedMotion')}
      {toggle('Show card art', 'showArt')}
      {toggle('Foil effect on rare cards', 'foil')}
      {volume('Music volume', 'musicVolume')}
      {volume('Sound effects volume', 'sfxVolume')}
      {toggle('Mute all sound', 'muted')}
      <ArtworkStatus />
      <button className="menu-btn" style={{ width: 300, marginTop: 30 }} onClick={onBack}>
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
