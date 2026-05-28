import { request } from './_client'

export const integracionesApi = {
  // ── Configuración de integración ──────────────────────────────

  obtener: async (institucionId) => {
    const res = await request(`/integraciones/${institucionId}`)
    return res.data?.configurada ? res.data : null
  },

  crear: async (data) => {
    const res = await request('/integraciones', { method: 'POST', body: data })
    return res.data
  },

  actualizar: async (id, data) => {
    const res = await request(`/integraciones/${id}`, { method: 'PUT', body: data })
    return res.data
  },

  eliminar: async (id) => {
    const res = await request(`/integraciones/${id}`, { method: 'DELETE' })
    return res.data
  },

  // ── Datos externos ────────────────────────────────────────────

  getResumen: async (institucionId) => {
    const res = await request(`/integraciones/${institucionId}/resumen`)
    return res.data
  },

  getEstudiantesExternos: async (institucionId) => {
    const res = await request(`/integraciones/${institucionId}/estudiantes`)
    return res.data
  },

  getCertificadosExternos: async (institucionId) => {
    const res = await request(`/integraciones/${institucionId}/certificados`)
    return res.data
  },

  getPlantillasExternas: async (institucionId) => {
    const res = await request(`/integraciones/${institucionId}/plantillas`)
    return res.data
  },

  sincronizar: async (institucionId, entidades) => {
    const res = await request(`/integraciones/${institucionId}/sincronizar`, {
      method: 'POST',
      body: { entidades },
      timeoutMs: 60000,
    })
    return res.data
  },
}
