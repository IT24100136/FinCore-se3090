import React, { useState } from 'react';
import TransactionMonitoringDashboard from './TransactionMonitoringDashboard';
import RuleConfigurationPanel from '../../components/fraud/RuleConfigurationPanel';
import FinCoreAdminDashboard from '../../components/admin/FinCoreAdminDashboard';
import AnalyticsSummaryPage from './AnalyticsSummaryPage';
import { Activity, Sliders, Users, BarChart3, ShieldCheck } from 'lucide-react';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'rules' | 'users-devices' | 'analytics'

  const tabs = [
    { id: 'transactions', label: 'Transaction Monitoring & Reversals', icon: Activity },
    { id: 'rules', label: 'Rule Configuration', icon: Sliders },
    { id: 'users-devices', label: 'Users & Device Control', icon: Users },
    { id: 'analytics', label: 'System Analytics', icon: BarChart3 },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Sub-Header Tabs */}
      <div style={{
        backgroundColor: '#0d1527',
        borderBottom: '1px solid #1e293b',
        padding: '0 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
          }}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f1f5f9', letterSpacing: '0.02em' }}>
              ADMIN COMMAND SUITE
            </span>
            <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#64748b' }}>
              Tier-1 Supervisory Authorization
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? '600' : '500',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace View */}
      <div style={{ flex: 1 }}>
        {activeTab === 'transactions' && (
          <TransactionMonitoringDashboard />
        )}
        {activeTab === 'rules' && (
          <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
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
