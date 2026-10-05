import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  RefreshCw, 
  Clock,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Header({ activeView, searchQuery, setSearchQuery, onRefresh, isRefreshing }) {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getViewTitle = () => {
    switch (activeView) {
      case 'analytics':
        return 'Device Analytics Dashboard';
      case 'users':
        return 'User Management Panel';
      case 'devices':
        return 'Device & Session History Viewer';
      case 'notifications':
        return 'Notification Log Viewer';
      default:
        return 'Admin Dashboard';
    }
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center justify-between w-full gap-4">
        {/* Welcome Greeting & Active View Title */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight font-sans">
              {getViewTitle()}
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Sparkles className="w-3 h-3 text-sky-400" />
              FinCore v2.4 Live
            </span>
          </div>
        </div>

        {/* Action Controls & Search */}
        <div className="flex items-center gap-3">
          {/* Global Search Bar */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search users, IPs, fingerprints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Pills */}
          <div className="hidden md:flex items-center gap-2">
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
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60">
            <span className="text-xs font-semibold text-slate-200">
              {user?.fullName || 'Admin'}
            </span>
            <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold text-[10px] px-2 py-0.5 rounded-full">
              {user?.role?.toUpperCase() || 'ADMIN'}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Real-time Data"
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950/80 hover:bg-slate-800 text-slate-300 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
