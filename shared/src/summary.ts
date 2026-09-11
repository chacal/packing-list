import type { Category, Item, Pack, TripDetail, TripSummary } from './types.ts'

/**
 * Pure computation of a trip's weights. Same code runs on the server and in the
 * browser so numbers never disagree.
 */
export function computeSummary(trip: TripDetail, items: Item[], categories: Category[], packs: Pack[]): TripSummary {
  const itemById = new Map(items.map((i) => [i.id, i]))
  const packById = new Map(packs.map((p) => [p.id, p]))
  const catOrder = new Map(categories.map((c, i) => [c.id, i]))

  const byCategory = new Map<number, { weightG: number; itemCount: number }>()
  const byPack = new Map<number | null, { contentsG: number; itemCount: number }>()
  for (const id of trip.packIds) byPack.set(id, { contentsG: 0, itemCount: 0 })

  let itemsG = 0
  let consumableG = 0
  let itemCount = 0
  let packedCount = 0
  for (const line of trip.lines) {
    const item = itemById.get(line.itemId)
    if (!item) continue
    const w = item.weightG * line.quantity
    itemsG += w
    itemCount += line.quantity
    if (item.consumable) consumableG += w
    if (line.packed) packedCount++

    const cat = byCategory.get(item.categoryId) ?? { weightG: 0, itemCount: 0 }
    cat.weightG += w
    cat.itemCount += line.quantity
    byCategory.set(item.categoryId, cat)

    const key = line.packId !== null && packById.has(line.packId) ? line.packId : null
    const p = byPack.get(key) ?? { contentsG: 0, itemCount: 0 }
    p.contentsG += w
    p.itemCount += line.quantity
    byPack.set(key, p)
  }

  let packsG = 0
  const packRows = [...byPack.entries()].map(([packId, v]) => {
    const pack = packId === null ? undefined : packById.get(packId)
    const packG = pack?.effectiveWeightG ?? 0
    packsG += packG
    return { packId, name: pack?.name ?? 'Unassigned', contentsG: v.contentsG, packG, totalG: v.contentsG + packG, itemCount: v.itemCount }
  })
  // Keep the trip's pack order; unassigned last.
  const order = new Map(trip.packIds.map((id, i) => [id, i]))
  packRows.sort((a, b) => (a.packId === null ? 1e9 : (order.get(a.packId) ?? 1e8)) - (b.packId === null ? 1e9 : (order.get(b.packId) ?? 1e8)))

  const categoryRows = [...byCategory.entries()]
    .map(([categoryId, v]) => ({ categoryId, name: categories.find((c) => c.id === categoryId)?.name ?? '?', ...v }))
    .sort((a, b) => (catOrder.get(a.categoryId) ?? 0) - (catOrder.get(b.categoryId) ?? 0))

  const totalG = itemsG + packsG
  return {
    totalG,
    itemsG,
    packsG,
    consumableG,
    baseG: totalG - consumableG,
    lineCount: trip.lines.length,
    itemCount,
    packedCount,
    byCategory: categoryRows,
    byPack: packRows,
  }
}
