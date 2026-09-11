import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Category, Item, ItemInput, ItemPatch, Pack, PackInput, PackPatch } from '@packing-list/shared'
import { del, get, patch, post, put, request } from './api.ts'

export const keys = {
  categories: ['categories'] as const,
  items: ['items'] as const,
  packs: ['packs'] as const,
}

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => get<Category[]>('/categories') })
}
export function useItems() {
  return useQuery({ queryKey: keys.items, queryFn: () => get<Item[]>('/items') })
}
export function usePacks() {
  return useQuery({ queryKey: keys.packs, queryFn: () => get<Pack[]>('/packs') })
}

/** Invalidate the given keys after a successful mutation. */
function useInvalidating<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, invalidate: readonly (readonly string[])[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k }))),
  })
}

const all = [keys.categories, keys.items, keys.packs]

export const useCreateCategory = () => useInvalidating((body: { name: string }) => post<Category>('/categories', body), [keys.categories])
export const useUpdateCategory = () =>
  useInvalidating(({ id, ...body }: { id: number; name?: string }) => patch<Category>(`/categories/${id}`, body), [keys.categories])
export const useReorderCategories = () => useInvalidating((ids: number[]) => put<Category[]>('/categories/order', { ids }), [keys.categories])
export const useDeleteCategory = () => useInvalidating((id: number) => del(`/categories/${id}`), [keys.categories])

export const useCreateItem = () => useInvalidating((body: ItemInput) => post<Item>('/items', body), [keys.items, keys.packs])
export const useUpdateItem = () => useInvalidating(({ id, ...body }: ItemPatch & { id: number }) => patch<Item>(`/items/${id}`, body), [keys.items, keys.packs])
export const useDeleteItem = () => useInvalidating((id: number) => del(`/items/${id}`), [keys.items, keys.packs])

export const useCreatePack = () => useInvalidating((body: PackInput) => post<Pack>('/packs', body), [keys.packs])
export const useUpdatePack = () => useInvalidating(({ id, ...body }: PackPatch & { id: number }) => patch<Pack>(`/packs/${id}`, body), [keys.packs])
export const useDeletePack = () => useInvalidating((id: number) => del(`/packs/${id}`), [keys.packs])

export const useImport = () =>
  useInvalidating((args: { doc: unknown; mode: 'merge' | 'replace' }) => post<{ items: number }>(`/import?mode=${args.mode}`, args.doc), all)

// ---------- trips ----------
import type { TripDetail, TripItemInput, TripItemPatch, TripListEntry } from '@packing-list/shared'

export const tripKeys = {
  list: ['trips'] as const,
  detail: (id: number) => ['trips', id] as const,
}

export function useTrips() {
  return useQuery({ queryKey: tripKeys.list, queryFn: () => get<TripListEntry[]>('/trips') })
}
export function useTrip(id: number) {
  return useQuery({ queryKey: tripKeys.detail(id), queryFn: () => get<TripDetail>(`/trips/${id}`) })
}

/** Mutation that returns the updated TripDetail: write it straight into the cache. */
function useTripMutation<TArgs>(fn: (args: TArgs) => Promise<TripDetail>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (trip) => {
      qc.setQueryData(tripKeys.detail(trip.id), trip)
      void qc.invalidateQueries({ queryKey: tripKeys.list })
      void qc.invalidateQueries({ queryKey: keys.items }) // tripCount changes
    },
  })
}

export const useCreateTrip = () => useTripMutation((body: { name: string; notes?: string }) => post<TripDetail>('/trips', body))
export const useUpdateTrip = () => useTripMutation(({ id, ...body }: { id: number; name?: string; notes?: string }) => patch<TripDetail>(`/trips/${id}`, body))
export const useDuplicateTrip = () => useTripMutation((id: number) => post<TripDetail>(`/trips/${id}/duplicate`))
export const useSetTripPacks = () => useTripMutation(({ id, packIds }: { id: number; packIds: number[] }) => put<TripDetail>(`/trips/${id}/packs`, { packIds }))
export const useAddLine = () => useTripMutation(({ id, ...body }: TripItemInput & { id: number }) => post<TripDetail>(`/trips/${id}/items`, body))
export const useUpdateLine = () =>
  useTripMutation(({ id, lineId, ...body }: TripItemPatch & { id: number; lineId: number }) => patch<TripDetail>(`/trips/${id}/items/${lineId}`, body))
export const useRemoveLine = () => useTripMutation(({ id, lineId }: { id: number; lineId: number }) => request<TripDetail>('DELETE', `/trips/${id}/items/${lineId}`))
export const useResetPacked = () => useTripMutation((id: number) => post<TripDetail>(`/trips/${id}/reset-packed`))
export const useDeleteTrip = () => useInvalidating((id: number) => del(`/trips/${id}`), [tripKeys.list, keys.items])
