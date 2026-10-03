import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase'
import type { DatosPersonalesForm, Persona } from '../types/persona'
import { emailHikvision, limpiarTexto } from '../utils/hikvisionUtils'

function requireFirebase() {
  if (!db || !storage) {
    throw new Error('Firebase no está configurado. Complete el archivo .env.local.')
  }
  return { db, storage }
}

export async function existePersona(dni: string): Promise<boolean> {
  const { db: firestore } = requireFirebase()
  const snap = await getDoc(doc(firestore, 'personas', dni))
  return snap.exists()
}

export async function registrarPersona(datos: DatosPersonalesForm, foto: File): Promise<void> {
  const { db: firestore, storage: bucket } = requireFirebase()
  const dni = datos.dni.trim()
  const yaExiste = await existePersona(dni)
  if (yaExiste) {
    throw new Error('Este DNI ya se encuentra registrado en el sistema.')
  }

  const storageRef = ref(bucket, `fotos_comedor/${dni}.jpg`)
  await uploadBytes(storageRef, foto, {
    contentType: 'image/jpeg',
    cacheControl: 'public,max-age=31536000',
  })
  const fotoUrl = await getDownloadURL(storageRef)

  const payload: Omit<Persona, 'fechaRegistro'> & { fechaRegistro: ReturnType<typeof serverTimestamp> } = {
    dni,
    nombre: limpiarTexto(datos.nombre),
    apellido: limpiarTexto(datos.apellido),
    departamento: limpiarTexto(datos.departamento),
    email: emailHikvision(dni, datos.email),
    fotoUrl,
    fechaRegistro: serverTimestamp(),
  }

  await setDoc(doc(firestore, 'personas', dni), payload)
}

export async function listarPersonas(): Promise<Persona[]> {
  const { db: firestore } = requireFirebase()
  const snap = await getDocs(collection(firestore, 'personas'))
  return snap.docs
    .map((item) => item.data() as Persona)
    .sort((a, b) => a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
}
