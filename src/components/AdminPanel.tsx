import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  AlertCircle,
  FileSpreadsheet,
  Download,
  Images,
  LockKeyhole,
  QrCode,
  LogOut,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ADMIN_EMAIL, ADMIN_PIN, auth, isFirebaseConfigured } from '../firebase'
import { listarPersonas } from '../services/personas'
import type { Persona } from '../types/persona'
import { descargarFotoIndividual, exportarFotosZip, exportarNominaXlsx } from '../utils/hikvisionExport'
import { BrandHeader } from './BrandHeader'

export function AdminPanel() {
  const [autenticado, setAutenticado] = useState(false)
  const [verificandoSesion, setVerificandoSesion] = useState(true)
  const [pin, setPin] = useState('')
  const [errorAuth, setErrorAuth] = useState('')
  const [ingresando, setIngresando] = useState(false)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [errorDatos, setErrorDatos] = useState('')
  const [exportando, setExportando] = useState<'xlsx' | 'zip' | string | null>(null)
  const [progresoZip, setProgresoZip] = useState('')

  useEffect(() => {
    if (!auth) {
      setVerificandoSesion(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, (usuario) => {
      setAutenticado(Boolean(usuario))
      setVerificandoSesion(false)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!autenticado) return
    void cargarPadron()
  }, [autenticado])

  const cargarPadron = async () => {
    setCargando(true)
    setErrorDatos('')
    try {
      setPersonas(await listarPersonas())
    } catch (error) {
      setErrorDatos(
        error instanceof Error
          ? error.message
          : 'No se pudo leer el padrón. Verifique autenticación y reglas de Firestore.',
      )
    } finally {
      setCargando(false)
    }
  }

  const ingresar = async (evento: FormEvent) => {
    evento.preventDefault()
    setErrorAuth('')
    setIngresando(true)
    try {
      if (!isFirebaseConfigured() || !auth || !ADMIN_EMAIL) {
        if (ADMIN_PIN && pin === ADMIN_PIN) {
          setAutenticado(true)
          return
        }
        throw new Error('Configure VITE_ADMIN_EMAIL, VITE_ADMIN_PIN y las claves de Firebase.')
      }

      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pin)
    } catch (error) {
      const mensaje =
        error instanceof Error && error.message.includes('invalid-credential')
          ? 'PIN incorrecto o usuario administrador no creado en Firebase Authentication.'
          : error instanceof Error
            ? error.message
            : 'No se pudo validar el acceso.'
      setErrorAuth(mensaje)
    } finally {
      setIngresando(false)
    }
  }

  const salir = async () => {
    if (auth) await signOut(auth)
    setAutenticado(false)
    setPersonas([])
    setPin('')
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return personas
    return personas.filter(
      (persona) =>
        persona.dni.includes(q) ||
        persona.apellido.toLowerCase().includes(q) ||
        persona.nombre.toLowerCase().includes(q),
    )
  }, [busqueda, personas])

  const resumen = useMemo(() => {
    const conteo = new Map<string, number>()
    personas.forEach((persona) => {
      const empresa = persona.departamento.trim() || 'sin empresa'
      conteo.set(empresa, (conteo.get(empresa) ?? 0) + 1)
    })
    const porDepto = [...conteo.entries()]
      .map(([departamento, total]) => ({ departamento, total }))
      .sort((a, b) => b.total - a.total || a.departamento.localeCompare(b.departamento, 'es'))
    return { total: personas.length, porDepto }
  }, [personas])

  const descargarNomina = async () => {
    setExportando('xlsx')
    setErrorDatos('')
    try {
      await exportarNominaXlsx(personas)
    } catch (error) {
      setErrorDatos(error instanceof Error ? error.message : 'No se pudo generar el Excel.')
    } finally {
      setExportando(null)
    }
  }

  const descargarUnaFoto = async (persona: Persona) => {
    setExportando(persona.dni)
    setErrorDatos('')
    try {
      await descargarFotoIndividual(persona)
    } catch (error) {
      setErrorDatos(error instanceof Error ? error.message : 'No se pudo descargar la foto.')
    } finally {
      setExportando(null)
    }
  }

  const descargarFotos = async () => {
    setExportando('zip')
    setProgresoZip('Preparando paquete…')
    setErrorDatos('')
    try {
      await exportarFotosZip(personas, (actual, total) => {
        setProgresoZip(`Empaquetando ${actual} / ${total}`)
      })
    } catch (error) {
      setErrorDatos(error instanceof Error ? error.message : 'No se pudo generar el ZIP de fotos.')
    } finally {
      setExportando(null)
      setProgresoZip('')
    }
  }

  if (verificandoSesion) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <BrandHeader compact />
        <p className="p-8 text-center text-sm text-slate-500">Verificando sesión…</p>
      </div>
    )
  }

  if (!autenticado) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <BrandHeader compact />
        <main className="mx-auto flex w-full max-w-md px-4 py-10">
          <section className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-slate-900 text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-center text-lg font-semibold text-slate-800">Acceso de administración</h2>
            <p className="mt-1 text-center text-sm text-slate-500">
              Ingrese el PIN de operador para consultar el padrón y exportar a Hikvision.
            </p>
            <form className="mt-6 space-y-4" onSubmit={ingresar}>
              <div>
                <label htmlFor="pin" className="mb-1.5 block text-sm font-medium text-slate-800">
                  Clave de acceso
                </label>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(evento) => setPin(evento.target.value)}
                  className="input-control tracking-[0.3em]"
                  placeholder="••••"
                />
              </div>
              {errorAuth && (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{errorAuth}</p>
                </div>
              )}
              <button type="submit" className="btn-primary w-full" disabled={ingresando || !pin}>
                {ingresando ? 'Validando…' : 'Ingresar'}
              </button>
            </form>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <BrandHeader compact />

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Panel de administración</h2>
            <p className="text-sm text-slate-500">Padrón de comensales y exportación Hikvision</p>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="btn-secondary">
              Nuevo registro
            </Link>
            <button type="button" className="btn-secondary" onClick={() => void salir()}>
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(`${window.location.origin}/`)}`}
              alt="Código QR de auto-registro"
              className="mx-auto h-44 w-44 border border-slate-200 bg-white p-2 sm:mx-0"
            />
            <div>
              <div className="flex items-center gap-2 text-slate-800">
                <QrCode className="h-4 w-4" />
                <p className="text-sm font-semibold">QR para mesas del comedor</p>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Imprimí este código y pegalo en las mesas. Al escanearlo se abre el formulario de registro, sin
                descargar nada.
              </p>
              <p className="mt-2 break-all text-xs text-slate-400">{`${window.location.origin}/`}</p>
              <a
                className="btn-secondary mt-3 inline-flex"
                href={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=16&data=${encodeURIComponent(`${window.location.origin}/`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="h-4 w-4" />
                Descargar QR en alta calidad
              </a>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Total registrados</p>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{resumen.total}</p>
          </article>
          {resumen.porDepto.slice(0, 3).map((item) => (
            <article key={item.departamento} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{item.departamento}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{item.total}</p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-800">Desglose por empresa</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {resumen.porDepto.map((item) => (
              <div key={item.departamento} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">{item.departamento}</p>
                <p className="text-sm font-semibold text-slate-800">{item.total}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
          <button type="button" className="btn-primary flex-1" disabled={exportando !== null || personas.length === 0} onClick={() => void descargarNomina()}>
            <FileSpreadsheet className="h-4 w-4" />
            {exportando === 'xlsx' ? 'Generando Excel…' : 'Descargar Nómina Hikvision (.xlsx)'}
          </button>
          <button type="button" className="btn-primary flex-1" disabled={exportando !== null || personas.length === 0} onClick={() => void descargarFotos()}>
            <Images className="h-4 w-4" />
            {exportando === 'zip' ? progresoZip || 'Generando ZIP…' : 'Descargar Fotos Hikvision (.zip)'}
          </button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                className="input-control pl-9"
                placeholder="Buscar por DNI o apellido"
              />
            </div>
            <button type="button" className="btn-secondary" onClick={() => void cargarPadron()} disabled={cargando}>
              <RefreshCw className="h-4 w-4" />
              {cargando ? 'Actualizando…' : 'Actualizar padrón'}
            </button>
          </div>

          {errorDatos && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{errorDatos}</p>
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 font-medium">Foto</th>
                  <th className="px-2 py-2 font-medium">DNI</th>
                  <th className="px-2 py-2 font-medium">Nombre completo</th>
                  <th className="px-2 py-2 font-medium">Empresa</th>
                  <th className="px-2 py-2 font-medium">Foto</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((persona) => (
                  <tr key={persona.dni} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-2">
                      {persona.fotoUrl ? (
                        <img
                          src={persona.fotoUrl}
                          alt=""
                          className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-slate-100" />
                      )}
                    </td>
                    <td className="px-2 py-2 font-medium text-slate-800">{persona.dni}</td>
                    <td className="px-2 py-2 text-slate-700">
                      {persona.apellido} {persona.nombre}
                    </td>
                    <td className="px-2 py-2 text-slate-500">{persona.departamento}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="btn-secondary px-2 py-1 text-xs"
                        disabled={exportando !== null}
                        onClick={() => void descargarUnaFoto(persona)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        {exportando === persona.dni ? 'Bajando…' : 'Descargar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!cargando && filtradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-center text-slate-500">
                      No hay registros para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
