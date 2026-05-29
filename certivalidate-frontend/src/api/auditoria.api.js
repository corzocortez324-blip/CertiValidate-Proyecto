import { request } from './_client';
import { qs } from '../utils/queryString';

export const auditoriaApi = {
  listar: async ({ page = 1, limit = 20, entidad = '', accion = '', usuario_id = '', fecha_desde = '', fecha_hasta = '' } = {}) => {
    const res = await request(`/auditoria/${qs({ page, limit, entidad: entidad || undefined, accion: accion || undefined, usuario_id: usuario_id || undefined, fecha_desde: fecha_desde || undefined, fecha_hasta: fecha_hasta || undefined })}`);
    const { data: auditorias, meta } = res.data;
    return { auditorias, ...meta };
  },

  getByEntidad: async (entidad, entidad_id, { page = 1, limit = 20 } = {}) => {
    const res = await request(`/auditoria/${entidad}/${entidad_id}${qs({ page, limit })}`);
    return res.data;
  },
};
