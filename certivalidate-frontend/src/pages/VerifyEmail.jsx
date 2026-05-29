import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { ShieldCheck, CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import './VerifyEmail.css';

const STATE = {
  LOADING:  'loading',
  SUCCESS:  'success',
  ERROR:    'error',
  NO_TOKEN: 'no_token',
};

export const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState(STATE.LOADING);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setState(STATE.NO_TOKEN);
      return;
    }
    authApi.verificarEmail(token)
      .then(() => setState(STATE.SUCCESS))
      .catch(err => {
        setMessage(err.message || 'El enlace no es válido o ha expirado.');
        setState(STATE.ERROR);
      });
  }, [searchParams]);

  return (
    <div className="ve-page">
      <nav className="landing-nav">
        <div className="nav-brand">
          <ShieldCheck size={20} />
          <span>CertiValidate</span>
        </div>
        <Link to="/login" className="nav-btn-acceder">Acceder</Link>
      </nav>

      <div className="ve-center">
        <div className="ve-card glass-panel">

          {state === STATE.LOADING && (
            <>
              <Loader2 size={48} className="ve-spinner" />
              <h2>Verificando tu correo...</h2>
              <p className="ve-sub">Espera un momento.</p>
            </>
          )}

          {state === STATE.SUCCESS && (
            <>
              <CheckCircle2 size={52} className="ve-icon-success" />
              <h2>¡Correo verificado!</h2>
              <p className="ve-sub">
                Tu cuenta ha sido activada correctamente. Ya puedes iniciar sesión.
              </p>
              <Link to="/login" className="ve-btn-primary">
                Ir al inicio de sesión
              </Link>
            </>
          )}

          {state === STATE.ERROR && (
            <>
              <XCircle size={52} className="ve-icon-error" />
              <h2>Enlace inválido</h2>
              <p className="ve-sub">{message}</p>
              <p className="ve-hint">
                El enlace puede haber expirado. Inicia sesión y solicita un nuevo correo de verificación.
              </p>
              <Link to="/login" className="ve-btn-primary">
                Volver al inicio de sesión
              </Link>
            </>
          )}

          {state === STATE.NO_TOKEN && (
            <>
              <Mail size={52} className="ve-icon-warn" />
              <h2>Enlace incompleto</h2>
              <p className="ve-sub">
                No se encontró el token de verificación en la URL.
              </p>
              <Link to="/login" className="ve-btn-primary">
                Volver al inicio de sesión
              </Link>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
