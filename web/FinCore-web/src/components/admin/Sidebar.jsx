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
  Activity,
  Layers
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
    <aside className="w-72 bg-[#0B132B] text-white flex flex-col min-h-screen border-r border-slate-800/60 flex-shrink-0 select-none transition-all duration-300">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white font-sans">FinCore</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md">ADMIN</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Enterprise Security Hub</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="px-4 py-6 flex-1 space-y-1.5">
        <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Core Dashboards
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 group-hover:text-blue-400 group-hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="leading-tight">{item.label}</div>
                  <div className={`text-[11px] font-normal ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {item.sublabel}
                  </div>
                </div>
              </div>

              {item.badge ? (
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${item.badgeColor || 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                  {item.badge}
                </span>
              ) : (
                <ChevronRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100 text-white' : 'text-slate-400'}`} />
              )}
            </button>
          );
        })}

        {/* System Health Quick Card */}
        <div className="mt-8 p-4 mx-1 rounded-xl bg-slate-900/90 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              API Gateways
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
              99.98%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            All 4 mobile auth & session nodes active.
          </p>
        </div>
      </div>

      {/* Admin User Footer Profile */}
      <div className="p-4 m-3 rounded-xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
              alt="Admin Avatar"
              className="w-9 h-9 rounded-full object-cover border-2 border-blue-500/40"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0B132B]"></span>
          </div>
          <div>
            <div className="text-xs font-bold text-white leading-tight">{user?.fullName || 'Alex Morgan'}</div>
            <div className="text-[10px] text-slate-400 font-mono">REG: {user?.employeeId || 'ADM-001'}</div>
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
