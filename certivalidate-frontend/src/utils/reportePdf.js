import { descargarArchivo } from './exportExcel';

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const mesLabel = (ym) => {
  const [y, m] = String(ym).split('-');
  return MESES_ES[Number.parseInt(m, 10) - 1] ? `${MESES_ES[Number.parseInt(m, 10) - 1]} ${y.slice(2)}` : String(ym);
};
const fmt = (n) => (n == null ? '-' : Number(n).toLocaleString('es-CO'));

const PRIMARIO = [13, 122, 122];
const OSCURO = [10, 82, 82];
const TEXTO = [26, 26, 46];
const SUAVE = [100, 116, 139];
const ALTERNO = [237, 247, 247];
const MARGEN = 15;
const ANCHO = 180; // A4 (210 mm) menos márgenes

/** Logo vectorial de CertiValidate: escudo con marca de verificación. */
function dibujarLogo(doc, x, y) {
  doc.setFillColor(...PRIMARIO);
  doc.roundedRect(x, y, 14, 14, 3, 3, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.4);
  doc.line(x + 3.5, y + 7.5, x + 6.2, y + 10.2);
  doc.line(x + 6.2, y + 10.2, x + 10.8, y + 4.2);
  doc.setLineWidth(0.2);
}

const asegurarEspacio = (doc, y, alto) => {
  if (y + alto <= 280) return y;
  doc.addPage();
  return 20;
};

function titulo(doc, y, texto) {
  y = asegurarEspacio(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...OSCURO);
  doc.text(texto, MARGEN, y);
  doc.setDrawColor(...PRIMARIO);
  doc.line(MARGEN, y + 1.5, MARGEN + ANCHO, y + 1.5);
  return y + 7;
}

