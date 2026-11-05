// Route table and access guards; run from frontend with `npm run dev`.

import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell from './layouts/AppShell';
import AdminUsers from './pages/admin/AdminUsers';
import CitizenPortal from './pages/citizen/CitizenPortal';
import LoginPage from './pages/auth/LoginPage';
import Dashboard from './pages/officer/Dashboard';
import GrievanceDetails from './pages/officer/GrievanceDetails';
import './styles.css';

function ProtectedRoute({ children }) {
  // Wait for session restoration before redirecting unauthenticated users.
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <span className="spinner-border spinner-border-sm" role="status" />
        <span>Checking your session…</span>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  // Keep the user-management page limited to administrators.
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? children : <Navigate to="/dashboard" replace />;
}

function ApplicationRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CitizenPortal />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="grievances/:referenceId" element={<GrievanceDetails />} />
        <Route
          path="users"
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  // Provide shared authentication state to every route.
  return (
    <AuthProvider>
      <ApplicationRoutes />
    </AuthProvider>
  );
}
