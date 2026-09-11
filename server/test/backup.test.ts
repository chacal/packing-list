import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { runBackup, snapshots } from '../src/backup.ts'
import { openDb } from '../src/db.ts'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('runBackup', () => {
  it('writes a readable snapshot once per day and prunes old ones', () => {
    const work = mkdtempSync(join(tmpdir(), 'pl-backup-'))
    dirs.push(work)
    const db = openDb(join(work, 'live.db'))
    db.prepare("INSERT INTO categories (name, sort_order) VALUES ('Camping', 0)").run()
    const dir = join(work, 'backup')
    // Older snapshots from previous days
    for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      runBackup(db, { dir, keep: 10, now: new Date(`${day}T12:00:00Z`) })
    }
    expect(snapshots(dir)).toEqual(['packinglist-2026-09-01.db', 'packinglist-2026-09-02.db', 'packinglist-2026-09-03.db'])

    const today = new Date('2026-09-11T12:00:00Z')
    const written = runBackup(db, { dir, keep: 2, now: today })
    expect(written).toBe(join(dir, 'packinglist-2026-09-11.db'))
    expect(snapshots(dir)).toEqual(['packinglist-2026-09-03.db', 'packinglist-2026-09-11.db'])

    // Second run the same day is a no-op.
    expect(runBackup(db, { dir, keep: 2, now: today })).toBeNull()

    const copy = new DatabaseSync(written!, { readOnly: true })
    expect((copy.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }).n).toBe(1)
    copy.close()
    db.close()
    expect(readdirSync(dir)).toHaveLength(2)
  })
})
