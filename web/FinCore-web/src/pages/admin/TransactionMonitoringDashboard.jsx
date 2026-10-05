import React, { useState, useEffect } from 'react';
import ReversalActionScreen from './ReversalActionScreen';
import { Search, RefreshCw, Activity, ArrowUpRight } from 'lucide-react';

const MOCK_TRANSACTIONS = [
  { id: 'TXN-1001', sender: 'john_doe', receiver: 'jane_smith', amount: 15000.00, timestamp: '2026-09-29T10:30:00Z', status: 'Held', riskScore: 85 },
  { id: 'TXN-1002', sender: 'alice_w', receiver: 'bob_m', amount: 2500.00, timestamp: '2026-09-29T11:15:00Z', status: 'Completed', riskScore: 12 },
  { id: 'TXN-1003', sender: 'charlie_d', receiver: 'eve_o', amount: 50000.00, timestamp: '2026-09-29T12:00:00Z', status: 'Pending', riskScore: 45 },
  { id: 'TXN-1004', sender: 'mallory_r', receiver: 'trent_b', amount: 12000.00, timestamp: '2026-09-29T13:45:00Z', status: 'Reversed', riskScore: 92 },
  { id: 'TXN-1005', sender: 'david_k', receiver: 'john_doe', amount: 800.00, timestamp: '2026-09-29T14:20:00Z', status: 'Completed', riskScore: 5 },
];

const getStatusBadge = (status) => {
  switch (status) {
    case 'Completed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'Held': return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'PendingSecondApproval': return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'Reversed': return 'bg-red-50 text-red-600 border border-red-200';
    case 'Pending': return 'bg-blue-50 text-blue-600 border border-blue-200';
    default: return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
};

const TransactionMonitoringDashboard = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const itemsPerPage = 8;

  const fetchTransactions = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const token = localStorage.getItem('token'); 
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/transactions/all', { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      
      const result = await response.json();
      const fetchedData = Array.isArray(result.data) ? result.data : [];
      setTransactions(fetchedData);
    } catch (error) {
      setTransactions(prev => prev.length === 0 ? MOCK_TRANSACTIONS : prev);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(true);
    const interval = setInterval(() => {
      fetchTransactions(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleReversalSuccess = (id) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'Reversed' } : t));
    setSelectedTransaction(null);
  };

  const filteredTransactions = transactions.filter(t => {
    const s = (t.sender || '').toLowerCase();
    const r = (t.receiver || '').toLowerCase();
    const txId = (t.id || '').toLowerCase();
    const q = searchTerm.toLowerCase();

    const matchesSearch = s.includes(q) || r.includes(q) || txId.includes(q);
    const matchesStatus = statusFilter === 'All' || (t.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header & Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              MONITORING &gt; TRANSACTIONS
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                Transaction Monitoring
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                LIVE
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-1">Overall system monitoring view across all transaction lifecycles.</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Auto-refreshing every 3s</span>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white border border-gray-200 rounded-lg p-4 shadow-sm gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by ID, sender, receiver..." 
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2 w-full md:w-auto justify-end flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Status:</span>
            {['All', 'Completed', 'Held', 'PendingSecondApproval', 'Reversed'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
                className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-slate-50'
                }`}
              >
                {status === 'PendingSecondApproval' ? 'Dual Approval' : status}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3.5">Transaction ID</th>
                  <th className="px-6 py-3.5">Sender</th>
                  <th className="px-6 py-3.5">Receiver</th>
                  <th className="px-6 py-3.5 text-right">Amount (LKR)</th>
                  <th className="px-6 py-3.5 text-center">Risk Score</th>
                  <th className="px-6 py-3.5">Date / Time</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">No transactions found matching criteria.</td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => (
                    <tr 
                      key={tx.id} 
                      onClick={() => setSelectedTransaction(tx)}
                      className="hover:bg-slate-50 border-b border-gray-100 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-blue-600 group-hover:underline">{tx.id}</td>
                      <td className="px-6 py-4 text-gray-900 font-medium">{tx.sender}</td>
                      <td className="px-6 py-4 text-gray-900 font-medium">{tx.receiver}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">
                        Rs. {Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-bold text-xs text-gray-900 w-8 text-right">{tx.riskScore || 0}</span>
                          <div className="w-14 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                            <div 
                              className={`h-full ${tx.riskScore >= 70 ? 'bg-red-600' : tx.riskScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, tx.riskScore || 0)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadge(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="bg-slate-50 px-6 py-3 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
              <span>
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} entries
              </span>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Overlay for Reversal Action Screen */}
      {selectedTransaction && (
        <ReversalActionScreen 
          transaction={selectedTransaction} 
          onClose={() => setSelectedTransaction(null)}
          onSuccess={() => handleReversalSuccess(selectedTransaction.id)}
        />
      )}
    </div>
  );
};

export default TransactionMonitoringDashboard;
