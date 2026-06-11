import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { downloadCertificatePdf, certificatePdfToBase64 } from '../../utils/downloadCertificatePdf';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/ToastProvider';
import { certificadosApi, getCertificateBlockchainStatus } from '../../api/certificados.api';
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
import { Plus, Download, Ban, Eye, QrCode, Copy, Check, ChevronDown, ChevronUp, ExternalLink, Link2, Lock, History, FileBadge, ShieldCheck, Printer, Mail, Blocks, AlertCircle, Fingerprint, Receipt } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import './CertificadosPage.css';

const LIMIT = 10;

// ── Limpia markdown code fences si el template fue guardado con ``` ────────────
function cleanTemplateHtml(raw) {
  return raw.replace(/^```[\w]*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
}

// ── Sustituye variables {{var}} y retorna HTML sanitizado para el certificado ──
function buildCertificateHtml(templateHtml, cert, qrUrl) {
  if (!templateHtml) return '';
  templateHtml = cleanTemplateHtml(templateHtml);

  const fecha = cert.fecha_emision
    ? new Date(cert.fecha_emision).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const fechaExp = cert.fecha_expiracion
    ? new Date(cert.fecha_expiracion).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Sin expiración';
  const snNombre   = cert.snapshot_nombre   != null ? cert.snapshot_nombre   : (cert.estudiante?.nombre   || '');
  const snApellido = cert.snapshot_apellido != null ? cert.snapshot_apellido : (cert.estudiante?.apellido || '');
  const nombre = `${snNombre} ${snApellido}`.trim();
  const qrSrc  = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&color=111827&bgcolor=ffffff&data=${encodeURIComponent(qrUrl)}`;
  const qrImg  = `<img src="${qrSrc}" width="130" height="130" alt="QR verificación" style="border-radius:4px;display:block;"/>`;

  // Detectar si el template ya tiene {{qr}} antes de sustituir
  const tieneQr = /\{\{qr\}\}/i.test(templateHtml);

  const filled = templateHtml
    .replace(/\{\{nombre\}\}/gi,           nombre)
    .replace(/\{\{apellido\}\}/gi,          snApellido)
    .replace(/\{\{institucion\}\}/gi,       cert.snapshot_institucion_nombre ?? cert.institucion?.nombre ?? '')
    .replace(/\{\{curso\}\}/gi,             cert.snapshot_plantilla_nombre   ?? cert.plantilla?.nombre   ?? '')
    .replace(/\{\{programa\}\}/gi,          cert.snapshot_plantilla_nombre   ?? cert.plantilla?.nombre   ?? '')
    .replace(/\{\{fecha_emision\}\}/gi,     fecha)
    .replace(/\{\{fecha_expiracion\}\}/gi,  fechaExp)
    .replace(/\{\{codigo_unico\}\}/gi,      cert.codigo_unico || '')
    .replace(/\{\{codigo\}\}/gi,            cert.codigo_unico || '')
    .replace(/\{\{documento\}\}/gi,         cert.snapshot_documento ?? cert.estudiante?.documento ?? '')
    .replace(/\{\{hash\}\}/gi,              cert.hash_sha256?.slice(0, 16) + '…' || '')
    .replace(/\{\{qr\}\}/gi,               qrImg);

  // Si la plantilla no tenía {{qr}}, incrustar el QR en la esquina inferior derecha
  const qrForzado = !tieneQr
    ? `<div style="position:absolute;bottom:18px;right:18px;text-align:center;z-index:99;">
        <img src="${qrSrc}" width="90" height="90" alt="QR" style="display:block;border-radius:4px;border:1px solid #e5e7eb;"/>
        <span style="font-size:8px;color:#6b7280;display:block;margin-top:3px;">Escanear para verificar</span>
       </div>`
    : '';

  return DOMPurify.sanitize(
    `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
        @media print { @page { margin: 0; } }
      </style>
    </head><body style="position:relative;">${filled}${qrForzado}</body></html>`,
    { USE_PROFILES: { html: true } }
  );
}

// Abre ventana para imprimir / guardar como PDF
function printCertificate(templateHtml, cert, qrUrl) {
  const html = buildCertificateHtml(templateHtml, cert, qrUrl);
  if (!html) return;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

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

function parseBlockchainError(err) {
  const msg = err?.message || '';
  if (/401|sesi[oó]n.*expir|token.*expir/i.test(msg)) return 'Sesión expirada. Por favor, inicia sesión de nuevo.';
  if (/403|permiso|no autorizado/i.test(msg)) return 'No tienes permisos para realizar esta acción.';
  if (/404|no encontrado/i.test(msg)) return 'Certificado no encontrado.';
  if (/409|ya registrado|already/i.test(msg)) return 'Este certificado ya está registrado en blockchain.';
  if (/500|error interno/i.test(msg)) return 'Error interno del servidor. Inténtalo de nuevo más tarde.';
  return msg || 'Error al procesar la solicitud blockchain.';
}

function BlockchainTimeline({ cert, verifyResult }) {
  const steps = [
    {
      label: 'Emitido',
      sub: cert.fecha_emision ? formatDate(cert.fecha_emision) : '—',
      done: !!cert.fecha_emision,
      Icon: FileBadge,
    },
    {
      label: 'Hash generado',
      sub: cert.hash_sha256 ? `${cert.hash_sha256.slice(0, 8)}…` : 'Pendiente',
      done: !!cert.hash_sha256,
      Icon: Fingerprint,
    },
    {
      label: 'Registrado en blockchain',
      sub: cert.tx_hash
        ? (cert.fecha_blockchain ? formatDate(cert.fecha_blockchain) : `${cert.tx_hash.slice(0, 8)}…`)
        : 'Pendiente',
      done: !!cert.tx_hash,
      Icon: Blocks,
    },
    {
      label: 'Verificado',
      sub: verifyResult?.valid === true ? 'Integridad válida' : verifyResult?.valid === false ? 'No válido' : 'Sin verificar',
      done: verifyResult?.valid === true,
      Icon: ShieldCheck,
    },
  ];

  return (
    <div className="bc-timeline">
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <div className={`bc-step ${step.done ? 'bc-step--done' : 'bc-step--pending'}`}>
            <div className="bc-step-dot">
              <step.Icon size={11} />
            </div>
            <div className="bc-step-info">
              <span className="bc-step-label">{step.label}</span>
              <span className="bc-step-sub">{step.sub}</span>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={`bc-connector ${step.done ? 'bc-connector--done' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export const CertificadosPage = () => {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();

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
      const cert = await certificadosApi.emitir({
        estudiante_id: emitForm.estudiante_id,
        institucion_id: emitForm.institucion_id,
        plantilla_id: emitForm.plantilla_id,
      });
      setShowEmit(false);
      setPage(1);
      loadCerts();

      // Enviar el email con el PDF del template en segundo plano
      if (cert?.id) {
        certificadosApi.getById(cert.id).then(async (full) => {
          if (!full?.plantilla?.template_html || !full?.estudiante?.email) return;
          const qrUrl  = `${window.location.origin}/?codigo=${full.codigo_unico}`;
          const html   = buildCertificateHtml(full.plantilla.template_html, full, qrUrl);
          const base64 = await certificatePdfToBase64(html);
          await certificadosApi.enviarEmailPdf(full.id, base64);
        }).catch(() => {});
      }
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

  const handleEnviarEmail = async () => {
    if (!detailCert?.plantilla?.template_html) return;
    setSendingEmail(true);
    try {
      const qrUrl = `${window.location.origin}/?codigo=${detailCert.codigo_unico}`;
      const html  = buildCertificateHtml(detailCert.plantilla.template_html, detailCert, qrUrl);
      const base64 = await certificatePdfToBase64(html);
      await certificadosApi.enviarEmailPdf(detailCert.id, base64);
      alert('Certificado enviado por correo correctamente.');
    } catch (err) {
      alert(`Error al enviar: ${err.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDescargar = async (c) => {
    try {
      // Obtiene el certificado completo con template_html
      const full = await certificadosApi.getById(c.id);
      const templateHtml = full?.plantilla?.template_html;

      if (templateHtml) {
        const qrUrl = `${window.location.origin}/?codigo=${full.codigo_unico}`;
        const html  = buildCertificateHtml(templateHtml, full, qrUrl);
        await downloadCertificatePdf(html, `certificado-${full.codigo_unico}`);
        return;
      }

      // Fallback: descarga el PDF del backend si no hay template
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

  const [showCertPreview, setShowCertPreview] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [blockchainLoading, setBlockchainLoading]               = useState(false);
  const [blockchainVerifyLoading, setBlockchainVerifyLoading]   = useState(false);
  const [blockchainVerifyResult, setBlockchainVerifyResult]     = useState(null);
  const [showVerifyModal, setShowVerifyModal]                   = useState(false);
  const [showReceiptModal, setShowReceiptModal]                 = useState(false);
  const [blockchainReceipt, setBlockchainReceipt]               = useState(null);
  const [blockchainReceiptLoading, setBlockchainReceiptLoading] = useState(false);
  const [blockchainStatus, setBlockchainStatus]                 = useState(null);
  const [blockchainStatusLoading, setBlockchainStatusLoading] = useState(false);
  const [blockchainStatusError, setBlockchainStatusError]     = useState('');

  const handleRegistrarBlockchain = async () => {
    setBlockchainLoading(true);
    try {
      await certificadosApi.registrarBlockchain(detailCert.id);
      showToast('Certificado registrado en blockchain correctamente.', 'success');
      const full = await certificadosApi.getById(detailCert.id);
      setDetailCert(prev => prev?.id === full.id ? { ...prev, ...full } : prev);
      setCerts(prev => prev.map(c => c.id === full.id
        ? { ...c, tx_hash: full.tx_hash, red_blockchain: full.red_blockchain, fecha_blockchain: full.fecha_blockchain }
        : c));
      certificadosApi.getBlockchainStatus(detailCert.id)
        .then(status => setBlockchainStatus(status))
        .catch(() => {});
    } catch (err) {
      showToast(parseBlockchainError(err), 'error');
    } finally {
      setBlockchainLoading(false);
    }
  };

  const handleVerificarBlockchain = async () => {
    setBlockchainVerifyLoading(true);
    setShowVerifyModal(true);
    setBlockchainVerifyResult(null);
    try {
      const result = await certificadosApi.verificarBlockchain(detailCert.id);
      setBlockchainVerifyResult(result);
    } catch (err) {
      setBlockchainVerifyResult({ _error: parseBlockchainError(err) });
    } finally {
      setBlockchainVerifyLoading(false);
    }
  };

  const handleGetReceipt = async () => {
    setBlockchainReceiptLoading(true);
    setShowReceiptModal(true);
    setBlockchainReceipt(null);
    try {
      const data = await certificadosApi.getBlockchainReceipt(detailCert.id);
      setBlockchainReceipt(data);
    } catch {
      setBlockchainReceipt({
        certificadoId: detailCert.id,
        codigoVerificacion: detailCert.codigo_unico,
        hash: detailCert.hash_sha256,
        txHash: detailCert.tx_hash,
        network: detailCert.red_blockchain,
        registeredAt: detailCert.fecha_blockchain,
        status: detailCert.tx_hash ? 'registered' : 'pending',
      });
    } finally {
      setBlockchainReceiptLoading(false);
    }
  };

  const openDetail = async (c) => {
    setDetailCert(c);
    setShowTechInfo(false);
    setRevocaciones([]);
    setVerificaciones([]);
    setVerifFetched(false);
    setShowTimeline(false);
    setShowCertPreview(false);
    setLoadingDetail(true);
    setShowDetail(true);
    setBlockchainVerifyResult(null);
    setShowVerifyModal(false);
    setShowReceiptModal(false);
    setBlockchainReceipt(null);
    setBlockchainStatus(null);
    setBlockchainStatusLoading(true);
    setBlockchainStatusError('');

    // Carga el estado blockchain de forma inmediata (sin esperar a getById)
    getCertificateBlockchainStatus(c.id)
      .then(status => setBlockchainStatus(status))
      .catch(err => setBlockchainStatusError(parseBlockchainError(err)))
      .finally(() => setBlockchainStatusLoading(false));

    // Carga el certificado completo (incluye plantilla.template_html)
    certificadosApi.getById(c.id)
      .then(full => {
        setDetailCert(prev => prev?.id === c.id ? { ...prev, ...full } : prev);
        if (full?.plantilla?.template_html) setShowCertPreview(true);
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));

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
                  <td>
                    <div className="cert-estado-col">
                      <Badge variant={getStatusClass(c.estado).replace('badge-', '')}>{getStatusLabel(c.estado)}</Badge>
                      {c.tx_hash
                        ? <span className="bc-table-badge bc-table-badge--registered"><Link2 size={10} /> Registrado</span>
                        : <span className="bc-table-badge bc-table-badge--pending"><Lock size={10} /> Pendiente BC</span>
                      }
                    </div>
                  </td>
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

              {/* Vista previa del certificado con plantilla */}
              {loadingDetail ? (
                <div className="cert-loading-preview">
                  <div className="loading-spinner" />
                  <p>Cargando certificado…</p>
                </div>
              ) : showCertPreview && detailCert.plantilla?.template_html ? (
                <div className="cert-template-preview cert-template-enter">
                  <div className="cert-template-toolbar">
                    <strong className="cert-hash-label">
                      <FileBadge size={14} style={{ display: 'inline', marginRight: 6 }} />
                      Vista previa del certificado
                    </strong>
                    {detailCert.estudiante?.email && (
                      <button
                        className="btn-secondary cert-print-btn"
                        onClick={handleEnviarEmail}
                        disabled={sendingEmail}
                      >
                        <Mail size={14} />
                        {sendingEmail ? 'Enviando…' : 'Enviar por correo'}
                      </button>
                    )}
                  </div>
                  <iframe
                    title="Certificado"
                    srcDoc={buildCertificateHtml(detailCert.plantilla.template_html, detailCert, qrUrl)}
                    className="cert-template-body"
                    style={{ width: '100%', minHeight: 480, border: 'none', background: '#fff', display: 'block' }}
                    sandbox="allow-same-origin"
                    onLoad={e => {
                      const iframe = e.target;
                      const doc = iframe.contentDocument;
                      if (!doc) return;
                      const body = doc.body;
                      const contentW = Math.max(body.scrollWidth, body.offsetWidth, doc.documentElement.scrollWidth);
                      const iframeW  = iframe.offsetWidth;
                      if (contentW > iframeW + 4) {
                        const scale = iframeW / contentW;
                        body.style.transformOrigin = 'top left';
                        body.style.transform = `scale(${scale})`;
                        body.style.width = `${contentW}px`;
                        iframe.style.height = `${Math.max(body.scrollHeight * scale, 480)}px`;
                      } else {
                        iframe.style.height = `${Math.max(body.scrollHeight, 480)}px`;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="cert-qr-section">
                  <strong className="cert-hash-label">
                    <QrCode size={14} style={{ display: 'inline', marginRight: 6 }} />
                    Código QR de verificación
                  </strong>
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
              )}

              {/* ── Seguridad Blockchain ── */}
              <div className="cert-blockchain-card">
                <div className="cert-blockchain-card-header">
                  <Blocks size={16} />
                  <span>Seguridad Blockchain</span>
                </div>

                {blockchainStatusLoading ? (
                  <div className="cert-blockchain-loading">
                    <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    <span>Consultando estado blockchain…</span>
                  </div>
                ) : blockchainStatusError ? (
                  <div className="cert-blockchain-status-error">
                    <AlertCircle size={14} />
                    <span>{blockchainStatusError}</span>
                  </div>
                ) : (
                  <>
                    {/* Badges de estado */}
                    <div className="cert-bc-badges">
                      {(blockchainStatus?.registrado || detailCert.tx_hash) ? (
                        <span className="bc-badge bc-badge--registered"><Link2 size={11} /> Registrado</span>
                      ) : (
                        <span className="bc-badge bc-badge--pending"><Lock size={11} /> Pendiente</span>
                      )}
                      {blockchainVerifyResult && !blockchainVerifyResult._error && (
                        blockchainVerifyResult.valid ? (
                          <span className="bc-badge bc-badge--integrity-ok"><ShieldCheck size={11} /> Integridad válida</span>
                        ) : (
                          <span className="bc-badge bc-badge--integrity-fail"><AlertCircle size={11} /> Integridad comprometida</span>
                        )
                      )}
                      {(blockchainStatus?.mode || detailCert.red_blockchain || '').toLowerCase().includes('mock') && (
                        <span className="bc-badge bc-badge--mock"><Lock size={11} /> Modo simulación</span>
                      )}
                    </div>

                    {/* Grid de datos */}
                    <div className="cert-bc-data">
                      <div className="cert-bc-row">
                        <span className="cert-bc-label">Estado</span>
                        <span className="cert-bc-value">
                          {blockchainStatus?.estado
                            ? blockchainStatus.estado.charAt(0).toUpperCase() + blockchainStatus.estado.slice(1)
                            : (detailCert.tx_hash ? 'Confirmado' : 'Pendiente')}
                        </span>
                      </div>
                      <div className="cert-bc-row">
                        <span className="cert-bc-label">Integridad</span>
                        <span className="cert-bc-value">
                          {blockchainVerifyResult && !blockchainVerifyResult._error
                            ? (blockchainVerifyResult.valid ? 'Válida' : 'Comprometida')
                            : '—'}
                        </span>
                      </div>
                      {(blockchainStatus?.network || detailCert.red_blockchain) && (
                        <div className="cert-bc-row">
                          <span className="cert-bc-label">Red</span>
                          <span className="cert-bc-value text-mono">{blockchainStatus?.network || detailCert.red_blockchain}</span>
                        </div>
                      )}
                      <div className="cert-bc-row">
                        <span className="cert-bc-label">Modo</span>
                        <span className="cert-bc-value">
                          <span className={`cert-blockchain-mode-badge ${(blockchainStatus?.mode || detailCert.red_blockchain || '').toLowerCase().includes('mock') ? 'mode-mock' : 'mode-real'}`}>
                            {(blockchainStatus?.mode || detailCert.red_blockchain || '').toLowerCase().includes('mock') ? 'Simulación' : 'Red principal'}
                          </span>
                        </span>
                      </div>
                      {detailCert.hash_sha256 && (
                        <div className="cert-bc-row">
                          <span className="cert-bc-label">Hash</span>
                          <div className="cert-code-row">
                            <span className="hash-display">{detailCert.hash_sha256.slice(0, 10)}…{detailCert.hash_sha256.slice(-6)}</span>
                            <CopyBtn text={detailCert.hash_sha256} title="Copiar hash" />
                          </div>
                        </div>
                      )}
                      {(blockchainStatus?.tx_hash || detailCert.tx_hash) && (
                        <div className="cert-bc-row">
                          <span className="cert-bc-label">TX Hash</span>
                          <div className="cert-code-row">
                            <span className="hash-display">
                              {(blockchainStatus?.tx_hash || detailCert.tx_hash).slice(0, 14)}…
                              {(blockchainStatus?.tx_hash || detailCert.tx_hash).slice(-7)}
                            </span>
                            <CopyBtn text={blockchainStatus?.tx_hash || detailCert.tx_hash} title="Copiar TX Hash" />
                          </div>
                        </div>
                      )}
                      {(blockchainStatus?.registered_at || detailCert.fecha_blockchain) && (
                        <div className="cert-bc-row">
                          <span className="cert-bc-label">Fecha de registro</span>
                          <span className="cert-bc-value">{formatDate(blockchainStatus?.registered_at || detailCert.fecha_blockchain)}</span>
                        </div>
                      )}
                    </div>

                    {/* Botón explorador (solo si la API devuelve explorerUrl) */}
                    {blockchainStatus?.explorerUrl && (
                      <a
                        href={blockchainStatus.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bc-explorer-link"
                      >
                        <ExternalLink size={14} />
                        Ver en explorador
                      </a>
                    )}
                  </>
                )}

                {/* Acciones blockchain */}
                <div className="cert-blockchain-actions">
                  {!detailCert.tx_hash && hasPermission('certificado:emitir') && (
                    <button
                      className="btn-blockchain btn-blockchain-register"
                      onClick={handleRegistrarBlockchain}
                      disabled={blockchainLoading}
                      type="button"
                    >
                      <Blocks size={14} />
                      {blockchainLoading ? 'Registrando…' : 'Registrar en Blockchain'}
                    </button>
                  )}
                  {detailCert.tx_hash && (
                    <>
                      <button
                        className="btn-blockchain btn-blockchain-verify"
                        onClick={handleVerificarBlockchain}
                        disabled={blockchainVerifyLoading}
                        type="button"
                      >
                        <ShieldCheck size={14} />
                        {blockchainVerifyLoading ? 'Verificando…' : 'Verificar Blockchain'}
                      </button>
                      <button
                        className="btn-blockchain btn-blockchain-receipt"
                        onClick={handleGetReceipt}
                        disabled={blockchainReceiptLoading}
                        type="button"
                      >
                        <Receipt size={14} />
                        {blockchainReceiptLoading ? 'Cargando…' : 'Ver comprobante'}
                      </button>
                    </>
                  )}
                </div>

                {/* Timeline visual: Emitido → Hash → Blockchain → Verificado */}
                <BlockchainTimeline cert={detailCert} verifyResult={blockchainVerifyResult} />
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
      {/* Blockchain Verify Modal */}
      <Modal isOpen={showVerifyModal} onClose={() => setShowVerifyModal(false)} title="Verificación Blockchain" size="sm">
        {blockchainVerifyLoading ? (
          <div className="blockchain-verify-loading" style={{ padding: '1rem 0' }}>
            <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            <span>Verificando integridad en blockchain…</span>
          </div>
        ) : blockchainVerifyResult?._error ? (
          <div className="blockchain-verify-error" style={{ padding: '0.5rem 0' }}>
            <AlertCircle size={16} />
            <span>{blockchainVerifyResult._error}</span>
          </div>
        ) : blockchainVerifyResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div
              className={`blockchain-integrity-badge ${blockchainVerifyResult.valid ? 'valid' : 'invalid'}`}
              style={{ fontSize: '0.9rem', padding: '0.5rem 1rem', alignSelf: 'flex-start' }}
            >
              {blockchainVerifyResult.valid
                ? <><ShieldCheck size={15} style={{ marginRight: 6 }} /> Integridad válida — El certificado es auténtico.</>
                : <><AlertCircle size={15} style={{ marginRight: 6 }} /> Integridad comprometida — El hash no coincide.</>
              }
            </div>
            {!blockchainVerifyResult.valid && (
              <div className="alert alert-error" style={{ fontSize: '0.82rem', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem' }}>
                La integridad del certificado no pudo ser verificada. El documento puede haber sido modificado o existe un error en el registro blockchain.
              </div>
            )}
            {blockchainVerifyResult.message && (
              <p className="blockchain-verify-message">{blockchainVerifyResult.message}</p>
            )}
            <div className="cert-blockchain-details">
              {blockchainVerifyResult.status && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Estado</span>
                  <span className="text-mono">{blockchainVerifyResult.status}</span>
                </div>
              )}
              {blockchainVerifyResult.network && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Red</span>
                  <span className="text-mono">{blockchainVerifyResult.network}</span>
                </div>
              )}
              {blockchainVerifyResult.txHash && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Transaction Hash</span>
                  <div className="cert-code-row">
                    <span className="hash-display">{blockchainVerifyResult.txHash.slice(0, 16)}…{blockchainVerifyResult.txHash.slice(-7)}</span>
                    <CopyBtn text={blockchainVerifyResult.txHash} title="Copiar TX Hash" />
                  </div>
                </div>
              )}
              {blockchainVerifyResult.registeredAt && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Fecha de registro</span>
                  <span className="text-mono">{formatDate(blockchainVerifyResult.registeredAt)}</span>
                </div>
              )}
              {blockchainVerifyResult.hash && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Hash verificado</span>
                  <div className="cert-code-row">
                    <span className="hash-display">{blockchainVerifyResult.hash.slice(0, 20)}…{blockchainVerifyResult.hash.slice(-8)}</span>
                    <CopyBtn text={blockchainVerifyResult.hash} title="Copiar hash" />
                  </div>
                </div>
              )}
            </div>
            {(blockchainVerifyResult.txHash?.toLowerCase().includes('mock') ||
              blockchainVerifyResult.network?.toLowerCase().includes('mock')) && (
              <div className="blockchain-mock-notice">
                Registro simulado para entorno de pruebas.
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Blockchain Receipt Modal */}
      <Modal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="Comprobante Blockchain" size="md">
        {blockchainReceiptLoading ? (
          <div className="blockchain-verify-loading" style={{ padding: '1rem 0' }}>
            <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            <span>Cargando comprobante…</span>
          </div>
        ) : blockchainReceipt?._error ? (
          <div className="blockchain-verify-error" style={{ padding: '0.5rem 0' }}>
            <AlertCircle size={16} />
            <span>{blockchainReceipt._error}</span>
          </div>
        ) : blockchainReceipt ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="cert-blockchain-details" style={{ gap: '0.6rem' }}>
              <div className="tech-info-row">
                <span className="tech-info-label">Certificado ID</span>
                <span className="text-mono">{blockchainReceipt.certificadoId || detailCert?.id}</span>
              </div>
              {(blockchainReceipt.codigoVerificacion || detailCert?.codigo_unico) && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Código de verificación</span>
                  <div className="cert-code-row">
                    <span className="cert-detail-code" style={{ fontSize: '0.88rem' }}>
                      {blockchainReceipt.codigoVerificacion || detailCert?.codigo_unico}
                    </span>
                    <CopyBtn text={blockchainReceipt.codigoVerificacion || detailCert?.codigo_unico} />
                  </div>
                </div>
              )}
              {(blockchainReceipt.hash || detailCert?.hash_sha256) && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Hash SHA-256 (completo)</span>
                  <div className="cert-code-row" style={{ flexWrap: 'wrap' }}>
                    <span className="hash-display" style={{ wordBreak: 'break-all', flex: 1 }}>
                      {blockchainReceipt.hash || detailCert?.hash_sha256}
                    </span>
                    <CopyBtn text={blockchainReceipt.hash || detailCert?.hash_sha256} title="Copiar hash" />
                  </div>
                </div>
              )}
              {(blockchainReceipt.txHash || detailCert?.tx_hash) && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Transaction Hash (completo)</span>
                  <div className="cert-code-row" style={{ flexWrap: 'wrap' }}>
                    <span className="hash-display" style={{ wordBreak: 'break-all', flex: 1 }}>
                      {blockchainReceipt.txHash || detailCert?.tx_hash}
                    </span>
                    <CopyBtn text={blockchainReceipt.txHash || detailCert?.tx_hash} title="Copiar TX Hash" />
                  </div>
                </div>
              )}
              {(blockchainReceipt.network || detailCert?.red_blockchain) && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Red</span>
                  <span className="text-mono">{blockchainReceipt.network || detailCert?.red_blockchain}</span>
                </div>
              )}
              {(blockchainReceipt.registeredAt || detailCert?.fecha_blockchain) && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Fecha de registro</span>
                  <span className="text-mono">{formatDate(blockchainReceipt.registeredAt || detailCert?.fecha_blockchain)}</span>
                </div>
              )}
              {blockchainReceipt.status && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Estado</span>
                  <span className="text-mono">{blockchainReceipt.status}</span>
                </div>
              )}
              {(blockchainReceipt.mode || blockchainStatus?.mode) && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Modo</span>
                  <span className={`cert-blockchain-mode-badge ${(blockchainReceipt.mode || blockchainStatus?.mode)?.toLowerCase().includes('mock') ? 'mode-mock' : 'mode-real'}`}>
                    {(blockchainReceipt.mode || blockchainStatus?.mode)?.toLowerCase().includes('mock') ? 'Simulación' : 'Red principal'}
                  </span>
                </div>
              )}
              {(blockchainReceipt.contractAddress || blockchainStatus?.contractAddress) && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Contract Address</span>
                  <div className="cert-code-row" style={{ flexWrap: 'wrap' }}>
                    <span className="hash-display" style={{ wordBreak: 'break-all', flex: 1 }}>
                      {blockchainReceipt.contractAddress || blockchainStatus?.contractAddress}
                    </span>
                    <CopyBtn text={blockchainReceipt.contractAddress || blockchainStatus?.contractAddress} title="Copiar contract address" />
                  </div>
                </div>
              )}
              {blockchainReceipt.message && (
                <div className="tech-info-row">
                  <span className="tech-info-label">Mensaje</span>
                  <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>{blockchainReceipt.message}</span>
                </div>
              )}
            </div>
            {blockchainReceipt.explorerUrl && (
              <a
                href={blockchainReceipt.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bc-explorer-link"
              >
                <ExternalLink size={13} />
                Ver en explorador blockchain
              </a>
            )}
            {((blockchainReceipt.network || detailCert?.red_blockchain)?.toLowerCase?.().includes('mock') ||
              (blockchainReceipt.txHash || detailCert?.tx_hash)?.toLowerCase?.().includes('mock') ||
              (blockchainReceipt.mode || blockchainStatus?.mode)?.toLowerCase?.().includes('mock')) && (
              <div className="blockchain-mock-notice">
                Registro simulado para entorno de pruebas.
              </div>
            )}
          </div>
        ) : null}
      </Modal>

    </div>
  );
};
