import React, { useState, useEffect, Component } from 'react';
import {
  Search,
  Filter,
  Download,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  HelpCircle,
  RotateCcw,
  Clock,
  User,
  ExternalLink
} from 'lucide-react';
import { auditService } from '../../services/auditService';

// ============================================================================
// 1. Error Boundary
// ============================================================================
class AuditErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AuditErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-lg border border-red-200 p-8 text-center text-red-800 my-4 shadow-sm">
          <ShieldAlert className="w-10 h-10 text-red-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-2">Audit Trail Display Error</h3>
          <p className="text-xs text-red-700 mb-4">
            An unexpected error occurred while parsing audit records: {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onRetry) this.props.onRetry();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 cursor-pointer"
          >
            Retry Audit Trail
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function safeDateStrings(dateVal) {
  if (!dateVal) return { utc: 'N/A', local: 'N/A' };
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return { utc: String(dateVal), local: String(dateVal) };
    return {
      utc: d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      local: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString()
    };
  } catch (e) {
    return { utc: String(dateVal), local: String(dateVal) };
  }
}

// ============================================================================
// 2. Main Decision & Audit History Table Component
// ============================================================================
function DecisionHistoryTableInner({
  queue,
  items,
  onRefresh,
  onOpenCase,
  fetchLive = true
}) {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [riskTierFilter, setRiskTierFilter] = useState('ALL');

  const loadLiveHistory = async () => {
    setIsLoading(true);
    try {
      const data = await auditService.getAuditHistory();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load audit history:', err);
      if (Array.isArray(items) && items.length > 0) {
        setRecords(items);
      } else if (Array.isArray(queue) && queue.length > 0) {
        setRecords(queue);
      } else {
        setRecords([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (Array.isArray(items) && items.length > 0) {
      setRecords(items);
    } else if (fetchLive) {
      loadLiveHistory();
    } else if (Array.isArray(queue) && queue.length > 0) {
      setRecords(queue);
    }
  }, [items, queue, fetchLive]);

  const handleManualRefresh = async () => {
    if (onRefresh) onRefresh();
    await loadLiveHistory();
  };

  const filteredRecords = records.filter(r => {
    if (!r) return false;

    const actionUpper = String(r.action || r.decision || '').toUpperCase();
    if (actionFilter !== 'ALL') {
      if (!actionUpper.includes(actionFilter)) return false;
    }

    const tierUpper = String(r.riskTier || '').toUpperCase();
    const score = Number(r.riskScore) || 0;
    if (riskTierFilter === 'CRITICAL' && !tierUpper.includes('CRIT') && score < 70) return false;
    if (riskTierFilter === 'HIGH' && !tierUpper.includes('HIGH') && (score < 50 || score >= 70)) return false;
    if (riskTierFilter === 'MEDIUM' && !tierUpper.includes('MED') && (score < 30 || score >= 50)) return false;
    if (riskTierFilter === 'LOW' && !tierUpper.includes('LOW') && score >= 30) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const ref = String(r.referenceId || r.reference || r.txId || r.queueCode || '').toLowerCase();
      const analystName = String(r.primaryAnalystName || r.actor || r.analystName || '').toLowerCase();
      const analystId = String(r.primaryAnalystId || r.actorId || r.analystId || '').toLowerCase();
      const sender = String(r.senderName || r.senderAccountNumber || '').toLowerCase();
      const recipient = String(r.recipientName || r.recipientAccountNo || '').toLowerCase();
      const notes = String(r.notes || r.reason || r.description || '').toLowerCase();

      return (
        ref.includes(q) ||
        analystName.includes(q) ||
        analystId.includes(q) ||
        sender.includes(q) ||
        recipient.includes(q) ||
        notes.includes(q)
      );
    }

    return true;
  });

  const getActionBadgeClass = (rawAction) => {
    const act = String(rawAction || 'PENDING').toUpperCase();
    if (act.includes('APPROV')) {
      return {
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />,
        label: 'Approved'
      };
    }
    if (act.includes('REJECT') || act.includes('BLOCK') || act.includes('FRAUD')) {
      return {
        badgeClass: 'bg-red-50 text-red-600 border-red-200',
        icon: <XCircle className="w-3.5 h-3.5 mr-1" />,
        label: 'Rejected'
      };
    }
    if (act.includes('ESCALAT')) {
      return {
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        icon: <AlertOctagon className="w-3.5 h-3.5 mr-1" />,
        label: 'Escalated'
      };
    }
    if (act.includes('INFO') || act.includes('REVISION')) {
      return {
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: <HelpCircle className="w-3.5 h-3.5 mr-1" />,
        label: 'Info Requested'
      };
    }
    if (act.includes('REVERS')) {
      return {
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: <RotateCcw className="w-3.5 h-3.5 mr-1" />,
        label: 'Reversed'
      };
    }
    return {
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: <Clock className="w-3.5 h-3.5 mr-1" />,
      label: act
    };
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header and Context Banner */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          COMPLIANCE &gt; AUDIT TRAILS
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
          Full Decision History &amp; Governance Audit Trail
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Enterprise regulatory audit log tracking timestamped analyst decisions, risk telemetry, dual maker-checker sign-offs, and compliance justifications stored permanently in PostgreSQL.
        </p>
      </div>

      {/* Toolbar: Search, Filters, Refresh, Export */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Left: Search input & dropdowns */}
        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto flex-1">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reference, analyst, account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
            />
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="APPROV">Approved Only</option>
              <option value="REJECT">Rejected Only</option>
              <option value="ESCALAT">Escalated Only</option>
              <option value="INFO">Info Requested Only</option>
              <option value="REVERS">Reversed Only</option>
            </select>
          </div>

          {/* Risk Tier Filter */}
          <select
            value={riskTierFilter}
            onChange={(e) => setRiskTierFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Risk Tiers</option>
            <option value="CRITICAL">Critical Risk (&ge; 70)</option>
            <option value="HIGH">High Risk (50 - 69)</option>
            <option value="MEDIUM">Medium Risk (30 - 49)</option>
            <option value="LOW">Low Risk (&lt; 30)</option>
          </select>
        </div>

        {/* Right: Refresh & CSV Export */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>

          <button
            onClick={() => auditService.exportAuditToCsv(filteredRecords)}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <div className="text-sm font-semibold text-gray-800">Querying PostgreSQL Audit Log Records...</div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-16 text-center text-gray-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No audit history available</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {records.length === 0
                ? 'No compliance audit records or decision logs found in database.'
                : 'No audit records match the current filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Actor / Analyst</th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Transaction / Reference</th>
                  <th className="px-6 py-3.5">Status Transition</th>
                  <th className="px-6 py-3.5">Risk Info</th>
                  <th className="px-6 py-3.5">Dual Approver</th>
                  <th className="px-6 py-3.5">Description / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredRecords.map((r, idx) => {
                  const dateInfo = safeDateStrings(r.timestamp || r.decidedAt);
                  const badge = getActionBadgeClass(r.action || r.decision);
                  const score = Number(r.riskScore) || 0;
                  const rawAmount = Number(r.amount) || 0;
                  const reference = r.referenceId || r.reference || r.queueCode || r.txId || 'N/A';
                  const prevStatus = r.previousStatus || 'Queued';
                  const newStatus = r.newStatus || r.status || badge.label;
                  const actorName = r.primaryAnalystName || r.actor || 'Compliance Analyst';
                  const actorId = r.primaryAnalystId || r.actorId || 'ANL-001';
                  const secApprover = r.secondaryApproverName || 'N/A - Single Approval';
                  const notes = r.notes || r.reason || r.description || 'Compliance verification completed.';

                  return (
                    <tr
                      key={r.id || idx}
                      onClick={onOpenCase ? () => onOpenCase(r) : undefined}
                      className="border-b border-gray-100 hover:bg-slate-50 transition-colors"
                    >
                      {/* 1. Timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-mono font-semibold text-xs text-gray-900">
                          {dateInfo.utc}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Local: {dateInfo.local}
                        </div>
                      </td>

                      {/* 2. Actor */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-bold text-xs text-gray-900">{actorName}</span>
                        </div>
                        <div className="font-mono text-[11px] text-gray-400 pl-5 mt-0.5">
                          {actorId}
                        </div>
                      </td>

                      {/* 3. Action */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-flex items-center ${badge.badgeClass}`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>

                      {/* 4. Reference & Amount */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono font-bold text-xs text-blue-600">
                          <span>{reference}</span>
                          {onOpenCase && <ExternalLink className="w-3 h-3 opacity-70" />}
                        </div>
                        {rawAmount > 0 && (
                          <div className="font-bold text-xs text-gray-900 mt-0.5">
                            Rs. {rawAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>

                      {/* 5. Status Transition */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            {prevStatus}
                          </span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className={`px-2 py-0.5 rounded font-bold border ${badge.badgeClass}`}>
                            {newStatus}
                          </span>
                        </div>
                      </td>

                      {/* 6. Risk Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900">{score}/100</span>
                          <div className="w-12 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${score >= 70 ? 'bg-red-600' : score >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 7. Dual Approver */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-xs ${secApprover.includes('N/A') ? 'text-gray-400 font-normal' : 'text-purple-700 font-bold'}`}>
                          {secApprover}
                        </span>
                      </td>

                      {/* 8. Notes */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-xs text-gray-700 line-clamp-2" title={notes}>
                          {notes}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
          <span>
            Showing <strong className="text-gray-900">{filteredRecords.length}</strong> of <strong className="text-gray-900">{records.length}</strong> compliance audit events
          </span>
          <span className="text-[11px] text-gray-400">
            All records cryptographically traced in PostgreSQL
          </span>
        </div>
      </div>

    </div>
  );
}

export default function DecisionHistoryTable(props) {
  return (
    <AuditErrorBoundary onRetry={props.onRefresh}>
      <DecisionHistoryTableInner {...props} />
    </AuditErrorBoundary>
  );
}
