import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, User, Mail, Lock, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const PW_RULES = [
  { label: 'Mínimo 8 caracteres', test: p => p.length >= 8 },
  { label: 'Al menos una mayúscula', test: p => /[A-Z]/.test(p) },
  { label: 'Al menos una minúscula', test: p => /[a-z]/.test(p) },
  { label: 'Al menos un número', test: p => /\d/.test(p) },
];

export const RegisterPage = () => {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '' });
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [pwFocus, setPwFocus] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const pwValid = useMemo(() => PW_RULES.every(r => r.test(form.password)), [form.password]);
  const confirmMatch = confirm === form.password;
  const canSubmit = pwValid && confirmMatch && form.nombre.trim().length >= 3 && form.email;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pwValid) { setError('La contraseña no cumple los requisitos.'); return; }
    if (!confirmMatch) { setError('Las contraseñas no coinciden.'); return; }
    if (form.nombre.trim().length < 3) { setError('El nombre debe tener al menos 3 caracteres.'); return; }
    setError('');
    setLoading(true);
    try {
      await register(form);
      setSuccess('Cuenta creada. Revisa tu correo para verificar tu email.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message || 'Error en el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-panel animate-fade-in" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <ShieldCheck size={40} />
          <h1>CertiValidate</h1>
        </div>
        <p className="auth-subtitle">Crea tu cuenta de institución</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nombre <span className="required-star">*</span></label>
              <div className="input-wrapper has-icon">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Juan"
                  value={form.nombre}
                  onChange={update('nombre')}
                  required
                  minLength={3}
                />
              </div>
              {form.nombre && form.nombre.length < 3 && (
                <p className="field-hint error">Mínimo 3 caracteres</p>
              )}
            </div>
            <div className="form-group">
              <label>Apellido</label>
              <input
                type="text"
                className="form-input"
                placeholder="Pérez"
                value={form.apellido}
                onChange={update('apellido')}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Correo Electrónico <span className="required-star">*</span></label>
            <div className="input-wrapper has-icon">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                className="form-input"
                placeholder="tu@email.com"
                value={form.email}
                onChange={update('email')}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Contraseña <span className="required-star">*</span></label>
            <div className="input-wrapper has-icon">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                className="form-input"
                placeholder="Mín. 8 caracteres"
                value={form.password}
                onChange={update('password')}
                onFocus={() => setPwFocus(true)}
                required
              />
            </div>
            {(pwFocus || form.password) && (
              <div className="pw-rules">
                {PW_RULES.map(({ label, test }) => {
                  const ok = test(form.password);
                  return (
                    <div key={label} className={`pw-rule ${ok ? 'ok' : ''}`}>
                      {ok ? <Check size={13} /> : <X size={13} />}
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Confirmar Contraseña <span className="required-star">*</span></label>
            <div className="input-wrapper has-icon">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                className={`form-input ${confirm && !confirmMatch ? 'input-error' : ''}`}
                placeholder="Repite tu contraseña"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>
            {confirm && !confirmMatch && (
              <p className="field-hint error">Las contraseñas no coinciden</p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading || !canSubmit}
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <p className="auth-footer">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
};
