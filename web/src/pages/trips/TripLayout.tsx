import { useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router'
import { computeSummary, formatWeight } from '@packing-list/shared'
import { ErrorText, Input, Spinner, cx } from '../../components/ui.tsx'
import { useCategories, useItems, usePacks, useTrip, useUpdateTrip } from '../../lib/queries.ts'

export function useTripId() {
  const { id } = useParams()
  return Number(id)
}

/** Loads everything a trip view needs; children read it via useTripData(). */
export function useTripData() {
  const id = useTripId()
  const trip = useTrip(id)
  const items = useItems()
  const categories = useCategories()
  const packs = usePacks()
  const ready = trip.data && items.data && categories.data && packs.data
  const summary = ready ? computeSummary(trip.data, items.data, categories.data, packs.data) : null
  return {
    id,
    isPending: trip.isPending || items.isPending || categories.isPending || packs.isPending,
    error: trip.error ?? items.error ?? categories.error ?? packs.error,
    trip: trip.data,
    items: items.data ?? [],
    categories: categories.data ?? [],
    packs: packs.data ?? [],
    summary,
  }
}

export function TripLayout() {
  const data = useTripData()
  const update = useUpdateTrip()
  const [editing, setEditing] = useState<string | null>(null)

  if (data.isPending) return <Spinner />
  if (data.error || !data.trip) return <div className="p-4"><ErrorText error={data.error ?? 'Trip not found'} /></div>
  const { trip, summary } = data

  const tab = ({ isActive }: { isActive: boolean }) =>
    cx('border-b-2 px-3 py-2 text-sm font-medium', isActive ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-stone-500 hover:text-stone-800')

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-stone-200 bg-white px-4 pt-3">
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Link to="/trips" className="hover:underline">Trips</Link>
          <span>/</span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {editing !== null ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const name = editing.trim()
                if (name && name !== trip.name) update.mutate({ id: trip.id, name })
                setEditing(null)
              }}
            >
              <Input autoFocus className="text-lg font-semibold" value={editing} onChange={(e) => setEditing(e.target.value)} onBlur={(e) => e.currentTarget.form?.requestSubmit()} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} />
            </form>
          ) : (
            <h1 className="cursor-text text-xl font-semibold hover:underline decoration-stone-300" title="Click to rename" onClick={() => setEditing(trip.name)}>
              {trip.name}
            </h1>
          )}
          {summary && (
            <div className="text-sm text-stone-500 tabular-nums">
              <span className="font-medium text-stone-800">{formatWeight(summary.totalG)}</span> total · {formatWeight(summary.baseG)} base · {summary.itemCount} items
            </div>
          )}
        </div>
        <nav className="mt-2 -mb-px flex gap-1">
          <NavLink to="" end className={tab}>Edit</NavLink>
          <NavLink to="summary" className={tab}>Summary</NavLink>
          <NavLink to="pack" className={tab}>Pack</NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
