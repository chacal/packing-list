import type { FastifyPluginAsync } from 'fastify'
import { computeSummary, tripInput, tripItemInput, tripItemPatch, tripPacksInput, tripPatch } from '@packing-list/shared'
import type { Category, Item, Pack, TripDetail, TripListEntry } from '@packing-list/shared'
import { conflict, notFound, parse, parseId } from '../errors.ts'
import { ITEM_SELECT, PACK_SELECT, toCategory, toItem, toPack, toTrip, toTripItem, type CategoryRow, type ItemRow, type PackRow, type TripItemRow, type TripRow } from '../rows.ts'

export const tripRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db
  const touch = db.prepare(`UPDATE trips SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)

  const getTrip = (id: number) => {
    const row = db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as TripRow | undefined
    if (!row) throw notFound('Trip')
    return toTrip(row)
  }
  const detail = (id: number): TripDetail => {
    const trip = getTrip(id)
    const packIds = (db.prepare('SELECT pack_id FROM trip_packs WHERE trip_id = ? ORDER BY sort_order, pack_id').all(id) as unknown as { pack_id: number }[]).map((r) => r.pack_id)
    const lines = (db.prepare('SELECT * FROM trip_items WHERE trip_id = ? ORDER BY sort_order, id').all(id) as unknown as TripItemRow[]).map(toTripItem)
    return { ...trip, packIds, lines }
  }
  const inTx = <T>(fn: () => T): T => {
    db.exec('BEGIN')
    try {
      const r = fn()
      db.exec('COMMIT')
      return r
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }

  app.get('/trips', async () => {
    const rows = db
      .prepare(
        `SELECT t.*,
           (SELECT COUNT(*) FROM trip_items ti WHERE ti.trip_id = t.id) AS line_count,
           (SELECT COALESCE(SUM(quantity), 0) FROM trip_items ti WHERE ti.trip_id = t.id) AS item_count,
           (SELECT COUNT(*) FROM trip_items ti WHERE ti.trip_id = t.id AND ti.packed = 1) AS packed_count
         FROM trips t ORDER BY t.updated_at DESC`,
      )
      .all() as unknown as (TripRow & { line_count: number; item_count: number; packed_count: number })[]
    return rows.map((r): TripListEntry => ({ ...toTrip(r), lineCount: r.line_count, itemCount: r.item_count, packedCount: r.packed_count }))
  })

  app.post('/trips', async (req, reply) => {
    const b = parse(tripInput, req.body)
    const r = db.prepare('INSERT INTO trips (name, notes) VALUES (?, ?)').run(b.name, b.notes)
    return reply.code(201).send(detail(Number(r.lastInsertRowid)))
  })

  app.get('/trips/:id', async (req) => detail(parseId((req.params as { id: string }).id)))

  app.patch('/trips/:id', async (req) => {
    const id = parseId((req.params as { id: string }).id)
    const b = parse(tripPatch, req.body)
    const cur = getTrip(id)
    db.prepare(`UPDATE trips SET name = ?, notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`).run(b.name ?? cur.name, b.notes ?? cur.notes, id)
    return detail(id)
  })

  app.delete('/trips/:id', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    getTrip(id)
    db.prepare('DELETE FROM trips WHERE id = ?').run(id)
    return reply.code(204).send()
  })

  app.post('/trips/:id/duplicate', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    const src = getTrip(id)
    const newId = inTx(() => {
      const r = db.prepare('INSERT INTO trips (name, notes) VALUES (?, ?)').run(`${src.name} (copy)`, src.notes)
      const nid = Number(r.lastInsertRowid)
      db.prepare('INSERT INTO trip_packs (trip_id, pack_id, sort_order) SELECT ?, pack_id, sort_order FROM trip_packs WHERE trip_id = ?').run(nid, id)
      db.prepare(
        'INSERT INTO trip_items (trip_id, item_id, quantity, pack_id, packed, sort_order) SELECT ?, item_id, quantity, pack_id, 0, sort_order FROM trip_items WHERE trip_id = ?',
      ).run(nid, id)
      return nid
    })
    return reply.code(201).send(detail(newId))
  })

  app.put('/trips/:id/packs', async (req) => {
    const id = parseId((req.params as { id: string }).id)
    const { packIds } = parse(tripPacksInput, req.body)
    getTrip(id)
    inTx(() => {
      db.prepare('DELETE FROM trip_packs WHERE trip_id = ?').run(id)
      const ins = db.prepare('INSERT INTO trip_packs (trip_id, pack_id, sort_order) VALUES (?, ?, ?)')
      packIds.forEach((pid, i) => ins.run(id, pid, i))
      // Lines assigned to a pack no longer in use become unassigned.
      if (packIds.length) {
        db.prepare(`UPDATE trip_items SET pack_id = NULL WHERE trip_id = ? AND pack_id IS NOT NULL AND pack_id NOT IN (${packIds.map(() => '?').join(',')})`).run(id, ...packIds)
      } else {
        db.prepare('UPDATE trip_items SET pack_id = NULL WHERE trip_id = ?').run(id)
      }
      touch.run(id)
    })
    return detail(id)
  })

  app.post('/trips/:id/items', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    const b = parse(tripItemInput, req.body)
    getTrip(id)
    const exists = db.prepare('SELECT id FROM trip_items WHERE trip_id = ? AND item_id = ?').get(id, b.itemId)
    if (exists) throw conflict('Item is already on this trip')
    inTx(() => {
      if (b.packId !== null) {
        db.prepare('INSERT OR IGNORE INTO trip_packs (trip_id, pack_id, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM trip_packs WHERE trip_id = ?))').run(id, b.packId, id)
      }
      const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM trip_items WHERE trip_id = ?').get(id) as { m: number }
      db.prepare('INSERT INTO trip_items (trip_id, item_id, quantity, pack_id, sort_order) VALUES (?, ?, ?, ?, ?)').run(id, b.itemId, b.quantity, b.packId, max.m + 1)
      touch.run(id)
    })
    return reply.code(201).send(detail(id))
  })

  app.patch('/trips/:id/items/:lineId', async (req) => {
    const { id: rawId, lineId: rawLine } = req.params as { id: string; lineId: string }
    const id = parseId(rawId)
    const lineId = parseId(rawLine)
    const b = parse(tripItemPatch, req.body)
    const cur = db.prepare('SELECT * FROM trip_items WHERE id = ? AND trip_id = ?').get(lineId, id) as TripItemRow | undefined
    if (!cur) throw notFound('Trip line')
    inTx(() => {
      const packId = b.packId === undefined ? cur.pack_id : b.packId
      if (packId !== null && packId !== cur.pack_id) {
        db.prepare('INSERT OR IGNORE INTO trip_packs (trip_id, pack_id, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM trip_packs WHERE trip_id = ?))').run(id, packId, id)
      }
      db.prepare('UPDATE trip_items SET quantity = ?, pack_id = ?, packed = ? WHERE id = ?').run(
        b.quantity ?? cur.quantity,
        packId,
        (b.packed ?? cur.packed === 1) ? 1 : 0,
        lineId,
      )
      touch.run(id)
    })
    return detail(id)
  })

  app.delete('/trips/:id/items/:lineId', async (req) => {
    const { id: rawId, lineId: rawLine } = req.params as { id: string; lineId: string }
    const id = parseId(rawId)
    const lineId = parseId(rawLine)
    const r = db.prepare('DELETE FROM trip_items WHERE id = ? AND trip_id = ?').run(lineId, id)
    if (r.changes === 0) throw notFound('Trip line')
    touch.run(id)
    return detail(id)
  })

  app.post('/trips/:id/reset-packed', async (req) => {
    const id = parseId((req.params as { id: string }).id)
    getTrip(id)
    db.prepare('UPDATE trip_items SET packed = 0 WHERE trip_id = ?').run(id)
    return detail(id)
  })

  app.get('/trips/:id/summary', async (req) => {
    const id = parseId((req.params as { id: string }).id)
    const trip = detail(id)
    const items: Item[] = (db.prepare(ITEM_SELECT).all() as unknown as ItemRow[]).map(toItem)
    const categories: Category[] = (db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all() as unknown as CategoryRow[]).map(toCategory)
    const packs: Pack[] = (db.prepare(PACK_SELECT).all() as unknown as PackRow[]).map(toPack)
    return computeSummary(trip, items, categories, packs)
  })
}
