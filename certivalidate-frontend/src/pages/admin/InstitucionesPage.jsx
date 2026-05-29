import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { institucionesApi } from '../../api/instituciones.api';
import { useListPage } from '../../hooks/useListPage';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/Card';
import { InstitucionForm } from '../../forms/InstitucionForm';
import { Plus, Pencil, Power, Zap } from 'lucide-react';
import './InstitucionesPage.css';

const INITIAL_FORM = { nombre: '', dominio: '', logo_url: '' };

export const InstitucionesPage = () => {
  const { hasPermission } = useAuth();

  const {
    items: instituciones, loading, listError, load,
    showForm, editing, form, setForm, formError,
    openCreate, openEdit, closeForm, handleSubmit, handleRemove,
  } = useListPage(institucionesApi, {
    initialForm: INITIAL_FORM,
    dataKey: 'data',
    removeMethod: 'desactivar',
    removeConfirmMsg: '¿Desactivar esta institución?',
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Instituciones</h1>
          <p>Gestiona las instituciones emisoras de certificados.</p>
        </div>
      </div>

      <div className="page-toolbar">
        <span>{instituciones.length} institución(es)</span>
        {hasPermission('institucion:crear') && (
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => openCreate()}>
            Nueva Institución
          </Button>
        )}
      </div>

      {listError && <div className="alert alert-error">{listError}</div>}

      {loading ? (
        <div className="empty-state">Cargando...</div>
      ) : (
        <div className="cards-grid-lg">
          {instituciones.length === 0 ? (
            <Card><div className="empty-state">No hay instituciones.</div></Card>
          ) : instituciones.map(i => (
            <Card key={i.id} glow>
              <div className="inst-card-header">
                <div>
                  <h3 className="inst-card-name">{i.nombre}</h3>
                  {i.dominio && <p className="inst-card-domain">{i.dominio}</p>}
                </div>
                <Badge variant={i.activa ? 'success' : 'muted'}>{i.activa ? 'Activa' : 'Inactiva'}</Badge>
              </div>
              <div className="inst-integrations">
                <span className="inst-integrations-label"><Zap size={12} /> Integraciones</span>
                <div className="inst-integration-badges">
                  <span className="inst-integration-item inst-integration-item--pending">API REST</span>
                  <span className="inst-integration-item inst-integration-item--pending">Webhook</span>
                  <span className="inst-integration-item inst-integration-item--pending">Email</span>
                </div>
              </div>
              <div className="inst-card-actions">
                {hasPermission('institucion:actualizar') && (
                  <button className="icon-btn" title="Editar"
                    onClick={() => openEdit(i, inst => ({ nombre: inst.nombre, dominio: inst.dominio || '', logo_url: inst.logo_url || '' }))}>
                    <Pencil size={16} />
                  </button>
                )}
                {hasPermission('institucion:actualizar') && i.activa && (
                  <button className="icon-btn danger" title="Desactivar" onClick={() => handleRemove(i.id)}>
                    <Power size={16} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={closeForm} title={editing ? 'Editar Institución' : 'Nueva Institución'} size="md">
        <InstitucionForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          editing={!!editing}
          error={formError}
        />
      </Modal>
    </div>
  );
};
