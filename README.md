# Atelier Chess

A quiet, board-first chess app with a traditional SVG board and a real, interactive Three.js board. Ivory and dark sculpted pieces, brass inlays, three coordinated palettes, and all controls inside a settings popup. Built from scratch with vanilla JavaScript, Vite, chess.js, and Three.js.

**Play online: [joellimrl.github.io/chess](https://joellimrl.github.io/chess/)**

## Run locally

Requires Node.js 20.19+ or a compatible Node.js 22 release and npm.

```sh
npm ci --legacy-peer-deps
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173). Do not open `index.html` directly: module imports and the computer's worker require an HTTP server.

```sh
npm run build       # production files in dist/
npm run preview     # serve the production build locally
npm test            # chess rules and saved-game regression tests
npm run test:browser
```

The browser suite starts the development server on port 5173 automatically. It uses installed Chrome on Windows or Playwright Chromium on other systems (`npx playwright install chromium --only-shell`). Set `CHROME_PATH` to override the browser executable. To test an already running site, set `CHESS_TEST_URL` to its full URL, including a trailing slash. Test screenshots and reports live in ignored `test-results/`.

## GitHub Pages

`.github/workflows/pages.yml` runs the rules and browser tests, builds the app, and deploys `dist/` to GitHub Pages on every push to `main`. It can also be run manually from the repository's Actions tab. Pages uses **GitHub Actions** as its publishing source. The build uses relative asset URLs so the same output works both at `/chess/` on GitHub and `/` locally. The site requires no backend, API keys, or runtime external services.

## Playing

- Click a piece and its destination, or drag it. Both views use exactly the same position and rules.
- Open the gear for Classic / Sculpted views, Atelier / Nocturne / Rosewood palettes, coordinates, sounds, move hints, board orientation, takebacks, draw actions, resignation, and a new game.
- Choose **A friend** for two people sharing a device, or **Computer** for a local opponent. Choose your color and one of three search levels. The computer runs in a worker so the interface stays responsive; it is a small casual-play engine, not Stockfish.
- In 3D, drag an empty part of the table to orbit, scroll/pinch to zoom, or use two fingers to rotate. Dragging your own piece moves it.
- Keyboard shortcuts: **S** settings, **V** view, **F** flip, **U** take back, **Esc** cancel selection or a pending draw claim. On the Classic board, Tab focuses a square, arrow keys move focus, and Enter/Space selects it.
- Promotion always lets you choose queen, rook, bishop, or knight. Cancel returns to the position before the move.
- Game and preferences save automatically in this browser's local storage. The settings popup contains move history and PGN download. Games are untimed.

## Rules

`chess.js` 1.4.0 validates moves: correct starting position, alternating turns, blocked paths, pins and king safety, both castling sides and lost castling rights, en passant including discovered-check restrictions, promotion, checkmate, stalemate, and standard insufficient-material positions.

The application distinguishes claimable and automatic draws:

- **Threefold repetition** and the **50-move rule** require a claim. Use **Claim a draw** when eligible. If not yet eligible, select an intended legal move; a successful prospective claim ends the game without playing that move. An invalid claim leaves the position unchanged. Esc cancels.
- **Fivefold repetition** and **75 moves by each player without a pawn move or capture** end automatically. Checkmate on the last move takes precedence.
- Local players can agree a draw or resign. The computer claims available draws; otherwise it declines draw offers.

The rules reference is the [FIDE Laws of Chess](https://handbook.fide.com/chapter/E012023). This is an untimed casual-play interface, not a tournament arbiter: touch-move, clocks/penalties, and exhaustive proofs of unusual blocked/dead positions are outside its scope. Automatic dead-position detection covers chess.js's insufficient-material cases. Players can agree a draw in other dead positions.

## Source map

| File | Responsibility |
| --- | --- |
| `src/main.js` | Input, dialogs, both views, persistence, sound, computer lifecycle |
| `src/rules.js` | Shared game state, draw policy, undo, serialization, PGN |
| `src/board3d.js` | Geometry, materials, lighting, shadows, ray picking, orbit, animation |
| `src/pieces.js` | Original SVG chess set for 2D and promotion |
| `src/themes.js` | Shared palette definitions |
| `src/engine.worker.js` | Iterative-deepening alpha-beta computer opponent |
| `src/style.css` | Responsive board, dialogs, palettes, reduced-motion support |
| `tests/rules.test.js` | Chess edge cases, perft, persistence, draw thresholds |
| `tests/browser/chess.spec.js` | Actual browser interactions and desktop/mobile screenshots |

All rendering assets are local. The chess pieces and board textures are generated in code. The bundled DM Sans and Italiana fonts are distributed under the SIL Open Font License; their license files are in `public/fonts/`. `chess.js` and Three.js retain their respective BSD-2-Clause and MIT package licenses.
