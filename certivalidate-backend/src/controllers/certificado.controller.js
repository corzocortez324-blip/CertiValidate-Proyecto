const crypto = require('crypto')
const { sendSuccess, sendError } = require('../utils/response.utils')
const { generarPDF } = require('../utils/pdf.generator')
const { enviarEmailCertificado, enviarEmailCertificadoConPdf } = require('../utils/mailer')
const prisma = require('../utils/prisma')
const { registrarAuditoria } = require('../utils/auditoria')
const { getClientIp } = require('../utils/validators')
const logger = require('../utils/logger')
const academicProvider = require('../services/academic-provider.service')
const integrationConfig = require('../services/integration-config.service')

const ofuscarNombre = (nombre, apellido) => {
  const n = (nombre ?? '').trim()
  const a = (apellido ?? '').trim()
  if (!a) return n
  if (a.length <= 2) return `${n} ${a[0]}***`
  return `${n} ${a[0]}${'*'.repeat(Math.min(a.length - 2, 3))}${a[a.length - 1]}`
}

// Crear certificado
const emitirCertificado = async (req, res) => {
  try {
    const {
      estudiante_id,
      documento_estudiante,
      institucion_id,
      plantilla_id,
      provider = null, // Si es null, se determina desde config
    } = req.body

    if (
      (!estudiante_id && !documento_estudiante) ||
      !institucion_id ||
      !plantilla_id
    ) {
      return sendError(
        res,
        'Debe enviar estudiante_id o documento_estudiante, además de institucion_id y plantilla_id',
        400,
      )
    }

    // Verificar autorización de institución
    const institucionIds = req.institucionIds || []
    if (!institucionIds.includes(institucion_id)) {
      return sendError(
        res,
        'No autorizado para emitir certificados en esta institución',
        403,
      )
    }

    // Determinar provider
    let providerFinal = provider
    if (!providerFinal) {
      try {
        providerFinal =
          await integrationConfig.obtenerProveedorPara(institucion_id)
      } catch (err) {
        logger.warn(
          {
            institucion_id,
            error: err.message,
          },
          '[CertificadoController] Error obteniendo configuración, usando local-db',
        )
        providerFinal = 'local-db'
      }
    }

    // Validar que provider sea válido
    if (!academicProvider.esProveedorValido(providerFinal)) {
      return sendError(
        res,
        `Proveedor académico no implementado: ${providerFinal}`,
        501,
      )
    }

    // Validar parámetros según provider
    if (providerFinal === 'external-api' && !documento_estudiante) {
      return sendError(
        res,
        'documento_estudiante es obligatorio cuando provider es external-api',
        400,
      )
    }

    if (providerFinal === 'local-db' && !estudiante_id) {
      return sendError(
        res,
        'estudiante_id es obligatorio cuando provider es local-db',
        400,
      )
    }

    let estudiante
    let proveedorUsado = providerFinal
    let fallbackUsado = false

    try {
      if (providerFinal === 'external-api') {
        estudiante = await academicProvider.buscarEstudiante({
          provider: 'external-api',
          documento: documento_estudiante,
          institucionId: institucion_id,
        })
      } else {
        if (documento_estudiante) {
          estudiante = await academicProvider.buscarEstudiante({
            provider: 'local-db',
            documento: documento_estudiante,
            institucionId: institucion_id,
          })
        }

        if (!estudiante && estudiante_id) {
          estudiante = await prisma.estudiante.findUnique({
            where: { id: estudiante_id },
          })
        }
      }
    } catch (error) {
      // Si es un provider no implementado (501), propagar directamente
      if (error.statusCode === 501) {
        return sendError(res, error.message, 501)
      }

      logger.warn(
        {
          institucion_id,
          provider: providerFinal,
          error: error.message,
          documento: documento_estudiante,
        },
        '[CertificadoController] Error consultando provider, intentando fallback',
      )

      // Intenta fallback a local
      if (providerFinal === 'external-api' && estudiante_id) {
        try {
          estudiante = await prisma.estudiante.findUnique({
            where: { id: estudiante_id },
          })
          fallbackUsado = true
          proveedorUsado = 'local-db (fallback)'

          logger.warn(
            {
              institucion_id,
              provider: providerFinal,
              fallback: true,
            },
            '[CertificadoController] Fallback a local-db exitoso',
          )
        } catch (fallbackErr) {
          throw error // Relanzar error original si fallback también falla
        }
      } else {
        throw error
      }
    }

    const institucion = await prisma.institucion.findUnique({
      where: { id: institucion_id },
    })

    const plantilla = await prisma.plantillaCertificado.findUnique({
      where: { id: plantilla_id },
    })

    if (!estudiante) return sendError(res, 'Estudiante no encontrado', 404)
    if (!institucion) return sendError(res, 'Institución no encontrada', 404)
    if (!plantilla) return sendError(res, 'Plantilla no encontrada', 404)

    // Validar pertenencia para local
    if (
      !fallbackUsado &&
      providerFinal === 'local-db' &&
      estudiante.institucion_id !== institucion_id
    ) {
      return sendError(
        res,
        'El estudiante no pertenece a la institución seleccionada',
        400,
      )
    }

    if (!plantilla.activa) {
      return sendError(
        res,
        'La plantilla está inactiva y no puede usarse para emitir certificados',
        400,
      )
    }

    if (plantilla.institucion_id !== institucion_id) {
      return sendError(
        res,
        'La plantilla no pertenece a la institución seleccionada',
        400,
      )
    }

    const fechaEmision = new Date()
    const codigo_unico = crypto.randomBytes(8).toString('hex').toUpperCase()

    const certificado = await prisma.$transaction(async (tx) => {

      let estudianteLocalId = estudiante_id
      let estudianteLocal = null

      // PASO 1: Resolver estudiante local definitivo
      if (
        proveedorUsado.startsWith('external-api') ||
        (providerFinal === 'external-api' && !fallbackUsado)
      ) {
        // Si viene de external-api, hacer upsert para sincronizar
        const documentoExterno = estudiante.documento || documento_estudiante

        estudianteLocal = await tx.estudiante.upsert({
          where: {
            institucion_id_documento: {
              institucion_id,
              documento: documentoExterno,
            },
          },
          update: {
            nombre: estudiante.nombre,
            apellido: estudiante.apellido,
            email: estudiante.email || null,
          },
          create: {
            institucion_id,
            nombre: estudiante.nombre,
            apellido: estudiante.apellido,
            documento: documentoExterno,
            email: estudiante.email || null,
          },
        })

        estudianteLocalId = estudianteLocal.id
      } else if (estudiante_id) {
        // Si es local-db con ID, obtener el estudiante local definivo
        estudianteLocal = await tx.estudiante.findUnique({
          where: { id: estudiante_id },
        })
        estudianteLocalId = estudianteLocal?.id || estudiante_id
      } else if (documento_estudiante) {
        // Si es local-db con documento, buscar el estudiante local definitivo
        estudianteLocal = await tx.estudiante.findFirst({
          where: {
            documento: documento_estudiante,
            institucion_id,
          },
        })
        estudianteLocalId = estudianteLocal?.id
      }

      // PASO 2: Calcular hash CON el estudiante local definitivo (CRÍTICO)
      const contenidoReal = `${estudianteLocalId}|${estudianteLocal?.nombre || estudiante.nombre}|${estudianteLocal?.apellido || estudiante.apellido}|${estudianteLocal?.email || estudiante.email || ''}|${institucion.id}|${institucion.nombre}|${plantilla.id}|${plantilla.nombre}|${codigo_unico}|${fechaEmision.toISOString()}`

      const hash_sha256 = crypto
        .createHash('sha256')
        .update(contenidoReal)
        .digest('hex')

      // PASO 3: Validar unicidad estudiante+plantilla
      const certificadoExistente = await tx.certificado.findFirst({
        where: {
          estudiante_id: estudianteLocalId,
          plantilla_id,
          deleted_at: null,
          estado: { not: 'revocado' },
        },
      })

      if (certificadoExistente) {
        const err = new Error(
          'Ya existe un certificado vigente para este estudiante con esta plantilla. Revoca el existente antes de emitir uno nuevo.',
        )
        err.statusCode = 409
        throw err
      }

      // PASO 4: Crear certificado con hash ya calculado
      const cert = await tx.certificado.create({
        data: {
          estudiante_id: estudianteLocalId,
          institucion_id,
          plantilla_id,
          codigo_unico,
          estado: 'valido',
          fecha_emision: fechaEmision,
          hash_sha256,
        },
      })

      // Guardar metadata de origen
      const metadataOrigen = {
        provider: proveedorUsado,
        source_system: 'Academic Provider',
        source_document_id:
          documento_estudiante || estudiante.documento || null,
        source_api: process.env.ACADEMIC_API_URL || null,
        fecha_sync: new Date().toISOString(),
        fallback: fallbackUsado,
      }

      await tx.certificadoMetadata.create({
        data: {
          certificado_id: cert.id,
          clave: 'origen_academico',
          valor: JSON.stringify(metadataOrigen),
        },
      })

      await tx.auditoria.create({
        data: {
          usuario_id: req.usuario.id,
          accion: 'EMITIR_CERTIFICADO',
          entidad: 'Certificado',
          entidad_id: cert.id,
          valores_antes: null,
          valores_despues: JSON.stringify({
            estudiante_id: estudianteLocalId,
            documento_estudiante:
              documento_estudiante || estudiante.documento || null,
            provider: proveedorUsado,
            fallback: fallbackUsado,
            institucion_id,
            plantilla_id,
            codigo_unico,
          }),
          ip: getClientIp(req),
          institucion_id,
        },
      })

      return cert
    })

    logger.info(
      {
        institucion_id,
        certificado_id: certificado.id,
        estudiante_id: certificado.estudiante_id,
        provider: proveedorUsado,
        fallback: fallbackUsado,
        documento: documento_estudiante,
      },
      '[CertificadoController] Certificado emitido exitosamente',
    )

    // El email con el PDF del template lo envía el frontend vía POST /certificados/:id/email
    // para garantizar que use el diseño real de la plantilla.

    return sendSuccess(
      res,
      certificado,
      'Certificado generado correctamente',
      201,
    )
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode)
    }

    logger.error(
      { err: error, requestId: req.requestId },
      'Error en emitirCertificado',
    )

    return sendError(res, 'Error al generar certificado', 500)
  }
}

