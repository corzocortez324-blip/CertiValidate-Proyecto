import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { integracionesApi } from '../../api/integraciones.api';
import { institucionesApi } from '../../api/instituciones.api';
import { useToast } from '../../components/ui/ToastProvider';
import { formatDateTime } from '../../utils/helpers';
import {
  ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock,
  HelpCircle, Users, FileText, BookOpen, Download,
} from 'lucide-react';
import './IntegracionDetallePage.css';

const STATUS_CONFIG = {
  conectado: {
    label: 'Conectado',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.30)',
    Icon: CheckCircle,
  },
  pendiente: {
    label: 'Pendiente',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.30)',
    Icon: Clock,
  },
  error: {
    label: 'Error',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.30)',
    Icon: XCircle,
  },
  sin_configurar: {
    label: 'Sin configurar',
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.10)',
    border: 'rgba(107,114,128,0.28)',
    Icon: HelpCircle,
  },
};

const TABS = [
  { id: 'estudiantes', label: 'Estudiantes externos', Icon: Users },
  { id: 'certificados', label: 'Certificados externos', Icon: FileText },
  { id: 'plantillas', label: 'Plantillas externas', Icon: BookOpen },
];

const COLS = {
  estudiantes: [
    { key: 'documento', label: 'Documento' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'apellido', label: 'Apellido' },
    { key: 'email', label: 'Email' },
    { key: 'programa', label: 'Programa' },
    { key: 'estado', label: 'Estado', type: 'badge' },
  ],
  certificados: [
    { key: 'codigo', label: 'Código' },
    { key: 'estudiante_nombre', label: 'Estudiante' },
    { key: 'curso', label: 'Curso' },
    { key: 'fecha_emision', label: 'Emisión', type: 'date' },
    { key: 'estado', label: 'Estado', type: 'badge' },
    { key: 'plantilla_id', label: 'Plantilla' },
  ],
  plantillas: [
    { key: 'id', label: 'ID' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'variables', label: 'Variables', type: 'array' },
    { key: 'activa', label: 'Activa', type: 'bool' },
  ],
};

const ESTADO_COLORS = {
  GRADUADO: '#10b981',
  ACTIVO: '#6366f1',
  DISPONIBLE: '#10b981',
  PENDIENTE: '#f59e0b',
  INACTIVO: '#6b7280',
  CANCELADO: '#ef4444',
};

const TAB_EMPTY = {
  estudiantes: {
    Icon: Users,
    title: 'No hay estudiantes externos',
    sub: 'La API externa no devolvió registros de estudiantes para esta institución.',
  },
  certificados: {
    Icon: FileText,
    title: 'No hay certificados externos',
    sub: 'La API externa no devolvió registros de certificados para esta institución.',
  },
  plantillas: {
    Icon: BookOpen,
    title: 'No hay plantillas externas',
    sub: 'La API externa no devolvió plantillas disponibles para esta institución.',
  },
};

function CellValue({ col, value }) {
  if (value === null || value === undefined || value === '') {
    return <span className="det-cell-empty">—</span>;
  }

  if (col.type === 'badge') {
    const key = String(value).toUpperCase();
    const color = ESTADO_COLORS[key] || '#6b7280';
    return (
      <span
        className="det-cell-badge"
        style={{ color, background: `${color}18`, borderColor: `${color}33` }}
      >
        {value}
      </span>
    );
  }

  if (col.type === 'bool') {
    return value ? (
      <span className="det-cell-badge" style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }}>
        Sí
      </span>
    ) : (
      <span className="det-cell-badge" style={{ color: '#6b7280', background: 'rgba(107,114,128,0.1)', borderColor: 'rgba(107,114,128,0.28)' }}>
        No
      </span>
    );
  }

  if (col.type === 'array') {
    const arr = Array.isArray(value) ? value : [];
    if (arr.length === 0) return <span className="det-cell-empty">—</span>;
    return <span className="det-cell-tags">{arr.join(', ')}</span>;
  }

  if (col.type === 'date') {
    try {
      return (
        <span>
          {new Date(value).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      );
    } catch {
      return <span>{value}</span>;
    }
  }

  return <span className="det-cell-text">{String(value)}</span>;
}

