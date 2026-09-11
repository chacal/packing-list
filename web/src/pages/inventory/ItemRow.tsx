import { useState, type KeyboardEvent } from 'react'
import type { Category, Item, ItemInput } from '@packing-list/shared'
import { formatWeight } from '@packing-list/shared'
import { Button, Checkbox, IconButton, Input, Select, cx } from '../../components/ui.tsx'

export interface ItemDraft {
  name: string
  categoryId: number
  weightG: string
  consumable: boolean
  notes: string
}

export const toDraft = (item: Item): ItemDraft => ({
  name: item.name,
  categoryId: item.categoryId,
  weightG: String(item.weightG),
  consumable: item.consumable,
  notes: item.notes,
})

export const fromDraft = (d: ItemDraft): ItemInput => ({
  name: d.name.trim(),
  categoryId: d.categoryId,
  weightG: Math.max(0, Math.round(Number(d.weightG) || 0)),
  consumable: d.consumable,
  notes: d.notes.trim(),
})

const cell = 'px-3 py-1.5 align-middle'

/** A table row with inline inputs for an item; used both for editing and for the "new item" row. */
export function EditableRow({
  draft,
  categories,
  onChange,
  onSave,
  onCancel,
  saving,
  autoFocus,
  saveLabel = 'Save',
}: {
  draft: ItemDraft
  categories: Category[]
  onChange: (d: ItemDraft) => void
  onSave: () => void
  onCancel: () => void
  saving?: boolean
  autoFocus?: boolean
  saveLabel?: string
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave()
    }
    if (e.key === 'Escape') onCancel()
  }
  const valid = draft.name.trim().length > 0
  return (
    <tr className="bg-emerald-50/60">
      <td className={cell}>
        <Input value={draft.name} autoFocus={autoFocus} placeholder="Item name" onKeyDown={onKey} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
      </td>
      <td className={cell}>
        <Select value={draft.categoryId} onKeyDown={onKey} onChange={(e) => onChange({ ...draft, categoryId: Number(e.target.value) })}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </td>
      <td className={cell}>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          className="w-24 text-right"
          value={draft.weightG}
          onKeyDown={onKey}
          onChange={(e) => onChange({ ...draft, weightG: e.target.value })}
        />
      </td>
      <td className={cx(cell, 'text-center')}>
        <Checkbox checked={draft.consumable} onKeyDown={onKey} onChange={(e) => onChange({ ...draft, consumable: e.target.checked })} />
      </td>
      <td className={cx(cell, 'hidden md:table-cell')}>
        <Input value={draft.notes} placeholder="Notes" onKeyDown={onKey} onChange={(e) => onChange({ ...draft, notes: e.target.value })} />
      </td>
      <td className={cx(cell, 'text-right')}>
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="primary" disabled={!valid || saving} onClick={onSave}>{saveLabel}</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </td>
    </tr>
  )
}

export function ItemRow({
  item,
  categories,
  onSave,
  onDelete,
  onEdit,
}: {
  item: Item
  categories: Category[]
  onSave: (input: ItemInput) => Promise<unknown>
  onDelete: () => void
  /** When given (touch devices), editing opens this instead of the inline row. */
  onEdit?: (() => void) | undefined
}) {
  const [draft, setDraft] = useState<ItemDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const category = categories.find((c) => c.id === item.categoryId)

  if (draft) {
    return (
      <EditableRow
        draft={draft}
        categories={categories}
        onChange={setDraft}
        saving={saving}
        autoFocus
        onCancel={() => setDraft(null)}
        onSave={async () => {
          setSaving(true)
          try {
            await onSave(fromDraft(draft))
            setDraft(null)
          } finally {
            setSaving(false)
          }
        }}
      />
    )
  }

  return (
    <tr className="group hover:bg-stone-50" onDoubleClick={() => (onEdit ? onEdit() : setDraft(toDraft(item)))} onClick={onEdit}>
      <td className={cx(cell, 'font-medium')}>
        {item.name}
        {item.notes && <div className="text-xs text-stone-500 md:hidden">{item.notes}</div>}
      </td>
      <td className={cell}>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">{category?.name ?? '—'}</span>
      </td>
      <td className={cx(cell, 'text-right tabular-nums')}>{formatWeight(item.weightG)}</td>
      <td className={cx(cell, 'text-center text-stone-500')}>{item.consumable ? '✓' : ''}</td>
      <td className={cx(cell, 'hidden max-w-xs truncate text-stone-500 md:table-cell')} title={item.notes}>{item.notes}</td>
      <td className={cx(cell, 'text-right')}>
        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          <IconButton label="Edit" onClick={(e) => { e.stopPropagation(); onEdit ? onEdit() : setDraft(toDraft(item)) }}>✎</IconButton>
          <IconButton label="Delete" onClick={(e) => { e.stopPropagation(); onDelete() }} className="hover:text-red-700">🗑</IconButton>
        </div>
      </td>
    </tr>
  )
}