/** Tabla con cabecera de color, filas alternas y salto de página automático. */
function tabla(doc, y, cabeceras, filas, anchos) {
  const alto = 7;
  const pintarCabecera = (yy) => {
    doc.setFillColor(...PRIMARIO);
    doc.rect(MARGEN, yy, ANCHO, alto, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    let x = MARGEN;
    cabeceras.forEach((c, i) => { doc.text(String(c), x + 2, yy + 4.8); x += anchos[i]; });
    return yy + alto;
  };
  y = pintarCabecera(asegurarEspacio(doc, y, alto * 2));
  doc.setFont('helvetica', 'normal');
  filas.forEach((fila, idx) => {
    if (y + alto > 280) { doc.addPage(); y = pintarCabecera(20); doc.setFont('helvetica', 'normal'); }
    if (idx % 2 === 1) { doc.setFillColor(...ALTERNO); doc.rect(MARGEN, y, ANCHO, alto, 'F'); }
    doc.setTextColor(...TEXTO);
    let x = MARGEN;
    fila.forEach((v, i) => {
      const texto = doc.splitTextToSize(String(v ?? '-'), anchos[i] - 4)[0] ?? '';
      doc.text(texto, x + 2, y + 4.8);
      x += anchos[i];
    });
    y += alto;
  });
  if (filas.length === 0) {
    doc.setTextColor(...SUAVE);
    doc.text('Sin datos en el período', MARGEN + 2, y + 4.8);
    y += alto;
  }
  return y + 6;
}

/** Gráfica de barras agrupadas (emisiones y verificaciones por mes). */
function graficaTendencia(doc, y, tendencia) {
  const alto = 55;
  y = asegurarEspacio(doc, y, alto + 12);
  const maximo = Math.max(1, ...tendencia.flatMap((d) => [d.emisiones ?? 0, d.verificaciones ?? 0]));
  const base = y + alto;
  doc.setDrawColor(...SUAVE);
  doc.line(MARGEN + 8, y, MARGEN + 8, base);
  doc.line(MARGEN + 8, base, MARGEN + ANCHO, base);
  doc.setFontSize(7);
  doc.setTextColor(...SUAVE);
  doc.text(fmt(maximo), MARGEN, y + 2);
  doc.text('0', MARGEN + 4, base);

  const grupo = (ANCHO - 12) / Math.max(tendencia.length, 1);
  const barra = Math.min(8, grupo / 3);
  tendencia.forEach((d, i) => {
    const x = MARGEN + 10 + i * grupo + (grupo - barra * 2) / 2;
    const hE = ((d.emisiones ?? 0) / maximo) * (alto - 4);
    const hV = ((d.verificaciones ?? 0) / maximo) * (alto - 4);
    doc.setFillColor(...PRIMARIO);
    doc.rect(x, base - hE, barra, hE, 'F');
    doc.setFillColor(16, 185, 129);
    doc.rect(x + barra, base - hV, barra, hV, 'F');
    doc.setTextColor(...SUAVE);
    doc.text(mesLabel(d.mes), x, base + 4);
  });

  // Leyenda
  doc.setFillColor(...PRIMARIO); doc.rect(MARGEN + 10, base + 7, 3, 3, 'F');
  doc.setTextColor(...TEXTO); doc.text('Emisiones', MARGEN + 15, base + 9.5);
  doc.setFillColor(16, 185, 129); doc.rect(MARGEN + 40, base + 7, 3, 3, 'F');
  doc.text('Verificaciones', MARGEN + 45, base + 9.5);
  return base + 16;
}

/**
 * Genera con jsPDF el reporte del dashboard (logo, KPIs, gráfica y tablas)
 * y lo descarga como reporte.pdf.
 * @returns {Promise<import('jspdf').jsPDF>} el documento generado
 */
export async function generarReportePdf({ tipo, tipoLabel, periodoLabel, stats }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: `Reporte ${tipoLabel} - CertiValidate`, creator: 'CertiValidate' });

  // Encabezado con logo
  dibujarLogo(doc, MARGEN, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...OSCURO);
  doc.text('CertiValidate', MARGEN + 18, 19);
  doc.setFontSize(11);
  doc.setTextColor(...TEXTO);
  doc.text(`Reporte ${tipoLabel}`, MARGEN + 18, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SUAVE);
  doc.text(`Período: ${periodoLabel}`, MARGEN + ANCHO, 19, { align: 'right' });
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, MARGEN + ANCHO, 25, { align: 'right' });
  doc.setDrawColor(...PRIMARIO);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, 30, MARGEN + ANCHO, 30);
  doc.setLineWidth(0.2);

  let y = titulo(doc, 40, 'Indicadores clave');
  y = tabla(doc, y, ['Indicador', 'Valor'], [
    ['Total emitidos', fmt(stats?.totalEmitidos)],
    ['Válidos', fmt(stats?.totalValidos)],
    ['Revocados', fmt(stats?.totalRevocados)],
    ['Tasa de validez', `${stats?.tasaValidez ?? '-'}%`],
    ['Verificaciones hoy', fmt(stats?.verificacionesHoy)],
    ['Verificaciones (mes)', fmt(stats?.verificacionesMes)],
  ], [120, 60]);

  const tendencia = stats?.tendencia ?? [];
  if (tipo !== 'operativo') {
    y = titulo(doc, y, 'Tendencia mensual');
    y = graficaTendencia(doc, y, tendencia);
    y = tabla(doc, y, ['Mes', 'Emisiones', 'Verificaciones'],
      tendencia.map((d) => [mesLabel(d.mes), fmt(d.emisiones), fmt(d.verificaciones)]), [80, 50, 50]);
  }

  y = titulo(doc, y, 'Top emisores');
  y = tabla(doc, y, ['#', 'Emisor', 'Certificados'],
    (stats?.topEmisores ?? []).map((e, i) => [i + 1, e.nombre, fmt(e.total)]), [15, 120, 45]);

  if (tipo !== 'ejecutivo') {
    y = titulo(doc, y, 'Últimas revocaciones');
    tabla(doc, y, ['Código', 'Titular', 'Motivo', 'Fecha'],
      (stats?.ultimasRevocaciones ?? []).map((r) => [
        r.codigo_unico,
        r.titular ?? '-',
        r.motivo_codigo?.replace(/_/g, ' ') ?? '-',
        r.fecha_revocacion ? new Date(r.fecha_revocacion).toLocaleDateString('es-CO') : '-',
      ]), [45, 55, 50, 30]);
  }

  // Pie en todas las páginas
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...SUAVE);
    doc.text('Generado por CertiValidate - Documento confidencial', MARGEN, 290);
    doc.text(`Página ${p} de ${paginas}`, MARGEN + ANCHO, 290, { align: 'right' });
  }

  descargarArchivo(doc.output('blob'), 'reporte.pdf', 'application/pdf');
  return doc;
}
