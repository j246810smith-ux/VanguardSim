import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { OU_LIST, type FormatKey } from '../../src/engine';
import { validFormatKey } from './decks/storage';
import { setPlayFormat } from './engine';
import type { AiLevel, SessionConfig } from './game/session';
import type { OnlineInfo } from './screens/BattleScreen';
import { Battle as BattleScreen } from './screens/Battle';
import { AudioSettings } from './screens/AudioSettings';
import { ControllerLayer } from './input/ControllerLayer';
import { ControllerSettings } from './input/ControllerSettings';
import { useBattleTracks } from './audio/playlist';
import { useMusicPrefs } from './audio/musicLibrary';
import { THEMES, type ThemeId } from './themes';
import { OnlineScreen } from './screens/OnlineScreen';
import type { OnlineController } from './online/controller';
import { DeckBuilder } from './screens/DeckBuilder';
import { ProfileScreen } from './profile/ProfileScreen';
import { HomeScreen } from './home/HomeScreen';
import { PhoneArtDownload } from './android/PhoneArtDownload';
import { PhoneUpdates } from './android/PhoneUpdates';
import { deckEntries, DeckList } from './screens/deckChoice';
import {
  effectiveSettings,
  loadSettings,
  saveSettings,
  setProfilePref,
  SettingsContext,
  useSettings,
  type Graphics,
  type Settings,
  type Speed,
} from './settings';
import { fitSize, stageLayout, StageInfo, textBoost, type StageLayout } from './stageFit';
import { PROFILE_IDS, PROFILES, profileFor, type ProfileId } from './presentation/profile';
import { listenForBack } from './android/back';
import { nativeApp } from './android/native';
import './artwork/api'; // window.vanguardDesktop types
import { audio } from './audio/audio';
import { PlaymatPicker, PlaymatPreview, SleevePicker } from './ui/CosmeticPickers';
import { AppIconPicker } from './ui/AppIconPicker';
import { applyAppIcon } from './appIconNative';
import { DEFAULT_SLEEVE } from './cosmetics';
import { randomSeed, seedFrom } from './game/seed';
import { DemoSetup, type DemoChoice } from './screens/DemoSetup';
import { UpdateManager } from './screens/UpdateManager';
import { UiShowcase } from './screens/UiShowcase';
import { Button, IconButton, Segmented, TextField } from './ui/kit';
import { HelpCircle, Play } from 'lucide-react';
import { migrationNotice, startMigrationResult } from './migrations';
import { desktopUpdates, updateResultText, type UpdateCheck, type UpdateResult } from './updates';
import { CAN, IS_ANDROID } from './platform';
import { phoneCardCount } from './android/phoneArt';
import { InfoTip } from './ui/InfoTip';
import { HouseRulesPicker } from './prompts/HouseRulesPicker';
import { houseRulesConfig, NO_HOUSE_RULES, type HouseRulesChoice } from './game/houseRules';

/** Game Setup help: a tooltip with a mouse, an info button on a touch screen (U5). */
const G_ERA_HELP =
  'G Era (called Expanded Era before v0.37): Original Era cards plus the G era: G units, Stride, G guardians, Generation Break. In testing: please report problems.';
const STRICT_HELP =
  'Original Era — Strict: BT01–BT17, the trial decks and side sets, no G era cards.';
const EXPANDED_HELP =
  'Original Era — Expanded: the Original Era plus the G era cards approved on the OU (Original Era Usable) list, played with the Original Era rules. Cards needing Stride, Generation Break or G guardians are never on it.';
export { NINE_K_HELP, MEGA_BLAST_HELP } from './game/houseRules';

const FEEDBACK_HINT =
  'Opens GitHub in your browser, where you can write and post it. Needs a free GitHub account. Posts are public.';

/**
 * D-019: a fixed 1920×1080 stage, scaled to fit the window. It fits inside the safe area (U8:
 * the viewport is padded by the phone's camera cutout and rounded corners), and on a small screen
 * it enlarges the log and prompt text (U11, `--text-boost`).
 */
