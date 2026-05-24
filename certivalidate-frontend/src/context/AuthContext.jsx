import React, { createContext, useContext, useState, useCallback } from 'react';
import { authApi } from '../api/auth.api';
import { clearTokens } from '../api/_client';

const AuthContext = createContext(null);

const loadAccesos = () => {
  try { return JSON.parse(localStorage.getItem('accesos') || '[]'); } catch { return []; }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [accesos, setAccesos] = useState(loadAccesos);

  const persistSession = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.usuario));
    localStorage.setItem('accesos', JSON.stringify(data.accesos || []));
    setUser(data.usuario);
    setAccesos(data.accesos || []);
  };

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    if (data.requires2FA) {
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
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch (_) {
      // Si el servidor falla, cerramos sesión localmente igual
    } finally {
      clearTokens();
      localStorage.removeItem('user');
      localStorage.removeItem('accesos');
      setUser(null);
      setAccesos([]);
    }
  };

  const updateProfile = async (data) => {
    const updated = await authApi.updatePerfil(data);
    const merged = { ...user, ...updated };
    localStorage.setItem('user', JSON.stringify(merged));
    setUser(merged);
    return merged;
  };

  const changePassword = async (currentPassword, newPassword) => {
    return await authApi.changePassword(currentPassword, newPassword);
  };

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    return accesos.some(a => a.permisos?.includes(permission));
  }, [user, accesos]);

  const loading = false;

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
