import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.ts'

let app: FastifyInstance
beforeAll(async () => {
  app = await buildApp({ dbPath: ':memory:', webDist: '/nonexistent' })
})
afterAll(async () => app.close())

describe('app', () => {
  it('answers healthz', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  it('applies migrations', async () => {
    const tables = (app.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]).map((r) => r.name)
    expect(tables).toEqual(expect.arrayContaining(['categories', 'items', 'packs', 'trips', 'trip_items', 'trip_packs', 'schema_migrations']))
  })
})
