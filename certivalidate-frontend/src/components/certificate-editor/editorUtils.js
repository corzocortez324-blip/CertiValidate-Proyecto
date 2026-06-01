// ─── Constantes ───────────────────────────────────────────────────────────────
export const CANVAS_DEFAULTS = {
  width: 800,
  height: 566,
  background: '#ffffff',
  backgroundImage: '',
};

export const VARIABLES = [
  { v: '{{nombre}}',           label: 'Nombre completo' },
  { v: '{{apellido}}',         label: 'Apellido' },
  { v: '{{institucion}}',      label: 'Institución' },
  { v: '{{curso}}',            label: 'Curso / Programa' },
  { v: '{{fecha_emision}}',    label: 'Fecha de emisión' },
  { v: '{{fecha_expiracion}}', label: 'Fecha de expiración' },
  { v: '{{codigo_unico}}',     label: 'Código único' },
  { v: '{{documento}}',        label: 'Documento ID' },
  { v: '{{hash}}',             label: 'Hash SHA-256' },
];

export const PREVIEW_VALUES = {
  '{{nombre}}':           'Ana Martínez',
  '{{apellido}}':         'Martínez',
  '{{institucion}}':      'Universidad Central',
  '{{curso}}':            'Desarrollo Web Full Stack',
  '{{programa}}':         'Desarrollo Web Full Stack',
  '{{fecha_emision}}':    '15 de mayo de 2026',
  '{{fecha_expiracion}}': 'Sin expiración',
  '{{codigo_unico}}':     'A1B2C3D4',
  '{{codigo}}':           'A1B2C3D4',
  '{{documento}}':        '1234567890',
  '{{hash}}':             'a1b2c3d4e5f6g7h8…',
};

export function applyPreviews(content) {
  let result = content;
  for (const [variable, value] of Object.entries(PREVIEW_VALUES)) {
    result = result.replace(new RegExp(variable.replace(/[[\]{}]/g, '\\$&'), 'gi'), value);
  }
  return result;
}

