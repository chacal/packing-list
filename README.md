# Packing List

Gear inventory and trip packing lists with weight summaries, replacing a Google Sheet.
Laptop for editing, phone for packing. See [PLAN.md](PLAN.md) for the design and decisions.

## Features

- **Inventory**: gear with category, weight, consumable flag and notes. Inline editing,
  search, filter, sort. Manage categories (rename, reorder) and packs (the bags gear goes
  into, optionally linked to the inventory item they are made of).
- **Trips**: pick gear from the inventory into a trip, set quantity and the pack each item
  goes into, choose which packs are in use. Duplicate trips to start from a previous one.
- **Summary**: weight per category and per pack (contents + bag), total, base weight
  (minus consumables), consumables.
- **Packing mode**: phone checklist grouped by category (collecting at home) or by pack
  (stuffing bags), checkmarks stored on the server, progress per group, hide packed.
- **Import / export**: JSON, same shape as the original seed file. An empty database is
  seeded from `server/seed/seed.json` on first start.

## Development

```bash
npm install
npm run dev        # server on :3000 (API + SQLite in ./data), web on :5173 with /api proxy
npm test
npm run typecheck
```

The server runs TypeScript directly with Node 24 type stripping; there is no build step
for it. The web app is built with Vite. Layout: `shared/` (types, zod schemas, summary
math used by both sides), `server/` (Fastify, `node:sqlite`, SQL migrations in
`server/migrations/`), `web/` (React 19, Tailwind 4, TanStack Query, React Router).

## Docker

```bash
docker build -t packing-list .
docker run -p 8200:3000 -v /srv/packing-list:/data packing-list
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port inside the container |
| `DB_PATH` | `/data/packinglist.db` | SQLite file (WAL mode) |
| `SEED_FILE` | bundled `seed.json` | Imported into an empty database at startup |
| `BACKUP_DIR` | `<db dir>/backup` | Daily `VACUUM INTO` snapshots; `off` disables |
| `BACKUP_KEEP` | `7` | Snapshots to keep |

The container runs as uid 1000 (`node`), so the mounted directory must be writable by that
uid. No authentication: meant for a trusted home network. Images are published to
`ghcr.io/chacal/packing-list` by GitHub Actions on every push to `main`.
