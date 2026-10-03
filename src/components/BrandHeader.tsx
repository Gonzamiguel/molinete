import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { APP_NAME, APP_SHORT_NAME } from '../types/persona'

interface BrandHeaderProps {
  compact?: boolean
}

export function BrandHeader({ compact = false }: BrandHeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900 text-white">
      <div className={`mx-auto flex w-full max-w-5xl items-center gap-3 px-4 ${compact ? 'py-3' : 'py-4'}`}>
        <Link
          to="/"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800"
          aria-label="Inicio"
        >
          <ShieldCheck className="h-6 w-6 text-slate-100" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            Control de acceso
          </p>
          <h1 className={`truncate font-semibold leading-tight text-white ${compact ? 'text-sm' : 'text-base'}`}>
            {compact ? APP_SHORT_NAME : APP_NAME}
          </h1>
        </div>
      </div>
    </header>
  )
}
