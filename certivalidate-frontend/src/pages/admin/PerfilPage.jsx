import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth.api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Lock, Save, Check, X, ShieldAlert, Pencil, Eye, Smartphone, ShieldCheck, ShieldOff, Monitor, Globe, Trash2, LogOut } from 'lucide-react';
import { formatDateTime } from '../../utils/helpers';
import './PerfilPage.css';

const PW_RULES = [
  { label: 'Mínimo 8 caracteres',    test: p => p.length >= 8 },
  { label: 'Al menos una mayúscula', test: p => /[A-Z]/.test(p) },
  { label: 'Al menos una minúscula', test: p => /[a-z]/.test(p) },
  { label: 'Al menos un número',     test: p => /\d/.test(p) },
];

const ROLE_META = {
  admin:  { label: 'Administrador', color: 'var(--color-primary)',   icon: ShieldAlert },
  editor: { label: 'Editor',        color: 'var(--color-secondary)', icon: Pencil },
  lector: { label: 'Lector',        color: '#38bdf8',               icon: Eye },
};

function parseDevice(userAgent) {
  if (!userAgent) return { icon: Globe, label: 'Dispositivo desconocido' };
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone'))
    return { icon: Smartphone, label: 'Móvil' };
  return { icon: Monitor, label: 'Escritorio' };
}

function parseBrowser(userAgent) {
  if (!userAgent) return '';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edg')) return 'Edge';
  return 'Navegador';
}

