import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  RotateCcw,
  Search,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  CreditCard,
  Clock,
  RefreshCw
} from 'lucide-react';

export default function FinancialReversalsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reversalSuccessResult, setReversalSuccessResult] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchRecent = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/transactions/all', { headers });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.data) ? data.data : [];
        setRecentTransactions(list.slice(0, 10));
      }
    } catch (err) {
      console.error('Error fetching recent transactions:', err);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  const handleSearch = async (identifier) => {
    const idToSearch = identifier || searchQuery.trim();
    if (!idToSearch) return;

    setLoading(true);
    setSearchError(null);
    setReversalSuccessResult(null);
    setActionError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/transactions/lookup/${encodeURIComponent(idToSearch)}`, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Transaction '${idToSearch}' was not found in core ledger.`);
      }

      const data = await res.json();
      setSelectedTx(data);
    } catch (err) {
      setSelectedTx(null);
      setSearchError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteReversal = async (e) => {
    e.preventDefault();
    if (!selectedTx) return;
    if (!reversalReason.trim()) {
      setActionError('A mandatory reversal reason / compliance justification must be provided.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const targetId = selectedTx.id || selectedTx.referenceId;
      const res = await fetch(`/api/transactions/${targetId}/reverse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reason: reversalReason.trim(),
          adminId: user?.employeeId || 'ADM-001'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Ledger reversal failed.');
      }

      setReversalSuccessResult(data);
      setSelectedTx(prev => prev ? {
        ...prev,
        status: 'Reversed',
        canReverse: false,
        note: `[REVERSED by Admin] ${reversalReason.trim()}`
      } : null);
      setIsModalOpen(false);
      setReversalReason('');
      fetchRecent();
    } catch (err) {
      setActionError(err.message || 'Failed to execute reversal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReversible = selectedTx && (selectedTx.status === 'Completed' || selectedTx.status === 'FraudConfirmed');

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>FINANCIAL CORE &amp; LEDGER</span>
              <span>&gt;</span>
              <span className="text-blue-600 font-bold">REVERSAL ACTION</span>
              <span className="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded text-[10px] font-extrabold">
                ADMIN PRIVILEGE
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                <RotateCcw className="w-5 h-5" />
              </div>
              Financial Ledger Reversal Console
            </h1>
            <p className="text-gray-500 text-xs mt-1 max-w-3xl">
              Execute authoritative ledger claw-backs and balance refunds for fraudulent or disputed transactions.
              All reversals debit recipient accounts, credit original senders, and record an immutable event in the Audit Log.
            </p>
          </div>

          <button
            onClick={fetchRecent}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-slate-50 cursor-pointer shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh List
          </button>
        </div>

        {/* Success Alert Banner */}
        {reversalSuccessResult && (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <div className="font-bold text-sm text-emerald-900 mb-1">
                Ledger Reversal Successfully Executed
              </div>
              <div>
                Original Transaction <strong>{reversalSuccessResult.referenceId}</strong> set to <strong>Reversed</strong>.
                Refunded <strong>Rs. {reversalSuccessResult.refundedAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> to sender.
                Reversal Reference: <strong className="text-blue-600">{reversalSuccessResult.reversalReferenceId}</strong>.
              </div>
            </div>
            <button
              onClick={() => setReversalSuccessResult(null)}
              className="text-gray-400 hover:text-gray-600 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search & Lookup Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Lookup Transaction by ID or Reference
          </h2>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Enter Transaction ID (e.g. TXN-1002, TXN-a49b2c...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              {loading ? (
                <span>Searching...</span>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Lookup Transaction</span>
                </>
              )}
            </button>
          </form>

          {searchError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Quick Select Chips */}
          {recentTransactions.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Quick Select Recent Core Transactions:
              </div>
              <div className="flex flex-wrap gap-2">
                {recentTransactions.map((tx) => (
                  <button
                    key={tx.id || tx.referenceId}
                    type="button"
                    onClick={() => {
                      const idStr = tx.referenceId || tx.id;
                      setSearchQuery(idStr);
                      handleSearch(idStr);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors cursor-pointer ${
                      tx.status === 'Reversed'
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : tx.status === 'Completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {tx.id || tx.referenceId} ({tx.status})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Transaction Card */}
        {selectedTx && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden space-y-6 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-500 uppercase">Ledger Record:</span>
                <span className="font-mono font-bold text-sm text-blue-600">
                  {selectedTx.referenceId || selectedTx.id}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  selectedTx.status === 'Reversed' ? 'bg-red-50 text-red-600 border border-red-200' :
                  selectedTx.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  'bg-blue-50 text-blue-600 border border-blue-200'
                }`}>
                  {selectedTx.status?.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{selectedTx.timestamp ? new Date(selectedTx.timestamp).toLocaleString() : 'N/A'}</span>
              </div>
            </div>

            {/* Financial Magnitude */}
            <div className="bg-slate-50 border border-gray-200 rounded-lg p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Transfer Amount
                </div>
                <div className="text-3xl font-extrabold text-gray-900">
                  Rs. {Number(selectedTx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-sm text-gray-500 font-medium ml-2">LKR</span>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 text-right">
                  Risk Score
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-gray-900">{selectedTx.riskScore || 0}/100</span>
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${selectedTx.riskScore >= 70 ? 'bg-red-600' : selectedTx.riskScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${selectedTx.riskScore || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Counterparty Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 border border-gray-200 rounded-lg p-4 space-y-2 text-xs">
                <div className="font-bold text-blue-600 flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4" /> Sender (Originating Account)
                </div>
                <div><span className="text-gray-500">Account No:</span> <strong className="font-mono text-gray-900">{selectedTx.senderAccountNumber || `ACC-${selectedTx.senderWalletId}`}</strong></div>
                <div><span className="text-gray-500">Holder:</span> <strong className="text-gray-900">{selectedTx.senderName || 'N/A'}</strong></div>
                <div><span className="text-gray-500">Email:</span> <span className="text-gray-700">{selectedTx.senderEmail || 'N/A'}</span></div>
              </div>

              <div className="bg-slate-50 border border-gray-200 rounded-lg p-4 space-y-2 text-xs">
                <div className="font-bold text-amber-700 flex items-center gap-2 mb-2">
                  <ArrowRight className="w-4 h-4" /> Recipient (Beneficiary Account)
                </div>
                <div><span className="text-gray-500">Account No:</span> <strong className="font-mono text-gray-900">{selectedTx.receiverAccountNumber || 'N/A'}</strong></div>
                <div><span className="text-gray-500">Beneficiary:</span> <strong className="text-gray-900">{selectedTx.receiverName || 'Recipient'}</strong></div>
                <div><span className="text-gray-500">Email:</span> <span className="text-gray-700">{selectedTx.receiverEmail || 'N/A'}</span></div>
              </div>
            </div>

            {/* Reversal Action Button */}
            {selectedTx.status === 'Reversed' ? (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>This transaction has already been reversed. No duplicate reversals permitted.</span>
              </div>
            ) : !isReversible ? (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Only transactions in <strong>Completed</strong> or <strong>FraudConfirmed</strong> status can be reversed.</span>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-xs">
                  <div className="font-bold text-red-800 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Reversal Action Permitted
                  </div>
                  <div className="text-red-700 mt-0.5">
                    Claw back funds from recipient and issue full refund to sender.
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActionError(null);
                    setIsModalOpen(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 text-xs rounded-md shadow-sm transition-colors cursor-pointer shrink-0"
                >
                  Execute Financial Reversal
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && selectedTx && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-lg w-full overflow-hidden">
              <div className="p-5 bg-red-600 text-white flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="text-base font-bold">Confirm Financial Reversal</h3>
                  <div className="text-xs text-red-100">Irreversible Core Ledger Operation</div>
                </div>
              </div>

              <form onSubmit={handleExecuteReversal} className="p-6 space-y-4 text-xs">
                <p className="text-gray-700 leading-relaxed">
                  Executing authoritative ledger reversal for transaction:
                </p>

                <div className="p-3 bg-slate-50 border border-gray-200 rounded-lg space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Transaction ID:</span>
                    <strong className="text-blue-600">{selectedTx.referenceId || selectedTx.id}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Refund Amount:</span>
                    <strong className="text-red-600">Rs. {Number(selectedTx.amount).toLocaleString()} LKR</strong>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 uppercase mb-1">
                    Reversal Reason / Rationale <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter compliance justification..."
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {actionError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-medium">
                    {actionError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setIsModalOpen(false);
                      setReversalReason('');
                    }}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !reversalReason.trim()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Processing...' : 'Confirm Reversal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
