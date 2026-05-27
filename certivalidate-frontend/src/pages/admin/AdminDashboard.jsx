import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/ToastProvider';
import { adminApi } from '../../api/admin.api';
import {
  FileBadge, CheckCircle, XCircle, ShieldCheck,
  TrendingUp, RefreshCw, Users, Ban, BarChart2, Activity, Download, X,
} from 'lucide-react';
import { formatDateTime } from '../../utils/helpers';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend,
  LineElement, PointElement, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import './AdminDashboard.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend,
  LineElement, PointElement, Filler,
);

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const formatMesLabel = (ym) => {
  const [y, m] = ym.split('-');
  return `${MESES_ES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
};

const formatDiaLabel = (dia) => {
  const d = new Date(dia.includes('T') ? dia : `${dia}T00:00:00Z`);
  return `${d.getUTCDate()} ${MESES_ES[d.getUTCMonth()]}`;
};

const PERIODS = [
  { key: '7d',  label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '1y',  label: '1a' },
];

const CHART_TYPES = [
  { key: 'bar',  label: 'Barras', Icon: BarChart2  },
  { key: 'line', label: 'Línea',  Icon: TrendingUp },
  { key: 'area', label: 'Área',   Icon: Activity   },
];

const DAILY_CHART_TYPES = [
  { key: 'mixed', label: 'Mixto',  Icon: BarChart2  },
  { key: 'bar',   label: 'Barras', Icon: BarChart2  },
  { key: 'line',  label: 'Línea',  Icon: TrendingUp },
];

const EMISORES_COLORS = [
  '#0d7a7a', '#10b981', '#b026ff', '#f59e0b', '#00f0ff',
  '#ef4444', '#3b82f6', '#f97316', '#a3e635', '#ec4899',
];

const BAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: 'rgba(255,255,255,0.6)', boxWidth: 12, font: { size: 12 } },
    },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.95)',
      titleColor: '#fff',
      bodyColor: 'rgba(255,255,255,0.7)',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString('es-CO')}`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 11 } },
      grid: { color: 'rgba(255,255,255,0.06)' },
    },
    y: {
      ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 11 } },
      grid: { color: 'rgba(255,255,255,0.06)' },
      beginAtZero: true,
    },
  },
};

const EMISORES_BAR_OPTIONS = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.95)',
      titleColor: '#fff',
      bodyColor: 'rgba(255,255,255,0.7)',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      callbacks: {
        label: (ctx) => ` ${Number(ctx.parsed.x).toLocaleString('es-CO')} certs`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: { color: 'rgba(255,255,255,0.55)', font: { size: 10 } },
      grid: { color: 'rgba(255,255,255,0.06)' },
    },
    y: {
      ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } },
      grid: { display: false },
    },
  },
};

const DOUGHNUT_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.95)',
      titleColor: '#fff',
      bodyColor: 'rgba(255,255,255,0.7)',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
    },
  },
};

/* ─── Export Modal ─────────────────────────────────────────────────────────── */

const PERIODO_LABEL = { '7d': '7 días', '30d': '30 días', '90d': '90 días', '1a': '1 año' };
const TIPO_LABEL    = { ejecutivo: 'Ejecutivo', completo: 'Completo', operativo: 'Operativo' };

