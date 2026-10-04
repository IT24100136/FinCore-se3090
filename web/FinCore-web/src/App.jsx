import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppNavbar from './components/navigation/AppNavbar';
import AuthPage from './pages/auth/AuthPage';
import AnalystReviewPage from './pages/AnalystReviewPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import TransactionMonitoringDashboard from './pages/admin/TransactionMonitoringDashboard';
import AnalyticsSummaryPage from './pages/admin/AnalyticsSummaryPage';
import FinancialReversalsPage from './pages/admin/FinancialReversalsPage';

function AuthRouteWrapper({ mode }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) {
    const dest = user?.role === 'Admin' ? '/admin/dashboard' : '/analyst/review-queue';
    return <Navigate to={dest} replace />;
  }
  return <AuthPage defaultMode={mode} />;
}

function RootRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return user?.role === 'Admin' ? (
    <Navigate to="/admin/dashboard" replace />
  ) : (
    <Navigate to="/analyst/review-queue" replace />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div style={{ width: '100%', minHeight: '100vh', margin: 0, padding: 0, backgroundColor: '#090d16' }}>
          {/* Institutional Top Navbar */}
          <AppNavbar />

          {/* Route Configuration */}
          <Routes>
            {/* Unified Auth Routes */}
            <Route path="/login" element={<AuthRouteWrapper mode="login" />} />
            <Route path="/auth/login" element={<Navigate to="/login" replace />} />
            <Route path="/register" element={<AuthRouteWrapper mode="register" />} />
            <Route path="/auth/register" element={<Navigate to="/register" replace />} />

            {/* Smart Root Redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Admin Domain Routes (Strict Admin Role) */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/transactions"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <TransactionMonitoringDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reversals"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <FinancialReversalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <AnalyticsSummaryPage />
                </ProtectedRoute>
              }
            />

            {/* Analyst Review Domain Routes (Analyst + Admin permitted) */}
            <Route
              path="/analyst/review-queue"
              element={
                <ProtectedRoute allowedRoles={['Analyst', 'Admin']}>
                  <AnalystReviewPage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all redirect to Root */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;