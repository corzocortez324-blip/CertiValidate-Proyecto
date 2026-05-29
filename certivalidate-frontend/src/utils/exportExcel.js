import * as XLSX from 'xlsx';

/**
 * Exporta un array de objetos a un archivo .xlsx con formato profesional.
 * @param {object[]} rows     - Filas de datos (array de objetos planos)
 * @param {string[]} headers  - Nombres de columna en el orden deseado
 * @param {string}   filename - Nombre base del archivo (sin extensión)
 */
export function exportToXLSX(rows, headers, filename) {
  const wb = XLSX.utils.book_new();

  // Hoja de datos
  const wsData = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Anchos de columna automáticos (max de cabecera vs contenido, mínimo 10, máximo 50)
  ws['!cols'] = headers.map((h, colIdx) => {
    const maxLen = wsData.reduce((max, row) => {
      const cell = row[colIdx];
      const len = cell != null ? String(cell).length : 0;
      return Math.max(max, len);
    }, h.length);
    return { wch: Math.min(Math.max(maxLen + 2, 10), 52) };
  });

  // Congelar primera fila
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Estilo de cabecera: negrita + fondo oscuro + texto claro
  const headerStyle = {
    font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' },
    fill:      { fgColor: { rgb: '1E2235' }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border: {
      bottom: { style: 'medium', color: { rgb: '00F0FF' } },
    },
  };

  // Estilo de filas pares (zebra)
  const evenRowStyle = {
    fill: { fgColor: { rgb: 'F4F6FA' }, patternType: 'solid' },
    font: { sz: 9, name: 'Calibri' },
    alignment: { vertical: 'center' },
  };
  const oddRowStyle = {
    fill: { fgColor: { rgb: 'FFFFFF' }, patternType: 'solid' },
    font: { sz: 9, name: 'Calibri' },
    alignment: { vertical: 'center' },
  };

  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let C = range.s.c; C <= range.e.c; C++) {
    // Cabecera (fila 0)
    const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[headerCell]) ws[headerCell] = { v: headers[C], t: 's' };
    ws[headerCell].s = headerStyle;

    // Filas de datos
    for (let R = 1; R <= range.e.r; R++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddr]) ws[cellAddr] = { v: '', t: 's' };
      ws[cellAddr].s = R % 2 === 0 ? evenRowStyle : oddRowStyle;
    }
  }

  // Altura de filas: cabecera más alta
  ws['!rows'] = [{ hpt: 20 }, ...Array(range.e.r).fill({ hpt: 16 })];

  XLSX.utils.book_append_sheet(wb, ws, 'Datos');

  // Propiedades del libro
  wb.Props = {
    Title:   filename,
    Author:  'CertiValidate',
    CreatedDate: new Date(),
  };

  const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  XLSX.writeFile(wb, `${filename}-${ts}.xlsx`);
}
