import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance, InjectOptions } from 'fastify'
import type { Item, Pack, TripDetail, TripListEntry, TripSummary } from '@packing-list/shared'
import { buildApp, defaultSeedFile } from '../src/app.ts'

let app: FastifyInstance
beforeAll(async () => {
  app = await buildApp({ dbPath: ':memory:', webDist: '/nonexistent', seedFile: defaultSeedFile })
})
afterAll(async () => app.close())
const api = (url: string) => `/api/v1${url}`
const json = async <T>(opts: InjectOptions) => {
  const res = await app.inject(opts)
  if (res.statusCode >= 400) throw new Error(`${res.statusCode} ${res.body}`)
  return res.json() as T
}

describe('seeded trip', () => {
  it('lists the sheet trip and reproduces its total of 8.8 kg', async () => {
    const trips = await json<TripListEntry[]>({ url: api('/trips') })
    expect(trips).toHaveLength(1)
    const trip = trips[0]!
    expect(trip).toMatchObject({ name: 'Saariston rengastie', lineCount: 58, packedCount: 0 })

    const summary = await json<TripSummary>({ url: api(`/trips/${trip.id}/summary`) })
    expect(summary.itemsG).toBe(8798)
    expect(summary.lineCount).toBe(58)
    // Packs in use carry their own weight on top of the gear.
    const detail = await json<TripDetail>({ url: api(`/trips/${trip.id}`) })
    const packs = await json<Pack[]>({ url: api('/packs') })
    const packsG = detail.packIds.reduce((s, id) => s + (packs.find((p) => p.id === id)?.effectiveWeightG ?? 0), 0)
    expect(packsG).toBeGreaterThan(0)
    expect(summary.packsG).toBe(packsG)
    expect(summary.totalG).toBe(8798 + packsG)
    expect(summary.baseG).toBe(summary.totalG - summary.consumableG)
    expect(summary.consumableG).toBeGreaterThan(0)

    const camping = summary.byCategory.find((c) => c.name === 'Camping')!
    expect(camping.weightG).toBe(3176)
    expect(summary.byCategory.reduce((s, c) => s + c.weightG, 0)).toBe(8798)
    expect(summary.byPack.reduce((s, p) => s + p.contentsG, 0)).toBe(8798)
    const runkoteline = summary.byPack.find((p) => p.name === 'Runkoteline')!
    expect(runkoteline.contentsG).toBe(1200)
  })
})

describe('trip editing', () => {
  it('creates, edits lines, manages packs, duplicates and deletes', async () => {
    const items = await json<Item[]>({ url: api('/items') })
    const packs = await json<Pack[]>({ url: api('/packs') })
    const tent = items.find((i) => i.name === 'Abisko Lite 2')!
    const gas = items.find((i) => i.name === 'Kaasu (pieni)')!
    const exos = packs.find((p) => p.name === 'Exos 58')!
    const dryBag = packs.find((p) => p.name === 'Ortlieb dry bag (musta)')!

    const created = await app.inject({ method: 'POST', url: api('/trips'), payload: { name: 'Weekend' } })
    expect(created.statusCode).toBe(201)
    const trip = created.json() as TripDetail
    expect(trip.lines).toEqual([])

    let d = await json<TripDetail>({ method: 'PUT', url: api(`/trips/${trip.id}/packs`), payload: { packIds: [exos.id] } })
    expect(d.packIds).toEqual([exos.id])

    d = await json<TripDetail>({ method: 'POST', url: api(`/trips/${trip.id}/items`), payload: { itemId: tent.id, packId: exos.id } })
    d = await json<TripDetail>({ method: 'POST', url: api(`/trips/${trip.id}/items`), payload: { itemId: gas.id, quantity: 2, packId: dryBag.id } })
    expect(d.lines).toHaveLength(2)
    // Assigning a pack not yet in use adds it to the trip's packs.
    expect(d.packIds).toEqual([exos.id, dryBag.id])

    const dup = await app.inject({ method: 'POST', url: api(`/trips/${trip.id}/items`), payload: { itemId: tent.id } })
    expect(dup.statusCode).toBe(409)

    const gasLine = d.lines.find((l) => l.itemId === gas.id)!
    d = await json<TripDetail>({ method: 'PATCH', url: api(`/trips/${trip.id}/items/${gasLine.id}`), payload: { quantity: 3, packed: true } })
    expect(d.lines.find((l) => l.id === gasLine.id)).toMatchObject({ quantity: 3, packed: true, packId: dryBag.id })

    let s = await json<TripSummary>({ url: api(`/trips/${trip.id}/summary`) })
    expect(s.itemsG).toBe(tent.weightG + 3 * gas.weightG)
    expect(s.consumableG).toBe(3 * gas.weightG)
    expect(s.packsG).toBe(exos.effectiveWeightG + dryBag.effectiveWeightG)
    expect(s.packedCount).toBe(1)

    // Removing a pack from the trip unassigns its lines.
    d = await json<TripDetail>({ method: 'PUT', url: api(`/trips/${trip.id}/packs`), payload: { packIds: [exos.id] } })
    expect(d.lines.find((l) => l.id === gasLine.id)!.packId).toBeNull()
    s = await json<TripSummary>({ url: api(`/trips/${trip.id}/summary`) })
    expect(s.byPack.map((p) => p.name)).toEqual(['Exos 58', 'Unassigned'])

    const copy = await json<TripDetail>({ method: 'POST', url: api(`/trips/${trip.id}/duplicate`) })
    expect(copy.name).toBe('Weekend (copy)')
    expect(copy.lines).toHaveLength(2)
    expect(copy.lines.every((l) => !l.packed)).toBe(true)
    expect(copy.packIds).toEqual([exos.id])

    d = await json<TripDetail>({ method: 'POST', url: api(`/trips/${trip.id}/reset-packed`) })
    expect(d.lines.every((l) => !l.packed)).toBe(true)

    d = await json<TripDetail>({ method: 'DELETE', url: api(`/trips/${trip.id}/items/${gasLine.id}`) })
    expect(d.lines).toHaveLength(1)

    const renamed = await json<TripDetail>({ method: 'PATCH', url: api(`/trips/${trip.id}`), payload: { name: 'Long weekend' } })
    expect(renamed.name).toBe('Long weekend')

    expect((await app.inject({ method: 'DELETE', url: api(`/trips/${trip.id}`) })).statusCode).toBe(204)
    expect((await app.inject({ url: api(`/trips/${trip.id}`) })).statusCode).toBe(404)
    expect((await app.inject({ method: 'DELETE', url: api(`/trips/${copy.id}`) })).statusCode).toBe(204)
  })
})
