import { useMemo, useState } from 'react'
import type { Item } from '@packing-list/shared'
import { formatWeight } from '@packing-list/shared'
import { Button, EmptyState, ErrorText, Input, Select, Spinner, cx } from '../../components/ui.tsx'
import { useCategories, useCreateItem, useDeleteItem, useItems, usePacks, useUpdateItem } from '../../lib/queries.ts'
import { useLocalStorage } from '../../lib/useLocalStorage.ts'
import { CategoriesDialog } from './CategoriesDialog.tsx'
import { EditableRow, ItemRow, fromDraft, type ItemDraft } from './ItemRow.tsx'
import { PacksDialog } from './PacksDialog.tsx'
import { TransferMenu } from './TransferMenu.tsx'

type SortKey = 'name' | 'category' | 'weight'

export function InventoryPage() {
  const categories = useCategories()
  const items = useItems()
  const packs = usePacks()
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()

  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useLocalStorage<number | ''>('inventory.category', '')
  const [sort, setSort] = useLocalStorage<{ key: SortKey; dir: 1 | -1 }>('inventory.sort', { key: 'category', dir: 1 })
  const [dialog, setDialog] = useState<'categories' | 'packs' | null>(null)
  const [newDraft, setNewDraft] = useState<ItemDraft | null>(null)

  const catById = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c])), [categories.data])

  const visible = useMemo(() => {
    const list = (items.data ?? []).filter((i) => {
      if (categoryId !== '' && i.categoryId !== categoryId) return false
      if (q) {
        const needle = q.toLowerCase()
        return i.name.toLowerCase().includes(needle) || i.notes.toLowerCase().includes(needle)
      }
      return true
    })
    const cmp: Record<SortKey, (a: Item, b: Item) => number> = {
      name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      weight: (a, b) => a.weightG - b.weightG,
      category: (a, b) => (catById.get(a.categoryId)?.sortOrder ?? 0) - (catById.get(b.categoryId)?.sortOrder ?? 0) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    }
    return list.sort((a, b) => cmp[sort.key](a, b) * sort.dir)
  }, [items.data, q, categoryId, sort, catById])

  const total = visible.reduce((s, i) => s + i.weightG, 0)

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }))
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : '')
  const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 select-none'

  const startNew = () => {
    const first = categoryId !== '' ? categoryId : categories.data?.[0]?.id
    if (first === undefined) return
    setNewDraft({ name: '', categoryId: first, weightG: '', consumable: false, notes: '' })
  }

  if (categories.isPending || items.isPending) return <Spinner />
  if (categories.error || items.error) return <div className="p-4"><ErrorText error={categories.error ?? items.error} /></div>

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Inventory</h1>
        <Button variant="ghost" onClick={() => setDialog('categories')}>Categories</Button>
        <Button variant="ghost" onClick={() => setDialog('packs')}>Packs</Button>
        <Button variant="primary" onClick={startNew} disabled={!!newDraft || !categories.data?.length}>+ Add item</Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search name or notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="sm:w-56" value={categoryId} onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">All categories</option>
          {categories.data!.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className={cx(th, 'cursor-pointer')} onClick={() => toggleSort('name')}>Name{arrow('name')}</th>
              <th className={cx(th, 'cursor-pointer')} onClick={() => toggleSort('category')}>Category{arrow('category')}</th>
              <th className={cx(th, 'cursor-pointer text-right')} onClick={() => toggleSort('weight')}>Weight{arrow('weight')}</th>
              <th className={cx(th, 'text-center')} title="Consumable">Cons.</th>
              <th className={cx(th, 'hidden md:table-cell')}>Notes</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {newDraft && (
              <EditableRow
                draft={newDraft}
                categories={categories.data!}
                onChange={setNewDraft}
                autoFocus
                saveLabel="Add"
                saving={createItem.isPending}
                onCancel={() => setNewDraft(null)}
                onSave={() => {
                  if (!newDraft.name.trim()) return
                  createItem.mutate(fromDraft(newDraft), {
                    onSuccess: () => setNewDraft({ ...newDraft, name: '', weightG: '', notes: '', consumable: false }),
                  })
                }}
              />
            )}
            {visible.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                categories={categories.data!}
                onSave={(input) => updateItem.mutateAsync({ id: item.id, ...input })}
                onDelete={() => {
                  const warn = item.tripCount > 0 ? ` It is used in ${item.tripCount} trip(s) and will be removed from them.` : ''
                  if (confirm(`Delete "${item.name}"?${warn}`)) deleteItem.mutate(item.id)
                }}
              />
            ))}
          </tbody>
          <tfoot className="border-t border-stone-200 bg-stone-50 text-xs text-stone-600">
            <tr>
              <td className="px-3 py-2" colSpan={2}>{visible.length} of {items.data!.length} items</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatWeight(total)}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
        {visible.length === 0 && !newDraft && (
          <div className="p-4"><EmptyState>{items.data!.length === 0 ? 'No gear yet. Add an item or import a JSON file.' : 'Nothing matches the filter.'}</EmptyState></div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ErrorText error={createItem.error ?? updateItem.error ?? deleteItem.error} />
        <TransferMenu />
      </div>

      <CategoriesDialog open={dialog === 'categories'} onClose={() => setDialog(null)} categories={categories.data!} items={items.data!} />
      <PacksDialog open={dialog === 'packs'} onClose={() => setDialog(null)} packs={packs.data ?? []} items={items.data!} />
    </div>
  )
}