let idCounter = 0;
export function generateId() {
  return `el-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

// ─── Factories de elementos ────────────────────────────────────────────────────
export function makeText(x = 100, y = 100, content = 'Texto de ejemplo') {
  return {
    id: generateId(), type: 'text', x, y, width: 500, height: 52,
    content,
    style: { fontSize: 28, fontFamily: 'Arial', color: '#1a1a1a', fontWeight: 'normal', fontStyle: 'normal', textAlign: 'center' },
  };
}

export function makeRect(x = 25, y = 25) {
  return {
    id: generateId(), type: 'rect', x, y, width: 750, height: 80,
    style: { background: 'rgba(8,145,178,0.12)', borderRadius: 8, borderColor: 'rgba(8,145,178,0.35)', borderWidth: 1 },
  };
}

export function makeQr(x, y, canvasW = 800, canvasH = 566) {
  const size = 110;
  return {
    id: generateId(), type: 'qr',
    x: x ?? Math.round(canvasW / 2 - size / 2),
    y: y ?? Math.round(canvasH - size - 40),
    width: size, height: size,
  };
}

export function makeImage(x = 30, y = 20, src = '') {
  return {
    id: generateId(), type: 'image', x, y, width: 140, height: 70, src,
    style: { objectFit: 'contain' },
  };
}

export function makeLine(x = 50, y = 220) {
  return {
    id: generateId(), type: 'line', x, y, width: 700, height: 2,
    style: { color: '#e5e7eb' },
  };
}

// ─── Polígonos SVG para formas (viewBox 0 0 100 100) ──────────────────────────
const SHAPE_POLYGONS = {
  triangle: '50,3 97,97 3,97',
  star:     '50,3 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35',
  hexagon:  '50,2 98,26 98,74 50,98 2,74 2,26',
  seal:     '50,3 58.5,18 73.5,9 73.3,27 90.7,26 81.9,42 97,50 81.9,59 90.7,73 73.3,73 73.5,91 58.5,82 50,97 41.5,82 26.5,91 26.7,73 9.3,73 18.1,59 3,50 18.1,42 9.3,26 26.7,27 26.5,9 41.5,18',
};

const SHAPE_DEFAULTS = {
  rect:     { w: 300, h: 80,  bg: 'rgba(8,145,178,0.12)', br: 8, bc: 'rgba(8,145,178,0.35)', bw: 1 },
  circle:   { w: 120, h: 120, bg: '#0891b2', br: 0, bc: 'transparent', bw: 0 },
  diamond:  { w: 110, h: 110, bg: '#0891b2', br: 0, bc: 'transparent', bw: 0 },
  triangle: { w: 140, h: 120, bg: '#0891b2', br: 0, bc: 'transparent', bw: 0 },
  star:     { w: 110, h: 110, bg: '#f59e0b', br: 0, bc: 'transparent', bw: 0 },
  hexagon:  { w: 120, h: 120, bg: '#8b5cf6', br: 0, bc: 'transparent', bw: 0 },
  seal:     { w: 130, h: 130, bg: '#ef4444', br: 0, bc: 'transparent', bw: 0 },
};

export function makeShape(shapeKind = 'rect', x = 100, y = 100) {
  const d = SHAPE_DEFAULTS[shapeKind] || SHAPE_DEFAULTS.rect;
  return {
    id: generateId(), type: 'rect',
    x, y, width: d.w, height: d.h,
    shapeKind,
    style: { background: d.bg, borderRadius: d.br, borderColor: d.bc, borderWidth: d.bw },
  };
}

// ─── Decorativos prediseñados (SVG como data URL) ─────────────────────────────
function encodeSvg(s) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}

const DECORATIVE_DEFS = {
  stamp: c =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="${c}" stroke-width="3.5"/><circle cx="50" cy="50" r="37" fill="none" stroke="${c}" stroke-width="1.5"/><circle cx="50" cy="50" r="28" fill="${c}" fill-opacity="0.09"/></svg>`,
  ribbon: c =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 56"><polygon points="0,28 16,0 184,0 200,28 184,56 16,56" fill="${c}"/><polygon points="16,0 4,28 16,56" fill="rgba(0,0,0,0.18)"/><polygon points="184,0 196,28 184,56" fill="rgba(0,0,0,0.18)"/></svg>`,
  'award-star': c =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,3 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="${c}"/><circle cx="50" cy="52" r="17" fill="rgba(255,255,255,0.28)"/></svg>`,
  crown: c =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><polygon points="10,72 10,30 30,52 50,8 70,52 90,30 90,72" fill="${c}" stroke="${c}" stroke-linejoin="round"/><rect x="8" y="70" width="84" height="10" rx="3" fill="${c}"/><circle cx="50" cy="8" r="6" fill="rgba(255,255,255,0.75)"/><circle cx="10" cy="30" r="5" fill="rgba(255,255,255,0.75)"/><circle cx="90" cy="30" r="5" fill="rgba(255,255,255,0.75)"/></svg>`,
  'laurel-left': c =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 130"><path d="M38,8 C28,15 30,28 33,35 C20,30 18,44 22,52 C9,47 10,62 14,70 C3,66 5,80 10,88 C2,88 8,102 14,108 C10,118 20,126 28,128 L30,124 C22,120 14,112 18,104 C26,100 38,92 32,80 C44,76 42,62 34,56 C46,50 42,36 36,28 C46,20 44,8 38,8 Z" fill="${c}" fill-opacity="0.9"/></svg>`,
  'laurel-right': c =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 130"><path d="M10,8 C20,15 18,28 15,35 C28,30 30,44 26,52 C39,47 38,62 34,70 C45,66 43,80 38,88 C46,88 40,102 34,108 C38,118 28,126 20,128 L18,124 C26,120 34,112 30,104 C22,100 10,92 16,80 C4,76 6,62 14,56 C2,50 6,36 12,28 C2,20 4,8 10,8 Z" fill="${c}" fill-opacity="0.9"/></svg>`,
  medal: c =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 100"><path d="M22,0 L38,0 L38,38 L30,42 L22,38 Z" fill="${c}" fill-opacity="0.8"/><circle cx="30" cy="68" r="28" fill="${c}"/><circle cx="30" cy="68" r="22" fill="rgba(255,255,255,0.2)"/><circle cx="30" cy="68" r="15" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/></svg>`,
};

