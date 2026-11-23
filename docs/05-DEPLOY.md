# 05 · Deploy

- **GitHub Pages:** `.github/workflows/pages.yml` runs the tests on every push to `main`, then
  publishes `index.html`, `styles.css`, `favicon.svg` and `src/`. Turn it on once in
  **Settings → Pages → Source → GitHub Actions**.
- **CI:** `.github/workflows/ci.yml` syntax-checks every file and runs the tests on Node 20,
  22 and 24.
- **Local:** `npm start` serves on http://127.0.0.1:5173 (set `PORT` to change it). ES modules
  do not load from `file://`.
- **URL options:** `?debug` exposes `window.__ha` (`game`, `start(i)`, `clear()`,
  `autopilot(on)`); `?seed=7` fixes the RNG; `?play=<stage id>` starts a stage (`paddy`,
  `dunes`, `karst`, `city`); `?autopilot` lets the bot drive; `?autofire` holds the trigger;
  `?touch` forces the touch controls on.
- **Storage:** `localStorage` under the `heavyarmor:` prefix (`scores`, `difficulty`,
  `muted`, `initials`). Private windows and blocked storage still play.
