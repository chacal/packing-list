import type { FastifyPluginAsync } from 'fastify'
import { HttpError } from '../errors.ts'
import { exportAll, importAll } from '../transfer.ts'

export const transferRoutes: FastifyPluginAsync = async (app) => {
  app.get('/export', async (req, reply) => {
    const doc = exportAll(app.db)
    const stamp = new Date().toISOString().slice(0, 10)
    return reply
      .header('Content-Disposition', `attachment; filename="packing-list-${stamp}.json"`)
      .send(doc)
  })

  app.post('/import', async (req) => {
    const mode = (req.query as { mode?: string }).mode ?? 'merge'
    if (mode !== 'merge' && mode !== 'replace') throw new HttpError(400, 'mode must be merge or replace')
    return importAll(app.db, req.body, mode)
  })
}