const verificarCertificado = async (req, res) => {
  try {
    const { hash, codigo } = req.body

    if (!hash && !codigo) {
      return sendError(
        res,
        'El hash o el codigo del certificado es obligatorio',
        400,
      )
    }

    const metodo = hash ? 'hash' : 'codigo'

    const cert = await prisma.certificado.findFirst({
      where: hash
        ? { hash_sha256: hash, deleted_at: null }
        : { codigo_unico: codigo, deleted_at: null },
      include: {
        estudiante: true,
        institucion: true,
        plantilla: true,
        blockchain: {
          where: { estado: 'confirmado' },
          orderBy: { confirmado_en: 'desc' },
          take: 1,
        },
      },
    })

    if (!cert) {
      return sendSuccess(
        res,
        {
          estado: 'no_encontrado',
          mensaje: 'El certificado no fue encontrado',
        },
        'Certificado no encontrado',
        200,
      )
    }

    const contenidoVerificacion = `${cert.estudiante.id}|${cert.estudiante.nombre}|${cert.estudiante.apellido}|${cert.estudiante.email || ''}|${cert.institucion.id}|${cert.institucion.nombre}|${cert.plantilla.id}|${cert.plantilla.nombre}|${cert.codigo_unico}|${cert.fecha_emision.toISOString()}`

    const hashRecomputado = crypto
      .createHash('sha256')
      .update(contenidoVerificacion)
      .digest('hex')

    const hashVerificado = hashRecomputado === cert.hash_sha256

    const ip = getClientIp(req)
    const userAgent = req.headers['user-agent'] || null

    const ahora = new Date()
    const estaExpirado =
      cert.fecha_expiracion && ahora > new Date(cert.fecha_expiracion)

    let resultado = 'valido'
    let mensaje = 'Certificado verificado correctamente'

    if (!hashVerificado) {
      resultado = 'invalido'
      mensaje = 'Integridad del certificado comprometida'
    } else if (cert.estado === 'revocado') {
      resultado = 'revocado'
      mensaje = 'El certificado ha sido revocado'
    } else if (estaExpirado) {
      resultado = 'expirado'
      mensaje = 'El certificado ha expirado'
    }

    await prisma.verificacionPublica.create({
      data: {
        certificado_id: cert.id,
        ip,
        user_agent: userAgent,
        resultado,
        metodo,
      },
    })

    const txBlockchain = cert.blockchain?.[0] ?? null

    return sendSuccess(
      res,
      {
        codigo_unico: cert.codigo_unico,
        estado: resultado === 'valido' ? cert.estado : resultado,
        mensaje,
        hash_verificado: hashVerificado,
        fecha_emision: cert.fecha_emision,
        fecha_expiracion: cert.fecha_expiracion,
        estudiante: {
          nombre: cert.estudiante?.nombre,
          apellido: cert.estudiante?.apellido,
        },
        titular: ofuscarNombre(
          cert.estudiante?.nombre,
          cert.estudiante?.apellido,
        ),
        tipo_certificado: cert.plantilla?.nombre ?? null,
        institucion: cert.institucion?.nombre ?? null,
        blockchain: txBlockchain
          ? {
              tx_hash: txBlockchain.tx_hash,
              red: txBlockchain.red,
              confirmado_en: txBlockchain.confirmado_en,
              explorador_url: txBlockchain.tx_hash
                ? `https://polygonscan.com/tx/${txBlockchain.tx_hash}`
                : null,
            }
          : null,
      },
      mensaje,
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en verificarCertificado',
    )

    return sendError(res, 'Error al verificar certificado', 500)
  }
}

