/**
 * Integración incremental — pasos de Interfaz Web (apartado 2.4.1). Complementa
 * certivalidate-backend/tests/integracion-doc/incremental.test.js: aquí se ejecutan
 * los pasos P2–P8 (módulos hoja con driver), P1-P2…P1-P8 (P1 con sus hijos),
 * CP-P1 (estructura principal) y SIS-CP (carga de la aplicación).
 * El backend es un stub con contratos JSON grabados del backend real.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { ToastProvider } from '../../components/ui/ToastProvider';
import { ThemeProvider } from '../../context/ThemeContext';
import { LoginPage } from '../../pages/LoginPage';
import { UsuariosPage } from '../../pages/admin/UsuariosPage';
import { CertificadosPage } from '../../pages/admin/CertificadosPage';
import { VerifyCertificate } from '../../pages/VerifyCertificate';
import { AuditoriaPage } from '../../pages/admin/AuditoriaPage';
import { AdminDashboard } from '../../pages/admin/AdminDashboard';
import { contratos, instalarStub, iniciarSesion, renderApp, llamadas, llamo } from './stub';

// jsdom no dibuja canvas: las gráficas se sustituyen por un marcador
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="grafica" />,
  Line: () => <div data-testid="grafica" />,
  Doughnut: () => <div data-testid="grafica" />,
}));

const ESPERA = { timeout: 4000 };
const revocado = contratos.certificados_revocados.data.data[0];

/** Driver de módulo hoja: monta el componente con sus proveedores mínimos. */
const montar = (elemento, ruta = '/') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ThemeProvider><ToastProvider><AuthProvider>{elemento}</AuthProvider></ToastProvider></ThemeProvider>
    </MemoryRouter>,
  );

let errores;
beforeEach(() => {
  localStorage.clear();
  instalarStub();
  errores = vi.spyOn(console, 'error').mockImplementation(() => {});
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:prueba');
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); errores.mockRestore(); });

