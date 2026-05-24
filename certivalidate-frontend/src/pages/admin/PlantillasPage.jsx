import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { plantillasApi } from '../../api/plantillas.api';
import { institucionesApi } from '../../api/instituciones.api';
import { useListPage } from '../../hooks/useListPage';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/Card';
import { PlantillaForm } from '../../forms/PlantillaForm';
import { Plus, Pencil, Archive, Eye } from 'lucide-react';
import './PlantillasPage.css';

const DEFAULT_HTML = '<h1>{{nombre}}</h1>\n<p>Ha completado satisfactoriamente el curso de <strong>{{curso}}</strong>.</p>\n<p>Institución: {{institucion}}</p>\n<p>Fecha de emisión: {{fecha_emision}}</p>';
const INITIAL_FORM = { institucion_id: '', nombre: '', template_html: DEFAULT_HTML, version: 1, activa: true };

export const PlantillasPage = () => {
  const { hasPermission } = useAuth();
  const [instituciones, setInstituciones] = useState([]);
  const [instMap, setInstMap]             = useState({});
  const [filterInst, setFilterInst]       = useState('');
  const [previewPlantilla, setPreviewPlantilla] = useState(null);

  const {
    items: plantillas, loading, listError,
    showForm, editing, form, setForm, formError,
    openCreate, openEdit, closeForm, handleSubmit, handleRemove,
  } = useListPage(plantillasApi, {
    initialForm: INITIAL_FORM,
    dataKey: 'data',
    removeMethod: 'archivar',
    removeConfirmMsg: '¿Archivar esta plantilla? No podrá usarse para emitir nuevos certificados.',
  });

  useEffect(() => {
    institucionesApi.listar({ limit: 100 }).then(res => {
      const data = res.data ?? [];
      setInstituciones(data);
      setInstMap(Object.fromEntries(data.map(i => [i.id, i])));
    }).catch(() => {});
  }, []);

  const displayed = filterInst ? plantillas.filter(p => p.institucion_id === filterInst) : plantillas;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Plantillas de Certificado</h1>
          <p>Define y gestiona los diseños HTML de tus certificados. Total: {plantillas.filter(p => p.activa).length} activa(s).</p>
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
          <Button variant="primary" icon={<Plus size={18} />}
            onClick={() => openCreate({ ...INITIAL_FORM, institucion_id: instituciones[0]?.id || '' })}>
            Nueva Plantilla
          </Button>
        )}
      </div>

      {listError && <div className="alert alert-error">{listError}</div>}

      {loading ? (
        <div className="empty-state">Cargando...</div>
      ) : (
        <div className="cards-grid">
          {displayed.length === 0 ? (
            <Card><div className="empty-state">No hay plantillas.</div></Card>
          ) : displayed.map(p => {
            const inst = instMap[p.institucion_id];
            return (
              <Card key={p.id} glow={p.activa}>
                <div className="plt-card-header">
                  <div className="plt-card-title-wrap">
                    <h3 className="plt-card-title">{p.nombre}</h3>
                    <p className="plt-card-version">Versión {p.version}</p>
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
                  <button className="icon-btn" title="Vista previa" onClick={() => setPreviewPlantilla(p)}><Eye size={16} /></button>
                  {hasPermission('plantilla:actualizar') && (
                    <button className="icon-btn" title="Editar"
                      onClick={() => openEdit(p, plt => ({ institucion_id: plt.institucion_id, nombre: plt.nombre, template_html: plt.template_html, version: plt.version, activa: plt.activa }))}>
                      <Pencil size={16} />
                    </button>
                  )}
                  {hasPermission('plantilla:archivar') && p.activa && (
                    <button className="icon-btn danger" title="Archivar" onClick={() => handleRemove(p.id)}><Archive size={16} /></button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={showForm} onClose={closeForm} title={editing ? 'Editar Plantilla' : 'Nueva Plantilla'} size="lg">
        <PlantillaForm
          form={form}
          setForm={setForm}
          onSubmit={(e) => handleSubmit(e, f => ({ ...f, version: parseInt(f.version, 10) }))}
          onCancel={closeForm}
          editing={!!editing}
          error={formError}
          instituciones={instituciones}
          onPreview={setPreviewPlantilla}
        />
      </Modal>

      <Modal isOpen={!!previewPlantilla} onClose={() => setPreviewPlantilla(null)} title={`Vista previa — ${previewPlantilla?.nombre || ''}`} size="lg">
        {previewPlantilla && (
          <div className="plt-preview-wrap">
            <div className="plt-preview-meta">
              <span className="plt-preview-badge">{previewPlantilla.nombre} · v{previewPlantilla.version}</span>
              <span className="plt-preview-hint">Datos de ejemplo — las variables se reemplazarán al emitir</span>
            </div>
            <div className="plt-preview-viewer">
              <iframe
                className="plt-preview-iframe"
                title={previewPlantilla.nombre}
                sandbox="allow-same-origin"
                srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box;}html,body{margin:0;padding:0;background:#fff;}</style></head><body>${
                  previewPlantilla.template_html
                    .replace(/\{\{nombre\}\}/g, 'Ana Martínez')
                    .replace(/\{\{institucion\}\}/g, 'Universidad Central')
                    .replace(/\{\{curso\}\}/g, 'Desarrollo Web')
                    .replace(/\{\{fecha_emision\}\}/g, new Date().toLocaleDateString('es-CO'))
                    .replace(/\{\{duracion\}\}/g, '40')
                    .replace(/\{\{fecha_expiracion\}\}/g, 'Sin expiración')
                }</body></html>`}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
