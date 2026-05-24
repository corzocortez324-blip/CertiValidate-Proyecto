const bcrypt = require('bcrypt')
const { sendSuccess, sendError } = require('../utils/response.utils')
const prisma = require('../utils/prisma')
const { registrarAuditoria } = require('../utils/auditoria')
const { getClientIp } = require('../utils/validators')
const { enviarEmailBienvenida } = require('../utils/mailer')
const logger = require('../utils/logger')

async function validarDominioInstitucional(email, institucionId) {
  if (!institucionId || !email) return null
  const inst = await prisma.institucion.findUnique({
    where: { id: institucionId },
    select: { dominio: true, nombre: true },
  })
  if (!inst?.dominio) return null
  const emailDomain = email.split('@')[1]?.toLowerCase()
  const instDomain  = inst.dominio.toLowerCase().replace(/^@/, '')
  if (emailDomain !== instDomain) {
    return `El email debe pertenecer al dominio @${instDomain} (institución: ${inst.nombre})`
  }
  return null
}

const formatUsuario = (usuario, rolPrincipal = null) => {
  const { password_hash, token_verificacion, token_verificacion_expira, ...datos } = usuario
  return { ...datos, rol: rolPrincipal }
}

const resolverRol = async (usuarioId) => {
  const accesos = await prisma.usuarioInstitucion.findMany({
    where: { usuario_id: usuarioId },
    include: { rol: true },
  })
  const ROL_PRIORIDAD = { admin: 3, editor: 2, lector: 1 }
  return accesos
    .map((a) => a.rol.nombre)
    .sort((a, b) => (ROL_PRIORIDAD[b] || 0) - (ROL_PRIORIDAD[a] || 0))[0] || null
}

const listarUsuarios = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100)
    const search = (req.query.search || '').trim()

    const where = { deleted_at: null }

    if (search) {
      where.OR = [
        { nombre:   { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { email:    { contains: search, mode: 'insensitive' } },
      ]
    }

    const [usuarios, total] = await prisma.$transaction([
      prisma.usuario.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          instituciones: { include: { rol: true } },
        },
      }),
      prisma.usuario.count({ where }),
    ])

    const ROL_PRIORIDAD = { admin: 3, editor: 2, lector: 1 }
    const resultado = usuarios.map((u) => {
      const rolPrincipal = u.instituciones
        .map((i) => i.rol.nombre)
        .sort((a, b) => (ROL_PRIORIDAD[b] || 0) - (ROL_PRIORIDAD[a] || 0))[0] || null
      return formatUsuario(u, rolPrincipal)
    })

    return sendSuccess(
      res,
      { usuarios: resultado, total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) },
      'Usuarios obtenidos correctamente',
      200,
    )
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en listarUsuarios')
    return sendError(res, 'Error al listar usuarios', 500)
  }
}

const obtenerUsuario = async (req, res) => {
  try {
    const { id } = req.params
    const usuario = await prisma.usuario.findUnique({
      where: { id, deleted_at: null },
    })
    if (!usuario) return sendError(res, 'Usuario no encontrado', 404)
    const rol = await resolverRol(id)
    return sendSuccess(res, formatUsuario(usuario, rol), 'Usuario obtenido correctamente', 200)
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en obtenerUsuario')
    return sendError(res, 'Error al obtener usuario', 500)
  }
}