const sinErroresDeConsola = () =>
  expect(errores.mock.calls.filter(([m]) => !/act\(|not wrapped in act|React Router Future/i.test(String(m)))).toEqual([]);

const PASOS = {
  // ── Módulos hoja de P1 con su driver ──────────────────────────────────────
  P2: async () => {
    const { container } = montar(<LoginPage />, '/login');
    const email = container.querySelector('input[type="email"]');
    const password = container.querySelector('input[type="password"]');
    expect(email.required && password.required).toBe(true);
    fireEvent.click(container.querySelector('button.auth-submit'));
    expect(email.validity.valueMissing && password.validity.valueMissing).toBe(true);
    expect(llamo('POST', /^\/auth\/login$/)).toBe(false);
  },
  P3: async () => {
    iniciarSesion();
    montar(<UsuariosPage />);
    const usuarios = contratos.usuarios.data.usuarios;
    for (const u of usuarios) expect(await screen.findByText(u.email, {}, ESPERA)).toBeInTheDocument();
    const tabla = screen.getByRole('table');
    for (const rol of ['Administrador', 'Emisor', 'Lector']) expect(within(tabla).getAllByText(rol).length).toBeGreaterThan(0);
    expect(within(tabla).getByRole('columnheader', { name: 'Institución' })).toBeInTheDocument();
    const nombreInst = usuarios[0].instituciones[0].institucion.nombre;
    expect(within(tabla).getAllByText(nombreInst).length).toBeGreaterThan(0);
  },
  P4: async () => {
    iniciarSesion();
    const user = userEvent.setup();
    montar(<CertificadosPage />);
    await user.click(await screen.findByRole('button', { name: /Emitir Certificado/ }, ESPERA));
    const inst = contratos.instituciones.data.data[0];
    const est = contratos.estudiantes.data.data[0];
    const plt = contratos.plantillas.data.data[0];
    await user.selectOptions(await screen.findByLabelText(/Institución/, { selector: 'select' }), inst.id);
    // Estudiante: autocompletado que consulta GET /estudiantes?search=…
    await user.type(screen.getByLabelText(/Estudiante/), est.documento);
    const sugerencia = await screen.findByText(`Doc. ${est.documento}`, { exact: false }, ESPERA);
    fireEvent.mouseDown(sugerencia.closest('li'));
    await user.selectOptions(screen.getByLabelText(/Plantilla/, { selector: 'select' }), plt.id);
    expect(screen.getByRole('button', { name: /Previsualizar y emitir/ })).toBeEnabled();
  },
  P5: async () => {
    const user = userEvent.setup();
    montar(<VerifyCertificate />);
    await user.type(screen.getByPlaceholderText(/código único/), 'XXXX-0000');
    await user.click(document.querySelector('button.btn-verify'));
    expect(await screen.findByText('No Encontrado', {}, ESPERA)).toBeInTheDocument();
    sinErroresDeConsola();
  },
  P6: async () => {
    iniciarSesion();
    montar(<CertificadosPage />, '/admin/certificados?estado=revocado');
    expect(await screen.findByText(revocado.codigo_unico, {}, ESPERA)).toBeInTheDocument();
    await waitFor(() => expect(llamadas.some((l) => l.ruta === '/certificados/listar' && l.query.get('estado') === 'revocado')).toBe(true));
    const fila = screen.getByText(revocado.codigo_unico).closest('tr');
    expect(within(fila).getByText(/Revocado/)).toBeInTheDocument();
    expect(within(fila).getByText(/ERROR DATOS/)).toBeInTheDocument(); // motivo
    expect(within(fila).getByText(/·/)).toBeInTheDocument();           // motivo · fecha
  },
  P7: async () => {
    iniciarSesion();
    const user = userEvent.setup();
    montar(<AuditoriaPage />);
    await screen.findByRole('heading', { name: 'Auditoría' }, ESPERA);
    await user.selectOptions(screen.getByLabelText('Acción'), 'REVOCAR_CERTIFICADO');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    await waitFor(() => expect(llamadas.some((l) => l.ruta === '/auditoria' && l.query.get('accion') === 'REVOCAR_CERTIFICADO' && l.query.get('fecha_desde'))).toBe(true), ESPERA);
    await waitFor(() => {
      const filas = screen.getAllByRole('row').slice(1);
      expect(filas.length).toBeGreaterThan(0);
      for (const f of filas) expect(f.textContent).toMatch(/REVOCAR CERTIFICADO/i);
    }, ESPERA);
  },
  P8: async () => {
    iniciarSesion();
    montar(<AdminDashboard />);
    const s = contratos.stats.data;
    expect(await screen.findByText(`${s.tasaValidez}%`, {}, ESPERA)).toBeInTheDocument();
    expect(screen.getAllByText(String(s.totalEmitidos)).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('grafica').length).toBeGreaterThan(0);
  },

  // ── P1 (Interfaz Web) integrada con sus hijos ─────────────────────────────
  'P1-P2': async () => {
    const user = userEvent.setup();
    const { container } = renderApp('/login');
    await user.type(container.querySelector('input[type="email"]'), 'juan@unicesar.edu.co');
    await user.type(container.querySelector('input[type="password"]'), 'Clave1234');
    await user.click(container.querySelector('button.auth-submit'));
    expect(await screen.findByLabelText('Código de verificación', {}, ESPERA)).toBeInTheDocument(); // requires2FA
  },
  'P1-P3': async () => {
    iniciarSesion();
    renderApp('/admin/usuarios');
    expect(await screen.findByRole('heading', { name: 'Usuarios' }, ESPERA)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Roles y Permisos/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Instituciones/ })).toBeInTheDocument();
  },
  'P1-P4': async () => {
    iniciarSesion();
    renderApp('/certificados/emitir');
    expect(await screen.findByRole('button', { name: /Previsualizar y emitir/ }, ESPERA)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/certificados');
  },
  'P1-P5': async () => {
    renderApp('/verificar');
    expect(await screen.findByPlaceholderText(/código único/, {}, ESPERA)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/verificar'); // no pide autenticación
  },
  'P1-P6': async () => {
    iniciarSesion();
    renderApp('/revocaciones');
    expect(await screen.findByText(revocado.codigo_unico, {}, ESPERA)).toBeInTheDocument();
    expect(within(screen.getByText(revocado.codigo_unico).closest('tr')).getByText(/ERROR DATOS/)).toBeInTheDocument();
  },
  'P1-P7': async () => {
    iniciarSesion();
    renderApp('/auditoria');
    expect(await screen.findByRole('heading', { name: 'Auditoría' }, ESPERA)).toBeInTheDocument();
    for (const l of ['Entidad', 'Acción', 'Usuario']) expect(screen.getByLabelText(l).tagName).toBe('SELECT');
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1), ESPERA);
  },
  'P1-P8': async () => {
    iniciarSesion();
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Dashboard' }, ESPERA)).toBeInTheDocument();
    expect(await screen.findByText(`${contratos.stats.data.tasaValidez}%`, {}, ESPERA)).toBeInTheDocument();
    expect(screen.getAllByTestId('grafica').length).toBeGreaterThan(0);
    expect(window.location.pathname).toBe('/admin');
  },

  // ── Estructura principal y sistema ────────────────────────────────────────
  'CP-P1': async () => {
    renderApp('/admin');
    await waitFor(() => expect(window.location.pathname).toBe('/login'), ESPERA); // sin sesión
    cleanup();
    iniciarSesion();
    renderApp('/admin');
    const menu = await screen.findByRole('link', { name: /Auditoría/ }, ESPERA);
    const nav = menu.closest('nav') || document.body;
    const opciones = ['Dashboard', 'Certificados', 'Estudiantes', 'Usuarios', 'Roles y Permisos', 'Plantillas', 'Instituciones', 'Integraciones', 'Auditoría'];
    for (const o of opciones) expect(within(nav).getByRole('link', { name: new RegExp(o) })).toBeInTheDocument();
    expect(screen.getAllByText(/Test User/).length).toBeGreaterThan(0); // usuario en sesión
  },
  'SIS-CP': async () => {
    renderApp('/');
    expect(await screen.findByPlaceholderText(/código único/, {}, ESPERA)).toBeInTheDocument();
    sinErroresDeConsola();
  },
};

const CASOS = {
  'CI-A01': ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
  'CI-A06': ['P1-P2', 'P1-P3', 'P1-P4', 'P1-P5', 'P1-P6', 'P1-P7', 'P1-P8'],
  'CI-A11': ['CP-P1'],
  'CI-A12': ['SIS-CP'],
  'CI-DP1': ['SIS-CP', 'CP-P1', 'P1-P2'],
  'CI-DP2': ['P1-P3', 'P1-P4', 'P1-P5', 'P1-P6', 'P1-P7', 'P1-P8'],
  'CI-DA1': ['SIS-CP'],
  'CI-DA2': ['CP-P1'],
  'CI-DA3': ['P1-P2', 'P1-P3', 'P1-P4', 'P1-P5', 'P1-P6', 'P1-P7', 'P1-P8'],
};

for (const [caso, pasos] of Object.entries(CASOS)) {
  describe(caso, () => {
    for (const paso of pasos) it(`${caso} · ${paso}`, PASOS[paso], 20000);
  });
}