async function buildXlsx(tipo, period, stats) {
  const { default: ExcelJS } = await import('exceljs');

  const wb    = new ExcelJS.Workbook();
  wb.creator  = 'CertiValidate';
  wb.created  = new Date();

  const fecha        = new Date().toISOString().slice(0, 10);
  const periodoLabel = PERIODO_LABEL[period] ?? period;
  const tipoLabel    = TIPO_LABEL[tipo] ?? tipo;

  // ── Paleta ──────────────────────────────────────────────────
  const PRI   = '0D7A7A';
  const DARK  = '0A5252';
  const WHITE = 'FFFFFF';
  const ALT   = 'EDF7F7';
  const OK    = '10B981';
  const ERR   = 'EF4444';
  const MUTED = '64748B';
  const BORD  = 'CBD5E1';

  const thin = (argb = BORD) => ({ style: 'thin', color: { argb } });
  const border = { top: thin(), left: thin(), bottom: thin(), right: thin() };

  const hFont  = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 11 };
  const ttFont = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 13 };
  const dFont  = { name: 'Calibri', size: 10 };
  const nFont  = { name: 'Calibri', size: 10, bold: true };

  const hFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRI } };
  const ttFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  const aFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT } };

  // Helpers
  const setTitle = (ws, cols, text, subtext) => {
    ws.views = [{ showGridLines: false }];
    const colLetter = String.fromCharCode(64 + cols);
    ws.mergeCells(`A1:${colLetter}1`);
    const c1 = ws.getCell('A1');
    c1.value = text; c1.font = ttFont; c1.fill = ttFill;
    c1.alignment = { vertical: 'middle', horizontal: 'center' };
    c1.border = border;
    ws.getRow(1).height = 30;

    ws.mergeCells(`A2:${colLetter}2`);
    const c2 = ws.getCell('A2');
    c2.value = subtext;
    c2.font = { name: 'Calibri', size: 9, italic: true, color: { argb: MUTED } };
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5F5' } };
    c2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 15;
    ws.getRow(3).height = 6;
  };

  const addHeader = (ws, row, labels, widths) => {
    labels.forEach((lbl, i) => {
      const c = ws.getRow(row).getCell(i + 1);
      c.value = lbl; c.font = hFont; c.fill = hFill; c.border = border;
      c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
    });
    ws.getRow(row).height = 20;
    widths?.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  };

  const addRow = (ws, rowN, vals, isAlt, numIdx = []) => {
    vals.forEach((v, i) => {
      const c = ws.getRow(rowN).getCell(i + 1);
      c.value = v;
      c.font  = numIdx.includes(i) ? nFont : dFont;
      if (isAlt) c.fill = aFill;
      c.border = border;
      c.alignment = { vertical: 'middle', horizontal: numIdx.includes(i) ? 'center' : 'left' };
    });
    ws.getRow(rowN).height = 17;
  };

  // ── Hoja 1: Resumen KPIs ────────────────────────────────────
  const ws1 = wb.addWorksheet('Resumen KPIs');
  setTitle(ws1, 2, `CertiValidate · Reporte ${tipoLabel}`, `Período: ${periodoLabel}   ·   Generado: ${fecha}`);
  addHeader(ws1, 4, ['Indicador', 'Valor'], [38, 18]);

  const kpis = [
    { label: 'Total Emitidos',            val: stats?.totalEmitidos     ?? 0, color: null },
    { label: 'Certificados Válidos',      val: stats?.totalValidos       ?? 0, color: OK  },
    { label: 'Certificados Revocados',    val: stats?.totalRevocados     ?? 0, color: ERR },
    { label: 'Tasa de Validez (%)',       val: stats?.tasaValidez        ?? 0, color: null },
    { label: 'Verificaciones Hoy',        val: stats?.verificacionesHoy ?? 0, color: null },
    { label: 'Verificaciones (30 días)',  val: stats?.verificacionesMes ?? 0, color: null },
  ];
  kpis.forEach(({ label, val, color }, i) => {
    addRow(ws1, 5 + i, [label, val], i % 2 === 1, [1]);
    if (color) ws1.getRow(5 + i).getCell(2).font = { ...nFont, color: { argb: color } };
  });

  // ── Hoja 2: Tendencia ───────────────────────────────────────
  if (tipo !== 'operativo') {
    const ws2 = wb.addWorksheet('Tendencia Mensual');
    setTitle(ws2, 3, 'Tendencia de Emisiones y Verificaciones', `Período: ${periodoLabel}`);
    addHeader(ws2, 4, ['Mes', 'Emisiones', 'Verificaciones'], [20, 16, 18]);
    (stats?.tendencia ?? []).forEach((d, i) =>
      addRow(ws2, 5 + i, [formatMesLabel(d.mes), d.emisiones, d.verificaciones], i % 2 === 1, [1, 2])
    );
  }

  // ── Hoja 3: Top Emisores ────────────────────────────────────
  if (tipo !== 'ejecutivo') {
    const ws3 = wb.addWorksheet('Top Emisores');
    setTitle(ws3, 3, 'Top Emisores por Certificados Emitidos', `Período: ${periodoLabel}`);
    addHeader(ws3, 4, ['#', 'Emisor', 'Certificados'], [6, 38, 16]);
    const medals = ['FFD700', 'A8A8A8', 'CD7F32'];
    (stats?.topEmisores ?? []).forEach((e, i) => {
      addRow(ws3, 5 + i, [i + 1, e.nombre, e.total], i % 2 === 1, [0, 2]);
      if (i < 3) ws3.getRow(5 + i).getCell(1).font = { ...nFont, color: { argb: medals[i] } };
    });
  }

  // ── Hoja 4: Revocaciones ────────────────────────────────────
  if (tipo === 'completo') {
    const ws4 = wb.addWorksheet('Revocaciones');
    setTitle(ws4, 4, 'Últimas Revocaciones', `Período: ${periodoLabel}`);
    addHeader(ws4, 4, ['Código', 'Titular', 'Motivo', 'Fecha'], [24, 26, 24, 16]);
    (stats?.ultimasRevocaciones ?? []).forEach((r, i) => {
      addRow(ws4, 5 + i, [
        r.codigo_unico,
        r.titular ?? '—',
        r.motivo_codigo?.replace(/_/g, ' ') ?? '—',
        r.fecha_revocacion ? new Date(r.fecha_revocacion).toLocaleDateString('es-CO') : '—',
      ], i % 2 === 1);
      ws4.getRow(5 + i).getCell(1).font = { name: 'Courier New', size: 9, color: { argb: ERR } };
    });
  }

  // ── Descarga ────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = `reporte-${tipo}-${period}-${fecha}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

