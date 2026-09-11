import { dirname, join } from 'node:path'
import { buildApp, defaultSeedFile } from './app.ts'
import { scheduleBackups } from './backup.ts'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'
const dbPath = process.env.DB_PATH ?? './data/packinglist.db'
const pretty = process.env.NODE_ENV !== 'production'

const app = await buildApp({
  dbPath,
  seedFile: process.env.SEED_FILE ?? defaultSeedFile,
  logger: pretty ? { transport: { target: 'pino-pretty' } } : true,
})

// Daily VACUUM INTO snapshots next to the database; BACKUP_DIR=off disables.
const backupDir = process.env.BACKUP_DIR ?? join(dirname(dbPath), 'backup')
const stopBackups = backupDir === 'off' ? () => {} : scheduleBackups(app.db, { dir: backupDir, keep: Number(process.env.BACKUP_KEEP ?? 7) }, app.log)

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down')
  stopBackups()
  await app.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

await app.listen({ port, host })
