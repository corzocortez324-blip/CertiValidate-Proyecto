-- AlterTable
ALTER TABLE "Auditoria" ADD COLUMN     "institucion_id" TEXT;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "Institucion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
