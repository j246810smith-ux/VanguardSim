# Building the Android app

Plan and background: [ANDROID_AUDIT_AND_PLAN.md](ANDROID_AUDIT_AND_PLAN.md). The Android app is the
same renderer and engine as Windows, wrapped by Capacitor. The Windows build is unchanged.

## One-time setup

1. Install **Android Studio** (`winget install Google.AndroidStudio`).
2. Install **JDK 21**. Capacitor 8 builds with Gradle 8.14.3, which cannot run on Java 25, and
   Android Studio 2026.2 bundles Java 25. Download the Temurin 21 portable zip from adoptium.net and
   unpack it into `%LOCALAPPDATA%\Programs\` (it makes a `jdk-21.…` folder). The build script uses it
   first; set `JAVA_HOME` to use another JDK 21.
3. Install the SDK packages into `%LOCALAPPDATA%\Android\Sdk` with the new `android` tool
   (`cmdline-tools\latest\bin\android.exe`; `sdkmanager` is deprecated):

   ```powershell
   android sdk install platforms/android-36 build-tools/36.0.0
   ```

   Platform-tools (adb) are needed too.
4. Phone: Settings → About phone → tap **Build number** 7 times → Developer options → **USB
   debugging** on. Connect it by USB and allow the PC when the phone asks. `adb devices` lists it.

### Phone over Wi-Fi

Developer options → **Wireless debugging** on, then **Pair device with pairing code**. On the PC:

```powershell
adb pair <ip>:<pairing port> <code>   # the address and code the phone shows for pairing
adb connect <ip>:<port>               # the address on the Wireless debugging screen
```

The ports differ: pairing uses the one in the pairing box, connecting uses the main one. A phone on
Wi-Fi can be listed twice in `adb devices`; the scripts use the first, or the one in `ANDROID_SERIAL`.

## Build

```powershell
npm run dist:android               # debug APK in release\android\
npm run dist:android -- --install  # build, then install on the connected phone
```

The script finds JDK 21 and the SDK by itself; set `JAVA_HOME` / `ANDROID_HOME` to use others.
Output: `release/android/VanguardSim-<version>-android-debug.apk`. The Windows build writes
`release/VanguardSim-<version>-win-x64.zip` and the portable exe; the two never overlap.

## Card art on the phone

Art is never part of the app (D-018, D-025). Copy the pictures you already have on this PC:

```powershell
npm run artwork:phone                           # copy all card art, sleeves and playmats
npm run artwork:phone -- --dry-run              # show what would be copied, copy nothing
npm run artwork:phone -- --only BT01,sleeves    # copy only these folders (a retry)
```

Install the app first. The pictures come from the installed Windows game's `cards\`, `sleeves\` and
`playmats\` folders, or from the repo's `assets/` when the game is not installed. They go to the
app's own folder on the phone, `Android/data/io.github.j246810smith_ux.vanguardsim/files/`, which
the app reads without any permission. Uninstalling the app removes them.

It copies one card set at a time. If one fails, the script prints the `--only` command that copies
just that set again. The whole collection is about 1.4 GB, so the first copy takes a while (faster
by USB than Wi-Fi). Settings → Card artwork on the phone shows how many cards it found.

## What is where

| Path | What |
| --- | --- |
| `capacitor.config.ts` | app id `io.github.j246810smith_ux.vanguardsim` (never change it), name, web folder |
| `android/` | the Android Studio project (Capacitor's, plus our manifest changes) |
| `app/renderer/platform.ts` | `IS_ANDROID` and `CAN`: what the Android build switches off |
| `app/renderer/android/` | native plugins (`native.ts`), back button (`back.ts`), art on the phone (`phoneArt.ts`) |
| `scripts/build-android.mjs` | `npm run dist:android` |
| `scripts/artwork-phone.mjs` | `npm run artwork:phone` |

## Debugging on the phone

With the phone connected and the debug app open, open `chrome://inspect` in Chrome or Edge on the
PC: the game's page shows up there, with its console, profiler and memory tools.
