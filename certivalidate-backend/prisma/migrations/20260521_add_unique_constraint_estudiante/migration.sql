-- Add unique constraint on institucion_id + documento for Estudiante
-- This ensures document uniqueness is enforced at the institution level
-- If there are existing duplicates, PostgreSQL will fail and require resolution
CREATE UNIQUE INDEX "Estudiante_institucion_id_documento_key" ON "Estudiante"("institucion_id", "documento");
