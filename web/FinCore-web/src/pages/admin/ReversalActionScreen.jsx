
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, X, RotateCcw } from 'lucide-react';

const API_BASE_URL = "https://fincore-se3090.onrender.com";

const getAuthHeaders = () => {
  const token = localStorage.getItem('jwt_token') || localStorage.getItem('token') || localStorage.getItem('fincore_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const Toast = ({ message, type }) => (
  <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl border flex items-center space-x-2 animate-in slide-in-from-top-4 duration-200 ${type === 'success'
    ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
    : 'bg-rose-900 text-rose-100 border-rose-700'
    }`}>
    {type === 'success' ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
    ) : (
      <AlertTriangle className="w-5 h-5 text-rose-400" />
    )}
    <span className="font-medium text-xs">{message}</span>
  </div>
);

const ReversalActionScreen = ({ transaction, transactionId, onClose, onSuccess }) => {
  const [currentTx, setCurrentTx] = useState(transaction || null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Sync prop changes immediately
  useEffect(() => {
    if (transaction) {
      setCurrentTx(transaction);
    }
  }, [transaction]);

  // Fetch live transaction details from backend API
  useEffect(() => {
    const idToFetch = transaction?.referenceId || transaction?.id || transactionId;

    // If no transaction provided at all, attempt to fetch the latest transaction from live API
    if (!idToFetch) {
      const fetchLatestTransaction = async () => {
        try {
          setLoading(true);
          const headers = getAuthHeaders();
          const response = await fetch(`${API_BASE_URL}/api/transactions/all`, { headers });
          if (response.ok) {
            const result = await response.json();
            const list = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
            if (list.length > 0) {
              setCurrentTx(list[0]);
            }
          }
        } catch (err) {
          console.error('Error fetching fallback transaction:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchLatestTransaction();
      return;
    }

    // Fetch fresh, live details from the database lookup endpoint
    const fetchLiveTransaction = async () => {
      try {
        setLoading(true);
        const headers = getAuthHeaders();
        const targetIdentifier = encodeURIComponent(transaction?.dbId || idToFetch);

        let response = await fetch(`${API_BASE_URL}/api/transactions/lookup/${targetIdentifier}`, { headers });
        if (!response.ok) {
          response = await fetch(`${API_BASE_URL}/api/transactions/ref/${targetIdentifier}`, { headers });
        }

        if (response.ok) {
          const data = await response.json();
          setCurrentTx(prev => ({
            ...(prev || {}),
            ...data,
            id: data.referenceId || data.id || idToFetch,
            dbId: data.id,
            sender: data.senderName || data.sender || (data.senderAccountNumber ? `Account ${data.senderAccountNumber}` : 'N/A'),
            receiver: data.receiverName || data.receiver || (data.receiverAccountNumber ? `Account ${data.receiverAccountNumber}` : 'N/A'),
            amount: data.amount,
            status: data.status,
            timestamp: data.timestamp,
            riskScore: data.riskScore ?? (transaction?.riskScore || 0),
            canReverse: data.canReverse ?? (data.status === 'Completed' || data.status === 'FraudConfirmed')
          }));
        }
      } catch (err) {
        console.error('Error fetching live transaction details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveTransaction();
  }, [transaction?.id, transaction?.referenceId, transactionId]);

  if (!currentTx && !loading) return null;

  const handleReversal = async () => {
    if (!currentTx) return;
    setIsSubmitting(true);
    setToast(null);

    try {
      const headers = getAuthHeaders();
      const targetId = currentTx.dbId || currentTx.id;

      const response = await fetch(`${API_BASE_URL}/api/transactions/${encodeURIComponent(targetId)}/reverse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: "Reversed by Admin from Monitoring Dashboard" })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Reversal failed');
      }

      setToast({ message: `Transaction ${currentTx.id} successfully reversed.`, type: 'success' });
      setCurrentTx(prev => ({ ...prev, status: 'Reversed' }));

      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1200);

    } catch (error) {
      console.error('Reversal error:', error);
      setToast({ message: error.message || 'Failed to process reversal. Please try again.', type: 'error' });
      setIsSubmitting(false);
    }
  };

  const isAlreadyReversed = currentTx?.status === 'Reversed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Transaction Reversal
              </h2>
              <p className="text-xs text-slate-500">Maker-Checker Financial Reversal Confirmation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {loading && !currentTx ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-500">Loading transaction details...</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Transaction ID</p>
                    <p className="text-slate-900 font-mono font-bold">{currentTx?.id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${isAlreadyReversed ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                      {currentTx?.status || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Sender</p>
                    <p className="text-slate-800 font-semibold">{currentTx?.sender || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Receiver</p>
                    <p className="text-slate-800 font-semibold">{currentTx?.receiver || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Date & Time</p>
                    <p className="text-slate-600 font-medium">
                      {currentTx?.timestamp ? new Date(currentTx.timestamp).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Risk Score</p>
                    <div className="flex items-center space-x-2">
                      <div className="w-full bg-slate-200 rounded-full h-2 max-w-[80px] overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${(currentTx?.riskScore || 0) > 80 ? 'bg-rose-500' : (currentTx?.riskScore || 0) > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, currentTx?.riskScore || 0)}%` }}
                        ></div>
                      </div>
                      <span className={`font-bold ${(currentTx?.riskScore || 0) > 80 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {currentTx?.riskScore || 0}/100
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/80 border-l-4 border-blue-600 p-4 rounded-r-xl border border-blue-100">
                <h3 className="text-blue-900 font-bold text-xs uppercase tracking-wider mb-0.5">Amount to Reverse</h3>
                <p className="text-2xl font-extrabold text-blue-950 font-sans tracking-tight">
                  {Number(currentTx?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleReversal}
            disabled={isSubmitting || isAlreadyReversed || !currentTx}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${isAlreadyReversed
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-600'
              }`}
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Processing...</span>
              </div>
            ) : isAlreadyReversed ? (
              'Already Reversed'
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm Reversal</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReversalActionScreen;
