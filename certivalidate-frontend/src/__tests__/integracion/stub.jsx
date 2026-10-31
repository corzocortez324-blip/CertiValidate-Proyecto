/**
 * Stub HTTP del backend para las pruebas de integración de la interfaz (apartado 2.4):
 * responde con contratos JSON grabados del backend real (contratos.json, generado por
 * certivalidate-backend/tests/integracion-doc/grabar-contratos.js) y registra cada llamada.
 */
import React from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import App from '../../App';
import { ToastProvider } from '../../components/ui/ToastProvider';
import { ThemeProvider } from '../../context/ThemeContext';
import contratos from './contratos.json';

export { contratos };
export const llamadas = [];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Rutas del backend → respuesta. `rol` elige el perfil de sesión simulado. */
const responder = (metodo, ruta, query, cuerpo, { rol, login }) => {
  const r = (m, re) => metodo === m && re.test(ruta);
  if (r('GET', /^\/auth\/perfil$/)) return rol === 'lector' ? contratos.perfil_lector : contratos.perfil_admin;
  if (r('GET', /^\/auth\/permisos$/)) return rol === 'lector' ? contratos.permisos_lector : contratos.permisos_admin;
  if (r('POST', /^\/auth\/login$/)) return login || contratos.login_2fa;
  if (r('GET', /^\/usuarios/)) return contratos.usuarios;
  if (r('GET', /^\/admin\/roles/)) return contratos.roles;
  if (r('GET', /^\/admin\/stats/)) return contratos.stats;
  if (r('GET', /^\/instituciones/)) return contratos.instituciones;
  if (r('GET', /^\/certificados\/listar/)) return query.get('estado') === 'revocado' ? contratos.certificados_revocados : contratos.certificados;
  if (r('GET', /^\/estudiantes/)) return contratos.estudiantes;
  if (r('GET', /^\/plantillas/)) return contratos.plantillas;
  if (r('GET', /^\/auditoria/)) {
    const base = contratos.auditoria;
    const accion = query.get('accion');
    if (!accion) return base;
    const data = base.data.data.filter((a) => a.accion === accion);
    return { ...base, data: { data, meta: { ...base.data.meta, total: data.length, totalPages: 1 } } };
  }
  if (r('POST', /^\/certificados\/[^/]+\/email$/)) return cuerpo?.pdf_base64 ? contratos.email_enviado : null;
  if (r('GET', /^\/certificados\/[0-9a-f-]{36}$/)) return contratos.certificado_detalle;
  if (r('POST', /^\/certificados\/verificar$/)) {
    return cuerpo?.codigo === contratos.verificar_valido.data.codigo_unico ? contratos.verificar_valido : contratos.verificar_no_encontrado;
  }
  return null;
};

export const instalarStub = (opciones = {}) => {
  llamadas.length = 0;
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = new URL(String(url), 'http://localhost');
    const ruta = u.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
    const metodo = (init.method || 'GET').toUpperCase();
    let cuerpo = null;
    try { cuerpo = init.body ? JSON.parse(init.body) : null; } catch { cuerpo = init.body; }
    llamadas.push({ metodo, ruta, query: u.searchParams, cuerpo });
    const res = responder(metodo, ruta, u.searchParams, cuerpo, opciones);
    return res ? json(res, res.statusCode || 200) : json({ success: false, statusCode: 404, message: 'Ruta no simulada' }, 404);
  });
};

/** Deja una sesión iniciada (como si el usuario ya hubiera hecho login). */
export const iniciarSesion = (rol = 'admin') => {
  const perfil = (rol === 'lector' ? contratos.perfil_lector : contratos.perfil_admin).data;
  localStorage.setItem('token', rol === 'lector' ? 'TOKEN_LECTOR' : 'TOKEN_ADMIN');
  localStorage.setItem('refreshToken', 'REFRESH');
  localStorage.setItem('user', JSON.stringify(perfil));
  localStorage.setItem('accesos', JSON.stringify(perfil.accesos));
};

/** Monta la aplicación completa (App) en la ruta indicada, con los proveedores de main.jsx. */
export const renderApp = (ruta = '/') => {
  window.history.pushState({}, '', ruta);
  return render(<ThemeProvider><ToastProvider><App /></ToastProvider></ThemeProvider>);
};

export const llamo = (metodo, re) => llamadas.some((l) => l.metodo === metodo && re.test(l.ruta));
