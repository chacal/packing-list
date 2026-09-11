import { Navigate, NavLink, Route, Routes } from 'react-router'
import { InventoryPage } from './pages/inventory/InventoryPage.tsx'
import { TripEditorPage } from './pages/trips/TripEditorPage.tsx'
import { TripLayout } from './pages/trips/TripLayout.tsx'
import { TripSummaryPage } from './pages/trips/TripSummaryPage.tsx'
import { TripsPage } from './pages/trips/TripsPage.tsx'

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-stone-500">Coming soon.</p>
    </div>
  )
}

export default function App() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-200'}`
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-stone-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <span className="mr-4 font-semibold tracking-tight">🎒 Packing List</span>
          <NavLink to="/inventory" className={link}>Inventory</NavLink>
          <NavLink to="/trips" className={link}>Trips</NavLink>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/trips" replace />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:id" element={<TripLayout />}>
            <Route index element={<TripEditorPage />} />
            <Route path="summary" element={<TripSummaryPage />} />
            <Route path="pack" element={<Placeholder title="Packing mode" />} />
          </Route>
          <Route path="*" element={<Placeholder title="Not found" />} />
        </Routes>
      </main>
    </div>
  )
}
