/**
 * Pruebas de integración basadas en hilos — tramo de interfaz (apartado 2.4.2).
 * Completa los casos cuyo diseño incluye pasos en el navegador:
 *  CI-H14-03 exportación de auditoría a Excel · CI-H16-03 validación de la nueva
 *  contraseña · CI-H22-01/02 exportación del reporte del dashboard (Excel / PDF).
 * La parte de API de esos casos está en certivalidate-backend/tests/integracion-doc.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { AuthProvider } from '../../context/AuthContext';
import { ToastProvider } from '../../components/ui/ToastProvider';
import { ThemeProvider } from '../../context/ThemeContext';
import { AuditoriaPage } from '../../pages/admin/AuditoriaPage';
import { PerfilPage } from '../../pages/admin/PerfilPage';
import { AdminDashboard } from '../../pages/admin/AdminDashboard';
import { contratos, instalarStub, iniciarSesion, llamadas } from './stub';

vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="grafica" />,
  Line: () => <div data-testid="grafica" />,
  Doughnut: () => <div data-testid="grafica" />,
}));
vi.mock('xlsx', async () => {
  const real = await vi.importActual('xlsx');
  return { ...real, writeFile: vi.fn() };
});

const ESPERA = { timeout: 6000 };
const montar = (elemento) =>
  render(
    <MemoryRouter>
      <ThemeProvider><ToastProvider><AuthProvider>{elemento}</AuthProvider></ToastProvider></ThemeProvider>
    </MemoryRouter>,
  );

let descargas;
beforeEach(() => {
  localStorage.clear();
  instalarStub();
  iniciarSesion();
  descargas = [];
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:prueba');
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { descargas.push(this.download); });
  vi.mocked(XLSX.writeFile).mockClear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('H14 Log de auditoría', () => {
  it('CI-H14-03 Exportar auditoría a Excel (8 columnas, todos los registros)', async () => {
    const user = userEvent.setup();
    montar(<AuditoriaPage />);
    await screen.findByRole('heading', { name: 'Auditoría' }, ESPERA);
    await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1), ESPERA);
    await user.click(screen.getByTitle('Exportar registros'));
    await user.click(await screen.findByRole('button', { name: /Descargar \.XLSX/ }));
    await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalled(), ESPERA);
    const [libro, nombre] = vi.mocked(XLSX.writeFile).mock.calls[0];
    expect(nombre).toMatch(/^auditoria-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.xlsx$/);
    const filas = XLSX.utils.sheet_to_json(libro.Sheets.Datos, { header: 1 });
    expect(filas[0]).toEqual(['Fecha', 'Usuario', 'Email', 'Institución', 'Acción', 'Entidad', 'ID Entidad', 'IP']);
    expect(filas.length - 1).toBe(contratos.auditoria.data.data.length);
  });
});

describe('H16 Cambio de contraseña', () => {
  it('CI-H16-03 El formulario bloquea contraseñas de menos de 8 caracteres (valores límite)', async () => {
    const user = userEvent.setup();
    montar(<PerfilPage />);
    const actual = await screen.findByLabelText(/Contraseña Actual/, {}, ESPERA);
    const nueva = screen.getByLabelText(/^Nueva Contraseña/);
    const confirmar = screen.getByLabelText(/Confirmar Nueva Contraseña/);
    const enviar = screen.getByRole('button', { name: /Cambiar contraseña/i });
    await user.type(actual, 'Clave1234');

    for (const corta of ['Ab1', 'Abcdef1']) { // 3 y 7 caracteres
      await user.clear(nueva); await user.type(nueva, corta);
      await user.clear(confirmar); await user.type(confirmar, corta);
      expect(enviar).toBeDisabled();
    }
    await user.clear(nueva); await user.type(nueva, 'Abcdefg1'); // 8 caracteres
    await user.clear(confirmar); await user.type(confirmar, 'Abcdefg1');
    expect(enviar).toBeEnabled();
    await user.click(enviar);
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT' && l.ruta === '/auth/perfil/password' && l.cuerpo?.newPassword === 'Abcdefg1')).toBe(true), ESPERA);
  });
});

describe('H22 Exportación del reporte del dashboard', () => {
  const abrirModal = async (user) => {
    montar(<AdminDashboard />);
    await screen.findByText(`${contratos.stats.data.tasaValidez}%`, {}, ESPERA);
    await user.click(screen.getByRole('button', { name: /Exportar Reporte/ }));
    return screen.getByRole('dialog', { name: 'Exportar reporte' });
  };

  it('CI-H22-01 Reporte ejecutivo en Excel con el período elegido', async () => {
    const user = userEvent.setup();
    const modal = await abrirModal(user);
    await user.click(screen.getByText('Ejecutivo'));
    await user.click(screen.getByText('Excel (.xlsx)'));
    await user.click(modal.querySelector('.period-tabs button:nth-child(3)')); // 90d
    await user.click(screen.getByRole('button', { name: /Generar y Descargar/ }));
    await waitFor(() => expect(descargas.length).toBe(1), ESPERA);
    expect(descargas[0]).toMatch(/^reporte-ejecutivo-90d-.*\.xlsx$/);
    // Los datos del reporte corresponden al período elegido en el modal
    expect(llamadas.some((l) => l.ruta === '/admin/stats' && l.query.get('period') === '90d')).toBe(true);
  }, 20000);

  it('CI-H22-02 Reporte completo en PDF', async () => {
    const user = userEvent.setup();
    let html = '';
    const ventana = { document: { write: (h) => { html += h; }, close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(ventana);
    await abrirModal(user);
    await user.click(screen.getByText('Completo'));
    await user.click(screen.getByText('PDF (.pdf)'));
    await user.click(screen.getByRole('button', { name: /Generar y Descargar/ }));
    await waitFor(() => expect(ventana.print).toHaveBeenCalled(), ESPERA);
    expect(html).toMatch(/Reporte Completo/i);
    expect(html).toMatch(/Tasa de validez/);
    expect(html).toContain(`${contratos.stats.data.tasaValidez}%`);
    expect(html).toMatch(/<table/);
  }, 20000);
});