function Stage({
  children,
  reducedMotion,
  theme,
  screenShake,
  graphics,
}: {
  children: ReactNode;
  reducedMotion: boolean;
  theme: ThemeId;
  screenShake: boolean;
  graphics: Graphics;
}) {
  const [{ scale, phone, edge }, setLayout] = useState<StageLayout>({
    scale: 1,
    phone: false,
    edge: 0,
  });
  const area = useRef<HTMLDivElement>(null);
  const last = useRef<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const fit = () => {
      // the area inside the safe-area padding; the window itself where nothing is laid out (tests)
      const el = area.current;
      const w = el?.clientWidth || window.innerWidth;
      const h = el?.clientHeight || window.innerHeight;
      const typing = !!document.activeElement?.matches('input, textarea, select');
      const size = fitSize(w, h, last.current, typing);
      last.current = size;
      setLayout(stageLayout(size.width, size.height));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div
      className={`viewport theme-${theme} gfx-${graphics} ${reducedMotion ? 'reduce-motion' : ''} ${screenShake ? 'shake-on' : ''}`}
    >
      <div className="stage-area" ref={area}>
        <div
          className={`stage ${phone ? 'phone' : ''} ${edge > 0 ? 'wide' : ''}`}
          style={
            {
              transform: `translate(-50%, -50%) scale(${scale})`,
              '--text-boost': textBoost(scale),
              '--edge': `${edge}px`,
            } as CSSProperties
          }
        >
          <StageInfo.Provider value={{ scale, phone, edge }}>{children}</StageInfo.Provider>
        </div>
      </div>
    </div>
  );
}

/** The interface sound for a pressed button: "back" for the ones that cancel or close. */
export function buttonSound(button: Element): 'press' | 'cancel' {
  const text = (button.textContent ?? '').trim();
  const id = button.getAttribute('data-testid') ?? '';
  return /^(cancel|close|back|✕|▼|smaller|main menu|hide)/i.test(text) ||
    /cancel|close|back/.test(id)
    ? 'cancel'
    : 'press';
}

