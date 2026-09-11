# Packing List

Gear inventory and trip packing lists with weight summaries for hiking and bikepacking.
Laptop for editing, phone for packing.

## Features

- **Inventory**: gear with category, weight, consumable flag and notes. Search, filter by
  category, sort by column. Inline row editing with a mouse; on phones and other touch
  devices the list is a tappable card list and editing happens in a dialog. Manage
  categories (rename, reorder, delete when unused) and packs (the bags gear goes into,
  optionally linked to the inventory item they are made of). Deleting an item warns how
  many trips use it.
- **Trips**: pick gear from the inventory into a trip (click to add, click again to
  remove), set quantity and the pack each item goes into, choose and order the packs in
  use. Rename by clicking the title. Duplicate a trip to start from a previous one.
- **Summary**: weight per category and per pack (contents + bag), total, base weight
  (total minus consumables), consumables, item counts.
- **Packing mode**: phone checklist grouped by category (collecting gear at home) or by
  pack (stuffing bags), big tap targets, checkmarks stored on the server so they survive
  reloads and other devices, progress per group, hide packed, reset. The grouping choice
  is remembered per device.
- **Import / export**: JSON export of everything; import either merges by name (updates
  existing items, adds trips) or replaces the whole database. An empty database is seeded
  with a small sample inventory and trip from `server/seed/seed.json` on first start;
  replace it with your own gear or import a JSON export. Set `SEED_FILE` to seed from
  your own file instead.

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
| `HOST` | `0.0.0.0` | Listen address |
| `DB_PATH` | `/data/packinglist.db` | SQLite file (WAL mode) |
| `SEED_FILE` | bundled `seed.json` | Imported into an empty database at startup |
| `BACKUP_DIR` | `<db dir>/backup` | Daily `VACUUM INTO` snapshots; `off` disables |
| `BACKUP_KEEP` | `7` | Snapshots to keep |

The container runs as uid 1000 (`node`), so the mounted directory must be writable by that
uid. No authentication: meant for a trusted private network. Images are published to
`ghcr.io/chacal/packing-list` by GitHub Actions on every push to `main`.

## API

JSON under `/api/v1`, no authentication. Bodies are validated with the zod schemas in
`shared/src/schemas.ts`; validation errors return 400 with the issues, unique-name and
in-use conflicts return 409.

| Resource | Endpoints |
| --- | --- |
| Categories | `GET/POST /categories`, `PATCH/DELETE /categories/:id`, `PUT /categories/order` |
| Items | `GET /items?q=&categoryId=`, `POST /items`, `GET/PATCH/DELETE /items/:id` |
| Packs | `GET/POST /packs`, `PATCH/DELETE /packs/:id` |
| Trips | `GET/POST /trips`, `GET/PATCH/DELETE /trips/:id`, `POST /trips/:id/duplicate`, `PUT /trips/:id/packs`, `POST /trips/:id/reset-packed`, `GET /trips/:id/summary` |
| Trip lines | `POST /trips/:id/items`, `PATCH/DELETE /trips/:id/items/:lineId` |
| Transfer | `GET /export`, `POST /import?mode=merge\|replace` |
| Health | `GET /healthz` |

Trip mutations return the full trip so the client can update its cache without refetching.

## Design notes

- **Trip lines reference inventory items live.** Fixing a weight in the inventory fixes
  every trip that carries the item. Deleting an item removes it from trips (the UI says
  how many before it does).
- **Packs are their own entity**, optionally linked to the inventory item they are made
  of so the weight is recorded once. Two bags of the same model or storage that is not
  gear at all (a bike rack, say) both work.
- **Weights are integer grams.** Pack totals include the bag's own weight; base weight is
  the total minus consumables.
- **Summary math lives in `shared/`** and runs identically on the server and in the
  browser, so the numbers never disagree.
- **Storage** is one SQLite file in WAL mode, migrated with plain SQL files. Daily
  `VACUUM INTO` snapshots give a consistent copy for whatever backs up the data directory.
