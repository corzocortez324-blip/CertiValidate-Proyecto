import { request } from './_client';
import { qs } from '../utils/queryString';

export const estudiantesApi = {
  listar: async ({ page = 1, limit = 10, search = '', institucion_id = '' } = {}) => {
    const res = await request(`/estudiantes/${qs({ page, limit, search: search || undefined, institucion_id: institucion_id || undefined })}`);
    const { data: estudiantes, meta } = res.data;
    return { estudiantes, ...meta };
  },

  getById: async (id) => {
    const res = await request(`/estudiantes/${id}`);
    return res.data;
  },

  crear: async ({ institucion_id, nombre, apellido, documento, email }) => {
    const res = await request('/estudiantes/', {
      method: 'POST',
      body: { institucion_id, nombre, apellido, documento, ...(email ? { email } : {}) },
    });
    return res.data;
  },

  actualizar: async (id, data) => {
    const res = await request(`/estudiantes/${id}`, { method: 'PUT', body: data });
    return res.data;
  },

  eliminar: async (id) => {
    const res = await request(`/estudiantes/${id}`, { method: 'DELETE' });
    return res.data;
  },
};
