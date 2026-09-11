import { useEffect, useState } from 'react'
import type { Category, Item, ItemInput } from '@packing-list/shared'
import { Button, Checkbox, Dialog, ErrorText, Input, Select } from '../../components/ui.tsx'
import { fromDraft, toDraft, type ItemDraft } from './ItemRow.tsx'

/** Form dialog for creating or editing an item; used on phones instead of inline rows. */
export function ItemDialog({
  open,
  onClose,
  item,
  categories,
  defaultCategoryId,
  onSave,
  onDelete,
  error,
  busy,
}: {
  open: boolean
  onClose: () => void
  /** Existing item to edit, or null to create a new one. */
  item: Item | null
  categories: Category[]
  defaultCategoryId: number | undefined
  onSave: (input: ItemInput) => Promise<unknown>
  onDelete?: (item: Item) => void
  error?: unknown
  busy?: boolean
}) {
  const blank = (): ItemDraft => ({ name: '', categoryId: defaultCategoryId ?? categories[0]?.id ?? 0, weightG: '', consumable: false, notes: '' })
  const [draft, setDraft] = useState<ItemDraft>(blank)
  useEffect(() => {
    if (open) setDraft(item ? toDraft(item) : blank())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const label = 'block text-xs font-medium text-stone-500 mb-1'
  return (
    <Dialog open={open} onClose={onClose} title={item ? 'Edit item' : 'New item'}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.name.trim()) return
          void onSave(fromDraft(draft)).then(onClose, () => {})
        }}
      >
        <div>
          <label className={label}>Name</label>
          <Input autoFocus={!item} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Category</label>
            <Select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: Number(e.target.value) })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className={label}>Weight (g)</label>
            <Input type="number" inputMode="numeric" min={0} value={draft.weightG} onChange={(e) => setDraft({ ...draft, weightG: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={draft.consumable} onChange={(e) => setDraft({ ...draft, consumable: e.target.checked })} />
          Consumable (food, fuel, toiletries…)
        </label>
        <div>
          <label className={label}>Notes</label>
          <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </div>
        <ErrorText error={error} />
        <div className="flex items-center gap-2 pt-1">
          {item && onDelete && (
            <Button variant="danger" onClick={() => onDelete(item)} disabled={busy}>Delete</Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!draft.name.trim() || busy}>{item ? 'Save' : 'Add'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
