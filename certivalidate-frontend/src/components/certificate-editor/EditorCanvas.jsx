import React, { useRef, useCallback } from 'react';
import { applyPreviews } from './editorUtils';

const HANDLE = 8;

// Mismo script que CertificateEditor: usa zoom, se inyecta antes de </body>
const CANVAS_SCALE_SCRIPT = `<script>(function(){function fit(){var cw=Math.max(document.body.scrollWidth,document.documentElement.scrollWidth,1),vw=Math.max(window.innerWidth,1);if(cw>vw)document.documentElement.style.zoom=(vw/cw).toFixed(4);}fit();window.addEventListener('resize',fit);})();<\/script>`;

function injectScaleScript(html) {
  if (!html) return '';
  if (/<\/body>/i.test(html))  return html.replace(/<\/body>/i, `${CANVAS_SCALE_SCRIPT}</body>`);
  if (/<\/html>/i.test(html))  return html.replace(/<\/html>/i, `${CANVAS_SCALE_SCRIPT}</html>`);
  return html + CANVAS_SCALE_SCRIPT;
}

function ResizeHandles({ onStart }) {
  const handles = [
    { k: 'nw', s: { top: -HANDLE/2, left: -HANDLE/2, cursor: 'nw-resize' } },
    { k: 'n',  s: { top: -HANDLE/2, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' } },
    { k: 'ne', s: { top: -HANDLE/2, right: -HANDLE/2, cursor: 'ne-resize' } },
    { k: 'e',  s: { top: '50%', right: -HANDLE/2, transform: 'translateY(-50%)', cursor: 'e-resize' } },
    { k: 'se', s: { bottom: -HANDLE/2, right: -HANDLE/2, cursor: 'se-resize' } },
    { k: 's',  s: { bottom: -HANDLE/2, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' } },
    { k: 'sw', s: { bottom: -HANDLE/2, left: -HANDLE/2, cursor: 'sw-resize' } },
    { k: 'w',  s: { top: '50%', left: -HANDLE/2, transform: 'translateY(-50%)', cursor: 'w-resize' } },
  ];
  return (
    <>
      {handles.map(h => (
        <div
          key={h.k}
          style={{
            position: 'absolute', width: HANDLE, height: HANDLE,
            background: '#fff', border: '2px solid #3b82f6', borderRadius: 2, zIndex: 20,
            ...h.s,
          }}
          onMouseDown={e => { e.stopPropagation(); onStart(e, h.k); }}
        />
      ))}
    </>
  );
}

function QrPlaceholder() {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#f9fafb',
      border: '2px dashed #d1d5db', borderRadius: 4, color: '#9ca3af',
      fontSize: 11, gap: 3, pointerEvents: 'none', userSelect: 'none',
    }}>
      <span style={{ fontSize: 28, lineHeight: 1 }}>▣</span>
      <span>QR Code</span>
    </div>
  );
}

function ElementView({ el, selected, isEditing, onSelect, onMouseDown, onDoubleClick, onContentChange, onResizeStart }) {
  const { x, y, width, height, type, style = {}, content = '', src } = el;

  const wrapStyle = {
    position: 'absolute',
    left: Math.round(x), top: Math.round(y),
    width: Math.round(width), height: Math.round(height),
    cursor: 'move', boxSizing: 'border-box',
    outline: selected ? '2px solid #3b82f6' : 'none',
    zIndex: selected ? 10 : 1,
  };

  let inner;

  if (type === 'text') {
    const ts = {
      width: '100%', height: '100%',
      fontSize: style.fontSize, fontFamily: `'${style.fontFamily}', serif`,
      color: style.color, fontWeight: style.fontWeight,
      fontStyle: style.fontStyle, textAlign: style.textAlign,
      lineHeight: 1.3, whiteSpace: 'pre-wrap', overflow: 'hidden',
    };
    inner = isEditing ? (
      <textarea
        autoFocus
        style={{ ...ts, border: 'none', outline: 'none', background: 'transparent', resize: 'none', padding: 0, boxSizing: 'border-box' }}
        value={content}
        onChange={e => onContentChange(el.id, e.target.value)}
        onMouseDown={e => e.stopPropagation()}
      />
    ) : (
      <div style={{ ...ts, pointerEvents: 'none', userSelect: 'none' }}>
        {applyPreviews(content)}
      </div>
    );
  } else if (type === 'rect') {
    const s = el.style;
    const sk = el.shapeKind || 'rect';
    const svgProps = { width: '100%', height: '100%', preserveAspectRatio: 'none', style: { display: 'block', pointerEvents: 'none' } };
    const poly = (points) => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...svgProps}>
        <polygon points={points} fill={s.background}
          stroke={s.borderWidth > 0 ? s.borderColor : 'none'}
          strokeWidth={s.borderWidth > 0 ? s.borderWidth * 2 : 0} />
      </svg>
    );
    if (sk === 'circle') {
      inner = <div style={{ width: '100%', height: '100%', background: s.background, borderRadius: '50%', border: s.borderWidth > 0 ? `${s.borderWidth}px solid ${s.borderColor}` : 'none', pointerEvents: 'none' }} />;
    } else if (sk === 'diamond') {
      inner = <div style={{ width: '100%', height: '100%', background: s.background, clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)', pointerEvents: 'none' }} />;
    } else if (sk === 'triangle') {
      inner = poly('50,3 97,97 3,97');
    } else if (sk === 'star') {
      inner = poly('50,3 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35');
    } else if (sk === 'hexagon') {
      inner = poly('50,2 98,26 98,74 50,98 2,74 2,26');
    } else if (sk === 'seal') {
      inner = poly('50,3 58.5,18 73.5,9 73.3,27 90.7,26 81.9,42 97,50 81.9,59 90.7,73 73.3,73 73.5,91 58.5,82 50,97 41.5,82 26.5,91 26.7,73 9.3,73 18.1,59 3,50 18.1,42 9.3,26 26.7,27 26.5,9 41.5,18');
    } else {
      inner = <div style={{ width: '100%', height: '100%', background: s.background, borderRadius: s.borderRadius, border: s.borderWidth > 0 ? `${s.borderWidth}px solid ${s.borderColor}` : 'none', pointerEvents: 'none' }} />;
    }
  } else if (type === 'qr') {
    inner = <QrPlaceholder />;
  } else if (type === 'image') {
    inner = src ? (
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: style.objectFit || 'contain', display: 'block', pointerEvents: 'none' }} />
    ) : (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', border: '2px dashed #d1d5db', color: '#9ca3af', fontSize: 12, borderRadius: 4, pointerEvents: 'none' }}>
        🖼 Imagen
      </div>
    );
  } else if (type === 'line') {
    wrapStyle.height = Math.max(2, Math.round(height));
    inner = <div style={{ width: '100%', height: '100%', background: el.style.color || '#ccc', borderRadius: 2, pointerEvents: 'none' }} />;
  }

  return (
    <div
      style={wrapStyle}
      onMouseDown={e => { e.stopPropagation(); onSelect(el.id); onMouseDown(e, el); }}
      onDoubleClick={type === 'text' ? e => { e.stopPropagation(); onDoubleClick(el.id); } : undefined}
    >
      {inner}
      {selected && (
        <ResizeHandles onStart={(e, handle) => onResizeStart(e, el.id, handle)} />
      )}
    </div>
  );
}