// Descargar certificado como PDF
const descargarCertificado = async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return sendError(res, 'ID del certificado es obligatorio', 400)
    }

    const cert = await prisma.certificado.findFirst({
      where: { id, deleted_at: null },
      include: {
        estudiante: true,
        institucion: true,
        plantilla: true,
      },
    })

    if (!cert) {
      return sendError(res, 'Certificado no encontrado', 404)
    }

    const institucionIds = req.institucionIds || []

    if (!institucionIds.includes(cert.institucion_id)) {
      return sendError(
        res,
        'No autorizado para descargar este certificado',
        403,
      )
    }

    await generarPDF(cert, res)
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en descargarCertificado',
    )
    return sendError(res, 'Error al descargar certificado', 500)
  }
}

// Listar certificados
const listarCertificados = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    )
    const estadoFiltro = req.query.estado
    const instIds = req.institucionIds || []

    const search = (req.query.search || '').trim()
    const institucionId = req.query.institucion_id
    const estudianteId = req.query.estudiante_id

    if (instIds.length === 0) {
      return sendError(res, 'No autorizado para ver certificados', 403)
    }

    const where = {
      deleted_at: null,
      institucion_id: { in: instIds },
    }

    if (institucionId) {
      if (!instIds.includes(institucionId)) {
        return sendError(
          res,
          'No autorizado para ver certificados de esta institución',
          403,
        )
      }

      where.institucion_id = { in: [institucionId] }
    }

    if (estudianteId) {
      where.estudiante_id = estudianteId
    }

    if (estadoFiltro === 'revocado') {
      where.estado = 'revocado'
    } else if (estadoFiltro === 'emitido') {
      where.estado = 'valido'
    } else if (estadoFiltro === 'expirado') {
      where.fecha_expiracion = { lt: new Date() }
    }

    if (search) {
      where.OR = [
        { codigo_unico: { contains: search, mode: 'insensitive' } },
        { hash_sha256: { contains: search, mode: 'insensitive' } },
        { estudiante: { nombre: { contains: search, mode: 'insensitive' } } },
        { estudiante: { apellido: { contains: search, mode: 'insensitive' } } },
        {
          estudiante: { documento: { contains: search, mode: 'insensitive' } },
        },
        { plantilla: { nombre: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [certificados, total] = await prisma.$transaction([
      prisma.certificado.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          estudiante: true,
          plantilla: {
            select: {
              id: true,
              nombre: true,
              version: true,
              activa: true,
              institucion_id: true,
            },
          },
          institucion: true,
        },
      }),
      prisma.certificado.count({ where }),
    ])

    const totalPages = Math.max(Math.ceil(total / limit), 1)

    return sendSuccess(
      res,
      { data: certificados, meta: { total, page, limit, totalPages } },
      'Certificados obtenidos correctamente',
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en listarCertificados',
    )
    return sendError(res, 'Error al listar certificados', 500)
  }
}

