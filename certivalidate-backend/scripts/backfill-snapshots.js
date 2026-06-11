'use strict'
/**
 * Rellena los campos de snapshot para certificados emitidos antes de la migración de snapshot.
 *
 * Para cada certificado con snapshot_nombre IS NULL:
 *   1. Lee los datos del estudiante / institución / plantilla desde las tablas vivas
 *      (la mejor fuente de verdad disponible).
 *   2. Rellena los campos snapshot_* con esos valores.
 *   3. Recalcula hash_sha256 usando la función canónica computeCertificateHash para que
 *      la verificación pública funcione correctamente de aquí en adelante.
 *
 * NOTA: Este script NO actualiza las entradas existentes de BlockchainTransaccion.hash.
 * Esas fueron calculadas con la función generateCertificateHash anterior al snapshot
 * (formato JSON-con-IDs) y divergirán del nuevo hash_sha256. Para corregir el anclaje en
 * blockchain de los certificados históricos haría falta volver a registrarlos en la
 * blockchain — eso queda fuera del alcance de este script.
 *
 * Seguridad:
 *   - Idempotente: solo toca filas donde snapshot_nombre IS NULL.
 *   - Se ejecuta en lotes de 100 para evitar presión de memoria.
 *   - Modo de prueba (dry-run): define DRY_RUN=1 para previsualizar sin escribir.
 */

const { PrismaClient } = require('@prisma/client')
const { computeCertificateHash } = require('../src/services/certificate-hash.service')

const prisma = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN === '1'
const BATCH_SIZE = 100

const backfill = async () => {
  console.log(`[backfill-snapshots] Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`)

  let offset = 0
  let totalUpdated = 0

  while (true) {
    const certs = await prisma.certificado.findMany({
      where: { snapshot_nombre: null },
      skip: offset,
      take: BATCH_SIZE,
      include: {
        estudiante: true,
        institucion: true,
        plantilla: true,
      },
    })

    if (certs.length === 0) break

    for (const cert of certs) {
      const snapshotNombre = cert.estudiante.nombre
      const snapshotApellido = cert.estudiante.apellido
      const snapshotEmail = cert.estudiante.email || null
      const snapshotDocumento = cert.estudiante.documento || null
      const snapshotInstitucionNombre = cert.institucion.nombre
      const snapshotPlantillaNombre = cert.plantilla.nombre

      const hash_sha256 = computeCertificateHash({
        certificado_id: cert.id,
        codigo_unico: cert.codigo_unico,
        estudiante_id: cert.estudiante_id,
        fecha_emision: cert.fecha_emision,
        institucion_id: cert.institucion_id,
        plantilla_id: cert.plantilla_id,
        snapshot_apellido: snapshotApellido,
        snapshot_documento: snapshotDocumento,
        snapshot_email: snapshotEmail,
        snapshot_institucion_nombre: snapshotInstitucionNombre,
        snapshot_nombre: snapshotNombre,
        snapshot_plantilla_nombre: snapshotPlantillaNombre,
      })

      if (!DRY_RUN) {
        await prisma.certificado.update({
          where: { id: cert.id },
          data: {
            snapshot_nombre: snapshotNombre,
            snapshot_apellido: snapshotApellido,
            snapshot_email: snapshotEmail,
            snapshot_documento: snapshotDocumento,
            snapshot_institucion_nombre: snapshotInstitucionNombre,
            snapshot_plantilla_nombre: snapshotPlantillaNombre,
            hash_sha256,
          },
        })
      }

      totalUpdated++
    }

    console.log(
      `[backfill-snapshots] Processed batch ending at offset ${offset + certs.length} — running total: ${totalUpdated}`,
    )
    offset += certs.length
  }

  console.log(
    `[backfill-snapshots] Done${DRY_RUN ? ' (DRY RUN — no writes made)' : ''}. Rows processed: ${totalUpdated}`,
  )
}

backfill()
  .catch((err) => {
    console.error('[backfill-snapshots] Fatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
  
