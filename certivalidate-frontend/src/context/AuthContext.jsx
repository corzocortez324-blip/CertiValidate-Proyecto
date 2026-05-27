import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { clearSession, getToken, setTokens, SESSION_EXPIRED_EVENT } from '../api/_client';
import { can } from '../utils/permissions';

const AuthContext = createContext(null);

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const loadUser = () => safeJsonParse(localStorage.getItem('user'));
const loadAccesos = () => safeJsonParse(localStorage.getItem('accesos')) || [];
const saveUserSession = (usuario, accesos) => {
  if (usuario) localStorage.setItem('user', JSON.stringify(usuario));
  localStorage.setItem('accesos', JSON.stringify(accesos || []));
};

const normalizeProfile = (data) => {
    const usuario = data?.usuario || data;
    const accesos =
      data?.accesos ||
      data?.permisos ||
      data?.permissions ||
      usuario?.accesos ||
      usuario?.permisos ||
      usuario?.permissions ||
      [];
    return { usuario, accesos: Array.isArray(accesos) ? accesos : [] };
  };
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(loadUser);
  const [accesos, setAccesos] = useState(loadAccesos);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clearAuthState = useCallback(() => {
    clearSession();
    localStorage.removeItem('user');
    localStorage.removeItem('accesos');
    setUser(null);
    setAccesos([]);
  }, []);

  const persistSession = (data) => {
    setTokens(data.token, data.refreshToken);
    const { usuario, accesos: storedAccesos } = normalizeProfile(data);
    saveUserSession(usuario, storedAccesos);
    setUser(usuario);
    setAccesos(storedAccesos);
  };

  const refreshProfile = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const perfil = await authApi.getPerfil();
      const permisos = await authApi.getPermisos().catch(() => null);
      const profileData = permisos?.data ? { ...perfil, accesos: permisos.data?.accesos || perfil.accesos || [] } : perfil;
      const { usuario, accesos: storedAccesos } = normalizeProfile(profileData);
      if (!usuario) throw new Error('Perfil inválido');
      saveUserSession(usuario, storedAccesos);
      setUser(usuario);
      setAccesos(storedAccesos);
    } catch (error) {
      clearAuthState();
    }
  }, [clearAuthState]);

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));
    const onExpired = () => {
      clearAuthState();
      navigate('/login');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [clearAuthState, navigate, refreshProfile]);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    if (data?.requires2FA) {
      return { requires2FA: true, partial_token: data.partial_token };
    }
    persistSession(data);
    return data.usuario;
  };

  const completeLogin2FA = async (partial_token, code) => {
    const data = await authApi.verify2FA(partial_token, code);
    persistSession(data);
    return data.usuario;
  };

  const register = async (formData) => {
    return await authApi.register(formData);
  };

  const logout = async () => {
    const token = getToken();
    try {
      if (token) await authApi.logout(token);
    } catch (_) {
      // Si el servidor falla, limpiamos sesión localmente de todas formas.
    } finally {
      clearAuthState();
      navigate('/login');
    }
  };

  const updateProfile = async (data) => {
    const updated = await authApi.updatePerfil(data);
    const usuario = updated?.usuario || updated || { ...user, ...data };
    saveUserSession(usuario, accesos);
    setUser(usuario);
    return usuario;
  };

  const changePassword = async (currentPassword, newPassword) => {
    return await authApi.changePassword(currentPassword, newPassword);
  };

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (!permission) return true;
    return can(permission, user, accesos);
  }, [user, accesos]);

  return (
    <AuthContext.Provider value={{ user, accesos, loading, login, completeLogin2FA, register, logout, updateProfile, changePassword, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