// Obtener detalles de un certificado específico
const obtenerCertificado = async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return sendError(res, 'ID del certificado es obligatorio', 400)
    }

    const cert = await prisma.certificado.findFirst({
      where: { id, deleted_at: null },
      include: {
        estudiante: true,
        institucion: true,
        plantilla: true,
        blockchain: {
          where: { estado: 'confirmado' },
          orderBy: { confirmado_en: 'desc' },
          take: 1,
        },
      },
    })

    if (!cert) {
      return sendError(res, 'Certificado no encontrado', 404)
    }

    const institucionIds = req.institucionIds || []

    if (!institucionIds.includes(cert.institucion_id)) {
      return sendError(res, 'No autorizado para ver este certificado', 403)
    }

    const txBlockchain = cert.blockchain?.[0] ?? null
    const certConBlockchain = {
      ...cert,
      tx_hash: txBlockchain?.tx_hash ?? null,
      red_blockchain: txBlockchain?.red ?? null,
      fecha_blockchain: txBlockchain?.confirmado_en ?? null,
    }

    return sendSuccess(res, certConBlockchain, 'Certificado obtenido correctamente', 200)
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en obtenerCertificado',
    )
    return sendError(res, 'Error al obtener certificado', 500)
  }
}

// Obtener verificaciones públicas de un certificado
const obtenerVerificaciones = async (req, res) => {
  try {
    const { id } = req.params
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    )

    if (!id) {
      return sendError(res, 'ID del certificado es obligatorio', 400)
    }

    const certificado = await prisma.certificado.findFirst({
      where: { id, deleted_at: null },
    })

    if (!certificado) {
      return sendError(res, 'Certificado no encontrado', 404)
    }

    const institucionIds = req.institucionIds || []

    if (!institucionIds.includes(certificado.institucion_id)) {
      return sendError(
        res,
        'No autorizado para ver las verificaciones de este certificado',
        403,
      )
    }

    const total = await prisma.verificacionPublica.count({
      where: { certificado_id: id },
    })

    const verificaciones = await prisma.verificacionPublica.findMany({
      where: { certificado_id: id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { fecha: 'desc' },
      select: {
        ip: true,
        user_agent: true,
        resultado: true,
        metodo: true,
        fecha: true,
      },
    })

    const totalPages = Math.max(Math.ceil(total / limit), 1)

    return sendSuccess(
      res,
      {
        total,
        page,
        limit,
        totalPages,
        verificaciones,
      },
      'Verificaciones públicas obtenidas correctamente',
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en obtenerVerificaciones',
    )
    return sendError(res, 'Error al obtener verificaciones públicas', 500)
  }
}

