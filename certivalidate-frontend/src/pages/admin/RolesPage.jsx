import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Pencil, Eye, Users, Building2, FileBadge,
  GraduationCap, FileText, ScrollText, Check, X, Info,
  Shield, Save, RotateCcw, Loader2,
} from 'lucide-react';
import { rolesApi } from '../../api/roles.api';
import { useAuth } from '../../context/AuthContext';
import './RolesPage.css';

// ── Metadatos estáticos de roles ─────────────────────────────────────────────
const ROLE_META = {
  admin: {
    label: 'Administrador', color: '#6366f1', bg: 'rgba(99,102,241,0.12)',
    icon: ShieldAlert,
    desc: 'Acceso total al sistema. Gestiona usuarios, instituciones y configuración.',
  },
  editor: {
    label: 'Emisor', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',
    icon: Pencil,
    desc: 'Emite y revoca certificados. Gestiona estudiantes y consulta plantillas.',
  },
  lector: {
    label: 'Validador', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',
    icon: Eye,
    desc: 'Solo lectura. Consulta certificados, estudiantes e información institucional.',
  },
};

// ── Agrupación y etiquetas de permisos ───────────────────────────────────────
const GROUP_META = {
  usuario:      { name: 'Usuarios',      icon: Users,          color: '#6366f1' },
  institucion:  { name: 'Instituciones', icon: Building2,      color: '#f59e0b' },
  certificado:  { name: 'Certificados',  icon: FileBadge,      color: '#10b981' },
  estudiante:   { name: 'Estudiantes',   icon: GraduationCap,  color: '#8b5cf6' },
  plantilla:    { name: 'Plantillas',    icon: FileText,       color: '#f472b6' },
  auditoria:    { name: 'Auditoría',     icon: ScrollText,     color: '#fb923c' },
};

const PERM_LABEL = {
  'usuario:listar':          'Ver lista de usuarios',
  'usuario:crear':           'Crear usuarios',
  'usuario:actualizar':      'Editar usuarios',
  'usuario:eliminar':        'Eliminar usuarios',
  'institucion:ver':         'Ver institución',
  'institucion:estadisticas':'Ver estadísticas',
  'institucion:actualizar':  'Editar institución',
  'certificado:listar':      'Ver lista de certificados',
  'certificado:ver':         'Ver detalle del certificado',
  'certificado:descargar':   'Descargar PDF',
  'certificado:emitir':      'Emitir certificados',
  'certificado:revocar':     'Revocar certificados',
  'estudiante:listar':       'Ver lista de estudiantes',
  'estudiante:ver':          'Ver detalle del estudiante',
  'estudiante:crear':        'Crear estudiantes',
  'estudiante:actualizar':   'Editar estudiantes',
  'estudiante:eliminar':     'Eliminar estudiantes',
  'plantilla:listar':        'Ver lista de plantillas',
  'plantilla:ver':           'Ver detalle de plantilla',
  'plantilla:crear':         'Crear plantillas',
  'plantilla:actualizar':    'Editar plantillas',
  'plantilla:archivar':      'Archivar plantillas',
  'auditoria:ver':           'Ver registros de auditoría',
};

// Orden preferido de acciones dentro de cada recurso
const ACCION_ORDEN = ['listar', 'ver', 'estadisticas', 'descargar', 'crear', 'actualizar', 'archivar', 'emitir', 'revocar', 'eliminar'];
const RECURSO_ORDEN = ['usuario', 'institucion', 'certificado', 'estudiante', 'plantilla', 'auditoria'];

function groupPermisos(permisos) {
  const map = {};
  permisos.forEach(p => {
    if (!map[p.recurso]) map[p.recurso] = [];
    map[p.recurso].push(p);
  });
  Object.values(map).forEach(arr =>
    arr.sort((a, b) => ACCION_ORDEN.indexOf(a.accion) - ACCION_ORDEN.indexOf(b.accion))
  );
  // Recursos conocidos primero, luego los desconocidos (nuevos roles pueden tener permisos extra)
  const conocidos  = RECURSO_ORDEN.filter(r => map[r]).map(r => ({ recurso: r, permisos: map[r] }));
  const desconocidos = Object.keys(map)
    .filter(r => !RECURSO_ORDEN.includes(r))
    .sort()
    .map(r => ({ recurso: r, permisos: map[r] }));
  return [...conocidos, ...desconocidos];
}

