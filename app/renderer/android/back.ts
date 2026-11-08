/**
 * Android's back button (U6). Screens that have something to close or protect register a handler
 * with useBackHandler; the newest one is asked first, and returns true when it dealt with the
 * press. When none does, App.tsx's fallback runs: back to the main menu, or on the main menu,
 * leave the app. On Windows there is no back button, so none of this ever runs.
 */
import { useEffect, useRef } from 'react';
import type { AppPlugin, PluginListener } from './native';

type Handler = () => boolean;
const handlers: { current: Handler }[] = [];

/** Ask the registered handlers, newest first; true when one dealt with the press. */
export function handleBack(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i]!.current()) return true;
  return false;
}

/** Register `handler` while the component is shown; it always sees the latest props and state. */
export function useBackHandler(handler: Handler): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    handlers.push(ref);
    return () => {
      const i = handlers.lastIndexOf(ref);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, []);
}

/**
 * Listen to the back button: the screens' handlers first, then `fallback`. Returns a function that
 * stops listening. `app` null (Windows, tests): nothing to listen to.
 */
export function listenForBack(app: AppPlugin | null, fallback: () => void): () => void {
  if (!app) return () => undefined;
  let listener: PluginListener | null = null;
  let stopped = false;
  void Promise.resolve(
    app.addListener('backButton', () => {
      if (!handleBack()) fallback();
    }),
  ).then((l) => {
    if (stopped) void l.remove();
    else listener = l;
  });
  return () => {
    stopped = true;
    void listener?.remove();
  };
}