const crearUsuario = async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol = 'lector' } = req.body

    if (!nombre || !email || !password) {
      return sendError(res, 'nombre, email y password son obligatorios', 400)
    }

    const existe = await prisma.usuario.findUnique({ where: { email } })
    if (existe) return sendError(res, 'El email ya está registrado', 409)

    const rolRegistro = await prisma.rol.findUnique({ where: { nombre: rol } })
    if (!rolRegistro) return sendError(res, 'Rol inválido', 400)

    const institucionId = req.institucionIds?.[0]
    if (!institucionId) return sendError(res, 'No tiene institución asignada', 403)

    const dominioError = await validarDominioInstitucional(email, institucionId)
    if (dominioError) return sendError(res, dominioError, 422)

    const hash = await bcrypt.hash(password, 12)

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        apellido: apellido || '',
        email,
        password_hash: hash,
        email_verificado: true,
        instituciones: {
          create: {
            institucion_id: institucionId,
            rol_id: rolRegistro.id,
          },
        },
      },
    })

    await registrarAuditoria(
      prisma,
      req.usuario.id,
      'CREAR_USUARIO',
      'Usuario',
      nuevoUsuario.id,
      null,
      JSON.stringify({ nombre, apellido: apellido || '', email, rol }),
      getClientIp(req),
    )

    // Notificar al nuevo usuario con sus credenciales de acceso
    enviarEmailBienvenida({ email, nombre, password, rol }).catch((err) =>
      logger.error({ err, email }, 'Error enviando email de bienvenida'),
    )

    return sendSuccess(res, formatUsuario(nuevoUsuario, rol), 'Usuario creado correctamente', 201)
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en crearUsuario')
    return sendError(res, 'Error al crear usuario', 500)
  }
}

const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, apellido, email, activo, rol } = req.body

    const usuario = await prisma.usuario.findUnique({ where: { id, deleted_at: null } })
    if (!usuario) return sendError(res, 'Usuario no encontrado', 404)

    if (email && email !== usuario.email) {
      const emailUsado = await prisma.usuario.findUnique({ where: { email } })
      if (emailUsado) return sendError(res, 'El email ya está en uso', 409)

      const dominioError = await validarDominioInstitucional(email, req.institucionIds?.[0])
      if (dominioError) return sendError(res, dominioError, 422)
    }

    const valoresAntes = JSON.stringify({ nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, activo: usuario.activo })

    const usuarioActualizado = await prisma.usuario.update({
      where: { id },
      data: {
        nombre:   nombre   !== undefined ? nombre   : usuario.nombre,
        apellido: apellido !== undefined ? apellido : usuario.apellido,
        email:    email    !== undefined ? email    : usuario.email,
        activo:   activo   !== undefined ? activo   : usuario.activo,
        updated_at: new Date(),
      },
    })

    if (rol) {
      const rolRegistro = await prisma.rol.findUnique({ where: { nombre: rol } })
      if (rolRegistro) {
        // Actualizar el rol en TODAS las instituciones del usuario para mantener consistencia
        await prisma.usuarioInstitucion.updateMany({
          where: { usuario_id: id },
          data: { rol_id: rolRegistro.id },
        })
      }
    }

    const rolFinal = await resolverRol(id)

    await registrarAuditoria(
      prisma,
      req.usuario.id,
      'ACTUALIZAR_USUARIO',
      'Usuario',
      id,
      valoresAntes,
      JSON.stringify({ nombre: usuarioActualizado.nombre, apellido: usuarioActualizado.apellido, email: usuarioActualizado.email, activo: usuarioActualizado.activo, rol }),
      getClientIp(req),
    )

    return sendSuccess(res, formatUsuario(usuarioActualizado, rolFinal), 'Usuario actualizado correctamente', 200)
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en actualizarUsuario')
    return sendError(res, 'Error al actualizar usuario', 500)
  }
}

const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params

    if (id === req.usuario.id) {
      return sendError(res, 'No puedes eliminar tu propia cuenta', 400)
    }

    const usuario = await prisma.usuario.findUnique({ where: { id, deleted_at: null } })
    if (!usuario) return sendError(res, 'Usuario no encontrado', 404)

    await prisma.usuario.update({
      where: { id },
      data: { deleted_at: new Date(), activo: false },
    })

    await registrarAuditoria(
      prisma,
      req.usuario.id,
      'ELIMINAR_USUARIO',
      'Usuario',
      id,
      JSON.stringify({ nombre: usuario.nombre, email: usuario.email }),
      null,
      getClientIp(req),
    )

    return sendSuccess(res, null, 'Usuario eliminado correctamente', 200)
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en eliminarUsuario')
    return sendError(res, 'Error al eliminar usuario', 500)
  }
}

module.exports = { listarUsuarios, obtenerUsuario, crearUsuario, actualizarUsuario, eliminarUsuario }
