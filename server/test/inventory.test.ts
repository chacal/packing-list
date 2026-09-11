import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Category, Item, Pack } from '@packing-list/shared'
import { buildApp, defaultSeedFile } from '../src/app.ts'
import { exportAll } from '../src/transfer.ts'

let app: FastifyInstance
beforeAll(async () => {
  app = await buildApp({ dbPath: ':memory:', webDist: '/nonexistent', seedFile: defaultSeedFile })
})
afterAll(async () => app.close())

const api = (url: string) => `/api/v1${url}`

describe('seed', () => {
  it('imports the sheet into an empty database', async () => {
    const cats = (await app.inject({ url: api('/categories') })).json() as Category[]
    expect(cats.map((c) => c.name)).toEqual(['Camping', 'Packs', 'Cooking', 'Clothing', 'Electronics', 'Food', 'Hygiene', 'Misc'])
    const items = (await app.inject({ url: api('/items') })).json() as Item[]
    expect(items).toHaveLength(108)
    const packs = (await app.inject({ url: api('/packs') })).json() as Pack[]
    expect(packs).toHaveLength(10)
    const forkPack = packs.find((p) => p.name === 'Ortlieb fork pack (red)')!
    expect(forkPack.itemId).not.toBeNull()
    expect(forkPack.effectiveWeightG).toBe(255)
    const trips = app.db.prepare('SELECT COUNT(*) AS n FROM trips').get() as { n: number }
    expect(trips.n).toBe(1)
  })

  it('does not re-seed a populated database', async () => {
    const again = await buildApp({ dbPath: ':memory:', webDist: '/nonexistent' })
    expect((await again.inject({ url: api('/items') })).json()).toEqual([])
    await again.close()
  })
})

describe('categories', () => {
  it('creates, renames, reorders and refuses to delete a used category', async () => {
    const created = await app.inject({ method: 'POST', url: api('/categories'), payload: { name: 'Fishing' } })
    expect(created.statusCode).toBe(201)
    const cat = created.json() as Category
    expect(cat.sortOrder).toBe(8)

    const renamed = await app.inject({ method: 'PATCH', url: api(`/categories/${cat.id}`), payload: { name: 'Angling' } })
    expect((renamed.json() as Category).name).toBe('Angling')

    const dup = await app.inject({ method: 'POST', url: api('/categories'), payload: { name: 'Camping' } })
    expect(dup.statusCode).toBe(409)

    const camping = ((await app.inject({ url: api('/categories') })).json() as Category[]).find((c) => c.name === 'Camping')!
    const del = await app.inject({ method: 'DELETE', url: api(`/categories/${camping.id}`) })
    expect(del.statusCode).toBe(409)

    const all = (await app.inject({ url: api('/categories') })).json() as Category[]
    const ids = all.map((c) => c.id).reverse()
    const reordered = await app.inject({ method: 'PUT', url: api('/categories/order'), payload: { ids } })
    expect((reordered.json() as Category[]).map((c) => c.id)).toEqual(ids)

    const gone = await app.inject({ method: 'DELETE', url: api(`/categories/${cat.id}`) })
    expect(gone.statusCode).toBe(204)
  })
})