type Screen =
  | { name: 'menu' }
  | { name: 'setup' }
  | { name: 'settings' }
  | { name: 'updates'; from: 'menu' | 'settings' }
  | { name: 'showcase' }
  | { name: 'decks' }
  | { name: 'cards' }
  | { name: 'profile' }
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
  // Android back (U6): screens with something open handle it first (android/back.ts); otherwise
  // back to the main menu, and from the main menu out of the app
  const current = useRef(screen);
  current.current = screen;
  useEffect(
    () =>
      listenForBack(nativeApp(), () => {
        if (current.current.name === 'menu') void nativeApp()?.exitApp();
        else {
          leaveOnline();
          setScreen({ name: 'menu' });
        }
      }),
    [],
  );
  // what the game plays with (Low graphics overrides foil, cut-ins and the table view, U14);
  // the Settings screen still shows and edits the player's own choices
  const playing = useMemo(() => effectiveSettings(settings), [settings]);
  useEffect(() => applyAppIcon(settings.appIcon), [settings.appIcon]);
  // menus and the Deck Builder use the Classic rules; a G-era game sets its own (D-034)
  useEffect(() => {
    if (screen.name !== 'battle') setPlayFormat('classic');
  }, [screen.name]);
  useEffect(() => audio.configure(settings), [settings]);
  // battle music: the game's tracks and the player's own music folder
  const tracks = useBattleTracks();
  useEffect(() => audio.setBattleTracks(tracks), [tracks]);
  // the player's playlists for menu and battle music (W5, Settings → Audio → Music manager)
  const musicPrefs = useMusicPrefs();
  useEffect(() => audio.setMusicPrefs(musicPrefs), [musicPrefs]);
  // interface sounds for every button, from one place (docs/audio/AUDIO_PLAN.md)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest?.('button');
      if (!button || button.disabled) return;
      audio.ui(buttonSound(button));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  // menu music everywhere but in a battle; a new battle (or rematch) starts the battle music
  const battleKey = screen.name === 'battle' || screen.name === 'online-battle' ? screen.key : null;
  useEffect(() => audio.setMusic(battleKey === null ? 'menu' : 'battle'), [battleKey]);

  return (
    <SettingsContext.Provider value={playing}>
      <Stage
        reducedMotion={settings.reducedMotion}
        theme={settings.theme}
        screenShake={settings.screenShake}
        graphics={settings.graphics}
      >
        <ControllerLayer settings={settings} screen={screen.name} />
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
        {screen.name === 'profile' && <ProfileScreen onBack={() => setScreen({ name: 'menu' })} />}
        {screen.name === 'cards' && (
          <DeckBuilder mode="browse" onBack={() => setScreen({ name: 'menu' })} />
        )}
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
            onShowcase={() => setScreen({ name: 'showcase' })}
          />
        )}
        {screen.name === 'showcase' && (
          <UiShowcase onBack={() => setScreen({ name: 'settings' })} />
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
  const feedback = window.vanguardDesktop?.openFeedback;
  return (
    <HomeScreen
      actions={{
        newGame: () => go({ name: 'setup' }),
        demo: () => go({ name: 'demo-setup' }),
        online: CAN.playOnline ? () => go({ name: 'online', notice: null }) : null,
        onlineReady: ONLINE_READY,
        decks: () => go({ name: 'decks' }),
        cards: () => go({ name: 'cards' }),
        settings: () => go({ name: 'settings' }),
        updates: CAN.updateInPlace ? () => go({ name: 'updates', from: 'menu' }) : null,
        feedback: feedback ? () => void feedback() : null,
        quit: IS_ANDROID ? null : () => window.close(),
        profile: () => go({ name: 'profile' }),
      }}
    >
      {dataNotice && (
        <Button
          className="home-notice"
          onClick={onDismissData}
          data-testid="data-notice"
          title="Click to dismiss"
          style={{ bottom: 200, left: 24 }}
        >
          {dataNotice}
        </Button>
      )}
      {updateResult && (
        <Button
          className="update-result home-notice"
          onClick={onDismissResult}
          data-testid="update-result"
          title="Click to dismiss"
          style={{ top: 150, left: 24 }}
        >
          {updateResultText(updateResult)}
        </Button>
      )}
      {updateReady && (
        <Button
          variant="gold"
          className="update-notice home-notice"
          onClick={() => go({ name: 'updates', from: 'menu' })}
          data-testid="update-notice"
          style={{ top: 130, right: 24 }}
        >
          Update available: v{updateReady}
        </Button>
      )}
    </HomeScreen>
  );
}

function Setup({ onBack, onStart }: { onBack: () => void; onStart: (c: SessionConfig) => void }) {
  const settings = useSettings();
  // v0.28: Game Setup remembers the last format played
  const [format, setFormat] = useState<FormatKey>(() => validFormatKey(recall(SETUP_FORMAT_KEY)));
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
  const [houseRules, setHouseRules] = useState<HouseRulesChoice>(NO_HOUSE_RULES);
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
      ...houseRulesConfig(houseRules, format),
      format,
      // D-033: a deck's own sleeve and playmat, else the defaults from Settings (the playmat of
      // the battle's presentation profile, chosen when the battle screen opens)
      mySleeve: my.sleeve ?? settings.defaultSleeve,
      aiSleeve: their.sleeve ?? DEFAULT_SLEEVE,
      ...(my.playmat ? { playmat: my.playmat } : {}),
    });
  };
  return (
    <div
      className="menu setup-screen"
      style={{ justifyContent: 'flex-start', paddingTop: 40 }}
      data-testid="setup-screen"
    >
      <h1 className="title" style={{ fontSize: 52 }}>
        GAME SETUP
      </h1>
      <div className="row">
        Format
        <Segmented
          ariaLabel="Format"
          value={format}
          onChange={pickFormat}
          options={[
            {
              value: 'classic',
              testId: 'format-classic',
              title: STRICT_HELP,
              label: (
                <>
                  Original Era — Strict <small className="fmt-sub">BT01–BT17 · no G cards</small>
                </>
              ),
            },
            {
              value: 'classic_ou',
              testId: 'format-classic-ou',
              title: EXPANDED_HELP,
              label: (
                <>
                  Original Era — Expanded{' '}
                  <small className="fmt-sub">+ OU cards · list v{OU_LIST.version}</small>
                </>
              ),
            },
            {
              value: 'g',
              testId: 'format-g',
              title: G_ERA_HELP,
              label: (
                <>
                  G Era <small className="fmt-sub">+ G units</small>{' '}
                  <span className="testing-tag">IN TESTING</span>
                </>
              ),
            },
          ]}
        />
        <InfoTip
          label="What the formats are"
          testId="format-help"
          text={
            <>
              <span style={{ display: 'block' }}>{STRICT_HELP}</span>
              <span style={{ display: 'block' }}>{EXPANDED_HELP}</span>
              <span style={{ display: 'block' }}>{G_ERA_HELP}</span>
            </>
          }
        />
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
        <Segmented
          ariaLabel="Opponent AI"
          value={ai}
          onChange={setAi}
          options={(['random', 'basic', 'smart'] as const).map((l) => ({
            value: l,
            label: AI_LABEL[l],
          }))}
        />
        <span style={{ marginLeft: 30 }}>Seed</span>
        <TextField
          aria-label="Seed"
          className="seed-field"
          placeholder="random"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          data-testid="seed"
        />
        <IconButton
          label="What is the seed?"
          variant={seedHelp ? 'primary' : 'default'}
          onClick={() => setSeedHelp((v) => !v)}
          data-testid="seed-help-toggle"
        >
          <HelpCircle size={18} />
        </IconButton>
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
      <HouseRulesPicker value={houseRules} onChange={setHouseRules} format={format} />
      <div className="row" style={{ marginTop: 10 }}>
        <Button size="lg" style={{ width: 300 }} onClick={onBack}>
          BACK
        </Button>
        <Button
          size="lg"
          variant="primary"
          icon={<Play size={18} />}
          style={{ width: 300 }}
          onClick={start}
          data-testid="start"
        >
          START
        </Button>
      </div>
    </div>
  );
}