function DataTable({ cols, rows }) {
  return (
    <div className="det-table-wrap">
      <table className="det-table">
        <thead>
          <tr>
            {cols.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((col) => (
                <td key={col.key}>
                  <CellValue col={col} value={row[col.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyTabState({ tab }) {
  const { Icon, title, sub } = TAB_EMPTY[tab] || TAB_EMPTY.estudiantes;
  return (
    <div className="det-empty">
      <div className="det-empty-icon">
        <Icon size={28} />
      </div>
      <p className="det-empty-title">{title}</p>
      <p className="det-empty-sub">{sub}</p>
    </div>
  );
}

export function IntegracionDetallePage() {
  const { institucionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [instNombre, setInstNombre] = useState(location.state?.nombre || '');
  const [status, setStatus] = useState('pendiente');
  const [resumen, setResumen] = useState(null);
  const [loadingHeader, setLoadingHeader] = useState(true);

  const [activeTab, setActiveTab] = useState('estudiantes');
  const [tabData, setTabData] = useState({ estudiantes: null, certificados: null, plantillas: null });
  const [tabLoading, setTabLoading] = useState({});
  const loadedTabs = useRef(new Set());

  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!instNombre) {
      institucionesApi
        .getById(institucionId)
        .then((inst) => setInstNombre(inst?.nombre || 'Institución'))
        .catch(() => setInstNombre('Institución'));
    }

    integracionesApi
      .getResumen(institucionId)
      .then((data) => {
        setResumen(data);
        setStatus(data?.estado || 'conectado');
      })
      .catch((err) => {
        setStatus(err?.statusCode === 404 ? 'sin_configurar' : 'error');
      })
      .finally(() => setLoadingHeader(false));
  }, [institucionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTab = useCallback(
    async (tab) => {
      if (loadedTabs.current.has(tab)) return;
      loadedTabs.current.add(tab);

      setTabLoading((prev) => ({ ...prev, [tab]: true }));
      try {
        let result;
        if (tab === 'estudiantes') result = await integracionesApi.getEstudiantesExternos(institucionId);
        else if (tab === 'certificados') result = await integracionesApi.getCertificadosExternos(institucionId);
        else if (tab === 'plantillas') result = await integracionesApi.getPlantillasExternas(institucionId);

        const list = result?.data ?? (Array.isArray(result) ? result : []);
        setTabData((prev) => ({ ...prev, [tab]: list }));
      } catch (err) {
        loadedTabs.current.delete(tab);
        showToast(err?.message || `Error al cargar ${tab}.`, 'error');
        setTabData((prev) => ({ ...prev, [tab]: [] }));
      } finally {
        setTabLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [institucionId, showToast],
  );

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  const probarConexion = async () => {
    setTesting(true);
    try {
      const data = await integracionesApi.getResumen(institucionId);
      setResumen(data);
      setStatus(data?.estado || 'conectado');
      showToast('Conexión verificada correctamente.', 'success');
    } catch (err) {
      if (err?.statusCode === 404) {
        setStatus('sin_configurar');
        showToast('No hay integración externa configurada para esta institución.', 'error');
      } else {
        setStatus('error');
        showToast(err?.message || 'Error al probar conexión.', 'error');
      }
    } finally {
      setTesting(false);
    }
  };

  const sincronizar = async () => {
    setSyncing(true);
    try {
      const result = await integracionesApi.sincronizar(institucionId, [
        'estudiantes',
        'certificados',
        'plantillas',
      ]);
      const procesados = result?.entidades_procesadas ?? [];
      const detalle = procesados
        .map((e) => `${e.entidad}: ${(e.insertados ?? 0) + (e.actualizados ?? 0)} procesados`)
        .join(' | ');
      showToast(`Sincronización completada. ${detalle || 'Sin cambios.'}`, 'success');
      loadedTabs.current.clear();
      setTabData({ estudiantes: null, certificados: null, plantillas: null });
      loadTab(activeTab);
    } catch (err) {
      showToast(err?.message || 'Error al sincronizar.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendiente;
  const StatusIcon = cfg.Icon;
  const currentData = tabData[activeTab];
  const isTabLoading = !!tabLoading[activeTab];

  return (
    <div className="integ-detalle animate-fade-in">

      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="det-topbar">
        <button className="det-back-btn" onClick={() => navigate('/admin/integraciones')} type="button">
          <ArrowLeft size={15} />
          Integraciones
        </button>

        <div className="det-title-area">
          <h1 className="det-title">
            {instNombre || <span className="det-title-ph">Cargando…</span>}
          </h1>
          <span
            className="det-status-pill"
            style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
          >
            <StatusIcon size={12} />
            {cfg.label}
          </span>
        </div>

        <div className="det-header-actions">
          <button
            className="btn-det-test"
            onClick={probarConexion}
            disabled={testing}
            type="button"
          >
            <RefreshCw size={14} className={testing ? 'spin' : ''} />
            {testing ? 'Probando…' : 'Probar conexión'}
          </button>
          <button
            className="btn-det-sync"
            onClick={sincronizar}
            disabled={syncing}
            type="button"
          >
            <Download size={14} className={syncing ? 'spin' : ''} />
            {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {/* ── Resumen bar ──────────────────────────────────── */}
      {!loadingHeader && resumen && (
        <div className="det-resumen-bar">
          <div className="det-stat">
            <Users size={14} className="det-stat-icon" />
            <span className="det-stat-num">{resumen.estudiantes_externos ?? 0}</span>
            <span className="det-stat-label">Estudiantes</span>
          </div>
          <div className="det-stat-sep" />
          <div className="det-stat">
            <FileText size={14} className="det-stat-icon" />
            <span className="det-stat-num">{resumen.certificados_externos ?? 0}</span>
            <span className="det-stat-label">Certificados</span>
          </div>
          <div className="det-stat-sep" />
          <div className="det-stat">
            <BookOpen size={14} className="det-stat-icon" />
            <span className="det-stat-num">{resumen.plantillas_externas ?? 0}</span>
            <span className="det-stat-label">Plantillas</span>
          </div>
          {resumen.ultima_verificacion && (
            <span className="det-stat-ts">
              Verificado {formatDateTime(resumen.ultima_verificacion)}
            </span>
          )}
        </div>
      )}

      {/* ── Tab navigation ───────────────────────────────── */}
      <div className="det-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`det-tab${activeTab === id ? ' det-tab--active' : ''}`}
            onClick={() => setActiveTab(id)}
            type="button"
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────── */}
      <div className="det-content">
        {isTabLoading || currentData === null ? (
          <div className="det-loading">
            <RefreshCw size={18} className="spin" />
            Cargando datos desde la API externa…
          </div>
        ) : currentData.length === 0 ? (
          <EmptyTabState tab={activeTab} />
        ) : (
          <DataTable cols={COLS[activeTab]} rows={currentData} />
        )}
      </div>
    </div>
  );
}
