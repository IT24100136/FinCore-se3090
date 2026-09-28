import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle2, 
  Sparkles,
  Clock
} from 'lucide-react';

export default function Header({ activeView, searchQuery, setSearchQuery, onRefresh, isRefreshing }) {
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
    <header className="bg-white border-b border-slate-200/80 px-8 py-4 shadow-sm sticky top-0 z-20">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Welcome Greeting & Active View Title */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
              Welcome, Admin
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="w-3 h-3 text-blue-600" />
              FinCore v2.4 Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
            <span className="font-medium text-slate-700">{getViewTitle()}</span>
            <span className="text-slate-300">•</span>
            <span>iOS & FinTech Operations Console</span>
          </p>
        </div>

        {/* Action Controls & Search */}
        <div className="flex items-center gap-3">
          {/* Global Search Bar */}
          <div className="relative w-64 md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search users, IPs, fingerprints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Real-time Data"
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-blue-600 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* System Time Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-mono shadow-sm">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentTime || '12:00:00'}</span>
          </div>

          {/* System Live Operational Status */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-medium shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Live</span>
          </div>

          {/* Notifications Bell Button */}
          <button 
            title="System Alerts"
            className="relative p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
          >
            <Bell className="w-4 h-4 text-slate-700" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
              3
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
