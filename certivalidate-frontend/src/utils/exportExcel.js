export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Descarga un Blob/ArrayBuffer en el navegador con el nombre indicado. */
export function descargarArchivo(datos, nombre, tipo) {
  const blob = datos instanceof Blob ? datos : new Blob([datos], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
  return blob;
}

const BORDE = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };

/**
 * Exporta un array de objetos a un archivo .xlsx con formato profesional (ExcelJS):
 * cabecera en negrita sobre fondo oscuro, filas alternas, bordes, anchos
 * automáticos, primera fila congelada y autofiltro.
 * @param {object[]} rows     - Filas de datos (array de objetos planos)
 * @param {string[]} headers  - Nombres de columna en el orden deseado
 * @param {string}   filename - Nombre del archivo (sin extensión)
 * @returns {Promise<import('exceljs').Workbook>} el libro generado
 */
export async function exportToXLSX(rows, headers, filename) {
  const { default: ExcelJS } = await import('exceljs');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CertiValidate';
  wb.title = filename;
  wb.created = new Date();

  const ws = wb.addWorksheet('Datos', { views: [{ state: 'frozen', ySplit: 1 }] });
  const datos = rows.map((r) => headers.map((h) => r[h] ?? ''));

  // Anchos automáticos (máximo entre cabecera y contenido, entre 10 y 52)
  ws.columns = headers.map((h, i) => {
    const largo = datos.reduce((max, fila) => Math.max(max, String(fila[i]).length), h.length);
    return { header: h, key: h, width: Math.min(Math.max(largo + 2, 10), 52) };
  });
  datos.forEach((fila) => ws.addRow(fila));

  const cabecera = ws.getRow(1);
  cabecera.height = 20;
  cabecera.eachCell((c) => {
    c.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2235' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = { ...BORDES, bottom: { style: 'medium', color: { argb: 'FF00F0FF' } } };
  });

  for (let r = 2; r <= datos.length + 1; r++) {
    const fila = ws.getRow(r);
    fila.height = 16;
    for (let c = 1; c <= headers.length; c++) {
      const celda = fila.getCell(c);
      celda.font = { name: 'Calibri', size: 9 };
      celda.alignment = { vertical: 'middle' };
      celda.border = BORDES;
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 === 0 ? 'FFFFFFFF' : 'FFF4F6FA' } };
    }
  }

  if (headers.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  descargarArchivo(buffer, `${filename}.xlsx`, XLSX_MIME);
  return wb;
}
