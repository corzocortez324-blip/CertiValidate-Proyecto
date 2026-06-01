import React from 'react';
import { Type, QrCode, Image, Minus } from 'lucide-react';
import { VARIABLES, DECORATIVE_LIST, makeText, makeShape, makeQr, makeImage, makeLine, makeDecorative } from './editorUtils';

// Iconos SVG pequeños para cada tipo de forma
function ShapeIcon({ kind }) {
  const s = { display: 'block', pointerEvents: 'none' };
  switch (kind) {
    case 'rect':
      return <svg viewBox="0 0 24 24" width="26" height="26" style={s}><rect x="2" y="6" width="20" height="12" rx="1.5" fill="currentColor"/></svg>;
    case 'circle':
      return <svg viewBox="0 0 24 24" width="26" height="26" style={s}><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>;
    case 'diamond':
      return <svg viewBox="0 0 24 24" width="26" height="26" style={s}><polygon points="12,2 22,12 12,22 2,12" fill="currentColor"/></svg>;
    case 'triangle':
      return <svg viewBox="0 0 24 24" width="26" height="26" style={s}><polygon points="12,2 22,22 2,22" fill="currentColor"/></svg>;
    case 'star':
      return <svg viewBox="0 0 24 24" width="26" height="26" style={s}><polygon points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,17 5.5,21 7.5,13.5 2,9 9,9" fill="currentColor"/></svg>;
    case 'hexagon':
      return <svg viewBox="0 0 24 24" width="26" height="26" style={s}><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="currentColor"/></svg>;
    case 'seal':
      return <svg viewBox="0 0 24 24" width="26" height="26" style={s}><polygon points="12,1 13.8,5.2 17.5,2.5 16.9,7.1 21.5,6.5 18.8,10.2 23,12 18.8,13.8 21.5,17.5 16.9,16.9 17.5,21.5 13.8,18.8 12,23 10.2,18.8 6.5,21.5 7.1,16.9 2.5,17.5 5.2,13.8 1,12 5.2,10.2 2.5,6.5 7.1,7.1 6.5,2.5 10.2,5.2" fill="currentColor"/></svg>;
    default:
      return null;
  }
}

const SHAPE_OPTIONS = [
  { kind: 'rect',     label: 'Rectángulo' },
  { kind: 'circle',   label: 'Círculo' },
  { kind: 'diamond',  label: 'Rombo' },
  { kind: 'triangle', label: 'Triángulo' },
  { kind: 'star',     label: 'Estrella' },
  { kind: 'hexagon',  label: 'Hexágono' },
  { kind: 'seal',     label: 'Sello' },
];

