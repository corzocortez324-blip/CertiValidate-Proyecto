# Arquitectura Desacoplada CertiValidate

## 🏗️ Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│              (Web, Mobile, Integrations)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   CertiValidate Core                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API REST Controllers                               │   │
│  │  ├─ certificado.controller.js                       │   │
│  │  ├─ estudiante.controller.js                        │   │
│  │  ├─ institucion.controller.js                       │   │
│  │  └─ ... otros controllers                           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Core Features                                      │   │
│  │  ├─ JWT Authentication                             │   │
│  │  ├─ Auditoría Completa                            │   │
│  │  ├─ Blockchain Transactions                        │   │
│  │  ├─ QR Code Generation                             │   │
│  │  ├─ PDF Certificate Generation                     │   │
│  │  └─ Revocation Management                          │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│           PROVIDER ABSTRACTION LAYER (NEW)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Integration Config Service                         │   │
│  │  • Per-Institution Provider Selection               │   │
│  │  • Config Caching (5 min TTL)                       │   │
│  │  • API Key Encryption (AES-256-GCM)               │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Academic Provider Service                          │   │
│  │  • Provider Abstraction Layer                       │   │
│  │  • Extensible Switch Architecture                   │   │
│  │  • Multi-Provider Support                           │   │
│  │  • Fallback Mechanisms                              │   │
│  │  • Distributed Logging                              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Academic API Service                               │   │
│  │  • Timeout Management (configurable)                │   │
│  │  • Retry with Exponential Backoff                   │   │
│  │  • Error Classification (429, 503, 504, 408)        │   │
│  │  • Health Check / Availability Verification         │   │
│  │  • Response Time Tracking                           │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        ↓              ↓              ↓              ↓
    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
    │External │  │Local DB │  │GraphQL  │  │SQL Srv  │
    │   API   │  │(Local)  │  │(Future) │  │(Future) │
    │Provider │  │Provider │  │Provider │  │Provider │
    └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
         │            │            │            │
         ↓            ↓            ↓            ↓
    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
    │API REST │  │PostgreSQL  │ │GraphQL  │  │SQL Srv  │
    │Servers  │  │Database    │ │Services │  │Services │
    │(Remote) │  │(Local)     │ │(Remote) │  │(Remote) │
    └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
         │            │            │            │
         ↓            ↓            ↓            ↓
    ┌─────────────────────────────────────────────────┐
    │        Academic Systems / Universities          │
    │  ┌─────────────┐  ┌──────────────┐  ┌────────┐│
    │  │Universidad A│  │Universidad B │  │Univ. C ││
    │  │  (API)      │  │ (Local Cache)│  │(GraphQL)││
    │  └─────────────┘  └──────────────┘  └────────┘│
    └─────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Datos

### 1. **Solicitud de Emisión de Certificado**

```
POST /api/certificados/emitir
├─ Body: {
│   documento_estudiante: "1234567890",
│   institucion_id: "inst-uuid",
│   plantilla_id: "template-uuid"
│ }
└─ (provider es opcional)
```

### 2. **Determinación de Provider**

```
IF provider NO especificado:
  ├─ Consultar Integracion table por institucion_id
  ├─ Buscar en caché (TTL 5min)
  ├─ Si no en caché:
  │  ├─ Consultar BD
  │  └─ Guardar en caché
  └─ Usar provider de configuración
ELSE:
  └─ Usar provider especificado
```

### 3. **Búsqueda de Estudiante**

```
SWITCH provider:
  CASE 'external-api':
    ├─ Llamar POST ACADEMIC_API_URL/estudiantes/{documento}
    ├─ Con timeout y retries
    ├─ Logging de respuesta y tiempo
    └─ EN CASO DE ERROR:
       ├─ Si fallback disponible → usar local-db
       └─ Registrar fallback en auditoría

  CASE 'local-db':
    ├─ Consultar directamente Estudiante table
    ├─ Filtrar por documento e institucion_id
    └─ Retornar resultado

  CASE 'graphql' / 'sql-server' / 'oracle':
    └─ [Implementación futura]
```

