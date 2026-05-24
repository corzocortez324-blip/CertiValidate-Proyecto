import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { auditoriaApi } from '../../api/auditoria.api';
import { Pagination } from '../../components/ui/Pagination';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { formatDateTime } from '../../utils/helpers';
import { getActionColor, formatAccion } from '../../constants/audit';
import { Eye, RotateCcw, Download, FileJson, FileSpreadsheet, X } from 'lucide-react';
import { exportToXLSX } from '../../utils/exportExcel';
import './AuditoriaPage.css';

const LIMIT = 50;

const ACCIONES = [
  'EMITIR_CERTIFICADO', 'REVOCAR_CERTIFICADO', 'VERIFICAR_CERTIFICADO',
  'CREAR_USUARIO', 'ACTUALIZAR_USUARIO', 'ELIMINAR_USUARIO',
  'ACTUALIZAR_PERFIL', 'CAMBIAR_PASSWORD',
  'CREAR_ESTUDIANTE', 'ACTUALIZAR_ESTUDIANTE', 'ELIMINAR_ESTUDIANTE',
  'CREAR_PLANTILLA', 'ACTUALIZAR_PLANTILLA', 'ARCHIVAR_PLANTILLA',
  'CREAR_INSTITUCION', 'ACTUALIZAR_INSTITUCION', 'DESACTIVAR_INSTITUCION',
  'LOGIN', 'LOGOUT',
];

const AUDIT_HEADERS = ['Fecha', 'Usuario', 'Email', 'Institución', 'Acción', 'Entidad', 'ID Entidad', 'IP'];

function buildAuditRows(rows) {
  return rows.map(a => ({
    'Fecha':        formatDateTime(a.fecha),
    'Usuario':      `${a.usuario?.nombre || ''} ${a.usuario?.apellido || ''}`.trim() || '—',
    'Email':        a.usuario?.email || '—',
    'Institución':  a.institucion?.nombre || '—',
    'Acción':       formatAccion(a.accion),
    'Entidad':      a.entidad || '—',
    'ID Entidad':   a.entidad_id || '—',
    'IP':           a.ip || '—',
  }));
}

function exportXLSX(rows) {
  exportToXLSX(buildAuditRows(rows), AUDIT_HEADERS, 'auditoria');
}