const DECORATIVE_CONFIGS = {
  stamp:          { w: 130, h: 130, color: '#0891b2', label: 'Sello' },
  ribbon:         { w: 280, h: 78,  color: '#0891b2', label: 'Cinta' },
  'award-star':   { w: 120, h: 120, color: '#f59e0b', label: 'Estrella' },
  crown:          { w: 120, h: 96,  color: '#f59e0b', label: 'Corona' },
  'laurel-left':  { w: 54,  h: 146, color: '#16a34a', label: 'Laurel izq.' },
  'laurel-right': { w: 54,  h: 146, color: '#16a34a', label: 'Laurel der.' },
  medal:          { w: 75,  h: 125, color: '#f59e0b', label: 'Medalla' },
};

export const DECORATIVE_LIST = Object.entries(DECORATIVE_CONFIGS).map(([kind, cfg]) => ({ kind, ...cfg }));

export function makeDecorative(kind, x = 100, y = 100) {
  const cfg = DECORATIVE_CONFIGS[kind];
  if (!cfg) return makeImage(x, y);
  const fn = DECORATIVE_DEFS[kind];
  const src = fn ? encodeSvg(fn(cfg.color)) : '';
  return { id: generateId(), type: 'image', x, y, width: cfg.w, height: cfg.h, src, style: { objectFit: 'contain' } };
}

// ─── Serialización: Visual → HTML (formato unificado data-ced-v="2") ───────────
// El HTML generado es estándar, renderizable en cualquier navegador.
// Los atributos data-ced-* almacenan metadatos para reconstrucción visual exacta.

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function elementToTag(el) {
  const pos = `position:absolute;left:${Math.round(el.x)}px;top:${Math.round(el.y)}px;width:${Math.round(el.width)}px;height:${Math.round(el.height)}px;`;

  switch (el.type) {
    case 'text': {
      const s = el.style;
      const css = `${pos}font-size:${s.fontSize}px;font-family:'${s.fontFamily}',serif;color:${s.color};font-weight:${s.fontWeight};font-style:${s.fontStyle};text-align:${s.textAlign};line-height:1.3;white-space:pre-wrap;overflow:hidden;`;
      return `<div data-ced-id="${el.id}" data-ced-type="text" data-ced-content="${escAttr(el.content)}" data-ced-fs="${s.fontSize}" data-ced-ff="${escAttr(s.fontFamily)}" data-ced-fc="${escAttr(s.color)}" data-ced-fw="${s.fontWeight}" data-ced-fi="${s.fontStyle}" data-ced-ta="${s.textAlign}" style="${css}">${escAttr(el.content)}</div>`;
    }
    case 'rect': {
      const s = el.style;
      const sk = el.shapeKind || 'rect';
      const border = s.borderWidth > 0 ? `border:${s.borderWidth}px solid ${s.borderColor};` : '';
      let css, inner = '';
      if (sk === 'circle') {
        css = `${pos}background:${s.background};border-radius:50%;${border}`;
      } else if (sk === 'diamond') {
        css = `${pos}background:${s.background};clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);`;
      } else if (SHAPE_POLYGONS[sk]) {
        const sw = (s.borderWidth || 0) * 2;
        const stroke = sw > 0 ? ` stroke="${escAttr(s.borderColor)}" stroke-width="${sw}"` : '';
        inner = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none" style="display:block;"><polygon points="${SHAPE_POLYGONS[sk]}" fill="${escAttr(s.background)}"${stroke}/></svg>`;
        css = `${pos}`;
      } else {
        css = `${pos}background:${s.background};border-radius:${s.borderRadius}px;${border}`;
      }
      return `<div data-ced-id="${el.id}" data-ced-type="rect" data-ced-sk="${sk}" data-ced-bg="${escAttr(s.background)}" data-ced-br="${s.borderRadius}" data-ced-bw="${s.borderWidth}" data-ced-bc="${escAttr(s.borderColor)}" style="${css}">${inner}</div>`;
    }
    case 'qr':
      return `<div data-ced-id="${el.id}" data-ced-type="qr" style="${pos}">{{qr}}</div>`;
    case 'image': {
      if (!el.src) return '';
      const fit = el.style?.objectFit || 'contain';
      const css = `${pos}object-fit:${fit};display:block;`;
      return `<img data-ced-id="${el.id}" data-ced-type="image" data-ced-fit="${fit}" src="${escAttr(el.src)}" alt="" style="${css}"/>`;
    }
    case 'line': {
      const color = el.style?.color || '#cccccc';
      const css = `${pos}background:${color};border-radius:2px;`;
      return `<div data-ced-id="${el.id}" data-ced-type="line" data-ced-color="${escAttr(color)}" style="${css}"></div>`;
    }
    default:
      return '';
  }
}

