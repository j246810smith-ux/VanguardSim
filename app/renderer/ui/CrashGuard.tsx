import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  readonly error: Error | null;
  readonly tries: number;
}

/**
 * Catches a display error anywhere below it so the window never goes blank (2026-11-03: an
 * online guest's screen went blank mid-game). "Keep playing" draws the screen again: the game
 * itself lives outside React (GameSession / the online connection), so it carries on. "Main
 * menu" reloads the window.
 */
export class CrashGuard extends Component<{ readonly children: ReactNode }, State> {
  override state: State = { error: null, tries: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Display error:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error, tries } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash-guard" data-testid="crash-guard" role="alert">
        <h2>Something went wrong on screen</h2>
        <p>
          The game is still running. Press <b>Keep playing</b> to draw the screen again. If this
          keeps happening, please report it with the text below.
        </p>
        <pre>{String(error.message || error)}</pre>
        <div className="crash-actions">
          <button
            type="button"
            data-testid="crash-retry"
            onClick={() => this.setState({ error: null, tries: tries + 1 })}
          >
            Keep playing
          </button>
          <button type="button" data-testid="crash-menu" onClick={() => window.location.reload()}>
            Main menu
          </button>
        </div>
      </div>
    );
  }
}
