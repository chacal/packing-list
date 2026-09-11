import type { Category, Item, Pack, Trip, TripItem } from '@packing-list/shared'

// Raw SQLite row shapes (snake_case) and their mappers to API objects.

export interface CategoryRow { id: number; name: string; sort_order: number }
export const toCategory = (r: CategoryRow): Category => ({ id: r.id, name: r.name, sortOrder: r.sort_order })

export interface ItemRow {
  id: number; name: string; category_id: number; weight_g: number; consumable: number
  notes: string; created_at: string; updated_at: string; trip_count: number
}
export const toItem = (r: ItemRow): Item => ({
  id: r.id, name: r.name, categoryId: r.category_id, weightG: r.weight_g, consumable: r.consumable === 1,
  notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at, tripCount: r.trip_count,
})
export const ITEM_SELECT = `
  SELECT i.*, (SELECT COUNT(*) FROM trip_items ti WHERE ti.item_id = i.id) AS trip_count
  FROM items i`

export interface PackRow { id: number; name: string; item_id: number | null; weight_g: number; effective_weight_g: number }
export const toPack = (r: PackRow): Pack => ({
  id: r.id, name: r.name, itemId: r.item_id, weightG: r.weight_g, effectiveWeightG: r.effective_weight_g,
})
export const PACK_SELECT = `
  SELECT p.*, COALESCE(i.weight_g, p.weight_g) AS effective_weight_g
  FROM packs p LEFT JOIN items i ON i.id = p.item_id`

export interface TripRow { id: number; name: string; notes: string; created_at: string; updated_at: string }
export const toTrip = (r: TripRow): Trip => ({ id: r.id, name: r.name, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at })

export interface TripItemRow {
  id: number; trip_id: number; item_id: number; quantity: number; pack_id: number | null; packed: number; sort_order: number
}
export const toTripItem = (r: TripItemRow): TripItem => ({
  id: r.id, tripId: r.trip_id, itemId: r.item_id, quantity: r.quantity, packId: r.pack_id, packed: r.packed === 1, sortOrder: r.sort_order,
})
