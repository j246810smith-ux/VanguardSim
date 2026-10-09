import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { STARTER_DECKS } from '../../src/decks/starters';
import { TRIAL_DECKS } from '../../src/decks/trialDecks';
import { clanColor, ctx } from './engine';
import type { AiLevel, SessionConfig } from './game/session';
import { BattleScreen } from './screens/BattleScreen';
import { DeckBuilder } from './screens/DeckBuilder';
import { loadDecks } from './decks/storage';
import { validateDeck, type DeckList as Deck } from '../../src/engine';
import { loadSettings, saveSettings, SettingsContext, type Settings, type Speed } from './settings';
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
  | { name: 'battle'; config: SessionConfig; key: number };

const AI_LABEL: Record<AiLevel, string> = { random: 'Easy', basic: 'Normal', smart: 'Hard' };

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  useEffect(() => saveSettings(settings), [settings]);

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

function MainMenu({ go }: { go: (s: Screen) => void }) {
  return (
    <div className="menu">
      <h1 className="title">CARDFIGHT SIM</h1>
      <div className="subtitle">VG-BT01 — BT17 · CLASSIC RULES</div>
      <button className="menu-btn" onClick={() => go({ name: 'setup' })} data-testid="new-game">
        NEW GAME
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

interface DeckEntry {
  readonly name: string;
  readonly description: string;
  readonly deck: Deck;
  readonly legal: boolean;
  readonly section: 'starter' | 'trial' | 'mine';
}

const SECTION_TITLE = {
  starter: 'STARTER DECKS',
  trial: 'TRIAL DECKS',
  mine: 'YOUR DECKS',
} as const;

/** The starter decks, the Trial Decks (D-023), then the player's saved decks (D-022: usable by both sides). */
function deckEntries(): DeckEntry[] {
  return [
    ...STARTER_DECKS.map((d) => ({ ...d, legal: true, section: 'starter' as const })),
    ...TRIAL_DECKS.map((d) => ({ ...d, legal: true, section: 'trial' as const })),
    ...loadDecks().map((d) => {
      const issues = validateDeck(d.deck, ctx.registry, ctx.format);
      return {
        name: d.name,
        description: issues.length ? `Not legal: ${issues[0]!.message}` : 'Your deck',
        deck: d.deck,
        legal: issues.length === 0,
        section: 'mine' as const,
      };
    }),
  ];
}

function DeckList({
  entries,
  selected,
  onSelect,
}: {
  entries: readonly DeckEntry[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="deck-list">
      {entries.map((d, i) => {
        const clan = ctx.registry.has(d.deck.firstVanguard)
          ? ctx.registry.get(d.deck.firstVanguard).clan
          : undefined;
        return (
          <div key={`${d.section}-${d.name}-${i}`}>
            {d.section !== entries[i - 1]?.section && (
              <div className="deck-section">{SECTION_TITLE[d.section]}</div>
            )}
            <button
              className={`deck-option ${i === selected ? 'selected' : ''}`}
              style={{ '--clan': clanColor(clan) } as CSSProperties}
              disabled={!d.legal}
              onClick={() => onSelect(i)}
            >
              <b>{d.name}</b>
              <div style={{ color: 'var(--text-dim)' }}>{d.description}</div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Setup({ onBack, onStart }: { onBack: () => void; onStart: (c: SessionConfig) => void }) {
  const [entries] = useState(deckEntries);
  const [mine, setMine] = useState(0);
  const [theirs, setTheirs] = useState(1);
  const [ai, setAi] = useState<AiLevel>('smart');
  const [seed, setSeed] = useState('');
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
  const toggle = (label: string, key: 'reducedMotion' | 'showArt') => (
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
      <button className="menu-btn" style={{ width: 300, marginTop: 30 }} onClick={onBack}>
        BACK
      </button>
    </div>
  );
}
