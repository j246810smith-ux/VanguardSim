/**
 * The Android app's native plugins (docs/android/ANDROID_AUDIT_AND_PLAN.md), reached the way
 * Capacitor exposes them at run time: window.Capacitor.Plugins. The renderer never imports the
 * @capacitor packages, so the Windows build and the tests carry none of them. Every accessor gives
 * null on Windows, in tests, or when a plugin is missing, and callers fall back to what Windows does.
 */

export interface PluginListener {
  remove(): Promise<void> | void;
}

export interface AppPlugin {
  addListener(
    event: 'backButton',
    listener: (e: { canGoBack: boolean }) => void,
  ): Promise<PluginListener> | PluginListener;
  exitApp(): Promise<void> | void;
}

export interface FilesystemPlugin {
  writeFile(options: {
    path: string;
    data: string;
    directory: 'CACHE';
    encoding: 'utf8';
  }): Promise<{ uri: string }>;
  getUri(options: { directory: 'EXTERNAL'; path: string }): Promise<{ uri: string }>;
  readdir(options: {
    directory: 'EXTERNAL';
    path: string;
  }): Promise<{ files: readonly { name: string; type?: 'file' | 'directory' }[] }>;
}

export interface SharePlugin {
  share(options: { title?: string; text?: string; url?: string }): Promise<unknown>;
}

/** The app's own plugin (AppIconPlugin.java): which launcher icon is shown. */
export interface AppIconNativePlugin {
  set(options: { id: string }): Promise<{ id: string }>;
  get(): Promise<{ id: string }>;
}

interface Plugins {
  readonly AppIcon?: AppIconNativePlugin;
  readonly App?: AppPlugin;
  readonly Filesystem?: FilesystemPlugin;
  readonly Share?: SharePlugin;
}

interface CapacitorGlobal {
  readonly Plugins?: Plugins;
  /** A file:// address made loadable by the WebView (an <img> src). */
  readonly convertFileSrc?: (uri: string) => string;
}

const capacitor = (): CapacitorGlobal | null =>
  (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
const plugins = (): Plugins | null => capacitor()?.Plugins ?? null;

export const nativeApp = (): AppPlugin | null => plugins()?.App ?? null;

export const nativeAppIcon = (): AppIconNativePlugin | null => plugins()?.AppIcon ?? null;

/** Reading the app's own folder on the phone (the pictures copied by `npm run artwork:phone`). */
export const nativeFilesystem = (): FilesystemPlugin | null => plugins()?.Filesystem ?? null;

/**
 * The app's own folder on the phone (Android/data/<app id>/files), as the base for picture
 * addresses: set once at start by `resolveArtFolder`; null until then, on Windows and in tests.
 */
let artBase: string | null = null;
let convert: ((uri: string) => string) | null = null;

/** Called once at start on Android. Before it finishes, pictures use their usual addresses. */
export async function resolveArtFolder(): Promise<void> {
  const fs = nativeFilesystem();
  const toSrc = capacitor()?.convertFileSrc;
  if (!fs || !toSrc) return;
  try {
    const { uri } = await fs.getUri({ directory: 'EXTERNAL', path: '' });
    artBase = uri.replace(/\/+$/, '');
    convert = toSrc;
  } catch {
    // no folder: the cards show their fallback faces, as without art on Windows
  }
}

/** `cards/BT01/BT01-001.png` → the WebView address of that file in the app folder; else null. */
export function phoneFileUrl(path: string): string | null {
  return artBase !== null && convert ? convert(`${artBase}/${path}`) : null;
}

/** For tests: forget the resolved folder. */
export function resetArtFolder(): void {
  artBase = null;
  convert = null;
}

/** Writing a file and handing it to Android's share sheet, when both plugins are there. */
export function nativeFiles(): { fs: FilesystemPlugin; share: SharePlugin } | null {
  const p = plugins();
  return p?.Filesystem && p.Share ? { fs: p.Filesystem, share: p.Share } : null;
}
