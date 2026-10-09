# Building from source

## Requirements

- **Node.js 24** (24.19 is used in development) and **npm 11**.
- **Windows 10/11 x64** to build and run the packaged desktop app. The engine, tests and the
  browser UI also run on macOS and Linux.
- An internet connection for `npm ci` and the first packaging run (electron-builder downloads its
  Windows packaging tools once). The game itself never uses the network.

## Commands

| Command                                   | What it does                                                         |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `npm ci`                                  | Install exact dependency versions from `package-lock.json`.          |
| `npm run check`                           | Typecheck, lint, format check and every test. Run before committing. |
| `npm test`                                | Tests only (Vitest).                                                 |
| `npm run app`                             | Build the UI and start the desktop app from the repository.          |
| `npm run ui:dev`                          | The UI in a browser with hot reload (http://localhost:5173).         |
| `npm run play`                            | A terminal game against the AI (no UI).                              |
| `npm run dist:win`                        | Build the Windows release into `release/` (see below).               |
| `npm run dist:smoke`                      | Test the built release from a fresh temporary folder (see below).    |
| `npm run ai:bench`                        | AI benchmark (`docs/ai/AI_AUDIT_AND_PLAN.md`).                       |
| `npm run cards:validate` / `cards:report` | Check card data and print the implementation status.                 |

npm may warn that some packages' install scripts are not approved (`allow-scripts`); the build
does not need them.

## Windows release build

```
npm ci
npm run check
npm run dist:win
npm run dist:smoke
```

`dist:win` builds the UI in release mode (`vite build --mode release`, which never includes card
art) and packages it with electron-builder (configuration: the `build` field of `package.json`).
Output in `release/`:

- `VanguardSim-<version>-win-x64.zip` — unzip and run `Vanguard Sim.exe`;
- `VanguardSim-<version>-portable.exe` — a single self-extracting executable;
- `win-unpacked/` — the unzipped app, for inspection.

Each contains the app, `LICENSE.txt`, `THIRD_PARTY_NOTICES.md`, Electron's and Chromium's
licences, and an empty `cards\` folder with `README.txt` explaining optional art.

`dist:smoke` unzips the release into a new temporary folder, starts it there without any art
(the main menu must render with no errors), then with a generated 1×1 test image in `cards\BT01\` (it must load),
and reports the result. It never uses real card art.

The builds are **not code-signed**; Windows SmartScreen may warn users the first time. The default
Electron icon is used.

## Optional card art in development

`npm run app` and `npm run ui:dev` show art from `assets/cards/<SET>/<ID>.png|jpg` if present
(git-ignored, never committed). The card importer only downloads images when asked explicitly
(`npm run cards:import -- BT01 --images`), for **personal, local use only**; never commit or
redistribute them.
