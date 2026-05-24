import React from 'react';
import { Button } from '../components/ui/Button';

export const EstudianteForm = ({ form, setForm, onSubmit, onCancel, editing, error, instituciones = [] }) => {
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <form onSubmit={onSubmit} className="form-col">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-group">
        <label className="form-label">Institución <span className="required-star">*</span></label>
        <select className="form-input form-select" value={form.institucion_id} onChange={set('institucion_id')} required>
          {instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
      </div>
      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label">Nombre <span className="required-star">*</span></label>
          <input className="form-input" value={form.nombre} onChange={set('nombre')} placeholder="Ana" required />
        </div>
        <div className="form-group">
          <label className="form-label">Apellido <span className="required-star">*</span></label>
          <input className="form-input" value={form.apellido} onChange={set('apellido')} placeholder="Martínez" required />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Documento de identidad <span className="required-star">*</span></label>
        <input className="form-input" value={form.documento} onChange={set('documento')} placeholder="1023456789" required />
        <p className="form-hint">
          Cédula, pasaporte u otro identificador único.
        </p>
      </div>
      <div className="form-group">
        <label className="form-label">Email <span className="label-optional">(opcional)</span></label>
        <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="estudiante@email.com" />
      </div>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary">{editing ? 'Guardar Cambios' : 'Crear Estudiante'}</Button>
      </div>
    </form>
  );
};
