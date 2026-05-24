import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { estudiantesApi } from '../../api/estudiantes.api';
import { institucionesApi } from '../../api/instituciones.api';
import { useListPage } from '../../hooks/useListPage';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EstudianteForm } from '../../forms/EstudianteForm';
import { formatDate } from '../../utils/helpers';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import './EstudiantesPage.css';

const INITIAL_FORM = { institucion_id: '', nombre: '', apellido: '', documento: '', email: '' };

export const EstudiantesPage = () => {
  const { hasPermission } = useAuth();
  const [instituciones, setInstituciones] = useState([]);
  const [instMap, setInstMap] = useState({});

  const {
    items: estudiantes, page, totalPages, loading, listError, setPage,
    search, setSearch, setFilter,
    showForm, editing, form, setForm, formError,
    openCreate, openEdit, closeForm, handleSubmit, handleRemove,
  } = useListPage(estudiantesApi, {
    initialForm: INITIAL_FORM,
    dataKey: 'estudiantes',
    removeConfirmMsg: '¿Eliminar este estudiante? Esta acción es permanente si no tiene certificados asociados.',
  });

  useEffect(() => {
    institucionesApi.listar({ limit: 100 }).then(res => {
      const data = res.data ?? [];
      setInstituciones(data);
      setInstMap(Object.fromEntries(data.map(i => [i.id, i])));
    }).catch(() => {});
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Estudiantes</h1>
          <p>Administra los estudiantes registrados.</p>
        </div>
      </div>

      <div className="page-toolbar">
        <div className="page-actions est-filters">
          <input
            className="search-input"
            placeholder="Buscar por nombre, apellido o documento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="search-input" onChange={e => setFilter('institucion_id', e.target.value)}>
            <option value="">Todas las instituciones</option>
            {instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </div>
        {hasPermission('estudiante:crear') && (
          <Button variant="primary" icon={<Plus size={18} />}
            onClick={() => openCreate({ ...INITIAL_FORM, institucion_id: instituciones[0]?.id || '' })}>
            Nuevo Estudiante
          </Button>
        )}
      </div>

      {listError && <div className="alert alert-error">{listError}</div>}

      <Card>
        <div className="table-overflow-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre completo</th>
                <th>Documento</th>
                <th>Email</th>
                <th>Institución</th>
                <th>Registrado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty-state">Cargando...</td></tr>
              ) : estudiantes.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No se encontraron estudiantes.</td></tr>
              ) : estudiantes.map(e => {
                const inst = instMap[e.institucion_id];
                return (
                  <tr key={e.id}>
                    <td className="est-name-col">{e.nombre} {e.apellido}</td>
                    <td className="est-doc-col">{e.documento}</td>
                    <td className="est-email-col">{e.email || '—'}</td>
                    <td>
                      {inst && (
                        <Badge variant={inst.activa ? 'primary' : 'muted'}>
                          {inst.nombre.length > 28 ? inst.nombre.slice(0, 25) + '…' : inst.nombre}
                        </Badge>
                      )}
                    </td>
                    <td className="est-date-col">{formatDate(e.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        {hasPermission('estudiante:actualizar') && (
                          <button className="icon-btn" title="Editar"
                            onClick={() => openEdit(e, est => ({
                              institucion_id: est.institucion_id,
                              nombre: est.nombre,
                              apellido: est.apellido,
                              documento: est.documento,
                              email: est.email || '',
                            }))}><Pencil size={15} /></button>
                        )}
                        {hasPermission('estudiante:eliminar') && (
                          <button className="icon-btn danger" title="Eliminar"
                            onClick={() => handleRemove(e.id)}><Trash2 size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </Card>

      <Modal isOpen={showForm} onClose={closeForm} title={editing ? 'Editar Estudiante' : 'Nuevo Estudiante'} size="md">
        <EstudianteForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          editing={!!editing}
          error={formError}
          instituciones={instituciones}
        />
      </Modal>
    </div>
  );
};