export function serializeToHtml(canvas, elements) {
  const bgImg = canvas.backgroundImage
    ? `background-image:url('${escAttr(canvas.backgroundImage)}');background-size:cover;background-position:center;`
    : '';
  const elems = elements.map(elementToTag).filter(Boolean).join('\n  ');
  return `<div class="cert-canvas" data-ced-v="2" data-ced-w="${canvas.width}" data-ced-h="${canvas.height}" data-ced-bg="${escAttr(canvas.background)}" data-ced-bgimg="${escAttr(canvas.backgroundImage || '')}" style="position:relative;width:${canvas.width}px;height:${canvas.height}px;background:${canvas.background};${bgImg}overflow:hidden;">
  ${elems}
</div>`;
}

// ─── Parser: HTML → estado visual ─────────────────────────────────────────────
// Soporta tres formatos:
//   1. data-ced-v="2"          → formato actual, parseo perfecto
//   2. CERTIVALIDATE_EDITOR_V1 → formato antiguo (JSON en comentario HTML)
//   3. HTML arbitrario         → retorna null; el editor abre en modo HTML

function parseCedV2(root) {
  const canvas = {
    width:           parseInt(root.getAttribute('data-ced-w'))  || 800,
    height:          parseInt(root.getAttribute('data-ced-h'))  || 566,
    background:      root.getAttribute('data-ced-bg')           || '#ffffff',
    backgroundImage: root.getAttribute('data-ced-bgimg')        || '',
  };

  const elements = [...root.querySelectorAll('[data-ced-id]')].map(el => {
    const style = el.getAttribute('style') || '';
    const x = parseFloat(style.match(/left:\s*([\d.]+)px/)?.[1]   ?? '0');
    const y = parseFloat(style.match(/top:\s*([\d.]+)px/)?.[1]    ?? '0');
    const w = parseFloat(style.match(/width:\s*([\d.]+)px/)?.[1]  ?? '100');
    const h = parseFloat(style.match(/height:\s*([\d.]+)px/)?.[1] ?? '50');
    const id   = el.getAttribute('data-ced-id');
    const type = el.getAttribute('data-ced-type');

    switch (type) {
      case 'text':
        return {
          id, type, x, y, width: w, height: h,
          content: el.getAttribute('data-ced-content') ?? el.textContent.trim(),
          style: {
            fontSize:   parseInt(el.getAttribute('data-ced-fs'))  || 16,
            fontFamily: el.getAttribute('data-ced-ff')            || 'Arial',
            color:      el.getAttribute('data-ced-fc')            || '#000000',
            fontWeight: el.getAttribute('data-ced-fw')            || 'normal',
            fontStyle:  el.getAttribute('data-ced-fi')            || 'normal',
            textAlign:  el.getAttribute('data-ced-ta')            || 'left',
          },
        };
      case 'rect':
        return {
          id, type, x, y, width: w, height: h,
          shapeKind: el.getAttribute('data-ced-sk') || 'rect',
          style: {
            background:   el.getAttribute('data-ced-bg')  || '#e8f4f8',
            borderRadius: parseInt(el.getAttribute('data-ced-br')) || 0,
            borderWidth:  parseInt(el.getAttribute('data-ced-bw')) || 0,
            borderColor:  el.getAttribute('data-ced-bc')  || '#cccccc',
          },
        };
      case 'qr':
        return { id, type, x, y, width: w, height: h };
      case 'image':
        return {
          id, type, x, y, width: w, height: h,
          src:   el.getAttribute('src') || el.getAttribute('data-ced-src') || '',
          style: { objectFit: el.getAttribute('data-ced-fit') || 'contain' },
        };
      case 'line':
        return {
          id, type, x, y, width: w, height: h,
          style: { color: el.getAttribute('data-ced-color') || '#cccccc' },
        };
      default:
        return null;
    }
  }).filter(Boolean);

  return { canvas, elements };
}

