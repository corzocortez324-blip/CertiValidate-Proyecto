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
import ExcelJS from 'exceljs';
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
// html2canvas no puede pintar en jsdom: devuelve un lienzo con una imagen JPEG real de 1×1
const JPEG_1X1 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
vi.mock('html2canvas', () => ({ default: vi.fn(async () => ({ toDataURL: () => JPEG_1X1 })) }));

/** Lee como ArrayBuffer el Blob entregado a URL.createObjectURL. */
const leerBlob = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsArrayBuffer(blob);
});

const ESPERA = { timeout: 6000 };
const montar = (elemento) =>
  render(
    <MemoryRouter>
      <ThemeProvider><ToastProvider><AuthProvider>{elemento}</AuthProvider></ToastProvider></ThemeProvider>
    </MemoryRouter>,
  );

let descargas;
let archivos;
beforeEach(() => {
  localStorage.clear();
  instalarStub();
  iniciarSesion();
  descargas = [];
  archivos = [];
  globalThis.URL.createObjectURL = vi.fn((blob) => { archivos.push(blob); return 'blob:prueba'; });
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { descargas.push(this.download); });
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
    await waitFor(() => expect(descargas).toEqual(['auditoria.xlsx']), ESPERA);
    // El archivo descargado es un libro de ExcelJS con cabecera con estilo
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await leerBlob(archivos[0]));
    const hoja = libro.getWorksheet('Datos');
    expect(hoja.getRow(1).values.slice(1)).toEqual(['Fecha', 'Usuario', 'Email', 'Institución', 'Acción', 'Entidad', 'ID Entidad', 'IP']);
    expect(hoja.rowCount - 1).toBe(contratos.auditoria.data.data.length);
    const cabecera = hoja.getRow(1).getCell(1);
    expect(cabecera.font.bold).toBe(true);
    expect(cabecera.fill.fgColor.argb).toBe('FF1E2235');
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
    await waitFor(() => expect(descargas).toEqual(['reporte.xlsx']), ESPERA);
    // Hoja 1 KPIs y Hoja 2 Top emisores, con los datos de la API
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await leerBlob(archivos[0]));
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Resumen KPIs', 'Top Emisores']);
    expect(libro.getWorksheet('Resumen KPIs').getRow(5).getCell(2).value).toBe(contratos.stats.data.totalEmitidos);
    const emisores = contratos.stats.data.topEmisores;
    if (emisores.length) expect(libro.getWorksheet('Top Emisores').getRow(5).getCell(2).value).toBe(emisores[0].nombre);
    // Los datos del reporte corresponden al período elegido en el modal
    expect(llamadas.some((l) => l.ruta === '/admin/stats' && l.query.get('period') === '90d')).toBe(true);
  }, 20000);

  it('CI-H22-02 Reporte completo en PDF', async () => {
    const user = userEvent.setup();
    const abrir = vi.spyOn(window, 'open');
    await abrirModal(user);
    await user.click(screen.getByText('Completo'));
    await user.click(screen.getByText('PDF (.pdf)'));
    await user.click(screen.getByRole('button', { name: /Generar y Descargar/ }));
    // Descarga automática de reporte.pdf generado con jsPDF (sin ventana de impresión)
    await waitFor(() => expect(descargas).toEqual(['reporte.pdf']), ESPERA);
    expect(abrir).not.toHaveBeenCalled();
    expect(archivos[0].type).toBe('application/pdf');
    const texto = new TextDecoder('latin1').decode(await leerBlob(archivos[0]));
    expect(texto.startsWith('%PDF')).toBe(true);
    expect(texto).toContain('CertiValidate');
    expect(texto).toContain('Reporte Completo');
    expect(texto).toContain('Indicadores clave');
    expect(texto).toContain(`${contratos.stats.data.tasaValidez}%`);
    for (const seccion of ['Tendencia mensual', 'Top emisores']) expect(texto).toContain(seccion);
    expect(texto).toMatch(/ re\s+f/); // rectángulos rellenos: logo, cabeceras de tabla y barras de la gráfica
  }, 20000);
});

describe('H08 Envío de certificado por correo', () => {
  it('CI-H08-01 Envío exitoso: PDF generado en el navegador y enviado como base64', async () => {
    const { certificatePdfToBase64 } = await import('../../utils/downloadCertificatePdf');
    const { certificadosApi } = await import('../../api/certificados.api');
    const html2canvas = (await import('html2canvas')).default;
    const cert = contratos.certificado_detalle.data;
    // jsdom no carga iframes con srcdoc: se escribe el documento y se dispara load
    const original = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
    Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
      configurable: true,
      set(html) { const d = this.contentDocument; d.open(); d.write(html); d.close(); setTimeout(() => this.onload?.()); },
    });

    // 1. Generar el PDF en el navegador con html2canvas + jsPDF
    let base64;
    try {
      base64 = await certificatePdfToBase64(`<html><body><h1>${cert.codigo_unico}</h1></body></html>`);
    } finally {
      if (original) Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', original);
      else delete HTMLIFrameElement.prototype.srcdoc;
    }
    expect(html2canvas).toHaveBeenCalled();
    expect(atob(base64).startsWith('%PDF')).toBe(true);

    // 2-4. Enviarlo a la API, que lo adjunta en Resend y responde 200
    const respuesta = await certificadosApi.enviarEmailPdf(cert.id, base64);
    expect(respuesta).toEqual({ email_id: 'email_contrato' }); // id de Resend para seguir la entrega
    const envio = llamadas.find((l) => l.metodo === 'POST' && l.ruta === `/certificados/${cert.id}/email`);
    expect(envio.cuerpo).toEqual({ pdf_base64: base64 });
  }, 20000);
});