export function EditorCanvas({ canvas, elements, selectedId, editingId, scale, onSelect, onDeselect, onUpdate, onSetEditing, onContentChange, legacyHtml }) {
  const drag = useRef(null);
  const resize = useRef(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const handleMouseMove = useCallback(e => {
    const s = scaleRef.current || 1;
    if (drag.current) {
      const { id, sx, sy, ex, ey } = drag.current;
      onUpdate(id, {
        x: Math.max(0, ex + (e.clientX - sx) / s),
        y: Math.max(0, ey + (e.clientY - sy) / s),
      });
    }
    if (resize.current) {
      const { id, handle, sx, sy, ox, oy, ow, oh } = resize.current;
      const dx = (e.clientX - sx) / s;
      const dy = (e.clientY - sy) / s;
      let nx = ox, ny = oy, nw = ow, nh = oh;
      if (handle.includes('e')) nw = Math.max(20, ow + dx);
      if (handle.includes('w')) { nw = Math.max(20, ow - dx); nx = ox + ow - nw; }
      if (handle.includes('s')) nh = Math.max(4, oh + dy);
      if (handle.includes('n')) { nh = Math.max(4, oh - dy); ny = oy + oh - nh; }
      onUpdate(id, { x: nx, y: ny, width: nw, height: nh });
    }
  }, [onUpdate]);

  const handleMouseUp = useCallback(() => {
    drag.current = null;
    resize.current = null;
  }, []);

  const handleElemMouseDown = useCallback((e, el) => {
    if (editingId === el.id) return;
    drag.current = { id: el.id, sx: e.clientX, sy: e.clientY, ex: el.x, ey: el.y };
  }, [editingId]);

  const handleResizeStart = useCallback((e, id, handle) => {
    e.preventDefault();
    const el = elements.find(el => el.id === id);
    if (!el) return;
    resize.current = { id, handle, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.width, oh: el.height };
  }, [elements]);

  const bgProps = canvas.backgroundImage
    ? { backgroundImage: `url('${canvas.backgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <div
      style={{
        position: 'relative',
        width: canvas.width, height: canvas.height,
        background: canvas.background,
        ...bgProps,
        overflow: 'hidden',
        flexShrink: 0,
        userSelect: 'none',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseDown={() => { onDeselect(); }}
    >
      {/* Capa de referencia: HTML legacy escalado para que quepa en el canvas */}
      {legacyHtml && (
        <iframe
          srcDoc={injectScaleScript(legacyHtml)}
          title="Referencia HTML"
          sandbox="allow-same-origin allow-scripts"
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            border: 'none', pointerEvents: 'none',
          }}
        />
      )}
      {elements.map(el => (
        <ElementView
          key={el.id}
          el={el}
          selected={selectedId === el.id}
          isEditing={editingId === el.id}
          onSelect={onSelect}
          onMouseDown={handleElemMouseDown}
          onDoubleClick={onSetEditing}
          onContentChange={onContentChange}
          onResizeStart={handleResizeStart}
        />
      ))}
    </div>
  );
}
