import { request, setTokens, clearTokens } from './_client'

export const authApi = {
  login: async (email, password) => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    })
    return res.data // { token, refreshToken, usuario }
  },

  register: async ({ nombre, apellido, email, password }) => {
    const res = await request('/auth/register', {
      method: 'POST',
      body: { nombre, apellido, email, password },
      auth: false,
    })
    return res.data
  },

  logout: async (refreshToken) => {
    await request('/auth/logout', { method: 'POST', body: { refreshToken } })
  },

  getPerfil: async () => {
    const res = await request('/auth/perfil')
    return res.data
  },

  getPermisos: async () => {
    const res = await request('/auth/permisos')
    return res
  },

  updatePerfil: async (data) => {
    const res = await request('/auth/perfil', { method: 'PUT', body: data })
    return res.data
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await request('/auth/perfil/password', {
      method: 'PUT',
      body: { currentPassword, newPassword },
    })
    return res.data
  },

  verificarEmail: async (token) => {
    const res = await request(
      `/auth/verificar-email?token=${encodeURIComponent(token)}`,
      { auth: false },
    )
    return res.data
  },

  // Sesiones activas
  getSesiones: async () => {
    const res = await request('/auth/sesiones')
    return res.data?.sesiones ?? []
  },

  revocarSesion: async (id) => {
    await request(`/auth/sesiones/${id}`, { method: 'DELETE' })
  },

  cerrarTodasSesiones: async () => {
    await request('/auth/sesiones/todas', { method: 'DELETE' })
  },

  // 2FA
  setup2FA: async () => {
    const res = await request('/auth/2fa/setup')
    return res.data // { qrDataUrl, secret }
  },

  enable2FA: async (code) => {
    const res = await request('/auth/2fa/enable', {
      method: 'POST',
      body: { code },
    })
    return res.data
  },

  disable2FA: async (password, code) => {
    const res = await request('/auth/2fa/disable', {
      method: 'POST',
      body: { password, code },
    })
    return res.data
  },

  verify2FA: async (partial_token, code) => {
    const res = await request('/auth/2fa/verify', {
      method: 'POST',
      body: { partial_token, code },
      auth: false,
    })
    return res.data // { token, refreshToken, usuario, accesos }
  },
}
