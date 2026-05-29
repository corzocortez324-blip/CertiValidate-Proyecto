import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Ha ocurrido un error inesperado.' };
  }

  componentDidCatch(error, errorInfo) {
    // Aquí se puede conectar con un servicio de logging externo
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-screen">
          <div className="error-boundary-card glass-panel">
            <h1>Algo salió mal</h1>
            <p>{this.state.message}</p>
            <button className="btn-primary" type="button" onClick={() => window.location.reload()}>
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
