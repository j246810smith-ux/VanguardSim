"""Builds the selectable app icons (feedback 2026-11-08, icon pack) from the 1024x1024 masters.

Usage: python tools/icons/make_icons.py <folder with 01_classic.png ... 05_cfs.png> [android res dir]

Writes:
  tools/icons/masters/<id>.png          the masters, kept in the repository
  app/main/icons/<id>.ico               Windows window, taskbar and shortcut icons (16-256 px)
  app/renderer/icons/<id>.png           192 px previews for Settings -> App icon
  <android res>/mipmap-*/ic_launcher_<id>.png and _round.png, when an Android res dir is given

The catalogue itself (ids and names) is app/renderer/appIcons.ts; keep the ids here in step.
"""

import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ICONS = {
    "classic": "01_classic.png",
    "blaster_blade": "02_blaster_blade.png",
    "overdress": "03_overdress.png",
    "g_era": "04_g_era.png",
    "cfs": "05_cfs.png",
}
ROOT = Path(__file__).resolve().parents[2]
ANDROID_SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def round_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def main() -> None:
    src = Path(sys.argv[1])
    android = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    masters = ROOT / "tools/icons/masters"
    ico_dir = ROOT / "app/main/icons"
    preview_dir = ROOT / "app/renderer/icons"
    for d in (masters, ico_dir, preview_dir):
        d.mkdir(parents=True, exist_ok=True)
    for icon_id, name in ICONS.items():
        master = masters / f"{icon_id}.png"
        if (src / name).exists():
            shutil.copyfile(src / name, master)
        img = Image.open(master).convert("RGBA")
        img.save(
            ico_dir / f"{icon_id}.ico",
            sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
        )
        img.resize((192, 192), Image.LANCZOS).save(preview_dir / f"{icon_id}.png", optimize=True)
        if android:
            for density, size in ANDROID_SIZES.items():
                out = android / f"mipmap-{density}"
                out.mkdir(parents=True, exist_ok=True)
                square = img.resize((size, size), Image.LANCZOS)
                square.save(out / f"ic_launcher_{icon_id}.png", optimize=True)
                rnd = Image.new("RGBA", (size, size), (0, 0, 0, 0))
                rnd.paste(square, (0, 0), round_mask(size))
                rnd.save(out / f"ic_launcher_{icon_id}_round.png", optimize=True)
                # adaptive icon foreground (Android 8+): 108 dp canvas, of which the launcher
                # shows the middle 72 dp; the picture fills about that, corners may be masked
                canvas = size * 108 // 48
                fg = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
                art = int(canvas * 0.70)
                fg.paste(img.resize((art, art), Image.LANCZOS), ((canvas - art) // 2,) * 2)
                fg.save(out / f"ic_launcher_{icon_id}_foreground.png", optimize=True)
            anydpi = android / "mipmap-anydpi-v26"
            anydpi.mkdir(parents=True, exist_ok=True)
            xml = "\n".join(
                [
                    '<?xml version="1.0" encoding="utf-8"?>',
                    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
                    '    <background android:drawable="@color/ic_launcher_icon_background"/>',
                    f'    <foreground android:drawable="@mipmap/ic_launcher_{icon_id}_foreground"/>',
                    "</adaptive-icon>",
                    "",
                ]
            )
            for suffix in ("", "_round"):
                (anydpi / f"ic_launcher_{icon_id}{suffix}.xml").write_text(xml, encoding="utf-8")
    print("icons written")


if __name__ == "__main__":
    main()
