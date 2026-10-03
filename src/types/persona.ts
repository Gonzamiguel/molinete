import type { Timestamp } from 'firebase/firestore'

export interface Persona {
  dni: string
  nombre: string
  apellido: string
  departamento: string
  email: string
  fotoUrl: string
  fechaRegistro: Timestamp | Date | null
}

export interface DatosPersonalesForm {
  dni: string
  nombre: string
  apellido: string
  departamento: string
  email: string
}

export const APP_NAME = 'Sistema de Control de Acceso - Comedor'
export const APP_SHORT_NAME = 'Comedor Industrial'
