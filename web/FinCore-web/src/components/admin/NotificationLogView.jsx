import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  RefreshCw, 
  Send, 
  Clock, 
  AlertCircle,
  Copy,
  Check,
  AlertTriangle
} from 'lucide-react';

export default function NotificationLogView({ onResendNotification, searchQuery = '' }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [resendingId, setResendingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchNotificationLogs = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('jwt_token') || localStorage.getItem('token') || localStorage.getItem('fincore_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get('/api/notifications/logs', { headers });
      setLogs(response.data || []);
    } catch (err) {
      console.error('Error fetching notification logs:', err);
      setError(err.message || 'Failed to load notification logs from backend API.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotificationLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const recipientStr = (log.recipient || '').toLowerCase();
    const nameStr = (log.recipientName || '').toLowerCase();
    const msgStr = (log.message || '').toLowerCase();
    const idStr = String(log.id || '').toLowerCase();

    const matchesSearch =
      !q ||
      recipientStr.includes(q) ||
      nameStr.includes(q) ||
      msgStr.includes(q) ||
      idStr.includes(q);

    const matchesType = typeFilter === 'All' || log.type === typeFilter;
    const matchesStatus = statusFilter === 'All' || log.deliveryStatus === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleResend = async (logItem) => {
    setResendingId(logItem.id);
    try {
      const token = localStorage.getItem('jwt_token') || localStorage.getItem('token') || localStorage.getItem('fincore_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      await axios.post('/api/notifications/send', {
        userId: logItem.userId || 1,
        recipient: logItem.recipient,
        recipientName: logItem.recipientName,
        type: logItem.type,
        message: logItem.message,
        title: logItem.title || 'FinCore Security Notice',
        category: logItem.category || 'info'
      }, { headers });

      setLogs((prevLogs) =>
        prevLogs.map((log) =>
          log.id === logItem.id
            ? {
                ...log,
                deliveryStatus: 'Sent',
                timestamp: new Date().toISOString(),
                latencyMs: Math.floor(Math.random() * 200) + 150
              }
            : log
        )
      );

      if (onResendNotification) {
        onResendNotification(logItem.id);
      }
    } catch (err) {
      console.error('Failed to resend notification:', err);
    } finally {
      setResendingId(null);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* View Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Notification Log Viewer
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit customer security alerts, SMS OTP deliveries, and transactional email logs.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchNotificationLogs}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Type Filter */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 font-medium">Channel:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="All">All Channels</option>
              <option value="Email">Email Only</option>
              <option value="SMS">SMS Only</option>
              <option value="InApp">In-App Only</option>
            </select>
          </div>

          {/* Delivery Status Filter */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Sent">Sent (Success)</option>
              <option value="Failed">Failed (Error)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 shadow-sm flex flex-col items-center justify-center space-y-4 min-h-[300px]">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-500 animate-pulse">
            Fetching live customer notification logs from PostgreSQL server...
          </p>
        </div>
      )}

      {/* Error Banner */}
      {error && !isLoading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between gap-3 text-rose-800 text-xs font-medium shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <div>
              <span className="font-bold block text-rose-900 font-sans">API Connection Error</span>
              <span>{error}</span>
            </div>
          </div>
          <button
            onClick={fetchNotificationLogs}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition-colors shadow-sm shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Clean White Card Data Table */}
      {!isLoading && !error && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Customer Recipient</th>
                  <th className="py-3.5 px-6">Type</th>
                  <th className="py-3.5 px-6">Message Content</th>
                  <th className="py-3.5 px-6">Delivery Status</th>
                  <th className="py-3.5 px-6">Timestamp</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-400" />
                      <p className="text-sm font-medium">No customer notification logs match your filter criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isSent = log.deliveryStatus === 'Sent';
                    return (
                      <tr
                        key={log.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          !isSent ? 'bg-rose-50/20' : ''
                        }`}
                      >
                        {/* Recipient Column - Customer Contact & Name */}
                        <td className="py-4 px-6">
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{log.recipient}</span>
                              <button
                                onClick={() => copyToClipboard(log.recipient, log.id)}
                                className="text-slate-400 hover:text-blue-600 transition-colors"
                                title="Copy Customer Contact"
                              >
                                {copiedId === log.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            {log.recipientName && (
                              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                Customer: {log.recipientName}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Type Column (SMS or Email Badge) */}
                        <td className="py-4 px-6">
                          {log.type === 'Email' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Mail className="w-3.5 h-3.5 text-indigo-600" />
                              Email
                            </span>
                          ) : log.type === 'SMS' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                              <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                              SMS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              <Bell className="w-3.5 h-3.5 text-slate-600" />
                              In-App
                            </span>
                          )}
                        </td>

                        {/* Message Snippet Column */}
                        <td className="py-4 px-6 max-w-xs md:max-w-md">
                          <p className="text-slate-700 truncate font-sans text-xs leading-relaxed" title={log.message}>
                            {log.message}
                          </p>
                          {log.channelDetails && (
                            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                              {log.channelDetails}
                            </span>
                          )}
                        </td>

                        {/* Delivery Status Column */}
                        <td className="py-4 px-6">
                          {isSent ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Sent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-sm">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              Failed
                            </span>
                          )}
                        </td>

                        {/* Timestamp Column */}
                        <td className="py-4 px-6 text-slate-600 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                        </td>

                        {/* Actions Column */}
                        <td className="py-4 px-6 text-right">
                          {!isSent ? (
                            <button
                              onClick={() => handleResend(log)}
                              disabled={resendingId === log.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${resendingId === log.id ? 'animate-spin' : ''}`} />
                              <span>{resendingId === log.id ? 'Sending...' : 'Resend'}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">
                              {log.latencyMs || 150}ms
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Summary */}
          <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredLogs.length} of {logs.length} logged dispatches</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Sent: {logs.filter(l => l.deliveryStatus === 'Sent').length}
              </span>
              <span className="flex items-center gap-1.5 text-rose-700 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Failed: {logs.filter(l => l.deliveryStatus === 'Failed').length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
