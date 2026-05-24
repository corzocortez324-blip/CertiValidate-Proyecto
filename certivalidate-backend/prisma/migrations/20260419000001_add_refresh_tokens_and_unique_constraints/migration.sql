-- CreateTable: RefreshToken (tabla de sesiones con rotación de tokens)
CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_by_ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex unique hash por token de refresco
CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_hash_key" ON "RefreshToken"("token_hash");

-- AddForeignKey: RefreshToken → Usuario (solo si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RefreshToken_usuario_id_fkey'
  ) THEN
    ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex unique nombre de rol
CREATE UNIQUE INDEX IF NOT EXISTS "Rol_nombre_key" ON "Rol"("nombre");

-- CreateIndex unique (recurso, accion) en Permiso
CREATE UNIQUE INDEX IF NOT EXISTS "Permiso_recurso_accion_key" ON "Permiso"("recurso", "accion");

-- CreateIndex unique (usuario_id, institucion_id) en UsuarioInstitucion
CREATE UNIQUE INDEX IF NOT EXISTS "UsuarioInstitucion_usuario_id_institucion_id_key" ON "UsuarioInstitucion"("usuario_id", "institucion_id");
