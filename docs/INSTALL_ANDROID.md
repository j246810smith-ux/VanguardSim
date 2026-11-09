# Installing Vanguard Sim on an Android phone

Vanguard Sim for Android is an APK file on the GitHub Releases page. It is not on the Google Play
Store, so Android asks you to allow the install once. Landscape only. Android 7 or newer; tested on
a Pixel 10 (Android 17).

## Install

1. On the phone, open the
   [Releases page](https://github.com/j246810smith-ux/VanguardSim/releases) in Chrome.
2. Under **Assets** of the newest release, tap **`VanguardSim-<version>-android.apk`**. Chrome may
   say the file can be harmful: tap **Download anyway**.
3. When the download finishes, tap **Open** (or open it from the Files app → Downloads).
4. The first time, Android says Chrome isn't allowed to install apps: tap **Settings**, turn on
   **Allow from this source**, then go back.
5. Tap **Install**. If Google Play Protect warns about an unknown developer, tap **More details →
   Install anyway** (the app is a fan project and not on the Play Store, so Google doesn't know it).
6. Tap **Open**. The game starts on the home screen. Turn the phone sideways.

You can switch off **Allow from this source** for Chrome again afterwards.

## Update to a newer version

From version 0.35: **Settings → Updates → Check for updates**, then **Download and install**.
The first time, Android asks you to allow Vanguard Sim to install apps: tap **Allow installs**, turn
on **Allow from this source**, go back and tap **Install**. Then tap **Update** in Android's
installer. **Your decks, settings and card art are kept.**

Older versions: download the newer APK the same way as the first install and install it over the
old one.

## Card art (optional)

Like the Windows download, the app has no card pictures; it is fully playable with the plain card
frames. To get them (from version 0.34):

1. Open **Settings → Card artwork → Download card art**.
2. Choose **All cards**, **Original Era** or **G era**, and tap **Download**. The pictures come from
   the official Cardfight!! Vanguard card list straight to this phone.
3. Use Wi-Fi (all cards are up to about 1.4 GB) and keep the game open. Tap **Cancel** any time;
   **Download** again carries on where it stopped, skipping cards already on the phone.

Card images are © Bushiroad and for your personal use only; please don't share or upload them.

**From a PC instead:** if you have the Windows game with its art, connect the phone by USB, choose
**File transfer**, and copy the game's `cards` folder (and `sleeves`, `playmats`) into **Internal
storage → Android → data → io.github.j246810smith_ux.vanguardsim → files**. Developers can use
`npm run artwork:phone` ([BUILDING_ANDROID.md](android/BUILDING_ANDROID.md)).

## Uninstall

Hold the app icon → **Uninstall**. This also deletes your saved decks and any card art copied to
the phone.

## What the phone version doesn't have yet

- **Play Online** works by **room code** only (from version 0.35): phone against phone or PC.
  Connecting by address is Windows-only.
- **The Artwork Manager's** import, export and report are Windows-only; the phone has Download.
