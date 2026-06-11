import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { certificadosApi } from '../api/certificados.api'
import {
  ShieldCheck, Search, CheckCircle2, XCircle, AlertTriangle,
  Link2, Fingerprint, Globe, Lock, KeyRound, Hash, Upload,
  RotateCcw, Share2, FileText, Ban, HelpCircle, ChevronDown, ChevronUp,
  Blocks, AlertCircle, ExternalLink,
} from 'lucide-react'
import { formatDate } from '../utils/helpers'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import './VerifyCertificate.css'

const HOW_IT_WORKS = [
  { icon: Link2,       title: 'Blockchain Inmutable',  desc: 'Cada certificado se registra en una red blockchain, garantizando que no pueda ser alterado.' },
  { icon: Fingerprint, title: 'Hash SHA-256',          desc: 'Se genera una huella digital única para cada documento, detectando cualquier modificación.' },
  { icon: Globe,       title: 'Verificación Pública',  desc: 'Cualquier persona puede verificar un certificado sin necesidad de cuenta o registro.' },
  { icon: Lock,        title: 'Protección de Datos',   desc: 'Cumplimiento con la normativa de protección de datos vigente en Colombia.' },
]

async function extractCodigoFromPDF(file) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ')
  }
  const match = text.match(/[A-F0-9]{16}/)
  return match ? match[0] : null
}

// ── Skeleton mientras carga ───────────────────────────────────────
function ResultSkeleton() {
  return (
    <div className='result-skeleton' aria-hidden='true'>
      <div className='skeleton-header'>
        <div className='skeleton-icon' />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className='skeleton-line sk-title' />
          <div className='skeleton-line sk-sub' />
        </div>
      </div>
      <div className='skeleton-grid'>
        <div className='skeleton-cell' />
        <div className='skeleton-cell' />
        <div className='skeleton-cell' />
        <div className='skeleton-cell' />
      </div>
      <div className='skeleton-line sk-full' />
      <div className='skeleton-line sk-short' />
    </div>
  )
}

