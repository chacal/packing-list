import type { Pack, TripDetail } from '@packing-list/shared'
import { formatWeight } from '@packing-list/shared'
import { Checkbox, Dialog, IconButton } from '../../components/ui.tsx'
import { useSetTripPacks } from '../../lib/queries.ts'

/** Choose which packs this trip uses and their order. */
export function TripPacksDialog({ open, onClose, trip, packs }: { open: boolean; onClose: () => void; trip: TripDetail; packs: Pack[] }) {
  const set = useSetTripPacks()
  const inUse = trip.packIds
  const toggle = (id: number, on: boolean) => set.mutate({ id: trip.id, packIds: on ? [...inUse, id] : inUse.filter((p) => p !== id) })
  const move = (index: number, dir: -1 | 1) => {
    const ids = [...inUse]
    const t = index + dir
    if (t < 0 || t >= ids.length) return
    ;[ids[index], ids[t]] = [ids[t]!, ids[index]!]
    set.mutate({ id: trip.id, packIds: ids })
  }
  const ordered = [...inUse.map((id) => packs.find((p) => p.id === id)).filter((p): p is Pack => !!p), ...packs.filter((p) => !inUse.includes(p.id))]

  return (
    <Dialog open={open} onClose={onClose} title="Packs on this trip">
      <p className="mb-3 text-sm text-stone-500">Tick the bags you are taking. Their own weight is added to the trip total. Manage the pack list itself under Inventory → Packs.</p>
      <ul className="divide-y divide-stone-100">
        {ordered.map((p) => {
          const idx = inUse.indexOf(p.id)
          const on = idx >= 0
          return (
            <li key={p.id} className="flex h-10 items-center gap-2">
              <Checkbox checked={on} disabled={set.isPending} onChange={(e) => toggle(p.id, e.target.checked)} />
              <span className="flex-1">{p.name}</span>
              <span className="text-xs text-stone-400 tabular-nums">{formatWeight(p.effectiveWeightG)}</span>
              {on && (
                <>
                  <IconButton label="Move up" className="h-7 w-7 text-xs" disabled={idx === 0} onClick={() => move(idx, -1)}>▲</IconButton>
                  <IconButton label="Move down" className="h-7 w-7 text-xs" disabled={idx === inUse.length - 1} onClick={() => move(idx, 1)}>▼</IconButton>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}
