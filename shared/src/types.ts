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
