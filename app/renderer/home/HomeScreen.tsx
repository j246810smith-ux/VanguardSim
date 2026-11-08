/**
 * The home screen (docs/design/HOME_SCREEN_PLAN.md): the player's profile, the holographic field
 * with a fighter at each side, START BATTLE (which opens the game modes, never a match straight
 * away) and Decks / Card Database / Settings. Presentation only: every button calls one of the
 * screens App.tsx already had, and the button sounds come from App.tsx's one click listener.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useBackHandler } from '../android/back';
import { Avatar, avatarLabel } from './Avatars';
import { HolographicBattlefield } from './Battlefield';
import { SideCharacter } from './Characters';
import { homeArtUrl } from './art';
import { AVATARS, loadProfile, MAX_NAME, saveProfile, type Profile } from './profile';
import './home.css';

export interface HomeActions {
  readonly newGame: () => void;
  readonly demo: () => void;
  /** null: this build has no online play (Android) */
  readonly online: (() => void) | null;
  readonly onlineReady: boolean;
  readonly decks: () => void;
  readonly cards: () => void;
  readonly settings: () => void;
  /** null where there is no Update Manager (Android) */
  readonly updates: (() => void) | null;
  readonly feedback: (() => void) | null;
  readonly quit: (() => void) | null;
}

const SKYLINE = homeArtUrl('skyline');

/** A few slow sparks; fixed positions so nothing is random between renders. */
const SPARKS = [
  [6, 0],
  [14, 3.2],
  [22, 1.4],
  [31, 5.1],
  [38, 2.3],
  [46, 6.4],
  [55, 0.8],
  [62, 4.4],
  [69, 2.9],
  [77, 5.8],
  [84, 1.9],
  [92, 3.7],
  [10, 7.2],
  [50, 7.9],
  [88, 6.9],
  [27, 8.4],
] as const;

function useHiddenPause(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return hidden;
}

function Icon({ name }: { name: 'decks' | 'book' | 'gear' | 'menu' | 'swords' | 'back' }) {
  const common = {
    width: 44,
    height: 44,
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 3,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'decks':
      return (
        <svg {...common}>
          <rect x="8" y="10" width="20" height="28" rx="3" transform="rotate(-10 18 24)" />
          <rect x="20" y="10" width="20" height="28" rx="3" transform="rotate(8 30 24)" />
        </svg>
      );
    case 'book':
      return (
        <svg {...common}>
          <path d="M24 12 C18 8 10 8 6 10 L6 38 C10 36 18 36 24 40 C30 36 38 36 42 38 L42 10 C38 8 30 8 24 12 Z" />
          <path d="M24 12 L24 40" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="6" />
          <path d="M24 5 L27 11 L33 9 L34 15 L40 17 L37 22 L42 26 L37 29 L39 35 L33 35 L31 41 L26 38 L22 42 L19 37 L13 39 L13 33 L7 31 L11 26 L6 22 L11 19 L10 13 L16 13 L18 7 L22 10 Z" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...common}>
          <path d="M10 14 L38 14 M10 24 L38 24 M10 34 L38 34" />
        </svg>
      );
    case 'swords':
      return (
        <svg {...common} width={56} height={56}>
          <path d="M10 8 L30 28 M38 8 L18 28" />
          <path d="M24 34 L14 24 M24 34 L34 24" />
          <path d="M12 32 L6 38 L10 42 L16 36 M36 32 L42 38 L38 42 L32 36" />
        </svg>
      );
    case 'back':
      return (
        <svg {...common} width={32} height={32}>
          <path d="M28 10 L14 24 L28 38" />
        </svg>
      );
  }
}