// Obtener historial de revocaciones de un certificado
const obtenerRevocaciones = async (req, res) => {
  try {
    const { id } = req.params
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    )

    if (!id) {
      return sendError(res, 'ID del certificado es obligatorio', 400)
    }

    const certificado = await prisma.certificado.findFirst({
      where: { id, deleted_at: null },
    })

    if (!certificado) {
      return sendError(res, 'Certificado no encontrado', 404)
    }

    const institucionIds = req.institucionIds || []

    if (!institucionIds.includes(certificado.institucion_id)) {
      return sendError(
        res,
        'No autorizado para ver las revocaciones de este certificado',
        403,
      )
    }

    const total = await prisma.revocacion.count({
      where: { certificado_id: id },
    })

    const revocaciones = await prisma.revocacion.findMany({
      where: { certificado_id: id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { fecha_revocacion: 'desc' },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    })

    const totalPages = Math.max(Math.ceil(total / limit), 1)

    return sendSuccess(
      res,
      {
        total,
        page,
        limit,
        totalPages,
        revocaciones,
      },
      'Historial de revocaciones obtenido correctamente',
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en obtenerRevocaciones',
    )
    return sendError(res, 'Error al obtener historial de revocaciones', 500)
  }
}

// Obtener motivo de revocación
const obtenerMotivoRevocacion = async (req, res) => {
  try {
    const { id } = req.params
    const institucionIds =
      req.institucionIds || req.instituciones?.map((i) => i.id) || []

    const cert = await prisma.certificado.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, estado: true, institucion_id: true },
    })

    if (!cert) return sendError(res, 'Certificado no encontrado', 404)

    if (!institucionIds.includes(cert.institucion_id)) {
      return sendError(
        res,
        'No autorizado para ver este motivo de revocación',
        403,
      )
    }

    if (cert.estado !== 'revocado') {
      return sendError(res, 'El certificado no está revocado', 400)
    }

    const revocacion = await prisma.revocacion.findFirst({
      where: { certificado_id: id },
      orderBy: { fecha_revocacion: 'desc' },
      include: {
        usuario: { select: { nombre: true, apellido: true } },
      },
    })

    if (!revocacion) {
      return sendError(res, 'Datos de revocación no encontrados', 404)
    }

    return sendSuccess(
      res,
      {
        motivo: revocacion.motivo_codigo,
        motivoCategoria: revocacion.motivo_codigo.replace(/_/g, ' '),
        motivo_detalle: revocacion.motivo_detalle ?? null,
        revocadoPor: revocacion.usuario
          ? `${revocacion.usuario.nombre} ${revocacion.usuario.apellido ?? ''}`.trim()
          : null,
        fechaRevocacion: revocacion.fecha_revocacion,
        txHashRevocacion: null,
      },
      'Motivo de revocación obtenido correctamente',
      200,
    )
  } catch (error) {
    logger.error(
      { err: error, requestId: req.requestId },
      'Error en obtenerMotivoRevocacion',
    )
    return sendError(res, 'Error al obtener motivo de revocación', 500)
  }
}

