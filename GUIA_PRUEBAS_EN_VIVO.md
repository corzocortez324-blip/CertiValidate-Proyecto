# Guía para ejecutar las pruebas en vivo

Cómo preparar un PC y ejecutar, frente a los pares académicos, las pruebas del documento.
Todas las pruebas usan bases de datos **locales**; nunca la base de producción (Supabase).
El backend se niega a correr las pruebas si `DATABASE_URL` apunta a Supabase.

## 1. Preparación en un PC nuevo (una sola vez)

Estos pasos se verificaron en un clon limpio del repositorio, en Windows: backend 337/337,
frontend 39/39, academic-api 13/13 y aceptación 17/17.

**Requisitos:**
- Git, Node.js 24 y PostgreSQL local (usuario `postgres`, puerto 5432).
- Python 3.10+ y Google Chrome (o Edge), solo para aceptación.

1. Obtener el código. La primera vez se clona; después basta con actualizar:
   ```powershell
   git clone https://github.com/corzocortez324-blip/CertiValidate-Proyecto.git
   cd CertiValidate-Proyecto
   git pull                       # en las siguientes ocasiones
   ```
2. Instalar las dependencias. Se usa `npm install`, no `npm ci`: el lockfile del backend
   incluye `fsevents`, que solo existe en macOS, y `npm ci` falla en Windows.
   ```powershell
   cd certivalidate-backend; npm install; cd ..
   cd certivalidate-frontend; npm install; cd ..
   cd academic-api; npm install; cd ..
   cd metricas; npm install; cd ..
   cd pruebas_aceptacion; pip install -r requirements.txt; cd ..
   ```
3. Crear las tres bases locales (con pgAdmin o con `psql -U postgres`):
   ```sql
   CREATE DATABASE certivalidate_test;
   CREATE DATABASE certivalidate_academic_test;
   CREATE DATABASE certivalidate_e2e;
   ```
4. Crear los archivos de entorno a partir de las plantillas y poner la clave de `postgres`
   en `DATABASE_URL` y `DIRECT_URL`:
   - `certivalidate-backend/.env.test` desde `.env.test.example` (cambiar el puerto a 5432
     si PostgreSQL usa el puerto por defecto).
   - `certivalidate-backend/.env.e2e` desde `.env.e2e.example`. Para CA004 y CA013 hace falta
     la `RESEND_API_KEY` real: pedirla al equipo por un canal privado, nunca subirla al repo.

   No hace falta el `.env` de producción (Supabase): las pruebas no lo usan.
5. Preparar la base de pruebas unitarias y de integración:
   ```powershell
   cd certivalidate-backend
   npm run migrate:test
   npx dotenv -e .env.test -- node prisma/seed.js      # roles y permisos
   cd ..\academic-api
   $env:DATABASE_URL="postgresql://postgres:CLAVE@localhost:5432/certivalidate_academic_test"
   npx prisma migrate deploy
   Remove-Item Env:DATABASE_URL
   cd ..
   ```
6. Preparar la base de aceptación:
   ```powershell
   cd certivalidate-backend
   npx dotenv -e .env.e2e -- npx prisma migrate deploy
   npx dotenv -e .env.e2e -- node prisma/seed.js       # roles y lector demo (CA016)
   npm run prepare:e2e                                  # usuarios de CA001–CA015
   cd ..
   ```
7. Ensayar una vez cada comando de la sección 2. La primera ejecución tarda más.

La red blockchain (ganache con el contrato `CertiValidateRegistry.sol`) y la API
académica las levantan las propias pruebas; no hay que iniciarlas a mano.

## 2. Comandos

### Un caso del documento

La salida muestra solo el caso ejecutado, con su ✓ y su duración, y un resumen.

```powershell
cd certivalidate-backend
npm run test:caso -- tests/integracion-doc/hilos-1.test.js -t "CI-H08-01"
```

Un caso puede tener pruebas en el backend, en el frontend o en ambos. Si aparece en varios
archivos del mismo proyecto, se pasan todos: `npm run test:caso -- <archivo1> <archivo2> -t "<caso>"`.

| Archivo | Casos |
|---|---|
| `certivalidate-backend/tests/integracion-doc/incremental.test.js` | CI-A02, CI-A03, CI-A04, CI-A05, CI-A07, CI-A08, CI-A09, CI-A10, CI-A11, CI-A12, CI-DA1, CI-DA2, CI-DA3, CI-DA4, CI-DP3, CI-DP4, CI-DP5, CI-DP6, CI-DP7, CI-DP8 |
| `certivalidate-backend/tests/integracion-doc/hilos-1.test.js` | CI-H01-01 a CI-H11-03 (los 33 casos) |
| `certivalidate-backend/tests/integracion-doc/hilos-2.test.js` | CI-H12-01 a CI-H22-03 (los 33 casos) |
| `certivalidate-backend/tests/regresion.test.js` | CI-H08-03, CI-H10-01, CI-H12-01, CI-H12-03, CI-H13-01, CI-H13-02, CI-H15-02 y los hallazgos unitarios corregidos (filtro por el nombre de la prueba, por ejemplo `-t "duplicado"`) |
| `certivalidate-frontend/src/__tests__/integracion/incremental.test.jsx` | CI-A01, CI-A06, CI-A11, CI-A12, CI-DA1, CI-DA2, CI-DA3, CI-DP1, CI-DP2 |
| `certivalidate-frontend/src/__tests__/integracion/hilos.test.jsx` | CI-H08-01, CI-H14-03, CI-H16-03, CI-H22-01, CI-H22-02 |

Ejemplo en el frontend:

```powershell
cd certivalidate-frontend
npm run test:caso -- src/__tests__/integracion/hilos.test.jsx -t "CI-H08-01"
```

### Suites completas

```powershell
cd certivalidate-backend; npm run test:resumen    # 337 pruebas, unos 3 minutos
cd certivalidate-frontend; npm test               # 39 pruebas
cd academic-api; npm test                         # 13 pruebas
```

### Aceptación (Selenium)

Ver `pruebas_aceptacion/README.md`. Necesita el backend y el frontend corriendo con la base
`certivalidate_e2e`:

```powershell
cd certivalidate-backend; npm run prepare:e2e; npm run start:e2e
```

En otra terminal:

```powershell
cd certivalidate-frontend; npm run dev
```

Luego, desde `pruebas_aceptacion`, ejecutar `pytest -k ca009` para un caso o `pytest` para todos.
CA002 bloquea su cuenta durante 15 minutos, así que conviene dejarlo para el final.

### Medición del software (parte 3)

```powershell
cd metricas
npm run loc     # tamaño con Node.js: 27.781 LOC fuente
npm run cloc    # tamaño con cloc: 27.763 LOC fuente (usa el Perl de Git for Windows)
npm run ck      # métricas CK por módulo
```

Las dos herramientas reciben `lista-archivos.txt`: los mismos 170 archivos que analiza SonarQube Cloud
(28.058 LOC fuente en el análisis del commit 1a0f9af). El contrato Solidity se informa aparte.

## 3. Sugerencia de demostración (unos 10 minutos)

1. `npm run test:resumen` en el backend: la suite completa en verde.
2. `CI-H01-02`: inicio de sesión con 2FA, código inválido y válido.
3. `CI-H08-01`: envío del certificado por correo, en el backend y en el frontend.
4. Un hallazgo de la versión 1 ya corregido:
   `npm run test:caso -- tests/regresion.test.js -t "duplicado"`.
5. `pytest -k ca011`: revocar un certificado y verlo como revocado en el portal público.
6. `npm run loc` en `metricas`.
