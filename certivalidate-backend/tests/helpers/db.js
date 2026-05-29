const bcrypt = require('bcrypt')
const prisma = require('../../src/utils/prisma')
const TEST_PREFIX = '__test__'

const assertSafeTestDatabase = () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanupTestData solo puede ejecutarse en NODE_ENV=test')
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || ''
  if (!databaseUrl) {
    throw new Error(
      'cleanupTestData requiere DATABASE_URL/DIRECT_URL definido en el entorno de test.',
    )
  }

  if (!/test|localhost/i.test(databaseUrl)) {
    throw new Error(
      `cleanupTestData abortado: la base de datos configurada no es de pruebas/local (${databaseUrl}).`,
    )
  }
}

const createTestUser = async (emailSuffix, password = 'TestPass123') => {
  const hash = await bcrypt.hash(password, 10)
  return prisma.usuario.create({
    data: {
      nombre: 'Test',
      apellido: 'User',
      email: `${TEST_PREFIX}${emailSuffix}@certivalidate.test`,
      password_hash: hash,
      activo: true,
      email_verificado: true,
      totp_enabled: false,
      totp_secret: null,
    },
  })
}

const createTestInstitucion = async (suffix) => {
  return prisma.institucion.create({
    data: { nombre: `${TEST_PREFIX}Institucion ${suffix}` },
  })
}

const linkUserToInstitucion = async (
  usuarioId,
  institucionId,
  rolNombre = 'admin',
) => {
  const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } })
  if (!rol)
    throw new Error(`Rol '${rolNombre}' no encontrado. Ejecuta: npm run seed`)
  return prisma.usuarioInstitucion.create({
    data: {
      usuario_id: usuarioId,
      institucion_id: institucionId,
      rol_id: rol.id,
    },
  })
}

const createTestEstudiante = async (institucionId, suffix) => {
  return prisma.estudiante.create({
    data: {
      institucion_id: institucionId,
      nombre: 'Estudiante',
      apellido: `Test ${suffix}`,
      documento: `TEST${suffix}`,
    },
  })
}

const createTestPlantilla = async (institucionId, suffix) => {
  return prisma.plantillaCertificado.create({
    data: {
      institucion_id: institucionId,
      nombre: `${TEST_PREFIX}Plantilla ${suffix}`,
      template_html: '<p>Test template</p>',
      version: 1,
      activa: true,
    },
  })
}

/**
 * Elimina todos los datos de test en orden topológico (hijos antes que padres).
 * Filtra por TEST_PREFIX para no tocar datos reales.
 *
 * Supabase tiene triggers de inmutabilidad en Revocacion y Auditoria.
 * Revocacion se borra fila a fila para identificar qué cert_ids quedan bloqueados;
 * sus cadenas (Certificado → Estudiante → Plantilla → Institucion) se omiten.
 * Si Auditoria tampoco puede borrarse, Usuario recibe soft-delete (activo=false).
 */
