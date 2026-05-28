import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { institucionesApi } from '../../api/instituciones.api';
import {
  RefreshCw, Info, CheckCircle, XCircle, Clock,
  HelpCircle, Settings, Link2, AlertCircle,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider';
import { formatDateTime } from '../../utils/helpers';
import './IntegracionesPage.css';

const STATUS_CONFIG = {
  conectado: {
    label: 'Conectado',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.30)',
    cardBorder: 'rgba(16,185,129,0.22)',
    Icon: CheckCircle,
  },
  pendiente: {
    label: 'Pendiente',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.30)',
    cardBorder: 'rgba(245,158,11,0.18)',
    Icon: Clock,
  },
  error: {
    label: 'Error',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.30)',
    cardBorder: 'rgba(239,68,68,0.22)',
    Icon: XCircle,
  },
  sin_configurar: {
    label: 'Sin configurar',
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.10)',
    border: 'rgba(107,114,128,0.28)',
    cardBorder: 'rgba(107,114,128,0.18)',
    Icon: HelpCircle,
  },
};

function getInitialStatus(inst) {
  if (!inst.dominio || !inst.activa) return 'sin_configurar';
  return 'pendiente';
}

function InstAvatar({ nombre, color }) {
  const initials = nombre
    ?.split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
  return (
    <div
      className="integ-avatar"
      style={{ background: `${color}1a`, borderColor: `${color}44`, color }}
    >
      {initials}
    </div>
  );
}

function IntegracionCard({ inst, showToast }) {
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [lastTested, setLastTested] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testMsg, setTestMsg] = useState('');

  const status = testResult ?? getInitialStatus(inst);
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.Icon;

  const probarConexion = async () => {
    setTesting(true);
    setTestMsg('');
    try {
      await institucionesApi.probarConexion(inst.id);
      setTestResult('conectado');
      setTestMsg('Conexión verificada correctamente.');
      showToast('Conexión exitosa con la API académica.', 'success');
    } catch (err) {
      let msg = err?.message || 'No fue posible establecer conexión.';
      if (err instanceof TypeError || err?.name === 'TypeError') {
        msg = 'Error de red. Verifica tu conexión e intenta de nuevo.';
      }
      setTestResult('error');
      setTestMsg(msg);
      showToast(msg, 'error');
    } finally {
      setTesting(false);
      setLastTested(new Date());
    }
  };

  return (
    <div
      className={`integ-card integ-card--${status}`}
      style={{ borderColor: cfg.cardBorder }}
    >
      <div className="integ-card-accent" style={{ background: cfg.color }} />

      <div className="integ-card-header">
        <InstAvatar nombre={inst.nombre} color={cfg.color} />
        <div className="integ-card-info">
          <p className="integ-name" title={inst.nombre}>{inst.nombre}</p>
          <span className="integ-domain">
            {inst.dominio
              ? <><Link2 size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{inst.dominio}</>
              : 'Sin dominio configurado'}
          </span>
        </div>
        <div
          className="integ-status-badge"
          style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
        >
          <StatusIcon size={11} />
          {cfg.label}
        </div>
      </div>

      <div className="integ-meta">
        <div className="integ-meta-row">
          <span className="integ-meta-label">Estado API</span>
          <span className="integ-meta-value" style={{ color: cfg.color, fontWeight: 600 }}>
            {cfg.label}
          </span>
        </div>
        <div className="integ-meta-row">
          <span className="integ-meta-label">Institución</span>
          <span className="integ-meta-value">
            {inst.activa
              ? <span style={{ color: '#10b981' }}>Activa</span>
              : <span style={{ color: '#6b7280' }}>Inactiva</span>}
          </span>
        </div>
        <div className="integ-meta-row">
          <span className="integ-meta-label">Última prueba</span>
          <span className="integ-meta-value">
            {lastTested ? formatDateTime(lastTested) : '—'}
          </span>
        </div>
      </div>

      {testMsg && (
        <div className={`integ-test-msg integ-test-msg--${testResult}`}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {testMsg}
        </div>
      )}

      <div className="integ-footer">
        {status === 'sin_configurar' && (
          <button
            className="btn-configurar"
            onClick={() => navigate('/admin/instituciones')}
            type="button"
          >
            <Settings size={13} />
            Configurar
          </button>
        )}
        <button
          className="btn-test-conexion"
          onClick={probarConexion}
          disabled={testing}
          type="button"
          title={!inst.dominio ? 'Configure un dominio primero en Instituciones' : 'Probar conexión con el API externo'}
          style={{ marginLeft: status !== 'sin_configurar' ? 'auto' : undefined }}
        >
          <RefreshCw size={13} className={testing ? 'spin' : ''} />
          {testing ? 'Probando…' : 'Probar conexión'}
        </button>
      </div>
    </div>
  );
}

export const IntegracionesPage = () => {
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    institucionesApi.listar({ limit: 50 })
      .then((data) => setInstituciones(data?.data ?? []))
      .catch((err) => {
        setError(err.message || 'No fue posible cargar las instituciones.');
        showToast('Error al cargar integraciones.', 'error');
      })
      .finally(() => setLoading(false));
  }, [showToast]);

  return (
    <div className="integraciones-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Integraciones</h1>
          <p className="page-subtitle">
            Conexión de CertiValidate con APIs académicas externas por institución
          </p>
        </div>
      </div>

      <div className="integ-info-banner">
        <Info size={16} className="integ-info-icon" />
        <div className="integ-info-content">
          <strong>¿Qué hace este módulo?</strong>
          <span>
            Permite conectar CertiValidate con la <strong>API académica externa</strong> de cada
            institución para consultar en tiempo real datos de estudiantes, cursos y certificados
            registrados en sistemas de terceros. El estado de cada integración refleja la última
            verificación del endpoint de salud configurado en el backend.
            Si aún no está configurado, aparece como <strong>Sin configurar</strong> o{' '}
            <strong>Pendiente</strong>.
          </span>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {loading ? (
        <div className="integ-loading">
          <RefreshCw size={20} className="spin" />
          Cargando instituciones…
        </div>
      ) : instituciones.length === 0 ? (
        <div className="integ-empty">
          <div className="integ-empty-icon">
            <Settings size={32} />
          </div>
          <p className="integ-empty-title">No hay instituciones registradas</p>
          <p className="integ-empty-sub">
            Crea una institución en el módulo de Instituciones para poder configurar su integración.
          </p>
        </div>
      ) : (
        <div className="integraciones-grid">
          {instituciones.map((inst) => (
            <IntegracionCard key={inst.id} inst={inst} showToast={showToast} />
          ))}
        </div>
      )}
    </div>
  );
};
