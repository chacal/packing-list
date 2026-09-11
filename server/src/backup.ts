import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from './db.ts'

export interface BackupOptions {
  dir: string
  /** How many daily snapshots to keep. */
  keep: number
  now?: Date
}

/**
 * Write a consistent snapshot of the database with `VACUUM INTO` (safe while the
 * app is running, unlike copying a WAL-mode file) and prune old snapshots.
 * Returns the path written, or null if today's snapshot already exists.
 */
export function runBackup(db: Db, opts: BackupOptions): string | null {
  const now = opts.now ?? new Date()
  mkdirSync(opts.dir, { recursive: true })
  const name = `packinglist-${now.toISOString().slice(0, 10)}.db`
  const target = join(opts.dir, name)
  const existing = snapshots(opts.dir)
  if (existing.includes(name)) return null
  db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`)
  for (const old of snapshots(opts.dir).slice(0, -opts.keep)) unlinkSync(join(opts.dir, old))
  return target
}

/** Snapshot file names in the directory, oldest first. */
export function snapshots(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => /^packinglist-\d{4}-\d{2}-\d{2}\.db$/.test(f) && statSync(join(dir, f)).isFile())
      .sort()
  } catch {
    return []
  }
}

/** Run a backup now and then once a day at ~03:00 local time. Returns a stop function. */
export function scheduleBackups(db: Db, opts: BackupOptions, log: { info: (o: object, msg: string) => void; error: (o: object, msg: string) => void }): () => void {
  let timer: NodeJS.Timeout | undefined
  const tick = () => {
    try {
      const path = runBackup(db, opts)
      if (path) log.info({ path }, 'database snapshot written')
    } catch (err) {
      log.error({ err }, 'database snapshot failed')
    }
    timer = setTimeout(tick, msUntilNextRun())
    timer.unref()
  }
  tick()
  return () => clearTimeout(timer)
}

function msUntilNextRun(): number {
  const next = new Date()
  next.setHours(3, 0, 0, 0)
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
  return next.getTime() - Date.now()
}
