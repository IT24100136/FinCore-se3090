import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, X, RotateCcw } from 'lucide-react';

const Toast = ({ message, type }) => (
  <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl border flex items-center space-x-2 animate-in slide-in-from-top-4 duration-200 ${
    type === 'success' 
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

const ReversalActionScreen = ({ transaction, onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  if (!transaction) return null;

  const handleReversal = async () => {
    setIsSubmitting(true);
    setToast(null);

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const targetId = transaction.dbId || transaction.id.replace('TXN-', ''); 

      const response = await fetch(`/api/transactions/${targetId}/reverse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: "Reversed by Admin from Dashboard" })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Reversal failed');
      }

      await new Promise(resolve => setTimeout(resolve, 1200));
      
      setToast({ message: `Transaction ${transaction.id} successfully reversed.`, type: 'success' });
      
      setTimeout(() => {
        onSuccess();
      }, 1200);

    } catch (error) {
      console.error(error);
      setToast({ message: error.message || 'Failed to process reversal. Please try again.', type: 'error' });
      setIsSubmitting(false);
    }
  };

  const isAlreadyReversed = transaction.status === 'Reversed';

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
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Transaction ID</p>
                <p className="text-slate-900 font-mono font-bold">{transaction.id}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isAlreadyReversed ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {transaction.status}
                </span>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Sender</p>
                <p className="text-slate-800 font-semibold">{transaction.sender}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Receiver</p>
                <p className="text-slate-800 font-semibold">{transaction.receiver}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Date & Time</p>
                <p className="text-slate-600 font-medium">{new Date(transaction.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mb-1">Risk Score</p>
                <div className="flex items-center space-x-2">
                  <div className="w-full bg-slate-200 rounded-full h-2 max-w-[80px] overflow-hidden">
                    <div 
                      className={`h-2 rounded-full ${transaction.riskScore > 80 ? 'bg-rose-500' : transaction.riskScore > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${transaction.riskScore}%` }}
                    ></div>
                  </div>
                  <span className={`font-bold ${transaction.riskScore > 80 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {transaction.riskScore}/100
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/80 border-l-4 border-blue-600 p-4 rounded-r-xl border border-blue-100">
            <h3 className="text-blue-900 font-bold text-xs uppercase tracking-wider mb-0.5">Amount to Reverse</h3>
            <p className="text-2xl font-extrabold text-blue-950 font-sans tracking-tight">
              {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button 
            onClick={handleReversal}
            disabled={isSubmitting || isAlreadyReversed}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 ${
              isAlreadyReversed 
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
