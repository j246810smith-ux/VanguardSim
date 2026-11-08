/**
 * Settings → App icon (icon pack, 2026-11-08): previews, names, the chosen one marked, and
 * Restore default. What changes depends on the platform (appIconNative.ts).
 */
import { useState } from 'react';
import { APP_ICONS, DEFAULT_APP_ICON } from '../appIcons';
import { appIconNote, canMakeShortcut, makeDesktopShortcut } from '../appIconNative';

export function AppIconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [shortcut, setShortcut] = useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="cosmetic-row" data-testid="app-icon-picker" role="radiogroup">
        {APP_ICONS.map((icon) => (
          <button
            key={icon.id}
            className={`cosmetic-option app-icon-option ${icon.id === value ? 'on' : ''}`}
            onClick={() => onChange(icon.id)}
            title={icon.name}
            role="radio"
            aria-checked={icon.id === value}
            data-testid={`app-icon-${icon.id}`}
          >
            <img src={icon.preview} alt="" width={72} height={72} />
            <span className="cosmetic-name">
              {icon.id === value ? '✓ ' : ''}
              {icon.name}
            </span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn"
          disabled={value === DEFAULT_APP_ICON}
          onClick={() => onChange(DEFAULT_APP_ICON)}
          data-testid="app-icon-default"
        >
          Restore Default
        </button>
        {canMakeShortcut() && (
          <button
            className="btn"
            onClick={() =>
              void makeDesktopShortcut(value).then((ok) =>
                setShortcut(
                  ok
                    ? 'Desktop shortcut made with this icon.'
                    : 'Could not make the desktop shortcut.',
                ),
              )
            }
            data-testid="app-icon-shortcut"
          >
            Desktop Shortcut With This Icon
          </button>
        )}
      </div>
      <div className="hint">{shortcut ?? appIconNote()}</div>
    </div>
  );
}
