import React from 'react';
import { Button } from '../components/ui/Button';
import { Eye } from 'lucide-react';

export const PlantillaForm = ({ form, setForm, onSubmit, onCancel, editing, error, instituciones = [], onPreview }) => {
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
      <div className="form-row-2-1">
        <div className="form-group">
          <label className="form-label">Nombre <span className="required-star">*</span></label>
          <input
            className="form-input"
            value={form.nombre}
            onChange={set('nombre')}
            required
            placeholder="Ej. Certificado de Finalización"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Versión <span className="required-star">*</span></label>
          <input className="form-input" type="number" min={1} value={form.version} onChange={set('version')} required />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">
          HTML de plantilla <span className="required-star">*</span>
        </label>

        {/* Variables disponibles con inserción rápida */}
        <div className="plt-vars-grid">
          {[
            ['{{nombre}}',          'Nombre completo'],
            ['{{apellido}}',        'Apellido'],
            ['{{institucion}}',     'Institución'],
            ['{{curso}}',           'Curso / Programa'],
            ['{{fecha_emision}}',   'Fecha de emisión'],
            ['{{fecha_expiracion}}','Fecha de expiración'],
            ['{{codigo_unico}}',    'Código único'],
            ['{{documento}}',       'Documento'],
            ['{{hash}}',            'Hash SHA-256'],
            ['{{qr}}',              'Código QR ⚠ obligatorio'],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={`plt-var-chip${v === '{{qr}}' ? ' plt-var-chip--required' : ''}`}
              title={label}
              onClick={() => {
                const ta = document.getElementById('plt-template-area');
                if (!ta) return;
                const s = ta.selectionStart, e = ta.selectionEnd;
                const next = form.template_html.slice(0, s) + v + form.template_html.slice(e);
                setForm(f => ({ ...f, template_html: next }));
                setTimeout(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length); }, 0);
              }}
            >
              <code>{v}</code>
            </button>
          ))}
        </div>

        <textarea
          id="plt-template-area"
          className="form-input form-textarea form-textarea-code"
          value={form.template_html}
          onChange={set('template_html')}
          required
          placeholder="Escribe el HTML de la plantilla. Usa los botones de arriba para insertar variables."
        />
        <p className="plt-template-note">
          ⚠ Incluye <code>{'{{qr}}'}</code> en tu plantilla para que el código QR de verificación aparezca en el certificado.
        </p>
      </div>
      <div className="form-actions-between">
        <button
          type="button"
          className="btn-preview"
          onClick={() => onPreview?.({ ...form, id: 'preview' })}
        >
          <Eye size={14} /> Vista previa
        </button>
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" variant="primary">{editing ? 'Guardar Cambios' : 'Crear Plantilla'}</Button>
        </div>
      </div>
    </form>
  );
};
