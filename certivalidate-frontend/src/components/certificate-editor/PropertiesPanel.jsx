import React from 'react';
import { Trash2, ArrowUp, ArrowDown, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Helvetica', 'Courier New', 'Trebuchet MS', 'Palatino', 'Tahoma', 'Impact'];
const SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 48, 56, 64, 72];

function PropRow({ label, children }) {
  return (
    <div className="ced-prop-row">
      <span className="ced-prop-label">{label}</span>
      <div className="ced-prop-ctrl">{children}</div>
    </div>
  );
}

function NumInput({ value, min = 0, max, onChange }) {
  return (
    <input
      type="number"
      className="ced-input ced-input--sm"
      value={Math.round(value)}
      min={min}
      max={max}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}

export function PropertiesPanel({ element, onUpdate, onDelete, onMoveUp, onMoveDown }) {
  if (!element) {
    return (
      <aside className="ced-panel ced-panel--right">
        <div className="ced-empty-props">
          <p>Selecciona un elemento en el canvas para ver sus propiedades.</p>
        </div>
      </aside>
    );
  }

  const upd = (key, val) => onUpdate(element.id, { [key]: val });
  const updS = (key, val) => onUpdate(element.id, { style: { ...element.style, [key]: val } });

  const SHAPE_LABELS = { rect: 'Rectángulo', circle: 'Círculo', diamond: 'Rombo', triangle: 'Triángulo', star: 'Estrella', hexagon: 'Hexágono', seal: 'Sello' };
  const typeLabel = element.type === 'rect'
    ? (SHAPE_LABELS[element.shapeKind] || 'Forma')
    : ({ text: 'Texto', qr: 'Código QR', image: 'Imagen', line: 'Línea' }[element.type] || 'Elemento');

  return (
    <aside className="ced-panel ced-panel--right">
      {/* Header */}
      <div className="ced-section ced-section--header">
        <span className="ced-prop-type">{typeLabel}</span>
        <div className="ced-prop-actions">
          <button className="ced-icon-btn" onClick={() => onMoveDown(element.id)} title="Bajar capa"><ArrowDown size={13} /></button>
          <button className="ced-icon-btn" onClick={() => onMoveUp(element.id)} title="Subir capa"><ArrowUp size={13} /></button>
          <button className="ced-icon-btn ced-icon-btn--danger" onClick={() => onDelete(element.id)} title="Eliminar"><Trash2 size={13} /></button>
        </div>
      </div>

      {/* TEXT */}
      {element.type === 'text' && (
        <>
          <div className="ced-section">
            <p className="ced-section-title">Contenido</p>
            <textarea
              className="ced-textarea"
              rows={3}
              value={element.content}
              onChange={e => upd('content', e.target.value)}
            />
          </div>
          <div className="ced-section">
            <p className="ced-section-title">Tipografía</p>
            <PropRow label="Fuente">
              <select className="ced-select ced-select--full" value={element.style.fontFamily} onChange={e => updS('fontFamily', e.target.value)}>
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </PropRow>
            <PropRow label="Tamaño">
              <select className="ced-select" value={element.style.fontSize} onChange={e => updS('fontSize', parseInt(e.target.value))}>
                {SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
              </select>
            </PropRow>
            <PropRow label="Color">
              <input type="color" className="ced-color" value={/^#[0-9a-f]{3,6}$/i.test(element.style.color) ? element.style.color : '#000000'} onChange={e => updS('color', e.target.value)} />
              <input type="text" className="ced-input" value={element.style.color} onChange={e => updS('color', e.target.value)} />
            </PropRow>
            <PropRow label="Estilo">
              <button className={`ced-style-btn${element.style.fontWeight === 'bold' ? ' active' : ''}`} onClick={() => updS('fontWeight', element.style.fontWeight === 'bold' ? 'normal' : 'bold')}><b>B</b></button>
              <button className={`ced-style-btn${element.style.fontStyle === 'italic' ? ' active' : ''}`} onClick={() => updS('fontStyle', element.style.fontStyle === 'italic' ? 'normal' : 'italic')}><i>I</i></button>
            </PropRow>
            <PropRow label="Alineación">
              <button className={`ced-style-btn${element.style.textAlign === 'left' ? ' active' : ''}`} onClick={() => updS('textAlign', 'left')} title="Izquierda"><AlignLeft size={13} /></button>
              <button className={`ced-style-btn${element.style.textAlign === 'center' ? ' active' : ''}`} onClick={() => updS('textAlign', 'center')} title="Centro"><AlignCenter size={13} /></button>
              <button className={`ced-style-btn${element.style.textAlign === 'right' ? ' active' : ''}`} onClick={() => updS('textAlign', 'right')} title="Derecha"><AlignRight size={13} /></button>
            </PropRow>
          </div>
        </>
      )}

      {/* RECT */}
      {element.type === 'rect' && (
        <div className="ced-section">
          <p className="ced-section-title">Apariencia</p>
          <PropRow label="Color">
            <input type="color" className="ced-color" value={/^#[0-9a-f]{3,6}$/i.test(element.style.background) ? element.style.background : '#e8f4f8'} onChange={e => updS('background', e.target.value)} />
            <input type="text" className="ced-input" value={element.style.background} onChange={e => updS('background', e.target.value)} placeholder="rgba()" />
          </PropRow>
          {(!element.shapeKind || element.shapeKind === 'rect' || element.shapeKind === 'circle') && (
            <PropRow label="Radio borde">
              <NumInput value={element.style.borderRadius} max={200} onChange={v => updS('borderRadius', v)} />
            </PropRow>
          )}
          <PropRow label="Color borde">
            <input type="color" className="ced-color" value={/^#[0-9a-f]{3,6}$/i.test(element.style.borderColor) ? element.style.borderColor : '#cccccc'} onChange={e => updS('borderColor', e.target.value)} />
          </PropRow>
          <PropRow label="Grosor borde">
            <NumInput value={element.style.borderWidth} max={20} onChange={v => updS('borderWidth', v)} />
          </PropRow>
        </div>
      )}

      {/* IMAGE */}
      {element.type === 'image' && (
        <div className="ced-section">
          <p className="ced-section-title">Imagen</p>

          {/* File upload */}
          <label className="ced-label">Subir desde archivo</label>
          <label className="ced-upload-btn">
            {element.src ? 'Cambiar imagen…' : 'Seleccionar imagen…'}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  alert('La imagen supera 2 MB. Usa una imagen más pequeña o pega la URL.');
                  return;
                }
                const reader = new FileReader();
                reader.onload = ev => upd('src', ev.target.result);
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {element.src?.startsWith('data:') && (
            <p className="ced-prop-note">Imagen local embebida (base64)</p>
          )}

          {/* URL fallback */}
          <label className="ced-label" style={{ marginTop: 10 }}>o pegar URL externa</label>
          <input
            type="text"
            className="ced-input"
            placeholder="https://..."
            value={element.src?.startsWith('data:') ? '' : (element.src || '')}
            onChange={e => upd('src', e.target.value)}
          />

          {element.src && (
            <button className="ced-link-btn" style={{ marginTop: 4 }} onClick={() => upd('src', '')}>
              Quitar imagen
            </button>
          )}

          <PropRow label="Ajuste">
            <select className="ced-select" value={element.style?.objectFit || 'contain'} onChange={e => updS('objectFit', e.target.value)}>
              <option value="contain">Contener</option>
              <option value="cover">Cubrir</option>
              <option value="fill">Estirar</option>
            </select>
          </PropRow>
        </div>
      )}

      {/* LINE */}
      {element.type === 'line' && (
        <div className="ced-section">
          <p className="ced-section-title">Línea</p>
          <PropRow label="Color">
            <input type="color" className="ced-color" value={/^#[0-9a-f]{3,6}$/i.test(element.style.color) ? element.style.color : '#cccccc'} onChange={e => updS('color', e.target.value)} />
            <input type="text" className="ced-input" value={element.style.color} onChange={e => updS('color', e.target.value)} />
          </PropRow>
        </div>
      )}

      {/* QR */}
      {element.type === 'qr' && (
        <div className="ced-section">
          <p className="ced-section-hint ced-section-hint--info">
            El QR se genera automáticamente con el código único del certificado al emitir. Solo ajusta su posición y tamaño abajo.
          </p>
        </div>
      )}

      {/* POSITION & SIZE (all) */}
      <div className="ced-section">
        <p className="ced-section-title">Posición y tamaño</p>
        <div className="ced-grid-2">
          <div>
            <label className="ced-label">X</label>
            <NumInput value={element.x} onChange={v => upd('x', v)} />
          </div>
          <div>
            <label className="ced-label">Y</label>
            <NumInput value={element.y} onChange={v => upd('y', v)} />
          </div>
          <div>
            <label className="ced-label">Ancho</label>
            <NumInput value={element.width} min={4} onChange={v => upd('width', v)} />
          </div>
          <div>
            <label className="ced-label">Alto</label>
            <NumInput value={element.height} min={2} onChange={v => upd('height', v)} />
          </div>
        </div>
      </div>
    </aside>
  );
}
