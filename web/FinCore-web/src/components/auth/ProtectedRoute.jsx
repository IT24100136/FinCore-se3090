import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Loader2, ArrowLeft, LogOut } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, isLoading, hasRole, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  const fallbackDestination = user?.role === 'Admin' ? '/admin/dashboard' : '/analyst/review-queue';

  useEffect(() => {
    let timer;
    if (isAuthenticated && allowedRoles && !hasRole(allowedRoles)) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate(fallbackDestination, { replace: true });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isAuthenticated, allowedRoles, user]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#090d16',
        color: '#94a3b8'
      }}>
        <Loader2 className="animate-spin" size={42} color="#38bdf8" />
        <p style={{ marginTop: '1rem', fontSize: '0.95rem', letterSpacing: '0.05em' }}>
          Verifying security authorization...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page and remember return location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#090d16',
        padding: '2rem'
      }}>
        <div style={{
          maxWidth: '520px',
          width: '100%',
          backgroundColor: '#0f172a',
          border: '1px solid #ef4444',
          borderRadius: '16px',
          padding: '2.5rem',
          textAlign: 'center',
          boxShadow: '0 20px 40px -15px rgba(239, 68, 68, 0.2)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 1.5rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldAlert size={36} color="#ef4444" />
          </div>
          <h2 style={{ color: '#f8fafc', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
            Access Restricted
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1rem' }}>
            Your account role (<span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{user?.role || 'Staff'}</span>) does not have authorization to access this management domain. Requires: <span style={{ color: '#fbbf24', fontWeight: '600' }}>{allowedRoles.join(' or ')}</span>.
          </p>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.85rem',
            color: '#64748b',
            marginBottom: '1.5rem'
          }}>
            Redirecting to your authorized workspace in <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{countdown}s</span>...
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => navigate(fallbackDestination, { replace: true })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Return to Workspace
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid #ef444440',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
