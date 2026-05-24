-- CreateTable
CREATE TABLE "Institucion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dominio" TEXT,
    "logo_url" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioInstitucion" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "institucion_id" TEXT NOT NULL,
    "rol_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioInstitucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rol" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permiso" (
    "id" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "accion" TEXT NOT NULL,

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolPermiso" (
    "rol_id" TEXT NOT NULL,
    "permiso_id" TEXT NOT NULL,

    CONSTRAINT "RolPermiso_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "Integracion" (
    "id" TEXT NOT NULL,
    "institucion_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url_base" TEXT,
    "api_key" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "ultima_verificacion" TIMESTAMP(3),

    CONSTRAINT "Integracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estudiante" (
    "id" TEXT NOT NULL,
    "institucion_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantillaCertificado" (
    "id" TEXT NOT NULL,
    "institucion_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "template_html" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantillaCertificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificado" (
    "id" TEXT NOT NULL,
    "estudiante_id" TEXT NOT NULL,
    "institucion_id" TEXT NOT NULL,
    "plantilla_id" TEXT NOT NULL,
    "codigo_unico" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "fecha_expiracion" TIMESTAMP(3),
    "pdf_url" TEXT,
    "hash_sha256" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificadoMetadata" (
    "id" TEXT NOT NULL,
    "certificado_id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "CertificadoMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revocacion" (
    "id" TEXT NOT NULL,
    "certificado_id" TEXT NOT NULL,
    "revocado_por" TEXT NOT NULL,
    "motivo_codigo" TEXT NOT NULL,
    "motivo_detalle" TEXT,
    "fecha_revocacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Revocacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificacionPublica" (
    "id" BIGSERIAL NOT NULL,
    "certificado_id" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "resultado" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificacionPublica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainTransaccion" (
    "id" TEXT NOT NULL,
    "certificado_id" TEXT NOT NULL,
    "hash" TEXT,
    "tx_hash" TEXT,
    "red" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "error_mensaje" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmado_en" TIMESTAMP(3),

    CONSTRAINT "BlockchainTransaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "valores_antes" TEXT,
    "valores_despues" TEXT,
    "ip" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_codigo_unico_key" ON "Certificado"("codigo_unico");

-- AddForeignKey
ALTER TABLE "UsuarioInstitucion" ADD CONSTRAINT "UsuarioInstitucion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioInstitucion" ADD CONSTRAINT "UsuarioInstitucion_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "Institucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioInstitucion" ADD CONSTRAINT "UsuarioInstitucion_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolPermiso" ADD CONSTRAINT "RolPermiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolPermiso" ADD CONSTRAINT "RolPermiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "Permiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integracion" ADD CONSTRAINT "Integracion_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "Institucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estudiante" ADD CONSTRAINT "Estudiante_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "Institucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaCertificado" ADD CONSTRAINT "PlantillaCertificado_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "Institucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "Institucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "PlantillaCertificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificadoMetadata" ADD CONSTRAINT "CertificadoMetadata_certificado_id_fkey" FOREIGN KEY ("certificado_id") REFERENCES "Certificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revocacion" ADD CONSTRAINT "Revocacion_certificado_id_fkey" FOREIGN KEY ("certificado_id") REFERENCES "Certificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revocacion" ADD CONSTRAINT "Revocacion_revocado_por_fkey" FOREIGN KEY ("revocado_por") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificacionPublica" ADD CONSTRAINT "VerificacionPublica_certificado_id_fkey" FOREIGN KEY ("certificado_id") REFERENCES "Certificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainTransaccion" ADD CONSTRAINT "BlockchainTransaccion_certificado_id_fkey" FOREIGN KEY ("certificado_id") REFERENCES "Certificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
