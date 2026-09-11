import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { TripDetail, TripItem } from '@packing-list/shared'
import { formatWeight } from '@packing-list/shared'
import { Button, EmptyState, ErrorText, cx } from '../../components/ui.tsx'
import { tripKeys, useResetPacked, useUpdateLine } from '../../lib/queries.ts'
import { useLocalStorage } from '../../lib/useLocalStorage.ts'
import { useTripData } from './TripLayout.tsx'

type GroupBy = 'category' | 'pack'

/**
 * Phone-first checklist. Group by category when collecting gear around the
 * house, by pack when stuffing the bags. Checkmarks are stored on the server.
 */
export function PackingPage() {
  const { trip, items, categories, packs, summary } = useTripData()
  const [groupBy, setGroupBy] = useLocalStorage<GroupBy>('packing.groupBy', 'category')
  const [hidePacked, setHidePacked] = useLocalStorage('packing.hidePacked', false)
  const update = useUpdateLine()
  const reset = useResetPacked()
  const qc = useQueryClient()

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const packById = useMemo(() => new Map(packs.map((p) => [p.id, p])), [packs])
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  if (!trip || !summary) return null

  const toggle = (line: TripItem) => {
    const packed = !line.packed
    // Optimistic: flip locally right away so the tap feels instant on a phone.
    qc.setQueryData<TripDetail>(tripKeys.detail(trip.id), (old) => old && { ...old, lines: old.lines.map((l) => (l.id === line.id ? { ...l, packed } : l)) })
    update.mutate({ id: trip.id, lineId: line.id, packed }, { onError: () => void qc.invalidateQueries({ queryKey: tripKeys.detail(trip.id) }) })
  }

  const byName = (a: TripItem, b: TripItem) => (itemById.get(a.itemId)?.name ?? '').localeCompare(itemById.get(b.itemId)?.name ?? '', undefined, { sensitivity: 'base' })
  const groups: { key: string; name: string; lines: TripItem[] }[] =
    groupBy === 'category'
      ? categories.map((c) => ({ key: `c${c.id}`, name: c.name, lines: trip.lines.filter((l) => itemById.get(l.itemId)?.categoryId === c.id).sort(byName) }))
      : [
          ...trip.packIds.map((id) => ({ key: `p${id}`, name: packById.get(id)?.name ?? '?', lines: trip.lines.filter((l) => l.packId === id).sort(byName) })),
          { key: 'none', name: 'No pack', lines: trip.lines.filter((l) => l.packId === null || !trip.packIds.includes(l.packId)).sort(byName) },
        ]
  const visibleGroups = groups.filter((g) => g.lines.length > 0)
  const done = summary.packedCount === summary.lineCount && summary.lineCount > 0

  return (
    <div className="mx-auto w-full max-w-2xl p-3 sm:p-4">
      <div className="sticky top-0 z-10 -mx-3 mb-3 border-b border-stone-200 bg-stone-50/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <div className="flex items-center gap-2">
          <div className="flex rounded-md bg-stone-200 p-0.5 text-sm">
            {(['category', 'pack'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={cx('rounded px-2.5 py-1 font-medium capitalize whitespace-nowrap', groupBy === g ? 'bg-white shadow text-stone-900' : 'text-stone-600')}
              >
                {g}
              </button>
            ))}
          </div>
          <label className="ml-1 flex items-center gap-1.5 text-sm text-stone-600 whitespace-nowrap">
            <input type="checkbox" className="accent-emerald-700" checked={hidePacked} onChange={(e) => setHidePacked(e.target.checked)} />
            Hide packed
          </label>
          <Button size="sm" variant="ghost" className="ml-auto" disabled={summary.packedCount === 0 || reset.isPending} onClick={() => confirm('Uncheck everything?') && reset.mutate(trip.id)}>
            Reset
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-stone-500 tabular-nums">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
            <div className={cx('h-full transition-all', done ? 'bg-emerald-600' : 'bg-emerald-500')} style={{ width: `${summary.lineCount ? (summary.packedCount / summary.lineCount) * 100 : 0}%` }} />
          </div>
          <span>{summary.packedCount}/{summary.lineCount} packed</span>
        </div>
      </div>

      {trip.lines.length === 0 && <EmptyState>Nothing to pack. Add gear in the editor first.</EmptyState>}
      {done && !hidePacked && <div className="mb-3 rounded-lg bg-emerald-100 p-3 text-center text-sm font-medium text-emerald-900">All packed. Have a good trip! 🏕️</div>}

      <div className="space-y-4">
        {visibleGroups.map((g) => {
          const lines = hidePacked ? g.lines.filter((l) => !l.packed) : g.lines
          if (lines.length === 0) return null
          const packedHere = g.lines.filter((l) => l.packed).length
          const weight = g.lines.reduce((s, l) => s + (itemById.get(l.itemId)?.weightG ?? 0) * l.quantity, 0)
          return (
            <section key={g.key} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <header className="flex items-baseline gap-2 bg-stone-50 px-3 py-2">
                <h2 className="font-semibold">{g.name}</h2>
                <span className="text-xs text-stone-500 tabular-nums">{packedHere}/{g.lines.length}</span>
                <span className="ml-auto text-xs text-stone-500 tabular-nums">{formatWeight(weight)}</span>
              </header>
              <ul className="divide-y divide-stone-100">
                {lines.map((line) => {
                  const item = itemById.get(line.itemId)
                  if (!item) return null
                  const secondary = groupBy === 'category' ? (line.packId !== null ? packById.get(line.packId)?.name : 'no pack') : catById.get(item.categoryId)?.name
                  return (
                    <li key={line.id}>
                      <button
                        type="button"
                        onClick={() => toggle(line)}
                        className={cx('flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left active:bg-stone-100', line.packed && 'text-stone-400')}
                      >
                        <span
                          className={cx(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm transition-colors',
                            line.packed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300',
                          )}
                        >
                          {line.packed && '✓'}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={cx('block truncate', line.packed && 'line-through')}>
                            {item.name}
                            {line.quantity > 1 && <span className="ml-1.5 rounded bg-stone-100 px-1.5 text-xs font-semibold text-stone-700">×{line.quantity}</span>}
                          </span>
                          <span className="block truncate text-xs text-stone-400">{secondary}</span>
                        </span>
                        <span className="text-xs text-stone-400 tabular-nums">{formatWeight(item.weightG * line.quantity)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
      <div className="mt-3"><ErrorText error={update.error ?? reset.error} /></div>
    </div>
  )
}
