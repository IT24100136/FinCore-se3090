import React, { useState, useEffect } from 'react';
import { fraudService } from '../../services/fraudService';
import {
  Flag,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  DollarSign,
  TrendingUp,
  FileText,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

export default function FraudFlagList({ onSelectFlag, onOpenTrends, onOpenRules }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown filter states
  const [riskRangeFilter, setRiskRangeFilter] = useState('ALL'); // 'ALL' | 'HIGH' (>75) | 'MODERATE' (40-75) | 'LOW' (<40)
  const [dateFilter, setDateFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'WEEK' | 'MONTH'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Flagged' | 'Under Review' | 'Pending Second Approval' | 'Approved' | 'Rejected'

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    setLoading(true);
    try {
      const data = await fraudService.getFlags();
      setFlags(data);
    } catch (err) {
      console.error('Error fetching flags:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtering logic
  const filteredFlags = flags.filter(flag => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        (flag.transactionId && flag.transactionId.toLowerCase().includes(q)) ||
        (flag.customerName && flag.customerName.toLowerCase().includes(q)) ||
        (flag.customerId && flag.customerId.toLowerCase().includes(q)) ||
        (flag.originIp && flag.originIp.toLowerCase().includes(q)) ||
        (flag.triggeredRules && flag.triggeredRules.some(r => r.label.toLowerCase().includes(q)));
      if (!matchSearch) return false;
    }

    // 2. Risk Range Filter
    if (riskRangeFilter === 'HIGH') {
      if (flag.riskScore < 75) return false;
    } else if (riskRangeFilter === 'MODERATE') {
      if (flag.riskScore < 40 || flag.riskScore >= 75) return false;
    } else if (riskRangeFilter === 'LOW') {
      if (flag.riskScore >= 40) return false;
    }

    // 3. Status Filter
    if (statusFilter !== 'ALL') {
      if (flag.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    }

    // 4. Date Filter
    if (dateFilter !== 'ALL' && flag.createdAt) {
      const flagTime = new Date(flag.createdAt).getTime();
      const now = Date.now();
      if (dateFilter === 'TODAY') {
        const oneDay = 24 * 3600 * 1000;
        if (now - flagTime > oneDay) return false;
      } else if (dateFilter === 'WEEK') {
        const oneWeek = 7 * 24 * 3600 * 1000;
        if (now - flagTime > oneWeek) return false;
      } else if (dateFilter === 'MONTH') {
        const oneMonth = 30 * 24 * 3600 * 1000;
        if (now - flagTime > oneMonth) return false;
      }
    }

    return true;
  });

  // Calculate summary metrics
  const totalCount = flags.length;
  const criticalCount = flags.filter(f => f.riskScore >= 75).length;
  const pendingCount = flags.filter(f => f.status === 'Flagged' || f.status === 'Under Review' || f.status === 'Pending Second Approval').length;
  const totalFlaggedAmount = flags.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  // Helper for score badge styling
  const getRiskScoreBadge = (score) => {
    if (score >= 75) {
      return {
        bg: '#fee2e2',
        border: '#ef4444',
        text: '#dc2626',
        label: 'HIGH RISK',
        barColor: '#dc2626'
      };
    }
    if (score >= 40) {
      return {
        bg: '#fef3c7',
        border: '#f59e0b',
        text: '#d97706',
        label: 'MODERATE',
        barColor: '#f59e0b'
      };
    }
    return {
      bg: '#dcfce7',
      border: '#10b981',
      text: '#16a34a',
      label: 'LOW RISK',
      barColor: '#10b981'
    };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return { bg: '#dcfce7', text: '#15803d', icon: CheckCircle };
      case 'Rejected':
        return { bg: '#fee2e2', text: '#b91c1c', icon: XCircle };
      case 'Pending Second Approval':
        return { bg: '#fef3c7', text: '#b45309', icon: Clock };
      case 'Under Review':
        return { bg: '#e0f2fe', text: '#0369a1', icon: Clock };
      default: // 'Flagged'
        return { bg: '#fef2f2', text: '#dc2626', icon: AlertTriangle };
    }
  };

  const formatCurrency = (amt) => {
    return `Rs. ${(Number(amt) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Top Header & Breadcrumbs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, letterSpacing: '0.4px', marginBottom: '4px' }}>
            FRAUD SCORING &amp; INTELLIGENCE &gt; FLAG MONITORING
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Flag size={24} color="#dc2626" /> Flagged Transactions List
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
            Live queue of transactions flagged by automated rule scoring and AI behavioral triggers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onOpenTrends && (
            <button
              onClick={onOpenTrends}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                backgroundColor: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <TrendingUp size={15} color="#2563eb" /> View Analytics Trends
            </button>
          )}

          {onOpenRules && (
            <button
              onClick={onOpenRules}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                backgroundColor: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <SlidersHorizontal size={15} color="#64748b" /> Rule Engine
            </button>
          )}

          <button
            onClick={loadFlags}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37,99,235,0.3)'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh Queue
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {/* Card 1: Total Flags */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Transactions Flagged</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '6px 0 2px 0' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Cumulative queue intake</div>
        </div>

        {/* Card 2: High Risk (> 75) */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '18px 20px',
          border: '1px solid #fee2e2',
          borderLeft: '4px solid #dc2626',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>Critical / High Risk (&gt; 75)</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#dc2626', margin: '6px 0 2px 0' }}>
            {criticalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#991b1b' }}>Requires immediate analyst intervention</div>
        </div>

        {/* Card 3: Pending Decision */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '18px 20px',
          border: '1px solid #fef3c7',
          borderLeft: '4px solid #f59e0b',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '12px', color: '#d97706', fontWeight: 700 }}>Pending Review / Action</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#b45309', margin: '6px 0 2px 0' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '11px', color: '#78350f' }}>Awaiting decision or 2nd approval</div>
        </div>

        {/* Card 4: Flagged Exposure Value */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '18px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Value Flagged</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '6px 0 2px 0' }}>
            {formatCurrency(totalFlaggedAmount)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Monetary exposure currently guarded</div>
        </div>
      </div>

      {/* Main Table Card with Integrated Header Filters */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>

        {/* Header Filter Bar */}
        <div style={{
          padding: '18px 24px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Flagged Queue</span>
              <span style={{
                backgroundColor: '#e2e8f0',
                color: '#334155',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {filteredFlags.length} of {flags.length}
              </span>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Auto-refresh: <strong style={{ color: '#16a34a' }}>Live WebSocket Synced</strong>
            </div>
          </div>

          {/* Interactive Filters Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 1.5fr) repeat(3, minmax(140px, 1fr))',
            gap: '12px',
            alignItems: 'center'
          }}>

            {/* 1. Global Search */}
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <input
                type="text"
                placeholder="Search TX ID, customer name, rule..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  backgroundColor: '#fff'
                }}
              />
            </div>

            {/* 2. Risk Range Filter */}
            <div>
              <select
                value={riskRangeFilter}
                onChange={(e) => setRiskRangeFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#fff',
                  color: riskRangeFilter === 'HIGH' ? '#dc2626' : '#334155',
                  fontWeight: riskRangeFilter !== 'ALL' ? 700 : 500,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Risk Ranges</option>
                <option value="HIGH">High Risk (&gt; 75)</option>
                <option value="MODERATE">Moderate Risk (40 - 74)</option>
                <option value="LOW">Low Risk (&lt; 40)</option>
              </select>
            </div>

            {/* 3. Date Filter */}
            <div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#fff',
                  color: '#334155',
                  fontWeight: dateFilter !== 'ALL' ? 700 : 500,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today (Last 24h)</option>
                <option value="WEEK">Last 7 Days</option>
                <option value="MONTH">Last 30 Days</option>
              </select>
            </div>

            {/* 4. Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#fff',
                  color: '#334155',
                  fontWeight: statusFilter !== 'ALL' ? 700 : 500,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="Flagged">Flagged</option>
                <option value="Under Review">Under Review</option>
                <option value="Pending Second Approval">Pending 2nd Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

          </div>

        </div>

        {/* Flag Items Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{
                backgroundColor: '#f8fafc',
                color: '#475569',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <th style={{ padding: '12px 18px', fontWeight: 700 }}>Transaction ID</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Customer Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Triggered Rules</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Amount</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Risk Score</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '12px 18px', fontWeight: 700, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && flags.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block', color: '#2563eb' }} />
                    Loading flagged transactions...
                  </td>
                </tr>
              ) : filteredFlags.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                    <ShieldAlert size={36} color="#cbd5e1" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredFlags.map((flag) => {
                  const scoreBadge = getRiskScoreBadge(flag.riskScore);
                  const statusBadge = getStatusBadge(flag.status);
                  const StatusIcon = statusBadge.icon;

                  return (
                    <tr
                      key={flag.id}
                      onClick={() => onSelectFlag && onSelectFlag(flag)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                        backgroundColor: '#fff'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                    >
                      {/* Transaction ID */}
                      <td style={{ padding: '16px 18px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            color: '#2563eb',
                            backgroundColor: '#eff6ff',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}>
                            {flag.transactionId}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                          {new Date(flag.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Customer Name */}
                      <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                          {flag.customerName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {flag.customerId} • {flag.originIp}
                        </div>
                      </td>

                      {/* Triggered Rules (Pill-style list) */}
                      <td style={{ padding: '16px 16px', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {flag.triggeredRules && flag.triggeredRules.length > 0 ? (
                            flag.triggeredRules.map((rule, rIdx) => {
                              const isHighRisk = rule.points >= 30;
                              return (
                                <span
                                  key={rIdx}
                                  title={rule.description || rule.label}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    backgroundColor: isHighRisk ? '#fee2e2' : '#fef3c7',
                                    color: isHighRisk ? '#b91c1c' : '#b45309',
                                    border: `1px solid ${isHighRisk ? '#fca5a5' : '#fde68a'}`,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <span style={{
                                    width: '5px',
                                    height: '5px',
                                    borderRadius: '50%',
                                    backgroundColor: isHighRisk ? '#dc2626' : '#f59e0b'
                                  }} />
                                  {rule.label}
                                </span>
                              );
                            })
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              Baseline parameters
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Monetary Amount */}
                      <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
                          {formatCurrency(flag.amount)}
                        </div>
                        {flag.amount >= 75000 && (
                          <span style={{
                            display: 'inline-block',
                            marginTop: '2px',
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#b45309',
                            backgroundColor: '#fef3c7',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            Dual Maker Gate
                          </span>
                        )}
                      </td>

                      {/* Calculated Risk Score (Prominently Displayed) */}
                      <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'baseline',
                              gap: '2px',
                              backgroundColor: scoreBadge.bg,
                              border: `1px solid ${scoreBadge.border}`,
                              color: scoreBadge.text,
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontWeight: 900,
                              fontSize: '14px'
                            }}>
                              <span>{flag.riskScore}</span>
                              <span style={{ fontSize: '10px', opacity: 0.8 }}>/100</span>
                            </div>
                            <div style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: scoreBadge.text,
                              marginTop: '2px',
                              letterSpacing: '0.4px'
                            }}>
                              {scoreBadge.label}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 9px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: statusBadge.bg,
                          color: statusBadge.text
                        }}>
                          <StatusIcon size={12} />
                          {flag.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '16px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectFlag) onSelectFlag(flag);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '7px 12px',
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(37,99,235,0.3)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Breakdown <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div style={{
          padding: '14px 24px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          fontSize: '12px',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            Showing <strong>{filteredFlags.length}</strong> flagged cases matching criteria
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Click any transaction row to inspect score breakdown and geolocation anomaly</span>
          </div>
        </div>

      </div>

    </div>
  );
}
