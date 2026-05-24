-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "email_verificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "token_verificacion" TEXT,
ADD COLUMN     "token_verificacion_expira" TIMESTAMP(3);
