CREATE TABLE categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE items (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  weight_g    INTEGER NOT NULL DEFAULT 0 CHECK (weight_g >= 0),
  consumable  INTEGER NOT NULL DEFAULT 0 CHECK (consumable IN (0, 1)),
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX items_category_idx ON items(category_id);

CREATE TABLE packs (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL UNIQUE,
  item_id  INTEGER REFERENCES items(id) ON DELETE SET NULL,
  weight_g INTEGER NOT NULL DEFAULT 0 CHECK (weight_g >= 0)
);

CREATE TABLE trips (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE trip_packs (
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  pack_id    INTEGER NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (trip_id, pack_id)
);

CREATE TABLE trip_items (
  id         INTEGER PRIMARY KEY,
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  pack_id    INTEGER REFERENCES packs(id) ON DELETE SET NULL,
  packed     INTEGER NOT NULL DEFAULT 0 CHECK (packed IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (trip_id, item_id)
);
CREATE INDEX trip_items_trip_idx ON trip_items(trip_id);
