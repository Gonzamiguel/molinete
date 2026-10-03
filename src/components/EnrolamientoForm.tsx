import { useEffect, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  SunMedium,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { isFirebaseConfigured } from '../firebase'
import { existePersona, registrarPersona } from '../services/personas'
import type { DatosPersonalesForm } from '../types/persona'
import {
  aMinusculas,
  capturarFrameDeVideo,
  comprimirFotoEnrolamiento,
  pesoArchivoKb,
  validarDni,
  validarEmailOpcional,
} from '../utils/hikvisionUtils'
import { BrandHeader } from './BrandHeader'

type Paso = 1 | 2 | 3

const FORMULARIO_INICIAL: DatosPersonalesForm = {
  dni: '',
  nombre: '',
  apellido: '',
  departamento: '',
  email: '',
}

export function EnrolamientoForm() {
  const [paso, setPaso] = useState<Paso>(1)
  const [datos, setDatos] = useState<DatosPersonalesForm>(FORMULARIO_INICIAL)
  const [errores, setErrores] = useState<Partial<Record<keyof DatosPersonalesForm, string>>>({})
  const [foto, setFoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [cargando, setCargando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState('')
  const [camaraLista, setCamaraLista] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const firebaseListo = isFirebaseConfigured()

  const actualizarCampo = (campo: keyof DatosPersonalesForm, valor: string) => {
    const normalizado = campo === 'dni' ? valor : aMinusculas(valor)
    setDatos((prev) => ({ ...prev, [campo]: normalizado }))
    setErrores((prev) => ({ ...prev, [campo]: undefined }))
    setErrorGeneral('')
  }

  const validarPaso1 = (): boolean => {
    const siguientes: Partial<Record<keyof DatosPersonalesForm, string>> = {}
    if (!validarDni(datos.dni)) siguientes.dni = 'Ingrese un DNI válido de 7 u 8 dígitos.'
    if (datos.nombre.trim().length < 2) siguientes.nombre = 'El nombre es obligatorio.'
    if (datos.apellido.trim().length < 2) siguientes.apellido = 'El apellido es obligatorio.'
    if (datos.departamento.trim().length < 2) siguientes.departamento = 'Ingrese la empresa a la que pertenece.'
    if (!validarEmailOpcional(datos.email)) siguientes.email = 'El correo no tiene un formato válido.'
    setErrores(siguientes)
    return Object.keys(siguientes).length === 0
  }

  const continuarAFoto = async (evento: FormEvent) => {
    evento.preventDefault()
    if (!validarPaso1()) return

    setCargando(true)
    setErrorGeneral('')
    try {
      if (firebaseListo && (await existePersona(datos.dni.trim()))) {
        setErrores({ dni: 'Este DNI ya se encuentra registrado.' })
        return
      }
      setPaso(2)
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : 'No se pudo validar el DNI.')
    } finally {
      setCargando(false)
    }
  }

  const detenerCamara = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCamaraLista(false)
  }

  const iniciarCamara = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorGeneral('Este navegador no permite usar la cámara. Abra el enlace en Chrome o Safari.')
      return
    }

    detenerCamara()
    setErrorGeneral('')
    setCamaraLista(false)

    const intentos: MediaStreamConstraints[] = [
      { audio: false, video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 1280 } } },
      { audio: false, video: { facingMode: 'user' } },
      { audio: false, video: true },
    ]

    let ultimoError: unknown
    for (const constraints of intentos) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        const video = videoRef.current
        if (!video) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        await video.play()
        setCamaraLista(true)
        return
      } catch (error) {
        ultimoError = error
      }
    }

    const nombre = ultimoError instanceof DOMException ? ultimoError.name : ''
    if (nombre === 'NotAllowedError' || nombre === 'PermissionDeniedError') {
      setErrorGeneral('Debe permitir el acceso a la cámara para tomarse la foto. Sin cámara no se puede registrar.')
      return
    }
    if (nombre === 'NotFoundError' || nombre === 'DevicesNotFoundError') {
      setErrorGeneral('No se encontró una cámara en este dispositivo.')
      return
    }
    setErrorGeneral('No se pudo activar la cámara. Recargue la página e intente nuevamente.')
  }

  useEffect(() => {
    if (paso !== 2 || foto) {
      detenerCamara()
      return
    }
    void iniciarCamara()
    return () => detenerCamara()
  }, [paso, foto])

  const capturarFoto = async () => {
    const video = videoRef.current
    if (!video || !camaraLista) {
      setErrorGeneral('Espere a que la cámara esté lista para tomarse la foto.')
      return
    }

    setCargando(true)
    setErrorGeneral('')
    try {
      const frame = await capturarFrameDeVideo(video)
      const comprimida = await comprimirFotoEnrolamiento(frame)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      detenerCamara()
      setFoto(comprimida)
      setPreviewUrl(URL.createObjectURL(comprimida))
    } catch {
      setErrorGeneral('No se pudo tomar la fotografía. Centre el rostro e intente de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  const tomarOtra = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFoto(null)
    setPreviewUrl('')
    setErrorGeneral('')
  }

  const volverADatos = () => {
    detenerCamara()
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFoto(null)
    setPreviewUrl('')
    setErrorGeneral('')
    setPaso(1)
  }

  const confirmarRegistro = async () => {
    if (!foto) {
      setErrorGeneral('Debe capturar una fotografía de frente para continuar.')
      return
    }
    if (!firebaseListo) {
      setErrorGeneral('Firebase no está configurado. Cargue las claves en .env.local.')
      return
    }

    setCargando(true)
    setErrorGeneral('')
    try {
      await registrarPersona(datos, foto)
      setPaso(3)
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : 'El registro no pudo completarse.')
    } finally {
      setCargando(false)
    }
  }

  const pesoKb = useMemo(() => (foto ? pesoArchivoKb(foto) : 0), [foto])

  return (
    <div className="min-h-dvh bg-slate-50">
      <BrandHeader />

      <main className="mx-auto w-full max-w-lg px-4 py-6 sm:py-8">
        <IndicadorPasos paso={paso} />

        {!firebaseListo && (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Configure Firebase en <span className="font-medium">.env.local</span> para habilitar el registro real.
          </p>
        )}

        {paso === 1 && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-800">Datos personales</h2>
            <p className="mt-1 text-sm text-slate-500">
              Complete sus datos para el padrón de molinetes. Los campos marcados son obligatorios.
            </p>

            <form className="mt-5 space-y-4" onSubmit={continuarAFoto} noValidate>
              <Campo
                id="dni"
                label="DNI"
                required
                value={datos.dni}
                error={errores.dni}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Solo números"
                onChange={(valor) => actualizarCampo('dni', valor.replace(/\D/g, '').slice(0, 8))}
              />
              <Campo
                id="nombre"
                label="Nombre"
                required
                value={datos.nombre}
                error={errores.nombre}
                autoComplete="given-name"
                placeholder="Nombre/s"
                onChange={(valor) => actualizarCampo('nombre', valor)}
              />
              <Campo
                id="apellido"
                label="Apellido"
                required
                value={datos.apellido}
                error={errores.apellido}
                autoComplete="family-name"
                placeholder="Apellido/s"
                onChange={(valor) => actualizarCampo('apellido', valor)}
              />

              <Campo
                id="departamento"
                label="Empresa"
                required
                value={datos.departamento}
                error={errores.departamento}
                autoComplete="organization"
                placeholder="empresa a la que pertenece"
                onChange={(valor) => actualizarCampo('departamento', valor)}
                hint="Escriba el nombre de la empresa de la que forma parte."
              />

              <Campo
                id="email"
                label="Correo electrónico"
                value={datos.email}
                error={errores.email}
                type="email"
                autoComplete="email"
                placeholder="opcional"
                onChange={(valor) => actualizarCampo('email', valor)}
                hint="Si no posee, se generará uno automático."
              />

              {errorGeneral && <AlertaError mensaje={errorGeneral} />}

              <button type="submit" className="btn-primary w-full" disabled={cargando}>
                {cargando ? 'Validando…' : 'Continuar a Fotografía'}
              </button>
            </form>
          </section>
        )}

        {paso === 2 && (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">Guía para la captura</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-slate-500" />
                  Rostro de frente, centrado en el óvalo
                </li>
                <li className="flex items-center gap-2">
                  <SunMedium className="h-4 w-4 text-slate-500" />
                  Buena luz, fondo despejado
                </li>
                <li className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-slate-500" />
                  Sin gorra ni lentes oscuros
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-center text-sm text-slate-500">
                {datos.apellido} {datos.nombre} · DNI {datos.dni}
              </p>

              <div className="relative mx-auto mt-5 h-72 w-56">
                <div className="absolute inset-0 overflow-hidden rounded-[50%] border-2 border-slate-800 bg-slate-900 shadow-inner">
                  <video
                    ref={videoRef}
                    className={`h-full w-full object-cover scale-x-[-1] ${previewUrl ? 'hidden' : 'block'}`}
                    autoPlay
                    muted
                    playsInline
                  />
                  {previewUrl ? (
                    <img src={previewUrl} alt="Vista previa del rostro" className="h-full w-full scale-x-[-1] object-cover" />
                  ) : !camaraLista ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                      <Camera className="h-10 w-10" strokeWidth={1.5} />
                      <span className="mt-2 px-4 text-center text-xs">Activando cámara…</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {foto && (
                <p className="mt-3 text-center text-xs text-slate-500">
                  Imagen comprimida · {pesoKb} KB · JPEG
                </p>
              )}

              {errorGeneral && (
                <div className="mt-4">
                  <AlertaError mensaje={errorGeneral} />
                </div>
              )}

              <div className="mt-5 space-y-2">
                {!foto ? (
                  <>
                    <button
                      type="button"
                      className="btn-primary w-full"
                      disabled={cargando || !camaraLista}
                      onClick={() => void capturarFoto()}
                    >
                      <Camera className="h-4 w-4" />
                      {cargando ? 'Procesando…' : camaraLista ? 'Tomar fotografía' : 'Esperando cámara…'}
                    </button>
                    {!camaraLista && (
                      <button type="button" className="btn-secondary w-full" disabled={cargando} onClick={() => void iniciarCamara()}>
                        Reintentar cámara
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button type="button" className="btn-primary w-full" disabled={cargando} onClick={() => void confirmarRegistro()}>
                      <ShieldCheck className="h-4 w-4" />
                      {cargando ? 'Registrando…' : 'Confirmar y Registrar'}
                    </button>
                    <button type="button" className="btn-secondary w-full" disabled={cargando} onClick={tomarOtra}>
                      <RefreshCw className="h-4 w-4" />
                      Tomar otra
                    </button>
                  </>
                )}
                <button type="button" className="btn-ghost w-full" disabled={cargando} onClick={volverADatos}>
                  Volver a datos personales
                </button>
              </div>
            </div>
          </section>
        )}

        {paso === 3 && (
          <section className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-800">Registro completado</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
              Registro completado con éxito. Tus datos y rostro fueron cargados en el sistema de molinetes.
            </p>
          </section>
        )}

        <footer className="mt-8 pb-4 text-center text-xs text-slate-400">
          Uso interno · Comedor industrial
          <span className="mx-2">·</span>
          <Link to="/admin" className="hover:text-slate-600">
            Administración
          </Link>
        </footer>
      </main>
    </div>
  )
}

function IndicadorPasos({ paso }: { paso: Paso }) {
  const items = [
    { n: 1, label: 'Datos' },
    { n: 2, label: 'Fotografía' },
    { n: 3, label: 'Confirmación' },
  ] as const

  return (
    <ol className="mb-5 grid grid-cols-3 gap-2">
      {items.map((item) => {
        const activo = paso === item.n
        const completo = paso > item.n
        return (
          <li
            key={item.n}
            className={`rounded-md border px-2 py-2 text-center text-xs font-medium ${
              activo
                ? 'border-slate-900 bg-slate-900 text-white'
                : completo
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {item.n}. {item.label}
          </li>
        )
      })}
    </ol>
  )
}

function Campo({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  required,
  type = 'text',
  inputMode,
  autoComplete,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (valor: string) => void
  error?: string
  hint?: string
  required?: boolean
  type?: string
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        className={`input-control lowercase ${error ? 'border-rose-400' : ''}`}
      />
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  )
}

function AlertaError({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{mensaje}</p>
    </div>
  )
}
