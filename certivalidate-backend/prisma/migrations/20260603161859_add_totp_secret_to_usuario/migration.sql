-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_secret" TEXT;

-- AlterTable
ALTER TABLE "VerificacionPublica" ADD COLUMN     "metodo" TEXT DEFAULT 'codigo';

-- CreateTable
CREATE TABLE "IntentoLogin" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "ip_address" TEXT,
    "exitoso" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentoLogin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionActiva" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionActiva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_intento_login_email_fecha" ON "IntentoLogin"("email", "fecha" DESC);

-- CreateIndex
CREATE INDEX "idx_intento_login_ip_fecha" ON "IntentoLogin"("ip_address", "fecha" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SesionActiva_token_hash_key" ON "SesionActiva"("token_hash");

-- CreateIndex
CREATE INDEX "idx_sesion_activa_expires" ON "SesionActiva"("expires_at");

-- CreateIndex
CREATE INDEX "idx_sesion_activa_usuario" ON "SesionActiva"("usuario_id");

-- AddForeignKey
ALTER TABLE "SesionActiva" ADD CONSTRAINT "SesionActiva_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
