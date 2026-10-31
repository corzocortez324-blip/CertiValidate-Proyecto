const { Prisma } = require('@prisma/client')
const { sendSuccess, sendError } = require('../utils/response.utils')
const prisma = require('../utils/prisma')

const PERIOD_MONTHS = { '7d': 1, '30d': 3, '90d': 6, '1y': 12 }

/**
 * Alcance de las estadísticas: el administrador de plataforma ve todo; cualquier
 * otro usuario solo los datos de sus instituciones (evita fuga entre instituciones).
 */
const resolverAlcance = async (req) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: { es_platform_admin: true },
  })
  if (usuario?.es_platform_admin) return null
  const ids = req.institucionIds?.length ? req.institucionIds : ['00000000-0000-0000-0000-000000000000']
  return ids
}

const getStats = async (req, res) => {
  try {
    const alcance = await resolverAlcance(req)
    const certWhere = alcance ? { institucion_id: { in: alcance } } : {}
    const verifWhere = alcance ? { certificado: { institucion_id: { in: alcance } } } : {}
    const sqlCert = alcance ? Prisma.sql`AND institucion_id IN (${Prisma.join(alcance)})` : Prisma.empty
    const sqlVerif = alcance
      ? Prisma.sql`AND certificado_id IN (SELECT id FROM "Certificado" WHERE institucion_id IN (${Prisma.join(alcance)}))`
      : Prisma.empty
    const sqlAudit = alcance ? Prisma.sql`AND a.institucion_id IN (${Prisma.join(alcance)})` : Prisma.empty

    const period = req.query.period || '30d'
    const monthsBack = PERIOD_MONTHS[period] || 3

    const now = new Date()

    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - 7)

    const startOfMonth = new Date(now)
    startOfMonth.setDate(now.getDate() - 30)

    const trendStart = new Date(now)
    trendStart.setMonth(now.getMonth() - monthsBack)
    trendStart.setDate(1)
    trendStart.setHours(0, 0, 0, 0)

    const [
      totalEmitidos,
      totalRevocados,
      verifHoy,
      verifSemana,
      verifMes,
      emisionesPorMes,
      verificacionesPorMes,
      topEmisores,
      ultimasRevocaciones,
      emisionesDiarias,
      verificacionesDiarias,
    ] = await Promise.all([
      prisma.certificado.count({ where: { deleted_at: null, ...certWhere } }),
      prisma.certificado.count({ where: { deleted_at: null, estado: 'revocado', ...certWhere } }),
      prisma.verificacionPublica.count({ where: { fecha: { gte: startOfToday }, ...verifWhere } }),
      prisma.verificacionPublica.count({ where: { fecha: { gte: startOfWeek }, ...verifWhere } }),
      prisma.verificacionPublica.count({ where: { fecha: { gte: startOfMonth }, ...verifWhere } }),
      prisma.$queryRaw`
        SELECT TO_CHAR(DATE_TRUNC('month', fecha_emision), 'YYYY-MM') AS mes,
               COUNT(*)::int AS total
        FROM "Certificado"
        WHERE fecha_emision >= ${trendStart} AND deleted_at IS NULL ${sqlCert}
        GROUP BY DATE_TRUNC('month', fecha_emision)
        ORDER BY DATE_TRUNC('month', fecha_emision)
      `,
      prisma.$queryRaw`
        SELECT TO_CHAR(DATE_TRUNC('month', fecha), 'YYYY-MM') AS mes,
               COUNT(*)::int AS total
        FROM "VerificacionPublica"
        WHERE fecha >= ${trendStart} ${sqlVerif}
        GROUP BY DATE_TRUNC('month', fecha)
        ORDER BY DATE_TRUNC('month', fecha)
      `,
      prisma.$queryRaw`
        SELECT u.nombre || ' ' || u.apellido AS nombre, COUNT(a.id)::int AS total
        FROM "Auditoria" a
        JOIN "Usuario" u ON a.usuario_id = u.id
        WHERE a.accion = 'EMITIR_CERTIFICADO' ${sqlAudit}
        GROUP BY u.id, u.nombre, u.apellido
        ORDER BY COUNT(a.id) DESC
        LIMIT 5
      `,
      prisma.revocacion.findMany({
        take: 5,
        where: alcance ? { certificado: { institucion_id: { in: alcance } } } : {},
        orderBy: { fecha_revocacion: 'desc' },
        include: {
          certificado: {
            select: {
              codigo_unico: true,
              estudiante: { select: { nombre: true, apellido: true } },
            },
          },
        },
      }),
      prisma.$queryRaw`
        SELECT DATE_TRUNC('day', fecha_emision)::date AS dia,
               COUNT(*)::int AS total_emitidos,
               COUNT(*) FILTER (WHERE estado = 'revocado')::int AS total_revocados
        FROM "Certificado"
        WHERE deleted_at IS NULL
          AND fecha_emision >= NOW() - INTERVAL '90 days' ${sqlCert}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw`
        SELECT DATE_TRUNC('day', fecha)::date AS dia,
               COUNT(*)::int AS total
        FROM "VerificacionPublica"
        WHERE fecha >= NOW() - INTERVAL '30 days' ${sqlVerif}
        GROUP BY 1 ORDER BY 1
      `,
    ])

    // Merge monthly trend filling gaps with zeros
    const mesMap = {}
    emisionesPorMes.forEach((r) => {
      mesMap[r.mes] = mesMap[r.mes] || {}
      mesMap[r.mes].emisiones = Number(r.total)
    })
    verificacionesPorMes.forEach((r) => {
      mesMap[r.mes] = mesMap[r.mes] || {}
      mesMap[r.mes].verificaciones = Number(r.total)
    })

    const tendencia = []
    for (let i = monthsBack; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(now.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      tendencia.push({
        mes: key,
        emisiones: mesMap[key]?.emisiones || 0,
        verificaciones: mesMap[key]?.verificaciones || 0,
      })
    }

    const totalValidos = totalEmitidos - totalRevocados
    const tasaValidez =
      totalEmitidos > 0
        ? Math.round((totalValidos / totalEmitidos) * 1000) / 10
        : 100

    sendSuccess(res, {
      totalEmitidos,
      totalValidos,
      totalRevocados,
      tasaValidez,
      verificacionesHoy: Number(verifHoy),
      verificacionesSemana: Number(verifSemana),
      verificacionesMes: Number(verifMes),
      tendencia,
      topEmisores: topEmisores.map((e) => ({ nombre: e.nombre, total: Number(e.total) })),
      ultimasRevocaciones: ultimasRevocaciones.map((r) => ({
        id: r.id,
        motivo_codigo: r.motivo_codigo,
        fecha_revocacion: r.fecha_revocacion,
        codigo_unico: r.certificado?.codigo_unico,
        titular: r.certificado?.estudiante
          ? `${r.certificado.estudiante.nombre} ${r.certificado.estudiante.apellido}`
          : null,
      })),
      emisionesDiarias: emisionesDiarias.map((r) => ({
        dia: r.dia,
        total_emitidos: Number(r.total_emitidos),
        total_revocados: Number(r.total_revocados),
      })),
      verificacionesDiarias: verificacionesDiarias.map((r) => ({
        dia: r.dia,
        total: Number(r.total),
      })),
    })
  } catch (err) {
    sendError(res, err.message, 500)
  }
}

// T-76: Reporte de motivos frecuentes de revocación
const getReporteMotivos = async (req, res) => {
  try {
    const { institucion_id, fecha_desde, fecha_hasta } = req.query
    const alcance = await resolverAlcance(req)

    if (alcance && institucion_id && !alcance.includes(institucion_id)) {
      return sendError(res, 'No autorizado para consultar esta institución', 403)
    }

    const desde = fecha_desde ? new Date(fecha_desde) : null
    const hasta = fecha_hasta ? new Date(fecha_hasta) : null
    if ((desde && Number.isNaN(desde.getTime())) || (hasta && Number.isNaN(hasta.getTime()))) {
      return sendError(res, 'fecha_desde y fecha_hasta deben ser fechas válidas', 400)
    }

    // Consulta con el query builder de Prisma (sin SQL directo)
    let filtroInstitucion = {}
    if (institucion_id) filtroInstitucion = { institucion_id: String(institucion_id) }
    else if (alcance) filtroInstitucion = { institucion_id: { in: alcance } }
    const fecha_revocacion = {}
    if (desde) fecha_revocacion.gte = desde
    if (hasta) fecha_revocacion.lte = hasta

    const grupos = await prisma.revocacion.groupBy({
      by: ['motivo_codigo'],
      where: {
        certificado: filtroInstitucion,
        ...(desde || hasta ? { fecha_revocacion } : {}),
      },
      _count: { _all: true },
    })
    const rows = grupos
      .map((g) => ({ motivo_codigo: g.motivo_codigo, total: g._count._all }))
      .sort((x, y) => y.total - x.total)

    const totalRevocaciones = rows.reduce((sum, r) => sum + Number(r.total), 0)
    const reporte = rows.map((r) => ({
      motivo_codigo: r.motivo_codigo,
      motivo_label: r.motivo_codigo.replace(/_/g, ' '),
      total: Number(r.total),
      porcentaje: totalRevocaciones > 0
        ? Math.round((Number(r.total) / totalRevocaciones) * 1000) / 10
        : 0,
    }))

    return sendSuccess(res, { reporte, total_revocaciones: totalRevocaciones }, 'Reporte de motivos generado', 200)
  } catch (err) {
    sendError(res, err.message, 500)
  }
}

// T-98/T-104: Stats desde vistas materializadas (rápido, sin cómputo en tiempo real)
const getStatsMV = async (req, res) => {
  try {
    // Las vistas materializadas son globales: solo para el administrador de plataforma
    if (await resolverAlcance(req)) {
      return sendError(res, 'Solo el administrador de plataforma puede ver estadísticas globales', 403)
    }

    const [certRows, emisionRows, verifRows] = await Promise.all([
      prisma.$queryRaw`SELECT * FROM public.v_estadisticas_certificados LIMIT 1`,
      prisma.$queryRaw`SELECT * FROM public.v_estadisticas_emisiones ORDER BY dia`,
      prisma.$queryRaw`SELECT * FROM public.v_estadisticas_verificacion LIMIT 1`,
    ])

    return sendSuccess(res, {
      certificados:    certRows[0]  ?? null,
      emisiones:       emisionRows,
      verificaciones:  verifRows[0] ?? null,
    }, 'Estadísticas desde vistas materializadas', 200)
  } catch (err) {
    sendError(res, err.message, 500)
  }
}

module.exports = { getStats, getReporteMotivos, getStatsMV }