export function parseHtmlToEditorState(html) {
  if (!html?.trim()) return null;
  // Normaliza: elimina markdown code fences si el template fue guardado con ellas
  html = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  // 1. Formato OVERLAY_V1: elementos visuales sobre HTML legacy guardados en comentario
  const OV1 = '<!-- CERTIVALIDATE_OVERLAY_V1: ';
  const ov1i = html.indexOf(OV1);
  if (ov1i !== -1) {
    const jsonStart = ov1i + OV1.length;
    const ov1e = html.indexOf(' -->', jsonStart);
    if (ov1e !== -1) {
      try {
        const data = JSON.parse(html.slice(jsonStart, ov1e));
        // El HTML legacy es todo lo que está después del comentario
        const nl = html.indexOf('\n', ov1i);
        data.legacyHtml = nl !== -1 ? html.slice(nl + 1).trim() : '';
        return data;
      } catch { /* continúa */ }
    }
  }

  // 2. Formato actual data-ced-v="2"
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.querySelector('[data-ced-v]');
  if (root) return parseCedV2(root);

  // 3. Formato antiguo CERTIVALIDATE_EDITOR_V1 (JSON en comentario HTML)
  const OLD_START = '<!-- CERTIVALIDATE_EDITOR_V1: ';
  const s = html.indexOf(OLD_START);
  if (s !== -1) {
    const jsonStart = s + OLD_START.length;
    const e = html.indexOf(' -->', jsonStart);
    if (e !== -1) {
      try { return JSON.parse(html.slice(jsonStart, e)); } catch { /* continúa */ }
    }
  }

  // 4. HTML arbitrario/legacy → no se puede mapear a elementos visuales
  return null;
}

// ─── HTML compuesto: HTML legacy como base + elementos visuales encima ──────────
// Guarda los elementos en un comentario marcador (para reabrir y editar de nuevo).
// El certificado base se extrae con DOMParser para preservar sus estilos.
// Los elementos van en position:absolute dentro de un contenedor position:relative
// (evita el bug de scroll que ocurre con position:fixed).
export function buildCompositeHtml(legacyHtml, canvas, elements) {
  const meta = JSON.stringify({ canvas, elements });

  // Extraer estilos y body del HTML legacy con DOMParser
  let headStyles = '';
  let bodyContent = legacyHtml;
  try {
    const tmp = new DOMParser().parseFromString(legacyHtml, 'text/html');
    headStyles  = [...tmp.querySelectorAll('head > style, head > link[rel="stylesheet"]')]
                    .map(n => n.outerHTML).join('\n');
    bodyContent = tmp.body.innerHTML;
  } catch { /* usa el HTML completo como fallback */ }

  // Elementos visuales como overlay absoluto (no se mueven al scrollear)
  const elementsHtml = elements.map(elementToTag).filter(Boolean).join('\n');

  // Script que escala el contenido legacy para que quepa en el canvas
  const fitLegacy = `<script>(function(){var l=document.getElementById('ced-legacy');if(!l)return;var c=l.firstElementChild;if(!c)return;var cw=Math.max(c.scrollWidth,c.offsetWidth,1),vw=${canvas.width};if(cw>vw){var s=vw/cw;c.style.transform='scale('+s+')';c.style.transformOrigin='top left';}})()</script>`;

  return `<!-- CERTIVALIDATE_OVERLAY_V1: ${meta} -->
<!DOCTYPE html><html>
<head><meta charset="UTF-8">
${headStyles}
<style>html,body{margin:0;padding:0;}
#ced-wrap{position:relative;width:${canvas.width}px;height:${canvas.height}px;overflow:hidden;}
#ced-legacy,#ced-overlay{position:absolute;top:0;left:0;width:${canvas.width}px;height:${canvas.height}px;}
#ced-overlay{pointer-events:none;z-index:10;}</style>
</head>
<body>
<div id="ced-wrap">
  <div id="ced-legacy" style="overflow:hidden;">
    ${bodyContent}
  </div>
  <div id="ced-overlay">
    ${elementsHtml}
  </div>
</div>
${fitLegacy}
</body></html>`;
}

