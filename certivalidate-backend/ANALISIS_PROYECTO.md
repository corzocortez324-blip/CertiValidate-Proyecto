# Análisis Completo del Proyecto CertiValidate Backend

## Índice
1. [Estructura General del Proyecto](#1-estructura-general-del-proyecto)
2. [Archivos Principales](#2-archivos-principales)
3. [Controllers](#3-controllers)
4. [Routes](#4-routes)
5. [Middlewares](#5-middlewares)
6. [Utils](#6-utils)
7. [Schema de Prisma](#7-schema-de-prisma)
8. [Configuración](#8-configuración)

---

## 1. Estructura General del Proyecto

### Propósito
**CertiValidate** es una API REST para emisión y verificación de certificados digitales con las siguientes características:
- Autenticación segura con JWT (access tokens + refresh tokens)
- Emisión de certificados con hash SHA-256
- Verificación pública sin autenticación
- Gestión multi-institución con control de roles y permisos
- Sistema de auditoría completo
- Generación de PDFs con códigos QR
- Envío de emails de verificación y notificaciones

### Tecnologías Principales
| Tecnología | Uso |
|---|---|
| **Express.js** | Framework web HTTP |
| **Prisma 7** | ORM para PostgreSQL con adapter-pg |
| **PostgreSQL** | Base de datos (Supabase recomendado) |
| **JWT** | Autenticación segura con tokens |
| **bcrypt** | Hash seguro de contraseñas |
| **PDFKit** | Generación de PDFs |
| **QRCode** | Generación de códigos QR en certificados |
| **Resend** | Envío de emails |
| **Pino** | Logging estructurado |
| **Helmet** | Seguridad HTTP headers |
| **express-validator** | Validación de inputs |
| **express-rate-limit** | Rate limiting por endpoint |
| **Docker** | Containerización con docker-compose |
| **Jest** | Testing framework |

### Versión y Ambiente
- **Versión**: 1.1.0
- **Node.js**: v20 o superior
- **Ambiente**: development, production, test

---

## 2. Archivos Principales

### 2.1 index.js - Punto de Entrada

**Responsabilidades:**
- Carga configuración desde `.env` 
- Valida variables de entorno requeridas
- Conecta a la base de datos
- Inicia el servidor HTTP en puerto 3000
- Implementa signal handlers para graceful shutdown (SIGTERM, SIGINT)
- Captura excepciones no manejadas y promise rejections

**Flujo:**
1. Cargar `.env` con `dotenv.config()`
2. Configurar serialización de BigInt a JSON
3. Validar variables de entorno obligatorias
4. Conectar a Prisma
5. Arrancar servidor en puerto definido
6. Registrar signal handlers para cierre limpio

**Salida esperada:**
```
CertiValidate API v1.1.0 iniciada | port: 3000 | env: development
```

---

### 2.2 app.js - Configuración Express

**Responsabilidades:**
- Configurar express.js con middlewares de seguridad
- Implementar rate limiting por tipo de endpoint
- Configurar CORS con lista blanca de orígenes
- Montar rutas de la API
- Manejo de errores global

**Middlewares en orden de aplicación:**
1. **requestId.middleware** - Genera/propaga X-Request-ID
2. **helmet()** - Headers de seguridad HTTP
3. **pinoHttp()** - Logging automático con pino
4. **CORS** - Validación de orígenes (bloquea peticiones cross-origin no autorizadas)
5. **express.json()** - Parser JSON (límite 1MB)
6. **express.urlencoded()** - Parser form-data

**Rate Limiters:**
- **limiterGeneral**: 100 requests/15min (global)
- **limiterAuth**: 10 requests/15min (endpoints de autenticación)
- **limiterVerificacion**: 50 requests/15min (verificación pública de certificados)

**Rutas Montadas:**
- `/api/auth` - Autenticación
- `/api/certificados` - Gestión de certificados
- `/api/estudiantes` - CRUD estudiantes
- `/api/instituciones` - CRUD instituciones
- `/api/plantillas` - Plantillas de certificados
- `/api/auditoria` - Logs de auditoría
- `/api/usuarios` - Gestión de usuarios
- `/api/docs` - Swagger UI (no en producción por defecto)
- `/health` - Health check

**Manejo de Errores:**
- Respuesta 404 para rutas no encontradas
- Error handler global que:
  - Detecta JSON inválido
  - Loguea errores 5xx
  - Advierte sobre errores 4xx
  - Oculta detalles en producción

---

### 2.3 package.json - Configuración del Proyecto

**Dependencias Principales:**
```json
{
  "dependencies": {
    "@prisma/adapter-pg": "^7.7.0",
    "@prisma/client": "^7.7.0",
    "bcrypt": "^6.0.0",
    "cors": "^2.8.6",
    "dotenv": "^17.4.0",
    "express": "^5.2.1",
    "express-rate-limit": "^7.5.1",
    "express-validator": "^7.0.1",
    "helmet": "^8.1.0",
    "js-yaml": "^4.1.1",
    "jsonwebtoken": "^9.0.3",
    "pdfkit": "^0.18.0",
    "pg": "^8.20.0",
    "pino": "^10.3.1",
    "pino-http": "^11.0.0",
    "qrcode": "^1.5.4",
    "resend": "^6.12.2",
    "swagger-ui-express": "^5.0.1"
  }
}
```

**Scripts:**
- `start` - Arranca servidor en producción
- `dev` - Arranca con nodemon en desarrollo
- `seed` - Ejecuta archivo de seed para roles y permisos
- `migrate` - Aplica migraciones de Prisma
- `migrate:dev` - Migraciones interactivas en desarrollo
- `test` - Ejecuta tests con Jest

**Seed automático:**
```json
"prisma": {
  "seed": "node prisma/seed.js"
}
```

---

## 3. Controllers

Los controladores manejan la lógica de negocio y responden a las requests HTTP.

### 3.1 auth.controller.js - Autenticación y Perfil

**Funciones Principales:**

#### `register(req, res)`
- **Propósito**: Crear nuevo usuario (auto-registro)
- **Inputs**: nombre, apellido, email, password
- **Validaciones**:
  - Email único
  - Password >= 8 caracteres con mayúscula, minúscula y número
  - Nombre obligatorio
- **Proceso**:
  1. Hashear password con bcrypt (salt 12)
  2. Generar token de verificación de email (32 bytes hex)
  3. Token expira en 24 horas
  4. Crear usuario con `email_verificado: false`
  5. Enviar email de verificación asincronamente
  6. Registrar auditoría
- **Respuesta**: Usuario creado (200/201)
- **Errores**: Email duplicado (409), datos faltantes (400)

#### `login(req, res)`
- **Propósito**: Autenticar usuario y generar tokens
- **Inputs**: email, password
- **Validaciones**:
  - Usuario existe y no está eliminado
  - Usuario activo (`activo: true`)
  - Password correcto (bcrypt.compare)
- **Proceso**:
  1. Verificar credenciales
  2. Actualizar `ultimo_acceso`
  3. Generar access token (JWT, 1h por defecto)
  4. Generar refresh token (JWT, 7d por defecto)
  5. Guardar refresh token en BD (hasheado)
  6. Obtener accesos del usuario (instituciones + roles)
  7. Retornar tokens + usuario + accesos
- **Respuesta**: { token, refreshToken, usuario, accesos }
- **Errores**: Credenciales inválidas (401), usuario desactivado (403)

#### `refreshToken(req, res)`
- **Propósito**: Renovar access token usando refresh token
- **Inputs**: refreshToken
- **Validaciones**:
  - Refresh token válido (JWT)
  - Refresh token no revocado
  - Refresh token no expirado
  - Usuario existe y está activo
- **Proceso**:
  1. Verificar refresh token
  2. Rotar refresh token (revoca anterior, crea uno nuevo)
  3. Generar nuevo access token
  4. Retornar nuevos tokens
- **Respuesta**: { token, refreshToken }
- **Errores**: Token expirado (401), token inválido (401)

#### `logout(req, res)`
- **Propósito**: Cerrar sesión revocando refresh token
- **Inputs**: refreshToken
- **Proceso**:
  1. Revocar refresh token en BD (set `revoked_at`)
  2. Retornar éxito
- **Respuesta**: null (200)

#### `actualizarPerfil(req, res)`
- **Propósito**: Actualizar datos del usuario autenticado
- **Inputs**: nombre, apellido, email (opcionales pero al menos uno)
- **Validaciones**:
  - Al menos un campo debe estar presente
  - Si email es nuevo, no debe estar en uso
- **Proceso**:
  1. Validar permiso de actualización propia
  2. Verificar email único si cambia
  3. Actualizar datos
  4. Registrar auditoría con valores antes y después
- **Respuesta**: Usuario actualizado
- **Errores**: Usuario no encontrado (404), email en uso (409)

#### Funciones auxiliares:
- `formatUsuario(usuario)` - Oculta password_hash y tokens de verificación
- `getUserAgent(req)` - Extrae user-agent del header

---

### 3.2 certificado.controller.js - Emisión y Verificación

**Funciones Principales:**

#### `emitirCertificado(req, res)` ⭐ Función Central
- **Propósito**: Crear nuevo certificado válido
- **Inputs**: estudiante_id, institucion_id, plantilla_id
- **Validaciones**:
  - IDs obligatorios
  - Estudiante existe y pertenece a institución
  - Institución existe
  - Plantilla existe, está activa, y pertenece a institución
  - Usuario autorizado para emitir en esa institución
  - No existe certificado vigente para ese estudiante+plantilla
- **Proceso**:
  1. Validar todas las entidades
  2. Generar código único (16 caracteres hex en mayúscula)
  3. Generar hash SHA-256 del contenido del certificado
  4. Crear certificado en transacción atomática:
     - Guardar certificado con estado `valido`
     - Guardar registro de auditoría
  5. Enviar email al estudiante (asincronamente)
- **Hash SHA-256**: Se calcula como:
  ```
  SHA256(estudiante_id|nombre|apellido|email|institucion_id|institucion_nombre|
         plantilla_id|plantilla_nombre|codigo_unico|fecha_emision_ISO)
  ```
- **Respuesta**: Certificado creado (201)
- **Errores**: Entidades no encontradas (404), no autorizado (403), certificado vigente (409)

#### `verificarCertificado(req, res)` ⭐ Endpoint Público
- **Propósito**: Verificar autenticidad de certificado sin autenticación
- **Inputs**: hash o codigo
- **Validaciones**:
  - Al menos uno de hash o codigo debe estar presente
- **Proceso**:
  1. Buscar certificado por hash SHA-256 o código único
  2. Si no existe → retornar estado `no_encontrado`
  3. Si existe:
     - Recomputar hash SHA-256 del contenido
     - Comparar con hash guardado (integridad)
     - Verificar estado del certificado
     - Verificar si está expirado
     - Determinar resultado (valido/revocado/expirado)
  4. Guardar verificación pública (IP, user-agent, resultado)
  5. Retornar detalles del certificado
- **Respuesta**:
  ```json
  {
    "codigo_unico": "...",
    "estado": "valido|revocado|expirado|no_encontrado",
    "mensaje": "...",
    "hash_verificado": true/false,
    "fecha_emision": "...",
    "fecha_expiracion": "...",
    "estudiante": { nombre, apellido },
    "institucion": { nombre },
    "plantilla": { nombre }
  }
  ```
- **Errores**: Integridad comprometida (409)

#### `descargarCertificado(req, res)`
- **Propósito**: Descargar certificado como PDF
- **Inputs**: id (param)
- **Validaciones**:
  - Usuario autenticado
  - Usuario autorizado para verlo (institución)
- **Proceso**:
  1. Buscar certificado con relaciones
  2. Verificar autorización
  3. Generar PDF con piDFKit:
     - Título y datos de institución
     - Nombre del estudiante
     - Nombre del programa/plantilla
     - Código único
     - Hash SHA-256 truncado
     - QR que enlaza a verificación pública
     - Footer con copyright
  4. Stream PDF a respuesta HTTP
- **Respuesta**: PDF (application/pdf)
- **Errores**: No encontrado (404), no autorizado (403)

#### `listarCertificados(req, res)`
- **Propósito**: Listar certificados con paginación y filtros
- **Query Params**:
  - page (default 1)
  - limit (default 10, max 100)
  - estado (filtro: valido/revocado/expirado)
  - institucion_id (filtro)
  - estudiante_id (filtro)
  - search (busca en código, hash, nombre estudiante, plantilla)
- **Proceso**:
  1. Verificar acceso a instituciones
  2. Aplicar filtros
  3. Ejecutar consulta en transacción
  4. Contar total
  5. Retornar paginado
- **Respuesta**: { data: certificados[], meta: { total, page, limit, totalPages } }

#### `obtenerCertificado(req, res)`
- **Propósito**: Obtener detalles de un certificado
- **Inputs**: id (param)
- **Validaciones**:
  - Usuario autorizado para verlo
- **Respuesta**: Certificado completo con relaciones

#### `obtenerVerificaciones(req, res)`
- **Propósito**: Historial de verificaciones públicas (quién ha verificado)
- **Inputs**: id (param), page, limit
- **Respuesta**: Verificaciones paginadas (IP, user-agent, resultado, fecha)

#### `obtenerRevocaciones(req, res)`
- **Propósito**: Historial de revocaciones
- **Respuesta**: Revocaciones paginadas con usuario que revocó

#### `revocarCertificado(req, res)`
- **Propósito**: Revocar un certificado válido
- **Inputs**: 
  - id (param)
  - motivo_codigo (obligatorio: FRAUDE, ERROR_DATOS, etc.)
  - motivo_detalle (opcional, max 500 chars)
- **Validaciones**:
  - Certificado existe y no está revocado
  - Usuario autorizado
  - Motivo válido
- **Proceso**:
  1. Cambiar estado de certificado a `revocado`
  2. Guardar record de revocación con usuario y motivo
  3. Registrar auditoría
- **Respuesta**: Certificado actualizado

---

### 3.3 usuario.controller.js - Gestión de Usuarios

**Funciones Principales:**

#### `listarUsuarios(req, res)`
- **Propósito**: Listar todos los usuarios del sistema
- **Query Params**:
  - page, limit
  - search (nombre, apellido, email)
- **Proceso**:
  1. Aplicar paginación y búsqueda
  2. Obtener instituciones y roles de cada usuario
  3. Determinar rol principal por prioridad (admin > editor > lector)
- **Respuesta**: { usuarios: [], total, page, limit, totalPages }

#### `obtenerUsuario(req, res)`
- **Propósito**: Obtener usuario por ID
- **Inputs**: id (param)
- **Respuesta**: Usuario con rol principal

#### `crearUsuario(req, res)`
- **Propósito**: Crear usuario desde admin (sin auto-registro)
- **Inputs**:
  - nombre (obligatorio)
  - apellido (obligatorio)
  - email (obligatorio, único)
  - password (obligatorio)
  - rol (optional, default "lector")
- **Proceso**:
  1. Validar email único
  2. Validar rol existe
  3. Hashear password
  4. Crear usuario en transacción:
     - Usuario con email_verificado: true (admin no necesita verificar)
     - UsuarioInstitucion link (usuario admin + rol lector por defecto)
  5. Enviar email de bienvenida con credenciales
  6. Registrar auditoría
- **Respuesta**: Usuario creado (201)
- **Errores**: Email duplicado (409), rol inválido (400)

#### `actualizarUsuario(req, res)`
- **Propósito**: Actualizar datos de usuario
- **Inputs**:
  - id (param)
  - nombre, apellido, email, activo, rol (opcionales)
- **Proceso**:
  1. Validar usuario existe
  2. Validar email único si cambia
  3. Actualizar datos del usuario
  4. Si rol es proporcionado, actualizar rol (upsert en UsuarioInstitucion)
  5. Registrar auditoría
- **Respuesta**: Usuario actualizado (200)

#### `eliminarUsuario(req, res)`
- **Propósito**: Eliminar usuario (soft delete)
- **Inputs**: id (param)
- **Validaciones**:
  - Usuario no es el de la petición (no puede auto-eliminarse)
  - Usuario existe
- **Proceso**:
  1. Marcar como eliminado (deleted_at + activo: false)
  2. Registrar auditoría
- **Respuesta**: null (200)

---

### 3.4 institucion.controller.js - Gestión de Instituciones

**Funciones Principales:**

#### `listarInstituciones(req, res)`
- **Propósito**: Listar instituciones a las que el usuario pertenece
- **Validaciones**:
  - Usuario tiene acceso a al menos una institución
- **Proceso**:
  1. Filtrar instituciones por req.institucionIds
  2. Paginar
- **Respuesta**: { data: instituciones[], meta: { ... } }

#### `obtenerInstitucion(req, res)`
- **Propósito**: Obtener detalles de institución con conteos
- **Inputs**: id (param)
- **Validaciones**:
  - Usuario autorizado para verla
- **Process**:
  1. Buscar institución
  2. Contar estudiantes, plantillas, certificados
- **Respuesta**: Institución con _count

#### `crearInstitucion(req, res)`
- **Propósito**: Crear nueva institución
- **Inputs**:
  - nombre (obligatorio, >= 3 caracteres)
  - dominio (opcional)
  - logo_url (opcional, debe ser URL válida)
  - activa (optional, default true)
- **Proceso**:
  1. Crear institución en transacción
  2. Crear UsuarioInstitucion link (usuario creator + rol admin)
  3. Registrar auditoría
- **Respuesta**: Institución creada (201)

#### `actualizarInstitucion(req, res)`
- **Propósito**: Actualizar datos de institución
- **Inputs**: id (param), nombre, dominio, logo_url, activa (opcionales)
- **Validaciones**:
  - Usuario autorizado
  - Institución existe
- **Proceso**:
  1. Validar permisos
  2. Actualizar campos proporcionados
- **Respuesta**: Institución actualizada

#### `desactivarInstitucion(req, res)`
- **Propósito**: Desactivar institución (soft deactivate)
- **Inputs**: id (param)
- **Proceso**:
  1. Verificar no está ya desactivada
  2. Set activa: false
- **Respuesta**: Institución desactivada

#### `obtenerEstadisticasInstitucion(req, res)` ⭐
- **Propósito**: Dashboard con métricas de institución
- **Respuesta**:
  ```json
  {
    "estudiantesCount": number,
    "plantillasCount": number,
    "certificadosCount": number,
    "certificadosValidosCount": number,
    "certificadosRevocadosCount": number,
    "certificadosExpiradosCount": number,
    "verificacionesCount": number
  }
  ```
- **Proceso**: Ejecuta 7 queries en paralelo con Promise.all

---

### 3.5 estudiante.controller.js - CRUD de Estudiantes

**Funciones Principales:**

#### `listarEstudiantes(req, res)`
- **Query Params**: page, limit, search, institucion_id
- **Búsqueda**: nombre, apellido, documento, email
- **Respuesta**: Estudiantes paginados

#### `obtenerEstudiante(req, res)`
- **Validaciones**: Usuario autorizado para verlo
- **Respuesta**: Estudiante con detalles

#### `crearEstudiante(req, res)`
- **Inputs**:
  - institucion_id (obligatorio)
  - nombre, apellido (obligatorios)
  - documento (obligatorio, >= 4 caracteres)
  - email (opcional)
- **Validaciones**:
  - Usuario autorizado para crear en esa institución
- **Respuesta**: Estudiante creado (201)

#### `actualizarEstudiante(req, res)`
- **Validaciones**:
  - Usuario autorizado
  - Si cambia institución, debe estar autorizado para la nueva
  - Si existe certificados, no se puede mover de institución (implícito)
- **Respuesta**: Estudiante actualizado

#### `eliminarEstudiante(req, res)`
- **Validaciones**:
  - No puede tener certificados asociados
- **Proceso**:
  1. Contar certificados
  2. Si > 0, error 409
  3. Si 0, deletear (hard delete, no soft)
- **Respuesta**: null (200)

---

### 3.6 plantilla.controller.js - Plantillas de Certificados

**Funciones Principales:**

#### `listarPlantillas(req, res)`
- **Filtra**: Solo plantillas activas (activa: true)
- **Respuesta**: Plantillas paginadas

#### `obtenerPlantilla(req, res)`
- **Validaciones**: Usuario autorizado
- **Respuesta**: Plantilla con template_html

#### `crearPlantilla(req, res)`
- **Inputs**:
  - institucion_id (obligatorio)
  - nombre (obligatorio)
  - template_html (obligatorio, >= 10 caracteres)
  - version (obligatorio, entero >= 1)
  - activa (optional, default true)
- **Respuesta**: Plantilla creada (201)

#### `actualizarPlantilla(req, res)`
- **Inputs**: Todos opcionales (pero al menos uno)
- **Respuesta**: Plantilla actualizada

#### `archivarPlantilla(req, res)`
- **Propósito**: Desactivar plantilla
- **Validaciones**:
  - Verificar que no esté ya inactiva
  - Contar certificados activos emitidos con esta plantilla
- **Respuesta**: 
  - Si hay certificados activos: advertencia en mensaje
  - Plantilla desactivada (activa: false)
- **Nota**: No es hard delete, solo desactivación

---

### 3.7 auditoria.controller.js - Logs de Auditoría

**Funciones Principales:**

#### `listarAuditoria(req, res)`
- **Query Params**:
  - page, limit
  - entidad (filtro: Usuario, Certificado, Estudiante, etc.)
  - accion (filtro: CREAR_USUARIO, EMITIR_CERTIFICADO, etc.)
  - usuario_id (filtro)
  - fecha_desde, fecha_hasta (rango fechas)
- **Validaciones**:
  - Usuario autorizado (puede ver auditoría de su institución o de sí mismo)
- **Proceso**:
  1. Construir filtro con regla de autorización
  2. Aplicar filtros adicionales
  3. Contar y paginar
  4. Incluir datos del usuario que realizó la acción
- **Respuesta**: { data: auditorias[], meta: { ... } }

#### `obtenerAuditoriaPorEntidad(req, res)`
- **Propósito**: Historial completo de cambios en una entidad
- **Inputs**:
  - entidad (param): Usuario, Certificado, Estudiante, etc.
  - entidad_id (param): UUID de la entidad
  - page, limit (query)
- **Proceso**:
  1. Filtrar auditorías por entidad + entidad_id
  2. Mostrar valores_antes y valores_despues (JSON)
  3. Ordenar por fecha DESC
- **Respuesta**: Auditorías paginadas

**Reglas de Autorización:**
```javascript
// Usuario puede ver:
// 1. Auditorías de su institución (institucion_id en su lista)
// 2. Auditorías sobre su propio usuario (entidad: Usuario, entidad_id: su ID)
```

---

## 4. Routes

Las rutas definen los endpoints y aplican middlewares de autenticación, validación y autorización en orden.

### 4.1 auth.routes.js

| Método | Ruta | Middleware | Función | Descripción |
|--------|------|-----------|----------|-------------|
| POST | `/register` | validator | register | Registrar nuevo usuario (público) |
| GET | `/verificar-email` | - | verificarEmail | Verificar email con token |
| POST | `/login` | validator | login | Login y obtener tokens |
| POST | `/refresh` | verificarToken, validator | refreshToken | Renovar access token |
| POST | `/logout` | verificarToken, validator | logout | Revocar refresh token |
| GET | `/perfil` | verificarToken | obtenerPerfil | Obtener perfil del usuario |
| GET | `/permisos` | verificarToken | obtenerPermisos | Listar permisos del usuario |
| PUT | `/perfil` | verificarToken, requireEmailVerified, validator | actualizarPerfil | Actualizar perfil |
| PUT | `/perfil/password` | verificarToken, requireEmailVerified, validator | cambiarPassword | Cambiar contraseña |

**Notas:**
- `/register` y `/login` son públicos (sin autenticación)
- `/verificar-email` es público (verificación one-shot)
- `/refresh` requiere refresh token pero no access token
- Otros endpoints requieren access token válido + email verificado

---

### 4.2 certificado.routes.js

| Método | Ruta | Middleware | Función | Descripción |
|--------|------|-----------|----------|-------------|
| POST | `/emitir` | auth, permission(certificado:emitir), validator | emitirCertificado | Emitir certificado nuevo |
| GET | `/listar` | auth, permission(certificado:listar) | listarCertificados | Listar certificados |
| GET | `/descargar/:id` | auth, permission(certificado:descargar), validator | descargarCertificado | Descargar PDF |
| GET | `/:id/verificaciones` | auth, permission(certificado:ver), validator | obtenerVerificaciones | Historial verificaciones |
| GET | `/:id/revocaciones` | auth, permission(certificado:ver), validator | obtenerRevocaciones | Historial revocaciones |
| GET | `/:id` | auth, permission(certificado:ver), validator | obtenerCertificado | Obtener detalles |
| POST | `/:id/revocar` | auth, permission(certificado:revocar), validator | revocarCertificado | Revocar certificado |
| POST | `/verificar` | validator | verificarCertificado | Verificar certificado (público) |

**Notas:**
- `/verificar` es público (sin autenticación)
- Otros requieren autenticación
- Emitir requiere permiso específico sobre institución (institucionIdResolver)

---

### 4.3 usuario.routes.js

| Método | Ruta | Middleware | Función |
|--------|------|-----------|----------|
| GET | `/` | auth, permission(usuario:listar) | listarUsuarios |
| GET | `/:id` | auth, permission(usuario:ver), validator | obtenerUsuario |
| POST | `/` | auth, permission(usuario:crear) | crearUsuario |
| PUT | `/:id` | auth, permission(usuario:actualizar), validator | actualizarUsuario |
| DELETE | `/:id` | auth, permission(usuario:eliminar), validator | eliminarUsuario |

**Autorización**: Solo usuarios con rol que tenga permiso `usuario:*` en su institución

---

### 4.4 institucion.routes.js

| Método | Ruta | Middleware | Función |
|--------|------|-----------|----------|
| GET | `/` | auth, permission(institucion:ver) | listarInstituciones |
| GET | `/:id` | auth, permission(institucion:ver), validator | obtenerInstitucion |
| GET | `/:id/estadisticas` | auth, permission(institucion:estadisticas), validator | obtenerEstadisticasInstitucion |
| POST | `/` | auth, validator | crearInstitucion |
| PUT | `/:id` | auth, permission(institucion:actualizar), validator | actualizarInstitucion |
| PATCH | `/:id/desactivar` | auth, permission(institucion:actualizar), validator | desactivarInstitucion |

---

### 4.5 estudiante.routes.js

| Método | Ruta | Middleware | Función |
|--------|------|-----------|----------|
| GET | `/` | auth, permission(estudiante:listar) | listarEstudiantes |
| GET | `/:id` | auth, permission(estudiante:ver), validator | obtenerEstudiante |
| POST | `/` | auth, permission(estudiante:crear, resolver institución), validator | crearEstudiante |
| PUT | `/:id` | auth, permission(estudiante:actualizar), validator | actualizarEstudiante |
| DELETE | `/:id` | auth, permission(estudiante:eliminar), validator | eliminarEstudiante |

---

### 4.6 plantilla.routes.js

| Método | Ruta | Middleware | Función |
|--------|------|-----------|----------|
| GET | `/` | auth, permission(plantilla:listar) | listarPlantillas |
| GET | `/:id` | auth, permission(plantilla:ver), validator | obtenerPlantilla |
| POST | `/` | auth, permission(plantilla:crear), validator | crearPlantilla |
| PUT | `/:id` | auth, permission(plantilla:actualizar), validator | actualizarPlantilla |
| DELETE | `/:id` | auth, permission(plantilla:archivar), validator | archivarPlantilla |

---

### 4.7 auditoria.routes.js

| Método | Ruta | Middleware | Función |
|--------|------|-----------|----------|
| GET | `/` | auth, permission(auditoria:ver) | listarAuditoria |
| GET | `/:entidad/:entidad_id` | auth, permission(auditoria:ver), validator | obtenerAuditoriaPorEntidad |

---

## 5. Middlewares

### 5.1 auth.middleware.js

#### `verificarToken(req, res, next)`
**Propósito**: Validar JWT y cargar usuario en req

**Validaciones:**
1. Header `Authorization` con formato `Bearer <token>`
2. Token válido (JWT signature)
3. Token no expirado
4. Usuario existe en BD
5. Usuario no está eliminado
6. Usuario está activo

**Errores:**
- 401: Token faltante, inválido, expirado
- 403: Usuario desactivado

**Salida:**
```javascript
req.usuario = {
  id: "...",
  nombre: "...",
  email: "...",
  email_verificado: true/false
}
```

#### `requireEmailVerified(req, res, next)`
**Propósito**: Bloquear acceso si email no está verificado

**Validación**: `req.usuario.email_verificado === true`

**Error**: 403 "Debes verificar tu email antes de continuar"

**Excepciones**: Algunos endpoints permiten sin email verificado (login, refresh, logout, etc.)

---

### 5.2 requestId.middleware.js

**Propósito**: Generar o propagar X-Request-ID para trazabilidad

**Lógica:**
1. Si request tiene header `X-Request-ID`, usar ese
2. Si no, generar UUID v4 aleatorio
3. Guardar en `req.requestId`
4. Establecer response header `X-Request-ID`

**Beneficio**: Logs correlacionados, debugging distribuido, seguimiento de requests

---

## 6. Utils

### 6.1 response.utils.js - Respuestas Estandarizadas

#### `sendSuccess(res, data, message, statusCode)`
**Formato:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operación exitosa",
  "data": {...},
  "timestamp": "2026-05-05T10:30:00.000Z"
}
```

**Uso**: `sendSuccess(res, usuario, 'Usuarios obtenido', 200)`

#### `sendError(res, message, statusCode, errors)`
**Formato:**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error de validación",
  "errors": [...],
  "timestamp": "2026-05-05T10:30:00.000Z"
}
```

**Uso**: `sendError(res, 'Usuario no encontrado', 404)`

---

### 6.2 logger.js - Logging Estructurado

**Framework**: Pino v10.3.1

**Configuración:**
- **Nivel**: Definido por `LOG_LEVEL` env (default: info)
- **Redacción**: Automáticamente oculta:
  - `req.headers.authorization`
  - `req.body.password`
  - `refreshToken`, `token`
  - Cookies
  - Set-Cookie headers
- **Transporte en dev**: pino-pretty (colores, formato legible)
- **Transporte en prod**: JSON estructurado (parseable por observabilidad)

**Uso:**
```javascript
logger.info({ port: 3000 }, 'Servidor iniciado')
logger.error({ err: error }, 'Error fatal')
logger.warn({ email }, 'Email no configurado')
```

---

### 6.3 env.js - Validación de Variables de Entorno

#### `getEnv(key, fallback)`
**Propósito**: Obtener variable de entorno con fallback seguro

**Lógica:**
1. Si variable existe y no es vacía, retornarla
2. Si fallback proporcionado, retornar fallback
3. Si no, lanzar Error

**Uso:**
```javascript
const secret = getEnv('JWT_SECRET') // Error si no existe
const port = getEnv('PORT', 3000)   // default 3000
```

#### `validateRequiredEnv()`
**Propósito**: Validar al startup que todas las variables obligatorias están presentes

**Obligatorias:**
- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- ENCRYPTION_KEY

**Opcionales con warnings en producción:**
- FRONTEND_URL (default: http://localhost:3000, warning: CORS solo local)
- PUBLIC_VERIFY_URL (default: http://localhost:3000/verificar, warning: URLs en PDFs serán locales)

**Salida**: Lanza Error si falta alguna variable obligatoria

---

### 6.4 crypto.js - Cifrado AES-256-GCM

**Algoritmo**: AES-256-GCM (Advanced Encryption Standard con Galois/Counter Mode)

#### `encrypt(text)`
**Proceso:**
1. Generar IV aleatorio (16 bytes)
2. Crear cipher con algoritmo AES-256-GCM
3. Cifrar texto
4. Obtener authentication tag
5. Retornar concatenado: `IV:TAG:CIPHERTEXT` (hex)

**Salida**: String hex separado por `:`, o `null` si input es null

#### `decrypt(stored)`
**Proceso:**
1. Parsear stored string: `IV:TAG:CIPHERTEXT`
2. Crear decipher con IV
3. Establecer auth tag
4. Decifrar
5. Retornar plaintext

**Seguridad**: 
- IV único por encrypto (random)
- Auth tag valida integridad (tampering detection)
- 256-bit key (32 bytes hex)

**Uso**: Cifrar API keys de integraciones LMS

---

### 6.5 mailer.js - Envío de Emails

**Servicio**: Resend (similar a SendGrid)

#### `enviarEmailVerificacion({ email, nombre, token })`
**Propósito**: Enviar link de verificación de email

**Contenido**: HTML template con:
- Logo CertiValidate
- Link de verificación
- Duración (24 horas)
- Instrucción manual de copiar link
- Footer

**Proceso:**
1. Generar URL de verificación: `${FRONTEND_URL}/verificar-email?token=${token}`
2. Renderizar HTML
3. Enviar via Resend
4. Loguear ID de email o error

**Dev Mode**: Si no es producción, loguea URL en lugar de enviar

#### `enviarEmailBienvenida({ email, nombre, password, rol })`
**Propósito**: Notificar nuevo usuario con credenciales

**Contenido**: HTML template con:
- Bienvenida personalizada
- Credenciales (email, password, rol)
- Link de login
- Footer

**Nota**: Solo se llama cuando admin crea usuario

---

### 6.6 pdf.generator.js - Generación de PDFs

**Librería**: PDFKit (pdfkit)

#### `prepararDatos(certificado)`
**Proceso:**
1. Extraer datos del certificado con relaciones
2. Formatear fecha en español
3. Truncar hash SHA-256
4. Generar URL QR (certificado código único)
5. Generar QR PNG con libqrcode
6. Retornar datos preparados

#### `escribirContenido(doc, datos)`
**Proceso**: Renderizar PDF con:
1. **Título**: "CERTIFICADO DE LOGRO" (28pt bold)
2. **Subtítulo**: Institución
3. **Cuerpo**: "Se certifica que: [Estudiante]"
4. **Programa**: "[Nombre Plantilla]"
5. **Datos de emisión**:
   - Fecha en formato largo (ej: "5 de mayo de 2026")
   - Código único (16 hex mayúscula)
   - Hash SHA-256 truncado
6. **QR**: Código escaneable que enlaza a verificación pública
7. **Footer**: Copyright CertiValidate © 2026

**Diseño**: Formato A4, márgenes 50pt, colores grises y azules

#### `generarPDFBuffer(certificado)`
**Retorna**: Buffer del PDF en memoria

**Uso**: Adjuntar emails

#### `generarPDF(certificado, res)`
**Propósito**: Streampdf a respuesta HTTP

**Headers:**
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="certificado_[id]_[nombre].pdf"`

**Proceso**: Pipe PDF a respuesta para streaming (mejor para archivos grandes)

---

### 6.7 prisma.js - Cliente Prisma

**Configuración:**
- **Adapter**: `@prisma/adapter-pg` (mejor performance con Pool)
- **Pool**: Pool de conexiones pg
- **ConnectionString**: `DATABASE_URL` (pooler de Supabase)

**Exporta**: Instancia única de PrismaClient

**Uso**: Todas las queries pasan por esta instancia

---

### 6.8 roles.js - Utilidades de Roles

#### `getRolByNombre(nombre)`
**Propósito**: Obtener rol por nombre

**Validaciones**:
- Rol existe en BD
- Si no existe, lanza Error instructivo: "Rol '...' no encontrado. Ejecuta: npm run seed"

**Uso**: Crear usuarios, crear instituciones, actualizar roles

---

### 6.9 token.service.js - Gestión de Tokens JWT

#### `hashToken(token)`
**Propósito**: Hashear refresh token para almacenamiento seguro

**Algoritmo**: SHA-256

#### `buildAccessToken(usuario)`
**Propósito**: Generar access token (corta duración)

**Payload:**
```json
{
  "id": "usuario_id",
  "email": "usuario@example.com",
  "nombre": "Nombre"
}
```

**Firma**: JWT_SECRET

**Expiración**: Configurable (default 1h)

#### `buildRefreshToken(usuario)`
**Propósito**: Generar refresh token (larga duración)

**Payload**: Igual a access token

**Firma**: JWT_REFRESH_SECRET

**Expiración**: Configurable (default 7d)

**JWTID**: UUID único por token (para revocar específico)

#### `persistRefreshToken({ token, usuarioId, ip, userAgent })`
**Propósito**: Guardar refresh token en BD para control

**Proceso:**
1. Decodificar JWT para obtener expiration
2. Guardar en tabla RefreshToken:
   - usuario_id
   - token_hash (SHA-256 del token)
   - expires_at
   - created_by_ip
   - user_agent

**Beneficio**: Poder revocar tokens específicos sin cambiar JWT_SECRET

#### `verifyStoredRefreshToken({ token, usuarioId })`
**Propósito**: Validar refresh token antes de usarlo

**Validaciones:**
1. Token guardado existe
2. No está revocado (revoked_at IS NULL)
3. No ha expirado (expires_at > ahora)
4. Pertenece al usuario

**Retorna**: Record de token o null

#### `rotateRefreshToken({ currentToken, usuario, ip, userAgent })`
**Propósito**: Implementar token rotation (seguridad)

**Proceso:**
1. Revocar token actual (set revoked_at)
2. Generar nuevo refresh token
3. Guardar nuevo token
4. Ambas operaciones en transacción

**Beneficio**: Si token es interceptado, será revocado tras usar

#### `revokeRefreshToken({ token, usuarioId })`
**Propósito**: Revocar refresh token (logout)

**Proceso**: Set revoked_at = ahora

#### `revokeAllUserRefreshTokens(usuarioId)`
**Propósito**: Revocar todos los tokens del usuario (logout de todas partes)

---

### 6.10 auditoria.js - Registro de Auditoría

#### `registrarAuditoria(prisma, usuario_id, accion, entidad, entidad_id, valores_antes, valores_despues, ip, institucion_id)`
**Propósito**: Registrar cambio en auditoría

**Parámetros:**
- `usuario_id`: Quién realizó la acción
- `accion`: Tipo (CREAR_USUARIO, ACTUALIZAR_PERFIL, EMITIR_CERTIFICADO, etc.)
- `entidad`: Qué entidad (Usuario, Certificado, Estudiante, etc.)
- `entidad_id`: ID de la entidad
- `valores_antes`: JSON antes del cambio
- `valores_despues`: JSON después del cambio
- `ip`: IP del cliente
- `institucion_id`: Institución afectada (opcional)

**Proceso:**
1. Validar usuario_id
2. Crear record en tabla Auditoria
3. Loguear error si falla (no crashear)

**Auditorías Registradas:**
- CREAR_USUARIO
- ACTUALIZAR_PERFIL
- EMITIR_CERTIFICADO
- ACTUALIZAR_USUARIO
- ELIMINAR_USUARIO
- CAMBIAR_PASSWORD
- Etc.

---

### 6.11 validators.js - Validación de Inputs

**Framework**: express-validator

**Validadores por Endpoint:**

#### `validateRegister`
- nombre: 3+ caracteres
- apellido: opcional
- email: válido + normalizado
- password: 8+ chars, mayúscula, minúscula, número

#### `validateLogin`
- email: válido
- password: presente

#### `validateCertificado`
- estudiante_id: UUID válido
- institucion_id: UUID válido
- plantilla_id: UUID válido

#### `validateRevocacion`
- motivo_codigo: FRAUDE|ERROR_DATOS|ERROR_EMISION|DECISION_INSTITUCIONAL|DUPLICADO|CADUCIDAD|OTRO
- motivo_detalle: opcional, max 500 chars

#### `validateVerificarCertificado`
- codigo: 1-64 caracteres (opcional)
- hash: exactamente 64 hex (SHA-256) (opcional)
- Al menos uno requerido

#### Otros: validateInstitucionCrear, validateEstudianteCrear, validatePlantilla, etc.

#### `handleValidationErrors(req, res, next)`
**Propósito**: Middleware para responder errores de validación

**Respuesta** si hay errores:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Errores de validación",
  "errors": [
    { "param": "email", "msg": "Debe ser un email válido" }
  ]
}
```

#### `getClientIp(req)`
**Propósito**: Extraer IP del cliente (considera proxies)

**Lógica**: `req.ip` (Express ya maneja X-Forwarded-For con trust proxy)

---

## 7. Schema de Prisma

### Modelos Principales

#### **Usuario**
```prisma
model Usuario {
  id            String
  nombre        String
  apellido      String
  email         String (unique)
  password_hash String
  activo        Boolean (default: true)
  email_verificado Boolean (default: false)
  token_verificacion String?
  token_verificacion_expira DateTime?
  ultimo_acceso DateTime?
  created_at    DateTime
  updated_at    DateTime?
  deleted_at    DateTime?
  // Relaciones
  auditorias    Auditoria[]
  revocaciones  Revocacion[]
  instituciones UsuarioInstitucion[]
  refreshTokens RefreshToken[]
}
```
**Índices**: (único) email
**Soft Delete**: deleted_at para auditoría

---

#### **UsuarioInstitucion** (Join Table)
```prisma
model UsuarioInstitucion {
  usuario_id     String
  institucion_id String
  rol_id         String
  created_at     DateTime
  // Relaciones
  usuario        Usuario (FK)
  institucion    Institucion (FK)
  rol            Rol (FK)
}
```
**Unique Constraint**: usuario_id + institucion_id (usuario único por institución)
**Índices**: usuario_id, institucion_id (búsquedas)

---

#### **Institucion**
```prisma
model Institucion {
  id            String (UUID)
  nombre        String
  dominio       String?
  logo_url      String?
  activa        Boolean (default: true)
  created_at    DateTime
  // Relaciones
  auditorias    Auditoria[]
  certificados  Certificado[]
  estudiantes   Estudiante[]
  integraciones Integracion[]
  plantillas    PlantillaCertificado[]
  usuarios      UsuarioInstitucion[]
}
```

---

#### **Rol**
```prisma
model Rol {
  id          String (UUID)
  nombre      String (unique)
  descripcion String?
  // Relaciones
  permisos    RolPermiso[]
  usuarios    UsuarioInstitucion[]
}
```

**Roles Creados por Seed:**
- admin: Acceso total
- editor: Puede emitir y gestionar
- lector: Solo lectura

---

#### **Permiso** (RBAC)
```prisma
model Permiso {
  id      String (UUID)
  recurso String (certificado, usuario, estudiante, etc.)
  accion  String (crear, ver, emitir, revocar, etc.)
  // Relaciones
  roles   RolPermiso[]
}
```

**Unique Constraint**: (recurso, accion)

**18 Permisos Totales** (3 roles × 6 recursos):
```
certificado: emitir, listar, descargar, ver, revocar
usuario: listar, ver, crear, actualizar, eliminar
estudiante: listar, ver, crear, actualizar, eliminar
plantilla: listar, ver, crear, actualizar, archivar
auditoria: ver
institucion: ver, actualizar, estadisticas
```

---

#### **Certificado** ⭐ Central
```prisma
model Certificado {
  id               String (UUID)
  estudiante_id    String (FK)
  institucion_id   String (FK)
  plantilla_id     String (FK)
  codigo_unico     String (unique, 16 hex)
  estado           String (valido|revocado)
  fecha_emision    DateTime
  fecha_expiracion DateTime?
  pdf_url          String?
  hash_sha256      String (64 hex, unique)
  created_at       DateTime
  deleted_at       DateTime?
  // Relaciones
  blockchain       BlockchainTransaccion[]
  estudiante       Estudiante (FK)
  institucion      Institucion (FK)
  plantilla        PlantillaCertificado (FK)
  metadata         CertificadoMetadata[]
  revocaciones     Revocacion[]
  verificaciones   VerificacionPublica[]
}
```

**Índices**:
- institucion_id (filtrar por institución)
- estudiante_id (filtrar por estudiante)
- estado (filtrar por estado)
- (institucion_id, estado) (compound para eficiencia)

**Unicidad de Negocio**: No puede haber certificado válido/no-revocado para mismo estudiante+plantilla

---

#### **Estudiante**
```prisma
model Estudiante {
  id             String (UUID)
  institucion_id String (FK)
  nombre         String
  apellido       String
  documento      String
  email          String?
  created_at     DateTime
  // Relaciones
  certificados   Certificado[]
  institucion    Institucion (FK)
}
```

**Índices**: institucion_id

---

#### **PlantillaCertificado**
```prisma
model PlantillaCertificado {
  id             String (UUID)
  institucion_id String (FK)
  nombre         String
  template_html  String (HTML template)
  version        Int
  activa         Boolean (default: true)
  created_at     DateTime
  // Relaciones
  certificados   Certificado[]
  institucion    Institucion (FK)
}
```

**Índices**: institucion_id

**Versionado**: Múltiples versiones pueden existir, solo activa se usa para emisión

---

#### **Revocacion**
```prisma
model Revocacion {
  id               String (UUID)
  certificado_id   String (FK)
  revocado_por     String (FK Usuario)
  motivo_codigo    String (FRAUDE|ERROR_DATOS|...)
  motivo_detalle   String? (max 500 chars)
  fecha_revocacion DateTime
  // Relaciones
  certificado      Certificado (FK)
  usuario          Usuario (FK)
}
```

**Índices**: certificado_id

---

#### **VerificacionPublica**
```prisma
model VerificacionPublica {
  id             BigInt (autoincrement)
  certificado_id String (FK)
  ip             String?
  user_agent     String?
  resultado      String (valido|revocado|expirado)
  fecha          DateTime (default: now)
  // Relaciones
  certificado    Certificado (FK)
}
```

**Índices**:
- certificado_id (historial de verificaciones)
- fecha (análisis temporales)

**Propósito**: Auditoría pública (quién verificó qué y cuándo)

---

#### **RefreshToken**
```prisma
model RefreshToken {
  id            String (UUID)
  usuario_id    String (FK)
  token_hash    String (unique, SHA-256)
  expires_at    DateTime
  revoked_at    DateTime?
  created_by_ip String?
  user_agent    String?
  created_at    DateTime
  // Relaciones
  usuario       Usuario (FK)
}
```

**Índices**:
- (usuario_id, revoked_at) (búsqueda rápida de tokens activos)
- expires_at (limpieza de tokens expirados)

**Propósito**: Implementar token rotation y revocación selectiva

---

#### **Auditoria**
```prisma
model Auditoria {
  id              BigInt (autoincrement)
  usuario_id      String (FK)
  accion          String (CREAR_USUARIO|EMITIR_CERTIFICADO|...)
  entidad         String (Usuario|Certificado|Estudiante|...)
  entidad_id      String
  valores_antes   String? (JSON stringificado)
  valores_despues String? (JSON stringificado)
  ip              String?
  institucion_id  String? (FK, opcional)
  fecha           DateTime (default: now)
  // Relaciones
  institucion     Institucion? (FK)
  usuario         Usuario (FK)
}
```

**Índices**:
- (institucion_id, fecha)
- (entidad, entidad_id)
- usuario_id

**Propósito**: Log completo de cambios, quien, qué, cuándo, desde dónde

---

#### **CertificadoMetadata** (Planificado)
```prisma
model CertificadoMetadata {
  id             String (UUID)
  certificado_id String (FK)
  clave          String (calificacion, horas, etc.)
  valor          String
  // Relaciones
  certificado    Certificado (FK)
}
```

**Estado**: No expuesto en endpoints aún
**Propósito**: Campos dinámicos por certificado (requiere definir contrato de claves)

---

#### **BlockchainTransaccion** (Planificado)
```prisma
model BlockchainTransaccion {
  id             String (UUID)
  certificado_id String (FK)
  hash           String? (blockchain tx hash)
  tx_hash        String? (transaction hash on-chain)
  red            String (ethereum|polygon)
  estado         String (pendiente|confirmado|error)
  intentos       Int
  error_mensaje  String?
  created_at     DateTime
  confirmado_en  DateTime?
  // Relaciones
  certificado    Certificado (FK)
}
```

**Estado**: No expuesto en endpoints aún
**Propósito**: Anclaje en blockchain para transparencia

---

#### **Integracion** (Planificado)
```prisma
model Integracion {
  id                  String (UUID)
  institucion_id      String (FK)
  tipo                String (moodle|canvas|etc.)
  url_base            String?
  api_key             String? (cifrado AES-256-GCM)
  activa              Boolean (default: true)
  ultima_verificacion DateTime?
  // Relaciones
  institucion         Institucion (FK)
}
```

**Estado**: No expuesto en endpoints aún
**Propósito**: Integraciones con LMS externos
**Seguridad**: api_key cifrada con crypto.js

---

## 8. Configuración

### 8.1 Dockerfile

**Base**: node:20-alpine (77MB, mínimo)

**Stages**:
1. **COPY & npm ci**: Instalar dependencias sin devDependencies
2. **prisma generate**: Generar cliente Prisma en build-time
3. **COPY src**: Copiar código
4. **Usuario no-root**: Crear usuario `appuser` para reducir superficie de ataque
5. **HEALTHCHECK**: Cada 30s, timeout 5s, retry 3 veces
6. **CMD**: Ejecutar `node src/index.js`

**Optimizaciones:**
- `--omit=dev`: Sin devDependencies en producción
- `--ignore-scripts`: Evitar scripts de post-install innecesarios
- Alpine Linux: Mucho más pequeño que Debian
- Multi-stage (implícito): Final stage es production-ready
- User non-root: Seguridad

---

### 8.2 docker-compose.yml

**Servicios:**
1. **api**: Imagen Node.js construida del Dockerfile
   - Puerto: 3000
   - Environment: .env + variables hardcodeadas
   - Restart: unless-stopped (resilencia)
   - DATABASE_URL: Supabase pooler (puerto 6543)
   - DIRECT_URL: Supabase directo (puerto 5432)

**Variables de Ejemplo:**
```yaml
NODE_ENV: production
JWT_SECRET: ${JWT_SECRET}
JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
ENCRYPTION_KEY: ${ENCRYPTION_KEY}
FRONTEND_URL: ${FRONTEND_URL}
PUBLIC_VERIFY_URL: ${PUBLIC_VERIFY_URL}
```

**Notas:**
- No define servicio de PostgreSQL (usa Supabase externo)
- Migraciones deben aplicarse manualmente antes o con hook

---

### 8.3 jest.config.js

**Framework**: Jest 30.3.0

**Configuración:**
- `testEnvironment: 'node'` - No simula DOM
- `setupFiles`: Carga setup-env.js antes de tests
- `testPathIgnorePatterns`: Ignora node_modules y helpers/
- `testTimeout: 20000` - 20 segundos por test
- `globalTeardown`: Limpieza global tras todos los tests
- `verbose: true` - Detalle en output

**Archivos de Tests:**
- `tests/auth.test.js`
- `tests/certificado.test.js`
- `tests/certificado.public.test.js`
- `tests/institucion.test.js`
- `tests/estudiante.test.js`

---

### 8.4 .env - Variables de Entorno

**Obligatorias:**
```env
DATABASE_URL=postgresql://user:pass@host:6543/db
DIRECT_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=<64 hex chars>
JWT_REFRESH_SECRET=<64 hex chars>
ENCRYPTION_KEY=<64 hex chars>
```

**Opcionales:**
```env
NODE_ENV=development
PORT=3000
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
PUBLIC_VERIFY_URL=http://localhost:3000/certificados/verificar
LOG_LEVEL=info
ENABLE_SWAGGER=false
RESEND_API_KEY=<resend key>
EMAIL_FROM=noreply@example.com
EMAIL_DEV_TO=dev@example.com
```

---

### 8.5 Migraciones Prisma

**Carpeta**: `prisma/migrations/`

**Migraciones Presentes:**
1. `20260410223914_init` - Esquema inicial
2. `20260418000001_add_institucion_id_to_auditoria` - Foreign key de institución
3. `20260418000002_add_email_verification_to_usuario` - Verificación de email
4. `20260419000001_add_refresh_tokens_and_unique_constraints` - Token rotation
5. `20260419000002_add_performance_indexes` - Índices de optimización

**Usar:**
```bash
npm run migrate          # Apply en BD
npm run migrate:dev      # Interactive en desarrollo
npm run migrate:reset    # Borrar y recrear (dev solo)
```

---

## Flujo de Autenticación

```
1. REGISTRO (PUBLIC)
   POST /auth/register { nombre, email, password }
   → Crear usuario + token verificación
   → Enviar email verificación
   → Responder con usuario

2. VERIFICACIÓN EMAIL (PUBLIC)
   GET /auth/verificar-email?token=XXX
   → Validar token + expiration
   → Set email_verificado = true
   → Redirect a login o mensaje éxito

3. LOGIN (PUBLIC)
   POST /auth/login { email, password }
   → Verificar credenciales
   → Crear JWT access token (1h)
   → Crear JWT refresh token (7d) + guardar en BD
   → Responder con tokens + usuario + accesos

4. ACCESO PROTEGIDO
   GET /api/certificados { Authorization: Bearer <access_token> }
   → Middleware verificarToken valida JWT
   → Cargar usuario en req
   → requireEmailVerified valida email_verificado
   → cargarInstitucionesUsuario carga req.institucionIds
   → requirePermission valida recurso:acción
   → Controller procesa

5. RENOVACIÓN TOKEN (SIN EMAIL VERIFICATION)
   POST /auth/refresh { refreshToken }
   → Validar refresh token existe + no revocado + no expirado
   → Generar nuevo access token
   → Rotar refresh token (revoca anterior, crea nuevo)
   → Responder con nuevos tokens

6. LOGOUT
   POST /auth/logout { refreshToken }
   → Revocar refresh token (set revoked_at)
   → Responder éxito
   → Cliente borra tokens del localStorage
```

---

## Flujo de Emisión y Verificación de Certificados

```
A. EMISIÓN (AUTENTICADO)
   POST /api/certificados/emitir
   {
     "estudiante_id": "uuid",
     "institucion_id": "uuid",
     "plantilla_id": "uuid"
   }
   
   → Validar datos (entidades existen, permisos, etc.)
   → Generar código_unico (16 hex)
   → Generar hash SHA-256 del contenido
   → Guardar certificado con estado: valido
   → Guardar auditoria
   → Enviar email al estudiante
   → Responder con certificado

B. VERIFICACIÓN PÚBLICA (SIN AUTENTICACIÓN)
   POST /api/certificados/verificar
   {
     "hash": "6a9f6c8e..." O
     "codigo": "A1B2C3D4E5F6"
   }
   
   → Buscar certificado por hash o código
   → Si no existe: responder { estado: "no_encontrado" }
   → Si existe:
     - Recomputar hash SHA-256
     - Comparar con hash guardado
     - Verificar estado (valido/revocado)
     - Verificar expiración
     - Guardar verificacion_publica (IP, user-agent)
   → Responder con detalles certificado + resultado

C. DESCARGA PDF (AUTENTICADO)
   GET /api/certificados/descargar/{id}
   
   → Validar autorización
   → Buscar certificado con relaciones
   → Generar PDF con PDFKit:
     * Datos del certificado
     * QR code
   → Stream PDF a descarga

D. REVOCACIÓN (AUTENTICADO)
   POST /api/certificados/{id}/revocar
   {
     "motivo_codigo": "FRAUDE",
     "motivo_detalle": "Razón específica"
   }
   
   → Validar autorización + motivo válido
   → Set estado = revocado
   → Guardar Revocacion record
   → Guardar auditoria
   → Responder éxito
```

---

## Resumen Técnico

| Aspecto | Detalle |
|--------|---------|
| **Framework** | Express.js 5.2.1 |
| **ORM** | Prisma 7 con @prisma/adapter-pg |
| **Base de Datos** | PostgreSQL (Supabase) |
| **Autenticación** | JWT (access + refresh tokens con rotation) |
| **Seguridad Passwords** | bcrypt (salt 12) |
| **Cifrado** | AES-256-GCM para datos sensibles |
| **Hashing** | SHA-256 para integridad de certificados |
| **Logging** | Pino 10.3.1 (JSON en prod, pretty en dev) |
| **Validación** | express-validator (expresivo y eficiente) |
| **Rate Limiting** | express-rate-limit (endpoints específicos) |
| **CORS** | Bloquea orígenes no autorizados |
| **PDF** | PDFKit (generación y streaming) |
| **QR Codes** | qrcode (enlace verificación) |
| **Emails** | Resend (API transaccional) |
| **Testing** | Jest 30.3.0 |
| **Docker** | Multi-stage, alpine, user non-root |
| **HTTP Headers** | Helmet (seguridad) |
| **Health Check** | GET /health (BD status, uptime) |

---

## Conclusión

CertiValidate es una API REST robusta, segura y escalable para gestionar certificados digitales. Implementa:

✅ **Autenticación segura** con JWT y refresh token rotation
✅ **Control de acceso granular** con RBAC multi-institución
✅ **Integridad de datos** con hash SHA-256
✅ **Auditoría completa** de todas las acciones
✅ **Generación de PDFs** con códigos QR
✅ **Logging estructurado** para observabilidad
✅ **Rate limiting** contra abuso
✅ **Validación exhaustiva** de inputs
✅ **Soft deletes** para historial
✅ **Transacciones atómicas** para consistency

Ideal para instituciones educativas, plataformas de certificación y sistemas que requieren emisión y verificación de credenciales digitales confiables.
