import { z } from 'zod'

const name = z.string().trim().min(1, 'Name is required').max(200)
const grams = z.number().int().min(0).max(1_000_000)
const id = z.number().int().positive()

export const categoryInput = z.object({ name })
export const categoryPatch = z.object({ name: name.optional(), sortOrder: z.number().int().min(0).optional() })
export const categoryOrder = z.object({ ids: z.array(id).min(1) })

// Patch schemas are built from the bare fields so that defaults do not
// overwrite existing values when a key is omitted.
const itemFields = { name, categoryId: id, weightG: grams, consumable: z.boolean(), notes: z.string().max(2000) }
export const itemInput = z.object({
  ...itemFields,
  weightG: itemFields.weightG.default(0),
  consumable: itemFields.consumable.default(false),
  notes: itemFields.notes.default(''),
})
export const itemPatch = z.object(itemFields).partial()

const packFields = { name, itemId: id.nullable(), weightG: grams }
export const packInput = z.object({ ...packFields, itemId: packFields.itemId.default(null), weightG: packFields.weightG.default(0) })
export const packPatch = z.object(packFields).partial()

const tripFields = { name, notes: z.string().max(5000) }
export const tripInput = z.object({ ...tripFields, notes: tripFields.notes.default('') })
export const tripPatch = z.object(tripFields).partial()
export const tripPacksInput = z.object({ packIds: z.array(id) })
export const tripItemInput = z.object({
  itemId: id,
  quantity: z.number().int().min(1).max(999).default(1),
  packId: id.nullable().default(null),
})
export const tripItemPatch = z.object({
  quantity: z.number().int().min(1).max(999).optional(),
  packId: id.nullable().optional(),
  packed: z.boolean().optional(),
})

/** Export / import document. Same shape as the original seed.json, references by name. */
export const exportDoc = z.object({
  categories: z.array(z.object({ name, sortOrder: z.number().int().min(0).default(0) })),
  items: z.array(
    z.object({
      name,
      category: name,
      weightGrams: grams.default(0),
      isConsumable: z.boolean().default(false),
      notes: z.string().default(''),
    }),
  ),
  packs: z.array(z.object({ name, sourceItem: z.string().nullable().default(null), weightGrams: grams.default(0) })),
  packingLists: z
    .array(
      z.object({
        name,
        notes: z.string().default(''),
        packs: z.array(z.string()).optional(),
        entries: z.array(
          z.object({
            item: name,
            quantity: z.number().int().min(1).default(1),
            pack: z.string().nullable().default(null),
            packed: z.boolean().default(false),
          }),
        ),
      }),
    )
    .default([]),
})

export type CategoryInput = z.infer<typeof categoryInput>
export type CategoryPatch = z.infer<typeof categoryPatch>
export type ItemInput = z.input<typeof itemInput>
export type ItemPatch = z.infer<typeof itemPatch>
export type PackInput = z.input<typeof packInput>
export type PackPatch = z.infer<typeof packPatch>
export type TripInput = z.input<typeof tripInput>
export type TripPatch = z.infer<typeof tripPatch>
export type TripItemInput = z.input<typeof tripItemInput>
export type TripItemPatch = z.infer<typeof tripItemPatch>
export type ExportDoc = z.infer<typeof exportDoc>
