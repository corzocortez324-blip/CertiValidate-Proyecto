import React, { useState, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2, UserCheck, UserX, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usuariosApi } from '../../api/usuarios.api';
import { rolesApi } from '../../api/roles.api';
import { useListPage } from '../../hooks/useListPage';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Card } from '../../components/ui/Card';
import { UsuarioForm } from '../../forms/UsuarioForm';
import { formatDate } from '../../utils/helpers';
import './UsuariosPage.css';

// Colores para roles conocidos; fallback para el resto
const KNOWN_ROLE_STYLE = {
  admin:  { color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  editor: { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)'  },
  lector: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)' },
};
const FALLBACK_COLORS = ['#8b5cf6','#f59e0b','#10b981','#f472b6','#fb923c','#34d399'];

function getRoleStyle(nombre, idx = 0) {
  if (KNOWN_ROLE_STYLE[nombre]) return KNOWN_ROLE_STYLE[nombre];
  const color = FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  return { color, bg: `${color}26` };
}

function getRoleLabel(nombre, rolesList = []) {
  const found = rolesList.find(r => r.nombre === nombre);
  if (found) {
    if (nombre === 'admin')  return 'Administrador';
    if (nombre === 'editor') return 'Emisor';
    if (nombre === 'lector') return 'Validador';
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }
  return nombre || 'Sin rol';
}

const INITIAL_FORM = { nombre: '', apellido: '', email: '', password: '', rol: 'lector', activo: true };

