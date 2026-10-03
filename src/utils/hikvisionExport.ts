import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { getBytes, ref } from 'firebase/storage'
import { storage } from '../firebase'
import type { Persona } from '../types/persona'
import {
  fechaArchivoExportacion,
  HIKVISION_COLUMNAS,
  HIKVISION_REGLAS_EXCEL,
  nombreArchivoFotoHikvision,
} from './hikvisionUtils'

export async function exportarNominaXlsx(personas: Persona[]): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sistema de Control de Acceso - Comedor'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Person')

  HIKVISION_REGLAS_EXCEL.forEach((texto) => {
    sheet.addRow([texto])
  })

  const headerRow = sheet.addRow([...HIKVISION_COLUMNAS])
  headerRow.font = { bold: true }

  personas.forEach((persona) => {
    const row = sheet.addRow([
      persona.dni,
      persona.nombre,
      persona.apellido,
      persona.departamento,
      persona.email,
    ])
    row.getCell(1).numFmt = '@'
  })

  sheet.getColumn(1).width = 16
  sheet.getColumn(2).width = 28
  sheet.getColumn(3).width = 28
  sheet.getColumn(4).width = 28
  sheet.getColumn(5).width = 36

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, `Nomina_Hikvision_Comedor_${fechaArchivoExportacion()}.xlsx`)
}

export async function obtenerFotoBlob(persona: Persona): Promise<Blob> {
  if (!storage) {
    throw new Error('Storage no está configurado.')
  }

  try {
    const bytes = await getBytes(ref(storage, `fotos_comedor/${persona.dni}.jpg`))
    return new Blob([bytes], { type: 'image/jpeg' })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : ''
    if (mensaje.toLowerCase().includes('cors') || mensaje.toLowerCase().includes('failed to fetch')) {
      throw new Error(
        'El navegador bloqueó la descarga de la foto (CORS de Storage). La foto sí está guardada; hay que habilitar CORS en el bucket.',
      )
    }
    throw new Error(`No se pudo leer la foto del DNI ${persona.dni}.`)
  }
}

export async function descargarFotoIndividual(persona: Persona): Promise<void> {
  try {
    const blob = await obtenerFotoBlob(persona)
    saveAs(blob, nombreArchivoFotoHikvision(persona))
    return
  } catch {
    if (!persona.fotoUrl) {
      throw new Error(`No se pudo leer la foto del DNI ${persona.dni}.`)
    }
    const enlace = document.createElement('a')
    enlace.href = persona.fotoUrl
    enlace.target = '_blank'
    enlace.rel = 'noopener noreferrer'
    enlace.download = nombreArchivoFotoHikvision(persona)
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
  }
}

export async function exportarFotosZip(
  personas: Persona[],
  onProgress?: (actual: number, total: number) => void,
): Promise<void> {
  const conFoto = personas.filter((persona) => persona.dni)
  if (conFoto.length === 0) {
    throw new Error('No hay fotografías para exportar.')
  }

  const zip = new JSZip()
  const lote = 5

  for (let i = 0; i < conFoto.length; i += lote) {
    const grupo = conFoto.slice(i, i + lote)
    const resultados = await Promise.all(
      grupo.map(async (persona) => {
        const blob = await obtenerFotoBlob(persona)
        return { nombre: nombreArchivoFotoHikvision(persona), blob }
      }),
    )

    resultados.forEach(({ nombre, blob }) => {
      zip.file(nombre, blob, { binary: true })
    })

    onProgress?.(Math.min(i + grupo.length, conFoto.length), conFoto.length)
  }

  const contenido = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  saveAs(contenido, `Fotos_Hikvision_Comedor_${fechaArchivoExportacion()}.zip`)
}
