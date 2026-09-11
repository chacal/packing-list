import { buildApp, defaultSeedFile } from './app.ts'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'
const dbPath = process.env.DB_PATH ?? './data/packinglist.db'
const pretty = process.env.NODE_ENV !== 'production'

const app = await buildApp({
  dbPath,
  seedFile: process.env.SEED_FILE ?? defaultSeedFile,
  logger: pretty ? { transport: { target: 'pino-pretty' } } : true,
})

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

await app.listen({ port, host })
