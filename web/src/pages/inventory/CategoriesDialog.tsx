import { useState } from 'react'
import type { Category, Item } from '@packing-list/shared'
import { Button, Dialog, ErrorText, IconButton, Input } from '../../components/ui.tsx'
import { useCreateCategory, useDeleteCategory, useReorderCategories, useUpdateCategory } from '../../lib/queries.ts'

export function CategoriesDialog({ open, onClose, categories, items }: { open: boolean; onClose: () => void; categories: Category[]; items: Item[] }) {
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null)
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const reorder = useReorderCategories()
  const remove = useDeleteCategory()
  const error = create.error ?? update.error ?? reorder.error ?? remove.error

  const usage = new Map<number, number>()
  for (const it of items) usage.set(it.categoryId, (usage.get(it.categoryId) ?? 0) + 1)

  const move = (index: number, dir: -1 | 1) => {
    const ids = categories.map((c) => c.id)
    const target = index + dir
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    reorder.mutate(ids)
  }

  const add = () => {
    const name = newName.trim()
    if (!name) return
    create.mutate({ name }, { onSuccess: () => setNewName('') })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Categories">
      <ul className="divide-y divide-stone-100">
        {categories.map((c, i) => (
          <li key={c.id} className="flex h-10 items-center gap-1">
            <IconButton label="Move up" className="h-7 w-7 text-xs" disabled={i === 0} onClick={() => move(i, -1)}>▲</IconButton>
            <IconButton label="Move down" className="mr-1 h-7 w-7 text-xs" disabled={i === categories.length - 1} onClick={() => move(i, 1)}>▼</IconButton>
            {editing?.id === c.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  update.mutate({ id: c.id, name: editing.name.trim() }, { onSuccess: () => setEditing(null) })
                }}
              >
                <Input autoFocus value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} />
                <Button size="sm" variant="primary" type="submit">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </form>
            ) : (
              <>
                <button type="button" className="flex-1 text-left hover:underline" onClick={() => setEditing({ id: c.id, name: c.name })}>
                  {c.name}
                </button>
                <span className="text-xs text-stone-400">{usage.get(c.id) ?? 0} items</span>
                <IconButton
                  label={usage.get(c.id) ? 'Category is in use' : 'Delete'}
                  disabled={(usage.get(c.id) ?? 0) > 0}
                  onClick={() => confirm(`Delete category "${c.name}"?`) && remove.mutate(c.id)}
                  className="hover:text-red-700"
                >
                  🗑
                </IconButton>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input placeholder="New category" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button variant="primary" type="submit" disabled={!newName.trim() || create.isPending}>Add</Button>
      </form>
      <div className="mt-2"><ErrorText error={error} /></div>
    </Dialog>
  )
}
