# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Runtime Categories From CDN

The app can load category configuration and category word JSON files from CDN at runtime.

1. Copy `.env.example` to `.env`.
2. Set:
   - `VITE_CATEGORY_CONFIG_URL` (URL to remote `config.json`)
   - `VITE_CATEGORY_DATA_BASE_URL` (base URL for category files; optional)
   - `VITE_LIVE_GAMES_URL` (optional shared multiplayer endpoint)
3. Deploy. If CDN is unavailable, the app falls back to local config/data in `src/config` and `src/data`.

`config.json` format:
- `default_file_name`: string
- `categories`: array of `{ "category_name": "...", "file_name": "..." }`

Each category file should be a JSON array with entries containing:
- `word` or `tamil-word`

## Live Games API (Optional)

If `VITE_LIVE_GAMES_URL` is set, multiplayer lobbies are shared across users.

- `GET {VITE_LIVE_GAMES_URL}`: returns an array of games.
- `POST {VITE_LIVE_GAMES_URL}`: accepts one game object and returns the saved game.

Game object shape:

```json
{
  "id": "GABC1234",
  "word": "தமிழ்",
  "wordLength": 5,
  "hostPlayerId": "player-id",
  "hostNickname": "Player name",
  "createdAt": 1741380000000
}
```

When `VITE_LIVE_GAMES_URL` is not set, multiplayer works only within the same browser profile via `localStorage`.

## Local Multiplayer Backend (Express)

Use the separate backend project `tamil-wordle-live-api`.

1. Run backend in that repo:
   - `npm install`
   - `npm run dev`
2. Run frontend in this repo:
   - `npm run dev`
3. Set frontend env in `.env`:
   - `VITE_LIVE_GAMES_URL=https://enasollu.enasollu.xyz/live-games`

For local API development, you can still use `VITE_LIVE_GAMES_URL=/live-games` and run the backend at `http://localhost:4000` via Vite proxy.
