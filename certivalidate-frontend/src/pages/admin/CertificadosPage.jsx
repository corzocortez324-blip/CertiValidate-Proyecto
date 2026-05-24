import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { certificadosApi } from '../../api/certificados.api';
import { institucionesApi } from '../../api/instituciones.api';
import { estudiantesApi } from '../../api/estudiantes.api';
import { plantillasApi } from '../../api/plantillas.api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Card } from '../../components/ui/Card';
import { formatDate, formatDateTime, getStatusClass, getStatusLabel } from '../../utils/helpers';
import { EmitirCertificadoForm } from '../../forms/EmitirCertificadoForm';
import { RevocarCertificadoForm } from '../../forms/RevocarCertificadoForm';
import { Plus, Download, Ban, Eye, QrCode, Copy, Check, ChevronDown, ChevronUp, ExternalLink, Link2, Lock, History, FileBadge, ShieldCheck, Printer } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import './CertificadosPage.css';

const LIMIT = 10;

function CopyBtn({ text, title = 'Copiar' }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handle} title={title} type="button">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

export const CertificadosPage = () => {
  const { hasPermission } = useAuth();

  const [certs, setCerts]           = useState([]);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(true);
  const [listError, setListError]   = useState('');

  const [search, setSearch]         = useState('');
  const [debSearch, setDebSearch]   = useState('');
  const [filter, setFilter]         = useState('');
  const [filterInst, setFilterInst] = useState('');

  const [instituciones, setInstituciones] = useState([]);
  const [estudiantes, setEstudiantes]     = useState([]);
  const [plantillas, setPlantillas]       = useState([]);

  const [showEmit, setShowEmit]         = useState(false);
  const [emitForm, setEmitForm]         = useState({ estudiante_id: '', plantilla_id: '', institucion_id: '' });
  const [emitLoading, setEmitLoading]   = useState(false);
  const [emitError, setEmitError]       = useState('');

  const [showRevoke, setShowRevoke]     = useState(false);
  const [revokeId, setRevokeId]         = useState('');
  const [revokeForm, setRevokeForm]     = useState({ motivo_codigo: 'ERROR_DATOS', motivo_detalle: '' });
  const [revokeError, setRevokeError]   = useState('');

  const [showDetail, setShowDetail]     = useState(false);
  const [detailCert, setDetailCert]     = useState(null);
  const [showTechInfo, setShowTechInfo] = useState(false);
  const [revocaciones, setRevocaciones] = useState([]);
  const [loadingRevoc, setLoadingRevoc] = useState(false);
  const [verificaciones, setVerificaciones] = useState([]);
  const [loadingVerif, setLoadingVerif]     = useState(false);
  const [verifFetched, setVerifFetched]     = useState(false);
  const [showTimeline, setShowTimeline]     = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadCerts = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const data = await certificadosApi.listar({ page, limit: LIMIT, search: debSearch, estado: filter, institucion_id: filterInst });
      setCerts(data.certificados);
      setTotalPages(data.totalPages);
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, debSearch, filter, filterInst]);

  useEffect(() => { loadCerts(); }, [loadCerts]);

  useEffect(() => {
    Promise.all([
      institucionesApi.listar({ limit: 100 }),
      estudiantesApi.listar({ limit: 100 }),
      plantillasApi.listar({ limit: 100 }),
    ]).then(([insts, ests, plts]) => {
      setInstituciones(insts.data ?? []);
      setEstudiantes(ests.estudiantes ?? []);
      setPlantillas(plts.data ?? []);
    }).catch(() => {});
  }, []);

  const openEmit = () => {
    const firstInst = instituciones.filter(i => i.activa)[0]?.id || '';
    setEmitForm({ estudiante_id: '', plantilla_id: '', institucion_id: firstInst });
    setEmitError('');
    setShowEmit(true);
  };

  const handleEmit = async (e) => {
    e.preventDefault();
    setEmitLoading(true);
    setEmitError('');
    try {
      await certificadosApi.emitir({
        estudiante_id: emitForm.estudiante_id,
        institucion_id: emitForm.institucion_id,
        plantilla_id: emitForm.plantilla_id,
      });
      setShowEmit(false);
      setPage(1);
      loadCerts();
    } catch (err) {
      setEmitError(err.message);
    } finally {
      setEmitLoading(false);
    }
  };

  const handleRevoke = async (e) => {
    e.preventDefault();
    setRevokeError('');
    try {
      await certificadosApi.revocar(revokeId, revokeForm);
      setShowRevoke(false);
      setCerts(prev => prev.map(c => c.id === revokeId ? { ...c, estado: 'revocado' } : c));
    } catch (err) {
      setRevokeError(err.message);
    }
  };

  const handleDescargar = async (c) => {
    try {
      const blob = await certificadosApi.descargar(c.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-${c.codigo_unico}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error al descargar: ${err.message}`);
    }
  };

  const handleToggleTimeline = async () => {
    if (!showTimeline && !verifFetched && !loadingVerif) {
      setLoadingVerif(true);
      try {
        const data = await certificadosApi.getVerificaciones(detailCert.id, { limit: 50 });
        setVerificaciones(Array.isArray(data) ? data : (data.verificaciones ?? data.data ?? []));
      } catch (_) {}
      finally { setLoadingVerif(false); setVerifFetched(true); }
    }
    setShowTimeline(v => !v);
  };

  const openDetail = async (c) => {
    setDetailCert(c);
    setShowTechInfo(false);
    setRevocaciones([]);
    setVerificaciones([]);
    setVerifFetched(false);
    setShowTimeline(false);
    setShowDetail(true);
    if (c.estado === 'revocado') {
      setLoadingRevoc(true);
      try {
        const data = await certificadosApi.getRevocaciones(c.id);
        const raw = data.revocaciones ?? data.data ?? data ?? [];
        setRevocaciones(Array.isArray(raw) ? raw : []);
      } catch (_) {}
      finally { setLoadingRevoc(false); }
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Certificados</h1>
          <p>Gestiona todos los certificados digitales emitidos.</p>
        </div>
      </div>

      <div className="page-toolbar">
        <div className="page-actions cert-filters">
          <input
            className="search-input"
            placeholder="Buscar por código o nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="search-input" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>
            <option value="">Todos los estados</option>
            <option value="valido">Válidos</option>
            <option value="revocado">Revocados</option>
          </select>
          <select className="search-input" value={filterInst} onChange={e => { setFilterInst(e.target.value); setPage(1); }}>
            <option value="">Todas las instituciones</option>
            {instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </div>
        {hasPermission('certificado:emitir') && (
          <Button variant="primary" icon={<Plus size={18} />} onClick={openEmit}>Emitir Certificado</Button>
        )}
      </div>

      {listError && <div className="alert alert-error">{listError}</div>}

      <Card>
        <div className="table-overflow-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Estudiante</th>
                <th>Institución</th>
                <th>Plantilla</th>
                <th>Emisión</th>
                <th>Expiración</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="empty-state">Cargando...</td></tr>
              ) : certs.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No se encontraron certificados.</td></tr>
              ) : certs.map(c => (
                <tr key={c.id} className={c.estado === 'revocado' ? 'row-revoked' : ''}>
                  <td className="cert-code-col">{c.codigo_unico}</td>
                  <td>{c.estudiante?.nombre} {c.estudiante?.apellido}</td>
                  <td className="text-muted-sm">{c.institucion?.nombre}</td>
                  <td className="cert-plantilla-col">{c.plantilla?.nombre}</td>
                  <td className="text-nowrap">{formatDate(c.fecha_emision)}</td>
                  <td className="text-nowrap text-muted">{c.fecha_expiracion ? formatDate(c.fecha_expiracion) : '—'}</td>
                  <td><Badge variant={getStatusClass(c.estado).replace('badge-', '')}>{getStatusLabel(c.estado)}</Badge></td>
                  <td>
                    <div className="table-actions">
                      {hasPermission('certificado:ver') && (
                        <button className="icon-btn" title="Ver detalle" onClick={() => openDetail(c)}><Eye size={16} /></button>
                      )}
                      {hasPermission('certificado:descargar') && (
                        <button className="icon-btn" title="Descargar PDF" onClick={() => handleDescargar(c)}><Download size={16} /></button>
                      )}
                      {hasPermission('certificado:revocar') && c.estado !== 'revocado' && (
                        <button className="icon-btn danger" title="Revocar" onClick={() => { setRevokeId(c.id); setRevokeForm({ motivo_codigo: 'ERROR_DATOS', motivo_detalle: '' }); setRevokeError(''); setShowRevoke(true); }}>
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </Card>

      {/* Emit Modal */}
      <Modal isOpen={showEmit} onClose={() => setShowEmit(false)} title="Emitir Nuevo Certificado" size="md">
        {emitError && <div className="alert alert-error">{emitError}</div>}
        <EmitirCertificadoForm
          form={emitForm}
          setForm={setEmitForm}
          onSubmit={handleEmit}
          onCancel={() => setShowEmit(false)}
          loading={emitLoading}
          instituciones={instituciones}
          estudiantes={estudiantes}
          plantillas={plantillas}
        />
      </Modal>

      {/* Revoke Modal */}
      <Modal isOpen={showRevoke} onClose={() => setShowRevoke(false)} title="Revocar Certificado" size="sm">
        {revokeError && <div className="alert alert-error">{revokeError}</div>}
        <RevocarCertificadoForm
          form={revokeForm}
          setForm={setRevokeForm}
          onSubmit={handleRevoke}
          onCancel={() => setShowRevoke(false)}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="Detalle de Certificado" size="lg">
        {detailCert && (() => {
          const qrUrl = `${window.location.origin}/?codigo=${detailCert.codigo_unico}`;
          const downloadQr = () => {
            const canvas = document.getElementById('cert-qr-canvas');
            if (!canvas) return;
            const link = document.createElement('a');
            link.download = `qr-${detailCert.codigo_unico}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
          };
          return (
            <div className="detail-col">

              {/* Banner + detalle de revocación */}
              {detailCert.estado === 'revocado' && (
                <>
                  <div className="revoked-banner">
                    <Ban size={16} />
                    <span><strong>Certificado Revocado</strong> — Este certificado fue revocado y ya no es válido.</span>
                  </div>
                  {loadingRevoc ? (
                    <p className="revoc-loading">Cargando detalle de revocación…</p>
                  ) : revocaciones.length > 0 && (
                    <div className="revoc-detail-section">
                      {revocaciones.map((r, i) => {
                        const u = r.usuario;
                        const initials = u
                          ? `${u.nombre?.charAt(0) || ''}${u.apellido?.charAt(0) || ''}`.toUpperCase() || '?'
                          : null;
                        return (
                          <div key={r.id ?? i} className="revoc-detail-card">
                            <div className="revoc-card-header">
                              <div className="revoc-header-fields">
                                <div className="revoc-detail-row">
                                  <span className="revoc-label">Motivo</span>
                                  <span className="revoc-value revoc-motivo">{r.motivo_codigo?.replace(/_/g, ' ')}</span>
                                </div>
                                {r.motivo_detalle && (
                                  <div className="revoc-detail-row">
                                    <span className="revoc-label">Detalle</span>
                                    <span className="revoc-value">{r.motivo_detalle}</span>
                                  </div>
                                )}
                              </div>
                              <button className="revoc-print-btn" title="Exportar / Imprimir" onClick={() => window.print()} type="button">
                                <Printer size={13} /> Imprimir
                              </button>
                            </div>

                            <div className="revoc-detail-row revoc-user-row">
                              <span className="revoc-label">Revocado por</span>
                              {u ? (
                                <div className="revoc-user-info">
                                  <div className="revoc-user-avatar">{initials}</div>
                                  <div>
                                    <span className="revoc-value">{u.nombre} {u.apellido || ''}</span>
                                    <span className="revoc-user-email">{u.email}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="revoc-value">—</span>
                              )}
                            </div>

                            <div className="revoc-detail-row">
                              <span className="revoc-label">Fecha revocación</span>
                              <span className="revoc-value">{formatDate(r.fecha_revocacion)}</span>
                            </div>

                            {r.tx_hash_revocacion && (
                              <div className="revoc-detail-row">
                                <span className="revoc-label">TX Revocación</span>
                                <div className="cert-code-row">
                                  <span className="hash-display">{r.tx_hash_revocacion.slice(0, 16)}…{r.tx_hash_revocacion.slice(-8)}</span>
                                  <CopyBtn text={r.tx_hash_revocacion} title="Copiar TX hash" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              <div className="detail-grid">
                <div>
                  <strong>Código único:</strong>
                  <div className="cert-code-row">
                    <span className="cert-detail-code">{detailCert.codigo_unico}</span>
                    <CopyBtn text={detailCert.codigo_unico} title="Copiar código único" />
                  </div>
                </div>
                <div>
                  <strong>Estado:</strong><br />
                  <Badge variant={getStatusClass(detailCert.estado).replace('badge-', '')}>{getStatusLabel(detailCert.estado)}</Badge>
                </div>
                <div><strong>Estudiante:</strong><br />{detailCert.estudiante?.nombre} {detailCert.estudiante?.apellido}</div>
                <div><strong>Documento:</strong><br />{detailCert.estudiante?.documento}</div>
                <div><strong>Institución:</strong><br />{detailCert.institucion?.nombre}</div>
                <div><strong>Plantilla:</strong><br />{detailCert.plantilla?.nombre}</div>
                <div><strong>Fecha de emisión:</strong><br />{formatDate(detailCert.fecha_emision)}</div>
                <div><strong>Fecha de expiración:</strong><br />{detailCert.fecha_expiracion ? formatDate(detailCert.fecha_expiracion) : '—'}</div>
              </div>

              {/* Enlace al portal de verificación */}
              <a
                href={`/?codigo=${detailCert.codigo_unico}`}
                target="_blank"
                rel="noopener noreferrer"
                className="verify-link-btn"
              >
                <ExternalLink size={14} />
                Ver en portal de verificación pública
              </a>

              <div className="cert-qr-section">
                <strong className="cert-hash-label"><QrCode size={14} style={{ display: 'inline', marginRight: 6 }} />Código QR de verificación</strong>
                <div className="cert-qr-wrap">
                  <QRCodeCanvas
                    id="cert-qr-canvas"
                    value={qrUrl}
                    size={140}
                    bgColor="#ffffff"
                    fgColor="#111827"
                    level="M"
                  />
                </div>
                <p className="cert-qr-hint">Escanea para verificar autenticidad</p>
                <button className="btn-secondary cert-qr-download" onClick={downloadQr}>
                  <Download size={14} /> Descargar QR
                </button>
              </div>

              {/* Sección blockchain */}
              <div className="cert-blockchain-section">
                {detailCert.tx_hash ? (
                  <>
                    <div className="cert-blockchain-verified">
                      <Link2 size={13} /> Verificado en Blockchain
                    </div>
                    <div className="cert-blockchain-details">
                      <div className="tech-info-row">
                        <span className="tech-info-label">TX Hash</span>
                        <div className="cert-code-row">
                          <span className="hash-display">{detailCert.tx_hash.slice(0, 24)}…{detailCert.tx_hash.slice(-12)}</span>
                          <CopyBtn text={detailCert.tx_hash} title="Copiar TX Hash" />
                        </div>
                      </div>
                      {detailCert.fecha_blockchain && (
                        <div className="tech-info-row">
                          <span className="tech-info-label">Registrado on-chain</span>
                          <span className="text-mono">{formatDate(detailCert.fecha_blockchain)}</span>
                        </div>
                      )}
                      {detailCert.red_blockchain && (
                        <div className="tech-info-row">
                          <span className="tech-info-label">Red</span>
                          <span className="text-mono">{detailCert.red_blockchain}</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="cert-blockchain-pending">
                    <Lock size={13} /> Registro en blockchain pendiente
                  </div>
                )}
              </div>

              {/* Timeline de eventos */}
              <button className="tech-toggle-btn" onClick={handleToggleTimeline} type="button">
                {showTimeline ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                <History size={15} />
                Historial de eventos
              </button>

              {showTimeline && (
                <div className="cert-timeline-section animate-fade-in">
                  {loadingVerif ? (
                    <p className="revoc-loading">Cargando historial…</p>
                  ) : (() => {
                    try {
                    const items = [
                      {
                        type: 'emision',
                        date: new Date(detailCert.fecha_emision),
                        label: 'Certificado emitido',
                        sub: detailCert.institucion?.nombre || '',
                      },
                      ...verificaciones.map(v => ({
                        type: 'verificacion',
                        date: new Date(v.fecha_verificacion || v.fecha || v.created_at),
                        label: 'Verificación pública',
                        sub: v.ip ? `IP: ${v.ip}` : '',
                      })),
                      ...revocaciones.map(r => ({
                        type: 'revocacion',
                        date: new Date(r.fecha_revocacion),
                        label: 'Certificado revocado',
                        sub: r.motivo_codigo?.replace(/_/g, ' ') || '',
                      })),
                    ]
                      .filter(item => !isNaN(item.date.getTime()))
                      .sort((a, b) => b.date - a.date);

                    if (items.length === 0) return <p className="revoc-loading">Sin eventos registrados.</p>;

                    return items.map((item, idx) => (
                      <div key={idx} className="timeline-item">
                        <div className="timeline-line-wrap">
                          <div className={`timeline-dot timeline-dot--${item.type}`}>
                            {item.type === 'emision' && <FileBadge size={12} />}
                            {item.type === 'verificacion' && <ShieldCheck size={12} />}
                            {item.type === 'revocacion' && <Ban size={12} />}
                          </div>
                          {idx < items.length - 1 && <div className="timeline-connector" />}
                        </div>
                        <div className="timeline-content">
                          <p className="timeline-date">{formatDateTime(item.date)}</p>
                          <p className="timeline-label">{item.label}</p>
                          {item.sub && <p className="timeline-sub">{item.sub}</p>}
                        </div>
                      </div>
                    ));
                    } catch (_) {
                      return <p className="revoc-loading">Error al cargar el historial.</p>;
                    }
                  })()}
                </div>
              )}

              {/* Sección técnica colapsable */}
              <button
                className="tech-toggle-btn"
                onClick={() => setShowTechInfo(v => !v)}
                type="button"
              >
                {showTechInfo ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                Información técnica
              </button>

              {showTechInfo && (
                <div className="tech-info-section animate-fade-in">
                  <div className="tech-info-row">
                    <span className="tech-info-label">HASH SHA-256</span>
                    <div className="cert-code-row">
                      <span className="hash-display">{detailCert.hash_sha256 || '—'}</span>
                      {detailCert.hash_sha256 && <CopyBtn text={detailCert.hash_sha256} title="Copiar hash SHA-256" />}
                    </div>
                  </div>
                  <div className="tech-info-row">
                    <span className="tech-info-label">Fecha de emisión (ISO)</span>
                    <span className="text-mono">{detailCert.fecha_emision || '—'}</span>
                  </div>
                  <div className="tech-info-row">
                    <span className="tech-info-label">ID interno</span>
                    <span className="text-mono">{detailCert.id}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
