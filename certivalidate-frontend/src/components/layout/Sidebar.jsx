import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileBadge, Users, Building2, FileText,
  ScrollText, ShieldCheck, LogOut, ChevronLeft, ChevronRight, User, UserCheck, ShieldAlert, Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const allNavItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true, permission: null },
  { path: '/admin/certificados', icon: FileBadge, label: 'Certificados', permission: 'certificado:listar' },
  { path: '/admin/estudiantes', icon: Users, label: 'Estudiantes', permission: 'estudiante:listar' },
  { path: '/admin/usuarios', icon: UserCheck, label: 'Usuarios', permission: 'usuario:listar' },
  { path: '/admin/roles', icon: ShieldAlert, label: 'Roles y Permisos', permission: 'usuario:listar' },
  { path: '/admin/plantillas', icon: FileText, label: 'Plantillas', permission: 'plantilla:listar' },
  { path: '/admin/instituciones', icon: Building2, label: 'Instituciones', permission: 'institucion:ver' },
  { path: '/admin/integraciones', icon: Zap, label: 'Integraciones', permission: 'institucion:ver' },
  { path: '/admin/auditoria', icon: ScrollText, label: 'Auditoría', permission: 'auditoria:ver' },
];

const ROLE_META = {
  admin:     { label: 'Administrador', color: '#00f0ff' },
  editor:    { label: 'Emisor',        color: '#b026ff' },
  lector:    { label: 'Lector',        color: '#38bdf8' },
  viewer:    { label: 'Viewer',        color: '#34d399' },
  emisor:    { label: 'Emisor',        color: '#f59e0b' },
  docente:   { label: 'Docente',       color: '#fb923c' },
  validador: { label: 'Validador',     color: '#a78bfa' },
};

const ROLE_FALLBACK = { label: 'Usuario', color: '#94a3b8' };

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasPermission } = useAuth();

  const navItems = allNavItems.filter(item => !item.permission || hasPermission(item.permission));
  const meta = ROLE_META[user?.rol] || ROLE_FALLBACK;
  const initials = `${user?.nombre?.charAt(0) || ''}${user?.apellido?.charAt(0) || ''}`.toUpperCase();

  return (
    <aside className={`sidebar glass-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-brand">
            <ShieldCheck size={24} className="brand-icon" />
            <span>CertiValidate</span>
          </div>
        )}
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expandir' : 'Colapsar'}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ path, icon: Icon, label, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title={label}
          >
            <Icon size={20} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className={`sidebar-user-block ${collapsed ? 'collapsed' : ''}`}>
            <div
              className="user-avatar"
              style={{ borderColor: meta.color, background: `${meta.color}15`, color: meta.color }}
              title={`${user.nombre} ${user.apellido} — ${meta.label}`}
            >
              {initials || <User size={18} />}
            </div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <p className="user-name">{user.nombre} {user.apellido}</p>
                <p className="user-role" style={{ color: meta.color }}>{meta.label}</p>
              </div>
            )}
          </div>
        )}
        <NavLink to="/admin/perfil" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Mi Perfil">
          <User size={20} />
          {!collapsed && <span>Mi Perfil</span>}
        </NavLink>
        <button className="sidebar-link logout-btn" onClick={logout} title="Cerrar sesión">
          <LogOut size={20} />
          {!collapsed && <span>Salir</span>}
        </button>
      </div>
    </aside>
  );
};
