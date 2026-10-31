import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, ShieldAlert, Pencil, Smartphone } from 'lucide-react';
import './Auth.css';
import { focusOnMount } from '../utils/helpers';

// Solo en desarrollo (`npm run dev`) y si las contraseñas están en .env.development.local
// (VITE_DEMO_*_PASSWORD). En producción import.meta.env.DEV es false y el bloque se elimina.
const DEMO_USERS = import.meta.env.DEV ? [
  { email: 'admin@certivalidate.com', password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD, label: 'Admin', icon: ShieldAlert, color: '#00f0ff' },
  { email: 'emisor@certivalidate.com', password: import.meta.env.VITE_DEMO_EMISOR_PASSWORD, label: 'Emisor', icon: Pencil, color: '#b026ff' },
  { email: 'lector@certivalidate.com', password: import.meta.env.VITE_DEMO_LECTOR_PASSWORD, label: 'Lector', icon: Eye, color: '#38bdf8' },
].filter((u) => u.password) : [];

const MAX_ATTEMPTS = 5;

function parseLoginError(err) {
  const msg = err?.message || '';
  const status = err?.status || err?.statusCode;

  if (status === 423 || msg.toLowerCase().includes('bloqueada') || msg.toLowerCase().includes('blocked')) {
    return {
      type: 'blocked',
      text: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Inténtalo de nuevo en 15 minutos.',
    };
  }

  if (
    status === 401 ||
    msg.toLowerCase().includes('credenciales') ||
    msg.toLowerCase().includes('contraseña') ||
    msg.toLowerCase().includes('password')
  ) {
    return { type: 'invalid', text: msg || 'Correo o contraseña incorrectos.' };
  }

  if (status === 429) {
    return { type: 'rate', text: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' };
  }

  return { type: 'generic', text: msg || 'Error al iniciar sesión. Inténtalo de nuevo.' };
}

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [step, setStep] = useState('credentials');
  const [partialToken, setPartialToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const { login, completeLogin2FA } = useAuth();
  const navigate = useNavigate();

  const getRoleRedirect = (user) => {
    if (!user) return '/admin';

    const rol = user.rol || '';

    if (rol === 'admin') return '/admin';
    if (rol === 'editor') return '/admin/certificados';
    if (rol === 'lector') return '/admin/certificados';

    return '/admin';
  };

  const doLogin = async (loginEmail, loginPassword) => {
    setError(null);
    setLoading(true);

    try {
      const result = await login(loginEmail, loginPassword);

      if (result?.requires2FA) {
        setPartialToken(result.partial_token);
        setTotpCode('');
        setStep('totp');
        return;
      }

      setAttempts(0);
      void navigate(getRoleRedirect(result));
    } catch (err) {
      const parsed = parseLoginError(err);
      const newAttempts = parsed.type === 'invalid' ? attempts + 1 : attempts;

      setAttempts(newAttempts);

      if (parsed.type === 'invalid' && newAttempts < MAX_ATTEMPTS) {
        const remaining = MAX_ATTEMPTS - newAttempts;
        parsed.text = `${parsed.text} (${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''})`;
      }

      setError(parsed);
    } finally {
      setLoading(false);
    }
  };

  const doVerifyTotp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await completeLogin2FA(partialToken, totpCode.replace(/\s/g, ''));
      void navigate(getRoleRedirect(user));
    } catch (err) {
      setError({ type: 'invalid', text: err?.message || 'Código 2FA incorrecto.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    void doLogin(email, password);
  };

  const loginAs = (demoEmail, demoPassword) => {
    void doLogin(demoEmail, demoPassword);
  };

  const isBlocked = error?.type === 'blocked' || attempts >= MAX_ATTEMPTS;

  return (
    <div className="auth-split-page">
      <div className="auth-left-panel">
        <div className="auth-brand-content">
          <div className="auth-brand-icon-wrap">
            <ShieldCheck size={36} />
          </div>

          <h1 className="auth-brand-title">CertiValidate</h1>

          <p className="auth-brand-desc">
            Sistema de Certificados Académicos con tecnología Blockchain.
            Gestiona, emite y verifica certificados de forma segura.
          </p>

          <div className="auth-badges-row">
            <div className="auth-badge-pill">
              <span className="badge-value">100%</span>
              <span className="badge-label">Seguro</span>
            </div>

            <div className="auth-badge-pill">
              <span className="badge-value">SHA-256</span>
              <span className="badge-label">Cifrado</span>
            </div>

            <div className="auth-badge-pill">
              <span className="badge-value">Público</span>
              <span className="badge-label">Verificable</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right-panel">
        {step === 'totp' ? (
          <div className="auth-form-container animate-fade-in">
            <div className="auth-form-accent-bar" />

            <div className="totp-icon-wrap">
              <Smartphone size={32} />
            </div>

            <h2 className="auth-form-title">Verificación 2FA</h2>
            <p className="auth-form-subtitle">
              Ingresa el código de 6 dígitos de tu app autenticadora
            </p>

            {error && <div className="alert alert-error">{error.text}</div>}

            <form onSubmit={doVerifyTotp} className="auth-form">
              <div className="form-group">
                <label htmlFor="login-codigo-de-verificacion">Código de verificación</label>

                <div className="input-wrapper">
                  <Lock size={16} className="input-icon-left" />

                  <input id="login-codigo-de-verificacion"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    maxLength={7}
                    className="form-input has-icon-left totp-input"
                    placeholder="000 000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    ref={focusOnMount}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit"
                disabled={loading || totpCode.replace(/\s/g, '').length < 6}
              >
                {loading ? 'Verificando...' : 'Confirmar'}
              </button>
            </form>

            <button
              type="button"
              className="auth-back-link"
              onClick={() => {
                setStep('credentials');
                setError(null);
                setPartialToken('');
              }}
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <div className="auth-form-container animate-fade-in">
            <div className="auth-form-accent-bar" />

            <h2 className="auth-form-title">Iniciar Sesión</h2>
            <p className="auth-form-subtitle">
              Ingresa tus credenciales institucionales
            </p>

            {error && (
              <div className={`alert ${error.type === 'blocked' ? 'alert-error alert-blocked' : 'alert-error'}`}>
                {error.type === 'blocked' && <span className="alert-icon">🔒</span>}
                {error.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="login-correo-electronico">Correo electrónico</label>

                <div className="input-wrapper">
                  <Mail size={16} className="input-icon-left" />

                  <input id="login-correo-electronico"
                    type="email"
                    className="form-input has-icon-left"
                    placeholder="usuario@unicesar.edu.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isBlocked}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="login-contrasena">Contraseña</label>

                <div className="input-wrapper has-icon-right">
                  <Lock size={16} className="input-icon-left" />

                  <input id="login-contrasena"
                    type={showPass ? 'text' : 'password'}
                    className="form-input has-icon-left"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isBlocked}
                  />

                  <button
                    type="button"
                    className="input-icon-right"
                    onClick={() => setShowPass(!showPass)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {attempts > 0 && attempts < MAX_ATTEMPTS && (
                <div className="login-attempts-bar">
                  <div
                    className="login-attempts-fill"
                    style={{ width: `${(attempts / MAX_ATTEMPTS) * 100}%` }}
                  />
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary auth-submit"
                disabled={loading || isBlocked}
              >
                {loading ? 'Verificando...' : isBlocked ? 'Cuenta bloqueada' : 'Acceder al Sistema'}
              </button>
            </form>

            <div className="auth-register-link">
              <span>¿No tienes cuenta?</span>{' '}
              <Link to="/register">Crear cuenta</Link>
            </div>

            {import.meta.env.DEV && DEMO_USERS.length > 0 && (
            <div className="auth-demo-section">
              <p className="demo-label">Acceso rápido (demo)</p>

              <div className="demo-grid">
                {DEMO_USERS.map(({ email: e, password: p, label, icon: Icon, color }) => (
                  <button
                    key={e}
                    type="button"
                    className="demo-btn glass-panel"
                    onClick={() => loginAs(e, p)}
                    disabled={loading || isBlocked}
                  >
                    <Icon size={16} style={{ color }} />
                    <span className="demo-btn-label">{label}</span>
                  </button>
                ))}
              </div>
            </div>
            )}

            <p className="auth-back-link">
              <Link to="/">← Volver al inicio</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
