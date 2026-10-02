import React, { useState, useEffect } from 'react';
import ReversalActionScreen from './ReversalActionScreen';

const MOCK_TRANSACTIONS = [
  { id: 'TXN-1001', sender: 'john_doe', receiver: 'jane_smith', amount: 15000.00, timestamp: '2026-09-29T10:30:00Z', status: 'Held', riskScore: 85 },
  { id: 'TXN-1002', sender: 'alice_w', receiver: 'bob_m', amount: 2500.00, timestamp: '2026-09-29T11:15:00Z', status: 'Completed', riskScore: 12 },
  { id: 'TXN-1003', sender: 'charlie_d', receiver: 'eve_o', amount: 50000.00, timestamp: '2026-09-29T12:00:00Z', status: 'Pending', riskScore: 45 },
  { id: 'TXN-1004', sender: 'mallory_r', receiver: 'trent_b', amount: 12000.00, timestamp: '2026-09-29T13:45:00Z', status: 'Reversed', riskScore: 92 },
  { id: 'TXN-1005', sender: 'david_k', receiver: 'john_doe', amount: 800.00, timestamp: '2026-09-29T14:20:00Z', status: 'Completed', riskScore: 5 },
];

const getStatusColor = (status) => {
  switch (status) {
    case 'Completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Held': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'PendingSecondApproval': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Reversed': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Pending': return 'bg-blue-50 text-blue-700 border-blue-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
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
      // Fallback only if no data currently loaded
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

  // Filter and Search Logic
  const filteredTransactions = transactions.filter(t => {
    const s = (t.sender || '').toLowerCase();
    const r = (t.receiver || '').toLowerCase();
    const txId = (t.id || '').toLowerCase();
    const q = searchTerm.toLowerCase();

    const matchesSearch = s.includes(q) || r.includes(q) || txId.includes(q);
    const matchesStatus = statusFilter === 'All' || (t.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Transaction Monitoring
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                LIVE
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">Overall system monitoring view across all transaction lifecycles.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Auto-refreshing every 3s</span>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm gap-4">
          <div className="relative w-full md:w-96">
            <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search by ID, sender, receiver..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <span className="text-xs font-medium text-slate-500">Filter:</span>
            <select 
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer font-medium"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Held">Held</option>
              <option value="PendingSecondApproval">Pending Second Approval</option>
              <option value="Pending">Pending</option>
              <option value="Reversed">Reversed</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <th className="p-4">Transaction ID</th>
                  <th className="p-4">Sender</th>
                  <th className="p-4">Receiver</th>
                  <th className="p-4 text-right">Amount (LKR)</th>
                  <th className="p-4 text-center">Risk Score</th>
                  <th className="p-4">Date / Time</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-slate-400">
                      <div className="flex justify-center items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-slate-400">No transactions found matching your criteria.</td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => (
                    <tr 
                      key={tx.id} 
                      onClick={() => setSelectedTransaction(tx)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 font-mono font-medium text-blue-600 group-hover:underline">{tx.id}</td>
                      <td className="p-4 text-slate-700">{tx.sender}</td>
                      <td className="p-4 text-slate-700">{tx.receiver}</td>
                      <td className="p-4 text-right font-semibold text-slate-900">
                        {Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          tx.riskScore >= 70 ? 'bg-red-100 text-red-700' :
                          tx.riskScore >= 40 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {tx.riskScore || 0}/100
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 text-xs">
                        {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(tx.status)}`}>
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
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} entries
              </span>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
