import Fastify, { type FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { openDb, type Db } from './db.ts'
import { HttpError, translateSqliteError } from './errors.ts'
import { categoryRoutes } from './routes/categories.ts'
import { itemRoutes } from './routes/items.ts'
import { packRoutes } from './routes/packs.ts'
import { transferRoutes } from './routes/transfer.ts'
import { tripRoutes } from './routes/trips.ts'
import { importAll, isEmpty } from './transfer.ts'

export interface AppOptions {
  dbPath: string
  /** Directory with the built web app. Skipped when it does not exist. */
  webDist?: string
  logger?: boolean | object
  /** JSON file imported into an empty database at startup. */
  seedFile?: string
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const defaultWebDist = join(here, '..', '..', 'web', 'dist')
export const defaultSeedFile = join(here, '..', 'seed', 'seed.json')

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false })
  const db = openDb(opts.dbPath)
  app.decorate('db', db)
  app.addHook('onClose', async () => db.close())

  if (opts.seedFile && isEmpty(db)) {
    const result = importAll(db, JSON.parse(readFileSync(opts.seedFile, 'utf8')), 'replace')
    app.log.info({ seedFile: opts.seedFile, ...result }, 'seeded empty database')
  }

  app.setErrorHandler((err, req, reply) => {
    const e = translateSqliteError(err)
    if (e instanceof HttpError) {
      return reply.code(e.statusCode).send({ error: e.message, details: e.details })
    }
    const status = (e as { statusCode?: number }).statusCode ?? 500
    if (status >= 500) req.log.error(e)
    return reply.code(status).send({ error: status >= 500 ? 'Internal error' : (e as Error).message })
  })

  app.get('/healthz', async () => ({ ok: true }))

  await app.register(
    async (api) => {
      await api.register(categoryRoutes)
      await api.register(itemRoutes)
      await api.register(packRoutes)
      await api.register(transferRoutes)
      await api.register(tripRoutes)
    },
    { prefix: '/api/v1' },
  )

  const webDist = opts.webDist ?? defaultWebDist
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false })
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' })
      return reply.sendFile('index.html')
    })
  }

  return app
}
