# Packing List

Gear inventory and trip packing lists with weight summaries. Replaces a Google Sheet.
See [PLAN.md](PLAN.md) for the design.

## Development

```bash
npm install
npm run dev        # server on :3000 (API + SQLite in ./data), web on :5173 with /api proxy
npm test
npm run typecheck
```

The server runs TypeScript directly with Node 24 type stripping; there is no build step
for it. The web app is built with Vite.

## Docker

```bash
docker build -t packing-list .
docker run -p 8200:3000 -v /srv/packing-list:/data packing-list
```

Environment: `PORT` (3000), `DB_PATH` (`/data/packinglist.db`), `HOST` (`0.0.0.0`).
The container runs as uid 1000 (`node`), so the mounted directory must be writable by it.
