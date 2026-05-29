import React from 'react';
import './Input.css';

export const Input = ({ label, icon, error, className = '', ...props }) => {
  return (
    <div className={`form-group ${className}`}>
      {label && <label className="form-label">{label}</label>}
      <div className={`input-wrapper ${icon ? 'has-icon' : ''}`}>
        {icon && <span className="input-icon">{icon}</span>}
        <input className={`form-input ${error ? 'input-error' : ''}`} {...props} />
      </div>
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
};

export const Select = ({ label, children, error, className = '', ...props }) => {
  return (
    <div className={`form-group ${className}`}>
      {label && <label className="form-label">{label}</label>}
      <select className={`form-input form-select ${error ? 'input-error' : ''}`} {...props}>
        {children}
      </select>
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
};

export const Textarea = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`form-group ${className}`}>
      {label && <label className="form-label">{label}</label>}
      <textarea className={`form-input form-textarea ${error ? 'input-error' : ''}`} {...props} />
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
};
