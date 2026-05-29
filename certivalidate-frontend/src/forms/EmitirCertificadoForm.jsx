import React, { useState, useEffect, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  Search, User, AlertTriangle, CheckCircle2, XCircle, WifiOff,
  FileText, Eye, X, AlertCircle,
} from 'lucide-react';
import { estudiantesApi } from '../api/estudiantes.api';
import { plantillasApi } from '../api/plantillas.api';
import { Button } from '../components/ui/Button';

function fillPreview(html, data = {}) {
  const hoy  = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const nombre   = data.nombre   || 'Nombre';
  const apellido = data.apellido || 'Apellido';
  const plantilla = data.plantilla || 'Nombre del Programa';
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=111827&bgcolor=ffffff&data=CERT-2026-PREVIEW`;

  const replacements = {
    '{{nombre}}':           `${nombre} ${apellido}`.trim(),
    '{{apellido}}':         apellido,
    '{{nombre_completo}}':  `${nombre} ${apellido}`.trim(),
    '{{documento}}':        data.documento  || '123456789',
    '{{email}}':            data.email      || 'estudiante@ejemplo.com',
    '{{codigo_unico}}':     'CERT-2026-PREVIEW',
    '{{codigo}}':           'CERT-2026-PREVIEW',
    '{{fecha_emision}}':    hoy,
    '{{fecha_expiracion}}': 'Sin expiración',
    '{{plantilla}}':        plantilla,
    '{{curso}}':            plantilla,
    '{{programa}}':         plantilla,
    '{{institucion}}':      data.institucion || 'Institución',
    '{{version}}':          data.version     || '1',
    '{{hash}}':             'a1b2c3d4e5f6g7h8…',
    '{{qr}}':               `<img src="${qrSrc}" width="120" height="120" alt="QR" style="border-radius:4px;display:block;"/>`,
  };
  let filled = html;
  for (const [key, val] of Object.entries(replacements)) {
    filled = filled.replaceAll(key, val);
  }
  return filled;
}

/* ── Modal de confirmación con vista previa ─────────────────────── */
function PreviewConfirmModal({ previewHtml, loading, onCancel, onConfirm }) {
  return (
    <div className="pcm-overlay" onClick={onCancel}>
      <div className="pcm-dialog glass-panel animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="pcm-header">
          <div className="pcm-header-title">
            <Eye size={16} />
            Vista previa del certificado
          </div>
          <button className="pcm-close" type="button" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>

        <div className="pcm-body">
          {loading ? (
            <div className="pcm-skeleton">
              <div className="pcm-skeleton-bar" style={{ width: '60%' }} />
              <div className="pcm-skeleton-bar" style={{ width: '80%' }} />
              <div className="pcm-skeleton-bar" style={{ width: '45%' }} />
              <div className="pcm-skeleton-rect" />
            </div>
          ) : previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              title="Vista previa del certificado"
              className="pcm-iframe"
              sandbox="allow-same-origin"
              onLoad={e => {
                const iframe = e.target;
                const doc    = iframe.contentDocument;
                if (!doc) return;
                const body = doc.body;
                const contentW = Math.max(body.scrollWidth, body.offsetWidth, doc.documentElement.scrollWidth);
                const iframeW  = iframe.offsetWidth;
                if (contentW > iframeW + 4) {
                  const scale = iframeW / contentW;
                  body.style.transformOrigin = 'top left';
                  body.style.transform = `scale(${scale})`;
                  body.style.width = `${contentW}px`;
                  const scaledH = body.scrollHeight * scale;
                  iframe.style.height = `${Math.max(scaledH, 480)}px`;
                } else {
                  iframe.style.height = `${Math.max(body.scrollHeight, 480)}px`;
                }
              }}
            />
          ) : (
            <div className="pcm-no-preview">
              <FileText size={32} />
              <p>Vista previa no disponible para esta plantilla.</p>
            </div>
          )}
        </div>

        <div className="pcm-warning">
          <AlertCircle size={14} />
          <span>
            Al confirmar, el certificado será <strong>emitido y registrado permanentemente</strong> en el sistema y en la blockchain.
            Esta acción no se puede deshacer.
          </span>
        </div>

        <div className="pcm-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Volver a editar
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            Confirmar emisión
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Formulario principal ───────────────────────────────────────── */
export const EmitirCertificadoForm = ({
  form,
  setForm,
  onSubmit,
  onCancel,
  loading,
  instituciones = [],
  plantillas = [],
}) => {
  const [query, setQuery]               = useState('');
  const [suggestions, setSuggestions]   = useState([]);
  const [searching, setSearching]       = useState(false);
  const [showDrop, setShowDrop]         = useState(false);
  const [selectedStudent, setSelected]  = useState(null);
  const [searchError, setSearchError]   = useState('');
  const [searchWarn, setSearchWarn]     = useState('');
  const [desdeCache, setDesdeCache]     = useState(false);
  const [previewHtml, setPreviewHtml]   = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const dropRef                         = useRef(null);
  const debounceRef                     = useRef(null);

  const instPlantillas = useMemo(
    () => plantillas.filter(p => String(p.institucion_id) === String(form.institucion_id) && p.activa),
    [plantillas, form.institucion_id]
  );

  const previewData = useMemo(() => {
    const inst = instituciones.find(i => String(i.id) === String(form.institucion_id));
    const plantilla = instPlantillas.find(p => String(p.id) === String(form.plantilla_id));
    return {
      nombre:      selectedStudent?.nombre     || '',
      apellido:    selectedStudent?.apellido   || '',
      documento:   selectedStudent?.documento  || '',
      email:       selectedStudent?.email      || '',
      institucion: inst?.nombre                || '',
      plantilla:   plantilla?.nombre           || '',
      version:     plantilla?.version          || '1',
    };
  }, [selectedStudent, form.institucion_id, form.plantilla_id, instituciones, instPlantillas]);

  const previewSource = useMemo(() => {
    if (!previewHtml) return '';
    const filled = previewHtml;
    return DOMPurify.sanitize(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box;}html,body{margin:0;padding:0;background:#fff;}</style></head><body>${filled}</body></html>`,
      { USE_PROFILES: { html: true } }
    );
  }, [previewHtml]);

  useEffect(() => {
    setPreviewHtml('');
    if (!form.plantilla_id) return;
    const local = instPlantillas.find(p => String(p.id) === String(form.plantilla_id));
    if (local?.template_html) {
      setPreviewHtml(fillPreview(local.template_html, previewData));
      return;
    }
    setLoadingPreview(true);
    plantillasApi.getById(form.plantilla_id)
      .then(data => { if (data?.template_html) setPreviewHtml(fillPreview(data.template_html, previewData)); })
      .catch(() => {})
      .finally(() => setLoadingPreview(false));
  }, [form.plantilla_id, instPlantillas, previewData]);

  const handleInstChange = (e) => {
    setForm(f => ({ ...f, institucion_id: e.target.value, estudiante_id: '', plantilla_id: '' }));
    setQuery(''); setSelected(null); setSuggestions([]);
    setSearchError(''); setSearchWarn(''); setDesdeCache(false);
  };

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    setForm(f => ({ ...f, estudiante_id: '' }));
    setSearchError(''); setSearchWarn(''); setDesdeCache(false);
    clearTimeout(debounceRef.current);
    if (!val.trim() || !form.institucion_id) { setSuggestions([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await estudiantesApi.listar({ search: val.trim(), institucion_id: form.institucion_id, limit: 8 });
        const list = res.estudiantes ?? [];
        setSuggestions(list);
        setShowDrop(true);
        if (res.desdeCache) setDesdeCache(true);
        if (list.length === 0) setSearchError('No se encontró ningún estudiante con ese criterio. Verifica el nombre o documento.');
      } catch (err) {
        const status = err?.status || err?.response?.status;
        if (status === 503 || err?.message?.includes('503')) {
          setSearchWarn('Sistema académico no disponible. Intenta nuevamente en unos momentos.');
        } else {
          setSearchError('Error al buscar estudiantes. Intenta nuevamente.');
        }
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const selectStudent = (est) => {
    setSelected(est);
    setQuery(`${est.nombre} ${est.apellido} — Doc. ${est.documento}`);
    setForm(f => ({ ...f, estudiante_id: est.id }));
    setShowDrop(false); setSuggestions([]); setSearchError('');
  };

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canPreview = !loading && !!form.estudiante_id && !!form.plantilla_id && !!form.institucion_id;

  const handlePreviewClick = () => setShowModal(true);

  const handleConfirm = () => {
    setShowModal(false);
    onSubmit({ preventDefault: () => {} });
  };

  return (
    <>
      <form onSubmit={e => { e.preventDefault(); handlePreviewClick(); }} className="form-col">
        <div className="form-group">
          <label className="form-label">Institución <span className="required-star">*</span></label>
          <select
            className="form-input form-select"
            value={form.institucion_id}
            onChange={handleInstChange}
            required
          >
            <option value="">Seleccionar institución...</option>
            {instituciones.filter(i => i.activa).map(i => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </div>

        <div className="form-group" ref={dropRef} style={{ position: 'relative' }}>
          <label className="form-label">Estudiante <span className="required-star">*</span></label>
          <div className="autocomplete-wrap">
            <Search size={15} className="autocomplete-icon" />
            <input
              type="text"
              className="form-input autocomplete-input"
              placeholder={form.institucion_id ? 'Buscar por nombre o documento...' : 'Selecciona primero una institución'}
              value={query}
              onChange={handleQueryChange}
              onFocus={() => suggestions.length > 0 && setShowDrop(true)}
              disabled={!form.institucion_id}
              autoComplete="off"
            />
            {searching && <span className="autocomplete-spinner" />}
          </div>

          {showDrop && suggestions.length > 0 && (
            <ul className="autocomplete-dropdown glass-panel animate-fade-in">
              {suggestions.map(est => (
                <li key={est.id} className="autocomplete-item" onMouseDown={() => selectStudent(est)}>
                  <User size={14} className="autocomplete-item-icon" />
                  <div style={{ flex: 1 }}>
                    <div className="autocomplete-item-name" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {est.nombre} {est.apellido}
                      {est.activo === false ? (
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '999px', background: 'rgba(239,68,68,0.15)', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          <XCircle size={10} /> No habilitado
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '999px', background: 'rgba(16,185,129,0.15)', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          <CheckCircle2 size={10} /> Habilitado
                        </span>
                      )}
                    </div>
                    <div className="autocomplete-item-sub">Doc. {est.documento}{est.email ? ` · ${est.email}` : ''}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {desdeCache && !searchWarn && (
            <p className="form-hint" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertTriangle size={13} /> Los resultados provienen de caché. Los datos pueden no estar actualizados.
            </p>
          )}
          {searchWarn && (
            <p className="form-hint" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <WifiOff size={13} /> {searchWarn}
            </p>
          )}
          {searchError && !showDrop && !searchWarn && (
            <p className="form-hint" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertTriangle size={13} />{searchError}
            </p>
          )}
          {selectedStudent && (
            <div className="selected-student-badge">
              <User size={13} />
              <span>{selectedStudent.nombre} {selectedStudent.apellido}</span>
              <span className="selected-student-doc">Doc. {selectedStudent.documento}</span>
            </div>
          )}
          <input type="hidden" value={form.estudiante_id} required />
        </div>

        <div className="form-group">
          <label className="form-label">Plantilla <span className="required-star">*</span></label>
          <select
            className="form-input form-select"
            value={form.plantilla_id}
            onChange={e => setForm(f => ({ ...f, plantilla_id: e.target.value }))}
            required
            disabled={!form.institucion_id}
          >
            <option value="">Seleccionar plantilla...</option>
            {instPlantillas.map(p => (
              <option key={p.id} value={p.id}>{p.nombre} (v{p.version})</option>
            ))}
          </select>
          {form.institucion_id && instPlantillas.length === 0 && (
            <p className="form-hint">No hay plantillas activas para esta institución.</p>
          )}
        </div>

        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canPreview}
            icon={<Eye size={15} />}
          >
            {loading ? 'Emitiendo...' : 'Previsualizar y emitir'}
          </Button>
        </div>
      </form>

      {showModal && (
        <PreviewConfirmModal
          previewHtml={previewSource}
          loading={loadingPreview}
          onCancel={() => setShowModal(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
};