// ─── Preview (reemplaza variables y QR con datos de ejemplo) ──────────────────
export function buildPreviewHtml(html) {
  // Elimina markdown code fences que puedan estar en el HTML almacenado
  let out = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  for (const [variable, value] of Object.entries(PREVIEW_VALUES)) {
    out = out.replace(new RegExp(variable.replace(/[[\]{}]/g, '\\$&'), 'gi'), value);
  }
  const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=110x110&color=111827&bgcolor=ffffff&data=A1B2C3D4';
  out = out.replace(/\{\{qr\}\}/gi, `<img src="${qrSrc}" width="110" height="110" style="border-radius:4px;display:block;"/>`);
  return out;
}

// ─── Plantilla por defecto (IDs únicos, nunca "def-*") ────────────────────────
export function makeDefaultTemplateState() {
  return {
    canvas: { ...CANVAS_DEFAULTS },
    elements: [
      { id: generateId(), type: 'rect', x: 25, y: 25, width: 750, height: 516,
        style: { background: '#ffffff', borderRadius: 12, borderColor: '#e5e7eb', borderWidth: 2 } },
      { id: generateId(), type: 'rect', x: 25, y: 25, width: 750, height: 72,
        style: { background: '#0891b2', borderRadius: 0, borderColor: 'transparent', borderWidth: 0 } },
      { id: generateId(), type: 'text', x: 50, y: 37, width: 700, height: 48,
        content: 'CERTIFICADO DE LOGRO',
        style: { fontSize: 26, fontFamily: 'Arial', color: '#ffffff', fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center' } },
      { id: generateId(), type: 'text', x: 50, y: 145, width: 700, height: 54,
        content: '{{nombre}}',
        style: { fontSize: 36, fontFamily: 'Georgia', color: '#111827', fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center' } },
      { id: generateId(), type: 'text', x: 50, y: 220, width: 700, height: 34,
        content: 'Ha completado satisfactoriamente el programa de',
        style: { fontSize: 15, fontFamily: 'Arial', color: '#4b5563', fontWeight: 'normal', fontStyle: 'normal', textAlign: 'center' } },
      { id: generateId(), type: 'text', x: 50, y: 260, width: 700, height: 42,
        content: '{{curso}}',
        style: { fontSize: 22, fontFamily: 'Arial', color: '#0891b2', fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center' } },
      { id: generateId(), type: 'text', x: 50, y: 320, width: 700, height: 28,
        content: '{{institucion}}  ·  {{fecha_emision}}',
        style: { fontSize: 13, fontFamily: 'Arial', color: '#6b7280', fontWeight: 'normal', fontStyle: 'italic', textAlign: 'center' } },
      { id: generateId(), type: 'line', x: 150, y: 365, width: 500, height: 2,
        style: { color: '#e5e7eb' } },
      { id: generateId(), type: 'qr', x: 345, y: 388, width: 110, height: 110 },
      { id: generateId(), type: 'text', x: 50, y: 508, width: 700, height: 22,
        content: 'Código de verificación: {{codigo_unico}}',
        style: { fontSize: 11, fontFamily: 'Arial', color: '#9ca3af', fontWeight: 'normal', fontStyle: 'normal', textAlign: 'center' } },
    ],
  };
}