export function ElementsPanel({ onAdd, canvas, setCanvas }) {
  const BASE_ELEMS = [
    { label: 'Texto',   icon: <Type size={15} />,   create: () => onAdd(makeText(150, 160)) },
    { label: 'QR Code', icon: <QrCode size={15} />, create: () => onAdd(makeQr(undefined, undefined, canvas.width, canvas.height)) },
    { label: 'Imagen',  icon: <Image size={15} />,  create: () => onAdd(makeImage(40, 30)) },
    { label: 'Línea',   icon: <Minus size={15} />,  create: () => onAdd(makeLine(50, 200)) },
  ];

  return (
    <aside className="ced-panel ced-panel--left">

      {/* Elementos base */}
      <div className="ced-section">
        <p className="ced-section-title">Elementos</p>
        <div className="ced-elem-grid">
          {BASE_ELEMS.map(t => (
            <button key={t.label} className="ced-elem-btn" onClick={t.create} title={t.label}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Galería de formas */}
      <div className="ced-section">
        <p className="ced-section-title">Formas</p>
        <div className="ced-shape-grid">
          {SHAPE_OPTIONS.map(({ kind, label }) => (
            <button
              key={kind}
              className="ced-shape-btn"
              onClick={() => onAdd(makeShape(kind, 60, 60))}
              title={label}
            >
              <ShapeIcon kind={kind} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Decorativos prediseñados */}
      <div className="ced-section">
        <p className="ced-section-title">Decorativos</p>
        <p className="ced-section-hint">Elementos SVG listos para certificados.</p>
        <div className="ced-shape-grid">
          {DECORATIVE_LIST.map(({ kind, label, color }) => (
            <button
              key={kind}
              className="ced-shape-btn ced-shape-btn--deco"
              onClick={() => onAdd(makeDecorative(kind, 80, 80))}
              title={label}
            >
              <span className="ced-deco-icon" style={{ color }}>
                {kind === 'stamp' && (
                  <svg viewBox="0 0 28 28" width="28" height="28" style={{ display: 'block' }}>
                    <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="2.5"/>
                    <circle cx="14" cy="14" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="14" cy="14" r="3" fill="currentColor" fillOpacity="0.3"/>
                  </svg>
                )}
                {kind === 'ribbon' && (
                  <svg viewBox="0 0 28 16" width="28" height="16" style={{ display: 'block' }}>
                    <polygon points="0,8 4,0 24,0 28,8 24,16 4,16" fill="currentColor"/>
                    <polygon points="4,0 1,8 4,16" fill="rgba(0,0,0,0.2)"/>
                    <polygon points="24,0 27,8 24,16" fill="rgba(0,0,0,0.2)"/>
                  </svg>
                )}
                {kind === 'award-star' && (
                  <svg viewBox="0 0 28 28" width="28" height="28" style={{ display: 'block' }}>
                    <polygon points="14,1 17.5,10 27,10 19.5,15.5 22,25 14,19.5 6,25 8.5,15.5 1,10 10.5,10" fill="currentColor"/>
                    <circle cx="14" cy="15" r="4" fill="rgba(255,255,255,0.3)"/>
                  </svg>
                )}
                {kind === 'crown' && (
                  <svg viewBox="0 0 28 20" width="28" height="20" style={{ display: 'block' }}>
                    <polygon points="2,18 2,7 8,13 14,1 20,13 26,7 26,18" fill="currentColor"/>
                    <rect x="2" y="17" width="24" height="3" rx="1.5" fill="currentColor"/>
                    <circle cx="14" cy="1" r="2" fill="rgba(255,255,255,0.8)"/>
                    <circle cx="2"  cy="7" r="1.5" fill="rgba(255,255,255,0.7)"/>
                    <circle cx="26" cy="7" r="1.5" fill="rgba(255,255,255,0.7)"/>
                  </svg>
                )}
                {kind === 'laurel-left' && (
                  <svg viewBox="0 0 16 28" width="16" height="28" style={{ display: 'block' }}>
                    <ellipse cx="11" cy="5"  rx="5" ry="3" transform="rotate(-30 11 5)"  fill="currentColor" fillOpacity="0.9"/>
                    <ellipse cx="9"  cy="11" rx="5" ry="3" transform="rotate(-20 9 11)"  fill="currentColor" fillOpacity="0.85"/>
                    <ellipse cx="8"  cy="17" rx="5" ry="3" transform="rotate(-10 8 17)"  fill="currentColor" fillOpacity="0.8"/>
                    <ellipse cx="8"  cy="23" rx="5" ry="3" transform="rotate(0  8 23)"   fill="currentColor" fillOpacity="0.75"/>
                    <line x1="10" y1="2" x2="8" y2="26" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
                  </svg>
                )}
                {kind === 'laurel-right' && (
                  <svg viewBox="0 0 16 28" width="16" height="28" style={{ display: 'block' }}>
                    <ellipse cx="5"  cy="5"  rx="5" ry="3" transform="rotate(30 5 5)"    fill="currentColor" fillOpacity="0.9"/>
                    <ellipse cx="7"  cy="11" rx="5" ry="3" transform="rotate(20 7 11)"   fill="currentColor" fillOpacity="0.85"/>
                    <ellipse cx="8"  cy="17" rx="5" ry="3" transform="rotate(10 8 17)"   fill="currentColor" fillOpacity="0.8"/>
                    <ellipse cx="8"  cy="23" rx="5" ry="3" transform="rotate(0  8 23)"   fill="currentColor" fillOpacity="0.75"/>
                    <line x1="6" y1="2" x2="8" y2="26" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
                  </svg>
                )}
                {kind === 'medal' && (
                  <svg viewBox="0 0 18 28" width="18" height="28" style={{ display: 'block' }}>
                    <path d="M6,0 L12,0 L12,11 L9,13 L6,11 Z" fill="currentColor" fillOpacity="0.75"/>
                    <circle cx="9" cy="21" r="7" fill="currentColor"/>
                    <circle cx="9" cy="21" r="4.5" fill="rgba(255,255,255,0.22)"/>
                    <circle cx="9" cy="21" r="2" fill="rgba(255,255,255,0.12)"/>
                  </svg>
                )}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Variables */}
      <div className="ced-section">
        <p className="ced-section-title">Variables</p>
        <p className="ced-section-hint">Clic para agregar como bloque de texto.</p>
        <div className="ced-var-list">
          {VARIABLES.map(({ v, label }) => (
            <button
              key={v}
              className="ced-var-chip"
              onClick={() => onAdd(makeText(100, 160, v))}
              title={`Agregar bloque: ${label}`}
            >
              <code>{v}</code>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="ced-section">
        <p className="ced-section-title">Canvas</p>
        <label className="ced-label">Color de fondo</label>
        <div className="ced-row">
          <input
            type="color"
            className="ced-color"
            value={canvas.background.startsWith('#') ? canvas.background : '#ffffff'}
            onChange={e => setCanvas(c => ({ ...c, background: e.target.value }))}
          />
          <input
            type="text"
            className="ced-input"
            value={canvas.background}
            onChange={e => setCanvas(c => ({ ...c, background: e.target.value }))}
            placeholder="#ffffff"
          />
        </div>
        <label className="ced-label" style={{ marginTop: 8 }}>Orientación</label>
        <select
          className="ced-select"
          value={canvas.width >= canvas.height ? 'landscape' : 'portrait'}
          onChange={e => {
            if (e.target.value === 'landscape') setCanvas(c => ({ ...c, width: 800, height: 566 }));
            else setCanvas(c => ({ ...c, width: 566, height: 800 }));
          }}
        >
          <option value="landscape">Horizontal (A4)</option>
          <option value="portrait">Vertical (A4)</option>
        </select>
        <label className="ced-label" style={{ marginTop: 8 }}>Imagen de fondo (URL)</label>
        <input
          type="text"
          className="ced-input"
          placeholder="https://..."
          value={canvas.backgroundImage || ''}
          onChange={e => setCanvas(c => ({ ...c, backgroundImage: e.target.value }))}
        />
        {canvas.backgroundImage && (
          <button className="ced-link-btn" onClick={() => setCanvas(c => ({ ...c, backgroundImage: '' }))}>
            Quitar imagen
          </button>
        )}
      </div>
    </aside>
  );
}
