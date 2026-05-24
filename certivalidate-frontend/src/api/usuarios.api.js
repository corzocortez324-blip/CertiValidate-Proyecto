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
    const res = await request(`/usuarios/${id}`, { method: 'PUT', body: data });
    return res.data;
  },

  eliminar: async (id) => {
    const res = await request(`/usuarios/${id}`, { method: 'DELETE' });
    return res.data;
  },

  toggleEstado: async (id, activo) => {
    const res = await request(`/usuarios/${id}`, { method: 'PUT', body: { activo } });
    return res.data;
  },
};