const cleanupTestData = async () => {
  assertSafeTestDatabase()

  const testUsers = await prisma.usuario.findMany({
    where: { email: { startsWith: TEST_PREFIX } },
    select: { id: true },
  })
  const testUserIds = testUsers.map((u) => u.id)

  const testInstituciones = await prisma.institucion.findMany({
    where: { nombre: { startsWith: TEST_PREFIX } },
    select: { id: true },
  })
  const testInstIds = testInstituciones.map((i) => i.id)

  // Recopilar IDs de certificados de test
  let certIds = []
  if (testInstIds.length > 0) {
    const certs = await prisma.certificado.findMany({
      where: { institucion_id: { in: testInstIds } },
      select: { id: true },
    })
    certIds = certs.map((c) => c.id)
  }

  // 1. VerificacionPublica → Certificado (no hay trigger; deleteMany directo)
  if (certIds.length > 0) {
    await prisma.verificacionPublica.deleteMany({
      where: { certificado_id: { in: certIds } },
    })
  }

  // 2. Revocacion → Certificado + Usuario
  // Borrar fila a fila: si el trigger de inmutabilidad bloquea alguna,
  // se registra su certificado_id como "bloqueado" y se salta su cadena.
  const blockedCertIds = new Set()

  if (certIds.length > 0) {
    try {
      await prisma.revocacion.deleteMany({
        where: { certificado_id: { in: certIds } },
      })
    } catch {
      // fallback solo si algún trigger bloquea
      const revocaciones = await prisma.revocacion.findMany({
        where: { certificado_id: { in: certIds } },
        select: { id: true, certificado_id: true },
      })

      await Promise.allSettled(
        revocaciones.map(async (rev) => {
          try {
            await prisma.revocacion.delete({
              where: { id: rev.id },
            })
          } catch {
            blockedCertIds.add(rev.certificado_id)
          }
        }),
      )
    }
  }

  const deletableCertIds = certIds.filter((id) => !blockedCertIds.has(id))

  if (deletableCertIds.length > 0) {
    await prisma.revocacion.deleteMany({
      where: { certificado_id: { in: deletableCertIds } },
    })
  }

  if (deletableCertIds.length > 0) {
    await prisma.certificadoMetadata.deleteMany({
      where: { certificado_id: { in: deletableCertIds } },
    })
  }

  if (deletableCertIds.length > 0) {
    await prisma.blockchainTransaccion.deleteMany({
      where: { certificado_id: { in: deletableCertIds } },
    })
  }

  const auditoriaFilter = []
  if (testUserIds.length > 0)
    auditoriaFilter.push({ usuario_id: { in: testUserIds } })
  if (testInstIds.length > 0)
    auditoriaFilter.push({ institucion_id: { in: testInstIds } })

  let auditoriaEliminada = false
  if (auditoriaFilter.length > 0) {
    try {
      await prisma.auditoria.deleteMany({ where: { OR: auditoriaFilter } })
      auditoriaEliminada = true
    } catch {}
  }

  if (deletableCertIds.length > 0) {
    await prisma.certificado.deleteMany({
      where: { id: { in: deletableCertIds } },
    })
  }

  if (testInstIds.length > 0) {
    let blockedEstudianteIds = []
    if (blockedCertIds.size > 0) {
      const blocked = await prisma.certificado.findMany({
        where: { id: { in: [...blockedCertIds] } },
        select: { estudiante_id: true },
      })
      blockedEstudianteIds = [...new Set(blocked.map((c) => c.estudiante_id))]
    }
    await prisma.estudiante.deleteMany({
      where: {
        institucion_id: { in: testInstIds },
        ...(blockedEstudianteIds.length > 0 && {
          NOT: { id: { in: blockedEstudianteIds } },
        }),
      },
    })

    let blockedPlantillaIds = []
    if (blockedCertIds.size > 0) {
      const blocked = await prisma.certificado.findMany({
        where: { id: { in: [...blockedCertIds] } },
        select: { plantilla_id: true },
      })
      blockedPlantillaIds = [...new Set(blocked.map((c) => c.plantilla_id))]
    }
    await prisma.plantillaCertificado.deleteMany({
      where: {
        institucion_id: { in: testInstIds },
        ...(blockedPlantillaIds.length > 0 && {
          NOT: { id: { in: blockedPlantillaIds } },
        }),
      },
    })
  }

  if (testUserIds.length > 0) {
    // 9. RefreshToken → Usuario
    await prisma.refreshToken.deleteMany({
      where: { usuario_id: { in: testUserIds } },
    })

    // 10. SesionActiva → Usuario
    await prisma.sesionActiva.deleteMany({
      where: { usuario_id: { in: testUserIds } },
    })

    // 11. IntentoLogin (sin FK)
    // Incluir IP de loopback: tests usan emails fijos sin TEST_PREFIX
    // (ej. 'noexiste@certivalidate.test') que acumulan intentos entre runs.
    await prisma.intentoLogin.deleteMany({
      where: {
        OR: [
          { email: { startsWith: TEST_PREFIX } },
          { email: { endsWith: '@certivalidate.test' } },
        ],
      },
    })

    // 12. UsuarioInstitucion → Usuario + Institucion + Rol (antes de Institucion)
    await prisma.usuarioInstitucion.deleteMany({
      where: { usuario_id: { in: testUserIds } },
    })
  }

  if (testInstIds.length > 0) {
    // 13. Integracion → Institucion
    await prisma.integracion.deleteMany({
      where: { institucion_id: { in: testInstIds } },
    })

    // 14. Institucion (solo las que ya no tienen Estudiante ni Plantilla referenciando)
    let blockedInstIds = []
    if (blockedCertIds.size > 0) {
      const blocked = await prisma.certificado.findMany({
        where: { id: { in: [...blockedCertIds] } },
        select: { institucion_id: true },
      })
      blockedInstIds = [...new Set(blocked.map((c) => c.institucion_id))]
    }
    const deletableInstIds = testInstIds.filter(
      (id) => !blockedInstIds.includes(id),
    )
    if (deletableInstIds.length > 0) {
      await prisma.institucion.deleteMany({
        where: { id: { in: deletableInstIds } },
      })
    }
  }

  if (testUserIds.length > 0) {
    // 15. Usuario — hard-delete si Auditoria fue eliminada, soft-delete si no
    if (auditoriaEliminada) {
      await prisma.usuario.deleteMany({
        where: { id: { in: testUserIds } },
      })
    } else {
      await prisma.usuario.updateMany({
        where: { id: { in: testUserIds } },
        data: { activo: false },
      })
    }
  }
}

const enableTest2FA = async (usuarioId, secret = 'JBSWY3DPEHPK3PXP') => {
  return prisma.usuario.update({
    where: { id: usuarioId },
    data: { totp_secret: secret, totp_enabled: true },
  })
}

module.exports = {
  TEST_PREFIX,
  createTestUser,
  createTestInstitucion,
  linkUserToInstitucion,
  createTestEstudiante,
  createTestPlantilla,
  cleanupTestData,
  enableTest2FA,
}
