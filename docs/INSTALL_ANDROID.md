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

Download the newer APK the same way and install it over the old one: **your decks and settings
are kept**. The phone app doesn't update itself (only the Windows version does).

## Card art (optional)

Like the Windows download, the app has no card pictures; it is fully playable with the plain card
frames. If you have the Windows game with its art, copy the pictures to the phone with a USB cable:

1. Install and open the app once.
2. Connect the phone to the PC by USB and, on the phone, choose **File transfer** in the USB
   notification.
3. On the PC, open the phone in File Explorer: **Internal storage → Android → data →
   io.github.j246810smith_ux.vanguardsim → files**.
4. Copy the Windows game's `cards` folder (next to `Vanguard Sim.exe`) into that `files` folder,
   and its `sleeves` and `playmats` folders if you have them. The whole collection is about 1.4 GB.
5. Restart the app. **Settings → Card artwork on the phone** shows how many cards it found.

If the `Android/data` folder doesn't show up on the PC, the developer route works instead:
`npm run artwork:phone` from the source code with the phone connected by adb
([BUILDING_ANDROID.md](android/BUILDING_ANDROID.md)). Card images are © Bushiroad and for your
personal use only.

## Uninstall

Hold the app icon → **Uninstall**. This also deletes your saved decks and any card art copied to
the phone.

## What the phone version doesn't have yet

- **Play Online** is Windows-only for now.
- **The Artwork Manager** (downloading card art) is Windows-only: copy the art as above.
- **Updating from inside the game** is Windows-only: install new APKs by hand.