export const UsuariosPage = () => {
  const { hasPermission } = useAuth();
  const [filterRol, setFilterRol]         = useState('');
  const [filterEstado, setFilterEstado]   = useState('');
  const [toggling, setToggling]           = useState(null);
  const [rolConfirm, setRolConfirm]       = useState(null);
  const [rolesList, setRolesList]         = useState([]);   // roles del backend

  useEffect(() => {
    rolesApi.listar()
      .then(({ roles }) => setRolesList(roles))
      .catch(() => {}); // silencioso — fallback a roles conocidos
  }, []);

  const {
    items: usuarios, loading, listError,
    page, totalPages, setPage,
    search, setSearch,
    showForm, editing, form, setForm, formError,
    openCreate, openEdit, closeForm, handleSubmit, handleRemove,
    load: reload,
  } = useListPage(usuariosApi, {
    initialForm: INITIAL_FORM,
    dataKey: 'usuarios',
    removeConfirmMsg: '¿Eliminar este usuario? Esta acción no se puede deshacer.',
  });

  const handleSubmitWithRoleConfirm = (e) => {
    e.preventDefault();
    if (editing) {
      const original = usuarios.find(u => u.id === editing);
      if (original && original.rol !== form.rol) {
        setRolConfirm({
          prevRol: original.rol,
          newRol: form.rol,
          onConfirm: () => {
            setRolConfirm(null);
            handleSubmit({ preventDefault: () => {} });
          },
        });
        return;
      }
    }
    handleSubmit(e);
  };

  const handleToggleEstado = async (u) => {
    if (toggling) return;
    const nuevoEstado = !u.activo;
    const msg = nuevoEstado ? '¿Activar este usuario?' : '¿Desactivar este usuario?';
    if (!window.confirm(msg)) return;
    setToggling(u.id);
    try {
      await usuariosApi.actualizar(u.id, { activo: nuevoEstado });
      reload();
    } catch (err) {
      alert(err.message || 'Error al cambiar estado');
    } finally {
      setToggling(null);
    }
  };

  const filtered = usuarios.filter(u => {
    if (filterRol && u.rol !== filterRol) return false;
    if (filterEstado === 'true'  && !u.activo)  return false;
    if (filterEstado === 'false' && u.activo)   return false;
    return true;
  });

  return (
    <div className="usuarios-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p className="page-subtitle">Gestión de usuarios institucionales y roles</p>
        </div>
        {hasPermission('usuario:crear') && (
          <button className="btn-nuevo-usuario" onClick={() => openCreate()}>
            <Plus size={16} /> Nuevo Usuario
          </button>
        )}
      </div>

      <div className="usuarios-filters">
        <div className="usuarios-search-wrap">
          <Search size={16} className="search-ico" />
          <input
            type="text"
            className="usuarios-search"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="search-input"
          value={filterRol}
          onChange={e => { setFilterRol(e.target.value); setPage(1); }}
          style={{ minWidth: 140 }}
        >
          <option value="">Todos los roles</option>
          {rolesList.map(r => (
            <option key={r.id} value={r.nombre}>{getRoleLabel(r.nombre, rolesList)}</option>
          ))}
        </select>
        <select
          className="search-input"
          value={filterEstado}
          onChange={e => { setFilterEstado(e.target.value); setPage(1); }}
          style={{ minWidth: 130 }}
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        {!loading && (
          <span className="usuarios-count">{filtered.length} usuario(s)</span>
        )}
      </div>

      {listError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{listError}</div>}

      <Card>
        <div className="usuarios-table-wrap">
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="empty-state">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="empty-state">No se encontraron usuarios.</td></tr>
              ) : filtered.map((u, uIdx) => {
                const style = getRoleStyle(u.rol, uIdx);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="ut-name">{u.nombre} {u.apellido}</div>
                      <div className="ut-email">{u.email}</div>
                    </td>
                    <td>
                      <span className="ut-role-badge" style={{ color: style.color, background: style.bg }}>
                        {getRoleLabel(u.rol, rolesList)}
                      </span>
                    </td>
                    <td>
                      <div className="ut-status">
                        <span className="ut-dot" style={{ background: u.activo ? '#10b981' : '#6b7280' }} />
                        <span style={{ color: u.activo ? '#10b981' : '#6b7280' }}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </td>
                    <td className="ut-date">{u.created_at ? formatDate(u.created_at) : '—'}</td>
                    <td>
                      <div className="ut-actions">
                        {hasPermission('usuario:actualizar') && (
                          <>
                            <button
                              className="icon-btn"
                              title="Editar"
                              onClick={() => openEdit(u, usr => ({ nombre: usr.nombre, apellido: usr.apellido || '', email: usr.email, rol: usr.rol || 'lector', activo: usr.activo }))}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className={`btn-toggle-estado ${u.activo ? 'desactivar' : 'activar'}`}
                              title={u.activo ? 'Desactivar' : 'Activar'}
                              onClick={() => handleToggleEstado(u)}
                              disabled={toggling === u.id}
                            >
                              {u.activo ? <UserX size={13} /> : <UserCheck size={13} />}
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </>
                        )}
                        {hasPermission('usuario:eliminar') && (
                          <button className="icon-btn danger" title="Eliminar" onClick={() => handleRemove(u.id)}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </Card>

      <Modal isOpen={showForm} onClose={closeForm} title={editing ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <UsuarioForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmitWithRoleConfirm}
          onCancel={closeForm}
          editing={!!editing}
          error={formError}
          roles={rolesList}
          isLastAdmin={
            !!editing &&
            form.rol === 'admin' &&
            usuarios.filter(u => u.rol === 'admin' && u.activo).length <= 1
          }
        />
      </Modal>

      {/* Modal de confirmación de cambio de rol */}
      {rolConfirm && (
        <div className="rol-confirm-overlay" onClick={() => setRolConfirm(null)}>
          <div className="rol-confirm-dialog glass-panel animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="rol-confirm-icon">
              <ShieldAlert size={28} style={{ color: '#f59e0b' }} />
            </div>
            <h3 className="rol-confirm-title">Confirmar cambio de rol</h3>
            <p className="rol-confirm-body">
              Estás a punto de cambiar el rol de este usuario de{' '}
              <strong>{getRoleLabel(rolConfirm.prevRol, rolesList)}</strong> a{' '}
              <strong>{getRoleLabel(rolConfirm.newRol, rolesList)}</strong>.
            </p>
            <p className="rol-confirm-warning">
              Este cambio modificará los permisos del usuario de forma inmediata.
              Asegúrate de que el cambio es intencional.
            </p>
            <div className="rol-confirm-actions">
              <button className="btn-secondary" onClick={() => setRolConfirm(null)}>Cancelar</button>
              <button className="btn-primary" onClick={rolConfirm.onConfirm}>Confirmar cambio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