function ProfileEditor({ profile, onClose }: { profile: Profile; onClose: (p?: Profile) => void }) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  return (
    <div className="modal-backdrop" onClick={() => onClose()}>
      <div
        className="modal home-profile-editor"
        onClick={(e) => e.stopPropagation()}
        data-testid="profile-editor"
      >
        <h2>Your profile</h2>
        <div className="hint">
          Kept on this device only. The name is also the one Play Online shows your opponent.
        </div>
        <label className="home-profile-name">
          Name
          <input
            className="text"
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            data-testid="profile-name-input"
          />
        </label>
        <div className="home-avatar-grid">
          {AVATARS.map((id) => (
            <button
              key={id}
              className={`home-avatar-choice ${id === avatar ? 'on' : ''}`}
              onClick={() => setAvatar(id)}
              title={avatarLabel(id)}
              data-testid={`avatar-${id}`}
            >
              <Avatar id={id} size={84} />
            </button>
          ))}
        </div>
        <div className="buttons">
          <button className="btn" onClick={() => onClose()}>
            Cancel
          </button>
          <button
            className="btn gold"
            onClick={() => onClose(saveProfile({ name, avatar }))}
            data-testid="profile-save"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function HomeScreen({ actions, children }: { actions: HomeActions; children?: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [modes, setModes] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const hidden = useHiddenPause();

  // Android back closes what is open on the home screen first
  useBackHandler(() => {
    if (editing) return (setEditing(false), true);
    if (menu) return (setMenu(false), true);
    if (modes) return (setModes(false), true);
    return false;
  });

  const menuItems: { label: string; run: () => void; id: string }[] = [
    ...(actions.updates ? [{ label: 'Updates', run: actions.updates, id: 'menu-updates' }] : []),
    ...(actions.feedback
      ? [
          {
            label: 'Report a Problem / Suggest Something',
            run: actions.feedback,
            id: 'feedback-menu',
          },
        ]
      : []),
    ...(actions.quit ? [{ label: 'Quit', run: actions.quit, id: 'menu-quit' }] : []),
  ];

  return (
    <div className={`home ${hidden ? 'paused' : ''}`} data-testid="home">
      <div className="home-bg" aria-hidden>
        <div className="home-glow blue" />
        <div className="home-glow red" />
        {SKYLINE && <img className="home-skyline" src={SKYLINE} alt="" draggable={false} />}
        <div className="home-floor" />
        <div className="home-sparks">
          {SPARKS.map(([left, delay], i) => (
            <span
              key={i}
              className={i % 2 ? 'red' : 'blue'}
              style={{ left: `${left}%`, animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      </div>

      <SideCharacter side="player" />
      <SideCharacter side="rival" />

      <header className="home-logo">
        <div className="home-logo-main">CARDFIGHT SIM</div>
        <div className="home-logo-sub">CLASSIC &amp; G ERA</div>
      </header>

      <HolographicBattlefield />

      <button
        className="home-profile"
        onClick={() => setEditing(true)}
        data-testid="home-profile"
        title="Your profile"
      >
        <Avatar id={profile.avatar} size={104} />
        <span className="home-profile-plate">
          <span className="home-profile-label">FIGHTER</span>
          <span className="home-profile-name-text" data-testid="profile-name">
            {profile.name}
          </span>
        </span>
      </button>

      {menuItems.length > 0 && (
        <div className="home-utility">
          <button
            className={`home-hex-btn ${menu ? 'on' : ''}`}
            onClick={() => setMenu(!menu)}
            title="Menu"
            aria-label="Menu"
            aria-expanded={menu}
            data-testid="home-menu"
          >
            <Icon name="menu" />
          </button>
          {menu && (
            <div className="home-menu" role="menu">
              {menuItems.map((m) => (
                <button
                  key={m.id}
                  role="menuitem"
                  className="home-menu-item"
                  onClick={() => {
                    setMenu(false);
                    m.run();
                  }}
                  data-testid={m.id}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!modes && (
        <button className="home-start" onClick={() => setModes(true)} data-testid="start-battle">
          <span className="home-start-emblem">
            <Icon name="swords" />
          </span>
          <span className="home-start-text">START BATTLE</span>
        </button>
      )}

      {modes && (
        <div className="home-modes" data-testid="mode-select">
          <div className="home-modes-title">CHOOSE A BATTLE</div>
          <div className="home-modes-row">
            <button className="home-mode blue" onClick={actions.newGame} data-testid="new-game">
              <b>NEW GAME</b>
              <small>Your deck against the CPU</small>
            </button>
            {actions.online && (
              <button
                className="home-mode red"
                onClick={actions.online}
                disabled={!actions.onlineReady}
                title={actions.onlineReady ? undefined : 'Online play is not ready yet'}
                data-testid="play-online"
              >
                <b>PLAY ONLINE</b>
                <small>
                  {actions.onlineReady ? 'Against a friend · in testing' : 'Coming soon'}
                </small>
              </button>
            )}
            <button className="home-mode gold" onClick={actions.demo} data-testid="cpu-demo">
              <b>CPU DEMONSTRATION</b>
              <small>Watch two decks play</small>
            </button>
          </div>
          <button
            className="home-modes-back"
            onClick={() => setModes(false)}
            data-testid="modes-back"
          >
            <Icon name="back" /> Back
          </button>
        </div>
      )}

      <nav className="home-nav">
        <button className="home-nav-btn" onClick={actions.decks} data-testid="deck-builder">
          <Icon name="decks" />
          <span>DECKS</span>
        </button>
        <button className="home-nav-btn" onClick={actions.cards} data-testid="card-db">
          <Icon name="book" />
          <span>
            CARD
            <br />
            DATABASE
          </span>
        </button>
        <button className="home-nav-btn" onClick={actions.settings} data-testid="settings">
          <Icon name="gear" />
          <span>SETTINGS</span>
        </button>
      </nav>

      <div className="home-legal">
        Unofficial fan project, not affiliated with Bushiroad. Cardfight!! Vanguard © Bushiroad.
      </div>

      {children}

      {editing && (
        <ProfileEditor
          profile={profile}
          onClose={(p) => {
            if (p) setProfile(p);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
