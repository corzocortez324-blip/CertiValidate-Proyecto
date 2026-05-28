import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { institucionesApi } from '../../api/instituciones.api';
import { integracionesApi } from '../../api/integraciones.api';
import {
  RefreshCw, Settings, Link2, AlertCircle, Eye,
  CheckCircle, XCircle, Clock, HelpCircle,
  Plus, Pencil, Trash2, X, Info,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider';
import { formatDateTime } from '../../utils/helpers';
import './IntegracionesPage.css';

const STATUS_CONFIG = {
  sin_configurar: {
    label: 'Sin configurar',
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.10)',
    border: 'rgba(107,114,128,0.28)',
    cardBorder: 'rgba(107,114,128,0.15)',
    Icon: HelpCircle,
  },
  configurada: {
    label: 'Configurada',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.30)',
    cardBorder: 'rgba(245,158,11,0.18)',
    Icon: Clock,
  },
  conectada: {
    label: 'Conectada',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.30)',
    cardBorder: 'rgba(16,185,129,0.22)',
    Icon: CheckCircle,
  },
  error: {
    label: 'Error',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.30)',
    cardBorder: 'rgba(239,68,68,0.22)',
    Icon: XCircle,
  },
};

const TIPOS = ['REST', 'SOAP', 'GraphQL'];

// ── Avatar ─────────────────────────────────────────────────────────────────────
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

