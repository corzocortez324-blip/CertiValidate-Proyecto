"""Configuración central. Todo se puede sobreescribir con variables de entorno.

Los valores por defecto corresponden a los usuarios que crea
certivalidate-backend/scripts/preparar-e2e.js (`npm run prepare:e2e`).
"""
import os


def env(name, default=""):
    return os.getenv(name, default)


BASE_URL = env("BASE_URL", "http://localhost:5173").rstrip("/")
# API del backend (certivalidate-backend). Se usa SOLO para comprobaciones de apoyo
# (código HTTP real del servidor); si no está accesible, esas comprobaciones se omiten.
BACKEND_URL = env("BACKEND_URL", "http://localhost:3000/api").rstrip("/")
TIMEOUT = int(env("TIMEOUT", "15"))
HEADLESS = env("HEADLESS", "0") == "1"
EVIDENCE_DIR = env("EVIDENCE_DIR", "evidencias")

INSTITUCION = env("INSTITUCION", "Universidad Popular del Cesar")

# Usuario administrador (CA001, CA005-CA015)
ADMIN_EMAIL = env("ADMIN_EMAIL", "juan@unicesar.edu.co")
ADMIN_PASSWORD = env("ADMIN_PASSWORD", "Clave1234")

# Usuario lector (CA016). Si LECTOR_PASSWORD no está definida se prueban, en orden,
# la clave del seed del backend (prisma/seed.js) y la del usuario "demo" del frontend.
LECTOR_EMAIL = env("LECTOR_EMAIL", "lector@certivalidate.com")
LECTOR_PASSWORDS = [env("LECTOR_PASSWORD")] if env("LECTOR_PASSWORD") else [
    "Lector1234!", "L3ct0r#2026$Cv"]

# CA003: necesita un usuario DISTINTO al de CA001 (allí el 2FA está deshabilitado)
TOTP_EMAIL = env("TOTP_EMAIL", "totp.e2e@certivalidate.test")
TOTP_PASSWORD = env("TOTP_PASSWORD", "Clave1234")
TOTP_SECRET = env("TOTP_SECRET", "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP")  # secreto base32 de la app autenticadora

# CA002: usuario DEDICADO. La prueba lo deja bloqueado ~15 min.
LOCKOUT_EMAIL = env("LOCKOUT_EMAIL", "bloqueo.e2e@certivalidate.test")
LOCKOUT_PASSWORD = env("LOCKOUT_PASSWORD", "Clave1234")

# CA004: por defecto se genera un correo único por ejecución
REGISTER_EMAIL = env("REGISTER_EMAIL", "")
REGISTER_PASSWORD = env("REGISTER_PASSWORD", "Clave1234")
# El backend envía el correo con Resend (no hay buzón local). Para completar el paso
# «abrir el enlace de verificación» sin leer el correo, la prueba puede leer el token
# directamente de la BD (tabla "Usuario", columna token_verificacion):
DATABASE_URL = env("DATABASE_URL", "")  # p. ej. postgresql://usuario:clave@localhost:5432/certivalidate

# CA005 / CA007
STUDENT = {
    "nombre": env("STUDENT_NOMBRE", "Ana"),
    "apellido": env("STUDENT_APELLIDO", "Martínez"),
    "documento": env("STUDENT_DOC", "1023456789"),
    "email": env("STUDENT_EMAIL", "ana@email.com"),
}

# CA006
PLANTILLA_NOMBRE = env("PLANTILLA_NOMBRE", "Certificado de Grado")
PLANTILLA_VERSION = env("PLANTILLA_VERSION", "1")

# CA014
INTEG_URL = env("INTEG_URL", "https://api.miinstitucion.edu.co")
INTEG_KEY = env("INTEG_KEY", "sk-abc123")

# Buzón de pruebas MailHog (opcional, solo si redirige el SMTP/Resend a MailHog)
MAILHOG_URL = env("MAILHOG_URL", "").rstrip("/")
