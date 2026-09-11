import type { FastifyPluginAsync } from 'fastify'
import { packInput, packPatch } from '@packing-list/shared'
import { notFound, parse, parseId } from '../errors.ts'
import { PACK_SELECT, toPack, type PackRow } from '../rows.ts'

export const packRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db
  const get = (id: number) => {
    const row = db.prepare(`${PACK_SELECT} WHERE p.id = ?`).get(id) as PackRow | undefined
    if (!row) throw notFound('Pack')
    return toPack(row)
  }

  app.get('/packs', async () => (db.prepare(`${PACK_SELECT} ORDER BY p.name COLLATE NOCASE`).all() as unknown as PackRow[]).map(toPack))

  app.post('/packs', async (req, reply) => {
    const b = parse(packInput, req.body)
    const r = db.prepare('INSERT INTO packs (name, item_id, weight_g) VALUES (?, ?, ?)').run(b.name, b.itemId, b.weightG)
    return reply.code(201).send(get(Number(r.lastInsertRowid)))
  })

  app.patch('/packs/:id', async (req) => {
    const id = parseId((req.params as { id: string }).id)
    const b = parse(packPatch, req.body)
    const cur = get(id)
    db.prepare('UPDATE packs SET name = ?, item_id = ?, weight_g = ? WHERE id = ?').run(
      b.name ?? cur.name,
      b.itemId === undefined ? cur.itemId : b.itemId,
      b.weightG ?? cur.weightG,
      id,
    )
    return get(id)
  })

  app.delete('/packs/:id', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    get(id)
    db.prepare('DELETE FROM packs WHERE id = ?').run(id)
    return reply.code(204).send()
  })
}