export const PerfilPage = () => {
  const { user, updateProfile, changePassword } = useAuth();

  const [form,    setForm]    = useState({ nombre: user?.nombre || '', apellido: user?.apellido || '', email: user?.email || '' });
  const [msg,     setMsg]     = useState('');
  const [error,   setError]   = useState('');

  const [pwForm,  setPwForm]  = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg,   setPwMsg]   = useState('');
  const [pwError, setPwError] = useState('');
  const [pwFocus, setPwFocus] = useState(false);

  const [twoFaEnabled, setTwoFaEnabled] = useState(user?.totp_enabled ?? false);
  const [twoFaStep,    setTwoFaStep]    = useState('idle'); // 'idle' | 'setup' | 'disable'
  const [qrDataUrl,    setQrDataUrl]    = useState('');
  const [twoFaCode,    setTwoFaCode]    = useState('');
  const [disablePw,    setDisablePw]    = useState('');
  const [twoFaMsg,     setTwoFaMsg]     = useState('');
  const [twoFaError,   setTwoFaError]   = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  const [sesiones,        setSesiones]        = useState([]);
  const [sesionesLoading, setSesionesLoading] = useState(false);
  const [sesionMsg,       setSesionMsg]       = useState('');
  const [sesionError,     setSesionError]     = useState('');
  const [revocando,       setRevocando]       = useState(null);

  const loadSesiones = useCallback(async () => {
    setSesionesLoading(true);
    try {
      const data = await authApi.getSesiones();
      setSesiones(Array.isArray(data) ? data : []);
    } catch { setSesionError('No se pudieron cargar las sesiones.'); }
    finally  { setSesionesLoading(false); }
  }, []);

  useEffect(() => { loadSesiones(); }, [loadSesiones]);

  const handleRevocarSesion = async (id) => {
    setRevocando(id); setSesionMsg(''); setSesionError('');
    try {
      await authApi.revocarSesion(id);
      setSesiones(prev => prev.filter(s => s.id !== id));
      setSesionMsg('Sesión cerrada correctamente.');
    } catch { setSesionError('Error al cerrar la sesión.'); }
    finally  { setRevocando(null); }
  };

  const handleCerrarTodas = async () => {
    setSesionMsg(''); setSesionError('');
    try {
      await authApi.cerrarTodasSesiones();
      setSesiones([]);
      setSesionMsg('Todas las sesiones han sido cerradas.');
    } catch { setSesionError('Error al cerrar las sesiones.'); }
  };

  const roleMeta = ROLE_META[user?.rol] || ROLE_META.lector;
  const RoleIcon = roleMeta.icon;
  const pwValid      = useMemo(() => PW_RULES.every(r => r.test(pwForm.newPassword)), [pwForm.newPassword]);
  const confirmMatch = pwForm.newPassword === pwForm.confirmPassword;

  /* ── Handlers ─────────────────────────────────────────────────── */
  const handleProfile = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (form.nombre.trim().length < 3) { setError('El nombre debe tener al menos 3 caracteres.'); return; }
    try {
      await updateProfile(form);
      setMsg('Perfil actualizado correctamente.');
    } catch (err) { setError(err.message); }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    setPwMsg(''); setPwError('');
    if (!pwValid)      { setPwError('La nueva contraseña no cumple los requisitos.'); return; }
    if (!confirmMatch) { setPwError('Las contraseñas no coinciden.'); return; }
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwMsg('Contraseña cambiada. Serás redirigido al login.');
    } catch (err) { setPwError(err.message); }
  };

  const handleSetup2FA = async () => {
    setTwoFaError(''); setTwoFaMsg(''); setTwoFaLoading(true);
    try {
      const data = await authApi.setup2FA();
      setQrDataUrl(data.qrDataUrl);
      setTwoFaCode('');
      setTwoFaStep('setup');
    } catch (err) { setTwoFaError(err.message); }
    finally { setTwoFaLoading(false); }
  };

  const handleEnable2FA = async (e) => {
    e.preventDefault();
    setTwoFaError(''); setTwoFaLoading(true);
    try {
      await authApi.enable2FA(twoFaCode.replace(/\s/g, ''));
      setTwoFaEnabled(true);
      setTwoFaStep('idle');
      setTwoFaMsg('2FA activado. Tu cuenta ahora requiere código al iniciar sesión.');
      setTwoFaCode('');
    } catch (err) { setTwoFaError(err.message); }
    finally { setTwoFaLoading(false); }
  };

  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setTwoFaError(''); setTwoFaLoading(true);
    try {
      await authApi.disable2FA(disablePw, twoFaCode.replace(/\s/g, ''));
      setTwoFaEnabled(false);
      setTwoFaStep('idle');
      setTwoFaMsg('2FA desactivado correctamente.');
      setTwoFaCode(''); setDisablePw('');
    } catch (err) { setTwoFaError(err.message); }
    finally { setTwoFaLoading(false); }
  };

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="animate-fade-in perfil-page">
      <div className="page-header">
        <div>
          <h1>Mi Perfil</h1>
          <p>Administra tu información personal y credenciales de acceso.</p>
        </div>
      </div>

      {/* ── Tarjeta de identidad (full-width) ── */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div className="perfil-identity-card">
          <div
            className="perfil-avatar"
            style={{ borderColor: roleMeta.color, background: `${roleMeta.color}18`, color: roleMeta.color }}
          >
            {user?.nombre?.charAt(0)?.toUpperCase()}
          </div>
          <div className="perfil-user-info">
            <p className="perfil-user-name">{user?.nombre} {user?.apellido}</p>
            <p className="perfil-user-email">{user?.email}</p>
            <div className="perfil-role-row">
              <RoleIcon size={14} style={{ color: roleMeta.color }} />
              <span className="perfil-role-label" style={{ color: roleMeta.color }}>{roleMeta.label}</span>
            </div>
          </div>
          {user?.ultimo_acceso && (
            <div className="perfil-last-access">
              <p>Último acceso</p>
              <p>{formatDateTime(user.ultimo_acceso)}</p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Secciones apiladas ── */}
      <div className="perfil-stack">

          {/* Información Personal */}
          <Card>
            <h3 className="perfil-section-heading">
              <User size={16} /> Información Personal
            </h3>
            {msg   && <div className="alert alert-success">{msg}</div>}
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleProfile} className="perfil-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Nombre <span className="required-star">*</span></label>
                  <input
                    className="form-input"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    required
                    minLength={3}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellido</label>
                  <input
                    className="form-input"
                    value={form.apellido}
                    onChange={e => setForm({ ...form, apellido: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email <span className="required-star">*</span></label>
                <input
                  className="form-input"
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-actions">
                <Button type="submit" variant="primary" icon={<Save size={16} />}>Guardar Cambios</Button>
              </div>
            </form>
          </Card>

          {/* Cambiar Contraseña */}
          <Card>
            <h3 className="perfil-section-heading">
              <Lock size={16} /> Cambiar Contraseña
            </h3>
            {pwMsg   && <div className="alert alert-success">{pwMsg}</div>}
            {pwError && <div className="alert alert-error">{pwError}</div>}
            <form onSubmit={handlePassword} className="perfil-form">
              <div className="form-group">
                <label className="form-label">Contraseña Actual <span className="required-star">*</span></label>
                <input
                  className="form-input"
                  type="password"
                  value={pwForm.currentPassword}
                  onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nueva Contraseña <span className="required-star">*</span></label>
                <input
                  className="form-input"
                  type="password"
                  value={pwForm.newPassword}
                  onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  onFocus={() => setPwFocus(true)}
                  required
                />
                {(pwFocus || pwForm.newPassword) && (
                  <div className="pw-rules-inline">
                    {PW_RULES.map(({ label, test }) => {
                      const ok = test(pwForm.newPassword);
                      return (
                        <div key={label} className={`pw-rule-inline ${ok ? 'ok' : ''}`}>
                          {ok ? <Check size={12} /> : <X size={12} />}
                          <span>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar Nueva Contraseña <span className="required-star">*</span></label>
                <input
                  className={`form-input ${pwForm.confirmPassword && !confirmMatch ? 'input-error-field' : ''}`}
                  type="password"
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                  required
                />
                {pwForm.confirmPassword && !confirmMatch && (
                  <p className="perfil-confirm-mismatch">Las contraseñas no coinciden</p>
                )}
              </div>
              <div className="form-actions">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!pwValid || !confirmMatch || !pwForm.currentPassword}
                >
                  Cambiar Contraseña
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <h3 className="perfil-section-heading">
              <Smartphone size={16} /> Autenticación en Dos Pasos (2FA)
            </h3>

            {twoFaMsg   && <div className="alert alert-success">{twoFaMsg}</div>}
            {twoFaError && <div className="alert alert-error">{twoFaError}</div>}

            {twoFaStep === 'idle' && (
              <div className="twofa-status-row">
                {twoFaEnabled ? (
                  <>
                    <div className="twofa-status twofa-status--on">
                      <ShieldCheck size={15} /> 2FA activo — cuenta protegida
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => { setTwoFaStep('disable'); setTwoFaError(''); setTwoFaCode(''); setDisablePw(''); }}
                    >
                      <ShieldOff size={15} /> Desactivar 2FA
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="twofa-status twofa-status--off">
                      <ShieldOff size={15} /> 2FA desactivado
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: 0 }}>
                      Activa la verificación en dos pasos para mayor seguridad en tu cuenta.
                    </p>
                    <Button variant="primary" onClick={handleSetup2FA} disabled={twoFaLoading}>
                      {twoFaLoading ? 'Configurando…' : <><Smartphone size={15} /> Activar 2FA</>}
                    </Button>
                  </>
                )}
              </div>
            )}

            {twoFaStep === 'setup' && (
              <form onSubmit={handleEnable2FA} className="form-col">
                <p className="perfil-2fa-hint">
                  Escanea el QR con Google Authenticator, Authy u otra app TOTP y luego ingresa el código de 6 dígitos.
                </p>
                {qrDataUrl && (
                  <div className="twofa-qr-wrap">
                    <img src={qrDataUrl} alt="QR 2FA" className="twofa-qr-img" />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Código de verificación <span className="required-star">*</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    className="form-input"
                    placeholder="000 000"
                    style={{ letterSpacing: '0.3em', fontFamily: 'monospace', fontSize: '1.1rem', textAlign: 'center' }}
                    value={twoFaCode}
                    onChange={e => setTwoFaCode(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-actions" style={{ gap: '0.5rem', justifyContent: 'space-between' }}>
                  <Button type="button" variant="ghost" onClick={() => { setTwoFaStep('idle'); setTwoFaError(''); }}>Cancelar</Button>
                  <Button type="submit" variant="primary" disabled={twoFaLoading || twoFaCode.replace(/\s/g, '').length < 6}>
                    {twoFaLoading ? 'Verificando…' : 'Confirmar'}
                  </Button>
                </div>
              </form>
            )}

            {twoFaStep === 'disable' && (
              <form onSubmit={handleDisable2FA} className="form-col">
                <div className="form-group">
                  <label className="form-label">Contraseña actual <span className="required-star">*</span></label>
                  <input
                    type="password"
                    className="form-input"
                    value={disablePw}
                    onChange={e => setDisablePw(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Código TOTP <span className="required-star">*</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    className="form-input"
                    placeholder="000 000"
                    style={{ letterSpacing: '0.3em', fontFamily: 'monospace', fontSize: '1.1rem', textAlign: 'center' }}
                    value={twoFaCode}
                    onChange={e => setTwoFaCode(e.target.value)}
                    required
                  />
                </div>
                <div className="form-actions" style={{ gap: '0.5rem', justifyContent: 'space-between' }}>
                  <Button type="button" variant="ghost" onClick={() => { setTwoFaStep('idle'); setTwoFaError(''); }}>Cancelar</Button>
                  <Button type="submit" variant="primary" disabled={twoFaLoading || !disablePw || twoFaCode.replace(/\s/g, '').length < 6}>
                    {twoFaLoading ? 'Procesando…' : 'Desactivar'}
                  </Button>
                </div>
              </form>
            )}
          </Card>

          {/* Sesiones Activas */}
          <Card>
            <h3 className="perfil-section-heading">
              <Monitor size={16} /> Sesiones Activas
            </h3>

            {sesionMsg   && <div className="alert alert-success">{sesionMsg}</div>}
            {sesionError && <div className="alert alert-error">{sesionError}</div>}

            {sesionesLoading ? (
              <p className="sesiones-empty">Cargando sesiones…</p>
            ) : sesiones.length === 0 ? (
              <p className="sesiones-empty">No hay sesiones activas registradas.</p>
            ) : (
              <div className="sesiones-list">
                {sesiones.map(s => {
                  const { icon: DeviceIcon, label: deviceLabel } = parseDevice(s.user_agent);
                  const browser = parseBrowser(s.user_agent);
                  return (
                    <div key={s.id} className="sesion-item">
                      <div className="sesion-icon">
                        <DeviceIcon size={18} />
                      </div>
                      <div className="sesion-info">
                        <p className="sesion-device">{deviceLabel}{browser ? ` · ${browser}` : ''}</p>
                        <p className="sesion-meta">
                          {s.ip || 'IP desconocida'} · Iniciada {formatDateTime(s.created_at)}
                        </p>
                        <p className="sesion-expires">Expira {formatDateTime(s.expires_at)}</p>
                      </div>
                      <button
                        className="sesion-revoke-btn"
                        onClick={() => handleRevocarSesion(s.id)}
                        disabled={revocando === s.id}
                        title="Cerrar esta sesión"
                      >
                        {revocando === s.id ? '…' : <Trash2 size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {sesiones.length > 1 && (
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <Button variant="ghost" onClick={handleCerrarTodas} icon={<LogOut size={15} />}>
                  Cerrar todas las sesiones
                </Button>
              </div>
            )}
          </Card>

      </div>
    </div>
  );
};
