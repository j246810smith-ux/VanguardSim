# Home screen artwork (asset manifest)

The home screen (`app/renderer/home/`) picks these files up automatically when they are here
(`home/art.ts`). Until a file exists, a drawn silhouette stands in for it, so none of them is
required. Rebuild the game after adding one.

| File (`.png` or `.webp`) | What it is                                                  | Where it shows                        | Suggested size           |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------- | ------------------------ |
| `duelist-blue`           | The player's fighter: blue clothes, confident, holds a card | Left side, feet at the bottom edge    | 1200 × 2000 px, portrait |
| `rival-red`              | The rival: red clothes, different hair and outline          | Right side, feet at the bottom edge   | 1200 × 2000 px, portrait |
| `mech-blue`              | The player's mech companion                                 | Behind the blue fighter, upper middle | 1024 × 1024 px           |
| `mech-red`               | The rival's mech companion                                  | Behind the red fighter, upper middle  | 1024 × 1024 px           |

**Now in the folder (2026-11-08):** cropped from the user's art pack (OneDrive Desktop
`Vanguard_Art_Assets`): `duelist-blue.webp` and `rival-red.webp` from `05_Home_Screen_Reference.png`,
`mech-blue.webp`, `mech-red.webp` and `skyline.webp` (the faint city behind the field) from
`02_Character_Mech_Background_Sheet.png`, and the six profile portraits in `avatars/` from the same
sheet. The pack's pictures have their backgrounds painted in, so the crops have their edges faded
to transparent (`edge_fade`/`radial_fade`, a one-off script) instead of being true cut-outs.
Replacing any of them with a clean transparent PNG or WebP of the same name needs no code change.
The pack's card back was not used (it carries the official Vanguard logo).

Rules for each picture:

- **See-through background** (transparent PNG or WebP). No background, glow or floor baked in: the
  screen draws those.
- Original characters only: nothing from the Cardfight!! Vanguard anime or other shows.
- Fighters face the middle of the screen: the blue fighter faces right, the red one faces left.
  The screen does not mirror the pictures.
- Keep the figure inside the picture with a little space at the top. The screen scales it to fit
  600 × 1000 stage pixels (fighters) or 520 × 520 (mechs), keeping its shape and anchored to the
  bottom.
- Under about 1.5 MB each (WebP is smaller). Remove metadata before publishing (names in the
  file's tags must not reach the public repository).

Everything else on the home screen (the field, buttons, icons, logo, avatars, sparks) is drawn in
code (SVG and CSS), so it stays sharp at every size and needs no files here.
