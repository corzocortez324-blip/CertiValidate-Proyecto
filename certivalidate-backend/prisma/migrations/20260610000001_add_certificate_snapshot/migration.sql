-- Add frozen snapshot fields to Certificado.
-- All columns are nullable so existing rows remain valid (snapshot_nombre = NULL
-- triggers the legacy verification path until backfill-snapshots.js is run).
ALTER TABLE "Certificado"
  ADD COLUMN "snapshot_nombre"             TEXT,
  ADD COLUMN "snapshot_apellido"           TEXT,
  ADD COLUMN "snapshot_email"              TEXT,
  ADD COLUMN "snapshot_documento"          TEXT,
  ADD COLUMN "snapshot_institucion_nombre" TEXT,
  ADD COLUMN "snapshot_plantilla_nombre"   TEXT;
