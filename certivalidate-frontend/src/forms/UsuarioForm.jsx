import React, { useState } from 'react';
import { ShieldAlert, Pencil, Eye, Shield, Info } from 'lucide-react';

// Metadatos visuales para roles conocidos; fallback genérico para el resto
const KNOWN_ROLE_META = {
  admin:  { label: 'Administrador', color: '#6366f1', icon: ShieldAlert },
  editor: { label: 'Emisor',        color: '#06b6d4', icon: Pencil },
  lector: { label: 'Validador',     color: '#0ea5e9', icon: Eye },
};

// Paleta de colores para roles desconocidos
const FALLBACK_COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#f472b6', '#fb923c', '#34d399'];

function getRoleMeta(nombre, idx = 0) {
  if (KNOWN_ROLE_META[nombre]) return KNOWN_ROLE_META[nombre];
  return {
    label: nombre.charAt(0).toUpperCase() + nombre.slice(1),
    color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
    icon: Shield,
  };
}

// Etiquetas legibles de permisos
const PERM_LABEL = {
  'usuario:listar': 'Ver lista de usuarios', 'usuario:crear': 'Crear usuarios',
  'usuario:actualizar': 'Editar usuarios', 'usuario:eliminar': 'Eliminar usuarios',
  'institucion:ver': 'Ver institución', 'institucion:estadisticas': 'Ver estadísticas',
  'institucion:actualizar': 'Editar institución',
  'certificado:listar': 'Ver certificados', 'certificado:ver': 'Ver detalle',
  'certificado:descargar': 'Descargar PDF', 'certificado:emitir': 'Emitir certificados',
  'certificado:revocar': 'Revocar certificados',
  'estudiante:listar': 'Ver estudiantes', 'estudiante:ver': 'Ver detalle',
  'estudiante:crear': 'Crear estudiantes', 'estudiante:actualizar': 'Editar estudiantes',
  'estudiante:eliminar': 'Eliminar estudiantes',
  'plantilla:listar': 'Ver plantillas', 'plantilla:ver': 'Ver detalle',
  'plantilla:crear': 'Crear plantillas', 'plantilla:actualizar': 'Editar plantillas',
  'plantilla:archivar': 'Archivar plantillas',
  'auditoria:ver': 'Ver auditoría',
};

function RoleTooltip({ permisos, color }) {
  if (!permisos || permisos.length === 0) {
    return (
      <div className="role-tooltip">
        <p className="role-tooltip-title">Sin permisos asignados</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
          Este rol no tiene permisos configurados.
        </p>
      </div>
    );
  }
  return (
    <div className="role-tooltip">
      <p className="role-tooltip-title">Permisos incluidos ({permisos.length})</p>
      <ul className="role-tooltip-list">
        {permisos.slice(0, 8).map(p => (
          <li key={p.clave || p}>
            <span className="role-tooltip-dot" style={{ background: color }} />
            {PERM_LABEL[p.clave || p] || p.clave || p}
          </li>
        ))}
        {permisos.length > 8 && (
          <li style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
            +{permisos.length - 8} más…
          </li>
        )}
      </ul>
    </div>
  );
}

