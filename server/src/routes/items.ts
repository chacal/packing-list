import type { FastifyPluginAsync } from 'fastify'
import { itemInput, itemPatch } from '@packing-list/shared'
import { notFound, parse, parseId } from '../errors.ts'
import { ITEM_SELECT, toItem, type ItemRow } from '../rows.ts'

export const itemRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db
  const get = (id: number) => {
    const row = db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(id) as ItemRow | undefined
    if (!row) throw notFound('Item')
    return toItem(row)
  }

  app.get('/items', async (req) => {
    const q = req.query as { q?: string; categoryId?: string }
    const where: string[] = []
    const params: (string | number)[] = []
    if (q.q) {
      where.push('(i.name LIKE ? OR i.notes LIKE ?)')
      params.push(`%${q.q}%`, `%${q.q}%`)
    }
    if (q.categoryId) {
      where.push('i.category_id = ?')
      params.push(parseId(q.categoryId))
    }
    const sql = `${ITEM_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.name COLLATE NOCASE`
    return (db.prepare(sql).all(...params) as unknown as ItemRow[]).map(toItem)
  })

  app.get('/items/:id', async (req) => get(parseId((req.params as { id: string }).id)))

  app.post('/items', async (req, reply) => {
    const b = parse(itemInput, req.body)
    const r = db
      .prepare('INSERT INTO items (name, category_id, weight_g, consumable, notes) VALUES (?, ?, ?, ?, ?)')
      .run(b.name, b.categoryId, b.weightG, b.consumable ? 1 : 0, b.notes)
    return reply.code(201).send(get(Number(r.lastInsertRowid)))
  })

  app.patch('/items/:id', async (req) => {
    const id = parseId((req.params as { id: string }).id)
    const b = parse(itemPatch, req.body)
    const cur = get(id)
    db.prepare(
      `UPDATE items SET name = ?, category_id = ?, weight_g = ?, consumable = ?, notes = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ).run(
      b.name ?? cur.name,
      b.categoryId ?? cur.categoryId,
      b.weightG ?? cur.weightG,
      (b.consumable ?? cur.consumable) ? 1 : 0,
      b.notes ?? cur.notes,
      id,
    )
    return get(id)
  })

  app.delete('/items/:id', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    get(id)
    db.prepare('DELETE FROM items WHERE id = ?').run(id)
    return reply.code(204).send()
  })
}
