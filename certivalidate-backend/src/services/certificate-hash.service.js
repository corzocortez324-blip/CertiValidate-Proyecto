const crypto = require('crypto')

/**
 * Canonical SHA-256 hash for a certificate.
 *
 * Includes all 12 snapshot fields (frozen at issuance) plus the cert's own ID so the
 * hash is unique even if two certificates share identical student/template data.
 * Keys are sorted alphabetically before JSON serialisation to guarantee determinism
 * regardless of property-insertion order.
 *
 * This is the single source of truth used by both public verification and blockchain
 * anchoring — any other hash function is either legacy or must delegate here.
 */
const computeCertificateHash = (snapshot) => {
  const data = {
    certificado_id: snapshot.certificado_id,
    codigo_unico: snapshot.codigo_unico,
    estudiante_id: snapshot.estudiante_id,
    fecha_emision:
      snapshot.fecha_emision instanceof Date
        ? snapshot.fecha_emision.toISOString()
        : String(snapshot.fecha_emision),
    institucion_id: snapshot.institucion_id,
    plantilla_id: snapshot.plantilla_id,
    snapshot_apellido: snapshot.snapshot_apellido ?? null,
    snapshot_documento: snapshot.snapshot_documento ?? null,
    snapshot_email: snapshot.snapshot_email ?? null,
    snapshot_institucion_nombre: snapshot.snapshot_institucion_nombre ?? null,
    snapshot_nombre: snapshot.snapshot_nombre ?? null,
    snapshot_plantilla_nombre: snapshot.snapshot_plantilla_nombre ?? null,
  }

  const sorted = Object.fromEntries(
    Object.keys(data)
      .sort()
      .map((k) => [k, data[k]]),
  )

  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
}

module.exports = { computeCertificateHash }
