import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { ArrowLeft, Save, Eye, EyeOff, ZoomIn, ZoomOut, Code2, Wand2, AlertTriangle } from 'lucide-react';
import { EditorCanvas } from './EditorCanvas';
import { ElementsPanel } from './ElementsPanel';
import { PropertiesPanel } from './PropertiesPanel';
import {
  serializeToHtml, parseHtmlToEditorState, buildPreviewHtml,
  buildCompositeHtml, makeDefaultTemplateState, CANVAS_DEFAULTS,
} from './editorUtils';
import './CertificateEditor.css';

// Usa `zoom` en lugar de `transform` para escalar el certificado al ancho disponible.
// `zoom` respeta el layout (flex, grid, etc.) sin romper la geometría del body.
// Se inyecta justo ANTES de </body> para que el DOM esté completamente renderizado.
const SCALE_SCRIPT = `<script>(function(){function fit(){var cw=Math.max(document.body.scrollWidth,document.documentElement.scrollWidth,1),vw=Math.max(window.innerWidth,1);if(cw>vw)document.documentElement.style.zoom=(vw/cw).toFixed(4);}fit();window.addEventListener('resize',fit);})();<\/script>`;

/**
 * Prepara un documento HTML para mostrarse en un iframe con auto-escala.
 *
 * - Documento HTML completo (tiene <!DOCTYPE o <html>): inyecta el script
 *   antes de </body> SIN DOMPurify → preserva todos los <style>.
 * - Fragmento data-ced (generado por nuestro código): NO sanitizar con DOMPurify
 *   porque ese perfil elimina los <svg> que usan las formas (estrella, triángulo…).
 *   El iframe sandboxed ya protege contra XSS.
 */
function buildScaledDoc(html) {
  if (!html?.trim()) return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>`;

  // Elimina markdown code fences (```html ... ```) que a veces se guardan en templates
  html = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  const isFullDoc = /<!DOCTYPE\s+html|<html[\s>]/i.test(html);

  if (isFullDoc) {
    if (/<\/body>/i.test(html))  return html.replace(/<\/body>/i, `${SCALE_SCRIPT}</body>`);
    if (/<\/html>/i.test(html))  return html.replace(/<\/html>/i, `${SCALE_SCRIPT}</html>`);
    return html + SCALE_SCRIPT;
  }

  // Fragmento data-ced: envolverlo sin sanitizar para preservar <svg> de formas
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box;}html,body{margin:0;padding:0;}</style></head><body>${html}${SCALE_SCRIPT}</body></html>`;
}

// Determina el estado inicial según el HTML de la plantilla
function resolveInitialState(plantilla) {
  if (plantilla?._new) {
    const def = makeDefaultTemplateState();
    return { mode: 'visual', canvas: def.canvas, elements: def.elements, htmlCode: '', legacyHtml: '' };
  }

  const raw  = plantilla?.template_html ?? '';
  const html = raw.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const parsed = parseHtmlToEditorState(html);

  if (parsed) {
    return {
      mode: 'visual',
      canvas:     parsed.canvas,
      elements:   parsed.elements,
      htmlCode:   html,
      // OVERLAY_V1: restaura el HTML legacy como referencia de fondo
      legacyHtml: parsed.legacyHtml || '',
    };
  }

  // HTML legacy o arbitrario: abre en modo HTML
  return { mode: 'html', canvas: { ...CANVAS_DEFAULTS }, elements: [], htmlCode: html, legacyHtml: html };
}

