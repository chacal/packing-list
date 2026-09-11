import Fastify, { type FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb, type Db } from './db.ts'

export interface AppOptions {
  dbPath: string
  /** Directory with the built web app. Skipped when it does not exist. */
  webDist?: string
  logger?: boolean | object
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

const defaultWebDist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist')

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false })
  const db = openDb(opts.dbPath)
  app.decorate('db', db)
  app.addHook('onClose', async () => db.close())

  app.get('/healthz', async () => ({ ok: true }))

  await app.register(
    async (api) => {
      api.get('/ping', async () => ({ pong: true }))
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
