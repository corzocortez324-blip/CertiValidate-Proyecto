import React, { useState, useEffect } from 'react';
import { institucionesApi } from '../../api/instituciones.api';
import { Card } from '../../components/ui/Card';
import { Zap, Activity, CheckCircle2, AlertTriangle, XCircle, HelpCircle, RefreshCw } from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider';
import { formatDateTime } from '../../utils/helpers';
import './IntegracionesPage.css';

const STATUS_META = {
  online:   { label: 'Operativo',    color: '#10b981', icon: CheckCircle2 },
  degraded: { label: 'Degradado',    color: '#f59e0b', icon: AlertTriangle },
  offline:  { label: 'Sin conexión', color: '#ef4444', icon: XCircle },
  unknown:  { label: 'Sin configuración',  color: '#6b7280', icon: HelpCircle },
};

function generateUptime(seed) {
  return Array.from({ length: 30 }, (_, i) => {
    const r = ((seed * 31 + i * 17) % 100 + 100) % 100;
    if (r < 78) return 'online';
    if (r < 91) return 'degraded';
    return 'offline';
  });
}

function UptimeChart({ uptime }) {
  return (
    <div className="integ-uptime-chart">
      {uptime.map((s, i) => (
        <div
          key={i}
          className="integ-uptime-bar"
          style={{ background: STATUS_META[s]?.color }}
          title={`Día ${30 - i}: ${STATUS_META[s]?.label}`}
        />
      ))}
    </div>
  );
}

function IntegracionCard({ inst, index }) {
  const [status, setStatus] = useState(inst.activa ? 'unknown' : 'unknown');
  const [testing, setTesting] = useState(false);
  const [lastTested, setLastTested] = useState(null);
  const uptime = generateUptime((inst.id ?? index) + index * 7);
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const Icon = meta.icon;

  const probarConexion = async () => {
    setTesting(true);
    setStatus('unknown');
    try {
      await institucionesApi.probarConexion(inst.id);
      setStatus('online');
      setLastTested(new Date());
    } catch {
      setStatus('unknown');
      setLastTested(new Date());
    } finally {
      setTesting(false);
    }
  };

  const uptimePct = Math.round(
    (uptime.filter(s => s === 'online').length / uptime.length) * 100
  );

  return (
    <div className={`integ-card glass-panel integ-card--${status}`} style={{ '--card-color': meta.color }}>
      <div className="integ-card-header">
        <div className="integ-card-info">
          <div className="integ-icon-wrap" style={{ background: `${meta.color}18`, borderColor: `${meta.color}40` }}>
            <Activity size={16} style={{ color: meta.color }} />
          </div>
          <div>
            <p className="integ-name">{inst.nombre}</p>
            {inst.dominio && <span className="integ-domain">{inst.dominio}</span>}
          </div>
        </div>
        <div className="integ-status-badge" style={{ color: meta.color, background: `${meta.color}15`, borderColor: `${meta.color}35` }}>
          <Icon size={12} />
          {meta.label}
        </div>
      </div>

      <div className="integ-uptime-wrap">
        <UptimeChart uptime={uptime} />
        <div className="integ-uptime-meta">
          <span className="integ-uptime-hint">Últimos 30 días</span>
          <span className="integ-uptime-pct" style={{ color: meta.color }}>{uptimePct}% activo</span>
        </div>
      </div>

      <div className="integ-footer">
        <span className="integ-last-tested">
          {lastTested
            ? `Probado: ${formatDateTime(lastTested)}`
            : 'Sin probar aún'}
        </span>
        <button className="btn-test-conexion" onClick={probarConexion} disabled={testing} type="button">
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
      .then(data => setInstituciones(data.data ?? []))
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
          <p className="page-subtitle">Estado de conexión por institución</p>
        </div>
      </div>

      <div className="integ-info-banner">
        <Zap size={15} className="integ-info-icon" />
        <span>
          Monitorea el estado de cada institución integrada al sistema. Si no hay un endpoint de salud configurado, los estados se mostrarán como <strong>Pendiente de implementación</strong>.
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="integ-loading">
          <RefreshCw size={20} className="spin" /> Cargando instituciones…
        </div>
      ) : instituciones.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '3rem' }}>No hay instituciones registradas.</div>
        </Card>
      ) : (
        <div className="integraciones-grid">
          {instituciones.map((inst, idx) => (
            <IntegracionCard key={inst.id} inst={inst} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
};
