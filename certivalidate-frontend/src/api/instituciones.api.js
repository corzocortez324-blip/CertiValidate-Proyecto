import { request } from './_client';
import { qs } from '../utils/queryString';

export const institucionesApi = {
  listar: async ({ page = 1, limit = 10 } = {}) => {
    const res = await request(`/instituciones/${qs({ page, limit })}`);
    return res.data; // { data: [...], meta: { total, page, limit, totalPages } }
  },

  getById: async (id) => {
    const res = await request(`/instituciones/${id}`);
    return res.data;
  },

  getEstadisticas: async (id) => {
    const res = await request(`/instituciones/${id}/estadisticas`);
    return res.data;
  },

  crear: async ({ nombre, dominio, logo_url, activa = true }) => {
    const res = await request('/instituciones/', {
      method: 'POST',
      body: { nombre, ...(dominio ? { dominio } : {}), ...(logo_url ? { logo_url } : {}), activa },
    });
    return res.data;
  },

  actualizar: async (id, data) => {
    const res = await request(`/instituciones/${id}`, { method: 'PUT', body: data });
    return res.data;
  },

  desactivar: async (id) => {
    const res = await request(`/instituciones/${id}/desactivar`, { method: 'PATCH' });
    return res.data;
  },
};
