import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import RuleConfigurationPanel from '../../components/fraud/RuleConfigurationPanel';
import FraudFlagList from '../../components/fraud/FraudFlagList';
import FlagDetailBreakdown from '../../components/fraud/FlagDetailBreakdown';
import FlaggingTrendsDashboard from '../../components/fraud/FlaggingTrendsDashboard';
import {
  Flag,
  Sliders,
  TrendingUp,
  Search,
  Bell
} from 'lucide-react';

export default function FraudDashboardPage({ initialTab = 'flags' }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab); // 'flags' | 'rules' | 'trends' | 'flag-detail'
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectFlag = (flag) => {
    setSelectedFlag(flag);
    setActiveTab('flag-detail');
  };

  const handleBackToFlags = () => {
    setActiveTab('flags');
  };

  const handleDecisionSubmitted = (flagId, decision, notes) => {
    // Refresh handler if needed
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans text-gray-900">

      {/* 1. Left Dark Navy Sidebar (bg-slate-900) */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 min-h-screen select-none">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md shadow-blue-600/30">
            FC
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-white">FinCore</div>
            <div className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">FRAUD INTELLIGENCE</div>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="p-3 flex flex-col gap-1 flex-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2 mt-2">
            FRAUD ENGINE
          </div>

          {/* Fraud Flags Tab */}
          <button
            onClick={() => setActiveTab('flags')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'flags' || activeTab === 'flag-detail'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Flag className="w-4 h-4" /> Fraud Flags
            </div>
            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              LIVE
            </span>
          </button>

          {/* Rule Configuration Tab */}
          <button
            onClick={() => setActiveTab('rules')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" /> Rule Configuration
          </button>

          {/* Flagging Trends Tab */}
          <button
            onClick={() => setActiveTab('trends')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'trends'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Trends &amp; Analytics
          </button>

          {activeTab === 'flag-detail' && selectedFlag && (
            <div className="mt-3 p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Active Inspection</div>
              <div className="text-white font-bold font-mono mt-0.5 truncate">
                {selectedFlag.transactionId}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Score: {selectedFlag.riskScore}/100
              </div>
            </div>
          )}
        </nav>

        {/* User Profile Footer */}
        <div className="p-3 m-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
            {user?.fullName ? user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AN'}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-100">{user?.fullName || 'Fraud Specialist'}</div>
            <div className="text-[10px] text-slate-400 font-mono">BADGE: {user?.employeeId || 'ANL-001'}</div>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen bg-slate-50 overflow-hidden">

        {/* Top Header Bar */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
          {/* Global Search Bar */}
          <div className="flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg w-80">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rule ID, TX code, IP..."
              className="bg-transparent border-none text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-full"
            />
          </div>

          {/* Right Header Status Badges */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Scoring Engine: Live
            </div>

            <div className="text-slate-400 text-xs font-medium">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Scrollable Main Workspace */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto bg-slate-50">
          {activeTab === 'flags' && (
            <FraudFlagList
              onSelectFlag={handleSelectFlag}
              onOpenTrends={() => setActiveTab('trends')}
              onOpenRules={() => setActiveTab('rules')}
            />
          )}

          {activeTab === 'flag-detail' && (
            <FlagDetailBreakdown
              flag={selectedFlag}
              onBack={handleBackToFlags}
              onDecisionSubmitted={handleDecisionSubmitted}
              onNavigateToCase={(caseId) => {
                window.location.href = `/analyst/review-queue?tab=case-detail&caseId=${encodeURIComponent(caseId)}`;
              }}
            />
          )}

          {activeTab === 'rules' && (
            <RuleConfigurationPanel />
          )}

          {activeTab === 'trends' && (
            <FlaggingTrendsDashboard
              onNavigateToRules={() => setActiveTab('rules')}
              onNavigateToFlags={() => setActiveTab('flags')}
            />
          )}
        </div>

      </main>

    </div>
  );
}
