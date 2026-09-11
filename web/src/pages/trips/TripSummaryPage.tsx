import { formatWeight } from '@packing-list/shared'
import { useTripData } from './TripLayout.tsx'

export function TripSummaryPage() {
  const { summary } = useTripData()
  if (!summary) return null
  const maxCat = Math.max(1, ...summary.byCategory.map((c) => c.weightG))
  const maxPack = Math.max(1, ...summary.byPack.map((p) => p.totalG))

  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total" value={formatWeight(summary.totalG)} hint="gear + packs" primary />
        <Stat label="Base weight" value={formatWeight(summary.baseG)} hint="total − consumables" />
        <Stat label="Consumables" value={formatWeight(summary.consumableG)} />
        <Stat label="Packs" value={formatWeight(summary.packsG)} hint={`${summary.byPack.filter((p) => p.packId !== null).length} in use`} />
        <Stat label="Items" value={String(summary.itemCount)} hint={`${summary.lineCount} lines`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Table
          title="By category"
          rows={summary.byCategory.map((c) => ({ key: c.categoryId, name: c.name, count: c.itemCount, value: c.weightG, max: maxCat, share: c.weightG / Math.max(1, summary.itemsG) }))}
          total={summary.itemsG}
          totalLabel="Gear"
        />
        <Table
          title="By pack"
          rows={summary.byPack.map((p) => ({
            key: p.packId ?? 'none',
            name: p.name,
            count: p.itemCount,
            value: p.totalG,
            max: maxPack,
            share: p.totalG / Math.max(1, summary.totalG),
            detail: p.packG > 0 ? `${formatWeight(p.contentsG)} + ${formatWeight(p.packG)} bag` : undefined,
            muted: p.packId === null,
          }))}
          total={summary.totalG}
          totalLabel="Total"
        />
      </div>
    </div>
  )
}

function Stat({ label, value, hint, primary }: { label: string; value: string; hint?: string; primary?: boolean }) {
  return (
    <div className={primary ? 'rounded-lg bg-emerald-700 p-3 text-white' : 'rounded-lg border border-stone-200 bg-white p-3'}>
      <div className={primary ? 'text-xs font-medium text-emerald-100' : 'text-xs font-medium text-stone-500'}>{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className={primary ? 'text-xs text-emerald-200' : 'text-xs text-stone-400'}>{hint}</div>}
    </div>
  )
}

interface Row { key: string | number; name: string; count: number; value: number; max: number; share: number; detail?: string | undefined; muted?: boolean | undefined }

function Table({ title, rows, total, totalLabel }: { title: string; rows: Row[]; total: number; totalLabel: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-4 py-2 text-sm font-semibold">{title}</div>
      <ul className="divide-y divide-stone-100">
        {rows.length === 0 && <li className="px-4 py-3 text-sm text-stone-400">Nothing yet.</li>}
        {rows.map((r) => (
          <li key={r.key} className="px-4 py-2">
            <div className="flex items-baseline gap-2 text-sm">
              <span className={r.muted ? 'flex-1 text-stone-400 italic' : 'flex-1 font-medium'}>{r.name}</span>
              <span className="text-xs text-stone-400">{r.count} items</span>
              <span className="w-16 text-right tabular-nums">{formatWeight(r.value)}</span>
              <span className="w-10 text-right text-xs text-stone-400 tabular-nums">{Math.round(r.share * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
              <div className={r.muted ? 'h-full bg-stone-300' : 'h-full bg-emerald-600'} style={{ width: `${(r.value / r.max) * 100}%` }} />
            </div>
            {r.detail && <div className="mt-0.5 text-xs text-stone-400">{r.detail}</div>}
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold">
        <span>{totalLabel}</span>
        <span className="tabular-nums">{formatWeight(total)}</span>
      </div>
    </div>
  )
}
