import { request } from './_client';
import { qs } from '../utils/queryString';

export const usuariosApi = {
  listar: async ({ page = 1, limit = 10, search = '' } = {}) => {
    const res = await request(`/usuarios${qs({ page, limit, search: search || undefined })}`);
    return res.data; // { usuarios, total, page, limit, totalPages }
  },

  getById: async (id) => {
    const res = await request(`/usuarios/${id}`);
    return res.data;
  },

  crear: async (data) => {
    const res = await request('/usuarios', { method: 'POST', body: data });
    return res.data;
  },

  actualizar: async (id, data) => {
    // Build clean payload: normalize rol to string, never send password in updates
    const payload = {}
    if (data.nombre !== undefined) payload.nombre = data.nombre
    if (data.apellido !== undefined) payload.apellido = data.apellido
    if (data.email !== undefined) payload.email = data.email
    if (data.activo !== undefined) payload.activo = data.activo
    if (data.rol !== undefined && data.rol !== null) {
      // Handle both string ('admin') and object ({nombre: 'admin'})
      const rolNombre = data.rol?.nombre || data.rol
      if (rolNombre && typeof rolNombre === 'string') payload.rol = rolNombre
    }
    const res = await request(`/usuarios/${id}`, { method: 'PUT', body: payload });
    return res.data;
  },

  eliminar: async (id) => {
    const res = await request(`/usuarios/${id}`, { method: 'DELETE' });
    return res.data;
  },

  toggleEstado: async (id, activo) => {
    const res = await request(`/usuarios/${id}`, { method: 'PUT', body: { activo: Boolean(activo) } });
    return res.data;
  },
};