export function CertificateEditor({ plantilla, onSave, onCancel }) {
  const init = useMemo(() => resolveInitialState(plantilla), []); // eslint-disable-line

  // ── Modo: 'visual' | 'html' | 'preview' ──────────────────────────────────
  const [mode, setMode] = useState(init.mode);

  // ── Estado del editor visual ──────────────────────────────────────────────
  const [canvas, setCanvas]   = useState({ ...CANVAS_DEFAULTS, ...init.canvas });
  const [elements, setElements] = useState(init.elements);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [scale, setScale]           = useState(1);

  // ── Estado del editor HTML ────────────────────────────────────────────────
  // htmlCode es el HTML que el usuario edita directamente.
  // Al cambiar de modo Visual→HTML se serializa; de HTML→Visual se parsea.
  const [htmlCode, setHtmlCode] = useState(init.htmlCode);
  const [htmlParseError, setHtmlParseError] = useState('');

  // HTML legacy para mostrar como referencia de fondo en el canvas visual.
  // init.legacyHtml se rellena cuando el formato es OVERLAY_V1 o HTML puro.
  const [legacyHtml, setLegacyHtml] = useState(
    init.legacyHtml ?? (init.mode === 'html' ? init.htmlCode : '')
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── HTML split pane ───────────────────────────────────────────────────────
  const [htmlSplit, setHtmlSplit] = useState(55); // % del editor de código
  const htmlBodyRef  = useRef(null);

  const handleSplitMouseDown = useCallback((e) => {
    e.preventDefault();
    const body = htmlBodyRef.current;
    if (!body) return;
    const onMove = (mv) => {
      const rect = body.getBoundingClientRect();
      const pct  = Math.min(80, Math.max(20, ((mv.clientX - rect.left) / rect.width) * 100));
      setHtmlSplit(pct);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // wrapRef apunta al ced-canvas-scroll para medir el espacio disponible real
  const wrapRef = useRef(null);

  // Auto-scale canvas: mide el contenedor de scroll para obtener dimensiones exactas
  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current) return;
      const avail  = wrapRef.current.clientWidth  - 48; // 24px padding c/lado
      const availH = wrapRef.current.clientHeight - 48;
      setScale(Math.max(0.15, Math.min(1, avail / canvas.width, availH / canvas.height)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [canvas.width, canvas.height]);

  // Escape → cancela edición inline
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setEditingId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const selectedEl = elements.find(el => el.id === selectedId) ?? null;

  // HTML a mostrar en preview: combina legacyHtml + elementos si hay ambos
  const currentHtml = mode === 'html'
    ? htmlCode
    : (legacyHtml && elements.length > 0)
      ? buildCompositeHtml(legacyHtml, canvas, elements)
      : (elements.length > 0 ? serializeToHtml(canvas, elements) : htmlCode);

  const previewSrc = useMemo(
    () => buildScaledDoc(buildPreviewHtml(currentHtml)),
    [currentHtml]
  );

  // ── Cambio de modo ────────────────────────────────────────────────────────
  const switchToHtml = () => {
    // Si hay elementos visuales → serializa al formato data-ced
    // Si solo hay referencia legacy (sin elementos propios) → muestra el HTML original
    if (elements.length > 0) {
      setHtmlCode(serializeToHtml(canvas, elements));
    } else if (legacyHtml) {
      setHtmlCode(legacyHtml);
    }
    setHtmlParseError('');
    setMode('html');
  };

  const switchToVisual = () => {
    // Desde preview con elementos ya cargados → vuelve directo al canvas
    if (mode === 'preview' && elements.length > 0) {
      setHtmlParseError('');
      setMode('visual');
      return;
    }
    // Ya hay elementos visuales (p.ej. vuelve desde preview sin haberlos editado en HTML)
    if (elements.length > 0 && !htmlCode) {
      setHtmlParseError('');
      setMode('visual');
      return;
    }
    const parsed = parseHtmlToEditorState(htmlCode);
    if (parsed) {
      // HTML con data-ced-* → restaura elementos exactamente
      setCanvas({ ...CANVAS_DEFAULTS, ...parsed.canvas });
      setElements(parsed.elements);
      setLegacyHtml('');
      setHtmlParseError('');
      setMode('visual');
    } else {
      // HTML no parseable (legacy): abre canvas en blanco con el HTML como referencia de fondo
      setCanvas({ ...CANVAS_DEFAULTS });
      setElements([]);
      setLegacyHtml(htmlCode);
      setHtmlParseError('');
      setMode('visual');
    }
  };

  // Cuando el usuario escribe en el editor HTML: intenta parsear silenciosamente
  const handleHtmlChange = useCallback((e) => {
    const code = e.target.value;
    setHtmlCode(code);
    setHtmlParseError('');
    // Sincroniza visual en tiempo real si el HTML es parseable
    const parsed = parseHtmlToEditorState(code);
    if (parsed) {
      setCanvas(c => ({ ...c, ...parsed.canvas }));
      setElements(parsed.elements);
    }
  }, []);

  // ── Operaciones del editor visual ─────────────────────────────────────────
  const handleSelect   = useCallback((id) => { setSelectedId(id); setEditingId(p => p !== id ? null : p); }, []);
  const handleDeselect = useCallback(() => { setSelectedId(null); setEditingId(null); }, []);

  const addElement = useCallback(el => {
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
    setEditingId(null);
  }, []);

  const updateElement = useCallback((id, patch) => {
    setElements(prev => prev.map(el => {
      if (el.id !== id) return el;
      if (patch.style) return { ...el, ...patch, style: { ...el.style, ...patch.style } };
      return { ...el, ...patch };
    }));
  }, []);

  const deleteElement = useCallback(id => {
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedId(s => s === id ? null : s);
    setEditingId(e => e === id ? null : e);
  }, []);

  const moveUp = useCallback(id => {
    setElements(prev => {
      const i = prev.findIndex(el => el.id === id);
      if (i >= prev.length - 1) return prev;
      const n = [...prev]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n;
    });
  }, []);

  const moveDown = useCallback(id => {
    setElements(prev => {
      const i = prev.findIndex(el => el.id === id);
      if (i <= 0) return prev;
      const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n;
    });
  }, []);

  const handleContentChange = useCallback((id, value) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, content: value } : el));
  }, []);

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
      let finalHtml;
      if (mode === 'html') {
        finalHtml = htmlCode;
      } else if (legacyHtml && elements.length > 0) {
        // HTML legacy como fondo + elementos visuales encima
        finalHtml = buildCompositeHtml(legacyHtml, canvas, elements);
      } else if (elements.length === 0 && legacyHtml) {
        // Sin elementos propios: preserva el HTML original intacto
        finalHtml = legacyHtml;
      } else {
        finalHtml = serializeToHtml(canvas, elements);
      }
      await onSave(finalHtml);
    } catch (err) {
      setSaveError(err?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const adjustZoom = delta => setScale(s => Math.min(1, Math.max(0.2, parseFloat((s + delta).toFixed(2)))));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="ced-root" onClick={() => setEditingId(null)}>

      {/* Top bar */}
      <div className="ced-topbar">
        <button className="ced-back" onClick={onCancel}>
          <ArrowLeft size={15} /><span>Volver</span>
        </button>

        <div className="ced-topbar-center">
          <span className="ced-topbar-name">{plantilla?.nombre || 'Nueva Plantilla'}</span>
          {/* Selector de modo */}
          <div className="ced-mode-tabs">
            <button
              className={`ced-mode-tab${mode === 'visual' ? ' active' : ''}`}
              onClick={mode !== 'visual' ? switchToVisual : undefined}
              title="Editor Visual drag-and-drop"
            >
              <Wand2 size={13} /> Visual
            </button>
            <button
              className={`ced-mode-tab${mode === 'html' ? ' active' : ''}`}
              onClick={mode !== 'html' ? switchToHtml : undefined}
              title="Editor HTML directo"
            >
              <Code2 size={13} /> HTML
            </button>
            <button
              className={`ced-mode-tab${mode === 'preview' ? ' active' : ''}`}
              onClick={() => setMode(m => m === 'preview' ? (init.mode) : 'preview')}
              title="Vista previa con datos reales"
            >
              <Eye size={13} /> Preview
            </button>
          </div>
        </div>

        <div className="ced-topbar-actions">
          {saveError && <span className="ced-save-error">{saveError}</span>}
          <button className="ced-btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Error de parseo al cambiar a visual */}
      {htmlParseError && (
        <div className="ced-warning-banner" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.35)', color: '#f87171' }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
          {htmlParseError}
        </div>
      )}

      {/* ── Preview ─────────────────────────────────────────────────────── */}
      {mode === 'preview' && (
        <div className="ced-preview-full">
          <div className="ced-preview-label">Vista previa con datos de ejemplo — el diseño real del certificado</div>
          <iframe
            className="ced-preview-iframe"
            title="Vista previa"
            sandbox="allow-same-origin allow-scripts"
            srcDoc={previewSrc}
          />
        </div>
      )}

      {/* ── Editor Visual ───────────────────────────────────────────────── */}
      {mode === 'visual' && (
        <div className="ced-body">
          <ElementsPanel onAdd={addElement} canvas={canvas} setCanvas={setCanvas} />

          <div className="ced-center">
            {legacyHtml && elements.length === 0 && (
              <div className="ced-legacy-hint">
                Diseño HTML original como fondo de referencia — agrega elementos encima o
                <button className="ced-legacy-hint-btn" onClick={() => setLegacyHtml('')}>empezar en blanco</button>
              </div>
            )}
            <div className="ced-zoom-bar">
              <button className="ced-zoom-btn" onClick={() => adjustZoom(-0.1)}><ZoomOut size={13} /></button>
              <span className="ced-zoom-val">{Math.round(scale * 100)}%</span>
              <button className="ced-zoom-btn" onClick={() => adjustZoom(0.1)}><ZoomIn size={13} /></button>
            </div>
            {/* wrapRef en el scroll para medir el espacio disponible real */}
            <div className="ced-canvas-scroll" ref={wrapRef}>
              {/* Wrapper con las dimensiones visuales (escaladas) para centrado correcto */}
              <div style={{
                width:    Math.round(canvas.width  * scale),
                height:   Math.round(canvas.height * scale),
                flexShrink: 0,
                position: 'relative',
              }}>
                <div style={{
                  transform:       `scale(${scale})`,
                  transformOrigin: 'top left',
                  position:        'absolute',
                  top: 0, left: 0,
                  width:  canvas.width,
                  height: canvas.height,
                }}>
                  <EditorCanvas
                    canvas={canvas}
                    elements={elements}
                    selectedId={selectedId}
                    editingId={editingId}
                    scale={scale}
                    onSelect={handleSelect}
                    onDeselect={handleDeselect}
                    onUpdate={updateElement}
                    onSetEditing={id => { setEditingId(id); setSelectedId(id); }}
                    onContentChange={handleContentChange}
                    legacyHtml={legacyHtml}
                  />
                </div>
              </div>
            </div>
            <div className="ced-canvas-hint">
              Doble clic en texto para editar · Arrastra para mover · Esquinas para redimensionar
            </div>
          </div>

          <PropertiesPanel
            element={selectedEl}
            onUpdate={updateElement}
            onDelete={deleteElement}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
          />
        </div>
      )}

      {/* ── Editor HTML ─────────────────────────────────────────────────── */}
      {mode === 'html' && (
        <div className="ced-html-body" ref={htmlBodyRef}>
          {/* Panel código */}
          <div className="ced-html-editor-wrap" style={{ width: `${htmlSplit}%` }}>
            <div className="ced-html-editor-header">
              <span>Código HTML</span>
              <span className="ced-html-hint">
                Los atributos <code>data-ced-*</code> permiten reabrir en el Editor Visual sin pérdida
              </span>
            </div>
            <textarea
              className="ced-html-textarea"
              value={htmlCode}
              onChange={handleHtmlChange}
              spellCheck={false}
              placeholder="Escribe o pega el HTML del certificado aquí..."
            />
          </div>

          {/* Divisor arrastrable */}
          <div className="ced-html-divider" onMouseDown={handleSplitMouseDown}>
            <div className="ced-html-divider-handle" />
          </div>

          {/* Panel preview en vivo */}
          <div className="ced-html-preview-wrap" style={{ width: `${100 - htmlSplit}%` }}>
            <div className="ced-html-editor-header">
              <span>Preview en vivo</span>
              <span className="ced-html-hint">Se actualiza mientras escribes · Arrastra el divisor para redimensionar</span>
            </div>
            <div className="ced-html-preview-container">
              <iframe
                className="ced-html-preview-iframe"
                title="HTML Preview"
                sandbox="allow-same-origin allow-scripts"
                srcDoc={buildScaledDoc(buildPreviewHtml(htmlCode))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
