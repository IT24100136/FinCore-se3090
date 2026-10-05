import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  TrendingUp,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import DecisionHistoryTable from '../components/analyst/DecisionHistoryTable';
import { auditService } from '../services/auditService';

export default function AuditTrailsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    rejected: 0,
    escalated: 0,
    avgScore: 0
  });

  const loadStats = async () => {
    try {
      const records = await auditService.getAuditHistory();
      if (Array.isArray(records)) {
        const approved = records.filter(r => (r.action || '').toUpperCase().includes('APPROV')).length;
        const rejected = records.filter(r => (r.action || '').toUpperCase().includes('REJECT')).length;
        const escalated = records.filter(r => (r.action || '').toUpperCase().includes('ESCALAT')).length;
        const avg = records.length > 0
          ? Math.round(records.reduce((acc, r) => acc + (Number(r.riskScore) || 0), 0) / records.length)
          : 0;
        setStats({
          total: records.length,
          approved,
          rejected,
          escalated,
          avgScore: avg
        });
      }
    } catch (e) {
      console.warn('Could not load audit stats:', e);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      backgroundColor: '#f8fafc',
      padding: '24px 32px',
      color: '#0f172a'
    }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Navigation Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
            <ShieldCheck size={14} color="#16a34a" />
            <span>PostgreSQL Regulatory Audit Stream Active</span>
          </div>
        </div>

        {/* Quick KPI Stat Ribbon */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          {/* Card 1: Total Audit Events */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Total Audited Decisions</span>
              <FileCheck2 size={18} color="#2563eb" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
              {stats.total}
            </div>
          </div>

          {/* Card 2: Approved Decisions */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Approved Transactions</span>
              <CheckCircle2 size={18} color="#16a34a" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: '6px' }}>
              {stats.approved}
            </div>
          </div>

          {/* Card 3: Rejected / Blocked */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Blocked Fraud / Rejected</span>
              <XCircle size={18} color="#dc2626" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', marginTop: '6px' }}>
              {stats.rejected}
            </div>
          </div>

          {/* Card 4: Escalations */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Senior Escalations</span>
              <AlertOctagon size={18} color="#7c3aed" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c3aed', marginTop: '6px' }}>
              {stats.escalated}
            </div>
          </div>

          {/* Card 5: Mean Risk */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Mean Case Risk Score</span>
              <TrendingUp size={18} color="#d97706" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>
              {stats.avgScore} <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>/ 100</span>
            </div>
          </div>
        </div>

        {/* The Decision History Table */}
        <DecisionHistoryTable
          fetchLive={true}
          onRefresh={loadStats}
        />

      </div>
    </div>
  );
}
