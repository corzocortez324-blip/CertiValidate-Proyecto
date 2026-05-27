import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NoAuthorized } from '../NoAuthorized';

export const PermissionRoute = ({ permission, element }) => {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const roleName =
    user?.rol?.nombre ||
    user?.rol ||
    user?.role?.nombre ||
    user?.role ||
    '';

  const normalizedRole = String(roleName).toLowerCase();

  const isAdmin =
    normalizedRole === 'admin' ||
    normalizedRole === 'administrador' ||
    normalizedRole.includes('admin');

  if (isAdmin) {
    return element;
  }

  if (permission && !hasPermission(permission)) {
    return <NoAuthorized />;
  }

  return element;
};