import React, { useState, useEffect } from 'react';
import { fraudService } from '../../services/fraudService';
import {
  Flag,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  ShieldAlert,
  TrendingUp,
  SlidersHorizontal
} from 'lucide-react';

export default function FraudFlagList({ onSelectFlag, onOpenTrends, onOpenRules }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [riskRangeFilter, setRiskRangeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    loadFlags();
    const interval = setInterval(() => {
      fraudService.getFlags().then(data => {
        setFlags(data);
      }).catch(err => console.error('Silent refresh flags error:', err));
    }, 3000);
    return () => clearInterval(interval);
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

  const filteredFlags = flags.filter(flag => {
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

    if (riskRangeFilter === 'HIGH') {
      if (flag.riskScore < 75) return false;
    } else if (riskRangeFilter === 'MODERATE') {
      if (flag.riskScore < 40 || flag.riskScore >= 75) return false;
    } else if (riskRangeFilter === 'LOW') {
      if (flag.riskScore >= 40) return false;
    }

    if (statusFilter !== 'ALL') {
      if (flag.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    }

    if (dateFilter !== 'ALL' && flag.createdAt) {
      const flagTime = new Date(flag.createdAt).getTime();
      const now = Date.now();
      if (dateFilter === 'TODAY') {
        if (now - flagTime > 24 * 3600 * 1000) return false;
      } else if (dateFilter === 'WEEK') {
        if (now - flagTime > 7 * 24 * 3600 * 1000) return false;
      } else if (dateFilter === 'MONTH') {
        if (now - flagTime > 30 * 24 * 3600 * 1000) return false;
      }
    }

    return true;
  });

  const totalCount = flags.length;
  const criticalCount = flags.filter(f => f.riskScore >= 75).length;
  const pendingCount = flags.filter(f => f.status === 'Flagged' || f.status === 'Under Review' || f.status === 'Pending Second Approval').length;
  const totalFlaggedAmount = flags.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Rejected':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'Pending Second Approval':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Under Review':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const formatCurrency = (amt) => {
    return `Rs. ${(Number(amt) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 font-sans text-gray-900">

      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            FRAUD SCORING &amp; INTELLIGENCE &gt; FLAG MONITORING
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Flag className="w-6 h-6 text-red-600" /> Flagged Transactions List
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Live queue of transactions flagged by automated rule scoring and AI behavioral triggers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenTrends && (
            <button
              onClick={onOpenTrends}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> View Analytics
            </button>
          )}

          {onOpenRules && (
            <button
              onClick={onOpenRules}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" /> Rule Engine
            </button>
          )}

          <button
            onClick={loadFlags}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Flagged</div>
          <div className="text-2xl md:text-3xl font-extrabold text-gray-900">{totalCount}</div>
          <div className="text-xs text-gray-400 mt-1 font-medium">Cumulative queue intake</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Critical Risk (&gt;75)</div>
          <div className="text-2xl md:text-3xl font-extrabold text-red-600">{criticalCount}</div>
          <div className="text-xs text-red-600 mt-1 font-medium">Requires immediate intervention</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pending Action</div>
          <div className="text-2xl md:text-3xl font-extrabold text-amber-600">{pendingCount}</div>
          <div className="text-xs text-amber-600 mt-1 font-medium">Awaiting decision or 2nd approval</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Flagged Exposure</div>
          <div className="text-2xl md:text-3xl font-extrabold text-gray-900">{formatCurrency(totalFlaggedAmount)}</div>
          <div className="text-xs text-gray-400 mt-1 font-medium">Monetary exposure protected</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden space-y-4">

        {/* Toolbar & Filters */}
        <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search TX ID, customer, rule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <select
              value={riskRangeFilter}
              onChange={(e) => setRiskRangeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 cursor-pointer"
            >
              <option value="ALL">All Risk Ranges</option>
              <option value="HIGH">High Risk (&gt; 75)</option>
              <option value="MODERATE">Moderate Risk (40 - 74)</option>
              <option value="LOW">Low Risk (&lt; 40)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Flagged">Flagged</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3.5">Transaction ID</th>
                <th className="px-6 py-3.5">Customer</th>
                <th className="px-6 py-3.5">Triggered Rules</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
                <th className="px-6 py-3.5 text-center">Risk Score</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading && flags.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading flagged transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredFlags.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredFlags.map((flag) => (
                  <tr
                    key={flag.id}
                    onClick={() => onSelectFlag && onSelectFlag(flag)}
                    className="hover:bg-slate-50 border-b border-gray-100 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-xs text-blue-600">
                      {flag.transactionId}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 text-xs">{flag.customerName}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{flag.customerId}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {flag.triggeredRules?.map((r, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {r.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900 text-xs">
                      {formatCurrency(flag.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-bold text-xs text-gray-900 w-8 text-right">{flag.riskScore}</span>
                        <div className="w-14 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${flag.riskScore >= 70 ? 'bg-red-600' : flag.riskScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${flag.riskScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(flag.status)}`}>
                        {flag.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectFlag) onSelectFlag(flag);
                        }}
                        className="bg-blue-600 text-white hover:bg-blue-700 font-medium px-3 py-1.5 text-xs rounded-md shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        Breakdown <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span>Showing <strong>{filteredFlags.length}</strong> of {flags.length} flagged cases</span>
          <span>Click any row for deep breakdown</span>
        </div>
      </div>

    </div>
  );
}
