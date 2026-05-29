export const AUDIT_ACTION_COLOR = {
  CREAR:      'success',
  EMITIR:     'success',
  REVOCAR:    'error',
  ELIMINAR:   'error',
  ACTUALIZAR: 'warning',
  CAMBIAR:    'warning',
}

export const getActionColor = (accion) => {
  if (!accion) return 'primary'
  for (const [key, color] of Object.entries(AUDIT_ACTION_COLOR)) {
    if (accion.includes(key)) return color
  }
  return 'primary'
}

export const getActionColorHex = (accion) => {
  if (!accion) return '#6b7280'
  if (accion.includes('CREAR') || accion.includes('EMITIR'))     return '#10b981'
  if (accion.includes('REVOCAR') || accion.includes('ELIMINAR')) return '#ef4444'
  if (accion.includes('ACTUALIZAR') || accion.includes('CAMBIAR')) return '#f59e0b'
  return '#6366f1'
}

export const formatAccion = (accion) => accion?.replace(/_/g, ' ') ?? ''
