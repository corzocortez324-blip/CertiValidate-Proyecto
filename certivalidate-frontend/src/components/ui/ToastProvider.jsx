import React, { createContext, useContext, useState, useCallback } from 'react';
import './ToastProvider.css';

const ToastContext = createContext(null);
const ConfirmContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  const confirm = useCallback((message, title = 'Confirmar acción') => {
    return new Promise((resolve) => {
      setConfirmState({ message, title, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(true);
      setConfirmState(null);
    }
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(false);
      setConfirmState(null);
    }
  }, [confirmState]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <ConfirmContext.Provider value={{ confirm }}>
        {children}
        <div className="toast-viewport">
          {toasts.map(({ id, message, type }) => (
            <div key={id} className={`toast toast-${type}`}>
              <span>{message}</span>
              <button type="button" onClick={() => removeToast(id)} aria-label="Cerrar" className="toast-close">×</button>
            </div>
          ))}
        </div>
        {confirmState && (
          <div className="confirm-overlay" role="dialog" aria-modal="true">
            <div className="confirm-dialog glass-panel">
              <div className="confirm-header">
                <strong>{confirmState.title}</strong>
              </div>
              <div className="confirm-body">
                <p>{confirmState.message}</p>
              </div>
              <div className="confirm-actions">
                <button type="button" className="btn-secondary" onClick={handleCancel}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleConfirm}>Confirmar</button>
              </div>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ToastProvider');
  return ctx;
};
