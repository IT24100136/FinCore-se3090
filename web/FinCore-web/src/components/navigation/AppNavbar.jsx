import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Activity,
  Layers,
  BarChart3,
  LogOut,
  Building,
  RotateCcw,
  FileCheck2,
  Bell,
  Search
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

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const getNavLinkClass = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
      isActive
        ? 'bg-blue-600 text-white font-semibold shadow-sm'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'
    }`;

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-50 shadow-md">
      {/* Left: Brand & Navigation */}
      <div className="flex items-center gap-6">
        <div
          onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/analyst/review-queue')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm shadow-blue-500/30 group-hover:bg-blue-500 transition-colors">
            FC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">FinCore</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                STAFF PORTAL
              </span>
            </div>
            <div className="text-[10px] font-medium text-slate-400 tracking-wide">
              FRAUD INTELLIGENCE
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 ml-2">
          {isAdmin ? (
            <>
              <NavLink to="/admin/dashboard" className={getNavLinkClass}>
                <Activity className="w-4 h-4" /> Admin Console
              </NavLink>
              <NavLink to="/analyst/review-queue" className={getNavLinkClass}>
                <Layers className="w-4 h-4" /> Analyst Queue
              </NavLink>
              <NavLink to="/analyst/history" className={getNavLinkClass}>
                <FileCheck2 className="w-4 h-4" /> Audit Trail
              </NavLink>
              <NavLink to="/admin/reversals" className={getNavLinkClass}>
                <RotateCcw className="w-4 h-4" /> Reversal Action
              </NavLink>
              <NavLink to="/admin/analytics" className={getNavLinkClass}>
                <BarChart3 className="w-4 h-4" /> Analytics
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/analyst/review-queue" className={getNavLinkClass}>
                <Layers className="w-4 h-4" /> Review Queue
              </NavLink>
              <NavLink to="/analyst/history" className={getNavLinkClass}>
                <FileCheck2 className="w-4 h-4" /> Audit Trail &amp; History
              </NavLink>
            </>
          )}
        </nav>
      </div>

      {/* Right: Status Pills & Profile */}
      <div className="flex items-center gap-4">
        {/* Status Pills */}
        <div className="hidden md:flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 bg-sky-950/60 border border-sky-500/30 px-3 py-1 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            Live Production
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            AI Pipeline: Operational
          </div>
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-2.5 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            {user?.fullName ? user.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'ST'}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-100">
              {user?.fullName || 'Staff Member'}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isAdmin
                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {user?.role?.toUpperCase() || 'ANALYST'}
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          title="Sign out of FinCore"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/60 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
