import React from 'react';
import './Badge.css';

export const Badge = ({ children, variant = 'muted', className = '' }) => {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {children}
    </span>
  );
};
