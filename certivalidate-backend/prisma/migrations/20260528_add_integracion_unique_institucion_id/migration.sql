-- AlterTable: add unique constraint to Integracion.institucion_id
-- Enforces one integration per institution at the database level.
ALTER TABLE "Integracion" ADD CONSTRAINT "Integracion_institucion_id_key" UNIQUE ("institucion_id");
