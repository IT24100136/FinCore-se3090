import React, { useState } from 'react';

// A simple local Toast notification component to avoid external dependencies
const Toast = ({ message, type }) => (
  <div className={`absolute top-4 right-4 px-4 py-3 rounded-lg shadow-lg border flex items-center space-x-2 animate-fade-in-down ${
    type === 'success' 
      ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100' 
      : 'bg-rose-900/90 border-rose-500/50 text-rose-100'
  }`}>
    {type === 'success' ? (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ) : (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )}
    <span className="font-medium text-sm">{message}</span>
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
      // The API call to the ASP.NET Core backend
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Use dbId for real API calls, fallback to mock id
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

      // Mock delay for UI demonstration
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setToast({ message: `Transaction ${transaction.id} successfully reversed.`, type: 'success' });
      
      // Close modal and refresh list after a short delay
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (error) {
      console.error(error);
      setToast({ message: error.message || 'Failed to process reversal. Please try again.', type: 'error' });
      setIsSubmitting(false);
    }
  };

  const isAlreadyReversed = transaction.status === 'Reversed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      {toast && <Toast message={toast.message} type={toast.type} />}
      
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Transaction Action Required
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          <div className="bg-slate-950/50 rounded-xl p-5 border border-slate-800/50">
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-xs font-semibold mb-1">Transaction ID</p>
                <p className="text-slate-200 font-mono">{transaction.id}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-xs font-semibold mb-1">Status</p>
                <p className={`font-medium ${isAlreadyReversed ? 'text-rose-400' : 'text-amber-400'}`}>
                  {transaction.status}
                </p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-xs font-semibold mb-1">Sender</p>
                <p className="text-slate-200 font-medium">{transaction.sender}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-xs font-semibold mb-1">Receiver</p>
                <p className="text-slate-200 font-medium">{transaction.receiver}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-xs font-semibold mb-1">Date & Time</p>
                <p className="text-slate-300">{new Date(transaction.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-xs font-semibold mb-1">Risk Score</p>
                <div className="flex items-center space-x-2">
                  <div className="w-full bg-slate-800 rounded-full h-2 max-w-[80px]">
                    <div 
                      className={`h-2 rounded-full ${transaction.riskScore > 80 ? 'bg-rose-500' : transaction.riskScore > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${transaction.riskScore}%` }}
                    ></div>
                  </div>
                  <span className={`font-bold ${transaction.riskScore > 80 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {transaction.riskScore}/100
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <h3 className="text-blue-400 font-semibold text-sm mb-1">Amount to Reverse</h3>
            <p className="text-2xl font-bold text-slate-100">
              {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-800/30 px-6 py-4 border-t border-slate-700 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button 
            onClick={handleReversal}
            disabled={isSubmitting || isAlreadyReversed}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center justify-center min-w-[180px] ${
              isAlreadyReversed 
                ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white border-t border-rose-400/30'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Processing...</span>
              </div>
            ) : isAlreadyReversed ? (
              'Already Reversed'
            ) : (
              'Confirm Reversal'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReversalActionScreen;
