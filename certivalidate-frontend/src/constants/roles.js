export const ROLE_PERMISSIONS = {
  admin: [
    'certificado:emitir', 'certificado:revocar', 'certificado:listar', 'certificado:ver', 'certificado:descargar',
    'estudiante:crear', 'estudiante:actualizar', 'estudiante:eliminar', 'estudiante:listar', 'estudiante:ver',
    'institucion:actualizar', 'institucion:ver', 'institucion:estadisticas',
    'plantilla:crear', 'plantilla:actualizar', 'plantilla:archivar', 'plantilla:ver', 'plantilla:listar',
    'auditoria:ver',
    'usuario:listar', 'usuario:crear', 'usuario:actualizar', 'usuario:eliminar',
  ],
  editor: [
    'certificado:emitir', 'certificado:revocar', 'certificado:listar', 'certificado:ver', 'certificado:descargar',
    'estudiante:crear', 'estudiante:actualizar', 'estudiante:listar', 'estudiante:ver',
    'institucion:ver', 'institucion:estadisticas',
  ],
  lector: [
    'certificado:listar', 'certificado:ver', 'certificado:descargar',
    'estudiante:listar', 'estudiante:ver',
    'institucion:ver', 'institucion:estadisticas',
  ],
}
