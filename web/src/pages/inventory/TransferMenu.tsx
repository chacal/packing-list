import { useRef, useState } from 'react'
import { Button, ErrorText } from '../../components/ui.tsx'
import { exportUrl } from '../../lib/api.ts'
import { useImport } from '../../lib/queries.ts'

/** Export download plus JSON import (merge or replace). */
export function TransferMenu() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [message, setMessage] = useState<string | null>(null)
  const imp = useImport()

  const pick = (m: 'merge' | 'replace') => {
    if (m === 'replace' && !confirm('Replace ALL data (inventory, packs and trips) with the file contents?')) return
    setMode(m)
    fileRef.current?.click()
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    try {
      const doc = JSON.parse(await file.text()) as unknown
      const r = await imp.mutateAsync({ doc, mode })
      setMessage(`Imported ${r.items} items (${mode}).`)
    } catch (e) {
      setMessage(null)
      if (!(e instanceof Error) || e.name === 'SyntaxError') alert('Not a valid JSON file')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <a className="text-emerald-800 hover:underline" href={exportUrl} download>Export JSON</a>
      <span className="text-stone-300">·</span>
      <Button size="sm" variant="ghost" onClick={() => pick('merge')} disabled={imp.isPending}>Import (merge)</Button>
      <Button size="sm" variant="ghost" onClick={() => pick('replace')} disabled={imp.isPending}>Import (replace)</Button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      {message && <span className="text-stone-500">{message}</span>}
      <ErrorText error={imp.error} />
    </div>
  )
}
