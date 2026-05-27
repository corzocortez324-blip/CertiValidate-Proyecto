import React, { useState, useEffect } from 'react';
import { institucionesApi } from '../../api/instituciones.api';
import { Card } from '../../components/ui/Card';
import { Activity, HelpCircle, RefreshCw, Info } from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider';
import { formatDateTime } from '../../utils/helpers';
import './IntegracionesPage.css';

function IntegracionCard({ inst }) {
  const [testing, setTesting] = useState(false);
  const [lastTested, setLastTested] = useState(null);
  const [testMsg, setTestMsg] = useState('');

  const probarConexion = async () => {
    setTesting(true);
    setTestMsg('');
    try {
      await institucionesApi.probarConexion(inst.id);
      setTestMsg('Conexión exitosa.');
    } catch (err) {
      setTestMsg(err?.message || 'Prueba de conexión pendiente de implementación en el backend.');
    } finally {
      setTesting(false);
      setLastTested(new Date());
    }
  };

  return (
    <div className="integ-card glass-panel integ-card--unknown" style={{ '--card-color': '#6b7280' }}>
      <div className="integ-card-header">
        <div className="integ-card-info">
          <div className="integ-icon-wrap" style={{ background: 'rgba(107,114,128,0.18)', borderColor: 'rgba(107,114,128,0.4)' }}>
            <Activity size={16} style={{ color: '#6b7280' }} />
          </div>
          <div>
            <p className="integ-name">{inst.nombre}</p>
            {inst.dominio && <span className="integ-domain">{inst.dominio}</span>}
          </div>
        </div>
        <div
          className="integ-status-badge"
          style={{ color: '#6b7280', background: 'rgba(107,114,128,0.15)', borderColor: 'rgba(107,114,128,0.35)' }}
        >
          <HelpCircle size={12} />
          {inst.activa ? 'Sin configurar' : 'Inactiva'}
        </div>
      </div>

      <div className="integ-footer">
        <span className="integ-last-tested">
          {lastTested
            ? `Probado: ${formatDateTime(lastTested)}`
            : 'Sin probar aún'}
        </span>
        <button
          className="btn-test-conexion"
          onClick={probarConexion}
          disabled={testing}
          type="button"
          title="Requiere endpoint de salud configurado en el backend"
        >
          <RefreshCw size={13} className={testing ? 'spin' : ''} />
          {testing ? 'Probando…' : 'Probar conexión'}
        </button>
      </div>

      {testMsg && (
        <p className="integ-test-msg" style={{ color: testMsg.includes('exitosa') ? '#10b981' : '#f59e0b' }}>
          {testMsg}
        </p>
      )}
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
      .then(data => setInstituciones(data?.data ?? []))
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
          <p className="page-subtitle">Conexión con sistemas externos por institución</p>
        </div>
      </div>

      <div className="integ-info-banner">
        <Info size={15} className="integ-info-icon" />
        <span>
          Este módulo permite conectar CertiValidate con una <strong>API académica externa</strong> para
          consultar estudiantes, cursos o certificados desde otro sistema institucional.
          El estado de cada integración depende de un endpoint de salud configurado en el backend.
          Si no está configurado, aparece como <strong>Sin configurar</strong>.
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="integ-loading">
          <RefreshCw size={20} className="spin" /> Cargando instituciones…
        </div>
      ) : instituciones.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '3rem' }}>
            No hay instituciones registradas. Crea una institución para configurar su integración.
          </div>
        </Card>
      ) : (
        <div className="integraciones-grid">
          {instituciones.map((inst) => (
            <IntegracionCard key={inst.id} inst={inst} />
          ))}
        </div>
      )}
    </div>
  );
};
