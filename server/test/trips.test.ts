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
  it('lists the sample trip and computes its weights', async () => {
    const trips = await json<TripListEntry[]>({ url: api('/trips') })
    expect(trips).toHaveLength(1)
    const trip = trips[0]!
    expect(trip).toMatchObject({ name: 'Weekend hike (sample)', lineCount: 33, itemCount: 37, packedCount: 0 })

    const summary = await json<TripSummary>({ url: api(`/trips/${trip.id}/summary`) })
    expect(summary.itemsG).toBe(7917)
    expect(summary.lineCount).toBe(33)
    // Packs in use carry their own weight on top of the gear.
    const detail = await json<TripDetail>({ url: api(`/trips/${trip.id}`) })
    const packs = await json<Pack[]>({ url: api('/packs') })
    const packsG = detail.packIds.reduce((s, id) => s + (packs.find((p) => p.id === id)?.effectiveWeightG ?? 0), 0)
    expect(packsG).toBeGreaterThan(0)
    expect(summary.packsG).toBe(packsG)
    expect(packsG).toBe(1435)
    expect(summary.totalG).toBe(7917 + packsG)
    expect(summary.consumableG).toBe(1230)
    expect(summary.baseG).toBe(summary.totalG - summary.consumableG)

    const shelter = summary.byCategory.find((c) => c.name === 'Shelter')!
    expect(shelter.weightG).toBe(2250)
    expect(summary.byCategory.reduce((s, c) => s + c.weightG, 0)).toBe(7917)
    expect(summary.byPack.reduce((s, p) => s + p.contentsG, 0)).toBe(7917)
    // A pack that is not an inventory item weighs nothing itself.
    const worn = summary.byPack.find((p) => p.name === 'Worn / in hands')!
    expect(worn.packG).toBe(0)
    expect(worn.contentsG).toBe(240)
  })
})

describe('trip editing', () => {
  it('creates, edits lines, manages packs, duplicates and deletes', async () => {
    const items = await json<Item[]>({ url: api('/items') })
    const packs = await json<Pack[]>({ url: api('/packs') })
    const tent = items.find((i) => i.name === 'Two-person tent')!
    const gas = items.find((i) => i.name === 'Gas canister 230 g')!
    const backpack = packs.find((p) => p.name === 'Backpack 58 l')!
    const dryBag = packs.find((p) => p.name === 'Dry bag 13 l')!

    const created = await app.inject({ method: 'POST', url: api('/trips'), payload: { name: 'Weekend' } })
    expect(created.statusCode).toBe(201)
    const trip = created.json() as TripDetail
    expect(trip.lines).toEqual([])

    let d = await json<TripDetail>({ method: 'PUT', url: api(`/trips/${trip.id}/packs`), payload: { packIds: [backpack.id] } })
    expect(d.packIds).toEqual([backpack.id])

    d = await json<TripDetail>({ method: 'POST', url: api(`/trips/${trip.id}/items`), payload: { itemId: tent.id, packId: backpack.id } })
    d = await json<TripDetail>({ method: 'POST', url: api(`/trips/${trip.id}/items`), payload: { itemId: gas.id, quantity: 2, packId: dryBag.id } })
    expect(d.lines).toHaveLength(2)
    // Assigning a pack not yet in use adds it to the trip's packs.
    expect(d.packIds).toEqual([backpack.id, dryBag.id])

    const dup = await app.inject({ method: 'POST', url: api(`/trips/${trip.id}/items`), payload: { itemId: tent.id } })
    expect(dup.statusCode).toBe(409)

    const gasLine = d.lines.find((l) => l.itemId === gas.id)!
    d = await json<TripDetail>({ method: 'PATCH', url: api(`/trips/${trip.id}/items/${gasLine.id}`), payload: { quantity: 3, packed: true } })
    expect(d.lines.find((l) => l.id === gasLine.id)).toMatchObject({ quantity: 3, packed: true, packId: dryBag.id })

    let s = await json<TripSummary>({ url: api(`/trips/${trip.id}/summary`) })
    expect(s.itemsG).toBe(tent.weightG + 3 * gas.weightG)
    expect(s.consumableG).toBe(3 * gas.weightG)
    expect(s.packsG).toBe(backpack.effectiveWeightG + dryBag.effectiveWeightG)
    expect(s.packedCount).toBe(1)

    // Removing a pack from the trip unassigns its lines.
    d = await json<TripDetail>({ method: 'PUT', url: api(`/trips/${trip.id}/packs`), payload: { packIds: [backpack.id] } })
    expect(d.lines.find((l) => l.id === gasLine.id)!.packId).toBeNull()
    s = await json<TripSummary>({ url: api(`/trips/${trip.id}/summary`) })
    expect(s.byPack.map((p) => p.name)).toEqual(['Backpack 58 l', 'Unassigned'])

    const copy = await json<TripDetail>({ method: 'POST', url: api(`/trips/${trip.id}/duplicate`) })
    expect(copy.name).toBe('Weekend (copy)')
    expect(copy.lines).toHaveLength(2)
    expect(copy.lines.every((l) => !l.packed)).toBe(true)
    expect(copy.packIds).toEqual([backpack.id])

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
