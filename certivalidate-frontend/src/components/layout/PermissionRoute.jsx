import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NoAuthorized } from '../NoAuthorized';
import { can } from '../../utils/permissions';

export const PermissionRoute = ({ permission, element }) => {
  const { user, loading, accesos } = useAuth();

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

  if (permission && !can(permission, user, accesos)) {
    return <NoAuthorized />;
  }

  return element;
};