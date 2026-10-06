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
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 text-gray-900 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>PostgreSQL Regulatory Audit Stream Active</span>
          </div>
        </div>

        {/* Quick KPI Stat Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
          {/* Card 1: Total Audit Events */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Audited Decisions</span>
              <FileCheck2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-2">
              {stats.total}
            </div>
          </div>

          {/* Card 2: Approved Decisions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Approved Transactions</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-emerald-600 mt-2">
              {stats.approved}
            </div>
          </div>

          {/* Card 3: Rejected / Blocked */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Blocked Fraud / Rejected</span>
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-red-600 mt-2">
              {stats.rejected}
            </div>
          </div>

          {/* Card 4: Escalations */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Senior Escalations</span>
              <AlertOctagon className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-purple-600 mt-2">
              {stats.escalated}
            </div>
          </div>

          {/* Card 5: Mean Risk */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mean Case Risk Score</span>
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-amber-600 mt-2">
              {stats.avgScore} <span className="text-xs font-semibold text-gray-400">/ 100</span>
            </div>
          </div>
        </div>

        {/* The Decision History Table */}
        <DecisionHistoryTable
          fetchLive={true}
          onRefresh={loadStats}
          onOpenCase={(r) => {
            const targetId = r.queueCode || r.referenceId || r.transactionId || r.id;
            if (targetId) {
              navigate(`/analyst/cases/${encodeURIComponent(targetId)}`);
            }
          }}
        />

      </div>
    </div>
  );
}
