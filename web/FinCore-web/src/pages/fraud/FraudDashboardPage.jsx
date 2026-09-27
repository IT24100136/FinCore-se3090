import React, { useState } from 'react';
import RuleConfigurationPanel from '../../components/fraud/RuleConfigurationPanel';
import FraudFlagList from '../../components/fraud/FraudFlagList';
import FlagDetailBreakdown from '../../components/fraud/FlagDetailBreakdown';
import FlaggingTrendsDashboard from '../../components/fraud/FlaggingTrendsDashboard';
import {
  Flag,
  Sliders,
  TrendingUp,
  Inbox,
  FileText,
  Search,
  Bell,
  ShieldAlert,
  BarChart3,
  RotateCcw,
  FileCheck2
} from 'lucide-react';

export default function FraudDashboardPage({ initialTab = 'flags' }) {
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
    // Optionally update or trigger refresh
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#f1f5f9', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>

      {/* 1. Left Dark Navy Sidebar (#091124 / #1A233A) */}
      <aside style={{
        width: '250px',
        backgroundColor: '#091124',
        color: '#94a3b8',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderRight: '1px solid #1e293b'
      }}>
        {/* Brand */}
        <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #1e293b' }}>
          <div style={{
            backgroundColor: '#2563eb',
            color: '#fff',
            fontWeight: 800,
            padding: '7px 11px',
            borderRadius: '8px',
            fontSize: '15px',
            boxShadow: '0 2px 6px rgba(37,99,235,0.4)'
          }}>
            FC
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', letterSpacing: '0.4px' }}>FinCore</div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, letterSpacing: '0.8px' }}>FRAUD INTELLIGENCE</div>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav style={{ padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', padding: '0 12px 8px', letterSpacing: '0.6px' }}>
            FRAUD ENGINE
          </div>

          {/* Fraud Flags Tab */}
          <button
            onClick={() => setActiveTab('flags')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              color: activeTab === 'flags' || activeTab === 'flag-detail' ? '#fff' : '#94a3b8',
              backgroundColor: activeTab === 'flags' || activeTab === 'flag-detail' ? '#2563eb' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              width: '100%',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Flag size={18} /> Fraud Flags
            </div>
            <span style={{
              backgroundColor: activeTab === 'flags' ? '#1d4ed8' : '#dc2626',
              color: '#fff',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 700
            }}>
              LIVE
            </span>
          </button>

          {/* Rule Configuration Tab */}
          <button
            onClick={() => setActiveTab('rules')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              color: activeTab === 'rules' ? '#fff' : '#94a3b8',
              backgroundColor: activeTab === 'rules' ? '#2563eb' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              width: '100%',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <Sliders size={18} /> Rule Configuration
          </button>

          {/* Flagging Trends Dashboard Tab */}
          <button
            onClick={() => setActiveTab('trends')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              color: activeTab === 'trends' ? '#fff' : '#94a3b8',
              backgroundColor: activeTab === 'trends' ? '#2563eb' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              width: '100%',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <TrendingUp size={18} /> Trends &amp; Analytics
          </button>

          {activeTab === 'flag-detail' && selectedFlag && (
            <div style={{ marginTop: '8px', padding: '10px 12px', backgroundColor: '#070c18', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Active Inspection</div>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>
                {selectedFlag.transactionId}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Score: {selectedFlag.riskScore}/100
              </div>
            </div>
          )}
        </nav>

        {/* User Profile Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700
          }}>
            AN
          </div>
          <div>
            <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 600 }}>Fraud Specialist</div>
            <div style={{ color: '#64748b', fontSize: '11px' }}>ID: USR-11111111</div>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Workspace */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top Header Bar */}
        <header style={{
          height: '56px',
          backgroundColor: '#0d1527',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 32px',
          flexShrink: 0
        }}>
          {/* Global Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#070c18',
            padding: '6px 14px',
            borderRadius: '8px',
            border: '1px solid #1e293b',
            width: '360px'
          }}>
            <Search size={15} color="#64748b" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rule ID, TX code, IP, reason..."
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '12px',
                outline: 'none',
                width: '100%',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Right Header Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: '#10b981',
              fontWeight: 600,
              backgroundColor: '#064e3b26',
              padding: '5px 12px',
              borderRadius: '16px',
              border: '1px solid #10b98133'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
              Scoring Engine: Live
            </div>

            <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Scrollable Main Content Area */}
        <div style={{ padding: '28px 36px', flex: 1, overflowY: 'auto' }}>
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