// Revocar certificado
const revocarCertificado = async (req, res) => {
  try {
    const { id } = req.params
    const { motivo_codigo, motivo_detalle } = req.body
    const certPrecargado = req.certificado

    // Defense-in-depth: controller-level multi-tenant ownership check
    const institucionIds = req.institucionIds || []
    if (certPrecargado && !institucionIds.includes(certPrecargado.institucion_id)) {
      return sendError(res, 'No autorizado para revocar certificados de esta institución', 403)
    }

    const [certificadoActualizado] = await prisma.$transaction(async (tx) => {
      const certificado = await tx.certificado.findFirst({
        where: { id, deleted_at: null },
      })

      if (!certificado) {
        const err = new Error('Certificado no encontrado')
        err.statusCode = 404
        throw err
      }

      if (certificado.estado === 'revocado') {
        const err = new Error('El certificado ya está revocado')
        err.statusCode = 409
        throw err
      }

      return Promise.all([
        tx.certificado.update({
          where: { id },
          data: { estado: 'revocado' },
        }),
        tx.revocacion.create({
          data: {
            certificado_id: id,
            revocado_por: req.usuario.id,
            motivo_codigo,
            motivo_detalle: motivo_detalle || null,
            fecha_revocacion: new Date(),
          },
        }),
      ])
    })

    await registrarAuditoria(
      prisma,
      req.usuario.id,
      'REVOCAR_CERTIFICADO',
      'Certificado',
      id,
      JSON.stringify({ estado: certPrecargado?.estado }),
      JSON.stringify({ estado: 'revocado', nivel_acceso: req.nivelRevocacion }),
      getClientIp(req),
      certificadoActualizado.institucion_id,
    )

    return sendSuccess(
      res,
      certificadoActualizado,
      'Certificado revocado correctamente',
      200,
    )
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode)
    }

    logger.error(
      { err: error, requestId: req.requestId },
      'Error en revocarCertificado',
    )

    return sendError(res, 'Error al revocar certificado', 500)
  }
}

// Enviar email con PDF del certificado generado desde el frontend
const enviarEmailConPdfTemplate = async (req, res) => {
  try {
    const { id } = req.params
    const { pdf_base64 } = req.body

    if (!pdf_base64) return sendError(res, 'pdf_base64 es obligatorio', 400)

    const cert = await prisma.certificado.findFirst({
      where: { id, deleted_at: null },
      include: { estudiante: true, institucion: true, plantilla: true },
    })

    if (!cert) return sendError(res, 'Certificado no encontrado', 404)

    const institucionIds = req.institucionIds || []
    if (!institucionIds.includes(cert.institucion_id))
      return sendError(res, 'No autorizado', 403)

    if (!cert.estudiante?.email)
      return sendError(res, 'El estudiante no tiene email registrado', 400)

    const pdfBuffer = Buffer.from(pdf_base64, 'base64')
    await enviarEmailCertificadoConPdf(cert, pdfBuffer)

    return sendSuccess(res, null, 'Email enviado correctamente', 200)
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId }, 'Error en enviarEmailConPdfTemplate')
    return sendError(res, 'Error al enviar el email', 500)
  }
}

module.exports = {
  emitirCertificado,
  verificarCertificado,
  descargarCertificado,
  listarCertificados,
  obtenerCertificado,
  obtenerVerificaciones,
  obtenerRevocaciones,
  obtenerMotivoRevocacion,
  revocarCertificado,
  enviarEmailConPdfTemplate,
}
