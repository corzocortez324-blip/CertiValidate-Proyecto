import React, { useState } from 'react';
import { Button } from '../components/ui/Button';

const MOTIVOS_REVOCACION = [
  { value: 'ERROR_DATOS', label: 'Error en datos del certificado' },
  { value: 'ERROR_EMISION', label: 'Error en la emisión' },
  { value: 'FRAUDE', label: 'Fraude o falsificación' },
  { value: 'DECISION_INSTITUCIONAL', label: 'Decisión institucional' },
  { value: 'DUPLICADO', label: 'Certificado duplicado' },
  { value: 'CADUCIDAD', label: 'Caducidad anticipada' },
  { value: 'OTRO', label: 'Otro motivo' },
];

export const RevocarCertificadoForm = ({ form, setForm, onSubmit, onCancel }) => {
  const [confirmado, setConfirmado] = useState(false);
  const detalleRequerido = form.motivo_codigo === 'OTRO';
  const detalleValido = !detalleRequerido || form.motivo_detalle.trim().length >= 10;
  const canSubmit = detalleValido && confirmado;

  return (
    <form onSubmit={onSubmit} className="form-col">
      <div className="alert alert-error text-sm">
        <strong>⚠ Esta acción es irreversible.</strong> El certificado quedará marcado como revocado permanentemente y no podrá ser rehabilitado.
      </div>
      <div className="form-group">
        <label className="form-label">Motivo de revocación <span className="required-star">*</span></label>
        <select
          className="form-input form-select"
          value={form.motivo_codigo}
          onChange={e => setForm(f => ({ ...f, motivo_codigo: e.target.value, motivo_detalle: '' }))}
        >
          {MOTIVOS_REVOCACION.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">
          Detalle{' '}
          {detalleRequerido
            ? <span className="required-star">*</span>
            : <span className="label-optional">(opcional, máx. 500 caracteres)</span>
          }
        </label>
        <textarea
          className="form-input form-textarea"
          value={form.motivo_detalle}
          onChange={e => setForm(f => ({ ...f, motivo_detalle: e.target.value }))}
          maxLength={500}
          placeholder={detalleRequerido ? 'Describe el motivo con al menos 10 caracteres...' : 'Describe el motivo con más detalle...'}
          rows={3}
          required={detalleRequerido}
        />
        <div className="form-counter">
          {detalleRequerido && form.motivo_detalle.trim().length < 10 && form.motivo_detalle.length > 0 && (
            <p className="form-hint error">Mínimo 10 caracteres</p>
          )}
          <p className="form-hint" style={{ marginLeft: 'auto' }}>{form.motivo_detalle.length}/500</p>
        </div>
      </div>
      <label className="revoke-confirm-check">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={e => setConfirmado(e.target.checked)}
        />
        <span>Entiendo que esta acción es <strong>irreversible</strong> y no podrá deshacerse</span>
      </label>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={!canSubmit}>Confirmar Revocación</Button>
      </div>
    </form>
  );
};
