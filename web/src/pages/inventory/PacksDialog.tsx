import { useState } from 'react'
import type { Item, Pack } from '@packing-list/shared'
import { formatWeight } from '@packing-list/shared'
import { Button, Dialog, ErrorText, IconButton, Input, Select } from '../../components/ui.tsx'
import { useCreatePack, useDeletePack, useUpdatePack } from '../../lib/queries.ts'

interface Draft { name: string; itemId: number | null; weightG: string }
const empty: Draft = { name: '', itemId: null, weightG: '0' }

function PackForm({ draft, items, onChange, onSubmit, onCancel, submitLabel }: {
  draft: Draft; items: Item[]; onChange: (d: Draft) => void; onSubmit: () => void; onCancel?: () => void; submitLabel: string
}) {
  const linked = draft.itemId !== null
  return (
    <form
      className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <Input placeholder="Pack name" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
      <Select value={draft.itemId ?? ''} onChange={(e) => onChange({ ...draft, itemId: e.target.value ? Number(e.target.value) : null })}>
        <option value="">Not an inventory item</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>{i.name} ({formatWeight(i.weightG)})</option>
        ))}
      </Select>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        className="text-right"
        title={linked ? 'Weight comes from the linked item' : 'Own weight in grams'}
        disabled={linked}
        value={linked ? String(items.find((i) => i.id === draft.itemId)?.weightG ?? '') : draft.weightG}
        onChange={(e) => onChange({ ...draft, weightG: e.target.value })}
      />
      <div className="flex gap-1">
        <Button variant="primary" type="submit" disabled={!draft.name.trim()}>{submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  )
}

export function PacksDialog({ open, onClose, packs, items }: { open: boolean; onClose: () => void; packs: Pack[]; items: Item[] }) {
  const [draft, setDraft] = useState<Draft>(empty)
  const [editing, setEditing] = useState<{ id: number; draft: Draft } | null>(null)
  const create = useCreatePack()
  const update = useUpdatePack()
  const remove = useDeletePack()
  const error = create.error ?? update.error ?? remove.error
  const toInput = (d: Draft) => ({ name: d.name.trim(), itemId: d.itemId, weightG: d.itemId === null ? Math.max(0, Math.round(Number(d.weightG) || 0)) : 0 })

  return (
    <Dialog open={open} onClose={onClose} title="Packs" wide>
      <p className="mb-3 text-sm text-stone-500">
        Packs are the bags gear goes into. Link a pack to the inventory item it is made of so its weight is counted once, or give it an own weight.
      </p>
      <ul className="divide-y divide-stone-100">
        {packs.map((p) => (
          <li key={p.id} className="py-2">
            {editing?.id === p.id ? (
              <PackForm
                draft={editing.draft}
                items={items}
                onChange={(d) => setEditing({ id: p.id, draft: d })}
                onCancel={() => setEditing(null)}
                submitLabel="Save"
                onSubmit={() => update.mutate({ id: p.id, ...toInput(editing.draft) }, { onSuccess: () => setEditing(null) })}
              />
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex-1 text-left hover:underline"
                  onClick={() => setEditing({ id: p.id, draft: { name: p.name, itemId: p.itemId, weightG: String(p.weightG) } })}
                >
                  {p.name}
                </button>
                <span className="text-xs text-stone-500">
                  {p.itemId !== null ? `↳ ${items.find((i) => i.id === p.itemId)?.name ?? 'item'}` : 'own weight'}
                </span>
                <span className="w-16 text-right text-sm tabular-nums">{formatWeight(p.effectiveWeightG)}</span>
                <IconButton label="Delete" className="hover:text-red-700" onClick={() => confirm(`Delete pack "${p.name}"? Trip lines using it keep the item but lose the pack.`) && remove.mutate(p.id)}>
                  🗑
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-stone-200 pt-4">
        <h3 className="mb-2 text-sm font-medium">New pack</h3>
        <PackForm draft={draft} items={items} onChange={setDraft} submitLabel="Add" onSubmit={() => create.mutate(toInput(draft), { onSuccess: () => setDraft(empty) })} />
      </div>
      <div className="mt-2"><ErrorText error={error} /></div>
    </Dialog>
  )
}
