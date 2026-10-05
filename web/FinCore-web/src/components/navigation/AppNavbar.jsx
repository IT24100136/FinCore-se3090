import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Activity,
  Layers,
  BarChart3,
  LogOut,
  UserCheck,
  Building,
  KeyRound,
  RotateCcw,
  FileCheck2,
} from 'lucide-react';

export default function AppNavbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't display top navigation on auth pages or if unauthenticated
  const isAuthPage = location.pathname.startsWith('/login') || location.pathname.startsWith('/register');
  if (!isAuthenticated || isAuthPage) {
    return null;
  }

  const isAdmin = user?.role === 'Admin';
  const roleColor = isAdmin ? '#818cf8' : '#34d399';
  const roleBg = isAdmin ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)';
  const roleBorder = isAdmin ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navLinkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: isActive ? '600' : '500',
    color: isActive ? '#38bdf8' : '#94a3b8',
    backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
    border: isActive ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid transparent',
    textDecoration: 'none',
    transition: 'all 0.15s ease',
  });

  return (
    <header style={{
      height: '64px',
      backgroundColor: '#0a0f1d',
      borderBottom: '1px solid #1e293b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
    }}>
      {/* Left: Brand & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div
          onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/analyst/review-queue')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(14, 165, 233, 0.4)',
          }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#f8fafc' }}>
                FinCore
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.08em',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}>
                STAFF PORTAL
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Institutional Fraud Defense Suite
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '1rem' }}>
          {isAdmin ? (
            <>
              <NavLink to="/admin/dashboard" style={navLinkStyle}>
                <Activity size={16} /> Admin Command Center
              </NavLink>
              <NavLink to="/analyst/review-queue" style={navLinkStyle}>
                <Layers size={16} /> Analyst Queue
              </NavLink>
              <NavLink to="/analyst/history" style={navLinkStyle}>
                <FileCheck2 size={16} /> Audit Trail &amp; History
              </NavLink>
              <NavLink to="/admin/reversals" style={navLinkStyle}>
                <RotateCcw size={16} /> Reversal Action
              </NavLink>
              <NavLink to="/admin/analytics" style={navLinkStyle}>
                <BarChart3 size={16} /> Analytics
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/analyst/review-queue" style={navLinkStyle}>
                <Layers size={16} /> Analyst Review Queue
              </NavLink>
              <NavLink to="/analyst/history" style={navLinkStyle}>
                <FileCheck2 size={16} /> Audit Trail &amp; History
              </NavLink>
            </>
          )}
        </nav>
      </div>

      {/* Right: Staff Identity & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Department Tag */}
        {user?.department && (
          <div style={{
            display: 'none',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: '#94a3b8',
            backgroundColor: '#0f172a',
            padding: '5px 10px',
            borderRadius: '6px',
            border: '1px solid #1e293b',
          }} className="md:flex">
            <Building size={13} color="#64748b" />
            <span>{user.department}</span>
          </div>
        )}

        {/* Staff User Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '4px 12px 4px 6px',
          backgroundColor: '#0f172a',
          borderRadius: '30px',
          border: '1px solid #1e293b',
        }}>
          {/* Avatar with Role Initial */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: roleBg,
            border: `1.5px solid ${roleBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '700',
            color: roleColor,
          }}>
            {user?.fullName ? user.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'ST'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>
                {user?.fullName || 'Staff Member'}
              </span>
              <span style={{
                fontSize: '9px',
                fontWeight: '700',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: roleBg,
                color: roleColor,
                border: `1px solid ${roleBorder}`,
              }}>
                {user?.role?.toUpperCase() || 'STAFF'}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
              {user?.employeeId ? `BADGE: ${user.employeeId}` : (user?.email || '')}
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          title="Sign out of FinCore"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
          }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
