import { request } from './_client';
import { qs } from '../utils/queryString';

export const plantillasApi = {
  listar: async ({ page = 1, limit = 10 } = {}) => {
    const res = await request(`/plantillas/${qs({ page, limit })}`);
    return res.data; // { data: [...], meta: { total, page, limit, totalPages } }
  },

  getById: async (id) => {
    const res = await request(`/plantillas/${id}`);
    return res.data;
  },

  crear: async ({ institucion_id, nombre, template_html, version, activa = true }) => {
    const res = await request('/plantillas/', {
      method: 'POST',
      body: { institucion_id, nombre, template_html, version, activa },
    });
    return res.data;
  },

  actualizar: async (id, data) => {
    const res = await request(`/plantillas/${id}`, { method: 'PUT', body: data });
    return res.data;
  },

  archivar: async (id) => {
    const res = await request(`/plantillas/${id}`, { method: 'DELETE' });
    return res.data;
  },
};
