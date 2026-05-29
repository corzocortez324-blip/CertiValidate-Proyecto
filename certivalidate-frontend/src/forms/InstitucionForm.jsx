import React from 'react';
import { Button } from '../components/ui/Button';

export const InstitucionForm = ({ form, setForm, onSubmit, onCancel, editing, error }) => {
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <form onSubmit={onSubmit} className="form-col">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-group">
        <label className="form-label">Nombre <span className="required-star">*</span></label>
        <input
          className="form-input"
          value={form.nombre}
          onChange={set('nombre')}
          required
          placeholder="Ej. Universidad Central"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Dominio <span className="label-optional">(opcional)</span></label>
        <input
          className="form-input"
          value={form.dominio}
          onChange={set('dominio')}
          placeholder="universidad.edu"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Logo URL <span className="label-optional">(opcional)</span></label>
        <input
          className="form-input"
          value={form.logo_url}
          onChange={set('logo_url')}
          placeholder="https://..."
        />
      </div>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary">{editing ? 'Guardar' : 'Crear'}</Button>
      </div>
    </form>
  );
};