function SettingsScreen({
  settings,
  onChange,
  onBack,
  onUpdates,
  onShowcase,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
  onUpdates: () => void;
  /** The UI Component Showcase (a preview of the new controls, docs/design/UI_COMPONENT_SYSTEM.md). */
  onShowcase: () => void;
}) {
  // which profile's view and playmat the rows below edit: the one this device plays with
  const { phone } = useContext(StageInfo);
  const inUse = profileFor(settings.battleLayout, phone);
  const [editing, setEditing] = useState<ProfileId>(inUse);
  const speeds: [Speed, string][] = [
    ['normal', 'Normal'],
    ['fast', 'Fast'],
    ['instant', 'Instant (no effects)'],
  ];
  const toggle = (
    label: string,
    key:
      | 'reducedMotion'
      | 'screenShake'
      | 'showArt'
      | 'foil'
      | 'stepByStep'
      | 'animatedNumbers'
      | 'cardEffects',
    hint?: string,
  ) => (
    <div className="row">
      <span style={{ width: 300 }}>
        {label}
        {hint && <div className="hint">{hint}</div>}
      </span>
      <span className="seg">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            className={settings[key] === v ? 'on' : ''}
            onClick={() => onChange({ ...settings, [key]: v })}
            data-testid={`${key}-${v ? 'on' : 'off'}`}
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
        {toggle(
          'Step-by-step battles',
          'stepByStep',
          'Shows each moment of an attack in turn: checks, triggers, damage',
        )}
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
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span style={{ width: 300 }}>
            Theme
            <div className="hint">Colours only; the game is the same</div>
          </span>
          <span className="seg" style={{ flexWrap: 'wrap', maxWidth: 820 }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-option ${settings.theme === t.id ? 'on' : ''}`}
                onClick={() => onChange({ ...settings, theme: t.id })}
                title={t.hint}
                data-testid={`theme-${t.id}`}
              >
                <span className="theme-swatches">
                  {t.swatch.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                {t.name}
              </button>
            ))}
          </span>
        </div>
        <div className="row">
          <span style={{ width: 300 }}>
            Phone text size
            <div className="hint">The phone layout&apos;s text and buttons</div>
          </span>
          <span className="seg">
            {(
              [
                ['normal', 'Normal'],
                ['large', 'Large'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                className={settings.phoneText === v ? 'on' : ''}
                onClick={() => onChange({ ...settings, phoneText: v })}
                data-testid={`phone-text-${v}`}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        <div className="row">
          <span style={{ width: 300 }}>
            Battle layout
            <div className="hint">Automatic uses Mobile on Android and small screens</div>
          </span>
          <span className="seg">
            {(
              [
                ['auto', 'Automatic'],
                ['desktop', 'Desktop'],
                ['phone', 'Mobile'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                className={settings.battleLayout === v ? 'on' : ''}
                onClick={() => onChange({ ...settings, battleLayout: v })}
                data-testid={`layout-${v}`}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        <div className="row">
          <span style={{ width: 300 }}>
            Profile settings
            <div className="hint">Battle view and playmat are kept per profile</div>
          </span>
          <span className="seg">
            {PROFILE_IDS.map((id) => (
              <button
                key={id}
                className={editing === id ? 'on' : ''}
                onClick={() => setEditing(id)}
                title={PROFILES[id].hint}
                data-testid={`profile-${id}`}
              >
                {PROFILES[id].name}
                {id === inUse ? ' (in use)' : ''}
              </button>
            ))}
          </span>
        </div>
        <div className="row">
          <span style={{ width: 300 }}>
            Battle view
            <div className="hint">
              {PROFILES[editing].name}: straight from above, or a tilted table
            </div>
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
                className={settings.profiles[editing].tableView === v ? 'on' : ''}
                onClick={() => onChange(setProfilePref(settings, editing, { tableView: v }))}
                data-testid={`view-${v}`}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        <div className="row">
          <span style={{ width: 300 }}>
            Graphics
            <div className="hint">
              {settings.graphics === 'low'
                ? 'Low: no foil or cut-ins, flat table, whatever is set above'
                : 'Lower it if the game runs slowly or the device gets hot'}
            </div>
          </span>
          <span className="seg">
            {(
              [
                ['full', 'Full'],
                ['reduced', 'Reduced'],
                ['low', 'Low'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                className={settings.graphics === v ? 'on' : ''}
                onClick={() => onChange({ ...settings, graphics: v })}
                data-testid={`graphics-${v}`}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        {toggle('Screen shake when an attack hits', 'screenShake')}
        {toggle('Reduced motion', 'reducedMotion')}
        {toggle(
          'Animated numbers',
          'animatedNumbers',
          'Power, damage and other numbers roll to their new value (off with Reduced motion)',
        )}
        {toggle(
          'Card effects',
          'cardEffects',
          'Rings and sparks when a card lands, dust when a unit is retired, a light trail on draws (off with Reduced motion or Low graphics)',
        )}
        {toggle('Show card art', 'showArt')}
        {toggle('Foil effect on rare cards', 'foil')}
        <AudioSettings settings={settings} onChange={onChange} />
        {!IS_ANDROID && <ControllerSettings settings={settings} onChange={onChange} />}
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
          <span style={{ width: 300 }}>
            Playmat
            <div className="hint">For the {PROFILES[editing].name} profile</div>
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PlaymatPreview
              id={settings.profiles[editing].playmat}
              animated={settings.profiles[editing].animatedBackground && !settings.reducedMotion}
            />
            <PlaymatPicker
              value={settings.profiles[editing].playmat}
              onChange={(id) => onChange(setProfilePref(settings, editing, { playmat: id }))}
            />
          </div>
        </div>
        {/* the phone layout (Mobile) never draws the moving layer (it broke Android's drawing,
            2026-11-11): the switch is for the Desktop profile only */}
        {editing === 'desktop' && (
          <div className="row">
            <span style={{ width: 300 }}>
              Animated background
              <div className="hint">
                Desktop: themed playmats move gently (never with Reduced motion or Low graphics; not
                on the phone layout)
              </div>
            </span>
            <span className="seg">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  className={settings.profiles[editing].animatedBackground === v ? 'on' : ''}
                  onClick={() =>
                    onChange(setProfilePref(settings, editing, { animatedBackground: v }))
                  }
                  data-testid={`anim-bg-${v ? 'on' : 'off'}`}
                >
                  {v ? 'On' : 'Off'}
                </button>
              ))}
            </span>
          </div>
        )}
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span style={{ width: 300 }}>
            App icon
            <div className="hint">The icon the game shows outside the game</div>
          </span>
          <AppIconPicker
            value={settings.appIcon}
            onChange={(id) => onChange({ ...settings, appIcon: id })}
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
        {CAN.updateInPlace && (
          <div className="row">
            <span style={{ width: 300 }}>
              Updates
              <div className="hint">Installed version, newest release, release notes</div>
            </span>
            <button className="btn" onClick={onUpdates} data-testid="open-updates">
              Open Update Manager
            </button>
          </div>
        )}
        {IS_ANDROID && !CAN.updateInPlace && <PhoneUpdatesRow />}
        <div className="row">
          <span style={{ width: 300 }}>
            UI Showcase (preview)
            <div className="hint">The new buttons, dropdowns and switches, for review</div>
          </span>
          <button className="btn" onClick={onShowcase} data-testid="open-showcase">
            Open showcase
          </button>
        </div>
      </div>
      <button
        className="menu-btn"
        style={{ width: 300 }}
        onClick={onBack}
        data-testid="settings-back"
        data-nav-back
      >
        BACK
      </button>
    </div>
  );
}

/** Settings → Updates on Android: the newest release from GitHub, installed over this copy. */
function PhoneUpdatesRow() {
  const [open, setOpen] = useState(false);
  return (
    <div className="row" data-testid="phone-updates-row">
      <span style={{ width: 300 }}>
        Updates
        <div className="hint">Download the newest version and install it over this one</div>
      </span>
      <button className="btn" onClick={() => setOpen(true)} data-testid="phone-updates-open">
        Check for updates
      </button>
      {open && <PhoneUpdates onClose={() => setOpen(false)} />}
    </div>
  );
}

/**
 * How many cards have art: on Windows with the way to the Artwork Manager; on Android, the cards
 * found in the app's folder on the phone (counted when Settings opens) and how to copy them there.
 */
function ArtworkStatus() {
  const desktop = window.vanguardDesktop;
  const [status, setStatus] = useState<{ installed: number; expected: number } | null>(null);
  const [onPhone, setOnPhone] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  // counted again after a download
  const [recount, setRecount] = useState(0);
  useEffect(() => {
    void desktop?.artworkStatus().then(setStatus);
  }, [desktop]);
  useEffect(() => {
    if (!IS_ANDROID || desktop) return;
    let live = true;
    void phoneCardCount().then((n) => live && setOnPhone(n ?? 0));
    return () => {
      live = false;
    };
  }, [desktop, recount]);
  if (IS_ANDROID && !desktop)
    return (
      <div className="row" data-testid="artwork-status">
        <span style={{ width: 300 }}>
          Card artwork
          <div className="hint">From the official card list, to this phone only</div>
        </span>
        <span data-testid="phone-art-count" style={{ width: 260 }}>
          {onPhone === null ? '…' : `${onPhone} cards found on this phone`}
        </span>
        <button className="btn" onClick={() => setDownloading(true)} data-testid="phone-art-open">
          Download card art
        </button>
        {downloading && (
          <PhoneArtDownload
            onClose={(changed) => {
              setDownloading(false);
              if (changed) setRecount((n) => n + 1);
            }}
          />
        )}
      </div>
    );
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
