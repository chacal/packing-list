import type { FastifyPluginAsync } from 'fastify'
import { categoryInput, categoryOrder, categoryPatch } from '@packing-list/shared'
import { conflict, notFound, parse, parseId } from '../errors.ts'
import { toCategory, type CategoryRow } from '../rows.ts'

export const categoryRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db
  const list = () => (db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all() as unknown as CategoryRow[]).map(toCategory)
  const get = (id: number) => {
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow | undefined
    if (!row) throw notFound('Category')
    return toCategory(row)
  }

  app.get('/categories', async () => list())

  app.post('/categories', async (req, reply) => {
    const body = parse(categoryInput, req.body)
    const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories').get() as { m: number }
    const r = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(body.name, max.m + 1)
    return reply.code(201).send(get(Number(r.lastInsertRowid)))
  })

  app.patch('/categories/:id', async (req) => {
    const id = parseId((req.params as { id: string }).id)
    const body = parse(categoryPatch, req.body)
    get(id)
    if (body.name !== undefined) db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(body.name, id)
    if (body.sortOrder !== undefined) db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').run(body.sortOrder, id)
    return get(id)
  })

  app.put('/categories/order', async (req) => {
    const { ids } = parse(categoryOrder, req.body)
    const stmt = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?')
    db.exec('BEGIN')
    try {
      ids.forEach((id, i) => stmt.run(i, id))
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    return list()
  })

  app.delete('/categories/:id', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    get(id)
    const used = db.prepare('SELECT COUNT(*) AS n FROM items WHERE category_id = ?').get(id) as { n: number }
    if (used.n > 0) throw conflict(`Category is used by ${used.n} item(s)`)
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    return reply.code(204).send()
  })
}
