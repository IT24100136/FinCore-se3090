import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  BarChart3, 
  Users, 
  Smartphone, 
  Bell, 
  ShieldCheck, 
  ChevronRight,
  LogOut,
  Activity
} from 'lucide-react';

export default function Sidebar({ activeView, setActiveView, flaggedCount = 24 }) {
  const { user, logout } = useAuth();
  const navItems = [
    {
      id: 'analytics',
      label: 'Analytics',
      sublabel: 'Device & performance',
      icon: BarChart3,
      badge: null
    },
    {
      id: 'users',
      label: 'User Management',
      sublabel: 'Accounts & access',
      icon: Users,
      badge: null
    },
    {
      id: 'devices',
      label: 'Device History',
      sublabel: 'Session fingerprints',
      icon: Smartphone,
      badge: flaggedCount > 0 ? `${flaggedCount} Flagged` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    {
      id: 'notifications',
      label: 'Notification Logs',
      sublabel: 'SMS & Email records',
      icon: Bell,
      badge: null
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 min-h-screen select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md shadow-blue-600/30">
          FC
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-white font-sans">FinCore</span>
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full">ADMIN</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Security Command Center</p>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="px-3 py-4 flex-1 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-2 mt-2">
          CORE DASHBOARDS
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <div className="text-left">
                  <div className="leading-tight text-xs font-semibold">{item.label}</div>
                  <div className={`text-[10px] font-normal ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {item.sublabel}
                  </div>
                </div>
              </div>

              {item.badge ? (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.badgeColor || 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                  {item.badge}
                </span>
              ) : (
                <ChevronRight className={`w-4 h-4 transition-opacity ${isActive ? 'opacity-100 text-white' : 'opacity-40 text-slate-400'}`} />
              )}
            </button>
          );
        })}

        {/* System Health Card */}
        <div className="mt-6 p-4 rounded-lg bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              API Gateway
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
              99.98%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            All nodes operating under normal parameters.
          </p>
        </div>
      </div>

      {/* Admin User Footer Profile */}
      <div className="p-3 m-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            {user?.fullName ? user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AD'}
          </div>
          <div>
            <div className="text-xs font-bold text-white leading-tight">{user?.fullName || 'Administrator'}</div>
            <div className="text-[10px] text-slate-400 font-mono">BADGE: {user?.employeeId || 'ADM-001'}</div>
          </div>
        </div>
        <button 
          onClick={logout}
          title="Sign Out"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
