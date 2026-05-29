-- Índices de rendimiento para hot query paths (idempotentes con IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS "UsuarioInstitucion_usuario_id_idx" ON "UsuarioInstitucion"("usuario_id");
CREATE INDEX IF NOT EXISTS "UsuarioInstitucion_institucion_id_idx" ON "UsuarioInstitucion"("institucion_id");

CREATE INDEX IF NOT EXISTS "Estudiante_institucion_id_idx" ON "Estudiante"("institucion_id");

CREATE INDEX IF NOT EXISTS "PlantillaCertificado_institucion_id_idx" ON "PlantillaCertificado"("institucion_id");

CREATE INDEX IF NOT EXISTS "Certificado_institucion_id_idx" ON "Certificado"("institucion_id");
CREATE INDEX IF NOT EXISTS "Certificado_estudiante_id_idx" ON "Certificado"("estudiante_id");
CREATE INDEX IF NOT EXISTS "Certificado_estado_idx" ON "Certificado"("estado");
CREATE INDEX IF NOT EXISTS "Certificado_institucion_id_estado_idx" ON "Certificado"("institucion_id", "estado");

CREATE INDEX IF NOT EXISTS "CertificadoMetadata_certificado_id_idx" ON "CertificadoMetadata"("certificado_id");

CREATE INDEX IF NOT EXISTS "Revocacion_certificado_id_idx" ON "Revocacion"("certificado_id");

CREATE INDEX IF NOT EXISTS "VerificacionPublica_certificado_id_idx" ON "VerificacionPublica"("certificado_id");
CREATE INDEX IF NOT EXISTS "VerificacionPublica_fecha_idx" ON "VerificacionPublica"("fecha");

CREATE INDEX IF NOT EXISTS "RefreshToken_usuario_id_revoked_at_idx" ON "RefreshToken"("usuario_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "RefreshToken_expires_at_idx" ON "RefreshToken"("expires_at");

CREATE INDEX IF NOT EXISTS "Auditoria_institucion_id_fecha_idx" ON "Auditoria"("institucion_id", "fecha");
CREATE INDEX IF NOT EXISTS "Auditoria_entidad_entidad_id_idx" ON "Auditoria"("entidad", "entidad_id");
CREATE INDEX IF NOT EXISTS "Auditoria_usuario_id_idx" ON "Auditoria"("usuario_id");
