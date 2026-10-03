import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EnrolamientoForm } from './components/EnrolamientoForm'

const AdminPanel = lazy(async () => {
  const modulo = await import('./components/AdminPanel')
  return { default: modulo.AdminPanel }
})

export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
            Cargando panel…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<EnrolamientoForm />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