export const UsuarioForm = ({
  form, setForm, onSubmit, onCancel, editing, error,
  isLastAdmin = false,
  roles = [],        // [{ id, nombre, descripcion, permisos: [{clave}] }] desde el backend
}) => {
  const [tooltip, setTooltip] = useState(null);
  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  const passwordValida = editing || (form.password?.trim().length >= 8);
  const canSubmit = form.nombre?.trim() && form.email?.trim() && passwordValida;

  // Si no llegaron roles del backend, mostrar sólo los 3 conocidos como fallback
  const roleList = roles.length > 0 ? roles : [
    { id: 'admin',  nombre: 'admin',  descripcion: 'Acceso total al sistema.', permisos: [] },
    { id: 'editor', nombre: 'editor', descripcion: 'Emite y revoca certificados.', permisos: [] },
    { id: 'lector', nombre: 'lector', descripcion: 'Solo lectura y verificación.', permisos: [] },
  ];

  return (
    <form className="form-col" onSubmit={onSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label">Nombre <span className="req">*</span></label>
          <input type="text" className="form-input" value={form.nombre} onChange={set('nombre')} placeholder="Nombre" required maxLength={80} />
        </div>
        <div className="form-group">
          <label className="form-label">Apellido</label>
          <input type="text" className="form-input" value={form.apellido} onChange={set('apellido')} placeholder="Apellido" maxLength={80} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Correo electrónico <span className="req">*</span></label>
        <input type="email" className="form-input" value={form.email} onChange={set('email')} placeholder="usuario@institución.edu.co" required maxLength={150} />
      </div>

      {!editing && (
        <div className="form-group">
          <label className="form-label">Contraseña <span className="req">*</span></label>
          <input
            type="password" className="form-input" value={form.password || ''} onChange={set('password')}
            placeholder="Mínimo 8 caracteres" required minLength={8} maxLength={128}
          />
          {form.password?.length > 0 && form.password.length < 8 && (
            <p className="form-hint error">La contraseña debe tener al menos 8 caracteres</p>
          )}
        </div>
      )}

      {/* ── Sección de roles dinámica ──────────────────────────── */}
      <div className="form-group">
        <label className="form-label">Rol <span className="req">*</span></label>
        <p className="form-hint" style={{ marginBottom: '0.6rem' }}>
          Selecciona el rol que tendrá este usuario en el sistema.
          Pasa el cursor sobre <Info size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> para ver los permisos de cada rol.
        </p>

        {isLastAdmin && (
          <div className="alert alert-warning" style={{ marginBottom: '0.75rem', fontSize: '0.82rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: '0.1rem', color: '#f59e0b' }} />
            <span>Este es el único administrador activo. No se puede cambiar su rol.</span>
          </div>
        )}

        <div className="role-checkbox-list">
          {roleList.map((r, idx) => {
            const meta = getRoleMeta(r.nombre, idx);
            const Icon = meta.icon;
            const checked = form.rol === r.nombre;
            const disabled = isLastAdmin && r.nombre !== 'admin';

            return (
              <label
                key={r.id || r.nombre}
                className={`role-checkbox-row${checked ? ' role-checkbox-row--checked' : ''}${disabled ? ' role-checkbox-row--disabled' : ''}`}
                style={checked ? { borderColor: `${meta.color}60`, background: `${meta.color}0d` } : {}}
              >
                <input
                  type="radio"
                  name="rol"
                  value={r.nombre}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => !disabled && setForm(f => ({ ...f, rol: r.nombre }))}
                  className="role-radio-input"
                />
                <span className="role-checkbox-indicator" style={checked ? { borderColor: meta.color, background: meta.color } : {}}>
                  {checked && <span className="role-checkbox-dot" />}
                </span>
                <Icon size={15} style={{ color: checked ? meta.color : 'var(--color-text-muted)', flexShrink: 0 }} />
                <div className="role-checkbox-meta">
                  <span className="role-checkbox-label" style={{ color: checked ? meta.color : 'var(--color-text-main)' }}>
                    {meta.label}
                  </span>
                  <span className="role-checkbox-desc">
                    {r.descripcion || ''}
                    {r.permisos?.length >= 0 && (
                      <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>
                        · {r.permisos.length} permiso{r.permisos.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                </div>
                <div
                  className="role-info-wrap"
                  onMouseEnter={() => setTooltip(r.nombre)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <Info size={13} className="role-info-icon" />
                  {tooltip === r.nombre && <RoleTooltip permisos={r.permisos} color={meta.color} />}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Estado</label>
        <label className="toggle-label">
          <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
          <span>{form.activo ? 'Activo' : 'Inactivo'}</span>
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={!canSubmit}>
          {editing ? 'Guardar Cambios' : 'Crear Usuario'}
        </button>
      </div>
    </form>
  );
};
