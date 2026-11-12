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
  /** Text with `encoding: 'utf8'`; without an encoding, `data` is base64 (a picture). */
  writeFile(options: {
    path: string;
    data: string;
    directory: 'CACHE' | 'EXTERNAL';
    encoding?: 'utf8';
    recursive?: boolean;
  }): Promise<{ uri: string }>;
  rename(options: {
    from: string;
    to: string;
    directory: 'EXTERNAL';
    toDirectory: 'EXTERNAL';
  }): Promise<void>;
  deleteFile(options: { path: string; directory: 'EXTERNAL' }): Promise<void>;
  getUri(options: { directory: 'EXTERNAL'; path: string }): Promise<{ uri: string }>;
  readdir(options: {
    directory: 'EXTERNAL';
    path: string;
  }): Promise<{
    files: readonly { name: string; type?: 'file' | 'directory'; size?: number }[];
  }>;
}

export interface SharePlugin {
  share(options: { title?: string; text?: string; url?: string }): Promise<unknown>;
}

/** The app's own plugin (AppIconPlugin.java): which launcher icon is shown. */
export interface AppIconNativePlugin {
  set(options: { id: string }): Promise<{ id: string }>;
  get(): Promise<{ id: string }>;
}

/**
 * Capacitor's own HTTP plugin (part of @capacitor/core, registered natively whether or not it
 * replaces fetch): requests made by Android itself, so a website's CORS rules don't apply. Used
 * only by the card art download (android/artDownload.ts). `responseType: 'blob'` gives base64.
 */
interface HttpOptions {
  url: string;
  method: 'GET';
  headers?: Record<string, string>;
  connectTimeout?: number;
  readTimeout?: number;
  disableRedirects?: boolean;
}
export interface HttpPlugin {
  request(
    options: HttpOptions & { responseType: 'blob' },
  ): Promise<{ status: number; data: string; headers: Record<string, string> }>;
  /** A JSON answer is parsed by Capacitor: `data` is the value (still to be checked). */
  request(
    options: HttpOptions & { responseType: 'json' },
  ): Promise<{ status: number; data: unknown; headers: Record<string, string> }>;
}

/** The app's own plugin (ApkUpdatePlugin.java): download a release APK and open the installer. */
export interface ApkUpdatePlugin {
  download(options: { url: string; sha256?: string }): Promise<{ version: string; bytes: number }>;
  install(): Promise<void>;
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  addListener(
    event: 'progress',
    listener: (p: { done: number; total: number }) => void,
  ): Promise<PluginListener> | PluginListener;
}

interface Plugins {
  readonly ApkUpdate?: ApkUpdatePlugin;
  readonly CapacitorHttp?: HttpPlugin;
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

export const nativeApkUpdate = (): ApkUpdatePlugin | null => plugins()?.ApkUpdate ?? null;

export const nativeHttp = (): HttpPlugin | null => plugins()?.CapacitorHttp ?? null;

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
