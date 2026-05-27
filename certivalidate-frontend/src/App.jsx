import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { PermissionRoute } from './components/layout/PermissionRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { VerifyEmail } from './pages/VerifyEmail';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CertificadosPage } from './pages/admin/CertificadosPage';
import { EstudiantesPage } from './pages/admin/EstudiantesPage';
import { PlantillasPage } from './pages/admin/PlantillasPage';
import { InstitucionesPage } from './pages/admin/InstitucionesPage';
import { AuditoriaPage } from './pages/admin/AuditoriaPage';
import { PerfilPage } from './pages/admin/PerfilPage';
import { UsuariosPage } from './pages/admin/UsuariosPage';
import { RolesPage } from './pages/admin/RolesPage';
import { IntegracionesPage } from './pages/admin/IntegracionesPage';
import { PERMISSIONS } from './constants/permissions';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verificar-email" element={<VerifyEmail />} />

          {/* Protected admin routes */}
          <Route path="/admin" element={<ProtectedRoute element={<AdminLayout />} />}>
            <Route index element={<AdminDashboard />} />
            <Route path="certificados" element={<PermissionRoute permission={PERMISSIONS.CERTIFICADO_LISTAR} element={<CertificadosPage />} />} />
            <Route path="estudiantes" element={<PermissionRoute permission={PERMISSIONS.ESTUDIANTE_LISTAR} element={<EstudiantesPage />} />} />
            <Route path="plantillas" element={<PermissionRoute permission={PERMISSIONS.PLANTILLA_LISTAR} element={<PlantillasPage />} />} />
            <Route path="instituciones" element={<PermissionRoute permission={PERMISSIONS.INSTITUCION_VER} element={<InstitucionesPage />} />} />
            <Route path="auditoria" element={<PermissionRoute permission={PERMISSIONS.AUDITORIA_VER} element={<AuditoriaPage />} />} />
            <Route path="usuarios" element={<PermissionRoute permission={PERMISSIONS.USUARIO_LISTAR} element={<UsuariosPage />} />} />
            <Route path="roles" element={<PermissionRoute permission={PERMISSIONS.USUARIO_LISTAR} element={<RolesPage />} />} />
            <Route path="integraciones" element={<PermissionRoute permission={PERMISSIONS.INSTITUCION_VER} element={<IntegracionesPage />} />} />
            <Route path="perfil" element={<PerfilPage />} />
          </Route>

          {/* Home → landing / public verify */}
          <Route path="/" element={<VerifyCertificate />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
