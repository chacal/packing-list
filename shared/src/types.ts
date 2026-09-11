export interface Category {
  id: number
  name: string
  sortOrder: number
}

export interface Item {
  id: number
  name: string
  categoryId: number
  weightG: number
  consumable: boolean
  notes: string
  createdAt: string
  updatedAt: string
  /** Number of trips this item appears in. */
  tripCount: number
}

export interface Pack {
  id: number
  name: string
  /** Inventory item this pack is made of, if any. Its weight wins over weightG. */
  itemId: number | null
  /** Own weight of the pack in grams when not linked to an item. */
  weightG: number
  /** Weight that counts: the linked item's weight, or weightG. */
  effectiveWeightG: number
}

export interface Trip {
  id: number
  name: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface TripItem {
  id: number
  tripId: number
  itemId: number
  quantity: number
  packId: number | null
  packed: boolean
  sortOrder: number
}

export interface TripDetail extends Trip {
  /** Packs in use on this trip, in display order. */
  packIds: number[]
  lines: TripItem[]
}

export interface TripListEntry extends Trip {
  lineCount: number
  itemCount: number
  packedCount: number
}

export interface CategorySummary {
  categoryId: number
  name: string
  weightG: number
  itemCount: number
}

export interface PackSummary {
  /** null = lines not assigned to any pack */
  packId: number | null
  name: string
  contentsG: number
  packG: number
  totalG: number
  itemCount: number
}

export interface TripSummary {
  /** Everything: gear plus the packs in use */
  totalG: number
  itemsG: number
  packsG: number
  consumableG: number
  /** total minus consumables */
  baseG: number
  lineCount: number
  itemCount: number
  packedCount: number
  byCategory: CategorySummary[]
  byPack: PackSummary[]
}