### 4. **Emisión de Certificado (Transacción)**

```
BEGIN TRANSACTION:
  1. Validar documento / estudiante
  2. Si external-api:
     └─ UPSERT estudiante a BD local
        (sincronizar con metadatos)
  3. Crear Certificado
  4. Guardar CertificadoMetadata:
     {
       "provider": "external-api",
       "source_system": "Academic Provider",
       "source_document_id": "1234567890",
       "source_api": "https://...",
       "fecha_sync": "2026-05-19T10:00:00Z",
       "fallback": false
     }
  5. Registrar en Auditoria:
     - Usuario
     - Acción
     - Provider usado
     - Fallback utilizado
     - IP de origen
     - Institución
  6. COMMIT
CATCH ERROR:
  └─ ROLLBACK + Responder error
```

### 5. **Generación de PDF**

```
GET /api/certificados/{id}/pdf
├─ Obtener certificado con relaciones
├─ Preparar datos:
│  ├─ Nombre completo (normalizado)
│  ├─ Documento
│  ├─ Email
│  ├─ Programa académico (de cualquier proveedor)
│  ├─ Promedio / GPA (múltiples campos soportados)
│  └─ Metadata de origen
├─ Generar QR con URL de validación
├─ Renderizar PDF
└─ Stream a cliente
```

---

## 🎛️ Configuración por Institución

### Tabla: `Integracion`

```sql
CREATE TABLE "Integracion" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id UUID NOT NULL UNIQUE,
  tipo VARCHAR(50) NOT NULL,
  url_base VARCHAR(500),
  api_key VARCHAR(500),
  activa BOOLEAN DEFAULT true,
  ultima_verificacion TIMESTAMP,
  FOREIGN KEY (institucion_id) REFERENCES "Institucion"(id)
);
```

### Ejemplos de Configuración

#### Institución A: External API

```json
{
  "institucion_id": "inst-a-uuid",
  "tipo": "external-api",
  "url_base": "https://api.universidad-a.edu.co/v1",
  "api_key": "ENCRYPTED(sk_live_...)",
  "activa": true
}
```

#### Institución B: Local Database

```json
{
  "institucion_id": "inst-b-uuid",
  "tipo": "local-db",
  "url_base": null,
  "api_key": null,
  "activa": true
}
```

#### Institución C: GraphQL (Futuro)

```json
{
  "institucion_id": "inst-c-uuid",
  "tipo": "graphql",
  "url_base": "https://api.universidad-c.edu.co/graphql",
  "api_key": "ENCRYPTED(...))",
  "activa": true
}
```

---

## 📊 Metadatos de Origen

Cada certificado almacena metadatos sobre su fuente:

```json
{
  "clave": "origen_academico",
  "valor": {
    "provider": "external-api",
    "source_system": "Academic Provider",
    "source_document_id": "1234567890",
    "source_api": "https://api.universidad-a.edu.co/v1",
    "fecha_sync": "2026-05-19T10:00:00.000Z",
    "fallback": false
  }
}
```

**Campos:**

- `provider`: Proveedor utilizado (external-api, local-db, etc.)
- `source_system`: Sistema de origen (siempre "Academic Provider" para académicos)
- `source_document_id`: ID/Documento en sistema original
- `source_api`: Endpoint consultado
- `fecha_sync`: Cuándo se sincronizó
- `fallback`: Si se utilizó mecanismo de fallback

---

## 🔐 Seguridad

### 1. **Encriptación de Credenciales**

```javascript
// Almacenamiento
const encrypted = encrypt(apiKey) // AES-256-GCM
await prisma.integracion.create({
  api_key: encrypted,
})

// Uso
const decrypted = decrypt(integracion.api_key)
const response = await fetch(url, {
  headers: { 'x-api-key': decrypted },
})
```

### 2. **Auditoría Completa**

Cada emisión de certificado registra:

- ✅ Usuario que solicitó
- ✅ Acción realizada
- ✅ Provider utilizado
- ✅ Fallback utilizado
- ✅ IP de origen
- ✅ Institución
- ✅ Timestamp exacto

### 3. **Hash Integridad**

```javascript
contenidoReal = `${est.id}|${est.nombre}|...|${codigoUnico}|${fecha}`
hash = SHA256(contenidoReal)
// Almacenado en certificado
// Verificable públicamente sin exponer datos
```

### 4. **Control de Acceso**

Validación en cada operación:

```javascript
const institucionIds = req.institucionIds // Del JWT
if (!institucionIds.includes(institucion_id)) {
  return sendError(res, 'No autorizado', 403)
}
```

---

## 🚀 Ventajas de esta Arquitectura

### 1. **Desacoplamiento**

- CertiValidate NO depende de tecnología específica
- Cada institución elige su proveedor
- Fácil agregar nuevos proveedores

### 2. **Escalabilidad**

- Múltiples universidades simultáneamente
- Cada una con su proveedor
- Sin modificar core del sistema

### 3. **Resiliencia**

- Fallback automático a caché local
- Retry con backoff exponencial
- Health checks periódicos

### 4. **Observabilidad**

- Logging distribuido de todas las operaciones
- Metadatos de origen en certificados
- Auditoría completa

### 5. **Flexibilidad**

- Cambiar provider sin perder datos
- Migración gradual de universidades
- Testing con diferentes backends

---

## 📈 Flujo de Expansión

```
Fase 1: External API
├─ Universidad A (API REST)
└─ Universidad B (BD Local)

Fase 2: GraphQL
├─ Universidad C (GraphQL)
└─ Versión 2.0 de Univ. A (Migración)

Fase 3: Enterprise
├─ Universidad D (SQL Server)
├─ Universidad E (Oracle)
└─ Universidad F (Moodle LMS)

Resultado Final:
└─ CertiValidate conecta a N universidades
   sin modificar un línea de código core
```

---

## 🔮 Futuro: Nuevos Proveedores

Sin modificar el core, solo agregar en `academic-provider.service.js`:

```javascript
case 'graphql':
  return await academicGraphQL.buscarEstudiante(documento)

case 'sql-server':
  return await academicSQLServer.buscarEstudiante(documento)

case 'oracle':
  return await academicOracle.buscarEstudiante(documento)

case 'moodle':
  return await academicMoodle.buscarEstudiante(documento)
```

---

## 📚 Ficheros Clave

| Archivo                         | Propósito                          |
| ------------------------------- | ---------------------------------- |
| `academic-provider.service.js`  | Abstracción de proveedores         |
| `academic-api.service.js`       | Llamadas a APIs con timeout/retry  |
| `integration-config.service.js` | Configuración por institución      |
| `certificado.controller.js`     | Lógica de emisión (mejorada)       |
| `estudiante.controller.js`      | Gestión de estudiantes (preparado) |
| `pdf.generator.js`              | Generación de PDFs (multi-source)  |
| `prisma/schema.prisma`          | Tabla `Integracion`                |

---

## ✅ Características Implementadas

- [x] Arquitectura extensible de proveedores
- [x] Configuración por institución
- [x] Timeout y retry automático
- [x] Fallback a caché local
- [x] Metadata de origen
- [x] Auditoría mejorada
- [x] Logging distribuido
- [x] PDF multi-fuente
- [x] Encriptación de credenciales
- [x] Health checks

---

## 📝 Próximos Pasos

1. **Migrar datos históricos**: Asociar certificados existentes con provider 'local-db'
2. **Configurar instituciones**: Crear integraciones en tabla `Integracion`
3. **Testing**: Verificar cada proveedor
4. **Documentación**: Publicar guías para usuarios
5. **Monitoreo**: Implementar alertas

---

**Versión**: 1.0.0-provider-architecture  
**Fecha**: 2026-05-19  
**Estado**: ✅ IMPLEMENTADO Y FUNCIONAL