function exportJSON(rows) {
  const data = rows.map(a => ({
    fecha:        formatDateTime(a.fecha),
    usuario:      `${a.usuario?.nombre || ''} ${a.usuario?.apellido || ''}`.trim() || null,
    email:        a.usuario?.email || null,
    institucion:  a.institucion?.nombre || null,
    accion:       formatAccion(a.accion),
    accion_codigo: a.accion || null,
    entidad:      a.entidad || null,
    entidad_id:   a.entidad_id || null,
    ip:           a.ip || null,
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 10);
  a.download = `auditoria-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const AuditoriaPage = () => {
  const [auditorias, setAuditorias]   = useState([]);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [loading, setLoading]         = useState(true);
  const [listError, setListError]     = useState('');

  const [filterEntidad, setFilterEntidad] = useState('');
  const [filterAccion, setFilterAccion]   = useState('');
  const [filterUsuario, setFilterUsuario] = useState('');
  const [fechaDesde, setFechaDesde]       = useState('');
  const [fechaHasta, setFechaHasta]       = useState('');
  const [detailEntry, setDetailEntry]       = useState(null);
  const [exporting, setExporting]           = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat]     = useState('csv');

  const usuarios = useMemo(() => {
    const seen = new Set();
    return auditorias
      .map(a => a.usuario)
      .filter(u => u && !seen.has(u.id) && seen.add(u.id));
  }, [auditorias]);

  const buildParams = useCallback(() => ({
    page, limit: LIMIT,
    entidad: filterEntidad,
    accion: filterAccion || undefined,
    usuario_id: filterUsuario,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta ? fechaHasta + 'T23:59:59' : '',
  }), [page, filterEntidad, filterAccion, filterUsuario, fechaDesde, fechaHasta]);

  const load = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const data = await auditoriaApi.listar(buildParams());
      setAuditorias(data.auditorias);
      setTotalPages(data.totalPages);
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => {
    setFilterEntidad(''); setFilterAccion(''); setFilterUsuario('');
    setFechaDesde(''); setFechaHasta(''); setPage(1);
  };

  const handleExport = async (fmt = exportFormat) => {
    setExporting(true);
    try {
      const allPages = [];
      let p = 1;
      while (true) {
        const data = await auditoriaApi.listar({ ...buildParams(), page: p, limit: 200 });
        allPages.push(...(data.auditorias || []));
        if (p >= (data.totalPages ?? 1)) break;
        p++;
      }
      if (fmt === 'json') exportJSON(allPages);
      else exportXLSX(allPages);
      setShowExportModal(false);
    } catch (err) {
      alert('Error al exportar: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = filterEntidad || filterAccion || filterUsuario || fechaDesde || fechaHasta;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Auditoría</h1>
          <p>Registro completo de todas las acciones realizadas en la plataforma.</p>
        </div>
        <button
          className="btn-export-csv"
          onClick={() => setShowExportModal(true)}
          title="Exportar registros"
        >
          <Download size={15} />
          Exportar
        </button>
      </div>

      <Card className={`audit-filters-card ${hasFilters ? 'has-filters' : ''}`}>
        <div className="filter-grid">
          <div className="form-group">
            <label className="form-label">Entidad</label>
            <select className="search-input" value={filterEntidad} onChange={e => { setFilterEntidad(e.target.value); setPage(1); }}>
              <option value="">Todas</option>
              <option value="Certificado">Certificado</option>
              <option value="Usuario">Usuario</option>
              <option value="Estudiante">Estudiante</option>
              <option value="Plantilla">Plantilla</option>
              <option value="Institucion">Institución</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Acción</label>
            <select className="search-input" value={filterAccion} onChange={e => { setFilterAccion(e.target.value); setPage(1); }}>
              <option value="">Todas</option>
              {ACCIONES.map(a => (
                <option key={a} value={a}>{formatAccion(a)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <select className="search-input" value={filterUsuario} onChange={e => { setFilterUsuario(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Desde</label>
            <input type="date" className="search-input" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(1); }} />
          </div>
          <div className="form-group">
            <label className="form-label">Hasta</label>
            <input type="date" className="search-input" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(1); }} />
          </div>
        </div>

        {hasFilters && (
          <button className="btn-clear-filters" onClick={clearFilters}>
            <RotateCcw size={13} /> Limpiar filtros
          </button>
        )}
      </Card>

      {listError && <div className="alert alert-error">{listError}</div>}

      <Card>
        <div className="table-overflow-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>IP</th>
                <th>Resultado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="empty-state">Cargando...</td></tr>
              ) : auditorias.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No hay registros con los filtros aplicados.</td></tr>
              ) : auditorias.map(a => (
                <tr key={a.id?.toString()}>
                  <td className="audit-date-col">{formatDateTime(a.fecha)}</td>
                  <td>
                    <div className="audit-user-name">{a.usuario?.nombre} {a.usuario?.apellido}</div>
                    <div className="audit-user-email">{a.usuario?.email}</div>
                  </td>
                  <td><Badge variant={getActionColor(a.accion)}>{formatAccion(a.accion)}</Badge></td>
                  <td>
                    <span className="audit-entity-label">{a.entidad}</span>
                    {a.entidad_id && <div className="audit-entity-id">{a.entidad_id}</div>}
                  </td>
                  <td className="audit-ip-col">{a.ip || '—'}</td>
                  <td className="audit-result-col">
                    {a.resultado
                      ? <span className={`audit-result-badge ${a.resultado === 'exito' || a.resultado === 'exitoso' ? 'success' : 'fail'}`}>
                          {a.resultado}
                        </span>
                      : '—'}
                  </td>
                  <td>
                    <button className="icon-btn" title="Ver detalle" onClick={() => setDetailEntry(a)}><Eye size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </Card>

      {/* Export modal */}
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Exportar registros" size="sm">
        <div className="export-modal-body">
          <p className="export-modal-desc">Selecciona el formato de exportación. Se exportarán todos los registros con los filtros activos.</p>

          <div className="export-format-row">
            <button
              type="button"
              className={`export-format-btn ${exportFormat === 'csv' ? 'export-format-btn--active' : ''}`}
              onClick={() => setExportFormat('csv')}
            >
              <FileSpreadsheet size={16} />
              Excel (.xlsx)
            </button>
            <button
              type="button"
              className={`export-format-btn ${exportFormat === 'json' ? 'export-format-btn--active' : ''}`}
              onClick={() => setExportFormat('json')}
            >
              <FileJson size={16} />
              JSON
            </button>
          </div>

          {hasFilters && (
            <div className="export-filters-summary">
              <span className="export-filters-label">Filtros activos:</span>
              <div className="export-filter-tags">
                {filterEntidad && <span className="export-filter-tag">Entidad: {filterEntidad}</span>}
                {filterAccion && <span className="export-filter-tag">Acción: {formatAccion(filterAccion)}</span>}
                {fechaDesde && <span className="export-filter-tag">Desde: {fechaDesde}</span>}
                {fechaHasta && <span className="export-filter-tag">Hasta: {fechaHasta}</span>}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowExportModal(false)}>
              <X size={15} /> Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleExport(exportFormat)}
              disabled={exporting}
            >
              <Download size={15} />
              {exporting ? 'Exportando…' : exportFormat === 'json' ? 'Descargar .JSON' : 'Descargar .XLSX'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!detailEntry} onClose={() => setDetailEntry(null)} title="Detalle de registro" size="md">
        {detailEntry && (
          <div className="audit-detail-content">
            <div className="detail-grid">
              <div><strong>Fecha:</strong><br /><span className="audit-detail-value">{formatDateTime(detailEntry.fecha)}</span></div>
              <div><strong>Acción:</strong><br /><Badge variant={getActionColor(detailEntry.accion)}>{formatAccion(detailEntry.accion)}</Badge></div>
              <div><strong>Usuario:</strong><br />{detailEntry.usuario?.nombre} {detailEntry.usuario?.apellido}<br /><span className="audit-detail-user-email">{detailEntry.usuario?.email}</span></div>
              <div><strong>IP de origen:</strong><br /><span className="text-mono">{detailEntry.ip || '—'}</span></div>
              <div><strong>Entidad:</strong><br />{detailEntry.entidad}</div>
              <div><strong>ID afectado:</strong><br /><span className="audit-detail-id">{detailEntry.entidad_id || '—'}</span></div>
              {detailEntry.resultado && <div><strong>Resultado:</strong><br />{detailEntry.resultado}</div>}
            </div>
            {(detailEntry.valores_antes || detailEntry.valores_despues) && (
              <div className="audit-diff-grid">
                {detailEntry.valores_antes && (
                  <div>
                    <strong className="audit-diff-label">ANTES</strong>
                    <pre className="audit-diff-pre before">
                      {JSON.stringify(typeof detailEntry.valores_antes === 'string' ? JSON.parse(detailEntry.valores_antes) : detailEntry.valores_antes, null, 2)}
                    </pre>
                  </div>
                )}
                {detailEntry.valores_despues && (
                  <div>
                    <strong className="audit-diff-label">DESPUÉS</strong>
                    <pre className="audit-diff-pre after">
                      {JSON.stringify(typeof detailEntry.valores_despues === 'string' ? JSON.parse(detailEntry.valores_despues) : detailEntry.valores_despues, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
