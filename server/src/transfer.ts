import { exportDoc, type ExportDoc } from '@packing-list/shared'
import type { Db } from './db.ts'
import { HttpError } from './errors.ts'

export type ImportMode = 'merge' | 'replace'

export function exportAll(db: Db): ExportDoc {
  const categories = db.prepare('SELECT name, sort_order FROM categories ORDER BY sort_order, name').all() as { name: string; sort_order: number }[]
  const items = db
    .prepare(
      `SELECT i.name, c.name AS category, i.weight_g, i.consumable, i.notes
       FROM items i JOIN categories c ON c.id = i.category_id ORDER BY c.sort_order, i.name COLLATE NOCASE`,
    )
    .all() as { name: string; category: string; weight_g: number; consumable: number; notes: string }[]
  const packs = db
    .prepare(`SELECT p.name, i.name AS source_item, p.weight_g FROM packs p LEFT JOIN items i ON i.id = p.item_id ORDER BY p.name COLLATE NOCASE`)
    .all() as { name: string; source_item: string | null; weight_g: number }[]
  const trips = db.prepare('SELECT id, name, notes FROM trips ORDER BY created_at').all() as { id: number; name: string; notes: string }[]
  const tripPacks = db.prepare(
    `SELECT p.name FROM trip_packs tp JOIN packs p ON p.id = tp.pack_id WHERE tp.trip_id = ? ORDER BY tp.sort_order`,
  )
  const tripItems = db.prepare(
    `SELECT i.name AS item, ti.quantity, p.name AS pack, ti.packed
     FROM trip_items ti JOIN items i ON i.id = ti.item_id LEFT JOIN packs p ON p.id = ti.pack_id
     WHERE ti.trip_id = ? ORDER BY ti.sort_order, ti.id`,
  )
  return {
    categories: categories.map((c) => ({ name: c.name, sortOrder: c.sort_order })),
    items: items.map((i) => ({ name: i.name, category: i.category, weightGrams: i.weight_g, isConsumable: i.consumable === 1, notes: i.notes })),
    packs: packs.map((p) => ({ name: p.name, sourceItem: p.source_item, weightGrams: p.weight_g })),
    packingLists: trips.map((t) => ({
      name: t.name,
      notes: t.notes,
      packs: (tripPacks.all(t.id) as { name: string }[]).map((p) => p.name),
      entries: (tripItems.all(t.id) as { item: string; quantity: number; pack: string | null; packed: number }[]).map((e) => ({
        item: e.item,
        quantity: e.quantity,
        pack: e.pack,
        packed: e.packed === 1,
      })),
    })),
  }
}

export interface ImportResult {
  categories: number
  items: number
  packs: number
  trips: number
}

/**
 * Import a document. `merge` upserts categories, items and packs by name and appends
 * trips; `replace` wipes everything first.
 */
export function importAll(db: Db, raw: unknown, mode: ImportMode = 'merge'): ImportResult {
  const parsed = exportDoc.safeParse(raw)
  if (!parsed.success) throw new HttpError(400, 'Invalid import document', parsed.error.issues)
  const doc = parsed.data

  db.exec('BEGIN')
  try {
    if (mode === 'replace') {
      db.exec('DELETE FROM trip_items; DELETE FROM trip_packs; DELETE FROM trips; DELETE FROM packs; DELETE FROM items; DELETE FROM categories')
    }

    const catId = new Map<string, number>()
    const upsertCat = db.prepare(
      `INSERT INTO categories (name, sort_order) VALUES (?, ?)
       ON CONFLICT(name) DO UPDATE SET sort_order = excluded.sort_order RETURNING id`,
    )
    for (const c of doc.categories) {
      catId.set(c.name, (upsertCat.get(c.name, c.sortOrder) as { id: number }).id)
    }
    // Categories referenced by items but missing from the list get appended.
    const maxOrder = () => (db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories').get() as { m: number }).m
    const ensureCat = (name: string) => {
      let id = catId.get(name)
      if (id === undefined) {
        const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number } | undefined
        id = existing?.id ?? (upsertCat.get(name, maxOrder() + 1) as { id: number }).id
        catId.set(name, id)
      }
      return id
    }

    const itemId = new Map<string, number>()
    const findItem = db.prepare('SELECT id FROM items WHERE name = ?')
    const insertItem = db.prepare('INSERT INTO items (name, category_id, weight_g, consumable, notes) VALUES (?, ?, ?, ?, ?) RETURNING id')
    const updateItem = db.prepare(
      `UPDATE items SET category_id = ?, weight_g = ?, consumable = ?, notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    )
    for (const it of doc.items) {
      const cid = ensureCat(it.category)
      const existing = findItem.get(it.name) as { id: number } | undefined
      let id: number
      if (existing) {
        updateItem.run(cid, it.weightGrams, it.isConsumable ? 1 : 0, it.notes, existing.id)
        id = existing.id
      } else {
        id = (insertItem.get(it.name, cid, it.weightGrams, it.isConsumable ? 1 : 0, it.notes) as { id: number }).id
      }
      itemId.set(it.name, id)
    }
    const resolveItem = (name: string) => {
      const id = itemId.get(name) ?? (findItem.get(name) as { id: number } | undefined)?.id
      if (id === undefined) throw new HttpError(400, `Unknown item "${name}" referenced in import`)
      return id
    }

    const packId = new Map<string, number>()
    const upsertPack = db.prepare(
      `INSERT INTO packs (name, item_id, weight_g) VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET item_id = excluded.item_id, weight_g = excluded.weight_g RETURNING id`,
    )
    for (const p of doc.packs) {
      const src = p.sourceItem ? resolveItem(p.sourceItem) : null
      packId.set(p.name, (upsertPack.get(p.name, src, p.weightGrams) as { id: number }).id)
    }
    const resolvePack = (name: string | null) => {
      if (name === null) return null
      const id = packId.get(name) ?? (db.prepare('SELECT id FROM packs WHERE name = ?').get(name) as { id: number } | undefined)?.id
      if (id === undefined) throw new HttpError(400, `Unknown pack "${name}" referenced in import`)
      return id
    }

    const insertTrip = db.prepare('INSERT INTO trips (name, notes) VALUES (?, ?) RETURNING id')
    const insertTripPack = db.prepare('INSERT OR IGNORE INTO trip_packs (trip_id, pack_id, sort_order) VALUES (?, ?, ?)')
    const insertTripItem = db.prepare(
      'INSERT OR IGNORE INTO trip_items (trip_id, item_id, quantity, pack_id, packed, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    )
    for (const t of doc.packingLists) {
      const tid = (insertTrip.get(t.name, t.notes) as { id: number }).id
      const packNames = t.packs ?? [...new Set(t.entries.map((e) => e.pack).filter((p): p is string => p !== null))]
      packNames.forEach((name, i) => insertTripPack.run(tid, resolvePack(name), i))
      t.entries.forEach((e, i) => insertTripItem.run(tid, resolveItem(e.item), e.quantity, resolvePack(e.pack), e.packed ? 1 : 0, i))
    }

    db.exec('COMMIT')
    return { categories: doc.categories.length, items: doc.items.length, packs: doc.packs.length, trips: doc.packingLists.length }
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function isEmpty(db: Db): boolean {
  const r = db.prepare('SELECT (SELECT COUNT(*) FROM items) + (SELECT COUNT(*) FROM categories) + (SELECT COUNT(*) FROM trips) AS n').get() as { n: number }
  return r.n === 0
}