// ── Modal configurar / editar ──────────────────────────────────────────────────
function IntegModal({ open, mode, inst, integracion, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({ tipo: 'REST', url_base: '', api_key: '', activa: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (mode === 'editar' && integracion) {
      setForm({
        tipo: integracion.tipo || 'REST',
        url_base: integracion.url_base || '',
        api_key: '',
        activa: integracion.activa !== false,
      });
    } else {
      setForm({ tipo: 'REST', url_base: '', api_key: '', activa: true });
    }
    setFormError('');
    setTimeout(() => firstInputRef.current?.focus(), 60);
  }, [open, mode, integracion]);

  const set = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.url_base.trim()) {
      setFormError('La URL base de la API es obligatoria.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      let result;
      if (mode === 'crear') {
        result = await integracionesApi.crear({
          institucion_id: inst.id,
          tipo: form.tipo,
          url_base: form.url_base.trim(),
          ...(form.api_key.trim() && { api_key: form.api_key.trim() }),
          activa: form.activa,
        });
      } else {
        const data = { tipo: form.tipo, url_base: form.url_base.trim(), activa: form.activa };
        if (form.api_key.trim()) data.api_key = form.api_key.trim();
        result = await integracionesApi.actualizar(integracion.id, data);
      }
      showToast(
        mode === 'crear'
          ? 'Integración configurada correctamente.'
          : 'Integración actualizada correctamente.',
        'success',
      );
      onSaved(result);
      onClose();
    } catch (err) {
      setFormError(err?.message || 'Error al guardar la integración.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="integ-modal-overlay" onClick={onClose}>
      <div
        className="integ-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="integ-modal-header">
          <div className="integ-modal-title" id="modal-title">
            <Settings size={15} />
            {mode === 'crear' ? 'Configurar integración' : 'Editar integración'}
          </div>
          <button className="integ-modal-close" onClick={onClose} type="button" aria-label="Cerrar">
            <X size={15} />
          </button>
        </div>

        {inst && (
          <div className="integ-modal-inst">
            <Link2 size={11} />
            {inst.nombre}
          </div>
        )}

        <form onSubmit={handleSubmit} className="integ-modal-form" noValidate>
          <div className="integ-field">
            <label className="integ-label">Tipo de integración</label>
            <select
              className="integ-select"
              value={form.tipo}
              onChange={(e) => set('tipo', e.target.value)}
            >
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="integ-field">
            <label className="integ-label">
              URL base de la API <span className="integ-req">*</span>
            </label>
            <input
              ref={firstInputRef}
              type="url"
              className="integ-input"
              placeholder="https://api.miinstitucion.edu.co"
              value={form.url_base}
              onChange={(e) => set('url_base', e.target.value)}
              required
            />
          </div>

          <div className="integ-field">
            <label className="integ-label">
              API Key
              {mode === 'editar' && (
                <span className="integ-hint"> — deja en blanco para no cambiarla</span>
              )}
            </label>
            <input
              type="password"
              className="integ-input"
              placeholder={mode === 'editar' ? '••••••••••••' : 'sk-...'}
              value={form.api_key}
              onChange={(e) => set('api_key', e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="integ-field integ-field--row">
            <label className="integ-label">Activa</label>
            <button
              type="button"
              className={`integ-toggle${form.activa ? ' integ-toggle--on' : ''}`}
              onClick={() => set('activa', !form.activa)}
              aria-pressed={form.activa}
            >
              <span className="integ-toggle-knob" />
            </button>
          </div>

          {formError && (
            <div className="integ-form-error">
              <AlertCircle size={13} />
              {formError}
            </div>
          )}

          <div className="integ-modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal-save" disabled={saving}>
              {saving
                ? <><RefreshCw size={13} className="spin" /> Guardando…</>
                : <><Settings size={13} /> {mode === 'crear' ? 'Configurar' : 'Guardar cambios'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal eliminar ─────────────────────────────────────────────────────────────
function DeleteModal({ open, inst, onClose, onConfirm, deleting }) {
  if (!open) return null;
  return (
    <div className="integ-modal-overlay" onClick={onClose}>
      <div
        className="integ-modal integ-modal--sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="integ-modal-header">
          <div className="integ-modal-title integ-modal-title--danger">
            <Trash2 size={15} />
            Eliminar integración
          </div>
          <button className="integ-modal-close" onClick={onClose} type="button" aria-label="Cerrar">
            <X size={15} />
          </button>
        </div>
        <div className="integ-modal-body">
          <p className="integ-delete-msg">
            ¿Estás seguro de que deseas eliminar la integración de{' '}
            <strong>{inst?.nombre}</strong>? Esta acción no se puede deshacer y
            perderás la configuración guardada.
          </p>
        </div>
        <div className="integ-modal-actions">
          <button className="btn-modal-cancel" onClick={onClose} type="button">Cancelar</button>
          <button className="btn-modal-delete" onClick={onConfirm} disabled={deleting} type="button">
            {deleting
              ? <><RefreshCw size={13} className="spin" /> Eliminando…</>
              : <><Trash2 size={13} /> Eliminar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────────
function IntegracionCard({
  inst,
  integracion,
  connStatus,
  testMsg,
  testing,
  onConfig,
  onEdit,
  onDelete,
  onTest,
}) {
  const navigate = useNavigate();

  let status;
  if (!integracion) {
    status = 'sin_configurar';
  } else if (connStatus) {
    status = connStatus;
  } else {
    status = 'configurada';
  }

  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.Icon;
  const canViewData = status === 'conectada';

  return (
    <div className={`integ-card integ-card--${status}`} style={{ borderColor: cfg.cardBorder }}>
      <div className="integ-card-accent" style={{ background: cfg.color }} />

      {/* Header */}
      <div className="integ-card-header">
        <InstAvatar nombre={inst.nombre} color={cfg.color} />
        <div className="integ-card-info">
          <p className="integ-name" title={inst.nombre}>{inst.nombre}</p>
          <span className="integ-domain">
            {integracion?.url_base
              ? <><Link2 size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{integracion.url_base}</>
              : 'Sin integración configurada'}
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

      {/* Meta */}
      {!integracion ? (
        <div className="integ-no-config-msg">
          <HelpCircle size={14} />
          Debes configurar una integración primero para acceder a datos externos.
        </div>
      ) : (
        <div className="integ-meta">
          <div className="integ-meta-row">
            <span className="integ-meta-label">Tipo</span>
            <span className="integ-meta-value">{integracion.tipo || 'REST'}</span>
          </div>
          <div className="integ-meta-row">
            <span className="integ-meta-label">Activa</span>
            <span className="integ-meta-value">
              {integracion.activa
                ? <span style={{ color: '#10b981' }}>Sí</span>
                : <span style={{ color: '#6b7280' }}>No</span>}
            </span>
          </div>
          {integracion.ultima_verificacion && (
            <div className="integ-meta-row">
              <span className="integ-meta-label">Última prueba</span>
              <span className="integ-meta-value">{formatDateTime(integracion.ultima_verificacion)}</span>
            </div>
          )}
        </div>
      )}

      {/* Test result message */}
      {testMsg && (
        <div className={`integ-test-msg integ-test-msg--${status}`}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {testMsg}
        </div>
      )}

      {/* Footer */}
      <div className="integ-footer">
        {!integracion ? (
          <button
            className="btn-configurar-primary"
            onClick={() => onConfig(inst)}
            type="button"
          >
            <Plus size={13} />
            Configurar integración
          </button>
        ) : (
          <>
            <div className="integ-footer-left">
              <button
                className="btn-icon btn-icon--edit"
                onClick={() => onEdit(inst, integracion)}
                type="button"
                title="Editar integración"
              >
                <Pencil size={13} />
              </button>
              <button
                className="btn-icon btn-icon--delete"
                onClick={() => onDelete(inst, integracion)}
                type="button"
                title="Eliminar integración"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="integ-footer-right">
              <button
                className="btn-test-conexion"
                onClick={() => onTest(inst.id)}
                disabled={testing}
                type="button"
              >
                <RefreshCw size={13} className={testing ? 'spin' : ''} />
                {testing ? 'Probando…' : 'Probar conexión'}
              </button>
              <button
                className="btn-ver-datos"
                onClick={() =>
                  navigate(`/admin/integraciones/${inst.id}`, { state: { nombre: inst.nombre } })
                }
                disabled={!canViewData}
                type="button"
                title={!canViewData ? 'Prueba la conexión primero para habilitar esta opción' : 'Ver datos externos'}
              >
                <Eye size={13} />
                Ver datos
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export const IntegracionesPage = () => {
  const [instituciones, setInstituciones] = useState([]);
  const [integraciones, setIntegraciones] = useState({});
  const [connStates, setConnStates] = useState({});
  const [testMsgs, setTestMsgs] = useState({});
  const [testingIds, setTestingIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const [modal, setModal] = useState({ open: false, mode: 'crear', inst: null, integracion: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, inst: null, integracion: null });
  const [deleting, setDeleting] = useState(false);

  const cargarIntegraciones = useCallback(async (insts) => {
    const results = await Promise.allSettled(
      insts.map((inst) => integracionesApi.obtener(inst.id)),
    );
    const map = {};
    insts.forEach((inst, i) => {
      map[inst.id] = results[i].status === 'fulfilled' ? results[i].value : null;
    });
    setIntegraciones(map);
  }, []);

  useEffect(() => {
    setLoading(true);
    institucionesApi
      .listar({ limit: 50 })
      .then(async (data) => {
        const insts = data?.data ?? [];
        setInstituciones(insts);
        await cargarIntegraciones(insts);
      })
      .catch((err) => {
        setError(err.message || 'No fue posible cargar las instituciones.');
        showToast('Error al cargar integraciones.', 'error');
      })
      .finally(() => setLoading(false));
  }, [showToast, cargarIntegraciones]);

  const handleTest = useCallback(async (institucionId) => {
    setTestingIds((prev) => new Set([...prev, institucionId]));
    setTestMsgs((prev) => ({ ...prev, [institucionId]: '' }));
    try {
      await integracionesApi.getResumen(institucionId);
      setConnStates((prev) => ({ ...prev, [institucionId]: 'conectada' }));
      setTestMsgs((prev) => ({ ...prev, [institucionId]: 'Conexión exitosa.' }));
      showToast('Conexión exitosa con la API académica.', 'success');
    } catch (err) {
      const msg = err?.message || 'No fue posible establecer conexión.';
      const isAuth =
        err?.statusCode === 401 ||
        err?.statusCode === 403 ||
        msg.toLowerCase().includes('autenti') ||
        msg.toLowerCase().includes('api key');
      const displayMsg = isAuth
        ? 'Error de autenticación API. Verifica tu API Key.'
        : msg;
      setConnStates((prev) => ({ ...prev, [institucionId]: 'error' }));
      setTestMsgs((prev) => ({ ...prev, [institucionId]: displayMsg }));
      showToast(displayMsg, 'error');
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(institucionId);
        return next;
      });
    }
  }, [showToast]);

  const handleSaved = useCallback((result, institucionId) => {
    setIntegraciones((prev) => ({ ...prev, [institucionId]: { configurada: true, ...result } }));
    setConnStates((prev) => { const n = { ...prev }; delete n[institucionId]; return n; });
    setTestMsgs((prev) => { const n = { ...prev }; delete n[institucionId]; return n; });
  }, []);

  const handleDelete = useCallback(async () => {
    const { inst, integracion } = deleteModal;
    setDeleting(true);
    try {
      await integracionesApi.eliminar(integracion.id);
      setIntegraciones((prev) => ({ ...prev, [inst.id]: null }));
      setConnStates((prev) => { const n = { ...prev }; delete n[inst.id]; return n; });
      setTestMsgs((prev) => { const n = { ...prev }; delete n[inst.id]; return n; });
      showToast('Integración eliminada correctamente.', 'success');
      setDeleteModal({ open: false, inst: null, integracion: null });
    } catch (err) {
      showToast(err?.message || 'Error al eliminar la integración.', 'error');
    } finally {
      setDeleting(false);
    }
  }, [deleteModal, showToast]);

  const closeModal = useCallback(() => setModal((p) => ({ ...p, open: false })), []);
  const closeDelete = useCallback(
    () => setDeleteModal({ open: false, inst: null, integracion: null }),
    [],
  );

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
          <strong>Configuración manual requerida</strong>
          <span>
            Cada institución debe tener su integración configurada con la URL de su API académica
            y una API Key válida. Sin configuración no se puede consultar ni sincronizar datos externos.
          </span>
        </div>
      </div>

      <div className="integ-legend">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.Icon;
          return (
            <span key={key} className="integ-legend-item">
              <Icon size={12} style={{ color: cfg.color }} />
              {cfg.label}
            </span>
          );
        })}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="integ-loading">
          <RefreshCw size={20} className="spin" />
          Cargando instituciones…
        </div>
      ) : instituciones.length === 0 ? (
        <div className="integ-empty">
          <div className="integ-empty-icon"><Settings size={32} /></div>
          <p className="integ-empty-title">No hay instituciones registradas</p>
          <p className="integ-empty-sub">
            Crea una institución en el módulo de Instituciones para poder configurar su integración.
          </p>
        </div>
      ) : (
        <div className="integraciones-grid">
          {instituciones.map((inst) => (
            <IntegracionCard
              key={inst.id}
              inst={inst}
              integracion={integraciones[inst.id] ?? null}
              connStatus={connStates[inst.id]}
              testMsg={testMsgs[inst.id] || ''}
              testing={testingIds.has(inst.id)}
              onConfig={(i) => setModal({ open: true, mode: 'crear', inst: i, integracion: null })}
              onEdit={(i, intg) => setModal({ open: true, mode: 'editar', inst: i, integracion: intg })}
              onDelete={(i, intg) => setDeleteModal({ open: true, inst: i, integracion: intg })}
              onTest={handleTest}
            />
          ))}
        </div>
      )}

      <IntegModal
        open={modal.open}
        mode={modal.mode}
        inst={modal.inst}
        integracion={modal.integracion}
        onClose={closeModal}
        onSaved={(result) => handleSaved(result, modal.inst?.id)}
        showToast={showToast}
      />

      <DeleteModal
        open={deleteModal.open}
        inst={deleteModal.inst}
        onClose={closeDelete}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
};
