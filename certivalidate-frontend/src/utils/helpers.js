/**
 * Format ISO date to a human-readable string.
 */
export const formatDate = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get CSS class for a certificate status badge.
 */
export const getStatusClass = (estado) => {
  switch (estado) {
    case 'valido': return 'badge-success';
    case 'revocado': return 'badge-error';
    case 'expirado': return 'badge-warning';
    default: return 'badge-muted';
  }
};

export const getStatusLabel = (estado) => {
  switch (estado) {
    case 'valido': return 'Válido';
    case 'revocado': return 'Revocado';
    case 'expirado': return 'Expirado';
    case 'no_encontrado': return 'No Encontrado';
    default: return estado;
  }
};

/**
 * Quita las cercas de código Markdown (```html ... ```) que a veces trae el HTML
 * almacenado. Sin regex con cuantificadores anidados (evita backtracking costoso).
 */
export const stripCodeFences = (html = '') => {
  let out = String(html).trim();
  if (out.startsWith('```')) {
    out = out.slice(3);
    if (out.slice(0, 4).toLowerCase() === 'html') out = out.slice(4);
  }
  if (out.endsWith('```')) out = out.slice(0, -3);
  return out.trim();
};

/** Ref callback estable: enfoca el elemento solo cuando se monta (sustituye a autoFocus). */
export const focusOnMount = (node) => { node?.focus(); };
