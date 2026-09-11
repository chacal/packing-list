import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, EmptyState, ErrorText, IconButton, Input, Spinner } from '../../components/ui.tsx'
import { useCreateTrip, useDeleteTrip, useDuplicateTrip, useTrips } from '../../lib/queries.ts'

export function TripsPage() {
  const trips = useTrips()
  const create = useCreateTrip()
  const duplicate = useDuplicateTrip()
  const remove = useDeleteTrip()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)

  const submit = () => {
    const n = name.trim()
    if (!n) return
    create.mutate({ name: n }, { onSuccess: (t) => void navigate(`/trips/${t.id}`) })
  }

  if (trips.isPending) return <Spinner />
  if (trips.error) return <div className="p-4"><ErrorText error={trips.error} /></div>

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Trips</h1>
        <Button variant="primary" onClick={() => setAdding(true)} disabled={adding}>+ New trip</Button>
      </div>

      {adding && (
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Input autoFocus className="max-w-sm" placeholder="Trip name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setAdding(false)} />
          <Button variant="primary" type="submit" disabled={!name.trim() || create.isPending}>Create</Button>
          <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </form>
      )}

      {trips.data.length === 0 ? (
        <EmptyState>No trips yet. Create one and pick gear from your inventory.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trips.data.map((t) => (
            <li key={t.id} className="group relative rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <Link to={`/trips/${t.id}`} className="block">
                <div className="truncate text-base font-semibold text-stone-900">{t.name}</div>
                <div className="mt-1 text-sm text-stone-500">
                  {t.itemCount} items · {t.packedCount}/{t.lineCount} packed
                </div>
                <div className="mt-2 text-xs text-stone-400">Updated {new Date(t.updatedAt).toLocaleDateString()}</div>
              </Link>
              <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <IconButton label="Duplicate" onClick={() => duplicate.mutate(t.id, { onSuccess: (c) => void navigate(`/trips/${c.id}`) })}>⧉</IconButton>
                <IconButton label="Delete" className="hover:text-red-700" onClick={() => confirm(`Delete trip "${t.name}"?`) && remove.mutate(t.id)}>🗑</IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3"><ErrorText error={create.error ?? duplicate.error ?? remove.error} /></div>
    </div>
  )
}
