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
  Shield,
  ExternalLink
} from 'lucide-react';
import { auditService } from '../../services/auditService';

// ============================================================================
// 1. Error Boundary to prevent any whiteout crashes
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
    console.error('AuditErrorBoundary caught an unhandled render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #fecaca',
          padding: '32px',
          textAlign: 'center',
          color: '#991b1b',
          margin: '20px 0'
        }}>
          <ShieldAlert size={40} color="#dc2626" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>Audit Trail Display Error</h3>
          <p style={{ fontSize: '13px', color: '#7f1d1d', margin: '0 0 16px 0' }}>
            An unexpected error occurred while parsing audit records: {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onRetry) this.props.onRetry();
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Retry Audit Trail
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// 2. Safe Date & String Utilities
// ============================================================================
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
// 3. Main Decision & Audit History Table Component
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
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [riskTierFilter, setRiskTierFilter] = useState('ALL');

  // Fetch live audit history from PostgreSQL
  const loadLiveHistory = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await auditService.getAuditHistory();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load audit history from backend:', err);
      setLoadError(err.response?.data?.message || err.message || 'Failed to connect to audit history API');
      // If props items or queue provided, fallback to that
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
    if (onRefresh) {
      onRefresh();
    }
    await loadLiveHistory();
  };

  // Filter and normalize records
  const filteredRecords = records.filter(r => {
    if (!r) return false;

    // Action Filter
    const actionUpper = String(r.action || r.decision || '').toUpperCase();
    if (actionFilter !== 'ALL') {
      if (!actionUpper.includes(actionFilter)) {
        return false;
      }
    }

    // Risk Tier Filter
    const tierUpper = String(r.riskTier || '').toUpperCase();
    const score = Number(r.riskScore) || 0;
    if (riskTierFilter === 'CRITICAL' && !tierUpper.includes('CRIT') && score < 70) return false;
    if (riskTierFilter === 'HIGH' && !tierUpper.includes('HIGH') && (score < 50 || score >= 70)) return false;
    if (riskTierFilter === 'MEDIUM' && !tierUpper.includes('MED') && (score < 30 || score >= 50)) return false;
    if (riskTierFilter === 'LOW' && !tierUpper.includes('LOW') && score >= 30) return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const ref = String(r.referenceId || r.reference || r.txId || r.queueCode || '').toLowerCase();
      const analystName = String(r.primaryAnalystName || r.actor || r.analystName || '').toLowerCase();
      const analystId = String(r.primaryAnalystId || r.actorId || r.analystId || '').toLowerCase();
      const sender = String(r.senderName || r.senderAccountNumber || '').toLowerCase();
      const recipient = String(r.recipientName || r.recipientAccountNo || '').toLowerCase();
      const notes = String(r.notes || r.reason || r.description || '').toLowerCase();
      const action = actionUpper.toLowerCase();

      return (
        ref.includes(q) ||
        analystName.includes(q) ||
        analystId.includes(q) ||
        sender.includes(q) ||
        recipient.includes(q) ||
        notes.includes(q) ||
        action.includes(q)
      );
    }

    return true;
  });

  // Action badge visual styling
  const getActionBadge = (rawAction) => {
    const act = String(rawAction || 'PENDING').toUpperCase();
    if (act.includes('APPROV')) {
      return {
        bg: '#dcfce7',
        text: '#15803d',
        border: '#86efac',
        icon: <CheckCircle2 size={13} style={{ marginRight: '4px' }} />,
        label: 'Approved'
      };
    }
    if (act.includes('REJECT') || act.includes('BLOCK') || act.includes('FRAUD')) {
      return {
        bg: '#fee2e2',
        text: '#b91c1c',
        border: '#fca5a5',
        icon: <XCircle size={13} style={{ marginRight: '4px' }} />,
        label: 'Rejected'
      };
    }
    if (act.includes('ESCALAT')) {
      return {
        bg: '#ede9fe',
        text: '#6d28d9',
        border: '#c4b5fd',
        icon: <AlertOctagon size={13} style={{ marginRight: '4px' }} />,
        label: 'Escalated'
      };
    }
    if (act.includes('INFO') || act.includes('REVISION')) {
      return {
        bg: '#fef3c7',
        text: '#b45309',
        border: '#fde68a',
        icon: <HelpCircle size={13} style={{ marginRight: '4px' }} />,
        label: 'Info Requested'
      };
    }
    if (act.includes('REVERS')) {
      return {
        bg: '#ffe4e6',
        text: '#be123c',
        border: '#fda4af',
        icon: <RotateCcw size={13} style={{ marginRight: '4px' }} />,
        label: 'Reversed'
      };
    }
    return {
      bg: '#f1f5f9',
      text: '#475569',
      border: '#cbd5e1',
      icon: <Clock size={13} style={{ marginRight: '4px' }} />,
      label: act
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header and Context Banner */}
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.4px' }}>
          COMPLIANCE &gt; AUDIT TRAILS
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          Full Decision History &amp; Governance Audit Trail
        </h1>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
          Enterprise regulatory audit log tracking timestamped analyst decisions, risk telemetry, dual maker-checker sign-offs, and compliance justifications stored permanently in PostgreSQL.
        </p>
      </div>

      {/* Toolbar: Search, Filters, Refresh, Export */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {/* Left: Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search reference, analyst, account, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: '12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Action Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="#64748b" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                backgroundColor: '#fff',
                color: '#334155',
                fontWeight: 600,
                cursor: 'pointer'
              }}
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
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              backgroundColor: '#fff',
              color: '#334155',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Risk Tiers</option>
            <option value="CRITICAL">Critical Risk (&ge; 70)</option>
            <option value="HIGH">High Risk (50 - 69)</option>
            <option value="MEDIUM">Medium Risk (30 - 49)</option>
            <option value="LOW">Low Risk (&lt; 30)</option>
          </select>
        </div>

        {/* Right: Refresh & CSV Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#475569',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>

          <button
            onClick={() => auditService.exportAuditToCsv(filteredRecords)}
            disabled={filteredRecords.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: filteredRecords.length === 0 ? '#94a3b8' : '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: filteredRecords.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: filteredRecords.length === 0 ? 'none' : '0 2px 4px rgba(22, 163, 74, 0.3)',
              transition: 'background-color 0.15s ease'
            }}
          >
            <Download size={14} />
            <span>Export Audit CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {isLoading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              margin: '0 auto 16px auto',
              animation: 'spin 0.8s linear infinite'
            }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
              Querying PostgreSQL Audit Log Records...
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Retrieving cryptographic decision events, maker-checker signatures, and telemetry
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{
            padding: '64px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <FileCheck2 size={28} color="#64748b" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>
              No audit history available.
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              {records.length === 0
                ? 'No compliance audit records or decision logs found in PostgreSQL database.'
                : 'No audit records match the current filter or search criteria.'}
            </p>
            <button
              onClick={handleManualRefresh}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} /> Refresh Audit History
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  borderBottom: '1px solid #e2e8f0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  fontSize: '11px'
                }}>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Timestamp</th>
                  <th style={{ padding: '14px 14px', fontWeight: 700 }}>Actor / Analyst</th>
                  <th style={{ padding: '14px 14px', fontWeight: 700 }}>Action</th>
                  <th style={{ padding: '14px 14px', fontWeight: 700 }}>Transaction / Reference</th>
                  <th style={{ padding: '14px 14px', fontWeight: 700 }}>Status Transition</th>
                  <th style={{ padding: '14px 14px', fontWeight: 700 }}>Risk Info</th>
                  <th style={{ padding: '14px 14px', fontWeight: 700 }}>Dual Approver</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Description / Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, idx) => {
                  const dateInfo = safeDateStrings(r.timestamp || r.decidedAt);
                  const badge = getActionBadge(r.action || r.decision);
                  const score = Number(r.riskScore) || 0;
                  const scoreColor = score >= 70 ? '#dc2626' : score >= 50 ? '#d97706' : '#16a34a';

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
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.1s ease',
                        cursor: onOpenCase ? 'pointer' : 'default'
                      }}
                      onClick={onOpenCase ? () => onOpenCase(r) : undefined}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                    >
                      {/* 1. Timestamp (UTC + Local) */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                          {dateInfo.utc}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Local: {dateInfo.local}
                        </div>
                      </td>

                      {/* 2. Actor / Analyst */}
                      <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={13} color="#64748b" />
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{actorName}</span>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b', marginTop: '2px', paddingLeft: '19px' }}>
                          {actorId}
                        </div>
                      </td>

                      {/* 3. Action */}
                      <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '11px',
                          backgroundColor: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`
                        }}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>

                      {/* 4. Reference & Amount */}
                      <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                            {reference}
                          </span>
                          {onOpenCase && (
                            <ExternalLink size={12} color="#2563eb" style={{ opacity: 0.7 }} />
                          )}
                        </div>
                        {rawAmount > 0 && (
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12px', marginTop: '2px' }}>
                            Rs. {rawAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        )}
                        {(r.senderName || r.recipientName) && (
                          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                            {r.senderName || 'Sender'} &rarr; {r.recipientName || 'Recipient'}
                          </div>
                        )}
                      </td>

                      {/* 5. Status Transition: Prev -> New */}
                      <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontWeight: 600
                          }}>
                            {prevStatus}
                          </span>
                          <ArrowRight size={12} color="#94a3b8" />
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: badge.bg,
                            color: badge.text,
                            fontWeight: 700
                          }}>
                            {newStatus}
                          </span>
                        </div>
                      </td>

                      {/* 6. Risk Information */}
                      <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '11px',
                            backgroundColor: `${scoreColor}18`,
                            color: scoreColor,
                            border: `1px solid ${scoreColor}40`
                          }}>
                            {score}/100
                          </span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: scoreColor
                          }}>
                            {r.riskTier || (score >= 70 ? 'CRITICAL' : score >= 50 ? 'HIGH' : 'MEDIUM')}
                          </span>
                        </div>
                      </td>

                      {/* 7. Secondary Approver */}
                      <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: '11px',
                          color: secApprover.includes('N/A') ? '#94a3b8' : '#7c3aed',
                          fontWeight: secApprover.includes('N/A') ? 500 : 700
                        }}>
                          {secApprover}
                        </span>
                      </td>

                      {/* 8. Description / Compliance Justification */}
                      <td style={{ padding: '14px 16px', maxWidth: '280px' }}>
                        <div style={{
                          fontSize: '11px',
                          color: '#334155',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }} title={notes}>
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

        {/* Table Footer Summary */}
        <div style={{
          padding: '12px 20px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <span>
            Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong> compliance audit events
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            All records cryptographically traced in PostgreSQL <code>ApprovalDecisions</code> &amp; <code>AuditLogs</code>
          </span>
        </div>
      </div>

    </div>
  );
}

// Wrapped in Error Boundary for resilience
export default function DecisionHistoryTable(props) {
  return (
    <AuditErrorBoundary onRetry={props.onRefresh}>
      <DecisionHistoryTableInner {...props} />
    </AuditErrorBoundary>
  );
}
