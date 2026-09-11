import { useMemo, useState } from 'react'
import type { Item, TripItem } from '@packing-list/shared'
import { formatWeight } from '@packing-list/shared'
import { Button, Dialog, EmptyState, ErrorText, IconButton, Select, cx } from '../../components/ui.tsx'
import { useAddLine, useRemoveLine, useUpdateLine } from '../../lib/queries.ts'
import { ItemPicker } from './ItemPicker.tsx'
import { useTripData } from './TripLayout.tsx'
import { TripPacksDialog } from './TripPacksDialog.tsx'

export function TripEditorPage() {
  const { trip, items, categories, packs, summary } = useTripData()
  const add = useAddLine()
  const update = useUpdateLine()
  const remove = useRemoveLine()
  const [packsOpen, setPacksOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  if (!trip || !summary) return null

  const itemById = new Map(items.map((i) => [i.id, i]))
  const selected = new Set(trip.lines.map((l) => l.itemId))
  const tripPacks = trip.packIds.map((id) => packs.find((p) => p.id === id)).filter((p) => p !== undefined)
  const busy = add.isPending || update.isPending || remove.isPending

  const groups = useMemo(
    () =>
      categories
        .map((c) => ({
          category: c,
          lines: trip.lines
            .filter((l) => itemById.get(l.itemId)?.categoryId === c.id)
            .sort((a, b) => (itemById.get(a.itemId)?.name ?? '').localeCompare(itemById.get(b.itemId)?.name ?? '', undefined, { sensitivity: 'base' })),
        }))
        .filter((g) => g.lines.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trip.lines, categories, items],
  )

  const onToggle = (item: Item, isSelected: boolean) => {
    if (isSelected) {
      const line = trip.lines.find((l) => l.itemId === item.id)
      if (line) remove.mutate({ id: trip.id, lineId: line.id })
    } else {
      // Default to the first pack in use so most lines need no further clicks.
      add.mutate({ id: trip.id, itemId: item.id, quantity: 1, packId: trip.packIds[0] ?? null })
    }
  }

  const picker = <ItemPicker items={items} categories={categories} selectedItemIds={selected} onToggle={onToggle} busy={busy} />

  return (
    <div className="flex flex-1 md:h-[calc(100vh-9.5rem)]">
      <aside className="hidden w-80 shrink-0 border-r border-stone-200 bg-white md:block lg:w-96">{picker}</aside>

      <section className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-stone-500">Packs:</span>
            {tripPacks.length === 0 && <span className="text-stone-400">none</span>}
            {tripPacks.map((p) => (
              <span key={p.id} className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{p.name}</span>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setPacksOpen(true)}>Edit packs</Button>
          </div>
          <Button className="ml-auto md:hidden" variant="primary" onClick={() => setPickerOpen(true)}>+ Add gear</Button>
        </div>

        {trip.lines.length === 0 ? (
          <EmptyState>Nothing on this trip yet. Pick gear from the inventory list{' '}<span className="md:hidden">with “Add gear”</span><span className="hidden md:inline">on the left</span>.</EmptyState>
        ) : (
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr><th>Item</th><th>Qty</th><th>Pack</th><th>Weight</th><th></th></tr>
              </thead>
              {groups.map((g) => {
                const cat = summary.byCategory.find((c) => c.categoryId === g.category.id)
                return (
                  <tbody key={g.category.id} className="border-t border-stone-200 first:border-t-0">
                    <tr className="bg-stone-50">
                      <td colSpan={3} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">{g.category.name}</td>
                      <td className="px-3 py-1.5 text-right text-xs font-semibold text-stone-500 tabular-nums">{formatWeight(cat?.weightG ?? 0)}</td>
                      <td></td>
                    </tr>
                    {g.lines.map((line) => (
                      <LineRow
                        key={line.id}
                        line={line}
                        item={itemById.get(line.itemId)}
                        packs={tripPacks}
                        busy={busy}
                        onChange={(patch) => update.mutate({ id: trip.id, lineId: line.id, ...patch })}
                        onRemove={() => remove.mutate({ id: trip.id, lineId: line.id })}
                      />
                    ))}
                  </tbody>
                )
              })}
              <tfoot className="border-t border-stone-200 bg-stone-50 text-xs text-stone-600">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>
                    {summary.itemCount} items · gear {formatWeight(summary.itemsG)} + packs {formatWeight(summary.packsG)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-stone-900 tabular-nums">{formatWeight(summary.totalG)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="mt-2"><ErrorText error={add.error ?? update.error ?? remove.error} /></div>
      </section>

      <TripPacksDialog open={packsOpen} onClose={() => setPacksOpen(false)} trip={trip} packs={packs} />
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} title="Add gear">
        <div className="-mx-5 -my-4 h-[70vh]">{picker}</div>
      </Dialog>
    </div>
  )
}

function LineRow({
  line,
  item,
  packs,
  busy,
  onChange,
  onRemove,
}: {
  line: TripItem
  item: Item | undefined
  packs: { id: number; name: string }[]
  busy: boolean
  onChange: (patch: { quantity?: number; packId?: number | null }) => void
  onRemove: () => void
}) {
  if (!item) return null
  const cell = 'px-3 py-1.5 align-middle'
  return (
    <tr className="group border-t border-stone-100 hover:bg-stone-50">
      <td className={cx(cell, 'font-medium')}>
        {item.name}
        {item.consumable && <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase text-amber-800" title="Consumable">cons</span>}
      </td>
      <td className={cx(cell, 'w-20')}>
        <div className="flex items-center gap-0.5">
          <IconButton label="Less" className="h-6 w-6" disabled={busy || line.quantity <= 1} onClick={() => onChange({ quantity: line.quantity - 1 })}>−</IconButton>
          <span className="w-5 text-center tabular-nums">{line.quantity}</span>
          <IconButton label="More" className="h-6 w-6" disabled={busy} onClick={() => onChange({ quantity: line.quantity + 1 })}>+</IconButton>
        </div>
      </td>
      <td className={cx(cell, 'w-72 max-w-[45%]')}>
        <Select className="h-8" value={line.packId ?? ''} disabled={busy} onChange={(e) => onChange({ packId: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— no pack —</option>
          {packs.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </td>
      <td className={cx(cell, 'w-16 text-right whitespace-nowrap tabular-nums text-stone-700')}>{formatWeight(item.weightG * line.quantity)}</td>
      <td className={cx(cell, 'w-8 pl-0 text-right')}>
        <IconButton label="Remove from trip" className="opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 hover:text-red-700" disabled={busy} onClick={onRemove}>✕</IconButton>
      </td>
    </tr>
  )
}