function buildPDF(tipo, period, stats) {
  const fecha        = new Date().toLocaleDateString('es-CO', { dateStyle: 'long' });
  const periodoLabel = PERIODO_LABEL[period] ?? period;
  const tipoLabel    = TIPO_LABEL[tipo] ?? tipo;
  const fmt          = (n) => n == null ? '—' : Number(n).toLocaleString('es-CO');

  const kpiCards = [
    { label: 'Total emitidos',       value: fmt(stats?.totalEmitidos) },
    { label: 'Válidos',              value: fmt(stats?.totalValidos) },
    { label: 'Revocados',            value: fmt(stats?.totalRevocados) },
    { label: 'Tasa de validez',      value: `${stats?.tasaValidez ?? '—'}%` },
    { label: 'Verificaciones hoy',   value: fmt(stats?.verificacionesHoy) },
    { label: 'Verificaciones (mes)', value: fmt(stats?.verificacionesMes) },
  ];

  const kpiHtml = `
    <section>
      <h2>Indicadores clave</h2>
      <div class="kpi-grid">
        ${kpiCards.map(k => `
          <div class="kpi-card">
            <div class="kpi-value">${k.value}</div>
            <div class="kpi-label">${k.label}</div>
          </div>`).join('')}
      </div>
    </section>`;

  const tendenciaHtml = tipo !== 'operativo' ? `
    <section>
      <h2>Tendencia mensual</h2>
      <table>
        <thead><tr><th>Mes</th><th>Emisiones</th><th>Verificaciones</th></tr></thead>
        <tbody>
          ${(stats?.tendencia ?? []).map(d => `
            <tr><td>${formatMesLabel(d.mes)}</td><td>${fmt(d.emisiones)}</td><td>${fmt(d.verificaciones)}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </section>` : '';

  const emisoresHtml = tipo !== 'ejecutivo' ? `
    <section>
      <h2>Top emisores</h2>
      <table>
        <thead><tr><th>#</th><th>Emisor</th><th>Certificados</th></tr></thead>
        <tbody>
          ${(stats?.topEmisores ?? []).map((e, i) => `
            <tr><td>${i + 1}</td><td>${e.nombre}</td><td>${fmt(e.total)}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </section>` : '';

  const revocacionesHtml = tipo === 'completo' ? `
    <section>
      <h2>Últimas revocaciones</h2>
      <table>
        <thead><tr><th>Código</th><th>Titular</th><th>Motivo</th><th>Fecha</th></tr></thead>
        <tbody>
          ${(stats?.ultimasRevocaciones ?? []).map(r => `
            <tr>
              <td class="mono">${r.codigo_unico}</td>
              <td>${r.titular ?? '—'}</td>
              <td>${r.motivo_codigo?.replace(/_/g, ' ') ?? '—'}</td>
              <td>${r.fecha_revocacion ? new Date(r.fecha_revocacion).toLocaleDateString('es-CO') : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </section>` : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte ${tipoLabel} · CertiValidate</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 2rem; }
    .report-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0d7a7a; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .report-brand { font-size: 1.4rem; font-weight: 800; color: #0d7a7a; letter-spacing: -0.5px; }
    .report-meta { text-align: right; color: #555; font-size: 0.82rem; line-height: 1.7; }
    .report-meta strong { color: #1a1a2e; }
    section { margin-bottom: 1.75rem; }
    h2 { font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0d7a7a; border-left: 3px solid #0d7a7a; padding-left: 0.6rem; margin-bottom: 0.85rem; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
    .kpi-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem 1rem; background: #f8fafc; }
    .kpi-value { font-size: 1.4rem; font-weight: 800; color: #0d7a7a; }
    .kpi-label { font-size: 0.75rem; color: #64748b; margin-top: 0.2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    thead tr { background: #0d7a7a; color: #fff; }
    th { padding: 0.55rem 0.75rem; text-align: left; font-weight: 600; font-size: 0.78rem; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #e2e8f0; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .mono { font-family: monospace; font-size: 0.8rem; }
    .report-footer { margin-top: 2rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0; font-size: 0.72rem; color: #94a3b8; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <div class="report-brand">CertiValidate</div>
      <div style="color:#555;font-size:0.8rem;margin-top:0.2rem;">Sistema de Certificados Digitales</div>
    </div>
    <div class="report-meta">
      <strong>Reporte ${tipoLabel}</strong><br>
      Período: ${periodoLabel}<br>
      Generado: ${fecha}
    </div>
  </div>
  ${kpiHtml}
  ${tendenciaHtml}
  ${emisoresHtml}
  ${revocacionesHtml}
  <div class="report-footer">Generado por CertiValidate · Documento confidencial</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=720');
  if (!win) {
    showToast('Permite ventanas emergentes para exportar el PDF.', 'warning');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 450);
}

function ExportModal({ stats, period, onClose }) {
  const [exportPeriod,   setExportPeriod]   = useState(period ?? '30d');
  const [exportTipo,     setExportTipo]     = useState('ejecutivo');
  const [exportFormato,  setExportFormato]  = useState('excel');
  const [exporting,      setExporting]      = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const intervalRef = useRef(null);

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);

    intervalRef.current = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 90) { clearInterval(intervalRef.current); return prev; }
        return prev + 15;
      });
    }, 100);

    try {
      if (exportFormato === 'pdf') {
        await new Promise(r => setTimeout(r, 600));
        buildPDF(exportTipo, exportPeriod, stats);
      } else {
        await buildXlsx(exportTipo, exportPeriod, stats);
      }
    } finally {
      clearInterval(intervalRef.current);
      setExportProgress(100);
      setTimeout(() => onClose(), 600);
    }
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const TIPO_OPTIONS = [
    { key: 'ejecutivo', label: 'Ejecutivo',  desc: 'KPIs + tendencia' },
    { key: 'completo',  label: 'Completo',   desc: 'Todo incluido'    },
    { key: 'operativo', label: 'Operativo',  desc: 'KPIs + emisores + revocaciones' },
  ];

  const FORMATO_OPTIONS = [
    { key: 'excel', label: 'Excel (.xlsx)' },
    { key: 'pdf',   label: 'PDF (.pdf)'    },
  ];

  const PERIOD_OPTS = [
    { key: '7d',  label: '7d' },
    { key: '30d', label: '30d' },
    { key: '90d', label: '90d' },
    { key: '1a',  label: '1a' },
  ];

  return (
    <div className="export-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="export-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="export-modal-header">
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Exportar Reporte</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Período */}
        <div>
          <p className="export-section-label">Período</p>
          <div className="period-tabs" style={{ marginTop: '0.4rem' }}>
            {PERIOD_OPTS.map(p => (
              <button
                key={p.key}
                type="button"
                className={`period-tab ${exportPeriod === p.key ? 'active' : ''}`}
                onClick={() => setExportPeriod(p.key)}
                disabled={exporting}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo */}
        <div>
          <p className="export-section-label">Tipo de reporte</p>
          <div className="export-radio-group">
            {TIPO_OPTIONS.map(t => (
              <button
                key={t.key}
                type="button"
                className={`export-radio-card ${exportTipo === t.key ? 'selected' : ''}`}
                onClick={() => setExportTipo(t.key)}
                disabled={exporting}
              >
                <span>{t.label}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.65, display: 'block', marginTop: '0.15rem' }}>{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Formato */}
        <div>
          <p className="export-section-label">Formato</p>
          <div className="export-radio-group">
            {FORMATO_OPTIONS.map(f => (
              <button
                key={f.key}
                type="button"
                className={`export-radio-card ${exportFormato === f.key ? 'selected' : ''}`}
                onClick={() => setExportFormato(f.key)}
                disabled={exporting}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        {exporting && (
          <div className="export-progress-bar">
            <div className="export-progress-inner" style={{ width: `${exportProgress}%` }} />
          </div>
        )}

        {/* Actions */}
        <div className="export-modal-actions">
          <button
            type="button"
            className="period-tab"
            onClick={onClose}
            disabled={exporting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-emit"
            onClick={handleExport}
            disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Download size={15} />
            {exporting ? `Generando… ${exportProgress}%` : 'Generar y Descargar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AdminDashboard ───────────────────────────────────────────────────────── */

export const AdminDashboard = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [stats, setStats]           = useState(null);
  const [period, setPeriod]         = useState('30d');
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [chartType, setChartType]         = useState('bar');
  const [dailyChartType, setDailyChartType] = useState('mixed');
  const [showExport, setShowExport]       = useState(false);
  const intervalRef                 = useRef(null);

  const loadStats = useCallback(async (p) => {
    try {
      const data = await adminApi.getStats(p);
      setStats(data);
      setLastRefresh(new Date());
    } catch {
      // silent — keep previous data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadStats(period);

    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => loadStats(period), 60_000);
    return () => clearInterval(intervalRef.current);
  }, [period, loadStats]);

  const tendencia    = stats?.tendencia ?? [];
  const topEmisores  = stats?.topEmisores ?? [];
  const revocaciones = stats?.ultimasRevocaciones ?? [];

  /* ── Trend chart dataset (adapts to chartType) ── */
  const buildDataset = (label, data, colorMain, colorSecondary) => {
    if (chartType === 'bar') {
      return {
        label,
        data,
        backgroundColor: colorMain,
        borderRadius: 4,
        pointRadius: 0,
      };
    }
    const isArea = chartType === 'area';
    return {
      label,
      data,
      backgroundColor: colorSecondary,
      borderColor: colorMain,
      fill: isArea,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    };
  };

  const barData = {
    labels: tendencia.map(d => formatMesLabel(d.mes)),
    datasets: [
      buildDataset('Emisiones',      tendencia.map(d => d.emisiones),      '#0d7a7a', 'rgba(13,122,122,0.1)'),
      buildDataset('Verificaciones', tendencia.map(d => d.verificaciones), '#10b981', 'rgba(16,185,129,0.1)'),
    ],
  };

  const TrendChart = chartType === 'bar' ? Bar : Line;

  /* ── Emisores horizontal bar chart ── */
  const emisoresBarData = {
    labels: topEmisores.map(e => e.nombre),
    datasets: [{
      data: topEmisores.map(e => e.total),
      backgroundColor: topEmisores.map((_, i) => EMISORES_COLORS[i % EMISORES_COLORS.length]),
      barThickness: 14,
      borderRadius: 3,
    }],
  };

  /* ── Doughnut ── */
  const donutSegments = [
    { label: 'Válidos',   value: Math.max(stats?.totalValidos ?? 1, 0) || 1, color: '#10b981' },
    { label: 'Revocados', value: stats?.totalRevocados ?? 0,                  color: '#ef4444' },
  ];

  const doughnutData = {
    labels: donutSegments.map(s => s.label),
    datasets: [{
      data: donutSegments.map(s => s.value),
      backgroundColor: donutSegments.map(s => s.color),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  /* ── Daily activity chart (real-time) ── */
  const emisionesData  = stats?.emisionesDiarias     ?? [];
  const verifPorDia    = stats?.verificacionesDiarias ?? [];

  const allDays = Array.from(new Set([
    ...emisionesData.map(e => String(e.dia).slice(0, 10)),
    ...verifPorDia.map(v => String(v.dia).slice(0, 10)),
  ])).sort();

  const emisionMap = Object.fromEntries(emisionesData.map(e => [String(e.dia).slice(0, 10), Number(e.total_emitidos)]));
  const verifMap   = Object.fromEntries(verifPorDia.map(v => [String(v.dia).slice(0, 10), Number(v.total)]));

  const DAILY_BASE_SCALES = {
    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 11 }, precision: 0 }, beginAtZero: true },
  };

  const dailyChartData = {
    labels: allDays.map(formatDiaLabel),
    datasets: dailyChartType === 'mixed'
      ? [
          { type: 'bar',  label: 'Emisiones',      data: allDays.map(d => emisionMap[d] ?? 0),    backgroundColor: 'rgba(13,122,122,0.55)', borderRadius: 3, yAxisID: 'y' },
          { type: 'line', label: 'Verificaciones',  data: allDays.map(d => verifMap[d] ?? null),   borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.4, pointRadius: 2, borderWidth: 2, spanGaps: false, yAxisID: 'y1' },
        ]
      : dailyChartType === 'bar'
        ? [
            { type: 'bar', label: 'Emisiones',     data: allDays.map(d => emisionMap[d] ?? 0),    backgroundColor: 'rgba(13,122,122,0.55)', borderRadius: 3, yAxisID: 'y' },
            { type: 'bar', label: 'Verificaciones', data: allDays.map(d => verifMap[d] ?? 0),     backgroundColor: 'rgba(16,185,129,0.45)', borderRadius: 3, yAxisID: 'y' },
          ]
        : [
            { type: 'line', label: 'Emisiones',     data: allDays.map(d => emisionMap[d] ?? 0),   borderColor: '#0d7a7a', backgroundColor: 'rgba(13,122,122,0.1)', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2, yAxisID: 'y' },
            { type: 'line', label: 'Verificaciones', data: allDays.map(d => verifMap[d] ?? null),  borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.07)', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2, spanGaps: false, yAxisID: 'y' },
          ],
  };

  const DAILY_OPTIONS = {
    ...BAR_OPTIONS,
    plugins: { ...BAR_OPTIONS.plugins, legend: { labels: { color: 'rgba(255,255,255,0.6)', boxWidth: 12, font: { size: 11 } } } },
    scales: dailyChartType === 'mixed'
      ? {
          x: DAILY_BASE_SCALES.x,
          y:  { ...DAILY_BASE_SCALES.y, position: 'left',  title: { display: true, text: 'Emisiones',      color: 'rgba(255,255,255,0.3)', font: { size: 10 } } },
          y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#10b981', font: { size: 11 }, precision: 0 }, title: { display: true, text: 'Verificaciones', color: '#10b981', font: { size: 10 } }, beginAtZero: true },
        }
      : DAILY_BASE_SCALES,
  };

  const fmt = (n) => n == null ? '—' : Number(n).toLocaleString('es-CO');

  return (
    <div className="admin-dashboard animate-fade-in">
      {/* Export Modal */}
      {showExport && (
        <ExportModal
          stats={stats}
          period={period}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">
            Resumen general del sistema
            {lastRefresh && (
              <span className="dash-last-refresh">
                <RefreshCw size={11} />
                {formatDateTime(lastRefresh)}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            type="button"
            className="export-btn"
            onClick={() => setShowExport(true)}
          >
            <Download size={15} />
            Exportar Reporte
          </button>
          {hasPermission('certificado:emitir') && (
            <button className="btn-emit" onClick={() => navigate('/admin/certificados')}>
              <FileBadge size={16} />
              Emitir Certificado
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="dash-stats-grid">
        <div className="dash-stat-card glass-panel">
          <div className="dash-stat-icon" style={{ color: '#00f0ff' }}><FileBadge size={22} /></div>
          <p className="dash-stat-value">{loading ? '—' : fmt(stats?.totalEmitidos)}</p>
          <p className="dash-stat-label">Total emitidos</p>
        </div>
        <div className="dash-stat-card glass-panel">
          <div className="dash-stat-icon" style={{ color: '#10b981' }}><CheckCircle size={22} /></div>
          <p className="dash-stat-value">{loading ? '—' : fmt(stats?.totalValidos)}</p>
          <p className="dash-stat-label">Válidos</p>
        </div>
        <div className="dash-stat-card glass-panel">
          <div className="dash-stat-icon" style={{ color: '#ef4444' }}><XCircle size={22} /></div>
          <p className="dash-stat-value">{loading ? '—' : fmt(stats?.totalRevocados)}</p>
          <p className="dash-stat-label">Revocados</p>
        </div>
        <div className="dash-stat-card glass-panel">
          <div className="dash-stat-icon" style={{ color: '#f59e0b' }}><ShieldCheck size={22} /></div>
          <p className="dash-stat-value">{loading ? '—' : fmt(stats?.verificacionesHoy)}</p>
          <p className="dash-stat-label">Verificaciones hoy</p>
        </div>
        <div className="dash-stat-card glass-panel">
          <div className="dash-stat-icon" style={{ color: '#b026ff' }}><TrendingUp size={22} /></div>
          <p className="dash-stat-value">{loading ? '—' : `${stats?.tasaValidez ?? '—'}%`}</p>
          <p className="dash-stat-label">Tasa de validez</p>
        </div>
        <div className="dash-stat-card glass-panel">
          <div className="dash-stat-icon" style={{ color: '#00f0ff' }}><ShieldCheck size={22} /></div>
          <p className="dash-stat-value">{loading ? '—' : fmt(stats?.verificacionesMes)}</p>
          <p className="dash-stat-label">Verificaciones (30d)</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="dash-charts-row">
        {/* Trend chart */}
        <div className="dash-chart-card glass-panel">
          <div className="dash-chart-header">
            <h3>Emisiones y Verificaciones</h3>
            <div className="chart-header-controls">
              <div className="chart-type-tabs">
                {CHART_TYPES.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    className={`chart-type-tab ${chartType === key ? 'active' : ''}`}
                    onClick={() => setChartType(key)}
                    title={label}
                  >
                    <Icon size={13} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="period-tabs">
                {PERIODS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    className={`period-tab ${period === p.key ? 'active' : ''}`}
                    onClick={() => setPeriod(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="chart-canvas-wrap">
            {loading ? (
              <div className="chart-skeleton animate-pulse" style={{ height: '100%' }} />
            ) : (
              <TrendChart data={barData} options={BAR_OPTIONS} />
            )}
          </div>
        </div>

        {/* Doughnut */}
        <div className="dash-donut-card glass-panel">
          <h3>Estado de Certificados</h3>
          <div className="donut-wrap">
            {loading ? (
              <div className="chart-skeleton animate-pulse" style={{ height: 160, width: 160, borderRadius: '50%' }} />
            ) : (
              <div className="chart-canvas-donut">
                <Doughnut data={doughnutData} options={DOUGHNUT_OPTIONS} />
              </div>
            )}
          </div>
          <div className="donut-legend">
            {donutSegments.map(s => (
              <div key={s.label} className="donut-legend-item">
                <span className="legend-dot" style={{ background: s.color }} />
                <span>{s.label}</span>
                <span className="donut-legend-val">
                  {fmt(s.value === 1 && stats?.totalValidos === 0 ? 0 : s.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actividad diaria — desde vistas materializadas */}
      {(emisionesData.length > 0 || verifPorDia.length > 0) && (
        <div className="dash-chart-card glass-panel" style={{ marginBottom: '1.25rem' }}>
          <div className="dash-chart-header">
            <h3>Actividad diaria</h3>
            <div className="chart-type-tabs">
              {DAILY_CHART_TYPES.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={`chart-type-tab ${dailyChartType === key ? 'active' : ''}`}
                  onClick={() => setDailyChartType(key)}
                  title={label}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="chart-canvas-wrap">
            <Bar data={dailyChartData} options={DAILY_OPTIONS} />
          </div>
        </div>
      )}

      {/* Bottom row: top emisores + últimas revocaciones */}
      <div className="dash-bottom-row">
        {/* Top emisores — horizontal bar chart */}
        <div className="dash-top-card glass-panel">
          <h3><Users size={15} /> Top emisores</h3>
          {loading ? (
            <div className="chart-skeleton animate-pulse" style={{ height: 160 }} />
          ) : topEmisores.length === 0 ? (
            <p className="dash-empty">Sin datos.</p>
          ) : (
            <div className="emisores-chart-wrap">
              <Bar data={emisoresBarData} options={EMISORES_BAR_OPTIONS} />
            </div>
          )}
        </div>

        {/* Últimas revocaciones */}
        <div className="dash-top-card glass-panel">
          <h3><Ban size={15} /> Últimas revocaciones</h3>
          {revocaciones.length === 0 ? (
            <p className="dash-empty">Sin revocaciones recientes.</p>
          ) : (
            <div className="revoc-list">
              {revocaciones.map(r => (
                <div key={r.id} className="revoc-row">
                  <div className="revoc-info">
                    <span className="revoc-code">{r.codigo_unico}</span>
                    {r.titular && <span className="revoc-titular">{r.titular}</span>}
                  </div>
                  <div className="revoc-right">
                    <span className="revoc-motivo">{r.motivo_codigo?.replace(/_/g, ' ')}</span>
                    <span className="revoc-fecha">{formatDateTime(r.fecha_revocacion)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
