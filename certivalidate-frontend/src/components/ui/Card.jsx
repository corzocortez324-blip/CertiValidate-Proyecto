import React from 'react';
import './Card.css';

export const Card = ({ children, className = '', glow = false }) => {
  return (
    <div className={`glass-panel card ${glow ? 'card-glow' : ''} ${className}`}>
      {children}
    </div>
  );
};
