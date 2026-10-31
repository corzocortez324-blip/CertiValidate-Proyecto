# Pruebas de aceptación CertiValidate (Selenium + pytest)

Automatiza los casos CA001–CA016 del documento 4.2. Cada prueba guarda una captura en
`evidencias/` y el resultado en `evidencias/resultados.csv`, listo para llenar la tabla 4.2.2.

## Requisitos
- Python 3.10+, Google Chrome. Selenium Manager descarga el driver solo.
- Frontend (`npm run dev`, por defecto `http://localhost:5173`) **y backend** corriendo.

```bash
pip install -r requirements.txt
# Linux/macOS
export BASE_URL=http://localhost:5173 ADMIN_EMAIL=juan@unicesar.edu.co ADMIN_PASSWORD=Clave1234
pytest
# Windows (PowerShell): $env:ADMIN_EMAIL="juan@unicesar.edu.co"; pytest
```
`HEADLESS=1` ejecuta sin ventana. `pytest -k ca007` corre un solo caso.

## Variables de entorno
| Variable | Para qué |
|---|---|
| `BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Frontend y usuario admin |
| `LECTOR_EMAIL`, `LECTOR_PASSWORD` | CA016 |
| `TOTP_EMAIL`, `TOTP_PASSWORD`, `TOTP_SECRET` | CA003 (se omite si faltan) |
| `LOCKOUT_EMAIL`, `LOCKOUT_PASSWORD` | CA002 (se omite si falta; **bloquea esa cuenta ~15 min**) |
| `MAILHOG_URL` | Lee correos: verificación (CA004) y recepción (CA013) |
| `STUDENT_DOC`, `PLANTILLA_NOMBRE`, `INSTITUCION`... | Datos de prueba (ver `config.py`) |

## Orden y dependencias
CA007 deja el código del certificado que usan CA008, CA009, CA011, CA012, CA013 y CA015.
El orden de ejecución es: ... CA010, CA012, CA013, **CA011**, CA014, CA015, CA016, **CA002**
(se descarga y envía antes de revocar; el bloqueo va al final). Si una prueba falla,
las que dependen de ella se marcan «Omitido».

## Repetir la ejecución
CA005 y CA006 usan los datos del documento (documento 1023456789, plantilla «Certificado de Grado»).
Si ya existen en la base de datos, cambie `STUDENT_DOC` / `PLANTILLA_NOMBRE` o limpie los datos.
CA004 genera un correo único por ejecución.
