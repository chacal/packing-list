import { useMemo, useState } from 'react'
import type { Category, Item } from '@packing-list/shared'
import { formatWeight } from '@packing-list/shared'
import { Input, cx } from '../../components/ui.tsx'

/**
 * Inventory browser for adding gear to a trip. Items already on the trip are
 * marked and clicking them removes them again.
 */
export function ItemPicker({
  items,
  categories,
  selectedItemIds,
  onToggle,
  busy,
}: {
  items: Item[]
  categories: Category[]
  selectedItemIds: Set<number>
  onToggle: (item: Item, selected: boolean) => void
  busy?: boolean
}) {
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = items.filter((i) => (categoryId === null || i.categoryId === categoryId) && (!needle || i.name.toLowerCase().includes(needle)))
    return categories
      .map((c) => ({ category: c, items: filtered.filter((i) => i.categoryId === c.id).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })) }))
      .filter((g) => g.items.length > 0)
  }, [items, categories, q, categoryId])

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-stone-200 p-3">
        <Input placeholder="Search gear…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
          <Chip active={categoryId === null} onClick={() => setCategoryId(null)}>All</Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>{c.name}</Chip>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 && <p className="p-4 text-sm text-stone-400">No gear matches.</p>}
        {groups.map((g) => (
          <div key={g.category.id}>
            <div className="sticky top-0 bg-stone-100/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-500 backdrop-blur">{g.category.name}</div>
            <ul>
              {g.items.map((item) => {
                const selected = selectedItemIds.has(item.id)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onToggle(item, selected)}
                      className={cx(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-stone-100',
                        selected && 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
                      )}
                    >
                      <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs', selected ? 'bg-emerald-600 text-white' : 'ring-1 ring-stone-300 text-stone-400')}>
                        {selected ? '✓' : '+'}
                      </span>
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="text-xs text-stone-400 tabular-nums">{formatWeight(item.weightG)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('shrink-0 rounded-full px-2.5 py-1 font-medium whitespace-nowrap', active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200')}
    >
      {children}
    </button>
  )
}
