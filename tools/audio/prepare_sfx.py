"""Prepare the game's sound effects from Kenney's CC0 packs (docs/audio/AUDIO_PLAN.md).

Usage:  python tools/audio/prepare_sfx.py <folder with the unzipped packs>

The folder holds one sub-folder per pack, as downloaded from kenney.nl and unzipped:
  casino-audio/  sci-fi-sounds/  impact-sounds/  interface-sounds/  music-jingles/
Each picked file is trimmed (with a short fade), made mono 44.1 kHz, peak-normalised to -3 dB
and written as Ogg Vorbis to app/renderer/assets/audio/sfx/<group>/<name>_<nn>.ogg. The manifest
app/renderer/assets/audio/manifest/audio_assets.json records the source, author, licence and
changes of every file. Needs ffmpeg on PATH.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'app/renderer/assets/audio/sfx'
MANIFEST = ROOT / 'app/renderer/assets/audio/manifest/audio_assets.json'

PACKS = {
    'casino-audio': ('Casino Audio (1.1)', 'https://kenney.nl/assets/casino-audio'),
    'sci-fi-sounds': ('Sci-Fi Sounds (1.0)', 'https://kenney.nl/assets/sci-fi-sounds'),
    'impact-sounds': ('Impact Sounds (1.0)', 'https://kenney.nl/assets/impact-sounds'),
    'interface-sounds': ('Interface Sounds (1.0)', 'https://kenney.nl/assets/interface-sounds'),
    'music-jingles': ('Music Jingles', 'https://kenney.nl/assets/music-jingles'),
}

# (group, output name, pack, source file names, longest length in seconds or None)
PICKS = [
    ('card', 'slide', 'casino-audio', [f'card-slide-{i}.ogg' for i in range(1, 9)], 0.45),
    ('card', 'place', 'casino-audio', ['card-place-1.ogg', 'card-place-2.ogg', 'card-place-4.ogg'], 0.45),
    ('card', 'place_heavy', 'casino-audio', ['card-place-3.ogg'], 0.6),
    ('card', 'shove', 'casino-audio', [f'card-shove-{i}.ogg' for i in range(1, 5)], 0.5),
    ('card', 'fan', 'casino-audio', ['card-fan-1.ogg'], 0.45),
    ('card', 'shuffle', 'casino-audio', ['card-shuffle.ogg'], 1.1),
    ('card', 'shimmer', 'interface-sounds', ['glass_002.ogg', 'glass_003.ogg', 'glass_005.ogg', 'glass_006.ogg'], None),
    ('card', 'shimmer_long', 'interface-sounds', ['glass_004.ogg'], None),
    ('card', 'select', 'interface-sounds', ['select_001.ogg', 'select_002.ogg', 'select_007.ogg', 'select_008.ogg'], None),
    ('ride', 'energy', 'sci-fi-sounds', [f'forceField_00{i}.ogg' for i in range(5)], 0.6),
    ('ride', 'rise', 'interface-sounds', ['maximize_001.ogg', 'maximize_002.ogg', 'maximize_008.ogg', 'maximize_009.ogg'], None),
    ('ride', 'rise_long', 'interface-sounds', ['maximize_004.ogg', 'maximize_005.ogg', 'maximize_006.ogg'], None),
    ('stride', 'swell', 'sci-fi-sounds', ['lowFrequency_explosion_001.ogg'], 0.9),
    ('guard', 'shield', 'impact-sounds', [f'impactGlass_light_00{i}.ogg' for i in range(5)], None),
    ('guard', 'shield_big', 'impact-sounds', [f'impactGlass_medium_00{i}.ogg' for i in range(5)], 0.45),
    ('battle', 'zap', 'sci-fi-sounds', ['laserSmall_001.ogg', 'laserSmall_004.ogg'], 0.3),
    ('battle', 'hit', 'impact-sounds', [f'impactPunch_medium_00{i}.ogg' for i in range(5)], 0.4),
    ('battle', 'bell', 'impact-sounds', ['impactBell_heavy_004.ogg'], None),
    ('battle', 'blocked', 'impact-sounds', [f'impactMetal_light_00{i}.ogg' for i in (1, 2, 4)], None),
    ('battle', 'thud', 'impact-sounds', [f'impactSoft_medium_00{i}.ogg' for i in range(5)], None),
    ('battle', 'lock', 'sci-fi-sounds', [f'doorClose_00{i}.ogg' for i in range(3)], None),
    ('checks', 'trigger', 'interface-sounds', ['confirmation_002.ogg', 'confirmation_004.ogg'], None),
    ('ui', 'click', 'interface-sounds', ['click_001.ogg', 'tick_004.ogg'], None),
    ('ui', 'tick', 'interface-sounds', ['tick_001.ogg', 'tick_002.ogg'], None),
    ('ui', 'confirm', 'interface-sounds', ['confirmation_001.ogg', 'confirmation_003.ogg'], None),
    ('ui', 'back', 'interface-sounds', [f'back_00{i}.ogg' for i in range(1, 5)], None),
    ('ui', 'error', 'interface-sounds', ['error_004.ogg', 'error_008.ogg'], None),
    ('ui', 'ability', 'interface-sounds', ['select_003.ogg', 'select_004.ogg', 'select_005.ogg'], None),
    ('ui', 'bong', 'interface-sounds', ['bong_001.ogg'], None),
    ('result', 'victory', 'music-jingles', ['jingles_STEEL02.ogg'], None),
    ('result', 'defeat', 'music-jingles', ['jingles_STEEL06.ogg'], None),
]

FADE = 0.04


def find(pack_dir: Path, name: str) -> Path:
    hits = list(pack_dir.rglob(name))
    if not hits:
        sys.exit(f'missing {name} in {pack_dir}')
    return hits[0]


def peak_db(path: Path) -> float:
    out = subprocess.run(
        ['ffmpeg', '-hide_banner', '-i', str(path), '-af', 'volumedetect', '-f', 'null', '-'],
        capture_output=True, text=True).stderr
    for line in out.splitlines():
        if 'max_volume:' in line:
            return float(line.split('max_volume:')[1].split()[0])
    return 0.0


def duration(path: Path) -> float:
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of',
                          'csv=p=0', str(path)], capture_output=True, text=True).stdout
    return float(out.strip())


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    entries = []
    for group, name, pack, files, longest in PICKS:
        for n, file in enumerate(files, 1):
            source = find(src / pack, file)
            dest = OUT / group / f'{name}_{n:02d}.ogg'
            dest.parent.mkdir(parents=True, exist_ok=True)
            length = min(duration(source), longest) if longest else duration(source)
            gain = -3.0 - peak_db(source)
            filters = [f'volume={gain:.2f}dB', f'afade=t=in:d=0.003']
            changes = ['mono 44.1 kHz', 'peak normalised to -3 dB']
            if longest and duration(source) > longest:
                filters.append(f'afade=t=out:st={max(0.0, length - FADE):.3f}:d={FADE}')
                changes.append(f'trimmed to {length:.2f} s with a fade-out')
            cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-t', f'{length:.3f}',
                   '-ac', '1', '-ar', '44100', '-af', ','.join(filters), '-c:a', 'libvorbis',
                   '-q:a', '4', str(dest)]
            subprocess.run(cmd, check=True)
            title, url = PACKS[pack]
            entries.append({
                'file': f'sfx/{group}/{dest.name}',
                'source_file': file,
                'source_pack': title,
                'source_url': url,
                'author': 'Kenney (www.kenney.nl)',
                'license': 'CC0 1.0 Universal (public domain dedication)',
                'license_url': 'http://creativecommons.org/publicdomain/zero/1.0/',
                'attribution_required': False,
                'changes': changes,
            })
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({
        'note': 'Every sound effect in the game. Generated by tools/audio/prepare_sfx.py.',
        'assets': entries,
    }, indent=2) + '\n', encoding='utf-8')
    print(f'{len(entries)} files')


if __name__ == '__main__':
    main()
