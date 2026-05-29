import { request, API_BASE, getToken } from './_client';
import { qs } from '../utils/queryString';

export const certificadosApi = {
  listar: async ({ page = 1, limit = 10, search = '', estado = '', institucion_id = '', estudiante_id = '' } = {}) => {
    const res = await request(`/certificados/listar${qs({ page, limit, search: search || undefined, estado: estado || undefined, institucion_id: institucion_id || undefined, estudiante_id: estudiante_id || undefined })}`);
    const { data: certificados, meta } = res.data;
    return { certificados, ...meta };
  },

  getById: async (id) => {
    const res = await request(`/certificados/${id}`);
    return res.data;
  },

  emitir: async ({ estudiante_id, institucion_id, plantilla_id }) => {
    const res = await request('/certificados/emitir', { method: 'POST', body: { estudiante_id, institucion_id, plantilla_id } });
    return res.data;
  },

  revocar: async (id, { motivo_codigo, motivo_detalle }) => {
    const res = await request(`/certificados/${id}/revocar`, {
      method: 'POST',
      body: { motivo_codigo, ...(motivo_detalle ? { motivo_detalle } : {}) },
    });
    return res.data;
  },

  verificar: async ({ hash, codigo }) => {
    const res = await request('/certificados/verificar', {
      method: 'POST',
      body: { ...(hash ? { hash } : {}), ...(codigo ? { codigo } : {}) },
      auth: false,
    });
    return res.data;
  },

  descargar: async (id) => {
    // Descarga directa como blob usando fetch nativo para manejar binario
    const token = getToken();
    const response = await fetch(`${API_BASE}/certificados/descargar/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Error al descargar el certificado');
    return response.blob();
  },

  getVerificaciones: async (id, { page = 1, limit = 10 } = {}) => {
    const res = await request(`/certificados/${id}/verificaciones${qs({ page, limit })}`);
    return res.data;
  },

  getRevocaciones: async (id, { page = 1, limit = 10 } = {}) => {
    const res = await request(`/certificados/${id}/revocaciones${qs({ page, limit })}`);
    return res.data;
  },

  enviarEmailPdf: async (id, pdfBase64) => {
    const res = await request(`/certificados/${id}/email`, {
      method: 'POST',
      body: { pdf_base64: pdfBase64 },
    });
    return res.data;
  },
};