describe('items', () => {
  it('supports full CRUD and filtering', async () => {
    const cats = (await app.inject({ url: api('/categories') })).json() as Category[]
    const cooking = cats.find((c) => c.name === 'Cooking')!

    const bad = await app.inject({ method: 'POST', url: api('/items'), payload: { name: '', categoryId: cooking.id } })
    expect(bad.statusCode).toBe(400)

    const created = await app.inject({
      method: 'POST',
      url: api('/items'),
      payload: { name: 'Titanium spork', categoryId: cooking.id, weightG: 17, consumable: false, notes: 'long handle' },
    })
    expect(created.statusCode).toBe(201)
    const item = created.json() as Item
    expect(item).toMatchObject({ name: 'Titanium spork', weightG: 17, consumable: false, tripCount: 0 })

    const patched = await app.inject({ method: 'PATCH', url: api(`/items/${item.id}`), payload: { weightG: 19, consumable: true } })
    expect(patched.json()).toMatchObject({ weightG: 19, consumable: true, notes: 'long handle' })

    const search = (await app.inject({ url: api('/items?q=spork') })).json() as Item[]
    expect(search.map((i) => i.name)).toEqual(['Titanium spork'])
    const byCat = (await app.inject({ url: api(`/items?categoryId=${cooking.id}`) })).json() as Item[]
    expect(byCat.every((i) => i.categoryId === cooking.id)).toBe(true)
    expect(byCat.length).toBeGreaterThan(10)

    expect((await app.inject({ method: 'DELETE', url: api(`/items/${item.id}`) })).statusCode).toBe(204)
    expect((await app.inject({ url: api(`/items/${item.id}`) })).statusCode).toBe(404)
  })

  it('reports trip usage and cascades deletes into trips', async () => {
    const items = (await app.inject({ url: api('/items') })).json() as Item[]
    const tarp = items.find((i) => i.name === 'Need for trees tarp + snakeskin')!
    expect(tarp.tripCount).toBe(1)
    const before = (app.db.prepare('SELECT COUNT(*) AS n FROM trip_items').get() as { n: number }).n
    await app.inject({ method: 'DELETE', url: api(`/items/${tarp.id}`) })
    const after = (app.db.prepare('SELECT COUNT(*) AS n FROM trip_items').get() as { n: number }).n
    expect(after).toBe(before - 1)
  })
})

describe('packs', () => {
  it('uses the linked item weight, else its own', async () => {
    const created = await app.inject({ method: 'POST', url: api('/packs'), payload: { name: 'Hip belt pocket', weightG: 40 } })
    expect(created.statusCode).toBe(201)
    const pack = created.json() as Pack
    expect(pack).toMatchObject({ itemId: null, weightG: 40, effectiveWeightG: 40 })

    const items = (await app.inject({ url: api('/items') })).json() as Item[]
    const exos = items.find((i) => i.name === 'Exos 58')!
    const linked = (await app.inject({ method: 'PATCH', url: api(`/packs/${pack.id}`), payload: { itemId: exos.id } })).json() as Pack
    expect(linked.effectiveWeightG).toBe(1300)

    const unlinked = (await app.inject({ method: 'PATCH', url: api(`/packs/${pack.id}`), payload: { itemId: null } })).json() as Pack
    expect(unlinked.effectiveWeightG).toBe(40)

    expect((await app.inject({ method: 'DELETE', url: api(`/packs/${pack.id}`) })).statusCode).toBe(204)
  })
})

describe('export / import', () => {
  it('round-trips through export and replace-import', async () => {
    const exported = await app.inject({ url: api('/export') })
    expect(exported.statusCode).toBe(200)
    expect(exported.headers['content-disposition']).toContain('packing-list-')
    const doc = exported.json()

    const fresh = await buildApp({ dbPath: ':memory:', webDist: '/nonexistent' })
    const res = await fresh.inject({ method: 'POST', url: api('/import?mode=replace'), payload: doc })
    expect(res.statusCode).toBe(200)
    expect(exportAll(fresh.db)).toEqual(doc)
    await fresh.close()
  })

  it('merge-import updates existing items by name and rejects unknown references', async () => {
    const items = (await app.inject({ url: api('/items') })).json() as Item[]
    const puukko = items.find((i) => i.name === 'Puukko')!
    const res = await app.inject({
      method: 'POST',
      url: api('/import'),
      payload: { categories: [], items: [{ name: 'Puukko', category: 'Cooking', weightGrams: 155 }], packs: [], packingLists: [] },
    })
    expect(res.statusCode).toBe(200)
    expect(((await app.inject({ url: api(`/items/${puukko.id}`) })).json() as Item).weightG).toBe(155)

    const bad = await app.inject({
      method: 'POST',
      url: api('/import'),
      payload: { categories: [], items: [], packs: [{ name: 'X', sourceItem: 'Nope' }], packingLists: [] },
    })
    expect(bad.statusCode).toBe(400)
    expect((bad.json() as { error: string }).error).toContain('Nope')
  })
})
