import { request } from './_client.js';

export const adminApi = {
  getStats: async (period = '30d') => {
    const res = await request(`/admin/stats?period=${period}`);
    return res.data;
  },

  getStatsMV: async () => {
    const res = await request('/admin/stats/mv');
    return res.data;
  },

  getReporteMotivos: async ({ institucion_id, fecha_desde, fecha_hasta } = {}) => {
    const params = new URLSearchParams();
    if (institucion_id) params.set('institucion_id', institucion_id);
    if (fecha_desde)    params.set('fecha_desde', fecha_desde);
    if (fecha_hasta)    params.set('fecha_hasta', fecha_hasta);
    const res = await request(`/admin/revocaciones/motivos?${params}`);
    return res.data;
  },
};
