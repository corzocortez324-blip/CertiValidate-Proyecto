import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useAuth } from '../../context/AuthContext';
import { plantillasApi } from '../../api/plantillas.api';
import { institucionesApi } from '../../api/instituciones.api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/Card';
import { CertificateEditor } from '../../components/certificate-editor/CertificateEditor';
import { parseHtmlToEditorState } from '../../components/certificate-editor/editorUtils';
import { Plus, Pencil, Archive, Eye } from 'lucide-react';
import './PlantillasPage.css';

const INITIAL_NEW_FORM = { institucion_id: '', nombre: '', version: 1 };

export const PlantillasPage = () => {
  const { hasPermission } = useAuth();

  const [instituciones, setInstituciones] = useState([]);
  const [instMap, setInstMap]             = useState({});
  const [filterInst, setFilterInst]       = useState('');
  const [plantillas, setPlantillas]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [listError, setListError]         = useState('');

  // Plantilla abierta en el editor (null = vista de lista)
  const [editorPlantilla, setEditorPlantilla] = useState(null);
  const [editorLoading, setEditorLoading]     = useState(false);

  // Modal nueva plantilla
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm]           = useState({ ...INITIAL_NEW_FORM });
  const [newError, setNewError]         = useState('');

  // Modal preview
  const [previewPlantilla, setPreviewPlantilla] = useState(null);

  const setNew = field => e => setNewForm(f => ({ ...f, [field]: e.target.value }));

  const loadPlantillas = () => {
    setLoading(true);
    setListError('');
    plantillasApi.listar({ limit: 100 })
      .then(res => setPlantillas(res.data ?? []))
      .catch(() => setListError('Error al cargar plantillas.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    institucionesApi.listar({ limit: 100 }).then(res => {
      const data = res.data ?? [];
      setInstituciones(data);
      setInstMap(Object.fromEntries(data.map(i => [i.id, i])));
      setNewForm(f => ({ ...f, institucion_id: data[0]?.id || '' }));
    }).catch(() => {});
    loadPlantillas();
  }, []);

  const displayed = filterInst
    ? plantillas.filter(p => p.institucion_id === filterInst)
    : plantillas;

  // Preview con datos de ejemplo
  const previewSource = useMemo(() => {
    if (!previewPlantilla) return '';
    // Elimina markdown code fences que puedan estar en el HTML almacenado
    const clean = (previewPlantilla.template_html || '')
      .replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const filled = clean
      .replace(/\{\{nombre\}\}/g, 'Ana Martínez')
      .replace(/\{\{institucion\}\}/g, 'Universidad Central')
      .replace(/\{\{curso\}\}/g, 'Desarrollo Web')
      .replace(/\{\{fecha_emision\}\}/g, new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }))
      .replace(/\{\{fecha_expiracion\}\}/g, 'Sin expiración');
    // Si es un documento HTML completo, no lo envuelvas en otro (conserva sus estilos)
    if (/<!DOCTYPE\s+html|<html[\s>]/i.test(filled)) {
      return filled;
    }
    return DOMPurify.sanitize(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box;}html,body{margin:0;padding:0;background:#fff;}</style></head><body>${filled}</body></html>`,
      { USE_PROFILES: { html: true } }
    );
  }, [previewPlantilla]);

  // Abre editor — siempre el mismo editor unificado, pasa el template_html completo
  const handleEditClick = async (plantilla) => {
    setEditorLoading(true);
    try {
      // Obtiene el HTML completo desde el servidor (el listado puede no tenerlo íntegro)
      const full = await plantillasApi.getById(plantilla.id);
      setEditorPlantilla({ ...(full ?? plantilla) });
    } catch {
      setEditorPlantilla({ ...plantilla });
    } finally {
      setEditorLoading(false);
    }
  };

  // Guarda desde el editor unificado
  const handleEditorSave = async (templateHtml) => {
    if (editorPlantilla._new) {
      await plantillasApi.crear({
        institucion_id: editorPlantilla.institucion_id,
        nombre:         editorPlantilla.nombre,
        template_html:  templateHtml,
        version:        editorPlantilla.version,
      });
    } else {
      await plantillasApi.actualizar(editorPlantilla.id, { template_html: templateHtml });
    }
    setEditorPlantilla(null);
    loadPlantillas();
  };

  // Modal de nueva plantilla
  const handleNewFormSubmit = e => {
    e.preventDefault();
    if (!newForm.nombre.trim()) { setNewError('El nombre es obligatorio.'); return; }
    if (!newForm.institucion_id) { setNewError('Selecciona una institución.'); return; }
    setNewError('');
    setShowNewModal(false);
    // Plantilla nueva: el editor la abre en modo visual con plantilla base
    setEditorPlantilla({
      _new:           true,
      nombre:         newForm.nombre.trim(),
      institucion_id: newForm.institucion_id,
      version:        parseInt(newForm.version, 10) || 1,
      template_html:  '',
    });
  };

  const handleArchivar = async (id) => {
    if (!window.confirm('¿Archivar esta plantilla? No podrá usarse para emitir nuevos certificados.')) return;
    await plantillasApi.archivar(id);
    loadPlantillas();
  };

  // ── Render: editor unificado ───────────────────────────────────────────────
  if (editorPlantilla) {
    return (
      <CertificateEditor
        plantilla={editorPlantilla}
        onSave={handleEditorSave}
        onCancel={() => setEditorPlantilla(null)}
      />
    );
  }

  // ── Render: lista de plantillas ────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Plantillas de Certificado</h1>
          <p>Diseña y gestiona los certificados. Total activas: {plantillas.filter(p => p.activa).length}.</p>
        </div>
      </div>

      <div className="page-toolbar">
        <div className="page-actions">
          <select className="search-input" value={filterInst} onChange={e => setFilterInst(e.target.value)}>
            <option value="">Todas las instituciones</option>
            {instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </div>
        {hasPermission('plantilla:crear') && (
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => {
            setNewForm({ ...INITIAL_NEW_FORM, institucion_id: instituciones[0]?.id || '' });
            setNewError('');
            setShowNewModal(true);
          }}>
            Nueva Plantilla
          </Button>
        )}
      </div>

      {listError && <div className="alert alert-error">{listError}</div>}

      {loading ? (
        <div className="empty-state">Cargando…</div>
      ) : (
        <div className="cards-grid">
          {displayed.length === 0 ? (
            <Card><div className="empty-state">No hay plantillas.</div></Card>
          ) : displayed.map(p => {
            const inst = instMap[p.institucion_id];
            const isVisual = parseHtmlToEditorState(p.template_html) !== null;
            return (
              <Card key={p.id} glow={p.activa}>
                <div className="plt-card-header">
                  <div className="plt-card-title-wrap">
                    <h3 className="plt-card-title">{p.nombre}</h3>
                    <p className="plt-card-version">
                      v{p.version}
                      {isVisual
                        ? <span className="plt-badge-visual"> · Editor visual</span>
                        : <span className="plt-badge-html"> · HTML</span>}
                    </p>
                  </div>
                  <Badge className="plt-card-badge" variant={p.activa ? 'success' : 'muted'}>
                    {p.activa ? 'Activa' : 'Archivada'}
                  </Badge>
                </div>
                {inst && (
                  <p className="plt-inst-row">
                    <span className="plt-inst-dot" style={{ background: inst.activa ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
                    {inst.nombre}
                  </p>
                )}
                <div className="plt-card-actions">
                  <button className="icon-btn" title="Vista previa" onClick={() => setPreviewPlantilla(p)}>
                    <Eye size={16} />
                  </button>
                  {hasPermission('plantilla:actualizar') && (
                    <button className="icon-btn" title="Editar" onClick={() => handleEditClick(p)} disabled={editorLoading}>
                      {editorLoading ? '…' : <Pencil size={16} />}
                    </button>
                  )}
                  {hasPermission('plantilla:archivar') && p.activa && (
                    <button className="icon-btn danger" title="Archivar" onClick={() => handleArchivar(p.id)}>
                      <Archive size={16} />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal nueva plantilla */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Nueva Plantilla" size="sm">
        <form onSubmit={handleNewFormSubmit} className="form-col">
          {newError && <div className="alert alert-error">{newError}</div>}
          <div className="form-group">
            <label className="form-label">Institución <span className="required-star">*</span></label>
            <select className="form-input form-select" value={newForm.institucion_id} onChange={setNew('institucion_id')} required>
              {instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </div>
          <div className="form-row-2-1">
            <div className="form-group">
              <label className="form-label">Nombre <span className="required-star">*</span></label>
              <input className="form-input" value={newForm.nombre} onChange={setNew('nombre')} required placeholder="Ej. Certificado de Finalización" />
            </div>
            <div className="form-group">
              <label className="form-label">Versión</label>
              <input className="form-input" type="number" min={1} value={newForm.version} onChange={setNew('version')} />
            </div>
          </div>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setShowNewModal(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Crear y Abrir Editor</Button>
          </div>
        </form>
      </Modal>

      {/* Modal preview */}
      <Modal isOpen={!!previewPlantilla} onClose={() => setPreviewPlantilla(null)} title={`Vista previa — ${previewPlantilla?.nombre || ''}`} size="lg">
        {previewPlantilla && (
          <div className="plt-preview-wrap">
            <div className="plt-preview-meta">
              <span className="plt-preview-badge">{previewPlantilla.nombre} · v{previewPlantilla.version}</span>
              <span className="plt-preview-hint">Datos de ejemplo — las variables se reemplazarán al emitir</span>
            </div>
            <div className="plt-preview-viewer">
              <iframe className="plt-preview-iframe" title={previewPlantilla.nombre} sandbox="allow-same-origin" srcDoc={previewSource} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