// ── Componente ───────────────────────────────────────────────────────────────
export const RolesPage = () => {
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission('usuario:actualizar');

  const [roles, setRoles]           = useState([]);      // roles del backend
  const [permisos, setPermisos]     = useState([]);      // todos los permisos disponibles
  const [pending, setPending]       = useState({});      // { rolId: Set<permisoId> }
  const [dirty, setDirty]           = useState({});      // { rolId: bool }
  const [saving, setSaving]         = useState({});      // { rolId: bool }
  const [saveMsg, setSaveMsg]       = useState({});      // { rolId: { ok, text } }
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState('');
  const [hoveredRole, setHoveredRole] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { roles: r, permisos: p } = await rolesApi.listar();
      setRoles(r);
      setPermisos(p);
      // Inicializar pending con el estado actual de la BD
      const init = {};
      r.forEach(rol => { init[rol.id] = new Set(rol.permisos.map(p => String(p.id))); });
      setPending(init);
      setDirty({});
    } catch (err) {
      setLoadError(err.message || 'Error al cargar roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (rolId, permisoId) => {
    if (!canEdit) return;
    setPending(prev => {
      const next = new Set(prev[rolId] || []);
      const key = String(permisoId);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, [rolId]: next };
    });
    setDirty(prev => ({ ...prev, [rolId]: true }));
    setSaveMsg(prev => ({ ...prev, [rolId]: null }));
  };

  const reset = (rolId) => {
    const original = roles.find(r => r.id === rolId);
    if (!original) return;
    setPending(prev => ({ ...prev, [rolId]: new Set(original.permisos.map(p => String(p.id))) }));
    setDirty(prev => ({ ...prev, [rolId]: false }));
    setSaveMsg(prev => ({ ...prev, [rolId]: null }));
  };

  const save = async (rolId) => {
    setSaving(prev => ({ ...prev, [rolId]: true }));
    setSaveMsg(prev => ({ ...prev, [rolId]: null }));
    try {
      // Los IDs se normalizan a String internamente; el backend acepta ambos tipos
      const permisoIds = Array.from(pending[rolId] || []);
      await rolesApi.actualizarPermisos(rolId, permisoIds);
      // Actualizar estado local de "original"
      setRoles(prev => prev.map(r =>
        r.id !== rolId ? r : {
          ...r,
          permisos: permisos.filter(p => permisoIds.includes(p.id)),
        }
      ));
      setDirty(prev => ({ ...prev, [rolId]: false }));
      setSaveMsg(prev => ({ ...prev, [rolId]: { ok: true, text: 'Cambios guardados' } }));
    } catch (err) {
      setSaveMsg(prev => ({ ...prev, [rolId]: { ok: false, text: err.message || 'Error al guardar' } }));
    } finally {
      setSaving(prev => ({ ...prev, [rolId]: false }));
    }
  };

  const groups = groupPermisos(permisos);

  // Roles ordenados por prioridad
  const PRIO = { admin: 0, editor: 1, lector: 2 };
  const rolesSorted = [...roles].sort((a, b) => (PRIO[a.nombre] ?? 99) - (PRIO[b.nombre] ?? 99));

  return (
    <div className="roles-page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Roles y Permisos</h1>
          <p className="page-subtitle">Configura los permisos por rol del sistema</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="roles-info-banner">
        <Info size={15} className="roles-info-icon" />
        <span>
          Los cambios se aplican inmediatamente en el servidor y afectan a todos los usuarios con ese rol.
          Tu rol actual es <strong>{ROLE_META[user?.rol]?.label || user?.rol}</strong>.
          {!canEdit && ' Solo los administradores pueden modificar permisos.'}
        </span>
      </div>

      {loadError && (
        <div className="alert alert-error">{loadError}</div>
      )}

      {loading ? (
        <div className="roles-loading">
          <Loader2 size={22} className="spin" />
          <span>Cargando roles y permisos…</span>
        </div>
      ) : (
        <>
          {/* Role summary cards */}
          <div className="roles-cards">
            {rolesSorted.map(rol => {
              const meta = ROLE_META[rol.nombre] || { label: rol.nombre, color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: Shield, desc: '' };
              const Icon = meta.icon;
              const total = (pending[rol.id]?.size) ?? rol.permisos.length;
              const isDirty = dirty[rol.id];
              return (
                <div
                  key={rol.id}
                  className={`role-summary-card glass-panel ${hoveredRole === rol.id ? 'role-card--highlight' : ''}`}
                  style={{ '--role-color': meta.color, '--role-bg': meta.bg }}
                  onMouseEnter={() => setHoveredRole(rol.id)}
                  onMouseLeave={() => setHoveredRole(null)}
                >
                  <div className="role-card-header">
                    <div className="role-card-icon-wrap" style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}>
                      <Icon size={18} style={{ color: meta.color }} />
                    </div>
                    <div>
                      <p className="role-card-label" style={{ color: meta.color }}>{meta.label}</p>
                      <p className="role-card-count">
                        {total} permiso{total !== 1 ? 's' : ''}
                        {isDirty && <span className="role-card-dirty"> · sin guardar</span>}
                      </p>
                    </div>
                  </div>
                  <p className="role-card-desc">{meta.desc || rol.descripcion || ''}</p>
                </div>
              );
            })}
          </div>

          {/* Permissions matrix */}
          <div className="roles-matrix-wrap glass-panel">
            <div className="roles-matrix-scroll">
              <table className="roles-matrix">
                <thead>
                  <tr>
                    <th className="matrix-th-perm">
                      <div className="matrix-th-perm-inner">
                        <Shield size={14} />
                        Permisos
                      </div>
                    </th>
                    {rolesSorted.map(rol => {
                      const meta = ROLE_META[rol.nombre] || { label: rol.nombre, color: '#6b7280', icon: Shield };
                      const Icon = meta.icon;
                      const isDirty = dirty[rol.id];
                      return (
                        <th
                          key={rol.id}
                          className={`matrix-th-role ${hoveredRole === rol.id ? 'matrix-th-role--active' : ''}`}
                          style={{ '--role-color': meta.color }}
                          onMouseEnter={() => setHoveredRole(rol.id)}
                          onMouseLeave={() => setHoveredRole(null)}
                        >
                          <div className="matrix-th-role-inner">
                            <Icon size={14} style={{ color: meta.color }} />
                            <span style={{ color: meta.color }}>{meta.label}</span>
                            {isDirty && <span className="matrix-dirty-dot" title="Cambios pendientes" />}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(group => {
                    const gm = GROUP_META[group.recurso] || { name: group.recurso, icon: Shield, color: '#6b7280' };
                    const GroupIcon = gm.icon;
                    return (
                      <React.Fragment key={group.recurso}>
                        <tr className="matrix-group-row">
                          <td colSpan={rolesSorted.length + 1}>
                            <div className="matrix-group-label">
                              <span className="matrix-group-dot" style={{ background: gm.color }} />
                              <GroupIcon size={13} style={{ color: gm.color }} />
                              {gm.name}
                            </div>
                          </td>
                        </tr>
                        {group.permisos.map((perm, idx) => (
                          <tr key={perm.id} className={`matrix-perm-row ${idx % 2 === 1 ? 'matrix-perm-row--alt' : ''}`}>
                            <td className="matrix-perm-label">
                              {PERM_LABEL[perm.clave] || perm.clave}
                            </td>
                            {rolesSorted.map(rol => {
                              const meta = ROLE_META[rol.nombre] || { color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
                              const granted = pending[rol.id]?.has(String(perm.id)) ?? false;
                              return (
                                <td
                                  key={rol.id}
                                  className={`matrix-perm-cell ${hoveredRole === rol.id ? 'matrix-perm-cell--highlight' : ''}`}
                                >
                                  <button
                                    type="button"
                                    className={`perm-checkbox ${granted ? 'perm-checkbox--on' : 'perm-checkbox--off'} ${canEdit ? 'perm-checkbox--clickable' : ''}`}
                                    style={granted ? { '--role-color': meta.color, '--role-bg': meta.bg } : {}}
                                    onClick={() => toggle(rol.id, perm.id)}
                                    disabled={!canEdit}
                                    title={
                                      !canEdit ? 'Sin permiso para editar' :
                                      granted ? `Quitar permiso a ${meta.label || rol.nombre}` :
                                               `Dar permiso a ${meta.label || rol.nombre}`
                                    }
                                  >
                                    {granted ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={2.5} />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save bar per role */}
            {canEdit && (
              <div className="roles-save-bar">
                {rolesSorted.map(rol => {
                  const meta = ROLE_META[rol.nombre] || { label: rol.nombre, color: '#6b7280' };
                  const isDirty = dirty[rol.id];
                  const isSaving = saving[rol.id];
                  const msg = saveMsg[rol.id];
                  if (!isDirty && !msg) return null;
                  return (
                    <div key={rol.id} className="roles-save-row">
                      <span className="roles-save-rol" style={{ color: meta.color }}>{meta.label}</span>
                      {msg && (
                        <span className={`roles-save-msg ${msg.ok ? 'roles-save-msg--ok' : 'roles-save-msg--err'}`}>
                          {msg.ok ? <Check size={12} /> : <X size={12} />}
                          {msg.text}
                        </span>
                      )}
                      {isDirty && (
                        <>
                          <button className="btn-ghost-sm" onClick={() => reset(rol.id)} disabled={isSaving}>
                            <RotateCcw size={13} /> Descartar
                          </button>
                          <button
                            className="btn-primary-sm"
                            onClick={() => save(rol.id)}
                            disabled={isSaving}
                            style={{ '--role-color': meta.color }}
                          >
                            {isSaving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
                            {isSaving ? 'Guardando…' : 'Guardar cambios'}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="roles-legend">
            <div className="legend-item">
              <div className="perm-checkbox perm-checkbox--on" style={{ '--role-color': '#10b981', '--role-bg': 'rgba(16,185,129,0.12)' }}>
                <Check size={11} strokeWidth={3} />
              </div>
              <span>Permiso concedido</span>
            </div>
            <div className="legend-item">
              <div className="perm-checkbox perm-checkbox--off">
                <X size={11} strokeWidth={2.5} />
              </div>
              <span>Sin permiso</span>
            </div>
            {canEdit && (
              <div className="legend-item">
                <span className="legend-hint">Haz clic en cualquier checkbox para modificar</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
