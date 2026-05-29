# CertiValidate - Prototipo Frontend

Este proyecto es el prototipo no funcional (frontend simulado con datos estáticos) del sistema **CertiValidate**, una plataforma para la gestión, emisión y validación de certificados académicos con tecnología Blockchain.

## Requisitos Previos

Para ejecutar este proyecto en cualquier entorno, asegúrese de tener instalado:
- [Node.js](https://nodejs.org/) (versión 18 o superior recomendada)
- `npm` (viene instalado con Node.js)

## Instrucciones de Instalación y Ejecución

1. **Clonar o descargar el repositorio**
   Una vez descargado o clonado el proyecto, abra una terminal y navegue hasta la raíz del proyecto (`certivalidate-frontend`).

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Iniciar el proyecto**
   ```bash
   npm run dev
   ```

4. **Abrir en el navegador**
   Navegue a `http://localhost:5173/`

---

## Roles de Usuarios y Accesos

El sistema tiene implementado un sistema de inicio de sesión simulado con tres roles:

### Administrador
- **Email:** `admin@certivalidate.com`
- **Contraseña:** `Admin1234`
- **Capacidades:** Acceso total. Gestiona certificados, estudiantes, plantillas, instituciones, usuarios del sistema y registro de auditoría.

### Emisor
- **Email:** `editor@certivalidate.com`
- **Contraseña:** `Editor1234`
- **Capacidades:** Emite y revoca certificados, gestiona estudiantes. Sin acceso a Plantillas, Auditoría ni Usuarios.

### Lector
- **Email:** `lector@certivalidate.com`
- **Contraseña:** `Lector1234`
- **Capacidades:** Solo lectura de certificados y estudiantes. Sin acceso a Plantillas, Auditoría ni Usuarios.

---

## Verificación Pública de Certificados

La página de inicio (`/`) permite verificar certificados **sin necesidad de cuenta**. Se puede buscar por **Código único** o por **Hash SHA-256**.

### Códigos únicos de prueba

| Código             | Estado    | Receptor              | Institución                          |
|--------------------|-----------|-----------------------|--------------------------------------|
| `A3F2B91C4D7E0812` | ✅ Válido  | Ana Martínez          | Universidad Central de Colombia      |
| `B7D1E4A9F2C30516` | ✅ Válido  | Luis Rodríguez        | Universidad Central de Colombia      |
| `C5E8F1B3D6A90724` | ❌ Revocado| Diego Torres          | Instituto Tecnológico del Valle      |
| `D2A4C6E8F0B17935` | ✅ Válido  | Sofía Herrera         | Universidad Central de Colombia      |
| `E9F3A7B1C5D20846` | ✅ Válido  | Valentina Jiménez     | Instituto Tecnológico del Valle      |
| `F1B5D9E3A7C40258` | ✅ Válido  | Camilo Vargas         | Universidad Central de Colombia      |
| `G4H8K2L6M0N35769` | ✅ Válido  | Isabella Moreno       | Instituto Tecnológico del Valle      |

### Hashes SHA-256 de prueba

| Hash SHA-256                                                       | Corresponde a      |
|--------------------------------------------------------------------|--------------------|
| `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | Ana Martínez       |
| `a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3` | Luis Rodríguez     |
| `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824` | Diego Torres       |
| `9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08` | Sofía Herrera      |
| `5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5` | Valentina Jiménez  |
| `bf9d2f17b592b6c748ee1b8b3c5ffbcfbbd1ef6c6a3b5cdc55b50cce9e3451a` | Camilo Vargas      |
| `7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069` | Isabella Moreno    |

> También puede escribir `demo` en el campo de código único para ver un ejemplo instantáneo.

---

## Listado de Pantallas

1. **Página de Inicio / Verificación Pública (`/`):** Landing informativa con hero, buscador de certificados (por código o hash SHA-256), subida de PDF y sección "¿Cómo funciona?".
2. **Inicio de Sesión (`/login`):** Formulario de acceso con acceso rápido por rol.
3. **Registro (`/register`):** Formulario para nuevas cuentas con validación de contraseña.
4. **Dashboard (`/admin`):** Panel con 6 indicadores clave, gráfica de barras mensual, gráfica donut de estado y feed de actividad reciente.
5. **Certificados (`/admin/certificados`):** Tabla de gestión con emisión, revocación y detalle.
6. **Estudiantes (`/admin/estudiantes`):** CRUD completo con búsqueda y paginación.
7. **Plantillas (`/admin/plantillas`):** Gestión de diseños de certificados (solo Administrador).
8. **Instituciones (`/admin/instituciones`):** Configuración de entes emisores.
9. **Usuarios (`/admin/usuarios`):** Gestión de usuarios del sistema con roles (solo Administrador).
10. **Auditoría (`/admin/auditoria`):** Registro de acciones y logs de seguridad (solo Administrador).
11. **Perfil (`/admin/perfil`):** Edición de datos personales y cambio de contraseña.
