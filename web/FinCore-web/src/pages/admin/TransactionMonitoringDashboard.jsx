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
    case 'Completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'Held': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'Reversed': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    case 'Pending': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const TransactionMonitoringDashboard = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const itemsPerPage = 7;

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        // Include the token if authentication is enabled on the backend
        const token = localStorage.getItem('token'); 
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch('/api/transactions/all', { headers });
        
        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }
        
        const result = await response.json();
        
        // Ensure data is an array
        const fetchedData = Array.isArray(result.data) ? result.data : [];
        setTransactions(fetchedData);
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch transactions", error);
        // Fallback to mock data if API is not running/fails
        setTimeout(() => {
          setTransactions(MOCK_TRANSACTIONS);
          setLoading(false);
        }, 800);
      }
    };
    fetchTransactions();
  }, []);

  const handleReversalSuccess = (id) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'Reversed' } : t));
    setSelectedTransaction(null);
  };

  // Filter and Search Logic
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.sender.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.receiver.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-slate-950 p-8 font-sans text-slate-200">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Transaction Monitoring
          </h1>
          <p className="text-slate-400 mt-2">Live overview of all system-wide wallet transfers.</p>
        </div>

        {/* Controls Panel */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-xl backdrop-blur-md">
          <div className="relative w-full md:w-96 mb-4 md:mb-0">
            <svg className="absolute left-3 top-3 h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search by ID, sender, receiver..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex space-x-4">
            <select 
              className="px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1); // Reset page on filter
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Held">Held</option>
              <option value="Reversed">Reversed</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-sm uppercase tracking-wider">
                  <th className="p-4 font-semibold">Transaction ID</th>
                  <th className="p-4 font-semibold">Sender</th>
                  <th className="p-4 font-semibold">Receiver</th>
                  <th className="p-4 font-semibold text-right">Amount (LKR)</th>
                  <th className="p-4 font-semibold">Date / Time</th>
                  <th className="p-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-slate-500">
                      <div className="flex justify-center items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-slate-500">No transactions found matching your criteria.</td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => (
                    <tr 
                      key={tx.id} 
                      onClick={() => setSelectedTransaction(tx)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 font-mono text-sm text-blue-400 group-hover:text-blue-300">{tx.id}</td>
                      <td className="p-4 text-slate-300">{tx.sender}</td>
                      <td className="p-4 text-slate-300">{tx.receiver}</td>
                      <td className="p-4 text-right font-medium text-slate-200">
                        {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-slate-400 text-sm">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(tx.status)}`}>
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
            <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-between items-center">
              <span className="text-sm text-slate-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} entries
              </span>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
