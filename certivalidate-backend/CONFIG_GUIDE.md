# Guía de Configuración de Integraciones por Institución

## 📋 Tabla de Contenidos

1. [Configuración básica](#configuración-básica)
2. [Por cada proveedor](#por-cada-proveedor)
3. [Ejemplos de SQL](#ejemplos-de-sql)
4. [Testing](#testing)
5. [Troubleshooting](#troubleshooting)

---

## Configuración Básica

La tabla `Integracion` en la BD define qué proveedor académico usa cada institución.

**Campos requeridos:**

- `institucion_id`: UUID de la institución
- `tipo`: Tipo de integración (`external-api`, `local-db`, etc.)
- `url_base`: URL base (si aplica)
- `api_key`: API Key encriptada (si aplica)
- `activa`: Boolean (true/false)
- `ultima_verificacion`: Timestamp de último health check

---

## Por Cada Proveedor

### 1. **External API**

**Caso de uso**: Universidad con su propio servidor de API

**Configuración:**

```sql
INSERT INTO "Integracion" (
  institucion_id,
  tipo,
  url_base,
  api_key,
  activa,
  ultima_verificacion
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'external-api',
  'https://api.universidad-a.edu.co/v1',
  encrypt_aes256('sk_live_1234567890abcdef'),
  true,
  NOW()
);
```

**Requisitos de API:**

- Endpoint: `GET /api/v1/estudiantes/{documento}`
- Headers: `x-api-key: sk_live_...`
- Response:

```json
{
  "data": {
    "id": "ext-001",
    "nombre": "Juan",
    "apellido": "Pérez",
    "documento": "1234567890",
    "email": "juan@uni-a.edu.co",
    "programa": "Ingeniería de Sistemas",
    "promedio": 4.5
  }
}
```

**Variables de entorno:**

```env
ACADEMIC_API_URL=https://api.universidad-a.edu.co/v1
ACADEMIC_API_KEY=sk_live_1234567890abcdef
ACADEMIC_API_TIMEOUT=5000
ACADEMIC_API_MAX_RETRIES=3
```

**Testing:**

```bash
# Verificar conectividad
curl -H "x-api-key: sk_live_..." \
  https://api.universidad-a.edu.co/v1/health

# Buscar estudiante
curl -H "x-api-key: sk_live_..." \
  "https://api.universidad-a.edu.co/v1/estudiantes/1234567890"
```

---

### 2. **Local DB**

**Caso de uso**: Universidad que usa solo BD local

**Configuración:**

```sql
INSERT INTO "Integracion" (
  institucion_id,
  tipo,
  url_base,
  api_key,
  activa,
  ultima_verificacion
) VALUES (
  '223e4567-e89b-12d3-a456-426614174001',
  'local-db',
  NULL,
  NULL,
  true,
  NOW()
);
```

**Comportamiento:**

- Las búsquedas se hacen directamente a tabla `Estudiante`
- No hay llamadas externas
- Cache local es fuente de verdad

**Testing:**

```bash
# Crear estudiante local
curl -X POST http://localhost:3000/api/estudiantes \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "institucion_id": "223e4567-e89b-12d3-a456-426614174001",
    "nombre": "María",
    "apellido": "García",
    "documento": "9876543210",
    "email": "maria@uni-b.edu.co"
  }'

# Emitir certificado
curl -X POST http://localhost:3000/api/certificados/emitir \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "estudiante_id": "...",
    "institucion_id": "223e4567-e89b-12d3-a456-426614174001",
    "plantilla_id": "...",
    "provider": "local-db"
  }'
```

---

### 3. **GraphQL** (Futuro)

**Caso de uso**: Universidad con API GraphQL

**Configuración esperada:**

```sql
INSERT INTO "Integracion" (
  institucion_id,
  tipo,
  url_base,
  api_key,
  activa
) VALUES (
  '323e4567-e89b-12d3-a456-426614174002',
  'graphql',
  'https://api.universidad-c.edu.co/graphql',
  encrypt_aes256('sk_graphql_...'),
  true
);
```

**Implementación pendiente en `academic-provider.service.js`**

---

### 4. **SQL Server** (Futuro)

**Caso de uso**: Universidad con SQL Server enterprise

**Configuración esperada:**

```sql
INSERT INTO "Integracion" (
  institucion_id,
  tipo,
  url_base,
  api_key,
  activa
) VALUES (
  '423e4567-e89b-12d3-a456-426614174003',
  'sql-server',
  'Server=uni-d-db.local;Database=academico',
  encrypt_aes256('username:password'),
  true
);
```

**Implementación pendiente**

---

## Ejemplos de SQL

### Crear integración (External API)

```sql
-- 1. Obtener ID de institución
SELECT id, nombre FROM "Institucion"
WHERE nombre = 'Universidad A';

-- 2. Insertar integración
INSERT INTO "Integracion" (
  id,
  institucion_id,
  tipo,
  url_base,
  api_key,
  activa,
  ultima_verificacion
) VALUES (
  gen_random_uuid(),
  '123e4567-e89b-12d3-a456-426614174000',
  'external-api',
  'https://api.universidad-a.edu.co/v1',
  pgp_sym_encrypt('sk_live_1234567890abcdef', 'encryption_key_here'),
  true,
  NOW()
);
```

### Crear integración (Local DB)

```sql
INSERT INTO "Integracion" (
  id,
  institucion_id,
  tipo,
  activa,
  ultima_verificacion
) VALUES (
  gen_random_uuid(),
  '223e4567-e89b-12d3-a456-426614174001',
  'local-db',
  true,
  NOW()
);
```

### Actualizar integración

```sql
UPDATE "Integracion"
SET
  url_base = 'https://api.new-url.edu.co',
  api_key = pgp_sym_encrypt('sk_live_new_key', 'encryption_key_here'),
  ultima_verificacion = NOW()
WHERE institucion_id = '123e4567-e89b-12d3-a456-426614174000';
```

### Desactivar integración

```sql
UPDATE "Integracion"
SET activa = false
WHERE institucion_id = '123e4567-e89b-12d3-a456-426614174000';
```

### Ver todas las integraciones

```sql
SELECT
  i.id,
  i.institucion_id,
  inst.nombre as institucion,
  i.tipo,
  i.url_base,
  i.activa,
  i.ultima_verificacion
FROM "Integracion" i
JOIN "Institucion" inst ON i.institucion_id = inst.id
ORDER BY inst.nombre;
```

---

## Testing

### 1. Verificar configuración cargada

```bash
# En Node.js/API
const integrationConfig = require('./src/services/integration-config.service')
const config = await integrationConfig.obtenerConfiguracion('inst-id')
console.log(config)
```

### 2. Verificar disponibilidad

```bash
curl -X GET http://localhost:3000/api/health
```

### 3. Test de emisión con provider específico

**Con external-api:**

```bash
curl -X POST http://localhost:3000/api/certificados/emitir \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documento_estudiante": "1234567890",
    "institucion_id": "123e4567-e89b-12d3-a456-426614174000",
    "plantilla_id": "...",
    "provider": "external-api"
  }'
```

**Con local-db (fallback):**

```bash
curl -X POST http://localhost:3000/api/certificados/emitir \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "estudiante_id": "...",
    "institucion_id": "223e4567-e89b-12d3-a456-426614174001",
    "plantilla_id": "...",
    "provider": "local-db"
  }'
```

**Con detección automática (sin provider):**

```bash
curl -X POST http://localhost:3000/api/certificados/emitir \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documento_estudiante": "1234567890",
    "institucion_id": "123e4567-e89b-12d3-a456-426614174000",
    "plantilla_id": "..."
  }'
  # Automáticamente determinará provider desde Integracion table
```

### 4. Ver metadata de origen

```bash
curl -X GET "http://localhost:3000/api/certificados/{cert-id}" \
  -H "Authorization: Bearer $TOKEN"

# Response incluye:
{
  "id": "cert-123",
  "metadata": [
    {
      "clave": "origen_academico",
      "valor": {
        "provider": "external-api",
        "source_system": "Academic Provider",
        "source_document_id": "1234567890",
        "source_api": "https://api.universidad-a.edu.co/v1",
        "fecha_sync": "2026-05-19T10:00:00Z",
        "fallback": false
      }
    }
  ]
}
```

---

## Troubleshooting

### Problema: "Proveedor académico no soportado"

**Causa**: Provider especificado no es válido

**Solución**:

```javascript
// Verificar proveedores soportados
const academicProvider = require('./src/services/academic-provider.service')
console.log(academicProvider.obtenerProveedoresDisponibles())
// Output: ['external-api', 'local-db', 'graphql', ...]
```

---

### Problema: "Estudiante no encontrado (404)"

**Posibles causas:**

1. **API externa no disponible y no hay fallback:**

```
1. Verificar ACADEMIC_API_URL está correcto
2. Verificar ACADEMIC_API_KEY es válida
3. Verificar estudiante existe en API
4. Si falla, debe existir en BD local como fallback
```

2. **Documento incorrecto:**

```javascript
// Verificar formato esperado
GET / api / students / 1234567890 // OK
GET / api / students / CC1234567890 // Posible prefijo
```

3. **Institución mal configurada:**

```sql
-- Verificar que institucion_id existe
SELECT * FROM "Institucion"
WHERE id = 'inst-id-aqui';

-- Verificar que tiene integración
SELECT * FROM "Integracion"
WHERE institucion_id = 'inst-id-aqui';
```

---

### Problema: "Timeout de 5000ms"

**Causa**: API externa muy lenta

**Solución**:

```env
# Aumentar timeout en .env
ACADEMIC_API_TIMEOUT=10000

# Y/o aumentar reintentos
ACADEMIC_API_MAX_RETRIES=5

# Y/o mejorar performance de API externa
```

---

### Problema: "Ya existe un certificado vigente"

**Causa Normal**: Intentando emitir mismo certificado dos veces

**Solución**:

1. Revocar certificado anterior: `POST /api/certificados/{id}/revocar`
2. Luego emitir nuevo: `POST /api/certificados/emitir`

---

### Problema: Logs muestran fallback frecuente

**Causa**: API externa inestable

**Acción**:

1. Revisar logs: `[CertificadoController] Fallback a local-db exitoso`
2. Contactar administrador de API externa
3. Opciones:
   - Esperar a que se recupere
   - Cambiar a provider `local-db` temporalmente
   - Aumentar TTL de cache

---

## Checklist de Implementación

Para cada institución nueva:

- [ ] Verificar que institución existe en tabla `Institucion`
- [ ] Determinar qué proveedor usar (external-api, local-db, etc.)
- [ ] Si `external-api`:
  - [ ] Obtener URL base de API
  - [ ] Obtener API Key / Credenciales
  - [ ] Verificar que API responde a `GET /health`
  - [ ] Verificar respuesta de `GET /estudiantes/{documento}`
  - [ ] Actualizar variables de entorno
- [ ] Insertar fila en tabla `Integracion`
- [ ] Limpiar cache: `integrationConfig.limpiarCache(institucion_id)`
- [ ] Test: Crear estudiante de prueba
- [ ] Test: Emitir certificado de prueba
- [ ] Verificar metadata de origen en certificado
- [ ] Revisar logs en `/logs`

---

## Monitoreo Recomendado

1. **Health checks diarios**: Verificar disponibilidad de APIs

```javascript
const integrationConfig = require('./src/services/integration-config.service')
const integraciones = await integrationConfig.obtenerTodasLasIntegraciones()
for (const int of integraciones) {
  const disponible = await integrationConfig.verificarDisponibilidad(
    int.institucion_id,
  )
  console.log(`${int.institucion.nombre}: ${disponible ? '✓' : '✗'}`)
}
```

2. **Logs de errores**: Monitorear intentos fallidos

```bash
# Ver eventos recientes
grep "Error en" /logs/*.log | tail -20
grep "fallback" /logs/*.log | tail -20
```

3. **Auditoría**: Revisar quién emite qué

```sql
SELECT
  a.usuario_id,
  a.accion,
  a.valores_despues,
  a.fecha_creacion
FROM "Auditoria" a
WHERE a.accion = 'EMITIR_CERTIFICADO'
ORDER BY a.fecha_creacion DESC
LIMIT 50;
```

---

**Versión**: 1.0.0  
**Última actualización**: 2026-05-19  
**Mantenedor**: Equipo CertiValidate
