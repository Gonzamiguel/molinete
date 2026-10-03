import imageCompression from 'browser-image-compression'
import type { Persona } from '../types/persona'

const DNI_REGEX = /^\d{7,8}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarDni(dni: string): boolean {
  return DNI_REGEX.test(dni.trim())
}

export function validarEmailOpcional(email: string): boolean {
  const valor = email.trim()
  return valor === '' || EMAIL_REGEX.test(valor)
}

export function aMinusculas(valor: string): string {
  return valor.toLocaleLowerCase('es-AR')
}

export function limpiarTexto(valor: string): string {
  return aMinusculas(valor).replace(/\s+/g, ' ').trim()
}

export function emailHikvision(dni: string, email?: string): string {
  const valor = email?.trim().toLowerCase() ?? ''
  return valor || `${dni}@comedor.local`
}

/**
 * Quita tildes, comas y caracteres especiales. Colapsa espacios.
 * Usado en nombres de archivo del ZIP Hikvision.
 */
export function normalizarTextoHikvision(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/**
 * Nomenclatura oficial del padrón fotográfico:
 * `APELLIDO NOMBRE_DNI.jpg`
 * Ej: SOTARELLO GUSTAVO ANTONIO_13748426.jpg
 */
export function nombreArchivoFotoHikvision(persona: Pick<Persona, 'nombre' | 'apellido' | 'dni'>): string {
  const apellido = normalizarTextoHikvision(persona.apellido)
  const nombre = normalizarTextoHikvision(persona.nombre)
  const compuesto = `${apellido} ${nombre}`.replace(/\s+/g, ' ').trim()
  return `${compuesto}_${persona.dni}.jpg`
}

export async function capturarFrameDeVideo(video: HTMLVideoElement): Promise<File> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('La cámara todavía no está lista. Espere un momento e intente de nuevo.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const contexto = canvas.getContext('2d')
  if (!contexto) {
    throw new Error('No se pudo capturar el fotograma.')
  }

  contexto.drawImage(video, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (resultado) => (resultado ? resolve(resultado) : reject(new Error('No se pudo generar la foto.'))),
      'image/jpeg',
      0.92,
    )
  })

  return new File([blob], `${Date.now()}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

export async function comprimirFotoEnrolamiento(archivo: File): Promise<File> {
  const comprimido = await imageCompression(archivo, {
    maxSizeMB: 0.22,
    maxWidthOrHeight: 1080,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.82,
  })

  return new File([comprimido], `${Date.now()}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

export function pesoArchivoKb(archivo: Blob): number {
  return Math.round(archivo.size / 1024)
}

export const HIKVISION_REGLAS_EXCEL = [
  'Rule',
  'A first or last name is required.',
  'Once configured, the ID cannot be edited.',
  'Do NOT make changes to the layout and the column headings in this template file. Otherwise the import may fail.',
  'You can add a person to an existing department. Separate the names of the departments in the path with a forward slash (/). E.g., enter "All',
  'Email or phone is required to enable the self-service function for a person, or importing the person will fail.',
] as const

export const HIKVISION_COLUMNAS = ['ID', '*First Name', '*Last Name', '*Department', '*Email'] as const

export function fechaArchivoExportacion(fecha = new Date()): string {
  const yyyy = fecha.getFullYear()
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}