// ── Bloque Blockchain compartido ──────────────────────────────────
function BlockchainSection({ result }) {
  const isMock = result.red_blockchain?.toLowerCase().includes('mock')

  return (
    <div className='result-blockchain-section'>
      <div className='bc-public-header'>
        <Blocks size={13} />
        Integridad Blockchain
      </div>

      {result.tx_hash ? (
        <>
          <div className='blockchain-verified-badge'>
            <ShieldCheck size={13} />
            Verificado en Blockchain
          </div>

          <span className={`bc-mode-badge ${isMock ? 'bc-mode-mock' : 'bc-mode-real'}`}>
            {isMock ? 'Registro de demostración' : 'Red principal'}
          </span>

          <div className='blockchain-details'>
            <div className='rd-tech-row'>
              <span className='rd-label'>TX Hash</span>
              {result.explorerUrl ? (
                <a
                  href={result.explorerUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='rd-tx-link'
                  aria-label='Ver transacción en el explorador de blockchain'
                >
                  {result.tx_hash.slice(0, 20)}…{result.tx_hash.slice(-10)}
                  <ExternalLink size={11} style={{ marginLeft: '0.3rem', verticalAlign: 'middle' }} />
                </a>
              ) : (
                <code className='rd-mono-sm'>
                  {result.tx_hash.slice(0, 20)}…{result.tx_hash.slice(-10)}
                </code>
              )}
            </div>
            {result.fecha_blockchain && (
              <div className='rd-tech-row'>
                <span className='rd-label'>Registrado on-chain</span>
                <code className='rd-mono-sm'>{formatDate(result.fecha_blockchain)}</code>
              </div>
            )}
            {result.red_blockchain && (
              <div className='rd-tech-row'>
                <span className='rd-label'>Red</span>
                <code className='rd-mono-sm'>{result.red_blockchain}</code>
              </div>
            )}
          </div>

          {isMock && (
            <p className='bc-mock-notice-public'>
              Este es un <strong>registro de demostración</strong> generado en un entorno de pruebas.
              La autenticidad del certificado está garantizada por su hash SHA-256.
            </p>
          )}
        </>
      ) : result.hash_sha256 ? (
        <div className='blockchain-pending-badge'>
          <Lock size={13} />
          Registro en blockchain pendiente
        </div>
      ) : (
        <div className='bc-unavailable-badge'>
          <HelpCircle size={13} />
          No disponible
        </div>
      )}
    </div>
  )
}

// ── Componentes de resultado por estado ──────────────────────────
function EstadoValido({ result, onReset }) {
  const [showTech, setShowTech] = useState(false)
  const verifyUrl = `${window.location.origin}/?codigo=${result.codigo_unico}`
  const share = () => navigator.clipboard.writeText(verifyUrl).then(() => alert('URL copiada al portapapeles'))

  return (
    <div className='result-card result-valido animate-fade-in' role='status' aria-live='polite'>
      <div className='result-status-banner'>
        <CheckCircle2 size={44} className='result-icon' aria-hidden='true' />
        <div>
          <h3 className='result-title'>Certificado Válido</h3>
          <p className='result-subtitle'>Este certificado es auténtico y se encuentra vigente.</p>
        </div>
      </div>

      <div className='result-body'>
        <div className='result-data-grid'>
          {result.titular && (
            <div className='rd-primary'>
              <span className='rd-label'>Titular</span>
              <span className='rd-value'>{result.titular}</span>
            </div>
          )}
          {result.institucion && (
            <div className='rd-primary rd-inst'>
              <span className='rd-label'>Institución</span>
              <span className='rd-value'>{result.institucion}</span>
            </div>
          )}
          {result.tipo_certificado && (
            <div>
              <span className='rd-label'>Acreditación</span>
              <strong className='rd-value'>{result.tipo_certificado}</strong>
            </div>
          )}
          <div>
            <span className='rd-label'>Fecha de emisión</span>
            <strong className='rd-value'>{formatDate(result.fecha_emision)}</strong>
          </div>
          {result.fecha_expiracion && (
            <div>
              <span className='rd-label'>Expira</span>
              <strong className='rd-value'>{formatDate(result.fecha_expiracion)}</strong>
            </div>
          )}
          <div>
            <span className='rd-label'>Código único</span>
            <strong className='rd-mono'>{result.codigo_unico}</strong>
          </div>
          <div>
            <span className='rd-label'>Integridad del documento</span>
            <strong style={{ color: result.hash_verificado ? 'var(--color-valid-public)' : 'var(--color-revoked-public)', fontWeight: 600 }}>
              {result.hash_verificado ? '✓ Hash verificado' : '✗ Hash no coincide'}
            </strong>
          </div>
        </div>

        <BlockchainSection result={result} />

        <button className='tech-toggle' onClick={() => setShowTech(v => !v)} type='button' aria-expanded={showTech}>
          {showTech ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Detalles técnicos
        </button>
        {showTech && (
          <div className='result-tech-section animate-fade-in'>
            {result.hash_sha256 && (
              <div className='rd-tech-row'>
                <span className='rd-label'>SHA-256</span>
                <code className='rd-mono-sm'>{result.hash_sha256}</code>
              </div>
            )}
            <div className='rd-tech-row'>
              <span className='rd-label'>Fecha (ISO)</span>
              <code className='rd-mono-sm'>{result.fecha_emision}</code>
            </div>
          </div>
        )}

        <div className='result-actions'>
          <button className='btn-result-secondary' onClick={share} type='button'>
            <Share2 size={13} />Compartir enlace
          </button>
          <button className='btn-result-secondary' onClick={onReset} type='button'>
            <RotateCcw size={13} />Verificar otro
          </button>
        </div>
      </div>
    </div>
  )
}

function EstadoRevocado({ result, onReset }) {
  const [showTech, setShowTech] = useState(false)
  const hasTech = result.hash_sha256 || result.tx_hash_revocacion || result.fecha_revocacion
  return (
    <div className='result-card result-revocado animate-fade-in' role='alert' aria-live='assertive'>
      <div className='result-status-banner'>
        <Ban size={44} className='result-icon' aria-hidden='true' />
        <div>
          <h3 className='result-title'>Certificado Revocado</h3>
          <p className='result-subtitle'>Este certificado fue revocado y ya no tiene validez oficial.</p>
        </div>
      </div>

      <div className='result-body'>
        {result.codigo_unico && (
          <div className='result-data-grid'>
            {result.titular && (
              <div className='rd-primary'>
                <span className='rd-label'>Titular</span>
                <span className='rd-value'>{result.titular}</span>
              </div>
            )}
            {result.institucion && (
              <div className='rd-primary rd-inst'>
                <span className='rd-label'>Institución</span>
                <span className='rd-value'>{result.institucion}</span>
              </div>
            )}
            <div>
              <span className='rd-label'>Código único</span>
              <strong className='rd-mono'>{result.codigo_unico}</strong>
            </div>
            <div>
              <span className='rd-label'>Fecha de emisión</span>
              <strong className='rd-value'>{formatDate(result.fecha_emision)}</strong>
            </div>
            {result.fecha_revocacion && (
              <div>
                <span className='rd-label'>Fecha de revocación</span>
                <strong style={{ color: 'var(--color-revoked-public)' }}>{formatDate(result.fecha_revocacion)}</strong>
              </div>
            )}
          </div>
        )}

        <p className='result-info-note'>
          Si tienes dudas sobre esta revocación, contacta directamente a la institución emisora.
        </p>

        {hasTech && (
          <>
            <button className='tech-toggle' onClick={() => setShowTech(v => !v)} type='button' aria-expanded={showTech}>
              {showTech ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Detalles técnicos
            </button>
            {showTech && (
              <div className='result-tech-section animate-fade-in'>
                {result.hash_sha256 && <div className='rd-tech-row'><span className='rd-label'>SHA-256 original</span><code className='rd-mono-sm'>{result.hash_sha256}</code></div>}
                {result.tx_hash_revocacion && <div className='rd-tech-row'><span className='rd-label'>TX Revocación</span><code className='rd-mono-sm'>{result.tx_hash_revocacion.slice(0, 20)}…{result.tx_hash_revocacion.slice(-10)}</code></div>}
                {result.fecha_revocacion && <div className='rd-tech-row'><span className='rd-label'>Revocado (ISO)</span><code className='rd-mono-sm'>{result.fecha_revocacion}</code></div>}
              </div>
            )}
          </>
        )}

        <div className='result-actions'>
          <button className='btn-result-secondary' onClick={onReset} type='button'>
            <RotateCcw size={13} />Verificar otro
          </button>
        </div>
      </div>
    </div>
  )
}

function EstadoAlterado({ result, onReset }) {
  const [showTech, setShowTech] = useState(false)
  const hasTech = result?.hash_sha256 || result?.hash_calculado
  return (
    <div className='result-card result-alterado animate-fade-in' role='alert' aria-live='assertive'>
      <div className='result-status-banner'>
        <AlertTriangle size={44} className='result-icon' aria-hidden='true' />
        <div>
          <h3 className='result-title'>Documento Alterado</h3>
          <p className='result-subtitle'>El archivo PDF ha sido modificado. El contenido no coincide con el original.</p>
        </div>
      </div>

      <div className='result-body'>
        <p className='result-info-note'>
          El hash del archivo no coincide con el hash registrado en el sistema. El documento puede haber sido editado o corrompido.
          No confíes en él como documento oficial.
        </p>

        <div className='result-blockchain-section'>
          <div className='bc-public-header'>
            <Blocks size={13} />
            Integridad Blockchain
          </div>
          <div className='bc-compromised-badge'>
            <AlertCircle size={13} />
            Integridad comprometida — El documento ha sido alterado.
          </div>
        </div>

        {hasTech && (
          <>
            <button className='tech-toggle' onClick={() => setShowTech(v => !v)} type='button' aria-expanded={showTech}>
              {showTech ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Detalles técnicos
            </button>
            {showTech && (
              <div className='result-tech-section animate-fade-in'>
                {result.hash_sha256 && <div className='rd-tech-row'><span className='rd-label'>Hash registrado</span><code className='rd-mono-sm'>{result.hash_sha256}</code></div>}
                {result.hash_calculado && <div className='rd-tech-row'><span className='rd-label'>Hash del archivo</span><code className='rd-mono-sm' style={{ color: 'var(--color-revoked-public)' }}>{result.hash_calculado}</code></div>}
              </div>
            )}
          </>
        )}

        <div className='result-actions'>
          <button className='btn-result-secondary' onClick={onReset} type='button'>
            <RotateCcw size={13} />Verificar otro
          </button>
        </div>
      </div>
    </div>
  )
}

function EstadoInexistente({ result, onReset }) {
  const [showTech, setShowTech] = useState(false)
  const consultado = result?.uuid_consultado || result?.codigo_consultado || result?.hash_consultado
  return (
    <div className='result-card result-inexistente animate-fade-in' role='status' aria-live='polite'>
      <div className='result-status-banner'>
        <HelpCircle size={44} className='result-icon' aria-hidden='true' />
        <div>
          <h3 className='result-title'>No Encontrado</h3>
          <p className='result-subtitle'>No existe ningún certificado registrado con ese código o archivo.</p>
        </div>
      </div>

      <div className='result-body'>
        <p className='result-info-note'>
          Verifica que el código sea correcto (16 caracteres) o que el PDF sea el documento original sin modificaciones.
          Si el problema persiste, contacta a la institución emisora.
        </p>

        {consultado && (
          <>
            <button className='tech-toggle' onClick={() => setShowTech(v => !v)} type='button' aria-expanded={showTech}>
              {showTech ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Detalles técnicos
            </button>
            {showTech && (
              <div className='result-tech-section animate-fade-in'>
                <div className='rd-tech-row'>
                  <span className='rd-label'>Código consultado</span>
                  <code className='rd-mono-sm'>{consultado}</code>
                </div>
              </div>
            )}
          </>
        )}

        <div className='result-actions'>
          <button className='btn-result-secondary' onClick={onReset} type='button'>
            <RotateCcw size={13} />Intentar de nuevo
          </button>
        </div>
      </div>
    </div>
  )
}

function ResultCard({ result, onReset }) {
  const estado = result.estado || 'no_encontrado'
  if (estado === 'valido')   return <EstadoValido result={result} onReset={onReset} />
  if (estado === 'revocado') return <EstadoRevocado result={result} onReset={onReset} />
  if (estado === 'alterado') return <EstadoAlterado result={result} onReset={onReset} />
  return <EstadoInexistente result={result} onReset={onReset} />
}

// ── Página principal ──────────────────────────────────────────────
export const VerifyCertificate = () => {
  const [tab, setTab]           = useState('codigo')
  const [query, setQuery]       = useState('')
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileInfo, setFileInfo] = useState(null)
  const fileInputRef            = useRef(null)
  const [searchParams]          = useSearchParams()

  const verify = useCallback(async (payload) => {
    setLoading(true)
    setResult(null)
    try {
      const data = await certificadosApi.verificar(payload)
      setResult(data)
    } catch (err) {
      setResult({ estado: 'no_encontrado', mensaje: err.message || 'No encontrado.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const codigo = searchParams.get('codigo')
    if (codigo) {
      setTab('codigo')
      setQuery(codigo)
      verify({ codigo: codigo.trim() })
      setTimeout(() => document.getElementById('verificar')?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCodigoSubmit = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    const payload = tab === 'hash' ? { hash: query.trim() } : { codigo: query.trim() }
    verify(payload)
  }

  const processFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Solo se aceptan archivos PDF.')
      return
    }
    setFileInfo({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' })
    setLoading(true)
    setResult(null)
    try {
      const codigo = await extractCodigoFromPDF(file)
      if (!codigo) {
        setResult({ estado: 'no_encontrado', mensaje: 'No se encontró un código de certificado válido en el PDF.' })
        return
      }
      const data = await certificadosApi.verificar({ codigo })
      setResult(data)
    } catch (err) {
      setResult({ estado: 'no_encontrado', mensaje: err.message || 'No encontrado.' })
    } finally {
      setLoading(false)
    }
  }

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const reset = () => {
    setResult(null)
    setQuery('')
    setFileInfo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const scrollToVerify = () => document.getElementById('verificar')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className='landing-page'>

      {/* Navbar */}
      <nav className='landing-nav' aria-label='Navegación principal'>
        <div className='nav-brand'>
          <ShieldCheck size={20} aria-hidden='true' />
          <span>CertiValidate</span>
        </div>
        <div className='nav-actions'>
          <button className='nav-btn-ghost' onClick={scrollToVerify} type='button'>
            <ShieldCheck size={14} aria-hidden='true' />
            Verificar Certificado
          </button>
          <ThemeToggle />
          <Link to='/login' className='nav-btn-acceder'>Acceder</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className='hero-section' aria-labelledby='hero-heading'>
        <div className='hero-inner animate-fade-in'>
          <div className='hero-badge-pill'>
            <ShieldCheck size={13} aria-hidden='true' />
            Verificación respaldada por Blockchain
          </div>
          <h1 id='hero-heading' className='hero-title'>
            Certificados Académicos<br />
            <span className='hero-highlight'>Verificables</span>
          </h1>
          <p className='hero-desc'>
            Verifica la autenticidad de cualquier certificado académico emitido por la
            institución en segundos. Seguro, transparente e inmutable.
          </p>
          <div className='hero-features-row' aria-hidden='true'>
            <span><Link2 size={13} /> Registro en Blockchain</span>
            <span><Fingerprint size={13} /> Hash SHA-256</span>
            <span><ShieldCheck size={13} /> Verificación Pública</span>
          </div>
        </div>
      </section>

      {/* Verificar */}
      <section id='verificar' className='verify-section' aria-labelledby='verify-heading'>
        <div className='verify-inner'>
          <h2 id='verify-heading' className='verify-title'>
            Verificar <span className='hero-highlight'>Certificado</span>
          </h2>
          <p className='verify-subtitle'>
            Ingresa el código único, el hash SHA-256 o sube el archivo PDF del certificado
          </p>

          {/* Tabs */}
          <div className='verify-mode-tabs' role='tablist' aria-label='Método de verificación'>
            <button
              type='button'
              role='tab'
              aria-selected={tab === 'codigo'}
              className={`mode-tab ${tab === 'codigo' ? 'active' : ''}`}
              onClick={() => { setTab('codigo'); reset() }}
            >
              <KeyRound size={15} aria-hidden='true' />Código único
            </button>
            <button
              type='button'
              role='tab'
              aria-selected={tab === 'hash'}
              className={`mode-tab ${tab === 'hash' ? 'active' : ''}`}
              onClick={() => { setTab('hash'); reset() }}
            >
              <Hash size={15} aria-hidden='true' />Hash SHA-256
            </button>
            <button
              type='button'
              role='tab'
              aria-selected={tab === 'archivo'}
              className={`mode-tab ${tab === 'archivo' ? 'active' : ''}`}
              onClick={() => { setTab('archivo'); reset() }}
            >
              <Upload size={15} aria-hidden='true' />Verificar archivo PDF
            </button>
          </div>

          {/* Tab: código o hash */}
          {(tab === 'codigo' || tab === 'hash') && !result && (
            <form onSubmit={handleCodigoSubmit} className='verify-form' role='search'>
              <div>
                <label htmlFor='verify-query' className='sr-only'>
                  {tab === 'codigo' ? 'Código único del certificado' : 'Hash SHA-256 del certificado'}
                </label>
                <div className='verify-input-wrap'>
                  <Search size={16} className='vi-icon' aria-hidden='true' />
                  <input
                    id='verify-query'
                    type='text'
                    className='verify-input'
                    placeholder={tab === 'codigo'
                      ? 'Ingresa el código único del certificado (16 caracteres)'
                      : 'Ej. e3b0c44298fc1c149afbf4c8996fb924…'}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoComplete='off'
                    spellCheck='false'
                  />
                </div>
              </div>
              <div className='verify-btn-row'>
                <button type='submit' className='btn-verify' disabled={loading || !query.trim()}>
                  <Search size={16} aria-hidden='true' />
                  {loading ? 'Verificando…' : 'Verificar'}
                </button>
              </div>
              <p className='verify-hint'>
                {tab === 'codigo'
                  ? 'El código de 16 caracteres aparece en el certificado impreso o digital.'
                  : 'El hash SHA-256 garantiza la integridad del documento PDF.'}
              </p>
            </form>
          )}

          {/* Tab: archivo PDF */}
          {tab === 'archivo' && !result && (
            <div className='verify-file-area'>
              <label htmlFor='pdf-upload' className='sr-only'>Subir archivo PDF del certificado</label>
              <div
                className={`dropzone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                role='button'
                tabIndex={0}
                aria-label='Zona de carga de PDF — haz clic o arrastra el archivo aquí'
              >
                <input
                  ref={fileInputRef}
                  id='pdf-upload'
                  type='file'
                  accept='application/pdf'
                  onChange={handleFileInput}
                  hidden
                />
                <FileText size={40} className='dropzone-icon' aria-hidden='true' />
                <p className='dropzone-text'>
                  {fileInfo
                    ? <><strong>{fileInfo.name}</strong><br /><span>{fileInfo.size}</span></>
                    : <><strong>Arrastra el PDF aquí</strong><br /><span>o haz clic para seleccionar</span></>
                  }
                </p>
                {loading && <div className='dropzone-spinner' aria-hidden='true' />}
              </div>
              <p className='verify-hint'>Se calculará el hash SHA-256 del archivo en tu navegador para compararlo con el registrado.</p>
            </div>
          )}

          {/* Skeleton de carga */}
          {loading && !result && <ResultSkeleton />}

          {/* Resultado */}
          {result && <ResultCard result={result} onReset={reset} />}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className='hiw-section' aria-labelledby='hiw-heading'>
        <div className='hiw-inner'>
          <h2 id='hiw-heading' className='hiw-title'>¿Cómo funciona?</h2>
          <div className='hiw-grid'>
            {HOW_IT_WORKS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className='hiw-card'>
                <div className='hiw-icon-wrap' aria-hidden='true'><Icon size={26} /></div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
