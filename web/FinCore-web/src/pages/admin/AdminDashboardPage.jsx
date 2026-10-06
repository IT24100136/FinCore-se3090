import React, { useState } from 'react';
import TransactionMonitoringDashboard from './TransactionMonitoringDashboard';
import FinancialReversalsPage from './FinancialReversalsPage';
import RuleConfigurationPanel from '../../components/fraud/RuleConfigurationPanel';
import FinCoreAdminDashboard from '../../components/admin/FinCoreAdminDashboard';
import AnalyticsSummaryPage from './AnalyticsSummaryPage';
import { Activity, RotateCcw, Sliders, Users, BarChart3, ShieldCheck } from 'lucide-react';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'reversals' | 'rules' | 'users-devices' | 'analytics'

  const tabs = [
    { id: 'transactions', label: 'Transaction Monitoring', icon: Activity },
    { id: 'reversals', label: 'Financial Reversals', icon: RotateCcw },
    { id: 'rules', label: 'Rule Configuration', icon: Sliders },
    { id: 'users-devices', label: 'Users & Device Control', icon: Users },
    { id: 'analytics', label: 'System Analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans">
      {/* Sub-Header Tabs matching dark theme */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 py-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 tracking-wider uppercase">
              ADMIN COMMAND SUITE
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Tier-1 Supervisory Authorization
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace View */}
      <div className="flex-1 bg-slate-50">
        {activeTab === 'transactions' && (
          <TransactionMonitoringDashboard />
        )}
        {activeTab === 'reversals' && (
          <FinancialReversalsPage />
        )}
        {activeTab === 'rules' && (
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <RuleConfigurationPanel />
          </div>
        )}
        {activeTab === 'users-devices' && (
          <FinCoreAdminDashboard />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsSummaryPage />
        )}
      </div>
    </div>
  );
}
