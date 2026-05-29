import { request } from './_client';

export const rolesApi = {
  listar: async () => {
    const res = await request('/admin/roles');
    return res.data; // { roles, permisos }
  },

  actualizarPermisos: async (rolId, permisoIds) => {
    const res = await request(`/admin/roles/${rolId}/permisos`, {
      method: 'PUT',
      body: { permisoIds },
    });
    return res.data;
  },
};
