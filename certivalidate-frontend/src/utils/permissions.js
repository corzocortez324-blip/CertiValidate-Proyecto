const normalizeRoleName = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()

export const getRoleName = (user) =>
  normalizeRoleName(
    user?.rol?.nombre ||
      user?.rol ||
      user?.role?.nombre ||
      user?.role ||
      user?.rol_name ||
      '',
  )

export const isAdminUser = (user) => {
  const roleName = getRoleName(user)
  return (
    roleName === 'admin' ||
    roleName === 'administrador' ||
    roleName.includes('admin')
  )
}

const toPermissionList = (value) => {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return [item]
      if (Array.isArray(item?.permisos || item?.permissions)) {
        return (item?.permisos || item?.permissions || []).map(String)
      }
      if (typeof item?.permiso === 'string') return [item.permiso]
      if (typeof item?.nombre === 'string') return [item.nombre]
      return []
    })
  }

  if (typeof value === 'string') return [value]

  if (Array.isArray(value?.permisos || value?.permissions)) {
    return (value?.permisos || value?.permissions || []).map(String)
  }

  return []
}

export const normalizePermissions = (source) => {
  const candidates = [
    source,
    source?.accesos,
    source?.permisos,
    source?.permissions,
    source?.usuario?.accesos,
    source?.usuario?.permisos,
  ]

  return candidates.flatMap((entry) => toPermissionList(entry))
}

export const can = (permission, user, permissions) => {
  if (!permission) return true
  if (isAdminUser(user)) return true

  const permissionList = normalizePermissions(permissions)
  return permissionList.some(
    (entry) => entry.toLowerCase() === String(permission).toLowerCase(),
  )
}

export const canAny = (permissionList, user, permissions) => {
  if (!permissionList || permissionList.length === 0) return true
  return permissionList.some((permission) => can(permission, user, permissions))
}
